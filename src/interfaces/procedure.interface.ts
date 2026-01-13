import { Types, Document, Model } from 'mongoose';

export interface IProcedure {
    name: string;
    isActive: boolean;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IProcedureDoc extends IProcedure, Document {}

export interface IProcedureModel extends Model<IProcedureDoc> {
    isNameExist(name: string, excludeId?: string): Promise<boolean>;
}

export type CreateProcedureBody = Omit<IProcedure, 'createdAt' | 'updatedAt' | 'updatedBy' | 'isActive'>;
export type UpdateProcedureBody = Partial<Omit<IProcedure, 'createdAt' | 'updatedAt' | 'createdBy'>>;