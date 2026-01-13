import { Types, Document, Model } from 'mongoose';

export interface IBoard {
    clinicId: Types.ObjectId;
    procedureId: Types.ObjectId;
    name: string;
    description?: string;
    elements: object[];
    appState?: Record<string, any>;
    files?: Record<string, any>;
    members: Types.ObjectId[];
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IBoardDoc extends IBoard, Document {}

export interface IBoardModel extends Model<IBoardDoc> {}

export type CreateBoardBody = Omit<IBoard, 'createdAt' | 'updatedAt' | 'updatedBy'>;
export type UpdateBoardBody = Partial<Pick<IBoard, 'name' | 'description' | 'elements' | 'appState' | 'files' | 'members' | 'updatedBy'>>;