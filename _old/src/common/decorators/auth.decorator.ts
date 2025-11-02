/**
 * Декораторы для аутентификации
 * Предоставляет удобные декораторы для применения аутентификации к контроллерам и методам
 */

import { UseGuards, applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AuthGuard } from '../guards/auth.guard';

/**
 * Декоратор для применения аутентификации к контроллеру или методу
 * Автоматически применяет AuthGuard и добавляет Swagger документацию
 *
 * @example
 * ```typescript
 * @Controller('files')
 * @Auth() // Применяет аутентификацию ко всем методам контроллера
 * export class FilesController {
 *   // ...
 * }
 * ```
 *
 * @example
 * ```typescript
 * @Controller('files')
 * export class FilesController {
 *   @Get()
 *   @Auth() // Применяет аутентификацию только к этому методу
 *   async getFiles() {
 *     // ...
 *   }
 * }
 * ```
 */
export function Auth(): MethodDecorator & ClassDecorator {
  return applyDecorators(
    // Применяем AuthGuard для проверки токенов
    UseGuards(AuthGuard),

    // Добавляем Swagger документацию для Bearer аутентификации
    ApiBearerAuth(),

    // Добавляем документацию для ответа 401 Unauthorized
    ApiUnauthorizedResponse({
      description: 'Unauthorized - invalid or missing token',
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Authorization token is required' },
          errorCode: { type: 'string', example: 'UNAUTHORIZED' },
          timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
          path: { type: 'string', example: '/api/v1/files' },
        },
      },
    }),
  );
}

/**
 * Декоратор для отключения аутентификации на конкретном методе
 * Используется когда нужно исключить метод из аутентификации в защищенном контроллере
 *
 * @example
 * ```typescript
 * @Controller('files')
 * @Auth() // Применяет аутентификацию ко всем методам
 * export class FilesController {
 *   @Get('public')
 *   @Public() // Исключает этот метод из аутентификации
 *   async getPublicFiles() {
 *     // ...
 *   }
 * }
 * ```
 */
export function Public(): MethodDecorator {
  return applyDecorators(
    // Убираем Bearer аутентификацию из Swagger документации
    ApiBearerAuth(),

    // Убираем документацию для 401 ответа
    ApiUnauthorizedResponse(),
  );
}
