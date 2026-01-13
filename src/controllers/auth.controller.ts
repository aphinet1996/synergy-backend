import { Request, Response, NextFunction } from 'express';
import { AuthService } from '@services/auth.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@middlewares/error.middleware';

const authService = new AuthService();

export class AuthController {
    // Register new user
    public register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { user, tokens } = await authService.register(req.body);

        res.status(201).json({
            status: 'success',
            message: 'Registration successful',
            data: {
                user: user.toJSON(),
                tokens
            }
        });
    });

    // Login user 
    public login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { user, tokens } = await authService.login(req.body);

        res.status(200).json({
            status: 'success',
            message: 'Login successful',
            data: {
                user: user.toJSON(),
                tokens
            }
        });
    });

    // Refresh access token
    public refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { refreshToken } = req.body;
        const tokens = await authService.refreshTokens(refreshToken);

        res.status(200).json({
            status: 'success',
            message: 'Token refreshed successfully',
            data: { tokens }
        });
    });

    // Logout user
    public logout = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        await authService.logout(req.userId!);

        res.status(200).json({
            status: 'success',
            message: 'Logged successfully'
        });
    });

    // Get current user
    public getMe = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const user = await authService.getUserById(req.userId!);

        res.status(200).json({
            status: 'success',
            data: { user }
        });
    });

    // Update profile
    public updateProfile = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const user = await authService.updateProfile(req.userId!, req.body);

        res.status(200).json({
            status: 'success',
            message: 'Profile updated successfully',
            data: { user }
        });
    });

    // Change password
    public changePassword = asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
        const { currentPassword, newPassword } = req.body;
        const tokens = await authService.changePassword(req.userId!, currentPassword, newPassword);

        res.status(200).json({
            status: 'success',
            message: 'Password changed successfully',
            data: { tokens }
        });
    });

    // Request password reset *send via line (In progress)
    public forgotPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { username } = req.body;
        const resetToken = await authService.requestPasswordReset(username);

        const responseData: any = {
            status: 'success',
            message: 'If the username exists, a password reset instruction has been prepared'
        };

        if (process.env.NODE_ENV === 'development' && resetToken) {
            responseData.resetToken = resetToken;
        }

        res.status(200).json(responseData);
    });

    // Reset password
    public resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        const { token, newPassword } = req.body;
        await authService.resetPassword(token, newPassword);

        res.status(200).json({
            status: 'success',
            message: 'Password reset successfully'
        });
    });
}

export default new AuthController();