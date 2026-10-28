function curveName(label: string): string {
  return label
    .replace(/\s+measured by\s+.*/i, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function autoEqName(fromLabel: string, toLabel: string): string {
  return `${curveName(fromLabel)}-to-${curveName(toLabel)}`;
}
