import mongoose, { Schema, Types } from 'mongoose';
import { ICarryOverConfigDoc, ICarryOverConfigModel } from '../interfaces/carry-over-config.interface';
import toJSON from '@utils/toJSON';

const carryOverConfigSchema = new Schema<ICarryOverConfigDoc, ICarryOverConfigModel>(
    {
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
        method: {
            type: String,
            enum: ['none', 'all', 'fixed', 'percentage', 'percentage_capped'],
            required: [true, 'Carry over method is required'],
            default: 'none',
        },
        maxDays: {
            type: Number,
            min: 0,
        },
        percentage: {
            type: Number,
            min: 0,
            max: 100,
        },
        expiryRule: {
            type: String,
            enum: ['none', 'end_of_quarter', 'end_of_half_year', 'fixed_months', 'fixed_date'],
            default: 'none',
        },
        expiryMonths: {
            type: Number,
            min: 1,
        },
        expiryDate: {
            type: Date,
        },
        expiryQuarter: {
            type: Number,
            enum: [1, 2],
        },
        useFIFO: {
            type: Boolean,
            default: true,
        },
        minServiceMonths: {
            type: Number,
            min: 0,
        },
        eligiblePositions: [{
            type: Schema.Types.ObjectId,
            ref: 'Position',
        }],
        eligibleEmployeeTypes: [{
            type: String,
            enum: ['permanent', 'probation', 'freelance'],
        }],
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
        },
    },
    {
        timestamps: true,
    }
);

carryOverConfigSchema.plugin(toJSON);

// Compound unique index
carryOverConfigSchema.index({ year: 1, leaveType: 1 }, { unique: true });

// Validation
carryOverConfigSchema.pre('save', function (next) {
    // Validate method-specific fields
    if (this.method === 'fixed' || this.method === 'percentage_capped') {
        if (this.maxDays === undefined || this.maxDays === null) {
            return next(new Error('maxDays is required for fixed/percentage_capped method'));
        }
    }

    if (this.method === 'percentage' || this.method === 'percentage_capped') {
        if (this.percentage === undefined || this.percentage === null) {
            return next(new Error('percentage is required for percentage method'));
        }
    }

    // Validate expiry-specific fields
    if (this.expiryRule === 'fixed_months' && !this.expiryMonths) {
        return next(new Error('expiryMonths is required for fixed_months expiry rule'));
    }

    if (this.expiryRule === 'fixed_date' && !this.expiryDate) {
        return next(new Error('expiryDate is required for fixed_date expiry rule'));
    }

    next();
});

// Static methods
carryOverConfigSchema.statics.findByYearAndLeaveType = function (
    year: number,
    leaveTypeId: Types.ObjectId | string
): Promise<ICarryOverConfigDoc | null> {
    const leaveTypeObjId = typeof leaveTypeId === 'string' ? new Types.ObjectId(leaveTypeId) : leaveTypeId;
    return this.findOne({
        year,
        leaveType: leaveTypeObjId,
        isActive: true,
    })
        .populate('leaveType', 'name code')
        .exec();
};

carryOverConfigSchema.statics.findByYear = function (year: number): Promise<ICarryOverConfigDoc[]> {
    return this.find({ year, isActive: true })
        .populate('leaveType', 'name code')
        .populate('eligiblePositions', 'name')
        .sort({ leaveType: 1 })
        .exec();
};

const CarryOverConfig = mongoose.model<ICarryOverConfigDoc, ICarryOverConfigModel>(
    'CarryOverConfig',
    carryOverConfigSchema
);

export default CarryOverConfig;
