export const FORMSUBMIT_ID = 'cb4f08d23c663090081e91b4624c20d7';

export async function submitForm(
  kind: 'feedback' | 'device-report',
  fields: Record<string, string>,
): Promise<boolean> {
  if (!FORMSUBMIT_ID) return false;
  try {
    const model = fields.model?.trim() || fields.device?.trim() || 'unknown';
    const subject = kind === 'feedback' ? '[OzyBridge feedback]' : `[OzyBridge device report] ${model}`;
    const res = await fetch(`https://formsubmit.co/ajax/${FORMSUBMIT_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...fields, _subject: subject, _captcha: 'false' }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
