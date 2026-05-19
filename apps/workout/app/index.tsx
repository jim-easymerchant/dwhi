/**
 * Root route — phase-dispatching shell.
 *
 * The game store owns the current phase ('home' | 'battle' | 'rest'
 * | 'reward'). This component reads the phase and renders the
 * corresponding screen from `src/screens/`. Keeping all of MVP on
 * one route avoids deep-link rewiring before the flow is stable.
 */

import React from 'react';

import { BattleScreen } from '../src/screens/BattleScreen';
import { HomeScreen } from '../src/screens/HomeScreen';
import { RestScreen } from '../src/screens/RestScreen';
import { RewardScreen } from '../src/screens/RewardScreen';
import { useWorkoutGameStore } from '../src/state/workoutGameStore';

export default function Index(): JSX.Element {
  const phase = useWorkoutGameStore((s) => s.phase);

  switch (phase) {
    case 'home':
      return <HomeScreen />;
    case 'battle':
      return <BattleScreen />;
    case 'rest':
      return <RestScreen />;
    case 'reward':
      return <RewardScreen />;
  }
}
