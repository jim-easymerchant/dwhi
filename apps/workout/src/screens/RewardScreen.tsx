/**
 * Reward — the exit beat.
 *
 * Tone target (012 §10): longer than the entry beat. No "Next
 * Quest" CTA — only "Return to Camp." One verdict surfaces as the
 * primary banner; others are listed below in muted style.
 *
 * The result rendered here comes from the pure `runQuest()`
 * orchestrator in @dwhi/workout-domain. We render its data; we do
 * not compute anything ourselves.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWorkoutGameStore } from '../state/workoutGameStore';
import { workoutColors, workoutRadii, workoutSpacing, workoutType } from '../theme/workoutColors';

export function RewardScreen(): JSX.Element {
  const result = useWorkoutGameStore((s) => s.result);
  const returnToCamp = useWorkoutGameStore((s) => s.returnToCamp);

  if (!result) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={workoutType.body}>The Hollow has gone quiet.</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.returnButton}
            onPress={returnToCamp}
          >
            <Text style={styles.returnButtonText}>Return to Camp</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const { verdicts, rewards, momentum, enemyResult, totalDamage } = result;
  const primaryVerdict = verdicts[0] ?? 'Steady';
  const otherVerdicts = verdicts.slice(1);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>The Hollow has felt the work.</Text>

        <View style={styles.verdictBlock}>
          <Text style={styles.verdict}>{primaryVerdict}</Text>
          {otherVerdicts.length > 0 && (
            <Text style={styles.alsoVerdicts}>{otherVerdicts.join('  ·  ')}</Text>
          )}
        </View>

        <View style={styles.statsBlock}>
          <Stat label="XP" value={`${rewards.xp}`} />
          <Stat
            label="Ember"
            value={`+${momentum.gainBreakdown.applied}`}
            sublabel={`${Math.round(momentum.before)} → ${Math.round(momentum.final)} · ${momentum.tierAfter}`}
          />
          {enemyResult && (
            <Stat
              label={enemyResult.name}
              value={enemyResult.defeated ? 'thinned' : 'lingered'}
              sublabel={`${Math.round(totalDamage)} dmg dealt`}
            />
          )}
        </View>

        <Text style={styles.flavor}>
          {enemyResult?.defeated
            ? 'The room felt taller. Air moved.'
            : 'The room was warmer than it had been.'}
        </Text>

        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
          onPress={returnToCamp}
        >
          <Text style={styles.returnButtonText}>Return to Camp</Text>
        </Pressable>

        <Text style={styles.kettle}>Tomorrow is the next page.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}): JSX.Element {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueBlock}>
        <Text style={styles.statValue}>{value}</Text>
        {sublabel && <Text style={styles.statSublabel}>{sublabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: workoutColors.background },
  scroll: {
    padding: workoutSpacing.lg,
    gap: workoutSpacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    padding: workoutSpacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: workoutSpacing.lg,
  },
  title: {
    ...workoutType.heading,
    textAlign: 'center',
    color: workoutColors.textPrimary,
  },
  verdictBlock: {
    alignItems: 'center',
    gap: workoutSpacing.xs,
    marginVertical: workoutSpacing.md,
  },
  verdict: {
    ...workoutType.verdict,
    textAlign: 'center',
  },
  alsoVerdicts: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    textAlign: 'center',
  },
  statsBlock: {
    backgroundColor: workoutColors.surface,
    borderRadius: workoutRadii.lg,
    padding: workoutSpacing.lg,
    gap: workoutSpacing.md,
    borderWidth: 1,
    borderColor: workoutColors.border,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    ...workoutType.label,
  },
  statValueBlock: { alignItems: 'flex-end' },
  statValue: {
    ...workoutType.heading,
    color: workoutColors.ember,
  },
  statSublabel: {
    ...workoutType.caption,
  },
  flavor: {
    ...workoutType.body,
    textAlign: 'center',
    color: workoutColors.textSecondary,
    fontStyle: 'italic',
    marginVertical: workoutSpacing.md,
  },
  returnButton: {
    backgroundColor: workoutColors.surfaceElevated,
    borderRadius: workoutRadii.md,
    paddingVertical: workoutSpacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: workoutColors.border,
  },
  returnButtonText: {
    ...workoutType.body,
    color: workoutColors.textPrimary,
  },
  kettle: {
    ...workoutType.caption,
    textAlign: 'center',
    marginTop: workoutSpacing.lg,
    color: workoutColors.textMuted,
  },
  pressed: { opacity: 0.85 },
});
