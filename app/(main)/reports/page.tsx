"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/categories";

interface ReportContent {
  month: string;
  totalAnnualEarn: number;
  netFees: number;
  topImprovements: { categoryId: string; cardName: string; rate: number }[];
  recommendations: { cardId: string; cardName: string; netValue: number }[];
  upcomingFees: { cardName: string; fee: number }[];
  subHighlights: { cardId: string; cardName: string; points: number; currency: string }[];
}

interface HealthReport {
  id: string;
  month: string;
  content_json: ReportContent;
  created_at: string;
}

function fmtDollar(n: number) {
  return `$${Math.round(Math.abs(n)).toLocaleString()}`;
}

function monthLabel(month: string): string {
  return new Date(month + "-01").toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function ReportCard({ report }: { report: HealthReport }) {
  const c = report.content_json;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-subtle rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors"
      >
        <div className="text-left">
          <div className="text-[13px] font-semibold text-primary">{monthLabel(c.month)}</div>
          <div className="text-[11px] text-secondary mt-0.5">
            {fmtDollar(c.totalAnnualEarn)} projected annual earn · {fmtDollar(c.netFees)} net fees
          </div>
        </div>
        <span className="text-tertiary text-[12px]">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="border-t border-subtle divide-y divide-subtle">
          {/* Earn metrics */}
          <div className="px-4 py-3 grid grid-cols-2 gap-3">
            <div className="bg-surface rounded-lg p-3 text-center">
              <div className="text-[22px] font-semibold text-green">{fmtDollar(c.totalAnnualEarn)}</div>
              <div className="text-[10px] text-tertiary mt-0.5">annual earn value</div>
            </div>
            <div className="bg-surface rounded-lg p-3 text-center">
              <div className={`text-[22px] font-semibold ${c.netFees > 0 ? "text-red" : "text-green"}`}>
                {c.netFees > 0 ? "−" : ""}{fmtDollar(c.netFees)}
              </div>
              <div className="text-[10px] text-tertiary mt-0.5">net annual fees</div>
            </div>
          </div>

          {/* Top routing */}
          {c.topImprovements.length > 0 && (
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider mb-2">
                Top earning categories
              </div>
              <div className="space-y-1.5">
                {c.topImprovements.map((imp, i) => {
                  const cat = CATEGORIES.find((cat) => cat.id === imp.categoryId);
                  return (
                    <div key={i} className="flex items-center justify-between text-[12px]">
                      <span className="text-secondary">{cat?.label ?? imp.categoryId}</span>
                      <span className="text-primary font-medium">
                        {imp.rate}x via {imp.cardName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {c.recommendations.length > 0 && (
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider mb-2">
                Card recommendations
              </div>
              <div className="space-y-1.5">
                {c.recommendations.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <span className="text-secondary">{r.cardName}</span>
                    <span className="text-green font-medium">+{fmtDollar(r.netValue)}/yr</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Annual fees */}
          {c.upcomingFees.length > 0 && (
            <div className="px-4 py-3">
              <div className="text-[10px] font-semibold text-tertiary uppercase tracking-wider mb-2">
                Annual fees in your wallet
              </div>
              <div className="space-y-1.5">
                {c.upcomingFees.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-[12px]">
                    <span className="text-secondary">{f.cardName}</span>
                    <span className="text-red font-medium">{fmtDollar(f.fee)}/yr</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    supabase
      .from("health_reports")
      .select("id, month, content_json, created_at")
      .eq("user_id", user.id)
      .order("month", { ascending: false })
      .then(({ data }) => {
        setReports((data as HealthReport[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-[14px] font-semibold text-secondary uppercase tracking-wider">
          Wallet Health Reports
        </h1>
        <p className="text-[12px] text-tertiary mt-0.5">
          Monthly analysis of your wallet performance and optimization opportunities.
        </p>
      </div>

      {loading ? (
        <div className="text-[13px] text-tertiary">Loading…</div>
      ) : reports.length === 0 ? (
        <div className="bg-white border border-subtle rounded-lg p-8 text-center">
          <div className="text-[13px] text-secondary">No reports yet.</div>
          <div className="text-[11px] text-tertiary mt-1">
            Your first report will arrive at the start of next month.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </div>
  );
}
