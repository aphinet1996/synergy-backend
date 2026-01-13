import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@services/auth.service';
import { IUser, UserRole } from '@interfaces/user.interface';
import { UnauthorizedException, ForbiddenException } from '@exceptions/HttpExcetion';

export interface AuthRequest extends Request {
    user?: IUser;
    userId?: string;
    token?: string;
    role?: UserRole;
}

const authService = new AuthService();

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const token = authService.extractTokenFromHeader(authHeader);

        if (!token) {
            throw new UnauthorizedException('Authentication token is required');
        }

        // Verify user using auth service
        const user = await authService.verifyUserByToken(token);

        // Attach user to request
        req.user = user;
        req.userId = user._id.toString();
        req.token = token;
        req.role = user.role;

        next();
    } catch (error: any) {
        if (error instanceof UnauthorizedException) {
            next(error);
        } else if (error.message.includes('expired')) {
            next(new UnauthorizedException('Token has expired'));
        } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
            next(new UnauthorizedException('Invalid token'));
        } else {
            next(new UnauthorizedException('Authentication failed'));
        }
    }
};

export const authorize = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new UnauthorizedException('Authentication required'));
        }

        if (!roles.includes(req.user.role)) {
            return next(new ForbiddenException('Insufficient permissions'));
        }

        next();
    };
};

export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const token = authService.extractTokenFromHeader(authHeader);

        if (!token) {
            return next();
        }

        const decoded = authService.verifyAccessToken(token);
        const user = await authService.getUserById(decoded.userId);

        if (user && user.isActive) {
            req.user = user;
            req.userId = user._id.toString();
            req.token = token;
        }

        next();
    } catch (error) {
        // Token is invalid but continue anyway since auth is optional
        next();
    }
};