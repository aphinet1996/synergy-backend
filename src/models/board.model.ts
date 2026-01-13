import mongoose, { Schema } from 'mongoose';
import { IBoardDoc, IBoardModel } from '@/interfaces/board.interface';
import toJSON from '@utils/toJSON';

const boardSchema = new Schema<IBoardDoc, IBoardModel>(
    {
        clinicId: {
            type: Schema.Types.ObjectId,
            ref: 'Clinic',
            required: [true, 'Clinic ID is required'],
            index: true,
        },
        procedureId: {
            type: Schema.Types.ObjectId,
            ref: 'Procedure',
            required: [true, 'Procedure ID is required'],
            index: true,
        },
        name: {
            type: String,
            required: [true, 'Board name is required'],
            trim: true,
        },
        description: {
            type: String,
            default: null,
            trim: true,
        },
        elements: {
            type: [Schema.Types.Mixed],
            default: [],
        },
        appState: {
            type: Schema.Types.Mixed,
            default: undefined,
        },
        files: {
            type: Schema.Types.Mixed,
            default: undefined,
        },
        members: [{
            type: Schema.Types.ObjectId,
            ref: 'User',
        }],
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

boardSchema.plugin(toJSON);

// Indexes
boardSchema.index({ clinicId: 1, procedureId: 1 });

const Board = mongoose.model<IBoardDoc, IBoardModel>('Board', boardSchema);

export default Board;