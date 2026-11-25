"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { Resend } from "resend";
import { createAdminClient } from "./supabase/admin";
import { createClient } from "./supabase/server";
import { ADMIN_EMAILS } from "./supabase/constants";

export type CardRequestInput = {
  cardName: string;
  issuer: string;
  annualFee?: string;
  earnRates?: string;
  link?: string;
  notes?: string;
  email?: string;
  sandbox?: boolean;
  /** Honeypot: real people never fill this in. */
  website?: string;
};

export type CardRequestStatus = "new" | "added" | "dismissed";

export type CardRequest = {
  id: string;
  card_name: string;
  issuer: string;
  annual_fee: number | null;
  earn_rates: string | null;
  link: string | null;
  notes: string | null;
  email: string | null;
  sandbox: boolean;
  status: CardRequestStatus;
  created_at: string;
};

type Result = { ok: true } | { ok: false; error: string };

const MAX_PER_HOUR = 5;

function clean(value: string | undefined, max: number): string | null {
  const v = (value ?? "").replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : null;
}

function normalizeLink(value: string | undefined): string | null | "invalid" {
  const v = clean(value, 500);
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "invalid";
    return url.toString();
  } catch {
    return "invalid";
  }
}

/** One-way hash of the caller's IP so we can rate-limit without storing it. */
async function clientHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`mcc-card-request:${ip}`).digest("hex").slice(0, 32);
}

/** Signed-in user's id, without an auth round-trip for guests. */
async function currentUserId(): Promise<string | null> {
  const store = await cookies();
  const hasSession = store.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasSession) return null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return ADMIN_EMAILS.includes(data.user?.email ?? "");
  } catch {
    return false;
  }
}

export async function submitCardRequest(input: CardRequestInput): Promise<Result> {
  // Bots that fill the hidden field get a silent success.
  if (input.website) return { ok: true };

  const cardName = clean(input.cardName, 120);
  const issuer = clean(input.issuer, 80);
  if (!cardName || cardName.length < 2) return { ok: false, error: "Enter the card's name." };
  if (!issuer) return { ok: false, error: "Enter the bank or issuer." };

  let annualFee: number | null = null;
  const feeText = clean(input.annualFee, 12)?.replace(/[$,]/g, "");
  if (feeText) {
    annualFee = Number(feeText);
    if (!Number.isFinite(annualFee) || annualFee < 0 || annualFee > 99999) {
      return { ok: false, error: "Annual fee should be a dollar amount, like 95." };
    }
  }

  const link = normalizeLink(input.link);
  if (link === "invalid") return { ok: false, error: "That link doesn't look like a web address." };

  const email = clean(input.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }

  const row = {
    card_name: cardName,
    issuer,
    annual_fee: annualFee,
    earn_rates: clean(input.earnRates, 1000),
    link,
    notes: clean(input.notes, 1000),
    email,
    sandbox: Boolean(input.sandbox),
    user_id: await currentUserId(),
    client_hash: await clientHash(),
  };

  const db = createAdminClient();
  let stored = false;

  if (db) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await db
      .from("card_requests")
      .select("id", { count: "exact", head: true })
      .eq("client_hash", row.client_hash)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_HOUR) {
      return { ok: false, error: "Thanks! You've sent a lot of requests already. Try again in an hour." };
    }

    const { error } = await db.from("card_requests").insert(row);
    if (error) console.error("[card-request] insert failed:", error.message);
    else stored = true;
  }

  // Email Keith as well when Resend is configured, so requests still arrive if
  // the table hasn't been created yet.
  const emailed = await notifyByEmail(row);

  if (!stored && !emailed) {
    return { ok: false, error: "Requests can't be saved right now. Please try again later." };
  }
  return { ok: true };
}

async function notifyByEmail(row: {
  card_name: string;
  issuer: string;
  annual_fee: number | null;
  earn_rates: string | null;
  link: string | null;
  notes: string | null;
  email: string | null;
  sandbox: boolean;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const lines = [
    `Card: ${row.card_name}`,
    `Issuer: ${row.issuer}`,
    row.annual_fee !== null ? `Annual fee: $${row.annual_fee}` : null,
    row.earn_rates ? `Earn rates: ${row.earn_rates}` : null,
    row.link ? `Link: ${row.link}` : null,
    row.notes ? `Notes: ${row.notes}` : null,
    row.email ? `Requester email: ${row.email}` : null,
    row.sandbox ? "Sent from sandbox mode" : null,
  ].filter(Boolean);
  try {
    const { error } = await new Resend(key).emails.send({
      from: process.env.CARD_REQUEST_FROM ?? "MyCreditCardinal <reports@mycreditcardinal.com>",
      to: ADMIN_EMAILS,
      replyTo: row.email ?? undefined,
      subject: `Card request: ${row.card_name} (${row.issuer})`,
      text: lines.join("\n"),
    });
    if (error) {
      console.error("[card-request] email failed:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[card-request] email failed:", err);
    return false;
  }
}

/** Admin only: newest requests first. Returns [] if the table isn't set up. */
export async function listCardRequests(): Promise<CardRequest[]> {
  if (!(await isAdmin())) return [];
  const db = createAdminClient();
  if (!db) return [];
  const { data, error } = await db
    .from("card_requests")
    .select("id, card_name, issuer, annual_fee, earn_rates, link, notes, email, sandbox, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("[card-request] list failed:", error.message);
    return [];
  }
  return (data ?? []) as CardRequest[];
}

/** Admin only: mark a request added or dismissed. */
export async function setCardRequestStatus(id: string, status: CardRequestStatus): Promise<Result> {
  if (!["new", "added", "dismissed"].includes(status)) return { ok: false, error: "Bad status." };
  if (!(await isAdmin())) return { ok: false, error: "Not allowed." };
  const db = createAdminClient();
  if (!db) return { ok: false, error: "Database isn't configured." };
  const { error } = await db.from("card_requests").update({ status }).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
