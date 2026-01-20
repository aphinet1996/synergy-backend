import { z } from 'zod';

const nameSchema = z.object({
    en: z.string().min(1, 'English name is required'),
    th: z.string().min(1, 'Thai name is required'),
});

const serviceItemSchema = z.object({
    name: z.string().min(1, 'Service name is required'),
    amount: z.number().min(0, 'Amount must be 0 or greater'),
});

const setupSchema = z.object({
    requirement: z.boolean(),
    socialMedia: z.boolean(),
    adsManager: z.boolean(),
});

const serviceSchema = z.object({
    setup: setupSchema,
    coperateIdentity: z.array(serviceItemSchema).min(0),
    website: z.array(serviceItemSchema).min(0),
    socialMedia: z.array(serviceItemSchema).min(0),
    training: z.array(serviceItemSchema).min(0),
});

// Base clinic fields
const baseClinicSchema = z.object({
    name: nameSchema,
    clinicProfile: z.string().url('Invalid URL').optional().or(z.literal('')),
    clinicLevel: z.enum(['premium', 'standard', 'basic']),
    contractType: z.enum(['yearly', 'monthly', 'project']),
    contractDateStart: z.coerce.date(),
    contractDateEnd: z.coerce.date(),
    status: z.enum(['active', 'inactive', 'pending']),
    assignedTo: z.array(z.string().min(1)).min(1, 'At least one assignee required'),
    note: z.string().max(500).optional(),
    service: serviceSchema,
    procedures: z.array(z.string().min(1)).optional().default([]),
});

// Create clinic (full required)
export const createClinicSchema = baseClinicSchema
    .extend({
        // No password-like fields
    });

// Update clinic (partial)
export const updateClinicSchema = baseClinicSchema.partial();

// List query (search by name.en/th, sort: newest/name/contract, paginate 18 default)
export const listClinicQuerySchema = z.object({
    search: z.string().optional(),
    sort: z.enum(['newest', 'name', 'contract']).optional().default('newest'),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(18),
});

export const clinicParamSchema = z.object({
    id: z.string().min(1, 'ID is required'),
});

// Timeline validations
const timelineItemSchema = z.object({
    serviceType: z.enum(['setup', 'coperateIdentity', 'website', 'socialMedia', 'training']),
    serviceName: z.string().min(1, 'Service name is required'),
    serviceAmount: z.string().default('---'),
    weekStart: z.number().min(0, 'Week start must be at least 0'),  // 0 = ยังไม่กำหนด
    weekEnd: z.number().min(0, 'Week end must be at least 0'),      // 0 = ยังไม่กำหนด
}).refine(data => data.weekEnd >= data.weekStart, {
    message: 'Week end must be greater than or equal to week start',
    path: ['weekEnd'],
});

// Update entire timeline
export const updateTimelineSchema = z.object({
    timeline: z.array(timelineItemSchema),
});

// Add/Update single timeline item
export const timelineItemInputSchema = timelineItemSchema;

// Update single timeline item (with id)
export const updateTimelineItemSchema = z.object({
    weekStart: z.number().min(0).optional(),  // 0 = ยังไม่กำหนด
    weekEnd: z.number().min(0).optional(),    // 0 = ยังไม่กำหนด
    serviceName: z.string().min(1).optional(),
    serviceAmount: z.string().optional(),
});

// Timeline item param
export const timelineItemParamSchema = z.object({
    id: z.string().min(1, 'Clinic ID is required'),
    itemId: z.string().min(1, 'Timeline item ID is required'),
});

export type CreateClinicDTO = z.infer<typeof createClinicSchema>;
export type UpdateClinicDTO = z.infer<typeof updateClinicSchema>;
export type ListClinicQueryDTO = z.infer<typeof listClinicQuerySchema>;
export type ClinicParamDTO = z.infer<typeof clinicParamSchema>;
export type UpdateTimelineDTO = z.infer<typeof updateTimelineSchema>;
export type TimelineItemInputDTO = z.infer<typeof timelineItemInputSchema>;
export type UpdateTimelineItemDTO = z.infer<typeof updateTimelineItemSchema>;
export type TimelineItemParamDTO = z.infer<typeof timelineItemParamSchema>;

export default {
    create: createClinicSchema,
    update: updateClinicSchema,
    list: listClinicQuerySchema,
    param: clinicParamSchema,
    // Timeline
    updateTimeline: updateTimelineSchema,
    timelineItem: timelineItemInputSchema,
    updateTimelineItem: updateTimelineItemSchema,
    timelineItemParam: timelineItemParamSchema,
};