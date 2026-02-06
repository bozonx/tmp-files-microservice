export interface AbortableRequest {
  raw?: {
    aborted?: boolean
    destroyed?: boolean
    complete?: boolean
    on?: (event: string, handler: () => void) => void
    removeListener?: (event: string, handler: () => void) => void
  }
}

/**
 * Utility class for handling client request disconnections
 */
export class RequestUtil {
  /**
   * Check if the client has aborted the request
   */
  public static isRequestAborted(request: AbortableRequest): boolean {
    const raw = request.raw
    if (!raw) return false

    if (raw.aborted === true) return true

    // `destroyed` can be true for normal request lifecycle; treat it as abort only when request is incomplete.
    return raw.destroyed === true && raw.complete === false
  }

  /**
   * Register a callback to be called when the client aborts the request
   * Returns a cleanup function to remove the listener
   */
  public static onRequestAborted(request: AbortableRequest, callback: () => void): () => void {
    if (!request.raw) {
      // If no raw request, return no-op cleanup
      return (): void => {}
    }

    const abortHandler = (): void => {
      callback()
    }

    const closeHandler = (): void => {
      const raw = request.raw as unknown as { complete?: boolean } | undefined
      if (raw?.complete === false) {
        callback()
      }
    }

    request.raw.on?.('aborted', abortHandler)
    request.raw.on?.('close', closeHandler)

    // Return cleanup function
    return (): void => {
      request.raw?.removeListener?.('aborted', abortHandler)
      request.raw?.removeListener?.('close', closeHandler)
    }
  }

  /**
   * Create an AbortController that aborts when the request is aborted
   * Useful for integrating with APIs that support AbortSignal
   */
  public static createAbortController(request: AbortableRequest): AbortController {
    const controller = new AbortController()

    if (request.raw) {
      const abortHandler = (): void => {
        if (!controller.signal.aborted) {
          controller.abort()
        }
      }

      const closeHandler = (): void => {
        const raw = request.raw as unknown as { complete?: boolean } | undefined
        if (raw?.complete === false) {
          abortHandler()
        }
      }

      request.raw.on?.('aborted', abortHandler)
      request.raw.on?.('close', closeHandler)

      // Cleanup when signal is aborted
      controller.signal.addEventListener('abort', () => {
        request.raw?.removeListener?.('aborted', abortHandler)
        request.raw?.removeListener?.('close', closeHandler)
      })
    }

    return controller
  }

  /**
   * Throw an error if the request has been aborted
   */
  public static throwIfAborted(
    request: AbortableRequest,
    message = 'Request aborted by client'
  ): void {
    if (this.isRequestAborted(request)) {
      const error = new Error(message)
      error.name = 'RequestAbortedError'
      throw error
    }
  }
}
