import { z } from 'zod';

// Upload query params (folder and type selection)
export const uploadQuerySchema = z.object({
    folder: z.enum(['clinics', 'tasks', 'users', 'general']).default('general'),
    type: z.enum(['image', 'document', 'any']).default('any'),
});

// Delete params
export const deleteFileParamSchema = z.object({
    filename: z.string().min(1, 'Filename is required'),
});

// Delete query (folder)
export const deleteFileQuerySchema = z.object({
    folder: z.enum(['clinics', 'tasks', 'users', 'general']).default('general'),
});

// Delete by URL body
export const deleteByUrlSchema = z.object({
    url: z.string().url('Invalid URL format'),
});

// Allowed MIME types as const arrays
const imageMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const documentMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
] as const;

const allMimeTypes = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
] as const;

// Image validation (Zod v4 syntax)
export const imageValidationSchema = z.object({
    mimetype: z.enum(imageMimeTypes, {
        message: 'Only JPEG, PNG, WebP, and GIF images are allowed',
    }),
    size: z.number().max(5 * 1024 * 1024, 'Image size must be less than 5MB'),
});

// Document validation (Zod v4 syntax)
export const documentValidationSchema = z.object({
    mimetype: z.enum(documentMimeTypes, {
        message: 'Only PDF, Word, Excel, PowerPoint, TXT, and CSV files are allowed',
    }),
    size: z.number().max(10 * 1024 * 1024, 'Document size must be less than 10MB'),
});

// Any file validation (Zod v4 syntax)
export const anyFileValidationSchema = z.object({
    mimetype: z.enum(allMimeTypes, {
        message: 'File type not allowed',
    }),
    size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
});

export type UploadQueryDTO = z.infer<typeof uploadQuerySchema>;
export type DeleteFileParamDTO = z.infer<typeof deleteFileParamSchema>;
export type DeleteFileQueryDTO = z.infer<typeof deleteFileQuerySchema>;
export type DeleteByUrlDTO = z.infer<typeof deleteByUrlSchema>;

export default {
    uploadQuery: uploadQuerySchema,
    deleteParam: deleteFileParamSchema,
    deleteQuery: deleteFileQuerySchema,
    deleteByUrl: deleteByUrlSchema,
    imageFile: imageValidationSchema,
    documentFile: documentValidationSchema,
    anyFile: anyFileValidationSchema,
};