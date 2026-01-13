import mongoose, { Schema } from 'mongoose';
import { IPositionDoc, IPositionModel } from '@/interfaces/position.interface';
import toJSON from '@utils/toJSON';

const positionSchema = new Schema<IPositionDoc, IPositionModel>(
    {
        name: {
            type: String,
            required: [true, 'Position name is required'],
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
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

positionSchema.plugin(toJSON);

positionSchema.index({ name: 1 });
positionSchema.index({ isActive: 1 });

// Static methods
positionSchema.statics.isPositionExist = async function (name: string): Promise<boolean> {
    const count = await this.countDocuments({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    return count > 0;
};

positionSchema.statics.findActivePositions = function (): Promise<IPositionDoc[]> {
    return this.find({ isActive: true }).sort({ name: 1 }).exec();
};

const Position = mongoose.model<IPositionDoc, IPositionModel>('Position', positionSchema);

export default Position;