import { z } from 'zod';

// Create procedure
export const createProcedureSchema = z.object({
    name: z.string().min(1, 'Procedure name is required').max(200, 'Procedure name too long'),
});

// Update procedure
export const updateProcedureSchema = z.object({
    name: z.string().min(1, 'Procedure name is required').max(200, 'Procedure name too long').optional(),
    isActive: z.boolean().optional(),
});

// List query
export const listProcedureQuerySchema = z.object({
    search: z.string().optional(),
    isActive: z.enum(['true', 'false', 'all']).optional().default('true'),
    sort: z.enum(['newest', 'name']).optional().default('name'),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
});

// Param
export const procedureParamSchema = z.object({
    id: z.string().min(1, 'ID is required'),
});

// Bulk create
export const bulkCreateProcedureSchema = z.object({
    procedures: z.array(
        z.object({
            name: z.string().min(1, 'Procedure name is required').max(200),
            description: z.string().max(500).optional(),
        })
    ).min(1, 'At least one procedure is required'),
});

export type CreateProcedureDTO = z.infer<typeof createProcedureSchema>;
export type UpdateProcedureDTO = z.infer<typeof updateProcedureSchema>;
export type ListProcedureQueryDTO = z.infer<typeof listProcedureQuerySchema>;
export type ProcedureParamDTO = z.infer<typeof procedureParamSchema>;
export type BulkCreateProcedureDTO = z.infer<typeof bulkCreateProcedureSchema>;

export default {
    create: createProcedureSchema,
    update: updateProcedureSchema,
    list: listProcedureQuerySchema,
    param: procedureParamSchema,
    bulkCreate: bulkCreateProcedureSchema,
};