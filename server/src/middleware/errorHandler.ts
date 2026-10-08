import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof ZodError || err.name === 'ZodError') {
    const zodErr = err as ZodError;
    const message = zodErr.errors
      ? zodErr.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      : err.message;
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Validation error: ${message}`,
      },
    });
    return;
  }

  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const code = isAppError ? err.code : 'INTERNAL_SERVER_ERROR';

  // Log unexpected errors
  if (!isAppError || statusCode >= 500) {
    logger.error({ err }, `Unhandled error: ${err.message}`);
  }

  // Never leak sensitive internals in production for unexpected errors
  const message =
    isAppError || env.NODE_ENV !== 'production'
      ? err.message
      : 'An unexpected internal error occurred';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(isAppError && (err as AppError).details !== undefined && { details: (err as AppError).details }),
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};
