import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUserDoc, IUserModel } from '@/interfaces/user.interface';
import toJSON from '@utils/toJSON';

const userSchema = new Schema<IUserDoc, IUserModel>(
    {
        username: {
            type: String,
            required: [true, 'Username is required'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [6, 'Password must be at least 6 characters'],
            select: false
        },
        profile: {
            type: String,
            default: null
        },
        firstname: {
            type: String,
            required: [true, 'First name is required'],
            trim: true
        },
        lastname: {
            type: String,
            required: [true, 'Last name is required'],
            trim: true
        },
        nickname: {
            type: String,
            required: [true, 'Nick name is required'],
            trim: true
        },
        lineUserId: {
            type: String,
            default: null,
            trim: true
        },
        tel: {
            type: String,
            default: null,
            trim: true,
            match: [/^\d{10}$/, 'Tel must be 10 digits']
        },
        address: {
            type: String,
            default: null
        },
        birthDate: {
            type: Date
        },
        position: {
            type: String,
            default: null
        },
        salary: {
            type: String,
            default: null,
            select: false
        },
        contract: {
            type: String,
            default: null
        },
        contractDateStart: {
            type: Date
        },
        contractDateEnd: {
            type: Date
        },
        employeeType: {
            type: String,
            enum: ['permanent', 'probation', 'freelance'],
            default: 'permanent'
        },
        employeeDateStart: {
            type: Date,
            required: [true, 'Employee start date is required'],
            default: Date.now
        },
        employeeStatus: {
            type: String,
            default: null
        },
        role: {
            type: String,
            enum: ['admin', 'manager', 'employee'],
            default: 'employee'
        },
        isActive: {
            type: Boolean,
            default: true
        },
        lastLogin: {
            type: Date,
            default: null
        },
        refreshToken: {
            type: String,
            default: null,
            select: false
        },
        resetPasswordToken: {
            type: String,
            select: false
        },
        resetPasswordExpires: {
            type: Date
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Created by is required']
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    {
        timestamps: true,
    }
);

userSchema.plugin(toJSON);

userSchema.index({ role: 1, isActive: 1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

// Compare password method
userSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
    try {
        return await bcrypt.compare(password, this.password);
    } catch (error) {
        return false;
    }
};

// Static methods
userSchema.statics.findByResetToken = function (token: string): Promise<IUserDoc | null> {
    return this.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
    }).select('-password');
};

userSchema.statics.isUserExist = async function (firstname: string, lastname: string): Promise<boolean> {
    const user = await this.exists({ firstname, lastname });
    return !!user;
};

const User = mongoose.model<IUserDoc, IUserModel>('User', userSchema);

export default User;