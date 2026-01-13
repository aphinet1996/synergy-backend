import mongoose, { Schema } from 'mongoose';
import { IProcedureDoc, IProcedureModel } from '@/interfaces/procedure.interface';
import toJSON from '@utils/toJSON';

const procedureSchema = new Schema<IProcedureDoc, IProcedureModel>(
    {
        name: {
            type: String,
            required: [true, 'Procedure name is required'],
            trim: true,
            unique: true,
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

procedureSchema.plugin(toJSON);

// Indexes
procedureSchema.index({ name: 1 });
procedureSchema.index({ isActive: 1 });

// Static methods
procedureSchema.statics.isNameExist = async function (
    name: string,
    excludeId?: string
): Promise<boolean> {
    const query: any = { name: { $regex: new RegExp(`^${name}$`, 'i') } };
    if (excludeId) {
        query._id = { $ne: excludeId };
    }
    const count = await this.countDocuments(query);
    return count > 0;
};

const Procedure = mongoose.model<IProcedureDoc, IProcedureModel>('Procedure', procedureSchema);

export default Procedure;