import { DateUtil } from '@/common/utils/date.util';

describe('DateUtil', () => {
  it('createExpirationDate returns a future date by given seconds', () => {
    const start = DateUtil.now().toDate();
    const exp = DateUtil.createExpirationDate(2);
    expect(DateUtil.isAfter(exp, start)).toBe(true);
    const diff = DateUtil.diffInSeconds(exp, start);
    expect(diff).toBeGreaterThanOrEqual(1);
  });

  it('isExpired returns true for past and false for future', () => {
    const past = DateUtil.add(-1, 'minute').toDate();
    const future = DateUtil.add(1, 'minute').toDate();
    expect(DateUtil.isExpired(past)).toBe(true);
    expect(DateUtil.isExpired(future)).toBe(false);
  });

  it('toISOString returns a valid ISO string', () => {
    const now = DateUtil.now().toDate();
    const iso = DateUtil.toISOString(now);
    expect(typeof iso).toBe('string');
    expect(DateUtil.isValid(iso)).toBe(true);
  });
});
