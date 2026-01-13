import { Types, Document, Model, Query } from 'mongoose';

export interface IDocument {
    clinicId: Types.ObjectId;
    title: string;
    content: string;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IDocumentDoc extends IDocument, Document { }

export interface IDocumentModel extends Model<IDocumentDoc> {
    findByClinic(clinicId: string): Query<IDocumentDoc[], IDocumentDoc>;
}

export type CreateDocumentBody = Omit<IDocument, 'createdAt' | 'updatedAt' | 'updatedBy'>;

export type UpdateDocumentBody = Partial<Pick<IDocumentDoc, 'title' | 'content' | 'updatedBy'>>;