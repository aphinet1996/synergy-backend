import { Types, Document, Model } from 'mongoose';
import { LeaveTypeCode } from './leave-type.interface';

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveDurationType = 'full_day' | 'half_day' | 'hours';
export type HalfDayPeriod = 'morning' | 'afternoon';

export interface IApprovalHistory {
    step: number;
    approver: Types.ObjectId; // ref: User
    approverName?: string; // cache
    approverPosition?: string; // cache
    action: 'approved' | 'rejected' | 'pending';
    comment?: string;
    actionAt?: Date;
}

export interface ILeaveRequest {
    requestNumber: string; // เลขที่ใบลา (auto-generated)
    user: Types.ObjectId; // ref: User (ผู้ขอลา)
    userName?: string; // cache
    userPosition?: string; // cache
    leaveType: Types.ObjectId; // ref: LeaveType
    leaveTypeCode?: LeaveTypeCode; // cache
    leaveTypeName?: string; // cache

    // Duration info
    durationType: LeaveDurationType;
    halfDayPeriod?: HalfDayPeriod; // ถ้าเป็น half_day
    startDate: Date;
    endDate: Date;
    startTime?: string; // ถ้าเป็น hours (format: HH:mm)
    endTime?: string; // ถ้าเป็น hours (format: HH:mm)
    days: number; // จำนวนวัน (รวมครึ่งวัน เช่น 0.5, 1.5)
    hours?: number; // จำนวนชั่วโมง (ถ้าเป็น hours type)

    reason: string;
    attachments?: string[]; // URLs ของไฟล์แนบ

    // Status & Approval
    status: LeaveStatus;
    currentApprovalStep: number; // ขั้นตอนการอนุมัติปัจจุบัน
    approvalFlow?: Types.ObjectId; // ref: ApprovalFlow
    approvalHistory: IApprovalHistory[];

    // Approval result
    approvedBy?: Types.ObjectId; // ref: User (ผู้อนุมัติคนสุดท้าย)
    approvedByName?: string; // cache
    approvedAt?: Date;
    rejectedBy?: Types.ObjectId; // ref: User (ผู้ไม่อนุมัติ)
    rejectedByName?: string; // cache
    rejectedAt?: Date;
    rejectedReason?: string;

    // Cancellation
    cancelledAt?: Date;
    cancelledReason?: string;

    // Notification flags
    notificationSent: boolean;
    reminderSent: boolean;

    year: number; // ปี (สำหรับ filtering)
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ILeaveRequestDoc extends ILeaveRequest, Document {
    approve(approverId: Types.ObjectId | string, comment?: string): Promise<void>;
    reject(approverId: Types.ObjectId | string, reason: string): Promise<void>;
    cancel(reason?: string): Promise<void>;
}

export interface ILeaveRequestModel extends Model<ILeaveRequestDoc> {
    generateRequestNumber(year: number): Promise<string>;
    findByUser(userId: Types.ObjectId | string, year?: number): Promise<ILeaveRequestDoc[]>;
    findPendingForApprover(approverId: Types.ObjectId | string): Promise<ILeaveRequestDoc[]>;
    findByDateRange(startDate: Date, endDate: Date): Promise<ILeaveRequestDoc[]>;
}

// DTOs
export type CreateLeaveRequestBody = Pick<ILeaveRequest,
    'leaveType' | 'durationType' | 'halfDayPeriod' | 'startDate' | 'endDate' |
    'startTime' | 'endTime' | 'reason' | 'attachments'
>;

export type UpdateLeaveRequestBody = Partial<CreateLeaveRequestBody>;

export interface LeaveRequestListQueryDTO {
    status?: LeaveStatus;
    leaveType?: string;
    year?: number;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}

export interface TeamLeaveRequestDTO {
    id: string;
    type: LeaveTypeCode;
    typeName: string;
    durationType: LeaveDurationType;
    halfDayPeriod?: HalfDayPeriod;
    startDate: Date;
    endDate: Date;
    startTime?: string;
    endTime?: string;
    days: number;
    hours?: number;
    reason: string;
    attachments?: string[];
    status: LeaveStatus;
    createdAt: Date;
    employee: {
        id: string;
        name: string;
        position: string;
        avatar?: string;
    };
}
