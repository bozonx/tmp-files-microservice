import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly authEnabled: boolean;
  private readonly authTokens: string[];

  constructor(
    private readonly configService: ConfigService,
    @Inject(PinoLogger) private readonly logger: PinoLogger,
  ) {
    logger.setContext(AuthGuard.name);
    this.authEnabled = this.configService.get<boolean>('app.authEnabled', false);
    this.authTokens = this.configService.get<string[]>('app.authTokens', []);

    // Only validate tokens if auth is enabled
    if (this.authEnabled && this.authTokens.length === 0) {
      throw new Error('AUTH_TOKENS configuration is missing or empty when AUTH_ENABLED is true');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    // If authentication is disabled, allow all requests
    if (!this.authEnabled) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      this.logger.warn('Missing Authorization header');
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      this.logger.warn('Invalid Authorization header format');
      throw new UnauthorizedException(
        'Invalid Authorization header format. Expected: Bearer <token>',
      );
    }

    const isValid = this.authTokens.includes(token);

    if (!isValid) {
      this.logger.warn('Invalid authorization token');
      throw new UnauthorizedException('Invalid authorization token');
    }

    return true;
  }
}
