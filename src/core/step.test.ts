import { expect, it } from 'vitest';
import { stepValue } from './step';

const r = { min: -24, max: 12 };
it('steps, multiplies with shift, avoids float noise and clamps', () => {
  expect(stepValue(0.1, 0.1, 1, false, r)).toBe(0.2);
  expect(stepValue(0.3, 0.1, 1, false, r)).toBe(0.4);
  expect(stepValue(1, 0.01, 1, true, { min: 0.25, max: 8 })).toBe(1.1);
  expect(stepValue(1000, 1, -1, true, { min: 20, max: 20000 })).toBe(990);
  expect(stepValue(11.5, 0.1, 1, true, r)).toBe(12);
  expect(stepValue(-23.5, 0.1, -1, true, r)).toBe(-24);
});

import { commitNumber, inRange, parseDecimal } from './step';

it('parses only complete decimals', () => {
  for (const t of ['', '-', '-.', '.', 'abc', '1e3', '1,5']) expect(parseDecimal(t)).toBeNull();
  expect(parseDecimal('-3.5')).toBe(-3.5);
  expect(parseDecimal(' .5 ')).toBe(0.5);
  expect(parseDecimal('+2')).toBe(2);
  expect(parseDecimal('7.')).toBe(7);
});

it('commits rounded and clamped, rejects junk', () => {
  expect(commitNumber('-3.14', 0.1, r)).toEqual({ ok: true, value: -3.1 });
  expect(commitNumber('99', 0.1, r)).toEqual({ ok: true, value: 12 });
  expect(commitNumber('0.256', 0.01, { min: 0.25, max: 8 })).toEqual({ ok: true, value: 0.26 });
  expect(commitNumber('-', 0.1, r).ok).toBe(false);
  expect(inRange(5, r)).toBe(true);
  expect(inRange(50, r)).toBe(false);
  expect(inRange(null, r)).toBe(false);
});
