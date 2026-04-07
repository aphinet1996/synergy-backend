import mongoose, { Types } from 'mongoose';
import ApprovalFlow from '../models/approval-flow.model';
import Position from '@models/position.model';
import { IApprovalFlowDoc } from '../interfaces/index';
import { CreateApprovalFlowDTO, UpdateApprovalFlowDTO } from '../validations/leave.validation';
import { NotFoundException, ConflictException, BadRequestException } from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

export class ApprovalFlowService {
    /**
     * Create a new approval flow
     */
    async create(data: CreateApprovalFlowDTO, createdBy: string): Promise<IApprovalFlowDoc> {
        // Validate requester position exists
        const requesterPosition = await Position.findById(data.requesterPosition);
        if (!requesterPosition) {
            throw new BadRequestException('Requester position not found');
        }

        // Validate all approver positions exist
        for (const step of data.steps) {
            const approverPosition = await Position.findById(step.approverPosition);
            if (!approverPosition) {
                throw new BadRequestException(`Approver position not found for step ${step.stepOrder}`);
            }
        }

        // If setting as default, unset other defaults for same requester position
        if (data.isDefault) {
            await ApprovalFlow.updateMany(
                {
                    requesterPosition: data.requesterPosition,
                    isDefault: true,
                    isActive: true,
                },
                { isDefault: false }
            );
        }

        // Prepare steps with position names
        const stepsWithNames = await Promise.all(
            data.steps.map(async (step) => {
                const position = await Position.findById(step.approverPosition);
                return {
                    ...step,
                    approverPosition: new mongoose.Types.ObjectId(step.approverPosition),
                    approverPositionName: position?.name || '',
                };
            })
        );

        const approvalFlow = await ApprovalFlow.create({
            ...data,
            requesterPosition: new mongoose.Types.ObjectId(data.requesterPosition),
            requesterPositionName: requesterPosition.name,
            leaveTypes: data.leaveTypes?.map((id) => new mongoose.Types.ObjectId(id)) || [],
            steps: stepsWithNames,
            createdBy: new mongoose.Types.ObjectId(createdBy),
        });

        logger.info(`Approval flow created: ${approvalFlow.name} by ${createdBy}`);
        return approvalFlow;
    }

    /**
     * Get all approval flows
     */
    async findAll(includeInactive: boolean = false): Promise<IApprovalFlowDoc[]> {
        return ApprovalFlow.findActiveFlows();
    }

    /**
     * Get approval flow by ID
     */
    async findById(id: string): Promise<IApprovalFlowDoc> {
        this.validateObjectId(id);

        const flow = await ApprovalFlow.findById(id)
            .populate('requesterPosition', 'name')
            .populate('steps.approverPosition', 'name')
            .populate('leaveTypes', 'name code');

        if (!flow) {
            throw new NotFoundException('Approval flow not found');
        }

        return flow;
    }

    /**
     * Find approval flow for a specific position and leave type
     */
    async findFlowForPosition(
        positionId: string,
        leaveTypeId?: string
    ): Promise<IApprovalFlowDoc | null> {
        const positionObjectId = new mongoose.Types.ObjectId(positionId);
        const leaveTypeObjectId = leaveTypeId
            ? new mongoose.Types.ObjectId(leaveTypeId)
            : undefined;

        return ApprovalFlow.findFlowForPosition(positionObjectId, leaveTypeObjectId);
    }

    /**
     * Update approval flow
     */
    async update(id: string, data: UpdateApprovalFlowDTO, updatedBy: string): Promise<IApprovalFlowDoc> {
        this.validateObjectId(id);

        const flow = await ApprovalFlow.findById(id);
        if (!flow) {
            throw new NotFoundException('Approval flow not found');
        }

        const updateData: any = {
            ...data,
            updatedBy: new mongoose.Types.ObjectId(updatedBy),
        };

        // Validate and update requester position
        if (data.requesterPosition) {
            const requesterPosition = await Position.findById(data.requesterPosition);
            if (!requesterPosition) {
                throw new BadRequestException('Requester position not found');
            }
            updateData.requesterPosition = new mongoose.Types.ObjectId(data.requesterPosition);
            updateData.requesterPositionName = requesterPosition.name;
        }

        // Validate and update steps
        if (data.steps) {
            const stepsWithNames = await Promise.all(
                data.steps.map(async (step) => {
                    const position = await Position.findById(step.approverPosition);
                    if (!position) {
                        throw new BadRequestException(`Approver position not found for step ${step.stepOrder}`);
                    }
                    return {
                        ...step,
                        approverPosition: new mongoose.Types.ObjectId(step.approverPosition),
                        approverPositionName: position.name,
                    };
                })
            );
            updateData.steps = stepsWithNames;
        }

        // Handle leave types
        if (data.leaveTypes) {
            updateData.leaveTypes = data.leaveTypes.map((id) => new mongoose.Types.ObjectId(id));
        }

        // If setting as default, unset other defaults
        if (data.isDefault) {
            const requesterPositionId = data.requesterPosition || flow.requesterPosition;
            await ApprovalFlow.updateMany(
                {
                    requesterPosition: requesterPositionId,
                    isDefault: true,
                    isActive: true,
                    _id: { $ne: id },
                },
                { isDefault: false }
            );
        }

        const updated = await ApprovalFlow.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        })
            .populate('requesterPosition', 'name')
            .populate('steps.approverPosition', 'name')
            .populate('leaveTypes', 'name code');

        if (!updated) {
            throw new NotFoundException('Approval flow update failed');
        }

        logger.info(`Approval flow updated: ${updated.name} by ${updatedBy}`);
        return updated;
    }

    /**
     * Delete (soft delete) approval flow
     */
    async delete(id: string, deletedBy: string): Promise<boolean> {
        this.validateObjectId(id);

        const flow = await ApprovalFlow.findById(id);
        if (!flow) {
            throw new NotFoundException('Approval flow not found');
        }

        flow.isActive = false;
        flow.updatedBy = new mongoose.Types.ObjectId(deletedBy);
        await flow.save();

        logger.info(`Approval flow soft-deleted: ${flow.name} by ${deletedBy}`);
        return true;
    }

    /**
     * Get flows by requester position
     */
    async findByRequesterPosition(positionId: string): Promise<IApprovalFlowDoc[]> {
        this.validateObjectId(positionId);

        return ApprovalFlow.find({
            requesterPosition: new mongoose.Types.ObjectId(positionId),
            isActive: true,
        })
            .populate('requesterPosition', 'name')
            .populate('steps.approverPosition', 'name')
            .populate('leaveTypes', 'name code')
            .sort({ isDefault: -1 });
    }

    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid approval flow ID');
        }
    }
}

export default ApprovalFlowService;