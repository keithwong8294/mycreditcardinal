import type { Metadata } from "next";
import Link from "next/link";
import { CURRENCIES } from "@/lib/currencies";

export const metadata: Metadata = {
  title: "How point values work — MyCreditCardinal",
  description:
    "What Cash-out, MCC and Best case point values mean, where the numbers come from, and every value the app uses.",
};

const cents = (v: number) => `${(v / 100).toFixed(2)}¢`;

export default function PointValuesPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto px-4 py-12">
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
              It&apos;s a trimmed mean of published valuations from The Points Guy, NerdWallet, Bankrate, Upgraded
              Points and One Mile at a Time: the highest and lowest estimates are dropped and the rest are
              averaged. It&apos;s a benchmark from those sites, not a promise. You only get it if you redeem
              that way.
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
                    <th className="font-medium px-3 py-2 text-right">MCC</th>
                    <th className="font-medium px-3 py-2 text-right">Best case</th>
                  </tr>
                </thead>
                <tbody>
                  {CURRENCIES.map((c) => (
                    <tr key={c.id} className="border-b border-subtle last:border-b-0">
                      <td className="px-3 py-2 text-primary">{c.name}</td>
                      <td className="px-3 py-2 text-right">{cents(c.floor)}</td>
                      <td className="px-3 py-2 text-right">{cents(c.composite)}</td>
                      <td className="px-3 py-2 text-right">{cents(c.ceiling)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] text-tertiary">Cents per point or mile.</p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">Example</h2>
            <p>
              $100 at 4x earns 400 Amex Membership Rewards points. At cash-out that&apos;s $4. At MCC value
              (1.95¢) it&apos;s $7.80, but only if you transfer the points to a partner and book travel. The
              points are the same either way. Only the redemption changes.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
