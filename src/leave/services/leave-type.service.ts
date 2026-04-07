import mongoose from 'mongoose';
import LeaveType from '../models/leave-type.model';
import { ILeaveTypeDoc, LeaveTypeCode } from '../interfaces/leave-type.interface';
import { CreateLeaveTypeDTO, UpdateLeaveTypeDTO } from '../validations/leave.validation';
import { NotFoundException, ConflictException, ForbiddenException } from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

export class LeaveTypeService {
    /**
     * Create a new leave type
     */
    async create(data: CreateLeaveTypeDTO, createdBy: string): Promise<ILeaveTypeDoc> {
        // Check if code already exists
        const existing = await LeaveType.findOne({ code: data.code });
        if (existing) {
            throw new ConflictException(`Leave type with code '${data.code}' already exists`);
        }

        const leaveType = await LeaveType.create({
            ...data,
            createdBy: new mongoose.Types.ObjectId(createdBy),
        });

        logger.info(`Leave type created: ${leaveType.code} by ${createdBy}`);
        return leaveType;
    }

    /**
     * Get all leave types
     */
    async findAll(includeInactive: boolean = false): Promise<ILeaveTypeDoc[]> {
        const filter = includeInactive ? {} : { isActive: true };
        return LeaveType.find(filter).sort({ sortOrder: 1, name: 1 });
    }

    /**
     * Get leave type by ID
     */
    async findById(id: string): Promise<ILeaveTypeDoc> {
        this.validateObjectId(id);

        const leaveType = await LeaveType.findById(id);
        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        return leaveType;
    }

    /**
     * Get leave type by code
     */
    async findByCode(code: LeaveTypeCode): Promise<ILeaveTypeDoc> {
        const leaveType = await LeaveType.findByCode(code);
        if (!leaveType) {
            throw new NotFoundException(`Leave type with code '${code}' not found`);
        }

        return leaveType;
    }

    /**
     * Update leave type
     */
    async update(id: string, data: UpdateLeaveTypeDTO, updatedBy: string): Promise<ILeaveTypeDoc> {
        this.validateObjectId(id);

        const leaveType = await LeaveType.findById(id);
        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        // Check code uniqueness if changing
        if (data.code && data.code !== leaveType.code) {
            const existing = await LeaveType.findOne({ code: data.code, _id: { $ne: id } });
            if (existing) {
                throw new ConflictException(`Leave type with code '${data.code}' already exists`);
            }
        }

        const updated = await LeaveType.findByIdAndUpdate(
            id,
            {
                ...data,
                updatedBy: new mongoose.Types.ObjectId(updatedBy),
            },
            { new: true, runValidators: true }
        );

        if (!updated) {
            throw new NotFoundException('Leave type update failed');
        }

        logger.info(`Leave type updated: ${updated.code} by ${updatedBy}`);
        return updated;
    }

    /**
     * Delete (soft delete) leave type
     */
    async delete(id: string, deletedBy: string): Promise<boolean> {
        this.validateObjectId(id);

        const leaveType = await LeaveType.findById(id);
        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        leaveType.isActive = false;
        leaveType.updatedBy = new mongoose.Types.ObjectId(deletedBy);
        await leaveType.save();

        logger.info(`Leave type soft-deleted: ${leaveType.code} by ${deletedBy}`);
        return true;
    }

    /**
     * Seed default leave types
     */
    async seedDefaults(createdBy: string): Promise<ILeaveTypeDoc[]> {
        const defaults = [
            {
                code: 'annual' as LeaveTypeCode,
                name: 'ลาพักร้อน',
                description: 'วันหยุดพักผ่อนประจำปี',
                defaultDays: 6,
                maxDaysPerYear: 15,
                allowHalfDay: true,
                allowHours: true,
                requireAttachment: false,
                allowPastDate: false,
                requireApproval: true,
                color: '#3B82F6',
                icon: 'Umbrella',
                sortOrder: 1,
            },
            {
                code: 'sick' as LeaveTypeCode,
                name: 'ลาป่วย',
                description: 'ลาเมื่อเจ็บป่วย',
                defaultDays: 30,
                maxDaysPerYear: 30,
                allowHalfDay: true,
                allowHours: true,
                requireAttachment: true,
                allowPastDate: true,
                pastDateLimit: 7,
                requireApproval: true,
                color: '#EF4444',
                icon: 'Stethoscope',
                sortOrder: 2,
            },
            {
                code: 'personal' as LeaveTypeCode,
                name: 'ลากิจ',
                description: 'ลาเพื่อธุระส่วนตัว',
                defaultDays: 3,
                maxDaysPerYear: 3,
                allowHalfDay: true,
                allowHours: true,
                requireAttachment: false,
                allowPastDate: false,
                requireApproval: true,
                color: '#F97316',
                icon: 'Briefcase',
                sortOrder: 3,
            },
            // {
            //     code: 'maternity' as LeaveTypeCode,
            //     name: 'ลาคลอด',
            //     description: 'ลาคลอดบุตร',
            //     defaultDays: 98,
            //     maxDaysPerYear: 98,
            //     allowHalfDay: false,
            //     allowHours: false,
            //     requireAttachment: true,
            //     allowPastDate: false,
            //     requireApproval: true,
            //     color: '#EC4899',
            //     icon: 'Baby',
            //     sortOrder: 4,
            // },
            // {
            //     code: 'ordination' as LeaveTypeCode,
            //     name: 'ลาบวช',
            //     description: 'ลาเพื่ออุปสมบท',
            //     defaultDays: 15,
            //     maxDaysPerYear: 15,
            //     allowHalfDay: false,
            //     allowHours: false,
            //     requireAttachment: true,
            //     allowPastDate: false,
            //     requireApproval: true,
            //     color: '#EAB308',
            //     icon: 'FileText',
            //     sortOrder: 5,
            // },
            // {
            //     code: 'military' as LeaveTypeCode,
            //     name: 'ลาเกณฑ์ทหาร',
            //     description: 'ลาเพื่อเข้ารับการเกณฑ์ทหาร',
            //     defaultDays: 60,
            //     maxDaysPerYear: 60,
            //     allowHalfDay: false,
            //     allowHours: false,
            //     requireAttachment: true,
            //     allowPastDate: false,
            //     requireApproval: true,
            //     color: '#22C55E',
            //     icon: 'Shield',
            //     sortOrder: 6,
            // },
            // {
            //     code: 'other' as LeaveTypeCode,
            //     name: 'ลาอื่นๆ',
            //     description: 'การลาประเภทอื่น',
            //     defaultDays: 5,
            //     maxDaysPerYear: 5,
            //     allowHalfDay: true,
            //     allowHours: false,
            //     requireAttachment: false,
            //     allowPastDate: false,
            //     requireApproval: true,
            //     color: '#6B7280',
            //     icon: 'FileText',
            //     sortOrder: 99,
            // },
        ];

        const results: ILeaveTypeDoc[] = [];

        for (const item of defaults) {
            const existing = await LeaveType.findOne({ code: item.code });
            if (!existing) {
                const created = await LeaveType.create({
                    ...item,
                    createdBy: new mongoose.Types.ObjectId(createdBy),
                });
                results.push(created);
            }
        }

        logger.info(`Seeded ${results.length} default leave types`);
        return results;
    }

    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid leave type ID');
        }
    }
}

export default LeaveTypeService;