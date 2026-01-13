import { Types, Document, Model, Query } from 'mongoose';

export type todoPriority = 'low' | 'medium' | 'high' | 'urgent';
export type todoStatus = 'pending' | 'done';

export interface ITodo {
    name: string;
    description?: string;
    clinicId: Types.ObjectId;
    priority: todoPriority;
    status: todoStatus;
    createdAt?: Date;
    updatedAt?: Date;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

export interface ITodoDoc extends ITodo, Document { }

export interface ITodoModel extends Model<ITodoDoc> {
    findByClinic(clinicId: string): Query<ITodoDoc[], ITodoDoc>;
    findByUser(userId: string): Query<ITodoDoc[], ITodoDoc>;
    isTodoExist(name: string, clinicId: string): Promise<boolean>;
}

export type CreateTodoBody = Omit<ITodo, 'status' | 'createdAt' | 'updatedAt' | 'updatedBy'>;

export type UpdateTodoBody = Partial<ITodo>;

// DTO for clinic in todo response
export interface TodoClinicDTO {
    id: string;
    name: {
        en: string;
        th: string;
    };
}

// DTO for user in todo response
export interface TodoUserDTO {
    id: string;
    firstname: string;
    lastname: string;
    nickname: string;
}

// DTO for todo list response
export interface TodoListResponseDTO {
    id: string;
    name: string;
    description?: string;
    priority: todoPriority;
    status: todoStatus;
    clinic: TodoClinicDTO;
    createdAt: string;
    updatedAt?: string;
    createdBy: string;
    updatedBy?: string;
}