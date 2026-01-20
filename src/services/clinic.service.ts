import Clinic from '@models/clinic.model';
import Procedure from '@models/procedure.model';
import BoardService from '@services/board.service';
import { IClinicDoc, ITimelineItem, CreateClinicBody, UpdateClinicBody } from '@interfaces/clinic.interface'
import User from '@models/user.model';
import {
    CreateClinicDTO,
    UpdateClinicDTO,
    ListClinicQueryDTO,
    UpdateTimelineDTO,
    TimelineItemInputDTO,
    UpdateTimelineItemDTO
} from '@validations/clinic.validation';
import {
    NotFoundException,
    ConflictException,
    ForbiddenException
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import mongoose, { FilterQuery } from 'mongoose';

const boardService = new BoardService();

export class ClinicService {

    async createClinic(data: CreateClinicDTO, createdBy: string): Promise<IClinicDoc> {
        const existingClinic = await Clinic.isClinicExist(data.name)
        if (existingClinic) {
            throw new ConflictException('Clinic already exists');
        }

        const assignedUsers = await User.find({ _id: { $in: data.assignedTo } });
        if (assignedUsers.length !== data.assignedTo.length) {
            throw new ConflictException('Some assigned users do not exist');
        }

        // Validate procedures exist
        if (data.procedures && data.procedures.length > 0) {
            const existingProcedures = await Procedure.find({
                _id: { $in: data.procedures },
                isActive: true
            });
            if (existingProcedures.length !== data.procedures.length) {
                throw new ConflictException('Some procedures do not exist or are inactive');
            }
        }

        if (!data.assignedTo.includes(createdBy)) {
            data.assignedTo.push(createdBy);
        }

        // Calculate total weeks from contract dates
        const totalWeeks = this.calculateTotalWeeks(data.contractDateStart, data.contractDateEnd);

        // Generate timeline from service data
        const timeline = this.generateTimelineFromService(data.service, createdBy);

        const clinicInput: CreateClinicBody = {
            ...data,
            assignedTo: data.assignedTo.map(id => new mongoose.Types.ObjectId(id)),
            procedures: (data.procedures || []).map(id => new mongoose.Types.ObjectId(id)),
            createdBy: new mongoose.Types.ObjectId(createdBy),
            status: data.status || 'active',
            timeline,
            totalWeeks,
        };

        const clinic = await Clinic.create(clinicInput);

        logger.info(`Clinic created: ${clinic.name.en} by ${createdBy}`);
        return clinic;
    }

    async getClinicById(id: string): Promise<IClinicDoc> {
        this.validateObjectId(id);

        const clinic = await Clinic.findById(id)
            .populate('assignedTo', 'firstname lastname nickname')
            .populate('procedures', 'name');
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }
        return clinic;
    }

    /**
     * Get procedures for a clinic (lightweight for Board tab)
     */
    async getClinicProcedures(id: string, userId: string): Promise<{ id: string; name: string }[]> {
        this.validateObjectId(id);

        const clinic = await Clinic.findById(id)
            .populate('procedures', 'name');

        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(assignedId => assignedId.toString() === userId)) {
            throw new ForbiddenException('Not authorized to view this clinic');
        }

        return clinic.procedures.map((proc: any) => ({
            id: proc._id.toString(),
            name: proc.name,
        }));
    }

    async listClinics(query: ListClinicQueryDTO, currentUserId: string): Promise<{
        clinics: IClinicDoc[];
        pagination: { page: number; limit: number; total: number; totalPages: number; };
    }> {
        const { search, sort, page = 1, limit = 18 } = query;
        const skip = (page - 1) * limit;

        // Build filter: Only clinics assigned to current user
        const filter: FilterQuery<IClinicDoc> = {
            assignedTo: new mongoose.Types.ObjectId(currentUserId),
        };
        if (search) {
            filter.$or = [
                { 'name.en': { $regex: search, $options: 'i' } },
                { 'name.th': { $regex: search, $options: 'i' } },
            ];
        }

        // Build sort
        const sortObj: any = {};
        switch (sort) {
            case 'newest':
                sortObj.createdAt = -1;
                break;
            case 'name':
                sortObj['name.en'] = 1;
                break;
            case 'contract':
                sortObj.contractDateEnd = 1;
                break;
            default:
                sortObj.createdAt = -1;
        }

        const [clinics, total] = await Promise.all([
            // Clinic.find(filter)
            //     .sort(sortObj)
            //     .skip(skip)
            //     .limit(limit)
            //     .populate('assignedTo', 'firstname lastname username')
            //     .populate('procedures', 'name'),
            Clinic.find(filter)
                .sort(sortObj)
                .skip(skip)
                .limit(limit)
                .populate('assignedTo', 'firstname lastname username')
                .populate('procedures', 'name')
                .exec() as Promise<IClinicDoc[]>,
            Clinic.countDocuments(filter),
        ]);

        return {
            clinics,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    async updateClinic(id: string, data: UpdateClinicDTO, updatedBy: string): Promise<IClinicDoc> {
        this.validateObjectId(id);

        const clinic = await Clinic.findById(id);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if updater is assigned
        if (!clinic.assignedTo.includes(new mongoose.Types.ObjectId(updatedBy))) {
            throw new ForbiddenException('Not authorized to update this clinic');
        }

        // Validate new assignedTo
        if (data.assignedTo) {
            const assignedUsers = await User.find({ _id: { $in: data.assignedTo } });
            if (assignedUsers.length !== data.assignedTo.length) {
                throw new ConflictException('Some assigned users do not exist');
            }
        }

        // Validate procedures exist
        if (data.procedures && data.procedures.length > 0) {
            const existingProcedures = await Procedure.find({
                _id: { $in: data.procedures },
                isActive: true
            });
            if (existingProcedures.length !== data.procedures.length) {
                throw new ConflictException('Some procedures do not exist or are inactive');
            }
        }

        // Sync timeline with service changes
        let syncedTimeline: ITimelineItem[] | undefined;
        if (data.service) {
            syncedTimeline = this.syncTimelineWithService(
                clinic.timeline,
                data.service,
                updatedBy
            );
        }

        // Recalculate totalWeeks if contract dates changed
        let totalWeeks: number | undefined;
        if (data.contractDateStart || data.contractDateEnd) {
            const startDate = data.contractDateStart || clinic.contractDateStart;
            const endDate = data.contractDateEnd || clinic.contractDateEnd;
            totalWeeks = this.calculateTotalWeeks(startDate, endDate);
        }

        const updateData: UpdateClinicBody = {
            ...data,
            assignedTo: data.assignedTo?.map(id => new mongoose.Types.ObjectId(id)),
            procedures: data.procedures?.map(id => new mongoose.Types.ObjectId(id)),
            timeline: syncedTimeline,
            totalWeeks,
            updatedBy: new mongoose.Types.ObjectId(updatedBy),
        };

        const updatedClinic = await Clinic.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
            .populate('assignedTo', 'firstname lastname username')
            .populate('procedures', 'name');

        if (!updatedClinic) {
            throw new NotFoundException('Clinic update failed');
        }

        // Delete boards for removed procedures
        if (data.procedures) {
            const oldProcedureIds = clinic.procedures.map(id => id.toString());
            const newProcedureIds = data.procedures;
            const removedProcedures = oldProcedureIds.filter(id => !newProcedureIds.includes(id));

            for (const procedureId of removedProcedures) {
                await boardService.deleteBoardsByProcedure(id, procedureId);
            }
        }

        logger.info(`Clinic updated: ${clinic.name.en} by ${updatedBy}`);
        return updatedClinic;
    }

    async deleteClinic(id: string, deletedBy: string): Promise<boolean> {
        this.validateObjectId(id);

        const clinic = await Clinic.findById(id);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if deleter is assigned
        if (!clinic.assignedTo.includes(new mongoose.Types.ObjectId(deletedBy))) {
            throw new ForbiddenException('Not authorized to delete this clinic');
        }

        // Soft delete: Set inactive
        clinic.status = 'inactive';
        clinic.updatedBy = new mongoose.Types.ObjectId(deletedBy);
        await clinic.save();

        logger.info(`Clinic soft-deleted: ${clinic.name.en} by ${deletedBy}`);
        return true;
    }

    // Private helpers
    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid clinic ID');
        }
    }

    private calculateTotalWeeks(startDate: Date, endDate: Date): number {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return Math.ceil(diffDays / 7);
    }

    /**
     * Generate timeline items from service data
     */
    private generateTimelineFromService(
        service: CreateClinicDTO['service'],
        createdBy: string
    ): ITimelineItem[] {
        const timeline: ITimelineItem[] = [];
        const now = new Date();
        const userId = new mongoose.Types.ObjectId(createdBy);

        // Setup items (boolean fields)
        const setupLabels: Record<string, string> = {
            requirement: 'Requirement',
            socialMedia: 'เชื่อมบัญชี Social Media',
            adsManager: 'เชื่อมบัญชี Ads Manager',
        };

        for (const [key, label] of Object.entries(setupLabels)) {
            if (service.setup[key as keyof typeof service.setup]) {
                timeline.push({
                    serviceType: 'setup',
                    serviceName: label,
                    serviceAmount: '---',
                    weekStart: 0,
                    weekEnd: 0,
                    updatedBy: userId,
                    updatedAt: now,
                });
            }
        }

        // Array service items (coperateIdentity, website, socialMedia, training)
        const arrayServices: Array<{
            key: keyof Pick<typeof service, 'coperateIdentity' | 'website' | 'socialMedia' | 'training'>;
            type: ITimelineItem['serviceType'];
        }> = [
                { key: 'coperateIdentity', type: 'coperateIdentity' },
                { key: 'website', type: 'website' },
                { key: 'socialMedia', type: 'socialMedia' },
                { key: 'training', type: 'training' },
            ];

        for (const { key, type } of arrayServices) {
            const items = service[key] || [];
            for (const item of items) {
                timeline.push({
                    serviceType: type,
                    serviceName: item.name,
                    serviceAmount: `0/${item.amount}`,
                    weekStart: 0,
                    weekEnd: 0,
                    updatedBy: userId,
                    updatedAt: now,
                });
            }
        }

        return timeline;
    }

    /**
     * Sync timeline with service changes (add new, remove deleted, keep existing)
     */
    private syncTimelineWithService(
        existingTimeline: ITimelineItem[],
        service: UpdateClinicDTO['service'],
        updatedBy: string
    ): ITimelineItem[] {
        if (!service) return existingTimeline;

        const now = new Date();
        const userId = new mongoose.Types.ObjectId(updatedBy);
        const newTimeline: ITimelineItem[] = [];

        // Setup labels
        const setupLabels: Record<string, string> = {
            requirement: 'Requirement',
            socialMedia: 'เชื่อมบัญชี Social Media',
            adsManager: 'เชื่อมบัญชี Ads Manager',
        };

        // Process setup items
        for (const [key, label] of Object.entries(setupLabels)) {
            const isEnabled = service.setup?.[key as keyof typeof service.setup];
            const existingItem = existingTimeline.find(
                t => t.serviceType === 'setup' && t.serviceName === label
            );

            if (isEnabled) {
                if (existingItem) {
                    // Keep existing item (preserve week settings)
                    newTimeline.push(existingItem);
                } else {
                    // Add new item
                    newTimeline.push({
                        serviceType: 'setup',
                        serviceName: label,
                        serviceAmount: '---',
                        weekStart: 0,
                        weekEnd: 0,
                        updatedBy: userId,
                        updatedAt: now,
                    });
                }
            }
            // If not enabled, don't add (effectively removes it)
        }

        // Process array service items
        const arrayServices: Array<{
            key: keyof Pick<NonNullable<typeof service>, 'coperateIdentity' | 'website' | 'socialMedia' | 'training'>;
            type: ITimelineItem['serviceType'];
        }> = [
                { key: 'coperateIdentity', type: 'coperateIdentity' },
                { key: 'website', type: 'website' },
                { key: 'socialMedia', type: 'socialMedia' },
                { key: 'training', type: 'training' },
            ];

        for (const { key, type } of arrayServices) {
            const items = service[key] || [];

            for (const item of items) {
                const existingItem = existingTimeline.find(
                    t => t.serviceType === type && t.serviceName === item.name
                );

                if (existingItem) {
                    // Keep existing item but update amount
                    newTimeline.push({
                        ...existingItem,
                        serviceAmount: existingItem.serviceAmount.includes('/')
                            ? `${existingItem.serviceAmount.split('/')[0]}/${item.amount}`
                            : `0/${item.amount}`,
                    });
                } else {
                    // Add new item
                    newTimeline.push({
                        serviceType: type,
                        serviceName: item.name,
                        serviceAmount: `0/${item.amount}`,
                        weekStart: 0,
                        weekEnd: 0,
                        updatedBy: userId,
                        updatedAt: now,
                    });
                }
            }
        }

        return newTimeline;
    }

    // ==================== TIMELINE METHODS ====================

    /**
     * Get timeline for a clinic
     */
    async getTimeline(clinicId: string, userId: string): Promise<{
        timeline: ITimelineItem[];
        totalWeeks: number;
        contractDateStart: Date;
        contractDateEnd: Date;
    }> {
        this.validateObjectId(clinicId);

        const clinic = await Clinic.findById(clinicId)
            .populate('timeline.updatedBy', 'firstname lastname nickname');
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to view this clinic');
        }

        return {
            timeline: clinic.timeline,
            totalWeeks: clinic.totalWeeks || this.calculateTotalWeeks(clinic.contractDateStart, clinic.contractDateEnd),
            contractDateStart: clinic.contractDateStart,
            contractDateEnd: clinic.contractDateEnd,
        };
    }

    /**
     * Update entire timeline
     */
    async updateTimeline(
        clinicId: string,
        data: UpdateTimelineDTO,
        userId: string
    ): Promise<IClinicDoc> {
        this.validateObjectId(clinicId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to modify this clinic');
        }

        const totalWeeks = clinic.totalWeeks || this.calculateTotalWeeks(clinic.contractDateStart, clinic.contractDateEnd);

        // Validate week ranges (skip if weekStart or weekEnd is 0 = not set)
        for (const item of data.timeline) {
            if (item.weekStart > 0 && item.weekEnd > 0) {
                if (item.weekStart > totalWeeks || item.weekEnd > totalWeeks) {
                    throw new ConflictException(`Week range exceeds total weeks (${totalWeeks})`);
                }
            }
        }

        // Add updatedBy and updatedAt to each item
        const timelineWithMeta = data.timeline.map(item => ({
            ...item,
            updatedBy: new mongoose.Types.ObjectId(userId),
            updatedAt: new Date(),
        }));

        clinic.timeline = timelineWithMeta as any;
        clinic.updatedBy = new mongoose.Types.ObjectId(userId);
        await clinic.save();

        logger.info(`Timeline updated for clinic ${clinic.name.en} by ${userId}`);
        return clinic;
    }

    /**
     * Add single timeline item
     */
    async addTimelineItem(
        clinicId: string,
        data: TimelineItemInputDTO,
        userId: string
    ): Promise<IClinicDoc> {
        this.validateObjectId(clinicId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to modify this clinic');
        }

        const totalWeeks = clinic.totalWeeks || this.calculateTotalWeeks(clinic.contractDateStart, clinic.contractDateEnd);

        // Validate week range (skip if weekStart or weekEnd is 0 = not set)
        if (data.weekStart > 0 && data.weekEnd > 0) {
            if (data.weekStart > totalWeeks || data.weekEnd > totalWeeks) {
                throw new ConflictException(`Week range exceeds total weeks (${totalWeeks})`);
            }
        }

        // Add new item
        clinic.timeline.push({
            ...data,
            updatedBy: new mongoose.Types.ObjectId(userId),
            updatedAt: new Date(),
        } as any);

        clinic.updatedBy = new mongoose.Types.ObjectId(userId);
        await clinic.save();

        logger.info(`Timeline item added to clinic ${clinic.name.en} by ${userId}`);
        return clinic;
    }

    /**
     * Update single timeline item
     */
    async updateTimelineItem(
        clinicId: string,
        itemId: string,
        data: UpdateTimelineItemDTO,
        userId: string
    ): Promise<IClinicDoc> {
        this.validateObjectId(clinicId);
        this.validateObjectId(itemId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to modify this clinic');
        }

        // Find item index
        const itemIndex = clinic.timeline.findIndex(
            item => (item as any)._id?.toString() === itemId
        );

        if (itemIndex === -1) {
            throw new NotFoundException('Timeline item not found');
        }

        const totalWeeks = clinic.totalWeeks || this.calculateTotalWeeks(clinic.contractDateStart, clinic.contractDateEnd);

        // Validate week range (skip if weekStart or weekEnd is 0 = not set)
        const weekStart = data.weekStart ?? clinic.timeline[itemIndex].weekStart;
        const weekEnd = data.weekEnd ?? clinic.timeline[itemIndex].weekEnd;
        if (weekStart > 0 && weekEnd > 0) {
            if (weekStart > totalWeeks || weekEnd > totalWeeks) {
                throw new ConflictException(`Week range exceeds total weeks (${totalWeeks})`);
            }
        }

        // Update item
        if (data.weekStart !== undefined) clinic.timeline[itemIndex].weekStart = data.weekStart;
        if (data.weekEnd !== undefined) clinic.timeline[itemIndex].weekEnd = data.weekEnd;
        if (data.serviceName !== undefined) clinic.timeline[itemIndex].serviceName = data.serviceName;
        if (data.serviceAmount !== undefined) clinic.timeline[itemIndex].serviceAmount = data.serviceAmount;
        clinic.timeline[itemIndex].updatedBy = new mongoose.Types.ObjectId(userId);
        clinic.timeline[itemIndex].updatedAt = new Date();

        clinic.updatedBy = new mongoose.Types.ObjectId(userId);
        await clinic.save();

        logger.info(`Timeline item ${itemId} updated in clinic ${clinic.name.en} by ${userId}`);
        return clinic;
    }

    /**
     * Delete single timeline item
     */
    async deleteTimelineItem(
        clinicId: string,
        itemId: string,
        userId: string
    ): Promise<IClinicDoc> {
        this.validateObjectId(clinicId);
        this.validateObjectId(itemId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to modify this clinic');
        }

        // Find and remove item
        const itemIndex = clinic.timeline.findIndex(
            item => (item as any)._id?.toString() === itemId
        );

        if (itemIndex === -1) {
            throw new NotFoundException('Timeline item not found');
        }

        clinic.timeline.splice(itemIndex, 1);
        clinic.updatedBy = new mongoose.Types.ObjectId(userId);
        await clinic.save();

        logger.info(`Timeline item ${itemId} deleted from clinic ${clinic.name.en} by ${userId}`);
        return clinic;
    }
}

export default ClinicService;