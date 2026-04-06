import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { CARDS } from "@/lib/cards";
import { CATEGORIES } from "@/lib/categories";
import { CURRENCY_MAP } from "@/lib/currencies";
import { routeMonth, calculateFees, getRecommendations } from "@/lib/engine";
import type { WalletCard, CardConfig } from "@/types";

export const dynamic = "force-dynamic";

// Vercel Cron: run on the 1st of each month at 09:00 UTC
// Add to vercel.json: { "crons": [{ "path": "/api/cron/health-report", "schedule": "0 9 1 * *" }] }

interface ReportContent {
  month: string;
  totalAnnualEarn: number;
  netFees: number;
  topImprovements: { categoryId: string; cardName: string; rate: number }[];
  recommendations: { cardId: string; cardName: string; netValue: number }[];
  upcomingFees: { cardName: string; fee: number }[];
  subHighlights: { cardId: string; cardName: string; points: number; currency: string }[];
}

function getMonthLabel(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildWalletCards(
  dbWalletCards: Array<{ id: string; card_id: string; config_json: unknown }>
): WalletCard[] {
  return dbWalletCards.flatMap((wc) => {
    const card = CARDS.find((c) => c.id === wc.card_id);
    if (!card) return [];
    const config: CardConfig = {
      rotQ: (wc.config_json as CardConfig)?.rotQ ?? [null, null, null, null],
      custom: (wc.config_json as CardConfig)?.custom ?? [],
    };
    return [{ id: wc.id, card, config }];
  });
}

function generateReportContent(
  walletCards: WalletCard[],
  spend: Record<string, number>
): ReportContent {
  const month = getMonthLabel();

  // Monthly routing at composite valuation
  const routing = routeMonth(walletCards, spend, {}, 1, "composite");
  const fees = calculateFees(walletCards);

  // Annual earn estimate (× 12)
  const totalAnnualEarn = routing.totalDollarValue * 12;

  // Top categories by earn (for routing highlights)
  const topImprovements = routing.rows
    .filter((r) => r.earnRate > 1)
    .sort((a, b) => b.dollarValue - a.dollarValue)
    .slice(0, 3)
    .map((r) => ({
      categoryId: r.categoryId,
      cardName: r.walletCard.card.name,
      rate: r.earnRate,
    }));

  // Top optimizer recommendations
  const recs = getRecommendations(walletCards, spend, {
    maxFee: null,
    minCreditScore: null,
    preferredIssuers: [],
    preferredCurrencies: [],
  }, CARDS, "composite");

  const recommendations = recs.slice(0, 3).map((r) => ({
    cardId: r.card.id,
    cardName: r.card.name,
    netValue: r.netValue,
  }));

  // Upcoming annual fees (all cards in wallet)
  const upcomingFees = walletCards
    .filter((wc) => wc.card.fee > 0)
    .sort((a, b) => b.card.fee - a.card.fee)
    .map((wc) => ({ cardName: wc.card.name, fee: wc.card.fee }));

  // SUB highlights (cards with active SUBs not yet earned)
  const subHighlights = walletCards
    .filter((wc) => wc.card.sub_json !== null)
    .map((wc) => ({
      cardId: wc.card.id,
      cardName: wc.card.name,
      points: wc.card.sub_json!.points,
      currency: CURRENCY_MAP[wc.card.currency]?.name ?? wc.card.currency,
    }));

  return {
    month,
    totalAnnualEarn,
    netFees: fees.netFees,
    topImprovements,
    recommendations,
    upcomingFees,
    subHighlights,
  };
}

function buildEmailHtml(report: ReportContent, userName: string): string {
  const monthName = new Date(report.month + "-01").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const fmtDollar = (n: number) => `$${Math.round(Math.abs(n)).toLocaleString()}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>MyCreditCardinal — ${monthName} Wallet Health Report</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a2e; background: #f8f9fb;">

  <div style="background: #0f1219; padding: 20px 24px; border-radius: 8px; margin-bottom: 24px;">
    <div style="color: white; font-size: 17px; font-weight: 600;">MyCreditCardinal</div>
    <div style="color: rgba(255,255,255,0.4); font-size: 12px; margin-top: 4px;">${monthName} Wallet Health Report</div>
  </div>

  <p style="font-size: 14px; color: #64748b;">Hi ${userName},</p>
  <p style="font-size: 14px; color: #64748b;">Here's your monthly rewards summary and personalized optimizations.</p>

  <div style="background: white; border: 1px solid rgba(0,0,0,0.07); border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h2 style="font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px;">Annual Earn Summary</h2>
    <div style="display: flex; gap: 16px;">
      <div>
        <div style="font-size: 24px; font-weight: 700; color: #059669;">${fmtDollar(report.totalAnnualEarn)}</div>
        <div style="font-size: 11px; color: #94a3b8;">projected annual earn</div>
      </div>
      <div>
        <div style="font-size: 24px; font-weight: 700; color: ${report.netFees > 0 ? "#dc2626" : "#059669"};">${report.netFees > 0 ? "−" : ""}${fmtDollar(report.netFees)}</div>
        <div style="font-size: 11px; color: #94a3b8;">net annual fees</div>
      </div>
    </div>
  </div>

  ${report.recommendations.length > 0 ? `
  <div style="background: white; border: 1px solid rgba(0,0,0,0.07); border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h2 style="font-size: 13px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px;">Top Card Recommendations</h2>
    ${report.recommendations.map((r) => `
      <div style="padding: 10px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
        <div style="font-size: 13px; font-weight: 500; color: #1a1a2e;">${r.cardName}</div>
        <div style="font-size: 12px; color: #059669; font-weight: 600;">+${fmtDollar(r.netValue)} net annual value</div>
      </div>
    `).join("")}
  </div>` : ""}

  <div style="text-align: center; margin: 28px 0;">
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://mycreditcardinal.com"}/reports"
       style="background: #059669; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;">
      View full report →
    </a>
  </div>

  <p style="font-size: 11px; color: #94a3b8; text-align: center;">
    MyCreditCardinal · For informational purposes only. Not financial advice.
  </p>
</body>
</html>
  `.trim();
}

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron (or an admin calling manually)
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const resendKey = process.env.RESEND_API_KEY;
  const resend = resendKey ? new Resend(resendKey) : null;

  const month = getMonthLabel();

  // Fetch all Pro users
  const { data: proUsers } = await supabase
    .from("users")
    .select("id, email, name")
    .eq("plan", "pro");

  if (!proUsers?.length) {
    return Response.json({ message: "No Pro users found", month });
  }

  const results: { userId: string; status: string }[] = [];

  for (const user of proUsers) {
    try {
      // Get household → members → wallet cards
      const { data: households } = await supabase
        .from("households")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      const household = households?.[0];
      if (!household) continue;

      const { data: members } = await supabase
        .from("household_members")
        .select("id")
        .eq("household_id", household.id);
      if (!members?.length) continue;

      const memberIds = members.map((m: { id: string }) => m.id);
      const { data: dbWalletCards } = await supabase
        .from("wallet_cards")
        .select("id, card_id, config_json")
        .in("member_id", memberIds);

      if (!dbWalletCards?.length) continue;

      // Get default spend profile
      const { data: profiles } = await supabase
        .from("spend_profiles")
        .select("spend_json")
        .eq("user_id", user.id)
        .eq("is_default", true)
        .limit(1);
      const spend = (profiles?.[0]?.spend_json as Record<string, number>) ??
        Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultAmount]));

      const walletCards = buildWalletCards(dbWalletCards as Array<{id: string; card_id: string; config_json: unknown}>);
      if (!walletCards.length) continue;

      const report = generateReportContent(walletCards, spend);

      // Upsert report record
      await supabase.from("health_reports").upsert({
        user_id: user.id,
        month,
        content_json: report,
      }, { onConflict: "user_id,month" });

      // Send email
      if (resend) {
        const userName = user.name ?? user.email.split("@")[0];
        await resend.emails.send({
          from: "MyCreditCardinal <reports@mycreditcardinal.com>",
          to: user.email,
          subject: `Your ${new Date(month + "-01").toLocaleDateString("en-US", { month: "long", year: "numeric" })} Wallet Health Report`,
          html: buildEmailHtml(report, userName),
        });
      }

      results.push({ userId: user.id, status: "ok" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      results.push({ userId: user.id, status: `error: ${message}` });
    }
  }

  return Response.json({ month, processed: results.length, results });
}
