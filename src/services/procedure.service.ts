import Procedure from '@models/procedure.model';
import { IProcedureDoc, CreateProcedureBody, UpdateProcedureBody } from '@interfaces/procedure.interface';
import {
    CreateProcedureDTO,
    UpdateProcedureDTO,
    ListProcedureQueryDTO,
    BulkCreateProcedureDTO,
} from '@validations/procedure.validation';
import {
    NotFoundException,
    ConflictException,
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import mongoose, { FilterQuery } from 'mongoose';

export class ProcedureService {

    /**
     * Create a new procedure
     */
    async createProcedure(data: CreateProcedureDTO, createdBy: string): Promise<IProcedureDoc> {
        // Check duplicate name
        const isExist = await Procedure.isNameExist(data.name);
        if (isExist) {
            throw new ConflictException('Procedure name already exists');
        }

        const procedureInput: CreateProcedureBody = {
            ...data,
            createdBy: new mongoose.Types.ObjectId(createdBy),
        };

        const procedure = await Procedure.create(procedureInput);
        logger.info(`Procedure created: ${procedure.name} by ${createdBy}`);
        return procedure;
    }

    /**
     * Get procedure by ID
     */
    async getProcedureById(id: string): Promise<IProcedureDoc> {
        this.validateObjectId(id);

        const procedure = await Procedure.findById(id);
        if (!procedure) {
            throw new NotFoundException('Procedure not found');
        }
        return procedure;
    }

    /**
     * List procedures with search, filter, pagination
     */
    async listProcedures(query: ListProcedureQueryDTO): Promise<{
        procedures: IProcedureDoc[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
    }> {
        const { search, isActive, sort, page = 1, limit = 50 } = query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter: FilterQuery<IProcedureDoc> = {};

        if (isActive !== 'all') {
            filter.isActive = isActive === 'true';
        }

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        // Build sort
        const sortObj: any = {};
        switch (sort) {
            case 'newest':
                sortObj.createdAt = -1;
                break;
            case 'name':
            default:
                sortObj.name = 1;
                break;
        }

        const [procedures, total] = await Promise.all([
            Procedure.find(filter)
                .sort(sortObj)
                .skip(skip)
                .limit(limit),
            Procedure.countDocuments(filter),
        ]);

        return {
            procedures,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get all active procedures (for dropdown/form)
     */
    async getActiveProcedures(): Promise<IProcedureDoc[]> {
        return Procedure.find({ isActive: true }).sort({ name: 1 });
    }

    /**
     * Update procedure
     */
    async updateProcedure(
        id: string,
        data: UpdateProcedureDTO,
        updatedBy: string
    ): Promise<IProcedureDoc> {
        this.validateObjectId(id);

        const procedure = await Procedure.findById(id);
        if (!procedure) {
            throw new NotFoundException('Procedure not found');
        }

        // Check duplicate name (exclude current)
        if (data.name && data.name !== procedure.name) {
            const isExist = await Procedure.isNameExist(data.name, id);
            if (isExist) {
                throw new ConflictException('Procedure name already exists');
            }
        }

        const updateData: UpdateProcedureBody = {
            ...data,
            updatedBy: new mongoose.Types.ObjectId(updatedBy),
        };

        const updatedProcedure = await Procedure.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedProcedure) {
            throw new NotFoundException('Procedure update failed');
        }

        logger.info(`Procedure updated: ${updatedProcedure.name} by ${updatedBy}`);
        return updatedProcedure;
    }

    /**
     * Delete procedure (hard delete)
     */
    async deleteProcedure(id: string, deletedBy: string): Promise<boolean> {
        this.validateObjectId(id);

        const procedure = await Procedure.findById(id);
        if (!procedure) {
            throw new NotFoundException('Procedure not found');
        }

        // TODO: Check if procedure is used in any clinic before deleting
        // const clinicCount = await Clinic.countDocuments({ procedures: id });
        // if (clinicCount > 0) {
        //     throw new ConflictException('Cannot delete procedure that is in use');
        // }

        await Procedure.findByIdAndDelete(id);
        logger.info(`Procedure deleted: ${procedure.name} by ${deletedBy}`);
        return true;
    }

    /**
     * Soft delete (set isActive = false)
     */
    async deactivateProcedure(id: string, updatedBy: string): Promise<IProcedureDoc> {
        return this.updateProcedure(id, { isActive: false }, updatedBy);
    }

    /**
     * Activate procedure
     */
    async activateProcedure(id: string, updatedBy: string): Promise<IProcedureDoc> {
        return this.updateProcedure(id, { isActive: true }, updatedBy);
    }

    /**
     * Bulk create procedures
     */
    async bulkCreateProcedures(
        data: BulkCreateProcedureDTO,
        createdBy: string
    ): Promise<{ created: IProcedureDoc[]; skipped: string[] }> {
        const created: IProcedureDoc[] = [];
        const skipped: string[] = [];

        for (const item of data.procedures) {
            const isExist = await Procedure.isNameExist(item.name);
            if (isExist) {
                skipped.push(item.name);
                continue;
            }

            const procedure = await Procedure.create({
                ...item,
                createdBy: new mongoose.Types.ObjectId(createdBy),
            });
            created.push(procedure);
        }

        logger.info(
            `Bulk procedures created: ${created.length} added, ${skipped.length} skipped by ${createdBy}`
        );

        return { created, skipped };
    }

    // Private helpers
    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid procedure ID');
        }
    }
}

export default ProcedureService;