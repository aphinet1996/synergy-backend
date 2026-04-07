import mongoose from 'mongoose';
import LeaveQuota from '../models/leave-quota.model';
import LeaveType from '../models/leave-type.model';
import Position from '@models/position.model';
import { ILeaveQuotaDoc } from '../interfaces/leave-quota.interface';
import { CreateLeaveQuotaDTO, UpdateLeaveQuotaDTO } from '../validations/leave.validation';
import { NotFoundException, ConflictException, BadRequestException } from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

export class LeaveQuotaService {
    /**
     * Create a new leave quota configuration
     */
    async create(data: CreateLeaveQuotaDTO, createdBy: string): Promise<ILeaveQuotaDoc> {
        // Validate position if provided
        let positionName: string | undefined;
        if (data.position) {
            const position = await Position.findById(data.position);
            if (!position) {
                throw new BadRequestException('Position not found');
            }
            positionName = position.name;
        }

        // Validate all leave types exist and get their codes
        const quotasWithCodes = await Promise.all(
            data.quotas.map(async (quota) => {
                const leaveType = await LeaveType.findById(quota.leaveType);
                if (!leaveType) {
                    throw new BadRequestException(`Leave type not found: ${quota.leaveType}`);
                }
                return {
                    leaveType: new mongoose.Types.ObjectId(quota.leaveType),
                    leaveTypeCode: leaveType.code,
                    days: quota.days,
                };
            })
        );

        // Check for duplicate configuration
        const existingQuery: any = {
            year: data.year,
            isActive: true,
        };

        if (data.position) {
            existingQuery.position = new mongoose.Types.ObjectId(data.position);
        } else {
            existingQuery.position = null;
        }

        if (data.employeeType) {
            existingQuery.employeeType = data.employeeType;
        } else {
            existingQuery.employeeType = null;
        }

        const existing = await LeaveQuota.findOne(existingQuery);
        if (existing) {
            throw new ConflictException('Leave quota configuration already exists for this combination');
        }

        // If setting as default, unset other defaults for same year
        if (data.isDefault) {
            await LeaveQuota.updateMany(
                { year: data.year, isDefault: true, isActive: true },
                { isDefault: false }
            );
        }

        const leaveQuota = await LeaveQuota.create({
            year: data.year,
            position: data.position ? new mongoose.Types.ObjectId(data.position) : null,
            positionName,
            employeeType: data.employeeType || null,
            quotas: quotasWithCodes,
            isDefault: data.isDefault || false,
            createdBy: new mongoose.Types.ObjectId(createdBy),
        });

        logger.info(`Leave quota created for year ${data.year} by ${createdBy}`);
        return leaveQuota;
    }

    /**
     * Get all leave quotas by year
     */
    async findByYear(year: number): Promise<ILeaveQuotaDoc[]> {
        return LeaveQuota.findByYear(year);
    }

    /**
     * Get leave quota by ID
     */
    async findById(id: string): Promise<ILeaveQuotaDoc> {
        this.validateObjectId(id);

        const quota = await LeaveQuota.findById(id)
            .populate('position', 'name')
            .populate('quotas.leaveType', 'name code color icon');

        if (!quota) {
            throw new NotFoundException('Leave quota not found');
        }

        return quota;
    }

    /**
     * Find quota for a specific user's configuration
     */
    async findQuotaForUser(
        year: number,
        positionId?: string,
        employeeType?: string
    ): Promise<ILeaveQuotaDoc | null> {
        const positionObjectId = positionId
            ? new mongoose.Types.ObjectId(positionId)
            : undefined;

        return LeaveQuota.findQuotaForUser(year, positionObjectId, employeeType);
    }

    /**
     * Update leave quota
     */
    async update(id: string, data: UpdateLeaveQuotaDTO, updatedBy: string): Promise<ILeaveQuotaDoc> {
        this.validateObjectId(id);

        const quota = await LeaveQuota.findById(id);
        if (!quota) {
            throw new NotFoundException('Leave quota not found');
        }

        const updateData: any = {
            ...data,
            updatedBy: new mongoose.Types.ObjectId(updatedBy),
        };

        // Update position if provided
        if (data.position !== undefined) {
            if (data.position) {
                const position = await Position.findById(data.position);
                if (!position) {
                    throw new BadRequestException('Position not found');
                }
                updateData.position = new mongoose.Types.ObjectId(data.position);
                updateData.positionName = position.name;
            } else {
                updateData.position = null;
                updateData.positionName = undefined;
            }
        }

        // Update quotas if provided
        if (data.quotas) {
            const quotasWithCodes = await Promise.all(
                data.quotas.map(async (q) => {
                    const leaveType = await LeaveType.findById(q.leaveType);
                    if (!leaveType) {
                        throw new BadRequestException(`Leave type not found: ${q.leaveType}`);
                    }
                    return {
                        leaveType: new mongoose.Types.ObjectId(q.leaveType),
                        leaveTypeCode: leaveType.code,
                        days: q.days,
                    };
                })
            );
            updateData.quotas = quotasWithCodes;
        }

        // If setting as default, unset other defaults
        if (data.isDefault) {
            const year = data.year || quota.year;
            await LeaveQuota.updateMany(
                { year, isDefault: true, isActive: true, _id: { $ne: id } },
                { isDefault: false }
            );
        }

        const updated = await LeaveQuota.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        })
            .populate('position', 'name')
            .populate('quotas.leaveType', 'name code color icon');

        if (!updated) {
            throw new NotFoundException('Leave quota update failed');
        }

        logger.info(`Leave quota updated: ${id} by ${updatedBy}`);
        return updated;
    }

    /**
     * Delete (soft delete) leave quota
     */
    async delete(id: string, deletedBy: string): Promise<boolean> {
        this.validateObjectId(id);

        const quota = await LeaveQuota.findById(id);
        if (!quota) {
            throw new NotFoundException('Leave quota not found');
        }

        quota.isActive = false;
        quota.updatedBy = new mongoose.Types.ObjectId(deletedBy);
        await quota.save();

        logger.info(`Leave quota soft-deleted: ${id} by ${deletedBy}`);
        return true;
    }

    /**
     * Copy quotas from one year to another
     */
    async copyToYear(fromYear: number, toYear: number, createdBy: string): Promise<number> {
        const existingQuotas = await LeaveQuota.find({ year: fromYear, isActive: true });

        if (existingQuotas.length === 0) {
            throw new NotFoundException(`No quotas found for year ${fromYear}`);
        }

        let created = 0;

        for (const quota of existingQuotas) {
            // Check if already exists for target year
            const existing = await LeaveQuota.findOne({
                year: toYear,
                position: quota.position,
                employeeType: quota.employeeType,
                isActive: true,
            });

            if (!existing) {
                await LeaveQuota.create({
                    year: toYear,
                    position: quota.position,
                    positionName: quota.positionName,
                    employeeType: quota.employeeType,
                    quotas: quota.quotas,
                    isDefault: quota.isDefault,
                    createdBy: new mongoose.Types.ObjectId(createdBy),
                });
                created++;
            }
        }

        logger.info(`Copied ${created} quotas from ${fromYear} to ${toYear} by ${createdBy}`);
        return created;
    }

    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid leave quota ID');
        }
    }
}

export default LeaveQuotaService;