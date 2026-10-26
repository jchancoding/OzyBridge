import type { EqBand, EqIssue, EqProfile, FilterType, ImportResult } from './eq';

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const SUPPORTED = 'Use peak (PK), low shelf (LSC) or high shelf (HSC).';

const ALIASES: Record<string, FilterType> = {
  PK: 'PK', PEQ: 'PK',
  LSC: 'LSC', LSQ: 'LSC', LS: 'LSC',
  HSC: 'HSC', HSQ: 'HSC', HS: 'HSC',
};

const UNSUPPORTED_WORDS: Record<string, string> = {
  LP: 'low-pass', LPQ: 'low-pass',
  HP: 'high-pass', HPQ: 'high-pass',
  BP: 'band-pass', NO: 'notch', AP: 'all-pass',
};

function num(s: string): number | null {
  if (!NUM.test(s)) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

type Field = { value: number } | { error: 'missing' | 'bad' };

function field(rest: string, re: RegExp): Field {
  const m = re.exec(rest);
  if (!m) return { error: 'missing' };
  const v = num(m[1] ?? '');
  return v === null ? { error: 'bad' } : { value: v };
}

export function parseAutoEq(text: string): ImportResult {
  const errors: EqIssue[] = [];
  const notes: string[] = [];
  const bands: EqBand[] = [];
  let preamp = 0;
  let preampSeen = false;
  let enabledCount = 0;

  const lines = text.split(/\r\n|\r|\n/);
  const chIdx = lines.findIndex((l) => /^\s*channel\s*:/i.test(l));
  if (chIdx >= 0) {
    return {
      ok: false,
      errors: [
        {
          line: chIdx + 1,
          message:
            'This file has separate EQ for the left and right channels. OzyBridge applies one EQ to both channels. Turn off two-channel EQ in Squiglink and export again.',
        },
      ],
    };
  }
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;

    if (/^preamp\b/i.test(line)) {
      const m = /^preamp\s*:\s*(\S+)\s*db$/i.exec(line);
      const v = m ? num(m[1] ?? '') : null;
      if (v === null) {
        errors.push({ line: n, message: `Line ${n}: couldn't read the preamp value. Write it like "Preamp: -6.0 dB".` });
      } else if (preampSeen) {
        errors.push({ line: n, message: `Line ${n}: there is more than one Preamp line. Keep only one.` });
      } else {
        preamp = v;
      }
      preampSeen = true;
      return;
    }

    if (!/^filter\s*\d+/i.test(line)) return;

    const malformed = (): void => {
      errors.push({
        line: n,
        message: `Line ${n}: couldn't read this filter. Write it like "Filter 1: ON PK Fc 100 Hz Gain -3.0 dB Q 1.0".`,
      });
    };

    const m = /^filter\s*\d+\s*:\s*(.*)$/i.exec(line);
    if (!m) return malformed();
    const tokens = (m[1] ?? '').split(/\s+/).filter(Boolean);
    const state = (tokens[0] ?? '').toUpperCase();
    if (state !== 'ON' && state !== 'OFF') return malformed();
    const on = state === 'ON';
    const typeTok = (tokens[1] ?? '').toUpperCase();
    if (!typeTok) return malformed();
    if (on && typeTok === 'NONE') return;

    const rest = tokens.slice(2).join(' ');
    const skipOff = (): void => {
      notes.push(`Line ${n}: skipped a disabled filter that couldn't be read.`);
    };

    const fixedSlope = /^\d+\s*db$/i.test(tokens[2] ?? '') && (typeTok === 'LS' || typeTok === 'HS');
    let type: FilterType | undefined;
    if (fixedSlope) {
      if (!on) return skipOff();
      errors.push({
        line: n,
        message: `Line ${n}: fixed-slope shelf filters (${typeTok} ${tokens[2]}) aren't supported. ${SUPPORTED}`,
      });
      return;
    }
    type = ALIASES[typeTok];
    if (!type) {
      if (!on) return skipOff();
      const word = UNSUPPORTED_WORDS[typeTok];
      errors.push({
        line: n,
        message: word
          ? `Line ${n}: ${word} filters (${typeTok}) aren't supported. ${SUPPORTED}`
          : `Line ${n}: filter type "${tokens[1]}" isn't supported. ${SUPPORTED}`,
      });
      return;
    }

    const fc = field(rest, /\bfc\s+(\S+)/i);
    const gain = field(rest, /\bgain\s+(\S+)/i);
    const q = field(rest, /(?:^|\s)q\s+(\S+)/i);
    const hasBw = /(?:^|\s)bw\b/i.test(rest);

    const problems: string[] = [];
    if (hasBw && 'error' in q) {
      problems.push(
        `Line ${n}: this filter uses bandwidth (BW) instead of Q. Export the file again with Q values.`,
      );
    } else {
      const check = (f: Field, label: string, positive: boolean): void => {
        if ('error' in f) {
          problems.push(
            f.error === 'missing'
              ? `Line ${n}: this filter has no ${label} value. Add it, e.g. "${label} 1.0".`
              : `Line ${n}: the ${label} value isn't a valid number. Fix it and try again.`,
          );
        } else if (positive && f.value <= 0) {
          problems.push(`Line ${n}: ${label} must be greater than 0. Change it and try again.`);
        }
      };
      check(fc, 'Fc', true);
      check(gain, 'Gain', false);
      check(q, 'Q', true);
    }

    if (problems.length > 0) {
      if (!on) return skipOff();
      for (const message of problems) errors.push({ line: n, message });
      return;
    }

    const f = fc as { value: number };
    const g = gain as { value: number };
    const qq = q as { value: number };
    bands.push({ type, freq: f.value, gain: g.value, q: qq.value, enabled: on });
    if (on) enabledCount++;
  });

  if (errors.length === 0 && enabledCount === 0) {
    errors.push({
      message: 'No filters found. Paste or drop a parametric EQ text file (AutoEQ, Squiglink or REW format).',
    });
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, profile: { preamp, bands }, name: null, notes };
}

const fmt = (v: number, d: number): string => String(Number(v.toFixed(d)));

export function exportAutoEq(profile: EqProfile, opts?: { omitFlat?: boolean }): string {
  const out = [`Preamp: ${fmt(profile.preamp, 2)} dB`];
  const bands = opts?.omitFlat
    ? profile.bands.filter((b) => b.enabled && Number(b.gain.toFixed(2)) !== 0)
    : profile.bands;
  bands.forEach((b, i) => {
    out.push(
      `Filter ${i + 1}: ${b.enabled ? 'ON' : 'OFF'} ${b.type} Fc ${fmt(b.freq, 1)} Hz Gain ${fmt(b.gain, 2)} dB Q ${fmt(b.q, 3)}`,
    );
  });
  return out.join('\n') + '\n';
}
