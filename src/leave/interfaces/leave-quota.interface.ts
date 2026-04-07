import { Types, Document, Model } from 'mongoose';
import { LeaveTypeCode } from './leave-type.interface';

export interface ILeaveQuotaConfig {
    leaveType: Types.ObjectId; // ref: LeaveType
    leaveTypeCode?: LeaveTypeCode; // cache
    days: number; // จำนวนวันที่ได้รับ
}

export interface ILeaveQuota {
    year: number; // ปี ค.ศ.
    position?: Types.ObjectId; // ref: Position (ถ้าเป็น null = ใช้กับทุกตำแหน่ง)
    positionName?: string; // cache ชื่อตำแหน่ง
    employeeType?: 'permanent' | 'probation' | 'freelance'; // ประเภทพนักงาน (ถ้าเป็น null = ทุกประเภท)
    quotas: ILeaveQuotaConfig[];
    isDefault: boolean; // เป็น quota เริ่มต้น
    isActive: boolean;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ILeaveQuotaDoc extends ILeaveQuota, Document { }

export interface ILeaveQuotaModel extends Model<ILeaveQuotaDoc> {
    findQuotaForUser(
        year: number,
        positionId?: Types.ObjectId | string,
        employeeType?: string
    ): Promise<ILeaveQuotaDoc | null>;
    findByYear(year: number): Promise<ILeaveQuotaDoc[]>;
}

export type CreateLeaveQuotaBody = Omit<ILeaveQuota, 'isActive' | 'createdAt' | 'updatedAt' | 'updatedBy'>;
export type UpdateLeaveQuotaBody = Partial<ILeaveQuota>;

// DTO for API responses
export interface LeaveQuotaResponseDTO {
    id: string;
    year: number;
    position?: {
        id: string;
        name: string;
    };
    employeeType?: string;
    quotas: Array<{
        leaveType: {
            id: string;
            code: LeaveTypeCode;
            name: string;
        };
        days: number;
    }>;
    isDefault: boolean;
}