import StaticPageLayout from "@/components/landing/StaticPageLayout";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-xl font-display font-semibold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const TermsPage = () => (
  <StaticPageLayout
    title="Terms of Service"
    subtitle="Please read these terms carefully before using ACRY."
    lastUpdated="February 17, 2026"
  >
    <Section title="1. Acceptance of Terms">
      <p>By accessing or using ACRY ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including visitors, registered users, and subscribers.</p>
    </Section>

    <Section title="2. Account Registration">
      <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your credentials and for all activities under your account. You must be at least 13 years old to use ACRY.</p>
    </Section>

    <Section title="3. Subscription Plans">
      <p>ACRY offers two paid subscription plans: Pro Brain and Ultra Brain. Each plan is available in monthly and yearly billing cycles. The Pro plan includes a 15-day free trial, available once per user. After trial expiration, a paid subscription is required to continue using the platform.</p>
    </Section>

    <Section title="4. Payments & Billing">
      <p>Payments are processed securely through Razorpay. By subscribing, you authorize us to charge the applicable fees. Subscriptions auto-renew unless cancelled before the renewal date. All prices are in Indian Rupees (₹) and include applicable taxes.</p>
    </Section>

    <Section title="5. Acceptable Use">
      <p>You agree not to:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Use the Service for any unlawful purpose</li>
        <li>Attempt to reverse-engineer or exploit the AI systems</li>
        <li>Share your account credentials with others</li>
        <li>Upload harmful, offensive, or misleading content to communities</li>
        <li>Interfere with the Service's infrastructure or performance</li>
        <li>Use automated scripts, bots, or scrapers without authorization</li>
      </ul>
    </Section>

    <Section title="6. Intellectual Property">
      <p>All content, features, and functionality of ACRY — including AI models, algorithms, design, and branding — are owned by ACRY and protected by intellectual property laws. Your study data remains yours; we only use it to provide and improve the Service as described in our Privacy Policy.</p>
    </Section>

    <Section title="7. AI-Generated Content">
      <p>ACRY uses AI to generate study recommendations, exam questions, and analytics. While we strive for accuracy, AI-generated content is for educational guidance only and should not be considered as professional advice. We do not guarantee specific exam outcomes.</p>
    </Section>

    <Section title="8. Termination">
      <p>We reserve the right to suspend or terminate accounts that violate these terms. You may cancel your subscription and delete your account at any time through your account settings.</p>
    </Section>

    <Section title="9. Limitation of Liability">
      <p>ACRY is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from the use of our Service. Our total liability is limited to the amount you paid in the preceding 12 months.</p>
    </Section>

    <Section title="10. Governing Law">
      <p>These Terms are governed by the laws of India. Any disputes shall be resolved in the courts of India.</p>
    </Section>

    <Section title="11. Changes to Terms">
      <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance. For questions, contact <a href="mailto:support@acry.ai" className="text-primary hover:underline">support@acry.ai</a>.</p>
    </Section>
  </StaticPageLayout>
);

export default TermsPage;
