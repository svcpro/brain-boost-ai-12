/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link,
  Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ACRY AI'
const SITE_URL = 'https://www.acry.ai'

interface Props {
  name?: string
  college?: string
  city?: string
}

const CampusAmbassadorConfirmation = ({ name, college, city }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Application received — Welcome to the ACRY Campus Ambassador movement</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Brand mark */}
        <Section style={logoSection}>
          <table role="presentation" width="100%"><tbody><tr><td align="center">
            <div style={logoMark} dangerouslySetInnerHTML={{ __html: ACRY_LOGO_SVG }} />
          </td></tr><tr><td align="center">
            <p style={brandName}>ACRY</p>
            <p style={brandTagline}>CAMPUS AMBASSADOR · BATCH 2026</p>
          </td></tr></tbody></table>
        </Section>

        <Hr style={divider} />

        <Heading style={h1}>
          {name ? `You're in the queue, ${name} 🚀` : `You're in the queue 🚀`}
        </Heading>

        <Text style={text}>
          We've received your application for the <strong>ACRY Campus Ambassador Program</strong>
          {college ? <> from <strong>{college}</strong></> : null}
          {city ? <> · {city}</> : null}.
        </Text>

        <Section style={cardSection}>
          <Text style={cardTitle}>What happens next</Text>
          <Text style={cardItem}>
            <span style={dot}>1</span> Our team personally reviews every application within <strong>48 hours</strong>.
          </Text>
          <Text style={cardItem}>
            <span style={dot}>2</span> Selected candidates get a <strong>WhatsApp + email invite</strong> to the onboarding call.
          </Text>
          <Text style={cardItem}>
            <span style={dot}>3</span> You'll be enrolled into the <strong>AI Leadership Training</strong> and assigned a founder mentor.
          </Text>
        </Section>

        <Section style={ctaSection}>
          <Button href={SITE_URL} style={button}>
            Explore ACRY
          </Button>
        </Section>

        <Text style={subtle}>
          While you wait, follow us and start sharing what you're building.
          Top early movers stand out in our review. Reply to this email if you have any questions —
          we read every reply.
        </Text>

        <Hr style={divider} />

        <Text style={footer}>
          Sent with care by the {SITE_NAME} team · <Link href={SITE_URL} style={link}>{SITE_URL.replace('https://', '')}</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CampusAmbassadorConfirmation,
  subject: (d: Record<string, any>) =>
    d?.name
      ? `${d.name}, your ACRY Campus Ambassador application is in ✅`
      : `Your ACRY Campus Ambassador application is in ✅`,
  displayName: 'Campus Ambassador — Application Received',
  previewData: { name: 'Aarav', college: 'IIT Delhi', city: 'New Delhi' },
} satisfies TemplateEntry

/* ─── Styles (match ACRY brand) ─────────────────────────────── */
const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '520px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '8px' }
const ACRY_LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="aGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00BCD4"/><stop offset="60%" stop-color="#7C4DFF"/><stop offset="100%" stop-color="#00BCD4"/></linearGradient></defs><circle cx="24" cy="24" r="22" stroke="url(#aGrad)" stroke-width="1.2" fill="none" opacity="0.4"/><path d="M24 8L38 38H10L24 8Z" stroke="url(#aGrad)" stroke-width="1.8" fill="none" stroke-linejoin="round"/><line x1="15" y1="30" x2="33" y2="30" stroke="url(#aGrad)" stroke-width="1.5" opacity="0.8"/><circle cx="24" cy="8" r="2" fill="#00BCD4"/><circle cx="10" cy="38" r="1.5" fill="#7C4DFF"/><circle cx="38" cy="38" r="1.5" fill="#7C4DFF"/><circle cx="24" cy="30" r="1.2" fill="#00E676"/></svg>`
const logoMark: React.CSSProperties = {
  display: 'inline-block', width: '56px', height: '56px', borderRadius: '16px',
  background: 'linear-gradient(135deg, #0B0F1A, #141832)',
  border: '1px solid rgba(0, 188, 212, 0.3)', padding: '12px', lineHeight: '0',
}
const brandName: React.CSSProperties = { fontSize: '20px', fontWeight: 800, color: '#1a1a2e', margin: '8px 0 0', letterSpacing: '-0.5px', textAlign: 'center' }
const brandTagline: React.CSSProperties = { fontSize: '9px', color: '#7C4DFF', letterSpacing: '3px', margin: '2px 0 0', textAlign: 'center', fontWeight: 700 }
const divider = { borderColor: '#e5e7eb', margin: '20px 0' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#555570', lineHeight: '1.6', margin: '0 0 20px' }
const cardSection: React.CSSProperties = {
  background: 'linear-gradient(135deg, #f7f9ff, #f0f4ff)',
  border: '1px solid #e5e9f5', borderRadius: '14px', padding: '18px 20px', margin: '0 0 24px',
}
const cardTitle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#7C4DFF', letterSpacing: '2px', textTransform: 'uppercase', margin: '0 0 12px' }
const cardItem: React.CSSProperties = { fontSize: '14px', color: '#1a1a2e', lineHeight: '1.6', margin: '0 0 10px' }
const dot: React.CSSProperties = {
  display: 'inline-block', width: '22px', height: '22px', lineHeight: '22px', textAlign: 'center',
  background: 'linear-gradient(135deg, #00BCD4, #7C4DFF)', color: '#fff', borderRadius: '50%',
  fontSize: '11px', fontWeight: 800, marginRight: '10px',
}
const ctaSection = { textAlign: 'center' as const, margin: '8px 0 20px' }
const button = {
  background: 'linear-gradient(135deg, #00BCD4, #7C4DFF)', color: '#ffffff',
  fontSize: '14px', fontWeight: '700' as const, borderRadius: '12px',
  padding: '14px 32px', textDecoration: 'none',
}
const subtle = { fontSize: '13px', color: '#7a7a8c', lineHeight: '1.6', margin: '0 0 8px' }
const link = { color: '#00BCD4', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '12px 0 0', textAlign: 'center' as const }
