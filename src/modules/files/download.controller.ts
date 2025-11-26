import {
  Controller,
  Get,
  Param,
  Res,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { FilesService } from './files.service'

@Controller('download')
export class DownloadController {
  constructor(private readonly filesService: FilesService) {}

  @Get(':id')
  async downloadFile(@Param('id') fileId: string, @Res() res: FastifyReply): Promise<void> {
    try {
      const result = await this.filesService.downloadFile({ fileId })
      const { buffer, fileInfo } = result
      res.header('Content-Type', fileInfo.mimeType)
      res.header('Content-Length', fileInfo.size.toString())
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.header('Pragma', 'no-cache')
      res.header('Expires', '0')
      res.send(buffer)
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof InternalServerErrorException
      )
        throw error
      throw new InternalServerErrorException(`File download failed: ${error.message}`)
    }
  }
}
