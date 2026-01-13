import { z } from 'zod';

// Create document
export const createDocumentSchema = z.object({
    title: z
        .string()
        .min(1, 'Title is required')
        .max(200, 'Title cannot exceed 200 characters')
        .trim(),
    content: z.string().optional().default('<p></p>'),
});

// Update document
export const updateDocumentSchema = z.object({
    title: z
        .string()
        .min(1, 'Title is required')
        .max(200, 'Title cannot exceed 200 characters')
        .trim()
        .optional(),
    content: z.string().optional(),
});

// List documents query
export const listDocumentsQuerySchema = z.object({
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
});

// Clinic param (for /clinic/:id/documents)
export const clinicParamSchema = z.object({
    id: z.string().min(1, 'Clinic ID is required'),
});

// Document param (for /clinic/:id/documents/:docId)
export const documentParamSchema = z.object({
    id: z.string().min(1, 'Clinic ID is required'),
    docId: z.string().min(1, 'Document ID is required'),
});

// Types
export type CreateDocumentDTO = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentDTO = z.infer<typeof updateDocumentSchema>;
export type ListDocumentsQueryDTO = z.infer<typeof listDocumentsQuerySchema>;
export type ClinicParamDTO = z.infer<typeof clinicParamSchema>;
export type DocumentParamDTO = z.infer<typeof documentParamSchema>;

export default {
    create: createDocumentSchema,
    update: updateDocumentSchema,
    list: listDocumentsQuerySchema,
    clinicParam: clinicParamSchema,
    documentParam: documentParamSchema,
};