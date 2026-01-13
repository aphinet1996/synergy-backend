// import { Types, Document, Model, Query } from 'mongoose';

// export type taskPriority = 'low' | 'medium' | 'high' | 'urgent';
// export type taskStatus = 'pending' | 'process' | 'review' | 'done' | 'delete';

// export interface IWorkloadItem {
//     section: string;
//     amount: number;
// }

// export interface IWorkload {
//     video: IWorkloadItem[];
//     website: IWorkloadItem[];
//     image: IWorkloadItem[];
//     shooting: IWorkloadItem[];
// }

// export interface IComment {
//     text: string;
//     user: Types.ObjectId;
//     date?: Date;
// }

// export interface IProcess {
//     name: string;
//     assignee: Types.ObjectId[];
//     comments?: IComment[];
//     attachments: string[];
//     status: taskStatus;
// }

// export interface ITask {
//     name: string;
//     description: string;
//     attachments: string[];
//     priority: taskPriority;
//     status: taskStatus;
//     tag?: string[];
//     startDate: Date;
//     dueDate: Date;
//     clinicId: Types.ObjectId;
//     process: IProcess[];
//     workload: IWorkload;
//     createdAt?: Date;
//     updatedAt?: Date;
//     createdBy: Types.ObjectId;
//     updatedBy?: Types.ObjectId;
// }

// export interface ITaskDoc extends ITask, Document { }

// export interface ITaskModel extends Model<ITaskDoc> {
//     findByClinic(clinicId: string): Query<ITaskDoc[], ITaskDoc>;
//     findByUser(userId: string): Query<ITaskDoc[], ITaskDoc>;
//     isTaskExist(name: string, clinicId: string): Promise<boolean>;
// }

// export type CreateTaskBody = Omit<ITask,
//     'status' | 'createdAt' | 'updatedAt' | 'updatedBy'
// >;

// export type UpdateTaskBody = Partial<ITask>;

// export type CreateCommentBody = Omit<IComment, 'date'>;

// // DTO for clinic in task response
// export interface TaskClinicDTO {
//     id: string;
//     name: {
//         en: string;
//         th: string;
//     };
// }

// // DTO for assignee in task response
// export interface TaskAssigneeDTO {
//     id: string;
//     firstname: string;
//     lastname: string;
//     nickname: string;
// }

// // DTO for task list response
// export interface TaskListResponseDTO {
//     id: string;
//     name: string;
//     description: string;
//     priority: taskPriority;
//     status: taskStatus;
//     dueDate: string;
//     tag: string[];
//     clinic: TaskClinicDTO;
//     assignee: TaskAssigneeDTO[];
//     commentAmount: number;
//     attachmentsAmount: number;
//     createdAt: string;
//     createdBy: string;
// }

import { Types, Document, Model, Query } from 'mongoose';

export type taskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type taskStatus = 'pending' | 'process' | 'review' | 'done' | 'delete';

export interface IWorkloadItem {
    section: string;
    amount: number;
}

export interface IWorkload {
    video: IWorkloadItem[];
    website: IWorkloadItem[];
    image: IWorkloadItem[];
    shooting: IWorkloadItem[];
}

export interface IComment {
    text: string;
    user: Types.ObjectId;
    date?: Date;
}

export interface IProcess {
    name: string;
    assignee: Types.ObjectId[];
    comments?: IComment[];
    attachments: string[];
    status: taskStatus;
}

export interface ITask {
    name: string;
    description: string;
    attachments: string[];
    priority: taskPriority;
    status: taskStatus;
    tag?: string[];
    startDate: Date;
    dueDate: Date;
    clinicId: Types.ObjectId;
    process: IProcess[];
    workload: IWorkload;
    createdAt?: Date;
    updatedAt?: Date;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

export interface ITaskDoc extends ITask, Document { }

export interface ITaskModel extends Model<ITaskDoc> {
    findByClinic(clinicId: string): Query<ITaskDoc[], ITaskDoc>;
    findByUser(userId: string): Query<ITaskDoc[], ITaskDoc>;
    isTaskExist(name: string, clinicId: string): Promise<boolean>;
}

export type CreateTaskBody = Omit<ITask,
    'status' | 'createdAt' | 'updatedAt' | 'updatedBy'
>;

export type UpdateTaskBody = Partial<ITask>;

export type CreateCommentBody = Omit<IComment, 'date'>;

// DTO for clinic in task response
export interface TaskClinicDTO {
    id: string;
    name: {
        en: string;
        th: string;
    };
}

// DTO for assignee in task response
export interface TaskAssigneeDTO {
    id: string;
    firstname: string;
    lastname: string;
    nickname: string;
}

// DTO for process in task list response
export interface TaskProcessDTO {
    id: string;
    name: string;
    status: taskStatus;
    assignee: TaskAssigneeDTO[];
}

// DTO for task list response
export interface TaskListResponseDTO {
    id: string;
    name: string;
    description: string;
    priority: taskPriority;
    status: taskStatus;
    dueDate: string;
    tag: string[];
    clinic: TaskClinicDTO;
    process: TaskProcessDTO[];
    commentAmount: number;
    attachmentsAmount: number;
    createdAt: string;
    createdBy: string;
}