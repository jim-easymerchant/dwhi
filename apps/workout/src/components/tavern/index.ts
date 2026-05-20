/**
 * Tavern components — composable home-base UI pieces.
 *
 * Each component is theme-agnostic and pure presentational. The
 * HomeScreen composes them in a single layout; theme packs feed
 * the copy + tint via `getTheme(themeId)`.
 *
 * See: docs/workout-rpg/019-tavern-home-layout.md
 */

export { TavernHeader } from './TavernHeader';
export type { TavernHeaderProps } from './TavernHeader';

export { TavernSceneFrame } from './TavernSceneFrame';
export type { TavernSceneFrameProps } from './TavernSceneFrame';

export { TavernStatusRow } from './TavernStatusRow';
export type { TavernStatusRowProps } from './TavernStatusRow';

export { AmbientPanel } from './AmbientPanel';
export type { AmbientPanelProps } from './AmbientPanel';

export { PatronsPanel } from './PatronsPanel';
export type { PatronsPanelProps } from './PatronsPanel';

export { QuestCard } from './QuestCard';
export type { QuestCardProps } from './QuestCard';

export { QuestSelectionPanel } from './QuestSelectionPanel';
export type { QuestSelectionPanelProps } from './QuestSelectionPanel';

export { EchoLogPanel } from './EchoLogPanel';
export type { EchoLogPanelProps } from './EchoLogPanel';

export { TavernFooterActions } from './TavernFooterActions';
export type { TavernFooterActionsProps } from './TavernFooterActions';
