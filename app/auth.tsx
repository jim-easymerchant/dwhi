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
  requestEmailOtp,
  verifyEmailOtp,
} from '@/services/auth/authService';
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
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await verifyEmailOtp(email, code);
      if (r.ok) {
        setMessage(r.message);
        setPhase('done');
        // Bounce back to Settings after the success briefly settles.
        setTimeout(() => router.replace('/settings'), 700);
      } else {
        setError(r.message);
      }
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
            6-digit code by email — no password, no link to click.
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
                <Text style={styles.bodyEmphasis}>type the 6-digit code below</Text>
                . Don't tap the link — it's only useful in a browser, not on this device.
              </Text>
              <TextField
                label="6-digit code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
              />
              <BigButton
                label={busy ? 'Verifying…' : 'Verify'}
                onPress={verifyCode}
                disabled={busy || code.trim().length < 4}
              />
              <BigButton
                label="Use a different email"
                variant="ghost"
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
  close: { marginBottom: spacing.md },
});
