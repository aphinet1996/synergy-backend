import { Request } from 'express';

export type UploadFolder = 'clinics' | 'tasks' | 'users' | 'general';
export type FileCategory = 'image' | 'document' | 'any';

// Allowed MIME types
export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
export type AllowedDocMime = 
    | 'application/pdf'
    | 'application/msword'
    | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    | 'application/vnd.ms-excel'
    | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    | 'application/vnd.ms-powerpoint'
    | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    | 'text/plain'
    | 'text/csv';

export type AllowedMimeType = AllowedImageMime | AllowedDocMime;

// ใช้ Express.Multer.File โดยตรงจาก @types/multer
export interface IUploadResponse {
    url: string;
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    folder: UploadFolder;
    category: FileCategory;
}

export interface IUploadConfig {
    maxFileSize: number;
    allowedMimeTypes: AllowedMimeType[];
    uploadFolder: UploadFolder;
}

// ใช้ Express.Multer.File type โดยตรง (จาก @types/multer)
export interface MulterRequest extends Request {
    file?: Express.Multer.File;
    files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

// Image MIME types
export const IMAGE_MIME_TYPES: AllowedImageMime[] = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
];

// Document MIME types
export const DOCUMENT_MIME_TYPES: AllowedDocMime[] = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
];

// All allowed MIME types
export const ALL_MIME_TYPES: AllowedMimeType[] = [
    ...IMAGE_MIME_TYPES,
    ...DOCUMENT_MIME_TYPES,
];

// Default configs
export const DEFAULT_IMAGE_CONFIG: IUploadConfig = {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: IMAGE_MIME_TYPES,
    uploadFolder: 'general',
};

export const DEFAULT_DOCUMENT_CONFIG: IUploadConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB for documents
    allowedMimeTypes: DOCUMENT_MIME_TYPES,
    uploadFolder: 'general',
};

export const DEFAULT_ANY_CONFIG: IUploadConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ALL_MIME_TYPES,
    uploadFolder: 'general',
};

export const UPLOAD_FOLDERS: Record<UploadFolder, string> = {
    clinics: 'clinics',
    tasks: 'tasks',
    users: 'users',
    general: 'general',
};

// File extension mapping for display
export const MIME_TO_EXTENSION: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
};

// Helper to determine file category
export const getFileCategory = (mimetype: string): FileCategory => {
    if (IMAGE_MIME_TYPES.includes(mimetype as AllowedImageMime)) {
        return 'image';
    }
    if (DOCUMENT_MIME_TYPES.includes(mimetype as AllowedDocMime)) {
        return 'document';
    }
    return 'any';
};