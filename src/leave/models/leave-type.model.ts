import mongoose, { Schema } from 'mongoose';
import { ILeaveTypeDoc, ILeaveTypeModel, LeaveTypeCode } from '../interfaces/leave-type.interface';
import toJSON from '@utils/toJSON';

const leaveTypeSchema = new Schema<ILeaveTypeDoc, ILeaveTypeModel>(
    {
        code: {
            type: String,
            required: [true, 'Leave type code is required'],
            unique: true,
            enum: ['annual', 'sick', 'personal', 'maternity', 'ordination', 'military', 'other'],
            trim: true,
        },
        name: {
            type: String,
            required: [true, 'Leave type name is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        defaultDays: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        maxDaysPerYear: {
            type: Number,
            required: true,
            min: 0,
        },
        allowHalfDay: {
            type: Boolean,
            default: true,
        },
        allowHours: {
            type: Boolean,
            default: false,
        },
        requireAttachment: {
            type: Boolean,
            default: false,
        },
        allowPastDate: {
            type: Boolean,
            default: false,
        },
        pastDateLimit: {
            type: Number,
            default: 7,
            min: 0,
        },
        requireApproval: {
            type: Boolean,
            default: true,
        },
        color: {
            type: String,
            default: '#6B7280', // gray
        },
        icon: {
            type: String,
        },
        sortOrder: {
            type: Number,
            default: 0,
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

leaveTypeSchema.plugin(toJSON);

leaveTypeSchema.index({ code: 1 });
leaveTypeSchema.index({ isActive: 1, sortOrder: 1 });

// Static methods
leaveTypeSchema.statics.findByCode = function (code: LeaveTypeCode): Promise<ILeaveTypeDoc | null> {
    return this.findOne({ code, isActive: true });
};

leaveTypeSchema.statics.findActiveTypes = function (): Promise<ILeaveTypeDoc[]> {
    return this.find({ isActive: true }).sort({ sortOrder: 1 }).exec();
};

const LeaveType = mongoose.model<ILeaveTypeDoc, ILeaveTypeModel>('LeaveType', leaveTypeSchema);

export default LeaveType;
