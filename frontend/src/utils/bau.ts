import type { BusinessContact, Settings, TeamMember } from '../types';

export const DEFAULT_BAU_PERCENT = 8;
const LEGACY_QUARTER_WORKDAYS = 64;

function roundToSingleDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalisePercent(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.max(0, value);
}

function normaliseLegacyDays(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.max(0, value);
}

export function legacyBauDaysToPercent(days: number, quarterWorkdays: number = LEGACY_QUARTER_WORKDAYS): number {
  if (quarterWorkdays <= 0) return 0;
  return roundToSingleDecimal((Math.max(0, days) / quarterWorkdays) * 100);
}

export function bauPercentToLegacyDays(percent: number, quarterWorkdays: number = LEGACY_QUARTER_WORKDAYS): number {
  if (quarterWorkdays <= 0) return 0;
  return roundToSingleDecimal(Math.max(0, percent) * quarterWorkdays / 100);
}

export function getSettingsBauPercent(settings: Pick<Settings, 'bauReservePercent' | 'bauReserveDays'>): number {
  const percent = normalisePercent(settings.bauReservePercent);
  if (percent != null) return percent;

  const legacyDays = normaliseLegacyDays(settings.bauReserveDays);
  if (legacyDays != null) return legacyBauDaysToPercent(legacyDays);

  return DEFAULT_BAU_PERCENT;
}

export function getTeamMemberBauPercent(
  member: Pick<TeamMember, 'bauOverride' | 'bauReservePercent' | 'bauReserveDays'>,
  settings: Pick<Settings, 'bauReservePercent' | 'bauReserveDays'>,
): number {
  if (member.bauOverride) {
    const percent = normalisePercent(member.bauReservePercent);
    if (percent != null) return percent;

    const legacyDays = normaliseLegacyDays(member.bauReserveDays);
    if (legacyDays != null) return legacyBauDaysToPercent(legacyDays);
  }

  return getSettingsBauPercent(settings);
}

export function getBusinessContactBauPercent(
  contact: Pick<BusinessContact, 'bauReservePercent' | 'bauReserveDays'>,
): number {
  const percent = normalisePercent(contact.bauReservePercent);
  if (percent != null) return percent;

  const legacyDays = normaliseLegacyDays(contact.bauReserveDays);
  if (legacyDays != null) return legacyBauDaysToPercent(legacyDays);

  return DEFAULT_BAU_PERCENT;
}

export function calculateBauDaysFromPercent(totalWorkdays: number, bauPercent: number): number {
  if (totalWorkdays <= 0 || bauPercent <= 0) return 0;
  return roundToSingleDecimal(totalWorkdays * (bauPercent / 100));
}

export function calculateTeamMemberBauDays(
  totalWorkdays: number,
  member: Pick<TeamMember, 'bauOverride' | 'bauReservePercent' | 'bauReserveDays'>,
  settings: Pick<Settings, 'bauReservePercent' | 'bauReserveDays'>,
): number {
  if (member.bauOverride) {
    const percent = normalisePercent(member.bauReservePercent);
    if (percent != null) return calculateBauDaysFromPercent(totalWorkdays, percent);

    return normaliseLegacyDays(member.bauReserveDays) ?? 0;
  }

  const globalPercent = normalisePercent(settings.bauReservePercent);
  if (globalPercent != null) return calculateBauDaysFromPercent(totalWorkdays, globalPercent);

  return normaliseLegacyDays(settings.bauReserveDays) ?? calculateBauDaysFromPercent(totalWorkdays, DEFAULT_BAU_PERCENT);
}

export function calculateBusinessContactBauDays(
  totalWorkdays: number,
  contact: Pick<BusinessContact, 'bauReservePercent' | 'bauReserveDays'>,
): number {
  const percent = normalisePercent(contact.bauReservePercent);
  if (percent != null) return calculateBauDaysFromPercent(totalWorkdays, percent);

  return normaliseLegacyDays(contact.bauReserveDays) ?? calculateBauDaysFromPercent(totalWorkdays, DEFAULT_BAU_PERCENT);
}
