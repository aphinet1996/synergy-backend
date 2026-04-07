import mongoose, { Schema, Types } from 'mongoose';
import { IApprovalFlowDoc, IApprovalFlowModel, IApprovalStep } from '../interfaces/approval-flow.interface';
import toJSON from '@utils/toJSON';

const approvalStepSchema = new Schema(
    {
        stepOrder: {
            type: Number,
            required: true,
            min: 1,
        },
        approverPosition: {
            type: Schema.Types.ObjectId,
            ref: 'Position',
            required: true,
        },
        approverPositionName: {
            type: String,
        },
        canSkip: {
            type: Boolean,
            default: false,
        },
        autoApproveAfterDays: {
            type: Number,
            default: null,
            min: 1,
        },
    },
    { _id: false }
);

const approvalFlowSchema = new Schema(
    {
        name: {
            type: String,
            required: [true, 'Approval flow name is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        requesterPosition: {
            type: Schema.Types.ObjectId,
            ref: 'Position',
            required: [true, 'Requester position is required'],
        },
        requesterPositionName: {
            type: String,
        },
        leaveTypes: [{
            type: Schema.Types.ObjectId,
            ref: 'LeaveType',
        }],
        steps: {
            type: [approvalStepSchema],
            required: true,
            validate: {
                validator: function (v: IApprovalStep[]) {
                    return v && v.length > 0;
                },
                message: 'At least one approval step is required',
            },
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Created by is required'],
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

approvalFlowSchema.plugin(toJSON);

approvalFlowSchema.index({ requesterPosition: 1, isActive: 1 });
approvalFlowSchema.index({ isDefault: 1, isActive: 1 });

// Pre-save middleware to ensure steps are sorted
approvalFlowSchema.pre('save', function (next) {
    if (this.steps && this.steps.length > 0) {
        this.steps.sort((a, b) => a.stepOrder - b.stepOrder);
    }
    next();
});

// Static methods
approvalFlowSchema.statics.findFlowForPosition = async function (
    positionId: Types.ObjectId | string,
    leaveTypeId?: Types.ObjectId | string
): Promise<IApprovalFlowDoc | null> {
    // Handle empty string case
    if (!positionId || positionId === '') {
        // If no position, just return default flow
        return this.findOne({ isDefault: true, isActive: true });
    }

    const posObjId = typeof positionId === 'string' ? new Types.ObjectId(positionId) : positionId;
    const leaveTypeObjId = leaveTypeId
        ? (typeof leaveTypeId === 'string' ? new Types.ObjectId(leaveTypeId) : leaveTypeId)
        : undefined;

    // First try to find a specific flow for the position and leave type
    if (leaveTypeObjId) {
        const specificFlow = await this.findOne({
            requesterPosition: posObjId,
            leaveTypes: leaveTypeObjId,
            isActive: true,
        });
        if (specificFlow) return specificFlow;
    }

    // Then try to find a flow for the position (without specific leave type)
    const positionFlow = await this.findOne({
        requesterPosition: posObjId,
        $or: [
            { leaveTypes: { $size: 0 } },
            { leaveTypes: { $exists: false } },
        ],
        isActive: true,
    });
    if (positionFlow) return positionFlow;

    // Finally, find the default flow
    return this.findOne({ isDefault: true, isActive: true });
};

approvalFlowSchema.statics.findActiveFlows = function (): Promise<IApprovalFlowDoc[]> {
    return this.find({ isActive: true })
        .populate('requesterPosition', 'name')
        .populate('steps.approverPosition', 'name')
        .populate('leaveTypes', 'name code')
        .sort({ createdAt: -1 })
        .exec();
};

const ApprovalFlow = mongoose.model<IApprovalFlowDoc, IApprovalFlowModel>('ApprovalFlow', approvalFlowSchema);

export default ApprovalFlow;