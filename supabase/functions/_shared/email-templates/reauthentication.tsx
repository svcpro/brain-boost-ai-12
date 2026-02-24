/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your ACRY verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <table role="presentation" width="100%"><tr><td align="center">
            <div style={logoMark} dangerouslySetInnerHTML={{ __html: ACRY_LOGO_SVG }} />
          </td></tr><tr><td align="center">
            <p style={brandName}>ACRY</p>
            <p style={brandTagline}>AI SECOND BRAIN</p>
          </td></tr></table>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Verification code 🔐</Heading>
        <Text style={text}>
          Use the code below to confirm your identity:
        </Text>
        <Section style={codeSection}>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Text style={footer}>
          This code expires shortly. If you didn't request it, no action needed.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '8px' }
const ACRY_LOGO_SVG = `<svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="aGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00BCD4"/><stop offset="60%" stop-color="#7C4DFF"/><stop offset="100%" stop-color="#00BCD4"/></linearGradient></defs><circle cx="24" cy="24" r="22" stroke="url(#aGrad)" stroke-width="1.2" fill="none" opacity="0.4"/><path d="M24 8L38 38H10L24 8Z" stroke="url(#aGrad)" stroke-width="1.8" fill="none" stroke-linejoin="round"/><line x1="15" y1="30" x2="33" y2="30" stroke="url(#aGrad)" stroke-width="1.5" opacity="0.8"/><circle cx="24" cy="8" r="2" fill="#00BCD4"/><circle cx="10" cy="38" r="1.5" fill="#7C4DFF"/><circle cx="38" cy="38" r="1.5" fill="#7C4DFF"/><circle cx="24" cy="30" r="1.2" fill="#00E676"/></svg>`
const logoMark: React.CSSProperties = {
  display: 'inline-block',
  width: '56px',
  height: '56px',
  borderRadius: '16px',
  background: 'linear-gradient(135deg, #0B0F1A, #141832)',
  border: '1px solid rgba(0, 188, 212, 0.3)',
  padding: '12px',
  lineHeight: '0',
}
const brandName: React.CSSProperties = { fontSize: '20px', fontWeight: 800, color: '#1a1a2e', margin: '8px 0 0', letterSpacing: '-0.5px', textAlign: 'center' }
const brandTagline: React.CSSProperties = { fontSize: '9px', color: '#00BCD4', letterSpacing: '3px', margin: '2px 0 0', textAlign: 'center', fontWeight: 600 }
const divider = { borderColor: '#e5e7eb', margin: '20px 0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a2e', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#555570', lineHeight: '1.6', margin: '0 0 24px' }
const codeSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const codeStyle = {
  display: 'inline-block' as const,
  fontFamily: "'SF Mono', 'Fira Code', Courier, monospace",
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#1a1a2e',
  letterSpacing: '6px',
  padding: '16px 28px',
  borderRadius: '12px',
  background: '#f0fdfa',
  border: '1px solid #00BCD430',
  margin: '0',
}
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
