import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/** The one error shape every non-2xx JSON response uses. */
export class ApiError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function sendError(c: Context, err: ApiError) {
  return c.json(
    { error: { code: err.code, message: err.message, ...err.extra } },
    err.status,
  );
}

export const notLoggedIn = () => new ApiError(401, 'not_logged_in', 'You need to log in first.');
export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message);
export const validationFailed = (message: string, fields?: Record<string, string>) =>
  new ApiError(400, 'validation_failed', message, fields ? { fields } : undefined);
export const rateLimited = () => new ApiError(429, 'rate_limited', 'Too many requests. Try again later.');
export const fileTooLarge = (message = 'File is too large.') => new ApiError(413, 'file_too_large', message);
export const unsupportedFileType = (message = 'That file type is not supported.') =>
  new ApiError(415, 'unsupported_file_type', message);
