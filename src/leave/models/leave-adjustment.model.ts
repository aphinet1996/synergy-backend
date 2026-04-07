import mongoose, { Schema, Types } from 'mongoose';
import { ILeaveAdjustmentDoc, ILeaveAdjustmentModel } from '../interfaces/leave-adjustment.interface';
import toJSON from '@utils/toJSON';

const leaveAdjustmentSchema = new Schema<ILeaveAdjustmentDoc, ILeaveAdjustmentModel>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User is required'],
            index: true,
        },
        year: {
            type: Number,
            required: [true, 'Year is required'],
            index: true,
        },
        leaveType: {
            type: Schema.Types.ObjectId,
            ref: 'LeaveType',
            required: [true, 'Leave type is required'],
        },
        leaveTypeCode: {
            type: String,
            enum: ['annual', 'sick', 'personal', 'maternity', 'ordination', 'military', 'other'],
        },
        adjustmentType: {
            type: String,
            enum: ['add', 'deduct', 'carry_over', 'expired', 'correction', 'bonus', 'transfer_in', 'transfer_out'],
            required: [true, 'Adjustment type is required'],
        },
        days: {
            type: Number,
            required: [true, 'Days is required'],
        },
        balanceBefore: {
            type: Number,
            required: true,
        },
        balanceAfter: {
            type: Number,
            required: true,
        },
        reason: {
            type: String,
            required: [true, 'Reason is required'],
            trim: true,
        },
        relatedRequest: {
            type: Schema.Types.ObjectId,
            ref: 'LeaveRequest',
        },
        relatedUser: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        sourceYear: {
            type: Number,
        },
        expiryDate: {
            type: Date,
        },
        adjustedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Adjusted by is required'],
        },
        adjustedAt: {
            type: Date,
            default: Date.now,
        },
        requiresApproval: {
            type: Boolean,
            default: false,
        },
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        approvedAt: {
            type: Date,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'approved',  // ถ้าไม่ต้อง approve ให้ approved เลย
        },
    },
    {
        timestamps: true,
    }
);

leaveAdjustmentSchema.plugin(toJSON);

// Indexes
leaveAdjustmentSchema.index({ user: 1, year: 1, leaveType: 1 });
leaveAdjustmentSchema.index({ adjustmentType: 1, status: 1 });
leaveAdjustmentSchema.index({ adjustedAt: -1 });

// Static methods
leaveAdjustmentSchema.statics.findByUser = function (
    userId: Types.ObjectId,
    year?: number
): Promise<ILeaveAdjustmentDoc[]> {
    const query: any = { user: userId, status: 'approved' };
    if (year) query.year = year;

    return this.find(query)
        .populate('leaveType', 'name code')
        .populate('adjustedBy', 'firstname lastname')
        .sort({ adjustedAt: -1 })
        .exec();
};

leaveAdjustmentSchema.statics.findPendingApprovals = function (): Promise<ILeaveAdjustmentDoc[]> {
    return this.find({ status: 'pending', requiresApproval: true })
        .populate('user', 'firstname lastname')
        .populate('leaveType', 'name code')
        .populate('adjustedBy', 'firstname lastname')
        .sort({ createdAt: 1 })
        .exec();
};

leaveAdjustmentSchema.statics.getAdjustmentSum = async function (
    userId: Types.ObjectId,
    leaveTypeId: Types.ObjectId,
    year: number
): Promise<number> {
    const result = await this.aggregate([
        {
            $match: {
                user: userId,
                leaveType: leaveTypeId,
                year,
                status: 'approved',
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$days' }
            }
        }
    ]);

    return result.length > 0 ? result[0].total : 0;
};

const LeaveAdjustment = mongoose.model<ILeaveAdjustmentDoc, ILeaveAdjustmentModel>(
    'LeaveAdjustment',
    leaveAdjustmentSchema
);

export default LeaveAdjustment;
