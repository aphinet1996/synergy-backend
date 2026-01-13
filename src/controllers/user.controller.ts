import { Request, Response, NextFunction } from 'express';
import { UserService } from '@services/user.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { validateObjectId } from '@/middlewares/validation.middleware';
import { asyncHandler } from '@middlewares/error.middleware';

// Extend AuthRequest
interface UserRequest extends AuthRequest {
    params: { id: string };
}

const userService = new UserService();

export class UserController {
    // Get all users (protected: admin/manager) - now pure function
    public getUsers = asyncHandler(async (req: UserRequest, res: Response) => {
        const { users, pagination } = await userService.listUsers(
            req.query as any,
            req.userId
        );
        res.status(200).json({
            status: 'success',
            results: users.length,
            pagination,
            data: { users },
        });
    });

    // Get single user by ID (protected) - now pure function
    public getUser = asyncHandler(async (req: UserRequest, res: Response) => {
        const user = await userService.getUserById(req.params.id);
        res.status(200).json({
            status: 'success',
            data: { user },
        });
    });

    // Get current user (/me) - new method for /me route
    public getMe = asyncHandler(async (req: UserRequest, res: Response) => {
        const user = await userService.getUserById(req.userId!);
        res.status(200).json({
            status: 'success',
            data: { user },
        });
    });

    // Create user (protected: admin/manager) - now pure function
    public createUser = asyncHandler(async (req: UserRequest, res: Response) => {
        const user = await userService.createUser(req.body, req.userId!);
        res.status(201).json({
            status: 'success',
            message: 'User created successfully',
            data: { user },
        });
    });

    // Update user (protected: admin/manager or self) - now pure function
    public updateUser = asyncHandler(async (req: UserRequest, res: Response) => {
        // Service handles self vs others restrictions
        const user = await userService.updateUser(
            req.params.id,
            req.body,
            req.userId!,
            req.user!.role // Pass current role to service
        );
        res.status(200).json({
            status: 'success',
            message: 'User updated successfully',
            data: { user },
        });
    });

    // Delete user (protected: admin) - now pure function
    public deleteUser = asyncHandler(async (req: UserRequest, res: Response) => {
        await userService.deleteUser(req.params.id, req.userId!);
        res.status(204).json({
            status: 'success',
            message: 'User deleted successfully',
        });
    });
}

export default new UserController();