import StaticPageLayout from "@/components/landing/StaticPageLayout";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-xl font-display font-semibold text-foreground mb-3">{title}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </section>
);

const RefundPolicyPage = () => (
  <StaticPageLayout
    title="Refund Policy"
    subtitle="Our commitment to fair billing and refunds."
    lastUpdated="February 17, 2026"
  >
    <Section title="1. Free Trial">
      <p>The Pro Brain plan offers a 15-day free trial. During the trial period, you will not be charged. If you do not subscribe before the trial expires, your access will be restricted until a paid subscription is activated. No charges are made during the trial.</p>
    </Section>

    <Section title="2. Subscription Refunds">
      <p>Due to the digital nature of our services, refunds are handled as follows:</p>
      <ul className="list-disc list-inside space-y-1">
        <li><strong>Within 7 days of purchase:</strong> Full refund available if you are not satisfied with the Service</li>
        <li><strong>After 7 days:</strong> Refunds are generally not available, but we review cases on an individual basis</li>
        <li><strong>Yearly subscriptions:</strong> Pro-rated refund may be available within 30 days of purchase</li>
      </ul>
    </Section>

    <Section title="3. How to Request a Refund">
      <p>To request a refund:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Email us at <a href="mailto:support@acry.ai" className="text-primary hover:underline">support@acry.ai</a> with your account email and reason</li>
        <li>Or use the <a href="/contact" className="text-primary hover:underline">Contact Us</a> form</li>
      </ul>
      <p>We aim to process all refund requests within 5–7 business days.</p>
    </Section>

    <Section title="4. Refund Processing">
      <p>Approved refunds will be credited back to your original payment method via Razorpay. Processing time may vary depending on your bank or payment provider (typically 5–10 business days).</p>
    </Section>

    <Section title="5. Cancellation">
      <p>You can cancel your subscription at any time from your account settings. After cancellation, you will retain access until the end of your current billing period. No further charges will be made after cancellation.</p>
    </Section>

    <Section title="6. Exceptions">
      <p>Refunds will not be provided in cases of:</p>
      <ul className="list-disc list-inside space-y-1">
        <li>Account suspension due to Terms of Service violations</li>
        <li>Partial months or unused portions of monthly subscriptions beyond 7 days</li>
        <li>Promotional or discounted subscriptions, unless otherwise stated</li>
      </ul>
    </Section>

    <Section title="7. Contact">
      <p>For refund inquiries, contact us at <a href="mailto:support@acry.ai" className="text-primary hover:underline">support@acry.ai</a>.</p>
    </Section>
  </StaticPageLayout>
);

export default RefundPolicyPage;
