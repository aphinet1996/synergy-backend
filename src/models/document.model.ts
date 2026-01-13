import mongoose, { Schema } from 'mongoose';
import { IDocumentDoc, IDocumentModel } from '@/interfaces/document.interface';
import toJSON from '@utils/toJSON';

const documentSchema = new Schema<IDocumentDoc, IDocumentModel>(
    {
        clinicId: {
            type: Schema.Types.ObjectId,
            ref: 'Clinic',
            required: [true, 'Clinic ID is required'],
            index: true,
        },
        title: {
            type: String,
            required: [true, 'Document title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        content: {
            type: String,
            default: '<p></p>',
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

// Apply toJSON plugin
documentSchema.plugin(toJSON);

// Indexes for performance
documentSchema.index({ clinicId: 1, createdAt: -1 });
documentSchema.index({ clinicId: 1, title: 1 });

// Static methods
documentSchema.statics.findByClinic = function (clinicId: string) {
    return this.find({ clinicId })
        .sort({ updatedAt: -1 })
        .populate('createdBy', 'firstname lastname nickname')
        .populate('updatedBy', 'firstname lastname nickname');
};

const Document = mongoose.model<IDocumentDoc, IDocumentModel>(
    'Document',
    documentSchema
);

export default Document;