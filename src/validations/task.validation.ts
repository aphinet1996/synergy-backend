import { z } from 'zod';

const workloadItemSchema = z.object({
    section: z.string().min(1, 'Section is required'),
    amount: z.number().min(0, 'Amount must be 0 or greater'),
});

const workloadSchema = z.object({
    video: z.array(workloadItemSchema).min(0),
    website: z.array(workloadItemSchema).min(0),
    image: z.array(workloadItemSchema).min(0),
    shooting: z.array(workloadItemSchema).min(0),
});

const commentSchema = z.object({
    text: z.string().min(1, 'Comment text is required'),
    user: z.string().min(1, 'User ID is required'),
    date: z.coerce.date(),
});

const processItemSchema = z.object({
    name: z.string().min(1, 'Process name is required'),
    assignee: z.array(z.string().min(1)).min(1, 'At least one assignee required'),
    comments: commentSchema.optional(),
    attachments: z.array(z.string().url('Invalid attachment URL')).min(0),
    status: z.enum(['pending', 'process', 'review', 'done', 'delete']),
});

// Base task fields
const baseTaskSchema = z.object({
    name: z.string().min(1, 'Task name is required'),
    description: z.string().min(1, 'Description is required'),
    attachments: z.array(z.string().url('Invalid attachment URL')).min(0),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
    status: z.enum(['pending', 'process', 'review', 'done', 'delete']),
    tag: z.array(z.string()).min(0),
    startDate: z.coerce.date(),
    dueDate: z.coerce.date(),
    clinicId: z.string().min(1, 'Clinic ID is required'),
    process: z.array(processItemSchema).min(1, 'At least one process required'),
    workload: workloadSchema,
});

// Create task (full required)
export const createTaskSchema = baseTaskSchema;

// Update task (partial)
export const updateTaskSchema = baseTaskSchema.partial();

// Update process (for assignee to update their process)
export const updateProcessSchema = z.object({
    status: z.enum(['pending', 'process', 'review', 'done']).optional(),
    attachments: z.array(z.string()).optional(),
});

// List query (filter by status, priority, clinicId, search by name/desc, paginate default 10)
export const listTaskQuerySchema = z.object({
    search: z.string().optional(),
    status: z.enum(['pending', 'process', 'review', 'done', 'delete']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    clinicId: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(50).default(10),
});

export const taskParamSchema = z.object({
    id: z.string().min(1, 'ID is required'),
});

// Param schema for process update
export const processUpdateParamSchema = z.object({
    taskId: z.string().min(1, 'Task ID is required'),
    processId: z.string().min(1, 'Process ID is required'),
});

export const createCommentSchema = z.object({
    text: z.string().min(1, 'Comment text is required').max(1000, 'Comment too long'),
});

export const updateCommentSchema = createCommentSchema.partial();

export const commentParamSchema = z.object({
    taskId: z.string().min(1, 'Task ID is required'),
    processId: z.string().min(1, 'Process ID is required'),
    commentId: z.string().min(1, 'Comment ID is required').optional(),
});

export const processParamSchema = z.object({
    processId: z.string().min(1, 'Process ID is required'),
});

export type CreateTaskDTO = z.infer<typeof createTaskSchema>;
export type UpdateTaskDTO = z.infer<typeof updateTaskSchema>;
export type UpdateProcessDTO = z.infer<typeof updateProcessSchema>;
export type ListTaskQueryDTO = z.infer<typeof listTaskQuerySchema>;
export type TaskParamDTO = z.infer<typeof taskParamSchema>;
export type ProcessUpdateParamDTO = z.infer<typeof processUpdateParamSchema>;

export type CreateCommentDTO = z.infer<typeof createCommentSchema>;
export type UpdateCommentDTO = z.infer<typeof updateCommentSchema>;
export type CommentParamDTO = z.infer<typeof commentParamSchema>;

export default {
    create: createTaskSchema,
    update: updateTaskSchema,
    updateProcess: updateProcessSchema,
    list: listTaskQuerySchema,
    param: taskParamSchema,
    processUpdateParam: processUpdateParamSchema,
    processParam: processParamSchema,
    commentParam: commentParamSchema,
    createComment: createCommentSchema,
};