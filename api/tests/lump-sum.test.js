import { describe, it, expect } from 'vitest';
import { isLumpSum, parseAmount, parseCurrency, lumpSumOf } from '../src/services/lump-sum.js';

const TAG = [{ name: 'Pauschalabrechnung' }];

describe('isLumpSum', () => {
  it.each([
    [TAG],
    [[{ name: ' pauschalabrechnung ' }]],
    [[{ name: 'Other' }, { name: 'PAUSCHALABRECHNUNG' }]],
  ])('true for %j', (tags) => expect(isLumpSum(tags)).toBe(true));

  it.each([
    [[]], [null], [undefined], ['Pauschalabrechnung'], [[{ name: 'Pauschal' }]], [[{}]],
  ])('false for %j', (tags) => expect(isLumpSum(tags)).toBe(false));
});

describe('parseAmount', () => {
  it.each([
    '10.000,00', '10,000.00', '10000', '10.000', '10,000', "10'000", ' 10 000 € ', 'EUR 10.000',
  ])('%j → 10000', (s) => expect(parseAmount(s)).toBe(10000));

  it('decimal comma', () => expect(parseAmount('1500,5')).toBe(1500.5));
  it('German thousands + decimals', () => expect(parseAmount('1.234.567,89')).toBe(1234567.89));

  it.each(['', null, undefined, 'abc', '0', '-5'])('%j → null', (s) => expect(parseAmount(s)).toBeNull());
});

describe('parseCurrency', () => {
  it('trims and upper-cases', () => expect(parseCurrency(' chf ')).toBe('CHF'));
  it.each(['', '   ', null, undefined])('%j → EUR', (s) => expect(parseCurrency(s)).toBe('EUR'));
});

describe('lumpSumOf', () => {
  it('hourly without the tag', () => {
    expect(lumpSumOf({ tags: [{ name: 'Other' }], cv3: '10000', cv4: 'CHF', invoiced: '5' }))
      .toEqual({ billing_mode: 'hourly', lump_sum: null });
  });

  it('lump sum with agreed amount and earned %', () => {
    expect(lumpSumOf({ tags: TAG, cv3: '10.000,00', cv4: '', invoiced: '4000.00' })).toEqual({
      billing_mode: 'lump_sum',
      lump_sum: { agreed: 10000, currency: 'EUR', invoiced: 4000, earned_pct: 40 },
    });
  });

  it('earned % above 100 is not capped', () => {
    expect(lumpSumOf({ tags: TAG, cv3: '10000', cv4: null, invoiced: '11000' }).lump_sum.earned_pct).toBe(110);
  });

  it('agreed not set → agreed and earned_pct null', () => {
    const { lump_sum } = lumpSumOf({ tags: TAG, cv3: '', cv4: null, invoiced: '500' });
    expect(lump_sum.agreed).toBeNull();
    expect(lump_sum.earned_pct).toBeNull();
    expect(lump_sum.invoiced).toBe(500);
  });

  it('invoiced rounded to cents', () => {
    expect(lumpSumOf({ tags: TAG, cv3: '10000', cv4: null, invoiced: '1234.565' }).lump_sum.invoiced).toBe(1234.57);
  });
});
