export class HttpException extends Error {
  public status: number;
  public message: string;
  public data?: any;

  constructor(status: number, message: string, data?: any) {
      super(message);
      this.status = status;
      this.message = message;
      this.data = data;

      Error.captureStackTrace(this, this.constructor);
  }
}

// Common HTTP exceptions
export class BadRequestException extends HttpException {
  constructor(message: string = 'Bad Request', data?: any) {
      super(400, message, data);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message: string = 'Unauthorized', data?: any) {
      super(401, message, data);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string = 'Forbidden', data?: any) {
      super(403, message, data);
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string = 'Not Found', data?: any) {
      super(404, message, data);
  }
}

export class ConflictException extends HttpException {
  constructor(message: string = 'Conflict', data?: any) {
      super(409, message, data);
  }
}

export class ValidationException extends HttpException {
  constructor(message: string = 'Validation Failed', data?: any) {
      super(422, message, data);
  }
}

export class InternalServerException extends HttpException {
  constructor(message: string = 'Internal Server Error', data?: any) {
      super(500, message, data);
  }
}
