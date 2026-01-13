// import { Types, Document, Model, Query } from 'mongoose';

// export interface IServiceItem {
//     name: string;
//     amount: number;
// }

// export interface ISetup {
//     requirement: boolean;
//     socialMedia: boolean;
//     adsManager: boolean;
// }

// export interface IService {
//     setup: ISetup;
//     coperateIdentity: IServiceItem[];
//     website: IServiceItem[];
//     socialMedia: IServiceItem[];
//     training: IServiceItem[];
// }

// export interface IName {
//     en: string;
//     th: string;
// }

// export interface IClinic {
//     name: IName;
//     clinicProfile?: string;
//     clinicLevel: 'premium' | 'standard' | 'basic';
//     contractType: 'yearly' | 'monthly' | 'project';
//     contractDateStart: Date;
//     contractDateEnd: Date;
//     status?: 'active' | 'inactive' | 'pending';
//     assignedTo: Types.ObjectId[];
//     note?: string;
//     service: IService;
//     procedures: Types.ObjectId[];
//     createdAt?: Date;
//     updatedAt?: Date;
//     createdBy: Types.ObjectId;
//     updatedBy?: Types.ObjectId;
// }

// export interface IClinicDoc extends IClinic, Document {}

// export interface IClinicModel extends Model<IClinicDoc> {
//     findByUser(userId: string): Query<IClinicDoc[], IClinicDoc>;
//     isClinicExist(name: IName): Promise<boolean>;
// }

// export type CreateClinicBody = Omit<IClinic, 
//     'createdAt' | 'updatedAt' | 'updatedBy'
// >;

// export type UpdateClinicBody = Partial<IClinic>;

import { Types, Document, Model, Query } from 'mongoose';

export interface IServiceItem {
    name: string;
    amount: number;
}

export interface ISetup {
    requirement: boolean;
    socialMedia: boolean;
    adsManager: boolean;
}

export interface IService {
    setup: ISetup;
    coperateIdentity: IServiceItem[];
    website: IServiceItem[];
    socialMedia: IServiceItem[];
    training: IServiceItem[];
}

export interface IName {
    en: string;
    th: string;
}

// Timeline item interface (Mongoose auto-generates _id)
export interface ITimelineItem {
    serviceType: 'setup' | 'coperateIdentity' | 'website' | 'socialMedia' | 'training';
    serviceName: string;
    serviceAmount: string;
    weekStart: number;
    weekEnd: number;
    updatedBy?: Types.ObjectId;
    updatedAt?: Date;
}

export interface IClinic {
    name: IName;
    clinicProfile?: string;
    clinicLevel: 'premium' | 'standard' | 'basic';
    contractType: 'yearly' | 'monthly' | 'project';
    contractDateStart: Date;
    contractDateEnd: Date;
    status?: 'active' | 'inactive' | 'pending';
    assignedTo: Types.ObjectId[];
    note?: string;
    service: IService;
    procedures: Types.ObjectId[];
    timeline: ITimelineItem[];
    totalWeeks?: number;
    createdAt?: Date;
    updatedAt?: Date;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

export interface IClinicDoc extends IClinic, Document {}

export interface IClinicModel extends Model<IClinicDoc> {
    findByUser(userId: string): Query<IClinicDoc[], IClinicDoc>;
    isClinicExist(name: IName): Promise<boolean>;
}

export type CreateClinicBody = Omit<IClinic, 
    'createdAt' | 'updatedAt' | 'updatedBy'
>;

export type UpdateClinicBody = Partial<IClinic>;