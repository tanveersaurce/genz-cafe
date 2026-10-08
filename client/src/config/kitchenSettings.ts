/**
 * Kitchen Display System (KDS) Configuration
 * Single source of truth for age thresholds and touch interaction timers.
 */

export const kitchenSettings = {
  // Age warning threshold in minutes (DUMMY: confirm with chefs)
  warningThresholdMinutes: 10,

  // Age urgent threshold in minutes (DUMMY: confirm with chefs)
  urgentThresholdMinutes: 15,

  // Duration in seconds that an Undo/Bump-back action is available after a status change
  undoWindowSeconds: 30,
} as const;
