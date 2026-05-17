/**
 * @dwhi/domain
 *
 * Pantry-specific surface for the Do We Have It? app. Items, inventory
 * events, receipts, confidence scoring, behaviour stats, voice intent
 * parsing, and the recent-activity feed live here.
 *
 * A second app in this monorepo (workout/RPG) will get its own domain
 * package; they will share @dwhi/framework and @dwhi/ui but NOT this
 * package.
 */
export * from './ask';
export * from './behavior';
export * from './confidence';
export * from './inventory';
export * from './items';
export * from './receipts';
export * from './recent-activity';
export * from './types';
export * from './voice';
