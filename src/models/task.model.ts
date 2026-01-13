import mongoose, { Schema } from 'mongoose';
import { ITaskDoc, ITaskModel } from '@/interfaces/task.interface';
import toJSON from '@utils/toJSON';

const workloadItemSchema = new Schema({
    section: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
}, { _id: false });

const workloadSchema = new Schema({
    video: [workloadItemSchema],
    website: [workloadItemSchema],
    image: [workloadItemSchema],
    shooting: [workloadItemSchema],
}, { _id: false });

const commentSchema = new Schema({
    text: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, default: Date.now },
});

const processSchema = new Schema({
    name: { type: String, required: true },
    assignee: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    comments: [commentSchema],
    attachments: [{ type: String }],
    status: {
        type: String,
        enum: ['pending', 'process', 'review', 'done', 'delete'],
        default: 'pending',
    },
});

const taskSchema = new Schema<ITaskDoc, ITaskModel>(
    {
        name: {
            type: String,
            required: [true, 'Task name is required'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
        },
        attachments: [{
            type: String,
        }],
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent'],
            default: 'medium',
        },
        status: {
            type: String,
            enum: ['pending', 'process', 'review', 'done', 'delete'],
            default: 'pending',
        },
        tag: [{
            type: String,
        }],
        startDate: {
            type: Date,
            required: [true, 'Start date is required'],
        },
        dueDate: {
            type: Date,
            required: [true, 'Due date is required'],
        },
        clinicId: {
            type: Schema.Types.ObjectId,
            ref: 'Clinic',
            required: [true, 'Clinic ID is required'],
        },
        process: [processSchema],
        workload: workloadSchema,
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

taskSchema.plugin(toJSON);

taskSchema.index({ clinicId: 1, status: 1 });
taskSchema.index({ 'dueDate': 1 });
taskSchema.index({ 'assignee': 1 });

// Static methods
taskSchema.statics.findByClinic = function (clinicId: string): Promise<ITaskDoc[]> {
    return this.find({ clinicId }).populate('clinicId', 'name clinicLevel').exec();
};

taskSchema.statics.findByUser = function (userId: string): Promise<ITaskDoc[]> {
    return this.find({
        $or: [
            { createdBy: userId },
            { 'process.assignee': userId },
        ],
    }).populate('clinicId', 'name').exec();
};

taskSchema.statics.isTaskExist = async function (name: string, clinicId: string): Promise<boolean> {
    const count = await this.countDocuments({ name, clinicId });
    return count > 0;
};

const Task = mongoose.model<ITaskDoc, ITaskModel>('Task', taskSchema);

export default Task;