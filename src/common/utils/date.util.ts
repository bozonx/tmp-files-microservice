/**
 * Date utility with UTC support
 */
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

export class DateUtil {
  public static now(): dayjs.Dayjs {
    return dayjs().utc()
  }

  public static nowInTimezone(tz: string): dayjs.Dayjs {
    return dayjs().tz(tz)
  }

  public static add(amount: number, unit: dayjs.ManipulateType): dayjs.Dayjs {
    return dayjs().utc().add(amount, unit)
  }

  public static addToDate(
    date: Date | string,
    amount: number,
    unit: dayjs.ManipulateType
  ): dayjs.Dayjs {
    return dayjs(date).utc().add(amount, unit)
  }

  public static isExpired(expiresAt: Date | string): boolean {
    return dayjs().utc().isAfter(dayjs(expiresAt).utc())
  }

  public static createExpirationDate(ttlSeconds: number): Date {
    return dayjs().utc().add(ttlSeconds, 'seconds').toDate()
  }

  public static createExpirationDateFrom(date: Date | string, ttlSeconds: number): Date {
    return dayjs(date).utc().add(ttlSeconds, 'seconds').toDate()
  }

  public static format(date: Date | string, format: string): string {
    return dayjs(date).utc().format(format)
  }

  public static formatInTimezone(date: Date | string, format: string, tz: string): string {
    return dayjs(date).tz(tz).format(format)
  }

  public static toUTC(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc()
  }

  public static toTimezone(date: Date | string, tz: string): dayjs.Dayjs {
    return dayjs(date).tz(tz)
  }

  public static isAfter(date1: Date | string, date2: Date | string): boolean {
    return dayjs(date1).utc().isAfter(dayjs(date2).utc())
  }

  public static isBefore(date1: Date | string, date2: Date | string): boolean {
    return dayjs(date1).utc().isBefore(dayjs(date2).utc())
  }

  public static isSame(date1: Date | string, date2: Date | string): boolean {
    return dayjs(date1).utc().isSame(dayjs(date2).utc())
  }

  public static diffInSeconds(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'seconds')
  }

  public static diffInMinutes(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'minutes')
  }

  public static diffInHours(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'hours')
  }

  public static diffInDays(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'days')
  }

  public static fromString(dateString: string): dayjs.Dayjs {
    return dayjs(dateString).utc()
  }

  public static fromTimestamp(timestamp: number): dayjs.Dayjs {
    return dayjs(timestamp).utc()
  }

  public static toTimestamp(date: Date | string): number {
    return dayjs(date).utc().valueOf()
  }

  public static toISOString(date: Date | string): string {
    return dayjs(date).utc().toISOString()
  }

  public static isValid(date: Date | string): boolean {
    return dayjs(date).isValid()
  }

  public static startOfDay(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().startOf('day')
  }

  public static endOfDay(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().endOf('day')
  }

  public static startOfMonth(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().startOf('month')
  }

  public static endOfMonth(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().endOf('month')
  }

  public static startOfYear(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().startOf('year')
  }

  public static endOfYear(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().endOf('year')
  }
}
