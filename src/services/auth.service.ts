import jwt from 'jsonwebtoken';
import User from '@models/user.model';
import { IUserDoc } from '@/interfaces/user.interface';
import {
    RegisterDTO,
    LoginDTO,
    RefreshTokenDTO,
    ChangePasswordDTO,
    ForgotPasswordDTO,
    ResetPasswordDTO,
    UpdateProfileDTO
} from '@validations/auth.validation';
import {
    JWT_SECRET,
    JWT_REFRESH_SECRET,
    JWT_EXPIRE,
    JWT_REFRESH_EXPIRE
} from '@config/index';
import {
    HttpException,
    UnauthorizedException,
    ConflictException,
    NotFoundException
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

export interface TokenPayload {
    userId: string;
    username: string;
    role: string;
}

export interface DecodedToken extends TokenPayload {
    iat: number;
    exp: number;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export class AuthService {
    // Register new user (use Zod DTO)
    async register(data: RegisterDTO): Promise<{ user: IUserDoc; tokens: AuthTokens }> {
        const { username, password, firstName, lastName, role } = data;

        const existingUser = await User.findOne({ username }).lean();
        if (existingUser) {
            throw new ConflictException('Username already registered');
        }

        const user = await User.create({
            username,
            password,
            firstname: firstName,
            lastname: lastName,
            role: role || 'employee'
        });

        const tokens = this.generateTokens(user);

        user.refreshToken = tokens.refreshToken;
        user.lastLogin = new Date();
        await user.save();

        logger.info(`New user registered: ${user.username}`);

        return { user, tokens };
    }

    // Login user
    async login(data: LoginDTO): Promise<{ user: IUserDoc; tokens: AuthTokens }> {
        const { username, password } = data;

        const user = await User.findOne({ username }).select('+password +refreshToken').exec();

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is deactivated');
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const tokens = this.generateTokens(user);

        user.refreshToken = tokens.refreshToken;
        user.lastLogin = new Date();
        await user.save();

        logger.info(`User logged in: ${user.username}`);

        return { user, tokens };
    }

    // Refresh tokens
    async refreshTokens(data: RefreshTokenDTO): Promise<AuthTokens> {
        const { refreshToken } = data;

        const decoded = this.verifyRefreshToken(refreshToken);

        const user = await User.findOne({
            _id: decoded.userId,
            refreshToken
        }).select('+refreshToken');

        if (!user) {
            throw new UnauthorizedException('Invalid refresh token');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is deactivated');
        }

        const tokens = this.generateTokens(user);

        user.refreshToken = tokens.refreshToken;
        await user.save();

        logger.info(`Tokens refreshed for user: ${user.username}`);

        return tokens;
    }

    // Logout user
    async logout(userId: string): Promise<void> {
        const user = await User.findById(userId).select('+refreshToken');

        if (user) {
            user.refreshToken = undefined;
            await user.save();
            logger.info(`User logged out: ${user.username}`);
        }
    }

    // Verify user by token
    async verifyUserByToken(token: string): Promise<IUserDoc> {
        const decoded = this.verifyAccessToken(token);

        const user = await User.findById(decoded.userId)
            .select('-password -refreshToken')
        // .populate('clinics', 'nameEn nameTh status');

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is deactivated');
        }

        return user;
    }

    // Change password
    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthTokens> {
        const user = await User.findById(userId).select('+password');

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect');
        }

        user.password = newPassword;
        await user.save();

        const tokens = this.generateTokens(user);

        logger.info(`Password changed for user: ${user.username}`);

        return tokens;
    }

    // Request password reset (use DTO)
    async requestPasswordReset(username: string): Promise<string | null> {
        const user = await User.findOne({username}).lean();

        if (!user) {
            return null;
        }

        const resetToken = this.generateResetPasswordToken(user.username);

        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = new Date(Date.now() + 3600000);
        await user.save();

        logger.info(`Password reset requested: ${username}`);

        return resetToken;
    }

    // Reset password (use DTO)
    async resetPassword(token: string, newPassword: string): Promise<void> {
        const decoded = this.verifyResetPasswordToken(token);

        const user = await User.findByResetToken(token);

        if (!user) {
            throw new UnauthorizedException('Invalid or expired reset token');
        }

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        logger.info(`Password reset completed: ${user.username}`);
    }

    // Update user profile (use DTO)
    async updateProfile(userId: string, data: UpdateProfileDTO): Promise<IUserDoc> {
        const allowedUpdates = ['firstname', 'lastname', 'avatar'];
        const updates: any = {};

        for (const key of allowedUpdates) {
            if (data[key as keyof UpdateProfileDTO] !== undefined) {
                updates[key] = data[key as keyof UpdateProfileDTO];
            }
        }

        const user = await User.findByIdAndUpdate(
            userId,
            updates,
            { new: true, runValidators: true }
        );

        if (!user) {
            throw new NotFoundException('User not found');
        }

        logger.info(`Profile updated: ${user.username}`);

        return user;
    }

    // Get user by ID
    async getUserById(userId: string): Promise<IUserDoc> {
        const user = await User.findById(userId)

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    // Token generation (fixed expiry, no param)
    private generateTokens(user: IUserDoc): AuthTokens {
        const payload: TokenPayload = {
            userId: user._id.toString(),
            username: user.username,
            role: user.role
        };

        if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
            throw new Error('JWT secrets not configured. Check environment variables.');
        }

        const accessToken = jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRE
        });

        const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
            expiresIn: JWT_REFRESH_EXPIRE
        });

        return { accessToken, refreshToken };
    }

    // Verify access token
    verifyAccessToken(token: string): DecodedToken {
        try {
            return jwt.verify(token, JWT_SECRET) as DecodedToken;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new UnauthorizedException('Access token has expired');
            }
            if (error instanceof jwt.JsonWebTokenError) {
                throw new UnauthorizedException('Invalid access token');
            }
            throw error;
        }
    }

    // Verify refresh token
    private verifyRefreshToken(token: string): DecodedToken {
        try {
            return jwt.verify(token, JWT_REFRESH_SECRET) as DecodedToken;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new UnauthorizedException('Refresh token has expired');
            }
            if (error instanceof jwt.JsonWebTokenError) {
                throw new UnauthorizedException('Invalid refresh token');
            }
            throw error;
        }
    }

    // Generate reset password token
    private generateResetPasswordToken(username: string): string {
        return jwt.sign({ username }, JWT_SECRET, {
            expiresIn: '1h'
        });
    }

    // Verify reset password token
    private verifyResetPasswordToken(token: string): { username: string } {
        try {
            return jwt.verify(token, JWT_SECRET) as { username: string };
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new UnauthorizedException('Reset password token has expired');
            }
            if (error instanceof jwt.JsonWebTokenError) {
                throw new UnauthorizedException('Invalid reset password token');
            }
            throw error;
        }
    }

    // Extract token from header
    extractTokenFromHeader(authHeader?: string): string | null {
        if (!authHeader) return null;

        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
            return parts[1];
        }

        return null;
    }
}

export default AuthService;