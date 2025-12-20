import {
  Controller,
  Get,
  Param,
  Res,
  Req,
  InternalServerErrorException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { FilesService } from './files.service.js'
import { RequestUtil } from '../../common/utils/request.util.js'

@Controller('download')
export class DownloadController {
  private readonly logger = new Logger(DownloadController.name)

  constructor(private readonly filesService: FilesService) {}

  @Get(':id')
  async downloadFile(
    @Param('id') fileId: string,
    @Res() res: FastifyReply,
    @Req() request: FastifyRequest
  ): Promise<void> {
    let streamCleanup: (() => void) | undefined

    try {
      // Check if request is already aborted
      RequestUtil.throwIfAborted(request, 'File download aborted by client')

      const result = await this.filesService.downloadFileStream({ fileId })
      const { stream, fileInfo } = result

      // Setup abort listener to cleanup stream
      streamCleanup = RequestUtil.onRequestAborted(request, () => {
        this.logger.warn(`File download aborted by client: ${fileId}`)
        if (stream && !stream.destroyed) {
          stream.destroy()
        }
      })

      // Set headers
      res.header('Content-Type', fileInfo.mimeType)
      res.header('Content-Length', fileInfo.size.toString())
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.header('Pragma', 'no-cache')
      res.header('Expires', '0')

      // Handle stream errors
      stream.on('error', (error) => {
        this.logger.error(`Stream error during file download: ${fileId}`, error)
        if (streamCleanup) streamCleanup()
        if (!res.sent) {
          res.status(500).send({ error: 'Failed to read file' })
        }
      })

      // Cleanup when stream ends
      stream.on('end', () => {
        if (streamCleanup) streamCleanup()
      })

      // Send stream
      res.send(stream)
    } catch (error: any) {
      // Cleanup on error
      if (streamCleanup) streamCleanup()

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
