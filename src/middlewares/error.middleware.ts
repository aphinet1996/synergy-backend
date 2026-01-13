import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { logger } from '@utils/logger';
import { NODE_ENV } from '@/config/index';

interface MongoDBError extends Error {
  code?: number;
  keyValue?: Record<string, any>;
}

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;
  code?: number;
  path?: string;
  keyValue?: Record<string, any>;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const handleCastErrorDB = (err: mongoose.Error.CastError) => {
  const message = `ข้อมูลไม่ถูกต้อง1: ${err.path} (${err.value})`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err: MongoDBError) => {
  const value = err.keyValue ? Object.values(err.keyValue)[0] : '';
  const message = `มีข้อมูลซ้ำกัน: ${value}. กรุณาใช้ค่าอื่น`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err: mongoose.Error.ValidationError) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `ข้อมูลไม่ถูกต้อง2: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Token ไม่ถูกต้อง กรุณาเข้าสู่ระบบอีกครั้ง', 401);

const handleJWTExpiredError = () => new AppError('Token หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง', 401);

const sendErrorDev = (err: AppError, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    // stack: err.stack,
  });
};

// Production error response - less details for security
const sendErrorProd = (err: AppError, res: Response) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
  // Programming or unknown error: don't leak error details
  else {
    // Log error for developers
    logger.error('ERROR', err);

    // Send generic message
    res.status(500).json({
      status: 'error',
      message: 'มีบางอย่างผิดพลาด',
    });
  }
};

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let error = err as AppError;
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  logger.error(`${req.method} ${req.path} - ${err.message}`, {
    stack: err.stack,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Handle specific errors
  if (err instanceof mongoose.Error.CastError) error = handleCastErrorDB(err);

  const mongoErr = err as MongoDBError;
  if (mongoErr.code === 11000) error = handleDuplicateFieldsDB(mongoErr);

  if (err instanceof mongoose.Error.ValidationError) error = handleValidationErrorDB(err);
  if (err instanceof JsonWebTokenError) error = handleJWTError();
  if (err instanceof TokenExpiredError) error = handleJWTExpiredError();

  // Send error response based on environment
  if (NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// 404 Error for routes that don't exist
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorMiddleware;