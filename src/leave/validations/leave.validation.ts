import { z } from 'zod';

// Leave Type Validations
export const leaveTypeCodeEnum = z.enum(['annual', 'sick', 'personal', 'maternity', 'ordination', 'military', 'other']);

export const createLeaveTypeSchema = z.object({
    code: leaveTypeCodeEnum,
    name: z.string().trim().min(1, 'Name is required').max(100),
    description: z.string().max(500).optional(),
    defaultDays: z.coerce.number().min(0).default(0),
    maxDaysPerYear: z.coerce.number().min(0),
    allowHalfDay: z.boolean().default(true),
    allowHours: z.boolean().default(false),
    requireAttachment: z.boolean().default(false),
    allowPastDate: z.boolean().default(false),
    pastDateLimit: z.coerce.number().min(0).optional(),
    requireApproval: z.boolean().default(true),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').default('#6B7280'),
    icon: z.string().optional(),
    sortOrder: z.coerce.number().default(0),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

// Approval Flow Validations
const approvalStepSchema = z.object({
    stepOrder: z.coerce.number().min(1),
    approverPosition: z.string().min(1, 'Approver position is required'),
    canSkip: z.boolean().default(false),
    autoApproveAfterDays: z.coerce.number().min(1).nullable().optional(),
});

export const createApprovalFlowSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    description: z.string().max(500).optional(),
    requesterPosition: z.string().min(1, 'Requester position is required'),
    leaveTypes: z.array(z.string()).optional(),
    steps: z.array(approvalStepSchema).min(1, 'At least one approval step is required'),
    isDefault: z.boolean().default(false),
});

export const updateApprovalFlowSchema = createApprovalFlowSchema.partial();

// Holiday Validations
export const createHolidaySchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(200),
    date: z.coerce.date(),
    description: z.string().max(500).optional(),
    isRecurring: z.boolean().default(false),
    isPublished: z.boolean().default(false),
});

export const updateHolidaySchema = createHolidaySchema.partial();

export const bulkHolidaySchema = z.object({
    year: z.coerce.number().min(2000).max(2100),
    holidays: z.array(z.object({
        name: z.string().trim().min(1),
        date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
        description: z.string().optional(),
    })).min(1, 'At least one holiday is required'),
    publish: z.boolean().default(false),
});

// Leave Quota Validations
const quotaConfigSchema = z.object({
    leaveType: z.string().min(1, 'Leave type is required'),
    days: z.coerce.number().min(0),
});

export const createLeaveQuotaSchema = z.object({
    year: z.coerce.number().min(2000).max(2100),
    position: z.string().nullable().optional(),
    employeeType: z.enum(['permanent', 'probation', 'freelance']).nullable().optional(),
    quotas: z.array(quotaConfigSchema).min(1, 'At least one quota is required'),
    isDefault: z.boolean().default(false),
});

export const updateLeaveQuotaSchema = createLeaveQuotaSchema.partial();

// Leave Adjustment Validations
export const adjustmentTypeEnum = z.enum([
    'add', 'deduct', 'carry_over', 'expired', 'correction', 'bonus', 'transfer_in', 'transfer_out'
]);

export const createAdjustmentSchema = z.object({
    user: z.string().min(1, 'User is required'),
    year: z.coerce.number().min(2000).max(2100),
    leaveType: z.string().min(1, 'Leave type is required'),
    adjustmentType: adjustmentTypeEnum,
    days: z.coerce.number(),
    reason: z.string().trim().min(1, 'Reason is required').max(500),
    relatedUser: z.string().optional(),
    sourceYear: z.coerce.number().optional(),
    expiryDate: z.coerce.date().optional(),
});

export const transferDaysSchema = z.object({
    fromUser: z.string().min(1, 'From user is required'),
    toUser: z.string().min(1, 'To user is required'),
    leaveType: z.string().min(1, 'Leave type is required'),
    days: z.coerce.number().positive('Days must be positive'),
    year: z.coerce.number().min(2000).max(2100),
    reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export const bulkBonusSchema = z.object({
    userIds: z.array(z.string()).min(1, 'At least one user is required'),
    leaveType: z.string().min(1, 'Leave type is required'),
    days: z.coerce.number().positive('Days must be positive'),
    year: z.coerce.number().min(2000).max(2100),
    reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export const rejectAdjustmentSchema = z.object({
    reason: z.string().trim().min(1, 'Rejection reason is required').max(500),
});

// Leave Request Validations
export const leaveDurationTypeEnum = z.enum(['full_day', 'half_day', 'hours']);
export const halfDayPeriodEnum = z.enum(['morning', 'afternoon']);
export const leaveStatusEnum = z.enum(['pending', 'approved', 'rejected', 'cancelled']);

export const createLeaveRequestSchema = z.object({
    leaveType: z.string().min(1, 'Leave type is required'),
    durationType: leaveDurationTypeEnum.default('full_day'),
    halfDayPeriod: halfDayPeriodEnum.optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format').optional(),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format').optional(),
    reason: z.string().trim().min(1, 'Reason is required').max(1000),
    attachments: z.array(z.string().url()).optional(),
}).superRefine((data, ctx) => {
    // Validate endDate >= startDate
    if (data.endDate < data.startDate) {
        ctx.addIssue({
            code: 'custom',
            message: 'End date must be after or equal to start date',
            path: ['endDate'],
        });
    }

    // Validate half_day requires halfDayPeriod
    if (data.durationType === 'half_day' && !data.halfDayPeriod) {
        ctx.addIssue({
            code: 'custom',
            message: 'Half day period is required for half day leave',
            path: ['halfDayPeriod'],
        });
    }

    // Validate hours requires startTime and endTime
    if (data.durationType === 'hours') {
        if (!data.startTime) {
            ctx.addIssue({
                code: 'custom',
                message: 'Start time is required for hourly leave',
                path: ['startTime'],
            });
        }
        if (!data.endTime) {
            ctx.addIssue({
                code: 'custom',
                message: 'End time is required for hourly leave',
                path: ['endTime'],
            });
        }
        if (data.startTime && data.endTime && data.startTime >= data.endTime) {
            ctx.addIssue({
                code: 'custom',
                message: 'End time must be after start time',
                path: ['endTime'],
            });
        }
    }
});

export const updateLeaveRequestSchema = createLeaveRequestSchema.partial();

export const approveLeaveRequestSchema = z.object({
    comment: z.string().max(500).optional(),
});

export const rejectLeaveRequestSchema = z.object({
    reason: z.string().trim().min(1, 'Rejection reason is required').max(500),
});

export const cancelLeaveRequestSchema = z.object({
    reason: z.string().max(500).optional(),
});

// Query Validations
export const leaveRequestListQuerySchema = z.object({
    status: leaveStatusEnum.optional(),
    leaveType: z.string().optional(),
    year: z.coerce.number().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(10),
});

export const holidayListQuerySchema = z.object({
    year: z.coerce.number().optional(),
    published: z.coerce.boolean().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
});

export const yearParamSchema = z.object({
    year: z.coerce.number().min(2000).max(2100),
});

export const idParamSchema = z.object({
    id: z.string().min(1, 'ID is required'),
});

// Type exports
export type CreateLeaveTypeDTO = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeDTO = z.infer<typeof updateLeaveTypeSchema>;
export type CreateApprovalFlowDTO = z.infer<typeof createApprovalFlowSchema>;
export type UpdateApprovalFlowDTO = z.infer<typeof updateApprovalFlowSchema>;
export type CreateHolidayDTO = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayDTO = z.infer<typeof updateHolidaySchema>;
export type BulkHolidayDTO = z.infer<typeof bulkHolidaySchema>;
export type CreateLeaveQuotaDTO = z.infer<typeof createLeaveQuotaSchema>;
export type UpdateLeaveQuotaDTO = z.infer<typeof updateLeaveQuotaSchema>;
export type CreateLeaveRequestDTO = z.infer<typeof createLeaveRequestSchema>;
export type UpdateLeaveRequestDTO = z.infer<typeof updateLeaveRequestSchema>;
export type LeaveRequestListQueryDTO = z.infer<typeof leaveRequestListQuerySchema>;
// NEW: Adjustment types
export type CreateAdjustmentDTO = z.infer<typeof createAdjustmentSchema>;
export type TransferDaysDTO = z.infer<typeof transferDaysSchema>;
export type BulkBonusDTO = z.infer<typeof bulkBonusSchema>;

export default {
    // Leave Type
    createLeaveType: createLeaveTypeSchema,
    updateLeaveType: updateLeaveTypeSchema,
    // Approval Flow
    createApprovalFlow: createApprovalFlowSchema,
    updateApprovalFlow: updateApprovalFlowSchema,
    // Holiday
    createHoliday: createHolidaySchema,
    updateHoliday: updateHolidaySchema,
    bulkHoliday: bulkHolidaySchema,
    // Leave Quota
    createLeaveQuota: createLeaveQuotaSchema,
    updateLeaveQuota: updateLeaveQuotaSchema,
    // Leave Adjustment (NEW)
    createAdjustment: createAdjustmentSchema,
    transferDays: transferDaysSchema,
    bulkBonus: bulkBonusSchema,
    rejectAdjustment: rejectAdjustmentSchema,
    // Leave Request
    createLeaveRequest: createLeaveRequestSchema,
    updateLeaveRequest: updateLeaveRequestSchema,
    approveLeaveRequest: approveLeaveRequestSchema,
    rejectLeaveRequest: rejectLeaveRequestSchema,
    cancelLeaveRequest: cancelLeaveRequestSchema,
    // Query
    leaveRequestListQuery: leaveRequestListQuerySchema,
    holidayListQuery: holidayListQuerySchema,
    yearParam: yearParamSchema,
    idParam: idParamSchema,
};