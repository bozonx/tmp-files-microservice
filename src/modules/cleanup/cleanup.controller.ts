import {
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { CleanupService } from './cleanup.service'

@Controller('cleanup')
export class CleanupController {
  private readonly logger = new Logger(CleanupController.name)

  constructor(private readonly cleanupService: CleanupService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runCleanup(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('Manual cleanup requested')
      await this.cleanupService.handleScheduledCleanup()
      this.logger.log('Manual cleanup finished')
      return { success: true, message: 'Cleanup completed' }
    } catch (error: any) {
      throw new InternalServerErrorException(`Cleanup request failed: ${error.message}`)
    }
  }
}
