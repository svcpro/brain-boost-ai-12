/**
 * Centralized helpers to detect & hide system-generated placeholder emails.
 *
 * Mobile-OTP (MSG91) signups create users with synthetic emails like
 * `919876543210@phone.acry.ai`. These must NEVER be shown to users — only
 * real emails the user has typed and verified themselves.
 */

const PLACEHOLDER_DOMAINS = [
  /@phone\.acry\.ai$/i,
  /@mobile\.acry\.ai$/i,
  /@otp\.acry\.ai$/i,
];

export const isPlaceholderEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return PLACEHOLDER_DOMAINS.some((re) => re.test(email));
};

/** Returns the email only if it's a real user-provided one; otherwise "". */
export const getRealEmail = (email?: string | null): string => {
  if (!email || isPlaceholderEmail(email)) return "";
  return email;
};

/** Returns email-derived username only if email is real; otherwise "". */
export const getEmailUsername = (email?: string | null): string => {
  const real = getRealEmail(email);
  return real ? real.split("@")[0] : "";
};
