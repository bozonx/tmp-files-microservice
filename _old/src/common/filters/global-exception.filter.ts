import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { ApiResponse } from '../interfaces/api.interface';

/**
 * Глобальный фильтр исключений для обработки всех ошибок
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status = this.getHttpStatus(exception);
    const message = this.getErrorMessage(exception);
    const errorCode = this.getErrorCode(exception);

    // Логируем ошибку
    this.logError(exception, request, status);

    // Формируем ответ
    const errorResponse: ApiResponse = {
      success: false,
      error: message,
      errorCode,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        requestId: this.generateRequestId(),
      },
    };

    // Отправляем ответ
    response.status(status).send(errorResponse);
  }

  /**
   * Получение HTTP статуса из исключения
   */
  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    // Обработка специфических ошибок
    if (exception instanceof Error) {
      const message = exception.message.toLowerCase();

      if (message.includes('validation') || message.includes('invalid')) {
        return HttpStatus.BAD_REQUEST;
      }

      if (message.includes('unauthorized') || message.includes('forbidden')) {
        return HttpStatus.UNAUTHORIZED;
      }

      if (message.includes('not found')) {
        return HttpStatus.NOT_FOUND;
      }

      if (message.includes('timeout')) {
        return HttpStatus.REQUEST_TIMEOUT;
      }
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Получение сообщения об ошибке
   */
  private getErrorMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return response;
      }

      if (typeof response === 'object' && response !== null) {
        const errorResponse = response as any;
        return errorResponse.message || errorResponse.error || exception.message;
      }
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }

  /**
   * Получение кода ошибки
   */
  private getErrorCode(exception: unknown): string {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      switch (status) {
        case HttpStatus.BAD_REQUEST:
          return 'BAD_REQUEST';
        case HttpStatus.UNAUTHORIZED:
          return 'UNAUTHORIZED';
        case HttpStatus.FORBIDDEN:
          return 'FORBIDDEN';
        case HttpStatus.NOT_FOUND:
          return 'NOT_FOUND';
        case HttpStatus.CONFLICT:
          return 'CONFLICT';
        case HttpStatus.UNPROCESSABLE_ENTITY:
          return 'VALIDATION_ERROR';
        case HttpStatus.TOO_MANY_REQUESTS:
          return 'RATE_LIMIT_EXCEEDED';
        case HttpStatus.REQUEST_TIMEOUT:
          return 'REQUEST_TIMEOUT';
        default:
          return 'HTTP_ERROR';
      }
    }

    if (exception instanceof Error) {
      const message = exception.message.toLowerCase();

      if (message.includes('validation')) {
        return 'VALIDATION_ERROR';
      }

      if (message.includes('unauthorized')) {
        return 'UNAUTHORIZED';
      }

      if (message.includes('forbidden')) {
        return 'FORBIDDEN';
      }

      if (message.includes('not found')) {
        return 'NOT_FOUND';
      }

      if (message.includes('timeout')) {
        return 'REQUEST_TIMEOUT';
      }
    }

    return 'INTERNAL_SERVER_ERROR';
  }

  /**
   * Логирование ошибки
   */
  private logError(exception: unknown, request: FastifyRequest, status: number): void {
    const { method, url, ip } = request;
    const userAgent = request.headers['user-agent'] || 'Unknown';

    const logMessage = `${method} ${url} ${status} - ${ip} - ${userAgent}`;

    if (status >= 500) {
      // Серверные ошибки - логируем как ошибки
      this.logger.error(
        `${logMessage} - ${this.getErrorMessage(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status >= 400) {
      // Клиентские ошибки - логируем как предупреждения
      this.logger.warn(`${logMessage} - ${this.getErrorMessage(exception)}`);
    } else {
      // Остальные - логируем как информацию
      this.logger.log(`${logMessage} - ${this.getErrorMessage(exception)}`);
    }
  }

  /**
   * Генерация ID запроса для трекинга
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
