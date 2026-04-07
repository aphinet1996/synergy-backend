import User from '@models/user.model';
import Position from '@models/position.model';
import {
    IUserDoc,
    CreateUserBody,
    UpdateUserBody,
    UserListResponseDTO,
    UserDetailResponseDTO,
} from '@interfaces/user.interface';
import { CreateUserDTO, UpdateUserDTO, ListUserQueryDTO } from '@validations/user.validation';
import {
    NotFoundException,
    ConflictException,
    ForbiddenException,
    BadRequestException,
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import mongoose, { FilterQuery } from 'mongoose';

export class UserService {

    async createUser(data: CreateUserDTO, createdBy: string): Promise<IUserDoc> {
        const { firstname, lastname, positionId, ...rest } = data;

        const existingUser = await User.isUserExist(firstname, lastname);
        if (existingUser) {
            throw new ConflictException('User already exists with this name');
        }

        // Validate position if provided
        if (positionId) {
            const position = await Position.findById(positionId);
            if (!position || !position.isActive) {
                throw new BadRequestException('Invalid or inactive position');
            }
        }

        let username = `${firstname.toLowerCase().trim()}.${lastname.toLowerCase().trim().slice(0, 3)}`;
        const defaultPassword = 'synergy123';

        const newUser: CreateUserBody = {
            ...rest,
            firstname,
            lastname,
            username,
            password: defaultPassword,
            positionId: positionId ? new mongoose.Types.ObjectId(positionId) : undefined,
            createdBy: new mongoose.Types.ObjectId(createdBy),
            employeeDateStart: rest.employeeDateStart || new Date(),
        };

        const user = await User.create(newUser);
        logger.info(`User created: ${user.username} by ${createdBy}`);

        // Return with populated position
        return user.populate('positionId', 'name');
    }

    async getUserById(id: string): Promise<UserDetailResponseDTO> {
        this.validateObjectId(id);

        const user = await User.findById(id)
            .select('-password -refreshToken')
            .populate('positionId', 'name');

        if (!user) {
            throw new NotFoundException('User not found');
        }

        return this.transformToDetailDTO(user);
    }

    async listUsers(
        query: ListUserQueryDTO,
        currentUserId?: string
    ): Promise<{
        users: UserListResponseDTO[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
    }> {
        const { search, role, positionId, isActive, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter = this.buildUserFilter({ search, role, positionId, isActive }, currentUserId);

        const [users, total] = await Promise.all([
            User.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('_id username profile firstname lastname nickname positionId role isActive')
                .populate('positionId', 'name')
                .lean(),
            User.countDocuments(filter),
        ]);

        // Transform to DTO
        const transformedUsers: UserListResponseDTO[] = users.map(user => this.transformToListDTO(user));

        return {
            users: transformedUsers,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async updateUser(
        id: string,
        data: UpdateUserDTO,
        updatedBy: string,
        currentUserRole: string
    ): Promise<UserDetailResponseDTO> {
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

        // Validate position if provided
        if (data.positionId) {
            const position = await Position.findById(data.positionId);
            if (!position || !position.isActive) {
                throw new BadRequestException('Invalid or inactive position');
            }
        }

        // Handle password update if provided
        if (data.password) {
            await this.handlePasswordUpdate(user, data.password);
            delete data.password;
            delete (data as any).confirmPassword;
        }

        // Prepare update data
        const { positionId, ...restData } = data;
        const updateData: Partial<UpdateUserBody> = {
            ...restData,
            updatedBy: new mongoose.Types.ObjectId(updatedBy),
        };

        if (positionId !== undefined) {
            updateData.positionId = positionId
                ? new mongoose.Types.ObjectId(positionId)
                : undefined;
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        )
            .select('-password -refreshToken -salary')
            .populate('positionId', 'name');

        if (!updatedUser) {
            throw new NotFoundException('User update failed');
        }

        logger.info(`User updated: ${user.username} by ${updatedBy}`);
        return this.transformToDetailDTO(updatedUser);
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

    // Private Helpers

    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid user ID');
        }
    }

    private buildUserFilter(
        params: { search?: string; role?: string; positionId?: string; isActive?: boolean },
        currentUserId?: string
    ): FilterQuery<IUserDoc> {
        const { search, role, positionId, isActive } = params;
        const filter: FilterQuery<IUserDoc> = {};

        if (search) {
            filter.$or = [
                { username: { $regex: search, $options: 'i' } },
                { firstname: { $regex: search, $options: 'i' } },
                { lastname: { $regex: search, $options: 'i' } },
                { nickname: { $regex: search, $options: 'i' } },
            ];
        }
        if (role) filter.role = role;
        if (positionId) filter.positionId = new mongoose.Types.ObjectId(positionId);
        if (isActive !== undefined) filter.isActive = isActive;

        return filter;
    }

    private async handlePasswordUpdate(user: IUserDoc, newPassword: string): Promise<void> {
        const isPasswordSame = await user.comparePassword(newPassword);
        if (isPasswordSame) {
            throw new ConflictException('New password cannot be the same as current');
        }
        user.password = newPassword;
    }

    private transformToListDTO(user: any): UserListResponseDTO {
        const position = user.positionId as any;
        return {
            id: user._id.toString(),
            username: user.username,
            profile: user.profile,
            firstname: user.firstname,
            lastname: user.lastname,
            nickname: user.nickname,
            position: position ? {
                id: position._id?.toString() || position.toString(),
                name: position.name || '',
            } : undefined,
            role: user.role,
            isActive: user.isActive,
        };
    }

    private transformToDetailDTO(user: any): UserDetailResponseDTO {
        const position = user.positionId as any;
        return {
            id: user._id.toString(),
            username: user.username,
            profile: user.profile,
            firstname: user.firstname,
            lastname: user.lastname,
            nickname: user.nickname,
            lineUserId: user.lineUserId,
            tel: user.tel,
            address: user.address,
            birthDate: user.birthDate?.toISOString(),
            position: position ? {
                id: position._id?.toString() || position.toString(),
                name: position.name || '',
            } : undefined,
            salary: user.salary,
            contract: user.contract,
            contractDateStart: user.contractDateStart?.toISOString(),
            contractDateEnd: user.contractDateEnd?.toISOString(),
            employeeType: user.employeeType,
            employeeDateStart: user.employeeDateStart?.toISOString() || '',
            employeeStatus: user.employeeStatus,
            role: user.role,
            isActive: user.isActive,
            lastLogin: user.lastLogin?.toISOString(),
            createdAt: user.createdAt?.toISOString() || '',
            updatedAt: user.updatedAt?.toISOString(),
        };
    }
}

export default UserService;