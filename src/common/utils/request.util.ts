import type { FastifyRequest } from 'fastify'

/**
 * Utility class for handling client request disconnections
 */
export class RequestUtil {
  /**
   * Check if the client has aborted the request
   */
  public static isRequestAborted(request: FastifyRequest): boolean {
    // Check if raw request exists and is aborted
    return request.raw?.destroyed === true || (request.raw as unknown as { aborted?: boolean })?.aborted === true
  }

  /**
   * Register a callback to be called when the client aborts the request
   * Returns a cleanup function to remove the listener
   */
  public static onRequestAborted(request: FastifyRequest, callback: () => void): () => void {
    if (!request.raw) {
      // If no raw request, return no-op cleanup
      return (): void => { }
    }

    const abortHandler = (): void => {
      callback()
    }

    // Listen for close event which fires when connection is closed
    request.raw.on('close', abortHandler)

    // Return cleanup function
    return (): void => {
      request.raw?.removeListener('close', abortHandler)
    }
  }

  /**
   * Create an AbortController that aborts when the request is aborted
   * Useful for integrating with APIs that support AbortSignal
   */
  public static createAbortController(request: FastifyRequest): AbortController {
    const controller = new AbortController()

    if (request.raw) {
      const abortHandler = (): void => {
        if (!controller.signal.aborted) {
          controller.abort()
        }
      }

      request.raw.on('close', abortHandler)

      // Cleanup when signal is aborted
      controller.signal.addEventListener('abort', () => {
        request.raw?.removeListener('close', abortHandler)
      })
    }

    return controller
  }

  /**
   * Throw an error if the request has been aborted
   */
  public static throwIfAborted(request: FastifyRequest, message = 'Request aborted by client'): void {
    if (this.isRequestAborted(request)) {
      const error = new Error(message)
      error.name = 'RequestAbortedError'
      throw error
    }
  }
}
