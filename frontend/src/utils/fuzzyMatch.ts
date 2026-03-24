/**
 * Fuzzy skill matching — Levenshtein distance for "Did you mean?" nudges (US-SP-22 AC#4).
 * No external dependencies; edit distance 2 is sufficient for short skill names.
 */

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  const prev = Array.from({ length: lb + 1 }, (_, i) => i);
  const curr = new Array<number>(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    for (let j = 0; j <= lb; j++) prev[j] = curr[j];
  }
  return prev[lb];
}

export interface FuzzyMatch {
  name: string;
  id: string;
  distance: number;
}

/**
 * Find existing skills whose names are within `maxDistance` edits of the input.
 * Comparison is case-insensitive. Results sorted by distance ascending, then alphabetically.
 *
 * @param input - user-typed text
 * @param existingSkills - array of { id, name } from the shared skills vocabulary
 * @param maxDistance - maximum edit distance (default 2)
 */
export function fuzzySkillMatch(
  input: string,
  existingSkills: { id: string; name: string }[],
  maxDistance: number = 2,
): FuzzyMatch[] {
  if (!input.trim()) return [];

  const needle = input.trim().toLowerCase();
  const matches: FuzzyMatch[] = [];

  for (const skill of existingSkills) {
    const target = skill.name.toLowerCase();
    if (target === needle) continue; // exact match — no nudge needed
    const dist = levenshtein(needle, target);
    if (dist <= maxDistance) {
      matches.push({ name: skill.name, id: skill.id, distance: dist });
    }
  }

  return matches.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
}
