import { Types, Document, Model } from 'mongoose';

export interface IHoliday {
    name: string;
    date: Date;
    description?: string;
    year: number; // ปี พ.ศ. หรือ ค.ศ. (เก็บเป็น ค.ศ.)
    isRecurring: boolean; // วันหยุดซ้ำทุกปี
    isPublished: boolean; // เผยแพร่ให้พนักงานเห็นแล้ว
    isActive: boolean;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IHolidayDoc extends IHoliday, Document { }

export interface IHolidayModel extends Model<IHolidayDoc> {
    findByYear(year: number): Promise<IHolidayDoc[]>;
    findPublishedByYear(year: number): Promise<IHolidayDoc[]>;
    isHoliday(date: Date): Promise<boolean>;
}

export type CreateHolidayBody = Omit<IHoliday, 'isActive' | 'createdAt' | 'updatedAt' | 'updatedBy'>;
export type UpdateHolidayBody = Partial<IHoliday>;

// DTO for bulk import holidays
export interface BulkHolidayDTO {
    year: number;
    holidays: Array<{
        name: string;
        date: string; // ISO date string
        description?: string;
    }>;
    publish?: boolean;
}
