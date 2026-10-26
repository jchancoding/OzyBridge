export interface DeviceReport { name: string; productId: number; firmware: string | null | undefined }

export function deviceReportUrl({ name, productId, firmware }: DeviceReport): string {
  const pid = `0x${productId.toString(16).toUpperCase().padStart(4, '0')}`;
  const body = [
    `- Model: ${name}`,
    `- Product ID: ${pid}`,
    `- Firmware: ${firmware || 'unknown'}`,
    '',
    '- [ ] Connected and read slots',
    '- [ ] Wrote one slot and it verified',
    '- [ ] Still correct after unplug and replug',
    '- [ ] Notes:',
    '',
  ].join('\n');
  const q = new URLSearchParams({ title: `[device report] ${name}`, body });
  return `https://github.com/jchancoding/OzyBridge/issues/new?${q.toString().replace(/\+/g, '%20')}`;
}
