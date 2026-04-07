import mongoose, { Schema, Types, Model } from 'mongoose';
import { ILeaveQuotaDoc, ILeaveQuotaModel, ILeaveQuotaConfig } from '../interfaces/leave-quota.interface';
import toJSON from '@utils/toJSON';

const leaveQuotaConfigSchema = new Schema(
    {
        leaveType: {
            type: Schema.Types.ObjectId,
            ref: 'LeaveType',
            required: true,
        },
        leaveTypeCode: {
            type: String,
        },
        days: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    { _id: false }
);

const leaveQuotaSchema = new Schema(
    {
        year: {
            type: Number,
            required: [true, 'Year is required'],
            index: true,
        },
        position: {
            type: Schema.Types.ObjectId,
            ref: 'Position',
            default: null,
        },
        positionName: {
            type: String,
        },
        employeeType: {
            type: String,
            enum: ['permanent', 'probation', 'freelance', null],
            default: null,
        },
        quotas: {
            type: [leaveQuotaConfigSchema],
            required: true,
            validate: {
                validator: function (v: ILeaveQuotaConfig[]) {
                    return v && v.length > 0;
                },
                message: 'At least one quota configuration is required',
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

leaveQuotaSchema.plugin(toJSON);

leaveQuotaSchema.index({ year: 1, position: 1, employeeType: 1 });
leaveQuotaSchema.index({ year: 1, isDefault: 1 });

// Static methods
leaveQuotaSchema.statics.findQuotaForUser = async function (
    year: number,
    positionId?: Types.ObjectId | string,
    employeeType?: string
): Promise<ILeaveQuotaDoc | null> {
    const posObjId = positionId
        ? (typeof positionId === 'string' ? new Types.ObjectId(positionId) : positionId)
        : undefined;

    // Priority 1: Specific position + employee type
    if (posObjId && employeeType) {
        const specificQuota = await this.findOne({
            year,
            position: posObjId,
            employeeType,
            isActive: true,
        }).populate('quotas.leaveType');
        if (specificQuota) return specificQuota;
    }

    // Priority 2: Specific position (any employee type)
    if (posObjId) {
        const positionQuota = await this.findOne({
            year,
            position: posObjId,
            employeeType: null,
            isActive: true,
        }).populate('quotas.leaveType');
        if (positionQuota) return positionQuota;
    }

    // Priority 3: Specific employee type (any position)
    if (employeeType) {
        const typeQuota = await this.findOne({
            year,
            position: null,
            employeeType,
            isActive: true,
        }).populate('quotas.leaveType');
        if (typeQuota) return typeQuota;
    }

    // Priority 4: Default quota
    return this.findOne({
        year,
        isDefault: true,
        isActive: true,
    }).populate('quotas.leaveType');
};

leaveQuotaSchema.statics.findByYear = function (year: number): Promise<ILeaveQuotaDoc[]> {
    return this.find({ year, isActive: true })
        .populate('position', 'name')
        .populate('quotas.leaveType', 'name code color icon')
        .sort({ isDefault: -1, createdAt: -1 })
        .exec();
};

const LeaveQuota = mongoose.model<ILeaveQuotaDoc, ILeaveQuotaModel>('LeaveQuota', leaveQuotaSchema);

export default LeaveQuota;