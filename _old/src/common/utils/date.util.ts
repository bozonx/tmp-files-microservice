/**
 * Утилита для работы с датами с поддержкой UTC
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Расширяем dayjs плагинами для работы с UTC и timezone
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Утилита для работы с датами
 */
export class DateUtil {
  /**
   * Получить текущее время в UTC
   */
  static now(): dayjs.Dayjs {
    return dayjs().utc();
  }

  /**
   * Получить текущее время в указанном timezone
   */
  static nowInTimezone(timezone: string): dayjs.Dayjs {
    return dayjs().tz(timezone);
  }

  /**
   * Добавить время к текущему моменту в UTC
   */
  static add(amount: number, unit: dayjs.ManipulateType): dayjs.Dayjs {
    return dayjs().utc().add(amount, unit);
  }

  /**
   * Добавить время к указанной дате в UTC
   */
  static addToDate(date: Date | string, amount: number, unit: dayjs.ManipulateType): dayjs.Dayjs {
    return dayjs(date).utc().add(amount, unit);
  }

  /**
   * Проверить, истек ли файл (сравнение в UTC)
   */
  static isExpired(expiresAt: Date | string): boolean {
    return dayjs().utc().isAfter(dayjs(expiresAt).utc());
  }

  /**
   * Создать дату истечения в UTC
   */
  static createExpirationDate(ttlSeconds: number): Date {
    return dayjs().utc().add(ttlSeconds, 'seconds').toDate();
  }

  /**
   * Создать дату истечения в UTC от указанной даты
   */
  static createExpirationDateFrom(date: Date | string, ttlSeconds: number): Date {
    return dayjs(date).utc().add(ttlSeconds, 'seconds').toDate();
  }

  /**
   * Форматировать дату в UTC
   */
  static format(date: Date | string, format: string): string {
    return dayjs(date).utc().format(format);
  }

  /**
   * Форматировать дату в указанном timezone
   */
  static formatInTimezone(date: Date | string, format: string, timezone: string): string {
    return dayjs(date).tz(timezone).format(format);
  }

  /**
   * Получить дату в UTC
   */
  static toUTC(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc();
  }

  /**
   * Получить дату в указанном timezone
   */
  static toTimezone(date: Date | string, timezone: string): dayjs.Dayjs {
    return dayjs(date).tz(timezone);
  }

  /**
   * Сравнить две даты в UTC
   */
  static isAfter(date1: Date | string, date2: Date | string): boolean {
    return dayjs(date1).utc().isAfter(dayjs(date2).utc());
  }

  /**
   * Сравнить две даты в UTC
   */
  static isBefore(date1: Date | string, date2: Date | string): boolean {
    return dayjs(date1).utc().isBefore(dayjs(date2).utc());
  }

  /**
   * Сравнить две даты в UTC
   */
  static isSame(date1: Date | string, date2: Date | string): boolean {
    return dayjs(date1).utc().isSame(dayjs(date2).utc());
  }

  /**
   * Получить разность в секундах между двумя датами в UTC
   */
  static diffInSeconds(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'seconds');
  }

  /**
   * Получить разность в минутах между двумя датами в UTC
   */
  static diffInMinutes(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'minutes');
  }

  /**
   * Получить разность в часах между двумя датами в UTC
   */
  static diffInHours(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'hours');
  }

  /**
   * Получить разность в днях между двумя датами в UTC
   */
  static diffInDays(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'days');
  }

  /**
   * Создать дату из строки в UTC
   */
  static fromString(dateString: string): dayjs.Dayjs {
    return dayjs(dateString).utc();
  }

  /**
   * Создать дату из timestamp в UTC
   */
  static fromTimestamp(timestamp: number): dayjs.Dayjs {
    return dayjs(timestamp).utc();
  }

  /**
   * Получить timestamp в UTC
   */
  static toTimestamp(date: Date | string): number {
    return dayjs(date).utc().valueOf();
  }

  /**
   * Получить ISO строку в UTC
   */
  static toISOString(date: Date | string): string {
    return dayjs(date).utc().toISOString();
  }

  /**
   * Проверить, является ли дата валидной
   */
  static isValid(date: Date | string): boolean {
    return dayjs(date).isValid();
  }

  /**
   * Получить начало дня в UTC
   */
  static startOfDay(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().startOf('day');
  }

  /**
   * Получить конец дня в UTC
   */
  static endOfDay(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().endOf('day');
  }

  /**
   * Получить начало месяца в UTC
   */
  static startOfMonth(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().startOf('month');
  }

  /**
   * Получить конец месяца в UTC
   */
  static endOfMonth(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().endOf('month');
  }

  /**
   * Получить начало года в UTC
   */
  static startOfYear(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().startOf('year');
  }

  /**
   * Получить конец года в UTC
   */
  static endOfYear(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().endOf('year');
  }
}
