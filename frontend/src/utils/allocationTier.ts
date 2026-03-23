/**
 * Returns a Tailwind CSS class pair (text + background) for an allocation
 * utilisation rate (0.0–1.0+).
 *
 * Thresholds mirror the Dashboard's SquadTeamTab bar-colour scale:
 *   ≤ 70%  → green  (healthy)
 *   ≤ 90%  → yellow (moderate)
 *   ≤ 100% → orange (high)
 *   > 100% → red    (overloaded)
 */
export function allocationTierClass(utilization: number): string {
  if (utilization > 1.0) return 'text-red-600 bg-red-50';
  if (utilization > 0.9) return 'text-orange-600 bg-orange-50';
  if (utilization > 0.7) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
}
