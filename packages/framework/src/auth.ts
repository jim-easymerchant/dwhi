/**
 * Reusable email-OTP auth surface. Wraps Supabase's auth API with
 * length-flexible code normalization and a single converged-session
 * contract that any app in this monorepo can lean on without
 * reimplementing the tricky bits (signup-fallback, getSession
 * authoritative check, structured AuthResult).
 */
export {
  OTP_CODE_MAX_LENGTH,
  OTP_CODE_MIN_LENGTH,
  getCurrentEmail,
  getCurrentSession,
  isOtpCodeLengthValid,
  normalizeOtpCode,
  requestEmailOtp,
  signOut,
  verifyEmailOtp,
  type AuthResult,
} from '@/services/auth/authService';
