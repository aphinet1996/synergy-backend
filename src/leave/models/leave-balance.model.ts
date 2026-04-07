import mongoose, { Schema, Types } from 'mongoose';
import { ILeaveBalanceDoc, ILeaveBalanceModel, ILeaveBalanceItem, IBalanceHistory } from '../interfaces/leave-balance.interface';
import toJSON from '@utils/toJSON';

const balanceHistorySchema = new Schema<IBalanceHistory>(
    {
        action: {
            type: String,
            enum: [
                'init', 'request_pending', 'request_approved', 'request_rejected',
                'request_cancelled', 'adjustment', 'carry_over', 'carry_over_expired', 'correction'
            ],
            required: true,
        },
        date: {
            type: Date,
            default: Date.now,
        },
        before: {
            total: { type: Number, required: true },
            used: { type: Number, required: true },
            pending: { type: Number, required: true },
            remaining: { type: Number, required: true },
        },
        after: {
            total: { type: Number, required: true },
            used: { type: Number, required: true },
            pending: { type: Number, required: true },
            remaining: { type: Number, required: true },
        },
        days: {
            type: Number,
            required: true,
        },
        requestId: {
            type: Schema.Types.ObjectId,
            ref: 'LeaveRequest',
        },
        adjustmentId: {
            type: Schema.Types.ObjectId,
            ref: 'LeaveAdjustment',
        },
        performedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        performedByName: {
            type: String,
        },
        note: {
            type: String,
        },
    },
    { _id: false }
);

const leaveBalanceItemSchema = new Schema<ILeaveBalanceItem>(
    {
        leaveType: {
            type: Schema.Types.ObjectId,
            ref: 'LeaveType',
            required: true,
        },
        leaveTypeCode: {
            type: String,
            enum: ['annual', 'sick', 'personal', 'maternity', 'ordination', 'military', 'other'],
        },
        leaveTypeName: {
            type: String,
        },
        // ยอดจากแหล่งต่างๆ
        fromQuota: {
            type: Number,
            default: 0,
            min: 0,
        },
        fromCarryOver: {
            type: Number,
            default: 0,
            min: 0,
        },
        carryOverExpiryDate: {
            type: Date,
        },
        fromAdjustment: {
            type: Number,
            default: 0,
        },
        // รวม
        total: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        // การใช้ (FIFO)
        usedFromCarryOver: {
            type: Number,
            default: 0,
            min: 0,
        },
        usedFromQuota: {
            type: Number,
            default: 0,
            min: 0,
        },
        used: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        pending: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        remaining: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        // Audit trail
        history: {
            type: [balanceHistorySchema],
            default: [],
        },
    },
    { _id: false }
);

const leaveBalanceSchema = new Schema<ILeaveBalanceDoc, ILeaveBalanceModel>(
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
        balances: {
            type: [leaveBalanceItemSchema],
            default: [],
        },
        lastUpdated: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

leaveBalanceSchema.plugin(toJSON);

// Compound unique index
leaveBalanceSchema.index({ user: 1, year: 1 }, { unique: true });

// Helper Function
/**
 * Extract ID from leaveType field (handles both ObjectId and populated object)
 */
function getLeaveTypeId(leaveType: any): string {
    if (typeof leaveType === 'object' && leaveType._id) {
        return leaveType._id.toString();
    }
    return leaveType.toString();
}

// Instance Methods

leaveBalanceSchema.methods.updateBalance = async function (
    leaveTypeId: Types.ObjectId | string,
    daysUsed: number,
    isPending: boolean = true
): Promise<void> {
    const typeIdStr = leaveTypeId.toString();
    const balanceIndex = this.balances.findIndex(
        (b: ILeaveBalanceItem) => getLeaveTypeId(b.leaveType) === typeIdStr
    );

    if (balanceIndex === -1) {
        throw new Error('Leave type not found in balance');
    }

    const balance = this.balances[balanceIndex];

    if (isPending) {
        balance.pending += daysUsed;
    } else {
        balance.used += daysUsed;
    }
    balance.remaining = balance.total - balance.used - balance.pending;

    if (balance.remaining < 0) {
        throw new Error('Insufficient leave balance');
    }

    this.lastUpdated = new Date();
    await this.save();
};

leaveBalanceSchema.methods.releaseBalance = async function (
    leaveTypeId: Types.ObjectId | string,
    days: number,
    fromPending: boolean = true
): Promise<void> {
    const typeIdStr = leaveTypeId.toString();
    const balanceIndex = this.balances.findIndex(
        (b: ILeaveBalanceItem) => getLeaveTypeId(b.leaveType) === typeIdStr
    );

    if (balanceIndex === -1) {
        throw new Error('Leave type not found in balance');
    }

    const balance = this.balances[balanceIndex];

    if (fromPending) {
        balance.pending = Math.max(0, balance.pending - days);
    } else {
        balance.used = Math.max(0, balance.used - days);
    }
    balance.remaining = balance.total - balance.used - balance.pending;

    this.lastUpdated = new Date();
    await this.save();
};

leaveBalanceSchema.methods.confirmPending = async function (
    leaveTypeId: Types.ObjectId | string,
    days: number
): Promise<void> {
    const typeIdStr = leaveTypeId.toString();
    const balanceIndex = this.balances.findIndex(
        (b: ILeaveBalanceItem) => getLeaveTypeId(b.leaveType) === typeIdStr
    );

    if (balanceIndex === -1) {
        throw new Error('Leave type not found in balance');
    }

    const balance = this.balances[balanceIndex];

    balance.pending = Math.max(0, balance.pending - days);
    balance.used += days;
    balance.remaining = balance.total - balance.used - balance.pending;

    this.lastUpdated = new Date();
    await this.save();
};

// Static Methods

leaveBalanceSchema.statics.findOrCreateForUser = async function (
    userId: Types.ObjectId | string,
    year: number
): Promise<ILeaveBalanceDoc> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    let balance = await this.findOne({ user: userObjId, year });

    if (!balance) {
        balance = await this.create({
            user: userObjId,
            year,
            balances: [],
            lastUpdated: new Date(),
        });
    }

    return balance;
};

leaveBalanceSchema.statics.findByUserAndYear = function (
    userId: Types.ObjectId | string,
    year: number
): Promise<ILeaveBalanceDoc | null> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return this.findOne({ user: userObjId, year })
        .populate('balances.leaveType', 'name code color icon')
        .exec();
};

leaveBalanceSchema.statics.initializeForUser = async function (
    userId: Types.ObjectId | string,
    year: number,
    quotas: ILeaveBalanceItem[]
): Promise<ILeaveBalanceDoc> {
    const userObjId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    // Check if already exists
    const existing = await this.findOne({ user: userObjId, year });

    if (existing) {
        // Update existing balance with new quotas (preserve used/pending)
        for (const quota of quotas) {
            const quotaLeaveTypeId = getLeaveTypeId(quota.leaveType);
            const existingIndex = existing.balances.findIndex(
                (b: ILeaveBalanceItem) => getLeaveTypeId(b.leaveType) === quotaLeaveTypeId
            );

            if (existingIndex === -1) {
                existing.balances.push(quota);
            } else {
                // Update total but preserve used/pending
                existing.balances[existingIndex].total = quota.total;
                existing.balances[existingIndex].fromCarryOver = quota.fromCarryOver || 0;
                existing.balances[existingIndex].remaining =
                    quota.total -
                    existing.balances[existingIndex].used -
                    existing.balances[existingIndex].pending;
            }
        }
        existing.lastUpdated = new Date();
        return existing.save();
    }

    // Create new balance
    return this.create({
        user: userObjId,
        year,
        balances: quotas.map(q => ({
            ...q,
            used: 0,
            pending: 0,
            remaining: q.total,
        })),
        lastUpdated: new Date(),
    });
};

const LeaveBalance = mongoose.model<ILeaveBalanceDoc, ILeaveBalanceModel>('LeaveBalance', leaveBalanceSchema);

export default LeaveBalance;