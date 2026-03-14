let seq = 0;

export function createId(prefix: string): string {
  seq += 1;
  return `${prefix}_${String(seq).padStart(4, '0')}`;
}
