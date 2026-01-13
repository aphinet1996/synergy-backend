import mongoose, { Schema } from 'mongoose';
import { ITodoDoc, ITodoModel } from '@/interfaces/todo.interface';
import toJSON from '@utils/toJSON';

const todoSchema = new Schema<ITodoDoc, ITodoModel>(
    {
        name: {
            type: String,
            required: [true, 'Todo name is required'],
        },
        description: {
            type: String,
        },
        clinicId: {
            type: Schema.Types.ObjectId,
            ref: 'Clinic',
            required: [true, 'Clinic ID is required'],
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium',
        },
        status: {
            type: String,
            enum: ['pending', 'done'],
            default: 'pending',
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

todoSchema.plugin(toJSON);

todoSchema.index({ clinicId: 1, status: 1 });
todoSchema.index({ createdBy: 1, createdAt: -1 });
todoSchema.index({ createdAt: -1 });

// Static methods
todoSchema.statics.findByClinic = function (clinicId: string): Promise<ITodoDoc[]> {
    return this.find({ clinicId }).populate('clinicId', 'name clinicLevel').exec();
};

todoSchema.statics.findByUser = function (userId: string): Promise<ITodoDoc[]> {
    return this.find({ createdBy: userId }).populate('clinicId', 'name').exec();
};

todoSchema.statics.isTodoExist = async function (name: string, clinicId: string): Promise<boolean> {
    const count = await this.countDocuments({ name, clinicId });
    return count > 0;
};

const Todo = mongoose.model<ITodoDoc, ITodoModel>('Todo', todoSchema);

export default Todo;