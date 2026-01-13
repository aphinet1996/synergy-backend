import User from '@models/user.model';
import { IUserDoc, CreateUserBody, UpdateUserBody } from '@interfaces/user.interface';
import { CreateUserDTO, UpdateUserDTO, ListUserQueryDTO } from '@validations/user.validation';
import {
    NotFoundException,
    ConflictException,
    ForbiddenException
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import mongoose, { FilterQuery } from 'mongoose';

export class UserService {

    async createUser(data: CreateUserDTO, createdBy: string): Promise<IUserDoc> {
        const { firstname, lastname, ...rest } = data;

        const existingUser = await User.isUserExist(firstname, lastname);
        if (existingUser) {
            throw new ConflictException('Username already exists');
        }

        // this.validateRolePermission('create', data.role, createdBy);

        let username = `${firstname.toLowerCase().trim()}.${lastname.toLowerCase().trim().slice(0, 3)}`;
        const defaultPassword = 'synergy123';
        const newUser: CreateUserBody = {
            ...rest,
            firstname,
            lastname,
            username,
            password: defaultPassword,
            createdBy: new mongoose.Types.ObjectId(createdBy),
            employeeDateStart: rest.employeeDateStart || new Date(),
        };

        const user = await User.create(newUser);
        logger.info(`User created: ${user.username} by ${createdBy}`);
        return user;
    }

    async getUserById(id: string): Promise<IUserDoc> {
        this.validateObjectId(id);

        const user = await User.findById(id).select('-password -refreshToken');
        if (!user) {
            throw new NotFoundException('User not found');
        }

        return user;
    }

    async listUsers(query: ListUserQueryDTO, currentUserId?: string): Promise<{ users: IUserDoc[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }> {
        const { search, role, isActive, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        // Build MongoDB filter query
        const filter = this.buildUserFilter({ search, role, isActive }, currentUserId);

        const [users, total] = await Promise.all([
            User.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                // .select('-password -refreshToken -salary')
                .select('_id username profile firstname lastname nickname position role')
                .lean<IUserDoc[]>(),
            User.countDocuments(filter),
        ]);

        return {
            users,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async updateUser(id: string, data: UpdateUserDTO, updatedBy: string, currentUserRole: string): Promise<IUserDoc> {
        this.validateObjectId(id);

        const user = await User.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Handle self-role elevation restrictions
        if (id === updatedBy && data.role && data.role !== user.role) {
            if (currentUserRole !== 'admin' && data.role === 'admin') {
                throw new ForbiddenException('Cannot elevate own role');
            }
        }

        // Validate role assignment permissions
        if (data.role === 'admin' && currentUserRole !== 'admin') {
            throw new ForbiddenException('Only admin can assign admin role');
        }

        // Handle password update if provided
        if (data.password) {
            await this.handlePasswordUpdate(user, data.password);
            delete data.password;
            delete (data as any).confirmPassword; // Safe delete assuming DTO has it
        }

        const updateData: UpdateUserBody = {
            ...data,
            updatedBy: new mongoose.Types.ObjectId(updatedBy),
        };

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select('-password -refreshToken -salary');

        if (!updatedUser) {
            throw new NotFoundException('User update failed');
        }

        logger.info(`User updated: ${user.username} by ${updatedBy}`);
        return updatedUser;
    }

    async deleteUser(id: string, deletedBy: string): Promise<boolean> {
        this.validateObjectId(id);

        const user = await User.findById(id);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (id === deletedBy) {
            throw new ForbiddenException('Cannot delete own account');
        }

        user.isActive = false;
        user.updatedBy = new mongoose.Types.ObjectId(deletedBy);
        await user.save();

        logger.info(`User soft-deleted: ${user.username} by ${deletedBy}`);
        return true;
    }

    // Private helper methods
    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid user ID');
        }
    }

    private validateRolePermission(action: 'create' | 'update', role: string | undefined): void {
        if (role === 'admin') {
            const actionVerb = action === 'create' ? 'create' : 'assign';
            throw new ForbiddenException(`Only super admin can ${actionVerb} admin users`);
        }
    }

    private buildUserFilter(
        params: { search?: string; role?: string; isActive?: boolean },
        currentUserId?: string
    ): FilterQuery<IUserDoc> {
        const { search, role, isActive } = params;
        const filter: FilterQuery<IUserDoc> = {};

        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { firstname: { $regex: search, $options: 'i' } },
                { lastname: { $regex: search, $options: 'i' } },
            ];
        }
        if (role) filter.role = role;
        if (isActive !== undefined) filter.isActive = isActive;

        // Exclude current user if not admin query
        if (currentUserId && !role?.includes('admin')) {
            filter._id = { ...filter._id, $ne: new mongoose.Types.ObjectId(currentUserId) };
        }

        return filter;
    }

    private async handlePasswordUpdate(user: IUserDoc, newPassword: string): Promise<void> {
        const isPasswordSame = await user.comparePassword(newPassword);
        if (isPasswordSame) {
            throw new ConflictException('New password cannot be the same as current');
        }
        user.password = newPassword;
    }
}

export default UserService;