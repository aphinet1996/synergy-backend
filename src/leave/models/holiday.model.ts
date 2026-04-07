import mongoose, { Schema } from 'mongoose';
import { IHolidayDoc, IHolidayModel } from '../interfaces/holiday.interface';
import toJSON from '@utils/toJSON';

const holidaySchema = new Schema<IHolidayDoc, IHolidayModel>(
    {
        name: {
            type: String,
            required: [true, 'Holiday name is required'],
            trim: true,
        },
        date: {
            type: Date,
            required: [true, 'Holiday date is required'],
        },
        description: {
            type: String,
            trim: true,
        },
        year: {
            type: Number,
            required: true,
            index: true,
        },
        isRecurring: {
            type: Boolean,
            default: false,
        },
        isPublished: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Created by is required'],
        },
        updatedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

holidaySchema.plugin(toJSON);

holidaySchema.index({ year: 1, date: 1 });
holidaySchema.index({ isPublished: 1, year: 1 });

// Pre-save middleware to set year from date
holidaySchema.pre('save', function (next) {
    if (this.date) {
        this.year = this.date.getFullYear();
    }
    next();
});

// Static methods
holidaySchema.statics.findByYear = function (year: number): Promise<IHolidayDoc[]> {
    return this.find({ year, isActive: true }).sort({ date: 1 }).exec();
};

holidaySchema.statics.findPublishedByYear = function (year: number): Promise<IHolidayDoc[]> {
    return this.find({ year, isPublished: true, isActive: true }).sort({ date: 1 }).exec();
};

holidaySchema.statics.isHoliday = async function (date: Date): Promise<boolean> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.countDocuments({
        date: { $gte: startOfDay, $lte: endOfDay },
        isActive: true,
        isPublished: true,
    });

    return count > 0;
};

const Holiday = mongoose.model<IHolidayDoc, IHolidayModel>('Holiday', holidaySchema);

export default Holiday;
