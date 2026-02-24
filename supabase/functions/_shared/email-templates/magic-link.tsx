/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your ACRY login code: {token || '------'}</Preview>
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
        <Heading style={h1}>Your Login Code ⚡</Heading>
        <Text style={text}>
          Use this 8-digit code to sign in to ACRY. It expires shortly, so enter it now.
        </Text>
        <Section style={ctaSection}>
          <div style={otpContainer}>
            {(token || '--------').split('').map((digit, i) => (
              <span key={i} style={otpDigit}>{digit}</span>
            ))}
          </div>
        </Section>
        <Text style={{...text, fontSize: '12px', color: '#999999', textAlign: 'center' as const}}>
          Or tap the button below to sign in directly:
        </Text>
        <Section style={ctaSection}>
          <Button style={{...button, padding: '10px 24px', fontSize: '13px'}} href={confirmationUrl}>
            Sign In →
          </Button>
        </Section>
        <Text style={footer}>
          Didn't request this? Just ignore this email — your account is safe.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
const ctaSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const button = {
  background: 'linear-gradient(135deg, #00BCD4, #7C4DFF)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '700' as const,
  borderRadius: '12px',
  padding: '14px 32px',
  textDecoration: 'none',
}
const otpContainer: React.CSSProperties = {
  display: 'inline-block',
  padding: '16px 20px',
  background: 'linear-gradient(135deg, #0B0F1A, #141832)',
  borderRadius: '16px',
  border: '1px solid rgba(0, 188, 212, 0.3)',
}
const otpDigit: React.CSSProperties = {
  display: 'inline-block',
  width: '36px',
  height: '44px',
  lineHeight: '44px',
  textAlign: 'center',
  fontSize: '24px',
  fontWeight: 800,
  color: '#00BCD4',
  background: 'rgba(255,255,255,0.06)',
  borderRadius: '8px',
  margin: '0 3px',
  fontFamily: "'Inter', 'SF Mono', 'Roboto Mono', monospace",
  letterSpacing: '0',
}
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
