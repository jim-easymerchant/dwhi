import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Card } from '@/components/Card';
import { BigButton } from '@/components/BigButton';
import { TextField } from '@/components/TextField';
import { getActiveContextOrNull } from '@/services/householdContext';
import { switchActiveHouseholdToRemote } from '@/services/householdSwitch';
import { getCurrentSession } from '@/services/auth/authService';
import {
  createInvite,
  findInviteByCode,
  acceptInvite,
  type RemoteInvite,
} from '@/services/remote/householdInvitesRemoteRepository';
import {
  listMembersForHousehold,
  removeMember,
  type RemoteMember,
} from '@/services/remote/householdMembersRemoteRepository';
import { colors, spacing, typography } from '@/theme/colors';

export default function HouseholdScreen() {
  const router = useRouter();
  const ctx = getActiveContextOrNull();
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [members, setMembers] = useState<RemoteMember[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [newInvite, setNewInvite] = useState<RemoteInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const session = await getCurrentSession();
      setSignedIn(!!session);
      setEmail(session?.user?.email ?? null);
      const remoteHouseholdId = ctx?.household.remoteId ?? null;
      if (session && remoteHouseholdId) {
        const res = await listMembersForHousehold(remoteHouseholdId);
        setMembers(res.ok ? res.data ?? [] : []);
        if (!res.ok) setError(res.message);
      } else {
        setMembers([]);
      }
    } finally {
      setLoading(false);
    }
  }, [ctx?.household.remoteId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentMember = members.find(m => m.isMe);
  const isOwner = currentMember?.role === 'owner';

  const handleCreateInvite = async () => {
    if (!ctx?.household.remoteId) {
      setError(
        'This household has no remote counterpart yet. Re-create it or sync to provision one.',
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const r = await createInvite({
        remoteHouseholdId: ctx.household.remoteId,
        remoteCreatorMemberId: currentMember?.id ?? null,
      });
      if (r.ok && r.data) {
        setInviteCode(r.data.inviteCode);
        setNewInvite(r.data);
        setMessage('Invite created. Share the code with another member.');
      } else {
        setError(r.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const found = await findInviteByCode(joinCode);
      if (!found.ok) {
        setError(found.message);
        return;
      }
      if (!found.data) {
        setError('No invite matches that code.');
        return;
      }
      const accepted = await acceptInvite(found.data, email ?? 'Member');
      if (!accepted.ok || !accepted.data) {
        setError(accepted.message);
        return;
      }
      const session = await getCurrentSession();
      if (!session?.user?.id) {
        setError('Sign in expired; sign in again and retry.');
        return;
      }
      await switchActiveHouseholdToRemote({
        remoteHouseholdId: accepted.data.invite.householdId,
        memberDisplayName: email ?? 'Member',
        remoteUserId: session.user.id,
        remoteMemberId: accepted.data.newMemberId,
      });
      setMessage('Joined and switched to the new household.');
      setJoinCode('');
      // Bounce back to Settings so the diagnostics card reflects the
      // newly-active household.
      setTimeout(() => router.replace('/settings'), 600);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (target: RemoteMember) => {
    if (!isOwner) return;
    Alert.alert(
      'Remove member?',
      `Remove ${target.displayName} from ${ctx?.household.name}? They will lose access on next sync.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const r = await removeMember(target, members);
              if (r.ok) {
                setMessage(r.message);
                await refresh();
              } else {
                setError(r.message);
              }
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Manage household</Text>

          <Card>
            <Row label="Household" value={ctx?.household.name ?? '—'} />
            <Row
              label="Linked remotely"
              value={ctx?.household.remoteId ? 'Yes' : 'No'}
              tone={ctx?.household.remoteId ? 'good' : 'muted'}
            />
            <Row label="This device" value={ctx?.device.deviceName ?? '—'} />
          </Card>

          {!signedIn ? (
            <Card style={styles.signinCard}>
              <Text style={styles.body}>
                Sign in to invite people, join an existing household, or remove
                members.
              </Text>
              <BigButton
                label="Sign in"
                variant="primary"
                onPress={() => router.push('/auth')}
              />
            </Card>
          ) : (
            <>
              <Card>
                <Text style={styles.cardHeading}>Members</Text>
                {loading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : members.length === 0 ? (
                  <Text style={styles.body}>
                    {ctx?.household.remoteId
                      ? 'No remote members yet.'
                      : 'This household lives locally only — no remote members exist.'}
                  </Text>
                ) : (
                  members.map(m => (
                    <View key={m.id} style={styles.memberRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>
                          {m.displayName} {m.isMe ? '(you)' : ''}
                        </Text>
                        <Text style={styles.memberMeta}>{m.role}</Text>
                      </View>
                      {isOwner && !m.isMe && m.role !== 'owner' ? (
                        <BigButton
                          label="Remove"
                          variant="ghost"
                          onPress={() => handleRemove(m)}
                          disabled={busy}
                        />
                      ) : null}
                    </View>
                  ))
                )}
              </Card>

              {isOwner ? (
                <Card>
                  <Text style={styles.cardHeading}>Create invite</Text>
                  <Text style={styles.body}>
                    Generate a one-time code another signed-in user can paste
                    into Join household.
                  </Text>
                  <BigButton
                    label={busy && !newInvite ? 'Creating…' : 'Create invite'}
                    variant="primary"
                    onPress={handleCreateInvite}
                    disabled={busy || !ctx?.household.remoteId}
                  />
                  {newInvite ? (
                    <View style={styles.codeBox}>
                      <Text style={styles.codeBoxLabel}>Invite code</Text>
                      <Text style={styles.codeBoxCode}>{inviteCode}</Text>
                    </View>
                  ) : null}
                </Card>
              ) : null}

              <Card>
                <Text style={styles.cardHeading}>Join household</Text>
                <Text style={styles.body}>
                  Paste an invite code from another household's owner.
                </Text>
                <TextField
                  label="Invite code"
                  value={joinCode}
                  onChangeText={setJoinCode}
                  autoCapitalize="characters"
                  placeholder="ABC123DEF456"
                />
                <BigButton
                  label={busy ? 'Joining…' : 'Join household'}
                  variant="positive"
                  onPress={handleJoin}
                  disabled={busy || !joinCode.trim()}
                />
              </Card>
            </>
          )}

          {message ? <Text style={styles.success}>{message}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        <BigButton
          label="Close"
          variant="ghost"
          onPress={() => router.back()}
          style={styles.close}
        />
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'good' | 'warn' | 'muted';
}) {
  const tint =
    tone === 'good'
      ? colors.positive
      : tone === 'warn'
        ? colors.warn
        : tone === 'muted'
          ? colors.textMuted
          : colors.textPrimary;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color: tint }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingVertical: spacing.lg },
  heading: { ...typography.heading, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  cardHeading: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  signinCard: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: { ...typography.label, color: colors.textSecondary },
  rowValue: { ...typography.body, fontWeight: '600' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  memberName: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  memberMeta: { ...typography.caption, color: colors.textMuted },
  codeBox: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  codeBoxLabel: { ...typography.caption, color: colors.textMuted },
  codeBoxCode: {
    ...typography.heading,
    color: colors.textPrimary,
    fontFamily: 'Courier',
    letterSpacing: 2,
  },
  success: { ...typography.caption, color: colors.positive },
  error: { ...typography.caption, color: colors.danger },
  close: { marginBottom: spacing.md },
});
