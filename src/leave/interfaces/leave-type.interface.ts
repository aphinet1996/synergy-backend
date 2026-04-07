import { Types, Document, Model } from 'mongoose';

export type LeaveTypeCode = 'annual' | 'sick' | 'personal' | 'maternity' | 'ordination' | 'military' | 'other';

export interface ILeaveType {
    code: LeaveTypeCode;
    name: string;
    description?: string;
    defaultDays: number; // จำนวนวันเริ่มต้น
    maxDaysPerYear: number; // จำนวนวันสูงสุดต่อปี
    allowHalfDay: boolean; // อนุญาตให้ลาครึ่งวันได้
    allowHours: boolean; // อนุญาตให้ลาเป็นชั่วโมงได้
    requireAttachment: boolean; // ต้องแนบเอกสาร
    allowPastDate: boolean; // อนุญาตให้ลาย้อนหลังได้
    pastDateLimit?: number; // จำนวนวันที่อนุญาตให้ลาย้อนหลัง
    requireApproval: boolean; // ต้องมีการอนุมัติ
    color: string; // สีสำหรับ UI
    icon?: string; // ชื่อ icon สำหรับ UI
    sortOrder: number; // ลำดับการแสดงผล
    isActive: boolean;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ILeaveTypeDoc extends ILeaveType, Document { }

export interface ILeaveTypeModel extends Model<ILeaveTypeDoc> {
    findByCode(code: LeaveTypeCode): Promise<ILeaveTypeDoc | null>;
    findActiveTypes(): Promise<ILeaveTypeDoc[]>;
}

export type CreateLeaveTypeBody = Omit<ILeaveType, 'isActive' | 'createdAt' | 'updatedAt' | 'updatedBy'>;
export type UpdateLeaveTypeBody = Partial<ILeaveType>;
