import StaticPageLayout from "@/components/landing/StaticPageLayout";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-xl font-display font-semibold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const PrivacyPolicyPage = () => (
  <StaticPageLayout
    title="Privacy Policy"
    subtitle="Your privacy is critically important to us at ACRY."
    lastUpdated="February 17, 2026"
  >
    <Section title="1. Information We Collect">
      <p>We collect information you provide directly to us when you create an account, use our services, or communicate with us. This includes:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Name, email address, and account credentials</li>
        <li>Study data, topics, subjects, and exam preferences</li>
        <li>Usage data such as study sessions, quiz results, and progress metrics</li>
        <li>Payment information processed securely through Razorpay</li>
        <li>Device information and browser type for service optimization</li>
      </ul>
    </Section>

    <Section title="2. How We Use Your Information">
      <p>We use the collected information to:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Provide, maintain, and improve our AI-powered study platform</li>
        <li>Personalize your learning experience using AI algorithms</li>
        <li>Send study reminders, notifications, and progress reports</li>
        <li>Process payments and manage subscriptions</li>
        <li>Analyze usage patterns to improve our services</li>
        <li>Communicate with you about updates, promotions, and support</li>
      </ul>
    </Section>

    <Section title="3. AI & Data Processing">
      <p>ACRY uses AI models to analyze your study patterns and provide personalized recommendations. Your study data is processed to generate memory strength predictions, optimal review schedules, and performance analytics. We do not sell your personal study data to third parties.</p>
    </Section>

    <Section title="4. Data Storage & Security">
      <p>Your data is securely stored using industry-standard encryption. We implement technical and organizational measures to protect against unauthorized access, alteration, or destruction of your data. Payment data is processed by Razorpay and we do not store your card details on our servers.</p>
    </Section>

    <Section title="5. Data Sharing">
      <p>We do not sell your personal information. We may share data with:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Service providers who assist in operating our platform (hosting, email, payments)</li>
        <li>Analytics providers in anonymized/aggregated form</li>
        <li>Law enforcement when required by applicable law</li>
      </ul>
    </Section>

    <Section title="6. Your Rights">
      <p>You have the right to access, correct, or delete your personal data. You can export your study data from your account settings. To exercise these rights or for any privacy-related inquiries, contact us at <a href="mailto:support@acry.ai" className="text-primary hover:underline">support@acry.ai</a>.</p>
    </Section>

    <Section title="7. Cookies">
      <p>We use essential cookies for authentication and session management. See our <a href="/cookie-policy" className="text-primary hover:underline">Cookie Policy</a> for details.</p>
    </Section>

    <Section title="8. Changes to This Policy">
      <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification. Continued use of our services after changes constitutes acceptance of the updated policy.</p>
    </Section>

    <Section title="9. Contact Us">
      <p>For privacy-related questions, reach us at <a href="mailto:support@acry.ai" className="text-primary hover:underline">support@acry.ai</a>.</p>
    </Section>
  </StaticPageLayout>
);

export default PrivacyPolicyPage;
