import mongoose from 'mongoose';
import Holiday from '../models/holiday.model';
import { IHolidayDoc } from '../interfaces/holiday.interface';
import { CreateHolidayDTO, UpdateHolidayDTO, BulkHolidayDTO } from '../validations/leave.validation';
import { NotFoundException, ConflictException } from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

export class HolidayService {
    /**
     * Create a new holiday
     */
    async create(data: CreateHolidayDTO, createdBy: string): Promise<IHolidayDoc> {
        const year = data.date.getFullYear();
        
        // Check if holiday exists on the same date
        const startOfDay = new Date(data.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(data.date);
        endOfDay.setHours(23, 59, 59, 999);

        const existing = await Holiday.findOne({
            date: { $gte: startOfDay, $lte: endOfDay },
            isActive: true,
        });

        if (existing) {
            throw new ConflictException(`Holiday already exists on this date: ${existing.name}`);
        }

        const holiday = await Holiday.create({
            ...data,
            year,
            createdBy: new mongoose.Types.ObjectId(createdBy),
        });

        logger.info(`Holiday created: ${holiday.name} (${data.date}) by ${createdBy}`);
        return holiday;
    }

    /**
     * Bulk import holidays
     */
    async bulkImport(data: BulkHolidayDTO, createdBy: string): Promise<{ created: number; skipped: number }> {
        let created = 0;
        let skipped = 0;

        for (const holidayData of data.holidays) {
            const date = new Date(holidayData.date);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const existing = await Holiday.findOne({
                date: { $gte: startOfDay, $lte: endOfDay },
                isActive: true,
            });

            if (existing) {
                skipped++;
                continue;
            }

            await Holiday.create({
                name: holidayData.name,
                date,
                description: holidayData.description,
                year: data.year,
                isPublished: data.publish || false,
                createdBy: new mongoose.Types.ObjectId(createdBy),
            });
            created++;
        }

        logger.info(`Bulk imported holidays: ${created} created, ${skipped} skipped by ${createdBy}`);
        return { created, skipped };
    }

    /**
     * Get holidays by year
     */
    async findByYear(year: number, publishedOnly: boolean = false): Promise<IHolidayDoc[]> {
        if (publishedOnly) {
            return Holiday.findPublishedByYear(year);
        }
        return Holiday.findByYear(year);
    }

    /**
     * Get all holidays with pagination
     */
    async findAll(
        query: { year?: number; published?: boolean; page?: number; limit?: number }
    ): Promise<{ holidays: IHolidayDoc[]; pagination: any }> {
        const { year, published, page = 1, limit = 50 } = query;
        const skip = (page - 1) * limit;

        const filter: any = { isActive: true };
        if (year) filter.year = year;
        if (published !== undefined) filter.isPublished = published;

        const [holidays, total] = await Promise.all([
            Holiday.find(filter)
                .sort({ date: 1 })
                .skip(skip)
                .limit(limit)
                .lean<IHolidayDoc[]>(),
            Holiday.countDocuments(filter),
        ]);

        return {
            holidays,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get holiday by ID
     */
    async findById(id: string): Promise<IHolidayDoc> {
        this.validateObjectId(id);
        
        const holiday = await Holiday.findById(id);
        if (!holiday) {
            throw new NotFoundException('Holiday not found');
        }
        
        return holiday;
    }

    /**
     * Update holiday
     */
    async update(id: string, data: UpdateHolidayDTO, updatedBy: string): Promise<IHolidayDoc> {
        this.validateObjectId(id);

        const holiday = await Holiday.findById(id);
        if (!holiday) {
            throw new NotFoundException('Holiday not found');
        }

        // Check date conflict if changing date
        if (data.date && data.date.getTime() !== holiday.date.getTime()) {
            const startOfDay = new Date(data.date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(data.date);
            endOfDay.setHours(23, 59, 59, 999);

            const existing = await Holiday.findOne({
                date: { $gte: startOfDay, $lte: endOfDay },
                _id: { $ne: id },
                isActive: true,
            });

            if (existing) {
                throw new ConflictException(`Holiday already exists on this date: ${existing.name}`);
            }
        }

        const updateData: any = {
            ...data,
            updatedBy: new mongoose.Types.ObjectId(updatedBy),
        };

        // Update year if date changes
        if (data.date) {
            updateData.year = data.date.getFullYear();
        }

        const updated = await Holiday.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });

        if (!updated) {
            throw new NotFoundException('Holiday update failed');
        }

        logger.info(`Holiday updated: ${updated.name} by ${updatedBy}`);
        return updated;
    }

    /**
     * Delete (soft delete) holiday
     */
    async delete(id: string, deletedBy: string): Promise<boolean> {
        this.validateObjectId(id);

        const holiday = await Holiday.findById(id);
        if (!holiday) {
            throw new NotFoundException('Holiday not found');
        }

        holiday.isActive = false;
        holiday.updatedBy = new mongoose.Types.ObjectId(deletedBy);
        await holiday.save();

        logger.info(`Holiday soft-deleted: ${holiday.name} by ${deletedBy}`);
        return true;
    }

    /**
     * Publish holidays for a year
     */
    async publishByYear(year: number, updatedBy: string): Promise<number> {
        const result = await Holiday.updateMany(
            { year, isActive: true, isPublished: false },
            {
                isPublished: true,
                updatedBy: new mongoose.Types.ObjectId(updatedBy),
            }
        );

        logger.info(`Published ${result.modifiedCount} holidays for year ${year} by ${updatedBy}`);
        return result.modifiedCount;
    }

    /**
     * Unpublish holidays for a year
     */
    async unpublishByYear(year: number, updatedBy: string): Promise<number> {
        const result = await Holiday.updateMany(
            { year, isActive: true, isPublished: true },
            {
                isPublished: false,
                updatedBy: new mongoose.Types.ObjectId(updatedBy),
            }
        );

        logger.info(`Unpublished ${result.modifiedCount} holidays for year ${year} by ${updatedBy}`);
        return result.modifiedCount;
    }

    /**
     * Check if a date is a holiday
     */
    async isHoliday(date: Date): Promise<boolean> {
        return Holiday.isHoliday(date);
    }

    /**
     * Get upcoming holidays (next N holidays from today)
     */
    async getUpcoming(count: number = 5): Promise<IHolidayDoc[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Holiday.find({
            date: { $gte: today },
            isActive: true,
            isPublished: true,
        })
            .sort({ date: 1 })
            .limit(count)
            .lean<IHolidayDoc[]>();
    }

    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid holiday ID');
        }
    }
}

export default HolidayService;