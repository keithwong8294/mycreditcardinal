import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import FAQAccordion from "@/components/FAQAccordion";

export const metadata = {
  title: "MyCreditCardinal — Stop leaving rewards on the table.",
  description:
    "MyCreditCardinal routes every purchase to your highest-earning card, optimizes your wallet, and tells you exactly how much you're earning — and how much more you could.",
};

const BG = "#0f1219";
const BG_ALT = "#111827";

// ─── Free vs Pro feature table ─────────────────────────────────────────────────

const FREE_FEATURES = [
  "Full card browser (24+ cards)",
  "Up to 5 cards, 1 person",
  "Full spend simulator (12 categories)",
  "All 3 valuation tiers",
  "Annual rewards summary",
  "Top 2 optimizer recommendations",
];

const PRO_FEATURES = [
  "Everything in Free",
  "Unlimited cards & household members",
  "Full optimizer — 8 picks + what-if mode",
  "Monthly Wallet Health Report (email + in-app)",
  "SUB alerts & rotation reminders",
  "Annual fee renewal alerts",
  "Export PDF & shareable wallet link",
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/browse");

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      {/* ── Navigation ── */}
      <nav
        className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-sm"
        style={{ background: `${BG}e6` }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-white font-semibold text-[17px] leading-none">
            MyCreditCardinal
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-[13px] text-white/60 hover:text-white transition-colors duration-150 px-3 py-1.5"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="text-[13px] font-medium px-4 py-1.5 rounded-lg bg-[#059669] hover:bg-[#059669]/90 text-white transition-colors duration-150"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-24 pb-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-[12px] text-white/50 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669] shrink-0" />
            Free 30-day trial · No credit card required
          </div>

          <h1 className="text-[42px] sm:text-[56px] font-semibold leading-[1.1] tracking-tight text-white mb-6">
            Stop leaving rewards
            <br />
            on the table.
          </h1>

          <p className="text-[17px] text-white/55 leading-relaxed max-w-2xl mx-auto mb-10">
            Your credit cards could be earning far more. MyCreditCardinal builds
            your virtual wallet, routes each purchase to the highest-earning card,
            and shows you exactly what you&apos;re missing.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto px-7 py-3 rounded-lg bg-[#059669] hover:bg-[#059669]/90 text-white font-medium text-[14px] transition-colors duration-150 text-center"
            >
              Get started free
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-7 py-3 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 font-medium text-[14px] transition-colors duration-150 text-center"
            >
              See how it works ↓
            </a>
          </div>

          <Link
            href="/browse"
            className="inline-block mt-5 text-[13px] text-white/40 hover:text-white/70 transition-colors duration-150 underline underline-offset-2"
          >
            Or continue without signing in
          </Link>

          {/* Stats row */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {[
              { n: "24+", label: "cards at launch" },
              { n: "12", label: "spending categories" },
              { n: "3", label: "valuation tiers" },
              { n: "$0", label: "to get started" },
            ].map(({ n, label }) => (
              <div key={label} className="text-center">
                <div className="text-[28px] font-semibold text-white leading-none">{n}</div>
                <div className="text-[12px] text-white/35 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="py-20 px-6" style={{ background: BG_ALT }}>
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-white/30 font-semibold text-center mb-3">
            How it works
          </p>
          <h2 className="text-[28px] sm:text-[34px] font-semibold text-center text-white mb-14">
            Three steps to optimal rewards
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Add your cards",
                body: "Browse our card database and add the cards you carry. Configure rotating quarterly categories and custom-select picks — the engine handles the rest.",
              },
              {
                step: "02",
                title: "Enter your spending",
                body: "Set monthly amounts for up to 12 categories using sliders. Switch between quarters to model how rotating bonuses change your optimal strategy.",
              },
              {
                step: "03",
                title: "See your optimal setup",
                body: "The routing table shows the best card for every category, flags cap overflows, and gives you a full annual summary broken down by currency.",
              },
            ].map(({ step, title, body }) => (
              <div
                key={step}
                className="rounded-lg border border-white/8 p-6"
                style={{ background: BG }}
              >
                <div className="text-[11px] font-semibold text-[#059669] tracking-widest mb-3">
                  {step}
                </div>
                <h3 className="text-[16px] font-semibold text-white mb-2">{title}</h3>
                <p className="text-[13px] text-white/50 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-white/30 font-semibold text-center mb-3">
            Features
          </p>
          <h2 className="text-[28px] sm:text-[34px] font-semibold text-center text-white mb-14">
            Everything your wallet needs
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                icon: "≋",
                title: "Spend simulator",
                body: "Adjust per-category spending with sliders and see real-time routing updates. Compare all four quarters side by side when rotating bonuses are in play.",
              },
              {
                icon: "◈",
                title: "Smart optimizer",
                body: "Tell us your spending profile and we rank every card not in your wallet by net annual value gained — earn improvement + SUB value − annual fee.",
              },
              {
                icon: "◧",
                title: "Wallet management",
                body: "Track sign-up bonuses, configure rotating quarterly picks, and set custom-select categories for Citi Custom Cash, US Bank Cash+, and more.",
              },
              {
                icon: "⌂",
                title: "Household wallets",
                body: "Add family members with their own cards and spending. View everyone individually or switch to stacked / side-by-side household mode with combined totals.",
              },
            ].map(({ icon, title, body }) => (
              <div
                key={title}
                className="rounded-lg border border-white/8 p-6 flex gap-4"
                style={{ background: BG_ALT }}
              >
                <div className="text-[22px] text-[#059669] shrink-0 mt-0.5 w-7 text-center">
                  {icon}
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">{title}</h3>
                  <p className="text-[13px] text-white/50 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-20 px-6" style={{ background: BG_ALT }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-white/30 font-semibold text-center mb-3">
            Pricing
          </p>
          <h2 className="text-[28px] sm:text-[34px] font-semibold text-center text-white mb-3">
            Free to start. Pro when you&apos;re ready.
          </h2>
          <p className="text-center text-[14px] text-white/40 mb-12">
            30-day free trial includes full Pro access. No card required.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Free */}
            <div className="rounded-lg border border-white/8 p-6" style={{ background: BG }}>
              <div className="text-[13px] font-semibold text-white/50 uppercase tracking-wider mb-1">
                Free
              </div>
              <div className="text-[36px] font-semibold text-white leading-none mb-1">$0</div>
              <div className="text-[12px] text-white/30 mb-6">forever</div>
              <ul className="space-y-2.5 mb-8">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-white/60">
                    <span className="text-[#059669] mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full text-center py-2.5 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 text-[13px] font-medium transition-colors duration-150"
              >
                Get started free
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-lg border border-[#059669]/40 p-6 relative" style={{ background: BG }}>
              <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-[#059669]/15 text-[#34d399] text-[10px] font-semibold uppercase tracking-wider">
                Most popular
              </div>
              <div className="text-[13px] font-semibold text-[#34d399] uppercase tracking-wider mb-1">
                Pro
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-[36px] font-semibold text-white leading-none">$7.99</div>
                <div className="text-[13px] text-white/40">/month</div>
              </div>
              <div className="text-[12px] text-white/30 mb-6">or $59.99/year (save 37%)</div>
              <ul className="space-y-2.5 mb-8">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-white/60">
                    <span className="text-[#059669] mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full text-center py-2.5 rounded-lg bg-[#059669] hover:bg-[#059669]/90 text-white text-[13px] font-medium transition-colors duration-150"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-white/30 font-semibold text-center mb-3">
            What people are saying
          </p>
          <h2 className="text-[28px] sm:text-[34px] font-semibold text-center text-white mb-14">
            Real results, real people
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                quote:
                  "Found out I was leaving $400/year on the table by using the wrong card for groceries. Fixed in five minutes.",
                name: "Sarah T.",
                tag: "Free user",
              },
              {
                quote:
                  "The household view is a game-changer. My partner and I optimized our combined wallet — we're saving over $600 a year now.",
                name: "Marcus R.",
                tag: "Pro subscriber",
              },
              {
                quote:
                  "I've tried other reward trackers. Nothing comes close to how clearly MyCreditCardinal explains which card to use and why.",
                name: "Jennifer L.",
                tag: "Pro subscriber",
              },
            ].map(({ quote, name, tag }) => (
              <div
                key={name}
                className="rounded-lg border border-white/8 p-6"
                style={{ background: BG_ALT }}
              >
                <p className="text-[13px] text-white/60 leading-relaxed mb-5">&ldquo;{quote}&rdquo;</p>
                <div>
                  <div className="text-[13px] font-medium text-white">{name}</div>
                  <div className="text-[11px] text-white/30">{tag}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 px-6" style={{ background: BG_ALT }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-[11px] uppercase tracking-widest text-white/30 font-semibold text-center mb-3">
            FAQ
          </p>
          <h2 className="text-[28px] sm:text-[34px] font-semibold text-center text-white mb-12">
            Common questions
          </h2>
          <FAQAccordion />
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="py-20 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-[28px] sm:text-[36px] font-semibold text-white mb-4">
            Ready to maximize your rewards?
          </h2>
          <p className="text-[15px] text-white/45 mb-8">
            Free 30-day trial. No credit card required. Cancel anytime.
          </p>
          <Link
            href="/login"
            className="inline-block px-8 py-3.5 rounded-lg bg-[#059669] hover:bg-[#059669]/90 text-white font-medium text-[15px] transition-colors duration-150"
          >
            Get started free
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-[15px] font-semibold text-white">MyCreditCardinal</div>
            <div className="text-[12px] text-white/30 mt-0.5">
              Stop leaving rewards on the table.
            </div>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-white/35">
            <Link href="/privacy" className="hover:text-white/70 transition-colors duration-150">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors duration-150">
              Terms
            </Link>
            <Link href="/login" className="hover:text-white/70 transition-colors duration-150">
              Sign in
            </Link>
            <span className="text-white/15">
              © {new Date().getFullYear()} MyCreditCardinal
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
