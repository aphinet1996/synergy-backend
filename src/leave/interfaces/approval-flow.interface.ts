import { Types, Document, Model } from 'mongoose';

export interface IApprovalStep {
    stepOrder: number; // ลำดับขั้นตอน 1, 2, 3, ...
    approverPosition: Types.ObjectId; // ตำแหน่งที่ต้องอนุมัติ (ref: Position)
    approverPositionName?: string; // cache ชื่อตำแหน่ง
    canSkip: boolean; // ข้ามได้ถ้าไม่มีคนในตำแหน่งนี้
    autoApproveAfterDays?: number; // อนุมัติอัตโนมัติหลังผ่านไปกี่วัน (null = ไม่มี)
}

export interface IApprovalFlow {
    name: string;
    description?: string;
    requesterPosition: Types.ObjectId; // ตำแหน่งผู้ขอ (ref: Position)
    requesterPositionName?: string; // cache ชื่อตำแหน่ง
    leaveTypes?: Types.ObjectId[]; // ประเภทการลาที่ใช้ flow นี้ (ถ้าว่าง = ทุกประเภท)
    steps: IApprovalStep[];
    isDefault: boolean; // เป็น flow เริ่มต้นสำหรับตำแหน่งนี้
    isActive: boolean;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IApprovalFlowDoc extends IApprovalFlow, Document { }

export interface IApprovalFlowModel extends Model<IApprovalFlowDoc> {
    findFlowForPosition(positionId: Types.ObjectId | string, leaveTypeId?: Types.ObjectId | string): Promise<IApprovalFlowDoc | null>;
    findActiveFlows(): Promise<IApprovalFlowDoc[]>;
}

export type CreateApprovalFlowBody = Omit<IApprovalFlow, 'isActive' | 'createdAt' | 'updatedAt' | 'updatedBy'>;
export type UpdateApprovalFlowBody = Partial<IApprovalFlow>;
