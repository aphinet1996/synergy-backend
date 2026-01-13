import Position from '@models/position.model';
import {
    IPositionDoc,
    CreatePositionBody,
    UpdatePositionBody,
    PositionListResponseDTO,
} from '@interfaces/position.interface';
import { CreatePositionDTO, UpdatePositionDTO, ListPositionQueryDTO } from '@validations/position.validation';
import {
    NotFoundException,
    BadRequestException,
    ConflictException,
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import mongoose, { FilterQuery } from 'mongoose';

export class PositionService {

    async createPosition(data: CreatePositionDTO, createdBy: string): Promise<IPositionDoc> {
        // Check if position name already exists
        const existingPosition = await Position.isPositionExist(data.name);
        if (existingPosition) {
            throw new ConflictException('Position name already exists');
        }

        const positionInput: CreatePositionBody = {
            name: data.name,
            description: data.description,
            createdBy: new mongoose.Types.ObjectId(createdBy),
        };

        const position = await Position.create(positionInput);
        logger.info(`Position created: ${position.name} by ${createdBy}`);
        return position;
    }

    async getPositionById(id: string): Promise<IPositionDoc> {
        const position = await Position.findById(id)
            .populate('createdBy', 'firstname lastname')
            .populate('updatedBy', 'firstname lastname');

        if (!position) {
            throw new NotFoundException('Position not found');
        }
        return position;
    }

    async listPositions(
        query: ListPositionQueryDTO
    ): Promise<{ positions: PositionListResponseDTO[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }> {
        const { search, isActive, page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;

        let filter: FilterQuery<IPositionDoc> = {};

        // Apply filters
        if (isActive !== undefined) filter.isActive = isActive;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        const [positions, total] = await Promise.all([
            Position.find(filter)
                .sort({ name: 1 })
                .skip(skip)
                .limit(limit)
                .populate('createdBy', 'firstname lastname')
                .populate('updatedBy', 'firstname lastname'),
            Position.countDocuments(filter),
        ]);

        // Transform to DTO
        const transformedPositions: PositionListResponseDTO[] = positions.map(position => {
            const creator = position.createdBy as any;
            const updater = position.updatedBy as any;

            return {
                id: position._id.toString(),
                name: position.name,
                description: position.description,
                isActive: position.isActive,
                createdAt: position.createdAt?.toISOString() || '',
                updatedAt: position.updatedAt?.toISOString(),
                createdBy: creator?.firstname && creator?.lastname
                    ? `${creator.firstname} ${creator.lastname}`
                    : '',
                updatedBy: updater?.firstname && updater?.lastname
                    ? `${updater.firstname} ${updater.lastname}`
                    : undefined,
            };
        });

        return {
            positions: transformedPositions,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getActivePositions(): Promise<IPositionDoc[]> {
        return Position.findActivePositions();
    }

    async updatePosition(id: string, data: UpdatePositionDTO, userId: string): Promise<IPositionDoc> {
        const positionObjId = new mongoose.Types.ObjectId(id);
        const userObjId = new mongoose.Types.ObjectId(userId);

        const existingPosition = await Position.findById(positionObjId);
        if (!existingPosition) {
            throw new NotFoundException('Position not found');
        }

        // Check for duplicate name (if name is being changed)
        if (data.name && data.name !== existingPosition.name) {
            const duplicateName = await Position.isPositionExist(data.name);
            if (duplicateName) {
                throw new ConflictException('Position name already exists');
            }
        }

        const updateData: Partial<UpdatePositionBody> = {
            ...data,
            updatedBy: userObjId,
        };

        const updatedPosition = await Position.findByIdAndUpdate(
            positionObjId,
            { $set: updateData },
            { new: true, runValidators: true }
        )
            .populate('createdBy', 'firstname lastname')
            .populate('updatedBy', 'firstname lastname');

        if (!updatedPosition) {
            throw new BadRequestException('Failed to update position');
        }

        logger.info(`Position updated: ${updatedPosition.name} by ${userId}`);
        return updatedPosition;
    }

    async togglePositionStatus(id: string, userId: string): Promise<IPositionDoc> {
        const positionObjId = new mongoose.Types.ObjectId(id);
        const userObjId = new mongoose.Types.ObjectId(userId);

        const position = await Position.findById(positionObjId);
        if (!position) {
            throw new NotFoundException('Position not found');
        }

        position.isActive = !position.isActive;
        position.updatedBy = userObjId;
        await position.save();

        const updatedPosition = await Position.findById(positionObjId)
            .populate('createdBy', 'firstname lastname')
            .populate('updatedBy', 'firstname lastname');

        logger.info(`Position toggled: ${position.name} to ${position.isActive ? 'active' : 'inactive'} by ${userId}`);
        return updatedPosition!;
    }

    async deletePosition(id: string, deletedBy: string): Promise<boolean> {
        const position = await Position.findById(id);
        if (!position) {
            throw new NotFoundException('Position not found');
        }

        // Soft delete - set isActive to false
        position.isActive = false;
        position.updatedBy = new mongoose.Types.ObjectId(deletedBy);
        await position.save();

        logger.info(`Position soft-deleted: ${position.name} by ${deletedBy}`);
        return true;
    }

    async hardDeletePosition(id: string, deletedBy: string): Promise<boolean> {
        const position = await Position.findById(id);
        if (!position) {
            throw new NotFoundException('Position not found');
        }

        await Position.findByIdAndDelete(id);
        logger.info(`Position hard-deleted: ${position.name} by ${deletedBy}`);
        return true;
    }
}

export default PositionService;