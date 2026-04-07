import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — MyCreditCardinal",
  description: "Terms and conditions for using MyCreditCardinal.",
};

const LAST_UPDATED = "April 6, 2026";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="text-[12px] text-secondary hover:text-primary transition-colors">
          ← Back to MyCreditCardinal
        </Link>

        <h1 className="mt-6 text-[24px] font-semibold text-primary">Terms of Service</h1>
        <p className="mt-1 text-[12px] text-tertiary">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-6 text-[13px] text-secondary leading-relaxed">
          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">1. Acceptance of Terms</h2>
            <p>
              By accessing or using MyCreditCardinal (&quot;the Service&quot;), you agree to be bound by
              these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">2. Description of Service</h2>
            <p>
              MyCreditCardinal is a credit card rewards optimization tool. The Service helps you
              track your credit cards, simulate spending scenarios, and identify opportunities to
              maximize rewards earnings.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">3. Not Financial Advice</h2>
            <p className="font-medium text-primary">
              MyCreditCardinal is for informational purposes only and does not constitute financial,
              legal, or tax advice.
            </p>
            <p className="mt-2">
              Rewards values, earn rates, and card benefits are subject to change by card issuers
              at any time. Always verify current terms directly with your card issuer before making
              financial decisions. We are not responsible for any financial decisions made based on
              information provided by this Service.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">4. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activity under your account. You must be at least 18 years old to use
              the Service.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">5. Subscriptions and Billing</h2>
            <p>
              Pro subscriptions are billed monthly or annually via Stripe. You may cancel at any
              time; your access continues until the end of the current billing period. We do not
              offer refunds for partial periods. Trial periods are provided at our discretion and
              may be limited to one per person.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">6. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to reverse engineer or scrape the Service</li>
              <li>Share your account credentials with others</li>
              <li>Interfere with or disrupt the Service or its servers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">7. Disclaimer of Warranties</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind, express or implied.
              We do not warrant that reward values, earn rates, or card data are accurate, complete,
              or current. Card details change frequently and may not reflect your specific card
              version or issuer region.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, MyCreditCardinal shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages arising from your
              use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">9. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Continued use of the Service
              after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">10. Contact</h2>
            <p>
              Questions about these Terms? Email{" "}
              <a href="mailto:legal@mycreditcardinal.com" className="text-green hover:underline">
                legal@mycreditcardinal.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
