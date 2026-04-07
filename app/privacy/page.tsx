import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — MyCreditCardinal",
  description: "How MyCreditCardinal collects, uses, and protects your data.",
};

const LAST_UPDATED = "April 6, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="text-[12px] text-secondary hover:text-primary transition-colors">
          ← Back to MyCreditCardinal
        </Link>

        <h1 className="mt-6 text-[24px] font-semibold text-primary">Privacy Policy</h1>
        <p className="mt-1 text-[12px] text-tertiary">Last updated: {LAST_UPDATED}</p>

        <div className="mt-8 space-y-6 text-[13px] text-secondary leading-relaxed">
          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, including your name, email address,
              and credit card wallet configuration (which cards you hold, spending amounts, and
              preferences). We do not collect actual credit card numbers, account numbers, or any
              financial credentials.
            </p>
            <p className="mt-2">
              We automatically collect certain usage information when you use our service, including
              page views, feature interactions, and device information, via PostHog analytics.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>To provide, maintain, and improve the MyCreditCardinal service</li>
              <li>To personalize your rewards optimization experience</li>
              <li>To send you monthly Wallet Health Reports (Pro subscribers)</li>
              <li>To process payments and manage your subscription via Stripe</li>
              <li>To respond to your comments and questions</li>
              <li>To detect and prevent fraud and abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">3. Data Storage</h2>
            <p>
              Your data is stored securely in Supabase (PostgreSQL) with row-level security policies
              that ensure you can only access your own data. Authentication is handled by Supabase Auth
              with OAuth (Google) and magic link options.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">4. Third-Party Services</h2>
            <p>We use the following third-party services:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li><strong className="text-primary">Supabase</strong> — database and authentication</li>
              <li><strong className="text-primary">Stripe</strong> — payment processing (we never see your card details)</li>
              <li><strong className="text-primary">PostHog</strong> — product analytics</li>
              <li><strong className="text-primary">Vercel</strong> — hosting and edge functions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">5. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. You may request
              deletion of your account and associated data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">6. Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal data. To exercise these
              rights, contact us at{" "}
              <a href="mailto:privacy@mycreditcardinal.com" className="text-green hover:underline">
                privacy@mycreditcardinal.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material
              changes by posting the new policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section>
            <h2 className="text-[15px] font-semibold text-primary mb-2">8. Contact</h2>
            <p>
              Questions about this Privacy Policy? Email{" "}
              <a href="mailto:privacy@mycreditcardinal.com" className="text-green hover:underline">
                privacy@mycreditcardinal.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
