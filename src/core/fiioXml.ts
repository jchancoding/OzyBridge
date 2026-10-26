import type { EqBand, EqIssue, EqProfile, FilterType, ImportResult } from './eq';

const TYPES: Record<number, FilterType> = { 0: 'PK', 1: 'LSC', 2: 'HSC' };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&';
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    try {
      return String.fromCodePoint(code);
    } catch {
      return whole;
    }
  });
}

function param(block: string, name: string): string | null {
  const re = new RegExp(`<param\\s+name\\s*=\\s*"${name}"\\s*>([^<]*)</param>`, 'i');
  const m = re.exec(block);
  return m ? (m[1] ?? '').trim() : null;
}

function toNum(s: string | null): number | null {
  if (s === null || s === '') return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export function parseFiioXml(text: string): ImportResult & { model?: string } {
  const root = /<FiiO_DSP\b([^>]*)>/.exec(text);
  if (!root) return { ok: false, errors: [{ message: "This isn't a FiiO EQ file." }] };
  const modelMatch = /\bmodel\s*=\s*"([^"]*)"/i.exec(root[1] ?? '');
  const model = modelMatch ? decode(modelMatch[1] ?? '') : undefined;

  const errors: EqIssue[] = [];

  const eqRe = /<eq\s+index\s*=\s*"([^"]*)"\s*>([\s\S]*?)<\/eq>/gi;
  const eqStart = text.search(/<eq\s+index/i);
  const head = eqStart === -1 ? text : text.slice(0, eqStart);
  const master = param(text, 'masterGain') ?? param(head, 'masterGain');
  let preamp = 0;
  if (master !== null) {
    const v = toNum(master);
    if (v === null) {
      errors.push({ message: 'The master gain in this file isn\'t a valid number. Check the file and try again.' });
    } else {
      preamp = v;
    }
  }

  const found = new Map<number, EqBand>();
  let order = 0;
  for (const m of text.matchAll(eqRe)) {
    order++;
    const idxRaw = (m[1] ?? '').trim();
    const idx = Number(idxRaw);
    const valid = idxRaw !== '' && Number.isInteger(idx) && idx >= 0;
    const band = valid ? idx + 1 : order;
    if (!valid) {
      errors.push({ band, message: `Band ${band}: the index "${idxRaw}" isn't a whole number starting from 0. Fix the file and try again.` });
      continue;
    }
    if (found.has(idx)) {
      errors.push({ band, message: `Band ${band}: this band number appears more than once. Remove the duplicate and try again.` });
      continue;
    }
    const block = m[2] ?? '';
    let ok = true;
    const need = (name: string): number | null => {
      const v = toNum(param(block, name));
      if (v === null) {
        ok = false;
        errors.push({ band, message: `Band ${band}: the "${name}" value is missing or isn't a number. Fix the file and try again.` });
      }
      return v;
    };
    const t = need('type');
    const freq = need('freq');
    const gain = need('gain');
    const q = need('q');
    let type: FilterType | undefined;
    if (t !== null) {
      type = TYPES[t];
      if (!type) {
        ok = false;
        errors.push({ band, message: `Band ${band}: filter type ${t} isn't supported. Use 0 (peak), 1 (low shelf) or 2 (high shelf).` });
      }
    }
    if (ok && type && freq !== null && gain !== null && q !== null) {
      found.set(idx, { type, freq, gain, q, enabled: true });
    } else {
      found.set(idx, { type: 'PK', freq: 0, gain: 0, q: 0, enabled: false });
    }
  }

  if (found.size === 0 && errors.length === 0) {
    errors.push({ message: 'No EQ bands found in this FiiO file.' });
  }
  const max = found.size > 0 ? Math.max(...found.keys()) : -1;
  for (let i = 0; i <= max; i++) {
    if (!found.has(i)) {
      errors.push({ band: i + 1, message: `Band ${i + 1} is missing. Bands must be numbered without gaps starting from 0.` });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const bands = [...found.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
  const nameMatch = /<styleName>([\s\S]*?)<\/styleName>/i.exec(text);
  const name = nameMatch ? decode(nameMatch[1] ?? '').trim() || null : null;
  const result: ImportResult & { model?: string } = { ok: true, profile: { preamp, bands }, name, notes: [] };
  if (model !== undefined) result.model = model;
  return result;
}

const TYPE_CODES: Record<FilterType, number> = { PK: 0, LSC: 1, HSC: 2 };

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&apos;',
  );
}

function fmt(v: number, d: number): string {
  const s = String(Number(v.toFixed(d)));
  return s === '-0' ? '0' : s;
}

export function exportFiioXml(
  profile: EqProfile,
  opts: { model: string; name?: string; description?: string },
): string {
  const p = (name: string, value: string, pad: string): string => `${pad}<param name="${name}">${value}</param>`;
  const out = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<FiiO_DSP model="${esc(opts.model)}" version="0.0.1">`,
    '  <module name="EQ">',
    '    <eqGroup>',
    p('masterGain', fmt(profile.preamp, 2), '      '),
    '      <eqList>',
  ];
  profile.bands.forEach((b, i) => {
    out.push(
      `        <eq index="${i}">`,
      p('type', String(TYPE_CODES[b.type]), '          '),
      p('freq', fmt(b.freq, 0), '          '),
      p('gain', b.enabled ? fmt(b.gain, 2) : '0', '          '),
      p('q', fmt(b.q, 2), '          '),
      '        </eq>',
    );
  });
  out.push('      </eqList>', '    </eqGroup>', '  </module>');
  if (opts.name !== undefined) out.push(`  <styleName>${esc(opts.name)}</styleName>`);
  if (opts.description !== undefined) out.push(`  <description>${esc(opts.description)}</description>`);
  out.push('</FiiO_DSP>');
  return out.join('\n');
}
