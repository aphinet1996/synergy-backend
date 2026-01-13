import { z } from 'zod';

// Base position fields
const basePositionSchema = z.object({
    name: z.string()
        .trim()
        .min(1, 'Position name is required')
        .max(100, 'Position name cannot exceed 100 characters'),
    description: z.string()
        .trim()
        .max(500, 'Description cannot exceed 500 characters')
        .optional(),
    isActive: z.boolean(),
});

// Create position
export const createPositionSchema = basePositionSchema.omit({ isActive: true });

// Update position (partial)
export const updatePositionSchema = basePositionSchema.partial();

// List query (filter by isActive, search, paginate)
export const listPositionQuerySchema = z.object({
    search: z.string().optional(),
    isActive: z.coerce.boolean().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
});

export const positionParamSchema = z.object({
    id: z.string().min(1, 'ID is required'),
});

export type CreatePositionDTO = z.infer<typeof createPositionSchema>;
export type UpdatePositionDTO = z.infer<typeof updatePositionSchema>;
export type ListPositionQueryDTO = z.infer<typeof listPositionQuerySchema>;
export type PositionParamDTO = z.infer<typeof positionParamSchema>;

export default {
    create: createPositionSchema,
    update: updatePositionSchema,
    list: listPositionQuerySchema,
    param: positionParamSchema,
};