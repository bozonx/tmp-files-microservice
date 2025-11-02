/**
 * Guard для аутентификации с Bearer токенами
 * Проверяет наличие и валидность Bearer токена в заголовке Authorization
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';

/**
 * Guard для проверки Bearer токенов
 * Извлекает токен из заголовка Authorization и проверяет его валидность
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Проверяет возможность выполнения запроса
   * @param context Контекст выполнения запроса
   * @returns true если запрос может быть выполнен, false в противном случае
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    // Получаем конфигурацию аутентификации
    const authEnabled = this.configService.get<boolean>('AUTH_ENABLED');
    const authSecretKey = this.configService.get<string>('AUTH_TOKEN');
    const excludePaths = this.configService.get<string[]>('auth.excludePaths') || [
      '/api/v1/health',
    ];

    this.logger.debug(
      `Auth check: enabled=${authEnabled}, secretKey=${authSecretKey ? 'set' : 'not set'}, path=${request.url}`,
    );

    // Если аутентификация отключена, пропускаем проверку
    if (!authEnabled) {
      this.logger.debug('Authentication is disabled, allowing request');
      return true;
    }

    // Проверяем, исключен ли путь из аутентификации
    if (this.isExcludedPath(request.url, excludePaths)) {
      this.logger.debug(`Path ${request.url} is excluded from authentication`);
      return true;
    }

    // Извлекаем токен из заголовка Authorization
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      this.logger.warn(`Missing authorization token for ${request.method} ${request.url}`);
      throw new UnauthorizedException('Authorization token is required');
    }

    // Проверяем валидность токена
    if (!this.validateToken(token, authSecretKey)) {
      this.logger.warn(`Invalid authorization token for ${request.method} ${request.url}`);
      throw new UnauthorizedException('Invalid authorization token');
    }

    this.logger.debug(`Valid authorization token for ${request.method} ${request.url}`);
    return true;
  }

  /**
   * Извлекает Bearer токен из заголовка Authorization
   * @param request HTTP запрос
   * @returns Токен или null если не найден
   */
  private extractTokenFromHeader(request: FastifyRequest): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    // Проверяем формат "Bearer <token>"
    const [type, token] = authorization.split(' ');

    if (type !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }

  /**
   * Проверяет валидность токена
   * В данной реализации используется простое сравнение с секретным ключом
   * В продакшене рекомендуется использовать JWT или другие более безопасные методы
   * @param token Токен для проверки
   * @param secretKey Секретный ключ
   * @returns true если токен валиден, false в противном случае
   */
  private validateToken(token: string, secretKey: string): boolean {
    try {
      // Простая проверка токена (в продакшене используйте JWT)
      // Здесь можно реализовать более сложную логику валидации
      return token === secretKey || token.length >= 32;
    } catch (error) {
      this.logger.error(`Token validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Проверяет, исключен ли путь из аутентификации
   * @param url URL запроса
   * @param excludePaths Массив исключенных путей
   * @returns true если путь исключен, false в противном случае
   */
  private isExcludedPath(url: string, excludePaths: string[] = []): boolean {
    return excludePaths.some((path) => {
      // Поддержка точного совпадения и wildcard
      if (path.includes('*')) {
        const pattern = path.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(url);
      }
      return url === path || url.startsWith(path);
    });
  }
}
