import { z } from 'zod';

// Create Lead
export const createLeadSchema = z.object({
    clinicId: z.string().min(1, 'กรุณาเลือกคลินิก'),
    patientId: z.string().optional(),
    fullname: z.string().trim().min(1, 'กรุณากรอกชื่อนามสกุล'),
    nickname: z.string().optional(),
    tel: z.string().optional(),
    socialMedia: z.string().optional(),
    interestName: z.string().min(1, 'กรุณาเลือกความสนใจ'),
    referralChannel: z.string().min(1, 'กรุณาเลือกช่องทางที่รู้จักคลินิก'),
    createdBy: z.string().min(1, 'createdBy is required'),
    status: z.enum(['pending', 'scheduled']),
    appointmentDate: z.string().optional(),
    appointmentTime: z.string().optional(),
    note: z.string().optional(),
    deposit: z
        .object({
            amount: z.number().positive(),
            slipUrls: z.array(z.string()),
        })
        .optional(),
}).superRefine((data, ctx) => {
    if (data.status === 'scheduled') {
        if (!data.appointmentDate) {
            ctx.addIssue({ code: 'custom', path: ['appointmentDate'], message: 'กรุณาเลือกวันที่นัด' });
        }
        if (!data.appointmentTime) {
            ctx.addIssue({ code: 'custom', path: ['appointmentTime'], message: 'กรุณาเลือกเวลานัด' });
        }
    }
});

// Update Lead
export const updateLeadSchema = z.object({
    patientId: z.string().optional(),
    fullname: z.string().trim().min(1).optional(),
    nickname: z.string().optional(),
    tel: z.string().optional(),
    socialMedia: z.string().optional(),
    interestName: z.string().optional(),
    referralChannel: z.string().optional(),
    status: z.enum(['pending', 'scheduled', 'rescheduled', 'cancelled', 'arrived']).optional(),
    appointmentDate: z.string().optional(),
    appointmentTime: z.string().optional(),
    note: z.string().optional(),
    deposit: z
        .object({
            amount: z.number().positive(),
            slipUrls: z.array(z.string()),
        })
        .nullable()
        .optional(),
});

// Edit arrived lead
export const editArrivedLeadSchema = z.object({
    procedures: z
        .array(
            z.object({
                name: z.string().min(1),
                price: z.string().min(1),
                depositUsed: z.number().optional(),
            })
        )
        .optional(),
    payments: z
        .object({
            method: z.string().optional(),
            amount: z.number().optional(),
        })
        .optional(),
    receiptUrls: z.array(z.string()).optional(),
    editNote: z.string().optional(),
});

// List query params
const LEAD_STATUS_VALUES = ['pending', 'scheduled', 'rescheduled', 'cancelled', 'arrived'] as const;

const statusListSchema = z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : undefined))
    .pipe(z.array(z.enum(LEAD_STATUS_VALUES)).optional());

export const listLeadQuerySchema = z.object({
    status: statusListSchema,
    clinicId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    sortBy: z.string().optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const leadParamSchema = z.object({
    id: z.string().min(1, 'Lead ID is required'),
});

// Patient search / phone check
export const searchPatientQuerySchema = z.object({
    q: z.string().min(2, 'กรุณาพิมพ์อย่างน้อย 2 ตัวอักษร'),
    limit: z.coerce.number().min(1).max(20).default(5),
});

export const checkTelQuerySchema = z.object({
    tel: z.string().min(1, 'tel is required'),
    excludeId: z.string().optional(),
});

export const settingOptionsQuerySchema = z.object({
    clinicId: z.string().optional(),
});

export type CreateLeadDTO = z.infer<typeof createLeadSchema>;
export type UpdateLeadDTO = z.infer<typeof updateLeadSchema>;
export type EditArrivedLeadDTO = z.infer<typeof editArrivedLeadSchema>;
export type ListLeadQueryDTO = z.infer<typeof listLeadQuerySchema>;
export type LeadParamDTO = z.infer<typeof leadParamSchema>;
export type SearchPatientQueryDTO = z.infer<typeof searchPatientQuerySchema>;
export type CheckTelQueryDTO = z.infer<typeof checkTelQuerySchema>;
export type SettingOptionsQueryDTO = z.infer<typeof settingOptionsQuerySchema>;

export default {
    create: createLeadSchema,
    update: updateLeadSchema,
    editArrived: editArrivedLeadSchema,
    list: listLeadQuerySchema,
    param: leadParamSchema,
    searchPatient: searchPatientQuerySchema,
    checkTel: checkTelQuerySchema,
    settingOptions: settingOptionsQuerySchema,
};
