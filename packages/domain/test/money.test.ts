import { describe, expect, it } from 'vitest';
import { applyBp, divRound, formatMoney, formatMultiplier, mad, parseMoneyInput } from '../src';

describe('money', () => {
  it('rounds half away from zero, exactly', () => {
    expect(divRound(5, 10)).toBe(1);
    expect(divRound(4, 10)).toBe(0);
    expect(divRound(-5, 10)).toBe(-1);
    expect(divRound(-4, 10)).toBe(0);
    expect(applyBp(333, 1500)).toBe(50); // 49,95 → 50
  });
  it('never accepts non-integer amounts', () => {
    expect(() => applyBp(10.5 as number, 1500)).toThrow();
  });
  it('formats French amounts', () => {
    expect(formatMoney(mad(100))).toBe('100 MAD');
    expect(formatMoney(12840)).toBe('128,40 MAD');
    expect(formatMoney(-1500)).toBe('−15 MAD');
    expect(formatMoney(8500, { sign: 'always' })).toBe('+85 MAD');
    expect(formatMoney(120000)).toBe('1 200 MAD');
    expect(formatMultiplier(12000)).toBe('×1,2');
  });
  it('parses typed amounts', () => {
    expect(parseMoneyInput('50')).toBe(5000);
    expect(parseMoneyInput('50,5')).toBe(5050);
    expect(parseMoneyInput('1 200,00')).toBe(120000);
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('5,555')).toBeNull();
  });
});
