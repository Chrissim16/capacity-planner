/**
 * Nager.Date public holiday API — https://date.nager.at
 * Free, no auth required, CORS-friendly.
 */
export interface NagerHoliday {
  date: string;        // "2025-01-01"
  localName: string;
  name: string;        // English name
  countryCode: string; // ISO 3166-1 alpha-2
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];     // "Public", "Bank", "School", etc.
}

const BASE_URL = 'https://date.nager.at/api/v3';

/**
 * Maps commonly used but non-standard country codes to their official
 * ISO 3166-1 alpha-2 equivalents as required by the Nager.Date API.
 */
const CODE_ALIASES: Record<string, string> = {
  UK: 'GB',  // United Kingdom — ISO standard is GB, not UK
  EN: 'GB',
  ENG: 'GB',
};

function normaliseCode(code: string): string {
  const upper = code.toUpperCase();
  return CODE_ALIASES[upper] ?? upper;
}

/**
 * Fetch all public holidays for a given ISO country code and year.
 * Returns only entries marked as Public or Bank holidays (not School, Optional, etc.)
 */
export async function fetchNagerHolidays(
  countryCode: string,
  year: number
): Promise<NagerHoliday[]> {
  const isoCode = normaliseCode(countryCode);
  const res = await fetch(`${BASE_URL}/PublicHolidays/${year}/${isoCode}`);
  if (!res.ok) {
    throw new Error(`Nager.Date API error ${res.status} for ${countryCode}/${year}`);
  }
  const data: NagerHoliday[] = await res.json();
  // Filter to only public / bank holidays (exclude school, optional, etc.)
  return data.filter(h => h.types.some(t => ['Public', 'Bank'].includes(t)));
}

/**
 * Fetch available country codes from Nager.Date.
 */
export async function fetchNagerCountries(): Promise<{ countryCode: string; name: string }[]> {
  const res = await fetch(`${BASE_URL}/AvailableCountries`);
  if (!res.ok) throw new Error(`Nager.Date countries API error ${res.status}`);
  return res.json();
}
