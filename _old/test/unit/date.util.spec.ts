/**
 * Тесты для DateUtil
 */

import { DateUtil } from '../../src/common/utils/date.util';

describe('DateUtil', () => {
  describe('now', () => {
    it('should return current time in UTC', () => {
      const now = DateUtil.now();
      expect(now).toBeDefined();
      expect(now.isUTC()).toBe(true);
    });
  });

  describe('add', () => {
    it('should add time to current moment', () => {
      const future = DateUtil.add(1, 'hour');
      expect(future).toBeDefined();
      expect(future.isUTC()).toBe(true);
    });
  });

  describe('addToDate', () => {
    it('should add time to specified date', () => {
      const baseDate = new Date('2024-01-01T00:00:00.000Z');
      const future = DateUtil.addToDate(baseDate, 1, 'hour');
      expect(future).toBeDefined();
      expect(future.isUTC()).toBe(true);
    });
  });

  describe('isExpired', () => {
    it('should return true for expired date', () => {
      const pastDate = new Date('2020-01-01T00:00:00.000Z');
      expect(DateUtil.isExpired(pastDate)).toBe(true);
    });

    it('should return false for future date', () => {
      const futureDate = new Date('2030-01-01T00:00:00.000Z');
      expect(DateUtil.isExpired(futureDate)).toBe(false);
    });
  });

  describe('createExpirationDate', () => {
    it('should create expiration date with TTL', () => {
      const expiration = DateUtil.createExpirationDate(3600); // 1 hour
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('createExpirationDateFrom', () => {
    it('should create expiration date from specified date', () => {
      const baseDate = new Date('2024-01-01T00:00:00.000Z');
      const expiration = DateUtil.createExpirationDateFrom(baseDate, 3600);
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration.getTime()).toBe(baseDate.getTime() + 3600 * 1000);
    });
  });

  describe('format', () => {
    it('should format date in UTC', () => {
      const date = new Date('2024-01-01T12:00:00.000Z');
      const formatted = DateUtil.format(date, 'YYYY-MM-DD');
      expect(formatted).toBe('2024-01-01');
    });
  });

  describe('formatInTimezone', () => {
    it('should format date in specified timezone', () => {
      const date = new Date('2024-01-01T12:00:00.000Z');
      const formatted = DateUtil.formatInTimezone(date, 'YYYY-MM-DD HH:mm', 'Europe/Moscow');
      expect(formatted).toBeDefined();
      expect(formatted).toMatch(/2024-01-01/);
    });
  });

  describe('toUTC', () => {
    it('should convert date to UTC', () => {
      const date = new Date('2024-01-01T12:00:00.000Z');
      const utc = DateUtil.toUTC(date);
      expect(utc.isUTC()).toBe(true);
    });
  });

  describe('toTimezone', () => {
    it('should convert date to specified timezone', () => {
      const date = new Date('2024-01-01T12:00:00.000Z');
      const moscow = DateUtil.toTimezone(date, 'Europe/Moscow');
      expect(moscow).toBeDefined();
    });
  });

  describe('isAfter', () => {
    it('should return true when first date is after second', () => {
      const date1 = new Date('2024-01-02T00:00:00.000Z');
      const date2 = new Date('2024-01-01T00:00:00.000Z');
      expect(DateUtil.isAfter(date1, date2)).toBe(true);
    });

    it('should return false when first date is before second', () => {
      const date1 = new Date('2024-01-01T00:00:00.000Z');
      const date2 = new Date('2024-01-02T00:00:00.000Z');
      expect(DateUtil.isAfter(date1, date2)).toBe(false);
    });
  });

  describe('isBefore', () => {
    it('should return true when first date is before second', () => {
      const date1 = new Date('2024-01-01T00:00:00.000Z');
      const date2 = new Date('2024-01-02T00:00:00.000Z');
      expect(DateUtil.isBefore(date1, date2)).toBe(true);
    });

    it('should return false when first date is after second', () => {
      const date1 = new Date('2024-01-02T00:00:00.000Z');
      const date2 = new Date('2024-01-01T00:00:00.000Z');
      expect(DateUtil.isBefore(date1, date2)).toBe(false);
    });
  });

  describe('isSame', () => {
    it('should return true for same dates', () => {
      const date1 = new Date('2024-01-01T00:00:00.000Z');
      const date2 = new Date('2024-01-01T00:00:00.000Z');
      expect(DateUtil.isSame(date1, date2)).toBe(true);
    });

    it('should return false for different dates', () => {
      const date1 = new Date('2024-01-01T00:00:00.000Z');
      const date2 = new Date('2024-01-02T00:00:00.000Z');
      expect(DateUtil.isSame(date1, date2)).toBe(false);
    });
  });

  describe('diffInSeconds', () => {
    it('should calculate difference in seconds', () => {
      const date1 = new Date('2024-01-01T01:00:00.000Z');
      const date2 = new Date('2024-01-01T00:00:00.000Z');
      expect(DateUtil.diffInSeconds(date1, date2)).toBe(3600);
    });
  });

  describe('diffInMinutes', () => {
    it('should calculate difference in minutes', () => {
      const date1 = new Date('2024-01-01T01:00:00.000Z');
      const date2 = new Date('2024-01-01T00:00:00.000Z');
      expect(DateUtil.diffInMinutes(date1, date2)).toBe(60);
    });
  });

  describe('diffInHours', () => {
    it('should calculate difference in hours', () => {
      const date1 = new Date('2024-01-01T02:00:00.000Z');
      const date2 = new Date('2024-01-01T00:00:00.000Z');
      expect(DateUtil.diffInHours(date1, date2)).toBe(2);
    });
  });

  describe('diffInDays', () => {
    it('should calculate difference in days', () => {
      const date1 = new Date('2024-01-03T00:00:00.000Z');
      const date2 = new Date('2024-01-01T00:00:00.000Z');
      expect(DateUtil.diffInDays(date1, date2)).toBe(2);
    });
  });

  describe('fromString', () => {
    it('should create date from string', () => {
      const date = DateUtil.fromString('2024-01-01T00:00:00.000Z');
      expect(date).toBeDefined();
      expect(date.isUTC()).toBe(true);
    });
  });

  describe('fromTimestamp', () => {
    it('should create date from timestamp', () => {
      const timestamp = 1704067200000; // 2024-01-01T00:00:00.000Z
      const date = DateUtil.fromTimestamp(timestamp);
      expect(date).toBeDefined();
      expect(date.isUTC()).toBe(true);
    });
  });

  describe('toTimestamp', () => {
    it('should convert date to timestamp', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const timestamp = DateUtil.toTimestamp(date);
      expect(timestamp).toBe(1704067200000);
    });
  });

  describe('toISOString', () => {
    it('should convert date to ISO string', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      const isoString = DateUtil.toISOString(date);
      expect(isoString).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('isValid', () => {
    it('should return true for valid date', () => {
      const date = new Date('2024-01-01T00:00:00.000Z');
      expect(DateUtil.isValid(date)).toBe(true);
    });

    it('should return false for invalid date', () => {
      const date = new Date('invalid');
      expect(DateUtil.isValid(date)).toBe(false);
    });
  });

  describe('startOfDay', () => {
    it('should return start of day', () => {
      const date = new Date('2024-01-01T12:30:45.000Z');
      const startOfDay = DateUtil.startOfDay(date);
      expect(startOfDay.format('HH:mm:ss')).toBe('00:00:00');
    });
  });

  describe('endOfDay', () => {
    it('should return end of day', () => {
      const date = new Date('2024-01-01T12:30:45.000Z');
      const endOfDay = DateUtil.endOfDay(date);
      expect(endOfDay.format('HH:mm:ss')).toBe('23:59:59');
    });
  });

  describe('startOfMonth', () => {
    it('should return start of month', () => {
      const date = new Date('2024-01-15T12:30:45.000Z');
      const startOfMonth = DateUtil.startOfMonth(date);
      expect(startOfMonth.format('DD')).toBe('01');
    });
  });

  describe('endOfMonth', () => {
    it('should return end of month', () => {
      const date = new Date('2024-01-15T12:30:45.000Z');
      const endOfMonth = DateUtil.endOfMonth(date);
      expect(endOfMonth.format('DD')).toBe('31');
    });
  });

  describe('startOfYear', () => {
    it('should return start of year', () => {
      const date = new Date('2024-06-15T12:30:45.000Z');
      const startOfYear = DateUtil.startOfYear(date);
      expect(startOfYear.format('MM-DD')).toBe('01-01');
    });
  });

  describe('endOfYear', () => {
    it('should return end of year', () => {
      const date = new Date('2024-06-15T12:30:45.000Z');
      const endOfYear = DateUtil.endOfYear(date);
      expect(endOfYear.format('MM-DD')).toBe('12-31');
    });
  });
});
