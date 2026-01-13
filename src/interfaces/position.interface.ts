import { Types, Document, Model, Query } from 'mongoose';

export interface IPosition {
    name: string;
    description?: string;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

export interface IPositionDoc extends IPosition, Document { }

export interface IPositionModel extends Model<IPositionDoc> {
    isPositionExist(name: string): Promise<boolean>;
    findActivePositions(): Query<IPositionDoc[], IPositionDoc>;
}

export type CreatePositionBody = Omit<IPosition, 'isActive' | 'createdAt' | 'updatedAt' | 'updatedBy'>;

export type UpdatePositionBody = Partial<IPosition>;

// DTO for position list response
export interface PositionListResponseDTO {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt?: string;
    createdBy: string;
    updatedBy?: string;
}