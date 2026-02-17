import StaticPageLayout from "@/components/landing/StaticPageLayout";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-xl font-display font-semibold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const CookiePolicyPage = () => (
  <StaticPageLayout
    title="Cookie Policy"
    subtitle="How ACRY uses cookies and similar technologies."
    lastUpdated="February 17, 2026"
  >
    <Section title="1. What Are Cookies?">
      <p>Cookies are small text files stored on your device when you visit a website. They help the website remember your preferences and improve your experience.</p>
    </Section>

    <Section title="2. Cookies We Use">
      <p>ACRY uses the following types of cookies:</p>
      <ul className="list-disc list-inside space-y-2">
        <li><strong>Essential Cookies:</strong> Required for authentication, session management, and core functionality. These cannot be disabled.</li>
        <li><strong>Performance Cookies:</strong> Help us understand how you use ACRY so we can improve the platform. These collect anonymous usage data.</li>
        <li><strong>Functional Cookies:</strong> Remember your preferences like theme settings, notification preferences, and language.</li>
      </ul>
    </Section>

    <Section title="3. Third-Party Cookies">
      <p>We may use third-party services that set their own cookies:</p>
      <ul className="list-disc list-inside space-y-1">
        <li><strong>Razorpay:</strong> For secure payment processing</li>
        <li><strong>Analytics:</strong> To understand platform usage in aggregate</li>
      </ul>
    </Section>

    <Section title="4. Managing Cookies">
      <p>You can control cookies through your browser settings. Note that disabling essential cookies may prevent you from using ACRY. Most browsers allow you to:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>View and delete existing cookies</li>
        <li>Block all or certain cookies</li>
        <li>Set preferences for specific websites</li>
      </ul>
    </Section>

    <Section title="5. Local Storage">
      <p>In addition to cookies, ACRY uses browser local storage for offline functionality, caching study data, and improving load times. This data remains on your device and is not transmitted to our servers unless required for sync.</p>
    </Section>

    <Section title="6. Updates">
      <p>We may update this Cookie Policy as our technology evolves. Changes will be reflected on this page with an updated date.</p>
    </Section>

    <Section title="7. Contact">
      <p>For questions about our cookie practices, contact <a href="mailto:support@acry.ai" className="text-primary hover:underline">support@acry.ai</a>.</p>
    </Section>
  </StaticPageLayout>
);

export default CookiePolicyPage;
