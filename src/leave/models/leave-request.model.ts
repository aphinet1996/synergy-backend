import mongoose, { Schema, Types } from 'mongoose';
import {
    ILeaveRequestDoc,
    ILeaveRequestModel,
    IApprovalHistory,
    LeaveStatus,
    LeaveDurationType,
    HalfDayPeriod
} from '../interfaces/leave-request.interface';
import toJSON from '@utils/toJSON';

const approvalHistorySchema = new Schema<IApprovalHistory>(
    {
        step: {
            type: Number,
            required: true,
            min: 1,
        },
        approver: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        approverName: {
            type: String,
        },
        approverPosition: {
            type: String,
        },
        action: {
            type: String,
            enum: ['approved', 'rejected', 'pending'],
            default: 'pending',
        },
        comment: {
            type: String,
        },
        actionAt: {
            type: Date,
        },
    },
    { _id: false }
);

const leaveRequestSchema = new Schema<ILeaveRequestDoc, ILeaveRequestModel>(
    {
        requestNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User is required'],
            index: true,
        },
        userName: {
            type: String,
        },
        userPosition: {
            type: String,
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
        leaveTypeName: {
            type: String,
        },
        durationType: {
            type: String,
            enum: ['full_day', 'half_day', 'hours'],
            required: true,
            default: 'full_day',
        },
        halfDayPeriod: {
            type: String,
            enum: ['morning', 'afternoon'],
        },
        startDate: {
            type: Date,
            required: [true, 'Start date is required'],
            index: true,
        },
        endDate: {
            type: Date,
            required: [true, 'End date is required'],
        },
        startTime: {
            type: String,
            match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'],
        },
        endTime: {
            type: String,
            match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)'],
        },
        days: {
            type: Number,
            required: true,
            min: 0,
        },
        hours: {
            type: Number,
            min: 0,
        },
        reason: {
            type: String,
            required: [true, 'Reason is required'],
            trim: true,
        },
        attachments: [{
            type: String,
        }],
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'cancelled'],
            default: 'pending',
            index: true,
        },
        currentApprovalStep: {
            type: Number,
            default: 1,
            min: 1,
        },
        approvalFlow: {
            type: Schema.Types.ObjectId,
            ref: 'ApprovalFlow',
        },
        approvalHistory: {
            type: [approvalHistorySchema],
            default: [],
        },
        approvedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        approvedByName: {
            type: String,
        },
        approvedAt: {
            type: Date,
        },
        rejectedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        rejectedByName: {
            type: String,
        },
        rejectedAt: {
            type: Date,
        },
        rejectedReason: {
            type: String,
        },
        cancelledAt: {
            type: Date,
        },
        cancelledReason: {
            type: String,
        },
        notificationSent: {
            type: Boolean,
            default: false,
        },
        reminderSent: {
            type: Boolean,
            default: false,
        },
        year: {
            type: Number,
            required: true,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

leaveRequestSchema.plugin(toJSON);

// Indexes
leaveRequestSchema.index({ user: 1, year: 1, status: 1 });
leaveRequestSchema.index({ status: 1, currentApprovalStep: 1 });
leaveRequestSchema.index({ startDate: 1, endDate: 1 });

// Pre-save middleware
leaveRequestSchema.pre('save', function (next) {
    // Set year from startDate
    if (this.startDate) {
        this.year = this.startDate.getFullYear();
    }
    next();
});

// Instance methods
leaveRequestSchema.methods.approve = async function (
    approverId: Types.ObjectId | string,
    comment?: string
): Promise<void> {
    const approverObjId = typeof approverId === 'string' ? new Types.ObjectId(approverId) : approverId;

    // Update approval history for current step
    const historyIndex = this.approvalHistory.findIndex(
        (h: IApprovalHistory) => h.step === this.currentApprovalStep && h.action === 'pending'
    );

    if (historyIndex !== -1) {
        this.approvalHistory[historyIndex].action = 'approved';
        this.approvalHistory[historyIndex].actionAt = new Date();
        this.approvalHistory[historyIndex].comment = comment;
    }

    // Check if this is the final approval
    const pendingSteps = this.approvalHistory.filter(
        (h: IApprovalHistory) => h.action === 'pending'
    );

    if (pendingSteps.length === 0) {
        // All steps approved
        this.status = 'approved';
        this.approvedBy = approverId;
        this.approvedAt = new Date();
    } else {
        // Move to next step
        this.currentApprovalStep += 1;
    }

    await this.save();
};

leaveRequestSchema.methods.reject = async function (
    approverId: Types.ObjectId | string,
    reason: string
): Promise<void> {
    const approverObjId = typeof approverId === 'string' ? new Types.ObjectId(approverId) : approverId;

    // Update approval history
    const historyIndex = this.approvalHistory.findIndex(
        (h: IApprovalHistory) => h.step === this.currentApprovalStep && h.action === 'pending'
    );

    if (historyIndex !== -1) {
        this.approvalHistory[historyIndex].action = 'rejected';
        this.approvalHistory[historyIndex].actionAt = new Date();
        this.approvalHistory[historyIndex].comment = reason;
    }

    this.status = 'rejected';
    this.rejectedBy = approverObjId;
    this.rejectedAt = new Date();
    this.rejectedReason = reason;

    await this.save();
};

leaveRequestSchema.methods.cancel = async function (reason?: string): Promise<void> {
    if (this.status !== 'pending') {
        throw new Error('Can only cancel pending requests');
    }

    this.status = 'cancelled';
    this.cancelledAt = new Date();
    this.cancelledReason = reason;

    await this.save();
};

// Static methods
leaveRequestSchema.statics.generateRequestNumber = async function (year: number): Promise<string> {
    const lastRequest = await this.findOne({ year })
        .sort({ requestNumber: -1 })
        .select('requestNumber')
        .lean();

    let sequence = 1;
    if (lastRequest && lastRequest.requestNumber) {
        const parts = lastRequest.requestNumber.split('-');
        if (parts.length === 2) {
            sequence = parseInt(parts[1]) + 1;
        }
    }

    return `LV${year}-${sequence.toString().padStart(5, '0')}`;
};

leaveRequestSchema.statics.findByUser = function (
    userId: Types.ObjectId | string,
    year?: number
): Promise<ILeaveRequestDoc[]> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const query: any = { user: userObjId };
    if (year) query.year = year;

    return this.find(query)
        .populate('leaveType', 'name code color icon')
        .sort({ createdAt: -1 })
        .exec();
};

leaveRequestSchema.statics.findPendingForApprover = async function (
    approverId: Types.ObjectId | string
): Promise<ILeaveRequestDoc[]> {
    const approverObjId = typeof approverId === 'string' ? new Types.ObjectId(approverId) : approverId;

    // Get approver's position
    const User = mongoose.model('User');
    const approver = await User.findById(approverObjId).select('position');

    if (!approver || !approver.position) {
        return [];
    }

    // Find pending requests where approver's position is in the current step
    return this.find({
        status: 'pending',
        'approvalHistory': {
            $elemMatch: {
                action: 'pending',
                $or: [
                    { approver: approverObjId },
                    { approverPosition: approver.position }
                ]
            }
        }
    })
        .populate('user', 'firstname lastname nickname position profile')
        .populate('leaveType', 'name code color icon')
        .sort({ createdAt: 1 })
        .exec();
};

leaveRequestSchema.statics.findByDateRange = function (
    startDate: Date,
    endDate: Date
): Promise<ILeaveRequestDoc[]> {
    return this.find({
        $or: [
            { startDate: { $gte: startDate, $lte: endDate } },
            { endDate: { $gte: startDate, $lte: endDate } },
            {
                startDate: { $lte: startDate },
                endDate: { $gte: endDate }
            }
        ],
        status: { $in: ['pending', 'approved'] }
    })
        .populate('user', 'firstname lastname nickname position')
        .populate('leaveType', 'name code color')
        .sort({ startDate: 1 })
        .exec();
};

const LeaveRequest = mongoose.model<ILeaveRequestDoc, ILeaveRequestModel>('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
