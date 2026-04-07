import { Types, Document, Model } from 'mongoose';
import { LeaveTypeCode } from './leave-type.interface';

export type AdjustmentType =
    | 'add'           // เพิ่มวันลา
    | 'deduct'        // หักวันลา
    | 'carry_over'    // ยกยอดข้ามปี
    | 'expired'       // วันลาหมดอายุ
    | 'correction'    // แก้ไขข้อผิดพลาด
    | 'bonus'         // โบนัสวันลา
    | 'transfer_in'   // รับโอนจากคนอื่น
    | 'transfer_out'; // โอนให้คนอื่น

export interface ILeaveAdjustment {
    user: Types.ObjectId;
    year: number;
    leaveType: Types.ObjectId;
    leaveTypeCode?: LeaveTypeCode;

    adjustmentType: AdjustmentType;
    days: number;  // + เพิ่ม, - ลด

    // ยอดก่อน-หลัง (สำหรับ audit)
    balanceBefore: number;
    balanceAfter: number;

    reason: string;

    // Reference ถ้ามี
    relatedRequest?: Types.ObjectId;  // ถ้าเกี่ยวกับ request
    relatedUser?: Types.ObjectId;     // ถ้าโอนจาก/ให้คนอื่น

    // Carry over specific
    sourceYear?: number;              // ยกมาจากปีไหน
    expiryDate?: Date;                // วันหมดอายุของยอดยกมา

    adjustedBy: Types.ObjectId;
    adjustedAt: Date;

    // Approval (ถ้าต้องมีคนอนุมัติ)
    requiresApproval: boolean;
    approvedBy?: Types.ObjectId;
    approvedAt?: Date;
    status: 'pending' | 'approved' | 'rejected';

    createdAt?: Date;
    updatedAt?: Date;
}

export interface ILeaveAdjustmentDoc extends ILeaveAdjustment, Document { }

export interface ILeaveAdjustmentModel extends Model<ILeaveAdjustmentDoc> {
    findByUser(userId: Types.ObjectId, year?: number): Promise<ILeaveAdjustmentDoc[]>;
    findPendingApprovals(): Promise<ILeaveAdjustmentDoc[]>;
    getAdjustmentSum(userId: Types.ObjectId, leaveTypeId: Types.ObjectId, year: number): Promise<number>;
}

// DTOs
export interface CreateAdjustmentDTO {
    user: string;
    year: number;
    leaveType: string;
    adjustmentType: AdjustmentType;
    days: number;
    reason: string;
    relatedUser?: string;
    sourceYear?: number;
    expiryDate?: Date;
}

export interface AdjustmentHistoryDTO {
    id: string;
    date: Date;
    type: AdjustmentType;
    days: number;
    balanceBefore: number;
    balanceAfter: number;
    reason: string;
    adjustedBy: {
        id: string;
        name: string;
    };
}
