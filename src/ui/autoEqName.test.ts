import { describe, expect, it } from 'vitest';
import { autoEqName } from './autoEqName';

describe('autoEqName', () => {
  it('names a match from an IEM to a target', () => {
    expect(autoEqName('Moondrop Aria measured by Super Review', 'Harman IE 2019')).toBe('Moondrop Aria-to-Harman IE 2019');
  });

  it('names a match from one IEM to another and drops reviewer credits', () => {
    expect(autoEqName(
      'Truthear Zero measured by Crinacle',
      'Moondrop Aria 2 measured by Super Review',
    )).toBe('Truthear Zero-to-Moondrop Aria 2');
  });

  it('strips characters that break a file name', () => {
    expect(autoEqName('A/B: C', 'D*E')).toBe('A B C-to-D E');
  });
});
