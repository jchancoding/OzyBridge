import { describe, expect, it } from 'vitest';
import type { EqProfile } from './eq';
import { fingerprint, matchSlotNames, parseSlotNames, renameSlot, serializeSlotNames } from './slotNames';

const band = (freq: number, gain: number) => ({ type: 'PK' as const, freq, gain, q: 1, enabled: true });
const A: EqProfile = { preamp: -3, bands: [band(100, 2), band(1000, 0)] };
const B: EqProfile = { preamp: -1, bands: [band(200, -2)] };
const flat: EqProfile = { preamp: 0, bands: [band(100, 0)] };

describe('slotNames', () => {
  it('fingerprint ignores flat and disabled bands', () => {
    expect(fingerprint(A)).toBe(fingerprint({ preamp: -3, bands: [band(100, 2), { ...band(5, 4), enabled: false }] }));
    expect(fingerprint(A)).not.toBe(fingerprint(B));
  });
  it('matches by slot, follows moved presets, ignores unknown and flat', () => {
    let s = renameSlot({}, 'X', 160, A, 'A2000');
    s = renameSlot(s, 'X', 161, B, 'HD600');
    const e = s.X ?? [];
    expect(matchSlotNames(e, { 160: A, 161: B })).toEqual({ 160: 'A2000', 161: 'HD600' });
    expect(matchSlotNames(e, { 160: B, 161: A })).toEqual({ 160: 'HD600', 161: 'A2000' });
    expect(matchSlotNames(e, { 160: { ...A, preamp: -4 }, 161: flat })).toEqual({});
  });
  it('same slot wins over a duplicate elsewhere', () => {
    let s = renameSlot({}, 'X', 160, A, 'one');
    s = renameSlot(s, 'X', 161, A, 'two');
    expect(matchSlotNames(s.X ?? [], { 160: A, 161: A })).toEqual({ 160: 'one', 161: 'two' });
  });
  it('rename replaces, empty removes, round-trips, rejects junk', () => {
    let s = renameSlot({}, 'X', 160, A, ' a ');
    s = renameSlot(s, 'X', 160, A, 'b');
    expect(s.X).toHaveLength(1);
    expect(parseSlotNames(serializeSlotNames(s))).toEqual(s);
    expect(renameSlot(s, 'X', 160, A, ' ').X).toEqual([]);
    expect(parseSlotNames('nope')).toEqual({});
    expect(parseSlotNames('{"X":[{"slot":1,"name":"","fp":"f"},5],"Y":3}')).toEqual({ X: [] });
  });
});
