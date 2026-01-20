// import mongoose, { Schema } from 'mongoose';
// import { ITaskDoc, ITaskModel } from '@/interfaces/task.interface';
// import toJSON from '@utils/toJSON';

// const workloadItemSchema = new Schema(
//     {
//         section: { type: String, required: true },
//         amount: { type: Number, required: true, min: 0 },
//     },
//     { _id: false }
// );

// const workloadSchema = new Schema(
//     {
//         video: { type: [workloadItemSchema], default: [] },
//         website: { type: [workloadItemSchema], default: [] },
//         image: { type: [workloadItemSchema], default: [] },
//         shooting: { type: [workloadItemSchema], default: [] },
//     },
//     { _id: false }
// );

// const commentSchema = new Schema(
//     {
//         text: { type: String, required: true },
//         user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
//         date: { type: Date, default: Date.now },
//     },
//     { _id: true }
// );

// const processSchema = new Schema(
//     {
//         name: { type: String, required: true },
//         assignee: [
//             {
//                 type: Schema.Types.ObjectId,
//                 ref: 'User',
//             },
//         ],
//         comments: { type: [commentSchema], default: [] },
//         attachments: { type: [String], default: [] },
//         status: {
//             type: String,
//             enum: ['pending', 'process', 'review', 'done', 'delete'],
//             default: 'pending',
//         },
//     },
//     { _id: true }
// );

// const taskSchema = new Schema<ITaskDoc, ITaskModel>(
//     {
//         name: {
//             type: String,
//             required: [true, 'Task name is required'],
//         },
//         description: {
//             type: String,
//             required: [true, 'Description is required'],
//         },
//         attachments: {
//             type: [String],
//             default: [],
//         },
//         priority: {
//             type: String,
//             enum: ['low', 'medium', 'high', 'urgent'],
//             default: 'medium',
//         },
//         status: {
//             type: String,
//             enum: ['pending', 'process', 'review', 'done', 'delete'],
//             default: 'pending',
//         },
//         tag: {
//             type: [String],
//             default: [],
//         },
//         startDate: {
//             type: Date,
//             required: [true, 'Start date is required'],
//         },
//         dueDate: {
//             type: Date,
//             required: [true, 'Due date is required'],
//         },
//         clinicId: {
//             type: Schema.Types.ObjectId,
//             ref: 'Clinic',
//             required: [true, 'Clinic ID is required'],
//         },
//         process: {
//             type: [processSchema],
//             default: [],
//         },
//         workload: {
//             type: workloadSchema,
//             default: {},
//         },
//         createdBy: {
//             type: Schema.Types.ObjectId,
//             ref: 'User',
//             required: [true, 'Created by is required'],
//         },
//         updatedBy: {
//             type: Schema.Types.ObjectId,
//             ref: 'User',
//             default: null,
//         },
//     },
//     {
//         timestamps: true,
//     }
// );

// taskSchema.plugin(toJSON);

// taskSchema.index({ clinicId: 1, status: 1 });
// taskSchema.index({ dueDate: 1 });
// taskSchema.index({ 'process.assignee': 1 });

// // Static methods
// taskSchema.statics.findByClinic = function (clinicId: string): Promise<ITaskDoc[]> {
//     return this.find({ clinicId }).populate('clinicId', 'name clinicLevel').exec();
// };

// taskSchema.statics.findByUser = function (userId: string): Promise<ITaskDoc[]> {
//     return this.find({
//         $or: [
//             { createdBy: userId },
//             { 'process.assignee': userId },
//         ],
//     }).populate('clinicId', 'name').exec();
// };

// taskSchema.statics.isTaskExist = async function (name: string, clinicId: string): Promise<boolean> {
//     const count = await this.countDocuments({ name, clinicId });
//     return count > 0;
// };

// const Task = mongoose.model<ITaskDoc, ITaskModel>('Task', taskSchema);

// export default Task;

import mongoose, { Schema } from 'mongoose';
import { ITaskDoc, ITaskModel } from '@/interfaces/task.interface';
import toJSON from '@utils/toJSON';

const attachmentSchema = new Schema(
    {
        url: { type: String, required: true },
        filename: { type: String, required: true },
        originalName: { type: String, required: true },
        size: { type: Number, required: true },
        mimetype: { type: String, required: true },
    },
    { _id: false }
);

const workloadItemSchema = new Schema(
    {
        section: { type: String, required: true },
        amount: { type: Number, required: true, min: 0 },
    },
    { _id: false }
);

const workloadSchema = new Schema(
    {
        video: { type: [workloadItemSchema], default: [] },
        website: { type: [workloadItemSchema], default: [] },
        image: { type: [workloadItemSchema], default: [] },
        shooting: { type: [workloadItemSchema], default: [] },
    },
    { _id: false }
);

const commentSchema = new Schema(
    {
        text: { type: String, required: true },
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, default: Date.now },
    },
    { _id: true }
);

const processSchema = new Schema(
    {
        name: { type: String, required: true },
        assignee: [
            {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        comments: { type: [commentSchema], default: [] },
        attachments: { type: [attachmentSchema], default: [] },
        status: {
            type: String,
            enum: ['pending', 'process', 'review', 'done', 'delete'],
            default: 'pending',
        },
    },
    { _id: true }
);

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
        attachments: {
            type: [attachmentSchema],
            default: [],
        },
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
        tag: {
            type: [String],
            default: [],
        },
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
        process: {
            type: [processSchema],
            default: [],
        },
        workload: {
            type: workloadSchema,
            default: {},
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

taskSchema.plugin(toJSON);

taskSchema.index({ clinicId: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ 'process.assignee': 1 });

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