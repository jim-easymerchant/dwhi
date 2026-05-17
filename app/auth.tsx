import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { TextField } from '@/components/TextField';
import { BigButton } from '@/components/BigButton';
import { Card } from '@/components/Card';
import {
  getCurrentSession,
  isOtpCodeLengthValid,
  normalizeOtpCode,
  OTP_CODE_MAX_LENGTH,
  requestEmailOtp,
  verifyEmailOtp,
} from '@/services/auth/authService';
import { ensureRemoteHousehold } from '@/services/household/remoteHouseholdBootstrap';
import { requestAutoSync } from '@/services/sync/autoSync';
import { isSupabaseConfigured } from '@/services/env';
import { colors, spacing, typography } from '@/theme/colors';

type Phase = 'email' | 'code' | 'done';

export default function AuthScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isSupabaseConfigured()) {
    return (
      <ScreenContainer>
        <View style={styles.empty}>
          <Text style={styles.heading}>Sign in unavailable</Text>
          <Text style={styles.body}>
            Cloud sync isn't configured on this build. Set
            EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to
            enable households + invites.
          </Text>
          <BigButton label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScreenContainer>
    );
  }

  const sendCode = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await requestEmailOtp(email);
      if (r.ok) {
        setMessage(r.message);
        setPhase('code');
      } else {
        setError(r.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (busy) return;
    // Local validation first so we never burn an OTP attempt on the
    // server for obviously-wrong input. Length is intentionally
    // flexible — Supabase projects can be configured for 6, 8, or
    // more digits, and truncating here is exactly how this broke
    // in production.
    const normalized = normalizeOtpCode(code);
    if (!isOtpCodeLengthValid(normalized)) {
      setMessage(null);
      setError('Enter the sign-in code from your email.');
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await verifyEmailOtp(email, normalized);
      if (!r.ok) {
        // Hard rule: on any failure we keep the modal open and surface
        // the error verbatim. Empty messages get a friendly fallback so
        // the UI never silently does nothing.
        setError(r.message && r.message.trim() ? r.message : 'Sign in failed. Please try again.');
        return;
      }
      // Belt + braces: even on ok, confirm a session exists before we
      // tell the user they're in. The service already does this, but a
      // second probe here means the UI never navigates without proof.
      const session = await getCurrentSession();
      if (!session) {
        setError(
          'Verified but no session is active. Please request a new code and try again.',
        );
        return;
      }
      // Now that we have a confirmed session, converge local + remote
      // household state. Brand-new users get a remote household
      // provisioned automatically; returning users get linked to their
      // existing one. Failures are surfaced verbatim so the user can
      // retry from Settings rather than landing on a broken "linked
      // remotely: no" screen with no explanation.
      const linked = await ensureRemoteHousehold({ expectAuthenticated: true });
      if (!linked.ok) {
        setError(
          linked.message ||
            'Signed in, but could not link a remote household. Try again from Settings.',
        );
        return;
      }
      // First sync run for the new session. Fire-and-forget; the user
      // doesn't wait on it — the Settings card will reflect status
      // once it completes.
      requestAutoSync('post-sign-in');
      setMessage(r.message);
      setPhase('done');
      router.replace('/settings');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Sign in</Text>
          <Text style={styles.body}>
            Sign in with email to create or join a household. We send a
            sign-in code by email — no password, no link to click.
          </Text>

          {phase === 'email' ? (
            <Card style={styles.card}>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                placeholder="you@example.com"
              />
              <BigButton
                label={busy ? 'Sending…' : 'Send code'}
                onPress={sendCode}
                disabled={busy || !email.trim()}
              />
            </Card>
          ) : null}

          {phase === 'code' ? (
            <Card style={styles.card}>
              <Text style={styles.body}>
                Code sent to {email}. Open the email and{' '}
                <Text style={styles.bodyEmphasis}>type the numeric code below</Text>
                . Don't tap the link — it's only useful in a browser, not on this device.
              </Text>
              {error ? (
                <Text style={styles.errorInline} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}
              <TextField
                label="Sign-in code"
                value={code}
                onChangeText={text => {
                  // Strip non-digits inline so the input never holds
                  // garbage that would later fail validation silently.
                  // We never truncate — the full digit run is preserved
                  // so 6-, 8-, or 10-digit project configs all work.
                  const cleaned = normalizeOtpCode(text);
                  setCode(cleaned);
                  if (error) setError(null);
                }}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="12345678"
                maxLength={OTP_CODE_MAX_LENGTH}
              />
              <BigButton
                label={busy ? 'Verifying…' : 'Verify'}
                onPress={verifyCode}
                disabled={busy || !isOtpCodeLengthValid(normalizeOtpCode(code))}
              />
              <BigButton
                label="Use a different email"
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  setPhase('email');
                  setCode('');
                  setMessage(null);
                  setError(null);
                }}
              />
            </Card>
          ) : null}

          {phase === 'done' ? (
            <Card style={styles.card}>
              <Text style={styles.body}>You're signed in. Returning to Settings…</Text>
              <ActivityIndicator color={colors.accent} />
            </Card>
          ) : null}

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <BigButton label="Close" variant="ghost" onPress={() => router.back()} style={styles.close} />
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  heading: { ...typography.heading, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  bodyEmphasis: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  card: { gap: spacing.sm },
  success: { ...typography.caption, color: colors.positive },
  error: { ...typography.caption, color: colors.danger },
  errorInline: {
    ...typography.body,
    color: colors.danger,
    fontWeight: '600',
  },
  close: { marginBottom: spacing.md },
});
