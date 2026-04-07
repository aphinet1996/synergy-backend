import { Types, Document, Model } from 'mongoose';
import { LeaveTypeCode } from './leave-type.interface';

export type CarryOverMethod =
    | 'none'          // ไม่ยกยอด
    | 'all'           // ยกทั้งหมด
    | 'fixed'         // ยกได้ไม่เกิน X วัน
    | 'percentage'    // ยกได้ X% ของที่เหลือ
    | 'percentage_capped';  // ยกได้ X% แต่ไม่เกิน Y วัน

export type ExpiryRule =
    | 'none'              // ไม่หมดอายุ
    | 'end_of_quarter'    // หมดสิ้น Q1
    | 'end_of_half_year'  // หมดสิ้นครึ่งปี
    | 'fixed_months'      // หมดหลังจาก X เดือน
    | 'fixed_date';       // หมดวันที่กำหนด

export interface ICarryOverConfig {
    year: number;  // ปีที่ใช้ config นี้
    leaveType: Types.ObjectId;
    leaveTypeCode?: LeaveTypeCode;

    // Carry over method
    method: CarryOverMethod;
    maxDays?: number;           // สำหรับ fixed, percentage_capped
    percentage?: number;        // สำหรับ percentage, percentage_capped (0-100)

    // Expiry rules
    expiryRule: ExpiryRule;
    expiryMonths?: number;      // สำหรับ fixed_months
    expiryDate?: Date;          // สำหรับ fixed_date
    expiryQuarter?: 1 | 2;      // Q1 หรือ Q2 (สำหรับ end_of_quarter, end_of_half_year)

    // FIFO rule
    useFIFO: boolean;           // ใช้วันยกมาก่อน

    // Conditions
    minServiceMonths?: number;  // ต้องทำงานมาอย่างน้อย X เดือน
    eligiblePositions?: Types.ObjectId[];  // ตำแหน่งที่มีสิทธิ์ (ว่าง = ทุกตำแหน่ง)
    eligibleEmployeeTypes?: ('permanent' | 'probation' | 'freelance')[];

    isActive: boolean;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICarryOverConfigDoc extends ICarryOverConfig, Document { }

export interface ICarryOverConfigModel extends Model<ICarryOverConfigDoc> {
    findByYearAndLeaveType(year: number, leaveTypeId: Types.ObjectId | string): Promise<ICarryOverConfigDoc | null>;
    findByYear(year: number): Promise<ICarryOverConfigDoc[]>;
}

// DTOs
export interface CreateCarryOverConfigDTO {
    year: number;
    leaveType: string;
    method: CarryOverMethod;
    maxDays?: number;
    percentage?: number;
    expiryRule: ExpiryRule;
    expiryMonths?: number;
    expiryDate?: Date;
    useFIFO?: boolean;
    minServiceMonths?: number;
    eligiblePositions?: string[];
    eligibleEmployeeTypes?: string[];
}

export interface CarryOverCalculationResult {
    eligible: boolean;
    reason?: string;  // ถ้าไม่ eligible
    originalRemaining: number;
    carryOverAmount: number;
    expiryDate?: Date;
}
