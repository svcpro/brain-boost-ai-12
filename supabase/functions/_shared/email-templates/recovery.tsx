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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your ACRY password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <table role="presentation" width="100%"><tr><td align="center">
            <div style={logoMark}>A</div>
          </td></tr><tr><td align="center">
            <p style={brandName}>ACRY</p>
            <p style={brandTagline}>AI SECOND BRAIN</p>
          </td></tr></table>
        </Section>
        <Hr style={divider} />
        <Heading style={h1}>Reset your password 🔑</Heading>
        <Text style={text}>
          We got a request to reset your ACRY password. Tap below to choose a new one — this link expires in 1 hour.
        </Text>
        <Section style={ctaSection}>
          <Button style={button} href={confirmationUrl}>
            Reset Password →
          </Button>
        </Section>
        <Text style={footer}>
          Didn't request this? No worries — your password won't change unless you click the button above.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '480px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '8px' }
const logoMark: React.CSSProperties = {
  display: 'inline-block',
  width: '48px',
  height: '48px',
  lineHeight: '48px',
  borderRadius: '14px',
  fontSize: '24px',
  fontWeight: 900,
  color: '#ffffff',
  background: 'linear-gradient(135deg, #00BCD4, #7C4DFF)',
  textAlign: 'center',
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
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0' }
