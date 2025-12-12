/**
 * Date utility with UTC support
 */
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

export class DateUtil {
  static now(): dayjs.Dayjs {
    return dayjs().utc()
  }

  static nowInTimezone(tz: string): dayjs.Dayjs {
    return dayjs().tz(tz)
  }

  static add(amount: number, unit: dayjs.ManipulateType): dayjs.Dayjs {
    return dayjs().utc().add(amount, unit)
  }

  static addToDate(date: Date | string, amount: number, unit: dayjs.ManipulateType): dayjs.Dayjs {
    return dayjs(date).utc().add(amount, unit)
  }

  static isExpired(expiresAt: Date | string): boolean {
    return dayjs().utc().isAfter(dayjs(expiresAt).utc())
  }

  static createExpirationDate(ttlSeconds: number): Date {
    return dayjs().utc().add(ttlSeconds, 'seconds').toDate()
  }

  static createExpirationDateFrom(date: Date | string, ttlSeconds: number): Date {
    return dayjs(date).utc().add(ttlSeconds, 'seconds').toDate()
  }

  static format(date: Date | string, format: string): string {
    return dayjs(date).utc().format(format)
  }

  static formatInTimezone(date: Date | string, format: string, tz: string): string {
    return dayjs(date).tz(tz).format(format)
  }

  static toUTC(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc()
  }

  static toTimezone(date: Date | string, tz: string): dayjs.Dayjs {
    return dayjs(date).tz(tz)
  }

  static isAfter(date1: Date | string, date2: Date | string): boolean {
    return dayjs(date1).utc().isAfter(dayjs(date2).utc())
  }

  static isBefore(date1: Date | string, date2: Date | string): boolean {
    return dayjs(date1).utc().isBefore(dayjs(date2).utc())
  }

  static isSame(date1: Date | string, date2: Date | string): boolean {
    return dayjs(date1).utc().isSame(dayjs(date2).utc())
  }

  static diffInSeconds(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'seconds')
  }

  static diffInMinutes(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'minutes')
  }

  static diffInHours(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'hours')
  }

  static diffInDays(date1: Date | string, date2: Date | string): number {
    return dayjs(date1).utc().diff(dayjs(date2).utc(), 'days')
  }

  static fromString(dateString: string): dayjs.Dayjs {
    return dayjs(dateString).utc()
  }

  static fromTimestamp(timestamp: number): dayjs.Dayjs {
    return dayjs(timestamp).utc()
  }

  static toTimestamp(date: Date | string): number {
    return dayjs(date).utc().valueOf()
  }

  static toISOString(date: Date | string): string {
    return dayjs(date).utc().toISOString()
  }

  static isValid(date: Date | string): boolean {
    return dayjs(date).isValid()
  }

  static startOfDay(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().startOf('day')
  }

  static endOfDay(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().endOf('day')
  }

  static startOfMonth(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().startOf('month')
  }

  static endOfMonth(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().endOf('month')
  }

  static startOfYear(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().startOf('year')
  }

  static endOfYear(date: Date | string): dayjs.Dayjs {
    return dayjs(date).utc().endOf('year')
  }
}
