import mongoose, { Schema } from 'mongoose';
import { IClinicDoc, IClinicModel } from '@/interfaces/clinic.interface';
import toJSON from '@utils/toJSON';

const serviceItemSchema = new Schema(
    {
        name: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const setupSchema = new Schema(
    {
        requirement: { type: Boolean, default: false },
        socialMedia: { type: Boolean, default: false },
        adsManager: { type: Boolean, default: false },
    },
    { _id: false }
);

const serviceSchema = new Schema(
    {
        setup: { type: setupSchema, default: {} },
        coperateIdentity: { type: [serviceItemSchema], default: [] },
        website: { type: [serviceItemSchema], default: [] },
        socialMedia: { type: [serviceItemSchema], default: [] },
        training: { type: [serviceItemSchema], default: [] },
    },
    { _id: false }
);

const nameSchema = new Schema(
    {
        en: { type: String, required: true },
        th: { type: String, required: true },
    },
    { _id: false }
);

const timelineItemSchema = new Schema(
    {
        serviceType: {
            type: String,
            enum: ['setup', 'coperateIdentity', 'website', 'socialMedia', 'training'],
            required: true,
        },
        serviceName: {
            type: String,
            required: true,
            trim: true,
        },
        serviceAmount: {
            type: String,
            required: true,
            default: '---',
        },
        weekStart: {
            type: Number,
            required: true,
            min: 0,
        },
        weekEnd: {
            type: Number,
            required: true,
            min: 0,
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        updatedAt: {
            type: Date,
            default: null,
        },
    },
    { _id: true }
);

// Main schema with explicit types
const clinicSchema = new Schema<IClinicDoc, IClinicModel>(
    {
        name: {
            type: nameSchema,
            required: true,
        },
        clinicProfile: {
            type: String,
            default: null,
        },
        clinicLevel: {
            type: String,
            enum: ['premium', 'standard', 'basic'],
            required: true,
            default: 'standard',
        },
        contractType: {
            type: String,
            enum: ['yearly', 'monthly', 'project'],
            required: true,
        },
        contractDateStart: {
            type: Date,
            required: true,
        },
        contractDateEnd: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'pending'],
            default: 'active',
        },
        assignedTo: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        note: {
            type: String,
            default: null,
        },
        service: {
            type: serviceSchema,
            default: {},
        },
        procedures: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Procedure',
            },
        ],
        timeline: {
            type: [timelineItemSchema],
            default: [],
        },
        totalWeeks: {
            type: Number,
            default: 0,
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

clinicSchema.plugin(toJSON);

clinicSchema.index({ status: 1, assignedTo: 1 });
clinicSchema.index({ contractDateEnd: 1 });

// Static methods
clinicSchema.statics.findByUser = function (userId: string): Promise<IClinicDoc[]> {
    return this.find({ assignedTo: userId }).exec();
};

clinicSchema.statics.isClinicExist = async function (
    name: { en: string; th: string }
): Promise<boolean> {
    const count = await this.countDocuments({
        'name.en': name.en,
        'name.th': name.th,
    });
    return count > 0;
};

const Clinic = mongoose.model<IClinicDoc, IClinicModel>('Clinic', clinicSchema);

export default Clinic;