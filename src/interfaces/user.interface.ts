import { Types, Document, Model } from 'mongoose';

export type UserType = 'permanent' | 'probation' | 'freelance';
export type UserRole = 'admin' | 'manager' | 'employee';

export interface IUser {
    username: string;
    password: string;
    profile?: string;
    firstname: string;
    lastname: string;
    nickname: string;
    lineUserId?: string;
    tel?: string;
    address?: string;
    birthDate?: Date;
    positionId?: Types.ObjectId;
    salary?: string;
    contract?: string;
    contractDateStart?: Date;
    contractDateEnd?: Date;
    employeeType: UserType;
    employeeDateStart: Date;
    employeeStatus?: string;
    role: UserRole;
    isActive?: boolean;
    lastLogin?: Date;
    refreshToken?: string;
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    createdBy: Types.ObjectId;
    updatedBy?: Types.ObjectId;
}

export interface IUserDoc extends IUser, Document {
    comparePassword(password: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUserDoc> {
    findByResetToken(token: string): Promise<IUserDoc | null>;
    isUserExist(firstname: string, lastname: string): Promise<boolean>;
}

export type CreateUserBody = Omit<IUser,
    'isActive' | 'lastLogin' | 'refreshToken' | 'resetPasswordToken' | 'resetPasswordExpires' |
    'createdAt' | 'updatedAt' | 'updatedBy'
>;

export type UpdateUserBody = Partial<IUser>;

export interface UserPositionDTO {
    id: string;
    name: string;
}

export interface UserListResponseDTO {
    id: string;
    username: string;
    profile?: string;
    firstname: string;
    lastname: string;
    nickname: string;
    position?: UserPositionDTO;
    role: UserRole;
    isActive: boolean;
}

export interface UserDetailResponseDTO extends UserListResponseDTO {
    lineUserId?: string;
    tel?: string;
    address?: string;
    birthDate?: string;
    salary?: string;
    contract?: string;
    contractDateStart?: string;
    contractDateEnd?: string;
    employeeType: UserType;
    employeeDateStart: string;
    employeeStatus?: string;
    lastLogin?: string;
    createdAt: string;
    updatedAt?: string;
}