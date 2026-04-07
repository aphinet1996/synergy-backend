import { Types, Document, Model } from 'mongoose';
import { LeaveTypeCode } from './leave-type.interface';

export type BalanceChangeAction =
    | 'init'              // เริ่มต้นปี
    | 'request_pending'   // ยื่นลา (รออนุมัติ)
    | 'request_approved'  // อนุมัติลา
    | 'request_rejected'  // ไม่อนุมัติ
    | 'request_cancelled' // ยกเลิกใบลา
    | 'adjustment'        // HR ปรับยอด
    | 'carry_over'        // ยกยอดข้ามปี
    | 'carry_over_expired'// วันยกมาหมดอายุ
    | 'correction';       // แก้ไขข้อผิดพลาด

export interface IBalanceHistory {
    action: BalanceChangeAction;
    date: Date;

    // ยอดก่อน-หลัง
    before: {
        total: number;
        used: number;
        pending: number;
        remaining: number;
    };
    after: {
        total: number;
        used: number;
        pending: number;
        remaining: number;
    };

    days: number;  // จำนวนวันที่เปลี่ยน (+/-)

    // References
    requestId?: Types.ObjectId;
    adjustmentId?: Types.ObjectId;

    // Who & Why
    performedBy?: Types.ObjectId;
    performedByName?: string;
    note?: string;
}

export interface ILeaveBalanceItem {
    leaveType: Types.ObjectId;
    leaveTypeCode?: LeaveTypeCode;
    leaveTypeName?: string;

    // ยอดจากโควต้า
    fromQuota: number;

    // ยอดยกมา
    fromCarryOver: number;
    carryOverExpiryDate?: Date;

    // ยอดจาก adjustment
    fromAdjustment: number;

    // รวม
    total: number;  // fromQuota + fromCarryOver + fromAdjustment

    // การใช้ (FIFO: ใช้ carryOver ก่อน)
    usedFromCarryOver: number;
    usedFromQuota: number;
    used: number;  // usedFromCarryOver + usedFromQuota

    pending: number;
    remaining: number;  // total - used - pending

    // History สำหรับ audit trail
    history: IBalanceHistory[];
}

export interface ILeaveBalance {
    user: Types.ObjectId; // ref: User
    year: number; // ปี ค.ศ.
    balances: ILeaveBalanceItem[];
    lastUpdated: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ILeaveBalanceDoc extends ILeaveBalance, Document {
    updateBalance(leaveTypeId: Types.ObjectId | string, daysUsed: number, isPending?: boolean): Promise<void>;
    releaseBalance(leaveTypeId: Types.ObjectId | string, days: number, fromPending?: boolean): Promise<void>;
    confirmPending(leaveTypeId: Types.ObjectId | string, days: number): Promise<void>;
}

export interface ILeaveBalanceModel extends Model<ILeaveBalanceDoc> {
    findOrCreateForUser(userId: Types.ObjectId | string, year: number): Promise<ILeaveBalanceDoc>;
    findByUserAndYear(userId: Types.ObjectId | string, year: number): Promise<ILeaveBalanceDoc | null>;
    initializeForUser(userId: Types.ObjectId | string, year: number, quotas: ILeaveBalanceItem[]): Promise<ILeaveBalanceDoc>;
}

// DTO for API responses
export interface LeaveBalanceResponseDTO {
    year: number;
    balances: Array<{
        leaveType: {
            id: string;
            code: LeaveTypeCode;
            name: string;
            color: string;
            icon?: string;
        };
        total: number;
        used: number;
        pending: number;
        remaining: number;
        carryOver: number;
    }>;
    summary: {
        totalDays: number;
        usedDays: number;
        pendingDays: number;
        remainingDays: number;
    };
}
