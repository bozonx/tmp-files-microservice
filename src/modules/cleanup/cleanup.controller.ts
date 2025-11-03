import { Controller, Post, HttpCode, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { CleanupService } from './cleanup.service';

@Controller('cleanup')
export class CleanupController {
  constructor(private readonly cleanupService: CleanupService) {}

  @Post('run')
  @HttpCode(HttpStatus.OK)
  async runCleanup(): Promise<{ success: boolean; message: string }> {
    try {
      await this.cleanupService.handleScheduledCleanup();
      return { success: true, message: 'Cleanup completed' };
    } catch (error: any) {
      throw new InternalServerErrorException(`Cleanup request failed: ${error.message}`);
    }
  }
}
