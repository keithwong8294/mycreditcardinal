import type { Metadata } from "next";
import Link from "next/link";
import { CURRENCIES, VALUATION_SOURCES, VALUATIONS_CHECKED } from "@/lib/currencies";

export const metadata: Metadata = {
  title: "How point values work — MyCreditCardinal",
  description:
    "What Cash-out, MCC and Best case point values mean, where the numbers come from, and every value the app uses.",
};

const cents = (v: number) => `${(v / 100).toFixed(2)}¢`;
const SHORT: Record<string, string> = { tpg: "TPG", nerdwallet: "NerdWallet", upgradedpoints: "Upgraded Pts", omaat: "OMAAT" };

export default function PointValuesPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/" className="text-[12px] text-secondary hover:text-primary transition-colors">
          ← Back to MyCreditCardinal
        </Link>

        <h1 className="mt-6 text-[24px] font-semibold text-primary">How point values work</h1>
        <p className="mt-2 text-[14px] text-secondary leading-relaxed">
          A point is only worth what you redeem it for. MyCreditCardinal doesn&apos;t make points worth more: it
          only changes which value it uses to add them up, and every number it uses is listed below.
        </p>

        <div className="mt-8 space-y-6 text-[13px] text-secondary leading-relaxed">
          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">Cash-out (the default)</h2>
            <p>
              What you get by redeeming for cash back or a statement credit, with no planning. For bank points
              (Chase, Amex, Capital One, Citi, Bilt, Wells Fargo) that&apos;s 1¢ a point. For hotel and airline
              programs, which can&apos;t be cashed out, it&apos;s a low, easy-to-get redemption value. This is what
              most people actually get, so the landing page shows it unless you switch.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">MCC value</h2>
            <p>
              The typical value when you transfer points to airline and hotel partners or book travel with them.
              It&apos;s the <strong className="text-primary">median</strong> of the valuations published by{" "}
              {VALUATION_SOURCES.map((src, i) => (
                <span key={src.id}>
                  {i > 0 && (i === VALUATION_SOURCES.length - 1 ? " and " : ", ")}
                  <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {src.name}
                  </a>
                </span>
              ))}
              , checked {VALUATIONS_CHECKED}. The median keeps one unusually high or low estimate from moving the
              number. Where a site values a bank&apos;s points differently by card, we use its figure for the
              bank&apos;s premium card, since that&apos;s what unlocks transfers. Every source&apos;s number is in
              the table below. It&apos;s a benchmark from those sites, not a promise: you only get it if you
              redeem that way.
            </p>
            <p className="mt-2">
              Some no-fee cards only reach these values alongside a premium card from the same bank. Freedom
              Unlimited and Freedom Flex points need a Sapphire card to transfer, and Custom Cash and Double Cash
              need a Strata Premier. Without the partner card, the app counts them as cash back at every setting.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">Best case</h2>
            <p>
              A strong redemption, such as a premium-cabin flight or a high-end hotel booked with points. Possible,
              but it takes flexibility and effort. Treat it as a ceiling, not a plan.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">Every value the app uses</h2>
            <div className="overflow-x-auto bg-white border border-subtle rounded-lg">
              <table className="w-full text-[13px] tabular-nums">
                <thead>
                  <tr className="text-left text-tertiary border-b border-subtle">
                    <th className="font-medium px-3 py-2">Program</th>
                    <th className="font-medium px-3 py-2 text-right">Cash-out</th>
                    {VALUATION_SOURCES.map((src) => (
                      <th key={src.id} className="font-medium px-2 py-2 text-right whitespace-nowrap">
                        {SHORT[src.id]}
                      </th>
                    ))}
                    <th className="font-medium px-3 py-2 text-right text-primary">MCC</th>
                    <th className="font-medium px-3 py-2 text-right">Best case</th>
                  </tr>
                </thead>
                <tbody>
                  {CURRENCIES.map((c) => (
                    <tr key={c.id} className="border-b border-subtle last:border-b-0">
                      <td className="px-3 py-2 text-primary whitespace-nowrap">{c.name}</td>
                      <td className="px-3 py-2 text-right">{cents(c.floor)}</td>
                      {VALUATION_SOURCES.map((src) => {
                        const v = c.sources?.[src.id];
                        return (
                          <td key={src.id} className="px-2 py-2 text-right text-tertiary">
                            {v === undefined ? "–" : cents(v)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-right font-semibold text-primary">{cents(c.composite)}</td>
                      <td className="px-3 py-2 text-right">{cents(c.ceiling)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] text-tertiary">
              Cents per point or mile. A dash means that site doesn&apos;t publish a value for the program. Cash back
              and Discover have no transfer partners, so every column is 1¢. Bankrate was left out because its
              valuations page wasn&apos;t available when we checked.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">Example</h2>
            <p>
              $100 at 4x earns 400 Amex Membership Rewards points. At cash-out that&apos;s $4. At MCC value
              (1.70¢) it&apos;s $6.80, but only if you transfer the points to a partner and book travel. The
              points are the same either way. Only the redemption changes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
