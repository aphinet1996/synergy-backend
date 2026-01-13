import { z } from 'zod';

// Base todo fields
const baseTodoSchema = z.object({
    name: z.string().min(1, 'Todo name is required'),
    description: z.string().optional(),
    clinicId: z.string().min(1, 'Clinic ID is required'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    status: z.enum(['pending', 'done']),
});

// Create todo (required fields only)
export const createTodoSchema = baseTodoSchema.omit({ status: true });

// Update todo (partial)
export const updateTodoSchema = baseTodoSchema.partial();

// List query (filter by status, priority, clinicId, paginate default 20)
export const listTodoQuerySchema = z.object({
    status: z.enum(['pending', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    clinicId: z.string().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(20),
});

// Team todos query (for manager)
export const teamTodoQuerySchema = z.object({
    status: z.enum(['pending', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    clinicId: z.string().optional(),
    userId: z.string().optional(),
    date: z.coerce.date().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(50),
});

export const todoParamSchema = z.object({
    id: z.string().min(1, 'ID is required'),
});

export type CreateTodoDTO = z.infer<typeof createTodoSchema>;
export type UpdateTodoDTO = z.infer<typeof updateTodoSchema>;
export type ListTodoQueryDTO = z.infer<typeof listTodoQuerySchema>;
export type TeamTodoQueryDTO = z.infer<typeof teamTodoQuerySchema>;
export type TodoParamDTO = z.infer<typeof todoParamSchema>;

export default {
    create: createTodoSchema,
    update: updateTodoSchema,
    list: listTodoQuerySchema,
    team: teamTodoQuerySchema,
    param: todoParamSchema,
};