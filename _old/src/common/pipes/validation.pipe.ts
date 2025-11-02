import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { ValidationErrorResponse, ValidationError } from '../interfaces/api.interface';

/**
 * Глобальный пайп для валидации входных данных
 */
@Injectable()
export class GlobalValidationPipe implements PipeTransform<any> {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    // Если нет метатипа или это примитивный тип, возвращаем значение как есть
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    // Преобразуем plain object в class instance
    const object = plainToClass(metatype, value);

    // Валидируем объект
    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: {
        target: false,
        value: false,
      },
    });

    if (errors.length > 0) {
      throw new BadRequestException(this.formatValidationErrors(errors));
    }

    return object;
  }

  /**
   * Проверка, нужно ли валидировать данный тип
   */
  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  /**
   * Форматирование ошибок валидации
   */
  private formatValidationErrors(errors: any[]): ValidationErrorResponse {
    const validationErrors: ValidationError[] = errors.map((error) => ({
      field: error.property,
      message: this.getFirstErrorMessage(error.constraints),
      value: error.value,
      constraints: error.constraints,
    }));

    return {
      success: false,
      error: 'Validation failed',
      errorCode: 'VALIDATION_ERROR',
      validationErrors,
    };
  }

  /**
   * Получение первого сообщения об ошибке из ограничений
   */
  private getFirstErrorMessage(constraints: Record<string, string>): string {
    if (!constraints) {
      return 'Validation failed';
    }

    const firstKey = Object.keys(constraints)[0];
    return constraints[firstKey] || 'Validation failed';
  }
}
