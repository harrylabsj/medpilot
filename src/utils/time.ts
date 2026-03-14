export function nowIso(): string {
  return new Date().toISOString();
}

export function minutesBetween(plannedIso: string, actualIso: string): number {
  const diffMs = new Date(actualIso).getTime() - new Date(plannedIso).getTime();
  return Math.round(diffMs / 60000);
}

export function isoDate(iso: string): string {
  return iso.slice(0, 10);
}
