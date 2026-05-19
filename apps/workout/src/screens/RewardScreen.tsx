/**
 * Reward — the exit beat.
 *
 * Tone target (012 §10): longer than the entry beat. No "Next
 * Quest" CTA — only "Return to Camp." One verdict surfaces as the
 * primary banner; others are listed below in muted style.
 *
 * The verdict / XP / Momentum data comes from the pure `runQuest()`
 * orchestrator. The defeated-enemies list comes from the shell's
 * own multi-phase tracking (the orchestrator only sees the primary
 * enemy — see docs/workout-rpg/014-open-ended-encounters-and-set-memory.md
 * §11).
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getTotalDamageAcrossPhases,
  useWorkoutGameStore,
} from '../state/workoutGameStore';
import { workoutColors, workoutRadii, workoutSpacing, workoutType } from '../theme/workoutColors';

export function RewardScreen(): JSX.Element {
  const result = useWorkoutGameStore((s) => s.result);
  const defeatedEnemies = useWorkoutGameStore((s) => s.defeatedEnemies);
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

  const { verdicts, rewards, momentum, enemyResult } = result;
  const primaryVerdict = verdicts[0] ?? 'Steady';
  const otherVerdicts = verdicts.slice(1);

  // Total damage across every phase — shell-side, because the
  // orchestrator's enemyResult only sees the primary Sluggard.
  const totalDamageAcrossPhases = getTotalDamageAcrossPhases(
    useWorkoutGameStore.getState(),
  );

  const defeatedCount = defeatedEnemies.length;
  const headlineCopy =
    defeatedCount >= 2
      ? `${defeatedCount} fragments thinned.`
      : defeatedCount === 1
      ? 'The Sluggard receded.'
      : 'The Hollow has felt the work.';

  const flavorCopy = (() => {
    if (defeatedCount >= 2) return 'The room is quieter than it has been.';
    if (defeatedCount === 1) return 'The room felt taller. Air moved.';
    if (enemyResult && !enemyResult.defeated) {
      return 'The room was warmer than it had been.';
    }
    return 'The Ember settled.';
  })();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{headlineCopy}</Text>

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
            sublabel={`${Math.round(momentum.before)} → ${Math.round(
              momentum.final,
            )} · ${momentum.tierAfter}`}
          />
          <Stat
            label="Damage"
            value={`${Math.round(totalDamageAcrossPhases)}`}
            sublabel={
              defeatedCount > 0
                ? `across ${defeatedCount} ${defeatedCount === 1 ? 'phase' : 'phases'}`
                : 'this encounter'
            }
          />
        </View>

        {/* Multi-enemy list — only when at least one phase was defeated. */}
        {defeatedCount > 0 && (
          <View style={styles.enemyList}>
            <Text style={styles.enemyListLabel}>THINNED</Text>
            {defeatedEnemies.map((e) => (
              <Text key={`${e.id}-${e.phaseIndex}`} style={styles.enemyListRow}>
                · {e.name}
                <Text style={styles.enemyListSub}>
                  {`  ${Math.round(e.damageDealtToThisPhase)} dmg`}
                </Text>
              </Text>
            ))}
            {enemyResult && !enemyResult.defeated && (
              <Text style={styles.enemyListMuted}>
                {`${enemyResult.name} still lingers.`}
              </Text>
            )}
          </View>
        )}

        {defeatedCount === 0 && enemyResult && !enemyResult.defeated && (
          <Text style={styles.enemyListMuted}>
            {`${enemyResult.name} still lingers.`}
          </Text>
        )}

        <Text style={styles.flavor}>{flavorCopy}</Text>

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
  statLabel: { ...workoutType.label },
  statValueBlock: { alignItems: 'flex-end' },
  statValue: {
    ...workoutType.heading,
    color: workoutColors.ember,
  },
  statSublabel: { ...workoutType.caption },
  enemyList: {
    gap: workoutSpacing.xs,
    paddingHorizontal: workoutSpacing.sm,
  },
  enemyListLabel: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    letterSpacing: 2,
  },
  enemyListRow: {
    ...workoutType.body,
    color: workoutColors.textSecondary,
  },
  enemyListSub: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
  },
  enemyListMuted: {
    ...workoutType.caption,
    color: workoutColors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
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
