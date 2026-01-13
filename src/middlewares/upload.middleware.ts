import multer, { FileFilterCallback, StorageEngine } from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
    UploadFolder,
    FileCategory,
    AllowedMimeType,
    IMAGE_MIME_TYPES,
    DOCUMENT_MIME_TYPES,
    ALL_MIME_TYPES,
    UPLOAD_FOLDERS,
    DEFAULT_IMAGE_CONFIG,
    DEFAULT_DOCUMENT_CONFIG,
    DEFAULT_ANY_CONFIG,
} from '@interfaces/upload.interface';
import { ValidationException } from '@exceptions/HttpExcetion';

// Base upload directory
const UPLOAD_BASE_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directories exist
const ensureUploadDirs = (): void => {
    Object.values(UPLOAD_FOLDERS).forEach((folder) => {
        const dirPath = path.join(UPLOAD_BASE_DIR, folder);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });
};

// Initialize directories on module load
ensureUploadDirs();

// Get folder from request query or default
const getFolderFromRequest = (req: Request): UploadFolder => {
    const folder = req.query.folder as UploadFolder;
    return UPLOAD_FOLDERS[folder] ? folder : 'general';
};

// Get file type from request query or default
const getTypeFromRequest = (req: Request): FileCategory => {
    const type = req.query.type as FileCategory;
    return ['image', 'document', 'any'].includes(type) ? type : 'any';
};

// Configure storage
const storage: StorageEngine = multer.diskStorage({
    destination: (req: Request, file: Express.Multer.File, cb) => {
        const folder = getFolderFromRequest(req);
        const uploadPath = path.join(UPLOAD_BASE_DIR, folder);

        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: (req: Request, file: Express.Multer.File, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${uuidv4()}-${Date.now()}${ext}`;
        cb(null, uniqueName);
    },
});

// Dynamic file filter based on type query param
const createFileFilter = (allowedTypes: AllowedMimeType[]) => {
    return (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
        if (allowedTypes.includes(file.mimetype as AllowedMimeType)) {
            cb(null, true);
        } else {
            const typeNames = allowedTypes.length > 5
                ? 'the specified file types'
                : allowedTypes.map(t => t.split('/')[1]).join(', ');
            cb(new ValidationException(`Invalid file type. Allowed: ${typeNames}`));
        }
    };
};

// Flexible file filter that checks request query
const flexibleFileFilter = (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
): void => {
    const fileType = getTypeFromRequest(req);

    let allowedTypes: AllowedMimeType[];
    switch (fileType) {
        case 'image':
            allowedTypes = IMAGE_MIME_TYPES;
            break;
        case 'document':
            allowedTypes = DOCUMENT_MIME_TYPES;
            break;
        default:
            allowedTypes = ALL_MIME_TYPES;
    }

    if (allowedTypes.includes(file.mimetype as AllowedMimeType)) {
        cb(null, true);
    } else {
        cb(new ValidationException(
            `Invalid file type for ${fileType}. File type: ${file.mimetype}`
        ));
    }
};

// Get max file size based on type
const getMaxFileSize = (type: FileCategory): number => {
    switch (type) {
        case 'image':
            return DEFAULT_IMAGE_CONFIG.maxFileSize;
        case 'document':
            return DEFAULT_DOCUMENT_CONFIG.maxFileSize;
        default:
            return DEFAULT_ANY_CONFIG.maxFileSize;
    }
};

// ============================================
// Multer Upload Instances
// ============================================

// Single file upload (flexible - images or documents)
export const uploadSingleFile = multer({
    storage,
    fileFilter: flexibleFileFilter,
    limits: {
        fileSize: DEFAULT_ANY_CONFIG.maxFileSize,
        files: 1,
    },
}).single('file');

// Multiple files upload (flexible - max 10)
export const uploadMultipleFiles = multer({
    storage,
    fileFilter: flexibleFileFilter,
    limits: {
        fileSize: DEFAULT_ANY_CONFIG.maxFileSize,
        files: 10,
    },
}).array('files', 10);

// Single image only
export const uploadSingleImage = multer({
    storage,
    fileFilter: createFileFilter(IMAGE_MIME_TYPES),
    limits: {
        fileSize: DEFAULT_IMAGE_CONFIG.maxFileSize,
        files: 1,
    },
}).single('image');

// Multiple images (max 5)
export const uploadMultipleImages = multer({
    storage,
    fileFilter: createFileFilter(IMAGE_MIME_TYPES),
    limits: {
        fileSize: DEFAULT_IMAGE_CONFIG.maxFileSize,
        files: 5,
    },
}).array('images', 5);

// Single document only
export const uploadSingleDocument = multer({
    storage,
    fileFilter: createFileFilter(DOCUMENT_MIME_TYPES),
    limits: {
        fileSize: DEFAULT_DOCUMENT_CONFIG.maxFileSize,
        files: 1,
    },
}).single('document');

// Multiple documents (max 10)
export const uploadMultipleDocuments = multer({
    storage,
    fileFilter: createFileFilter(DOCUMENT_MIME_TYPES),
    limits: {
        fileSize: DEFAULT_DOCUMENT_CONFIG.maxFileSize,
        files: 10,
    },
}).array('documents', 10);

// ============================================
// Error Handler
// ============================================

export const handleMulterError = (
    error: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (error instanceof multer.MulterError) {
        switch (error.code) {
            case 'LIMIT_FILE_SIZE':
                return next(new ValidationException('File size exceeds limit (5MB for images, 10MB for documents)'));
            case 'LIMIT_FILE_COUNT':
                return next(new ValidationException('Too many files uploaded'));
            case 'LIMIT_UNEXPECTED_FILE':
                return next(new ValidationException(`Unexpected field name: ${error.field}`));
            default:
                return next(new ValidationException(`Upload error: ${error.message}`));
        }
    }
    next(error);
};

// Export base directory for service use
export const getUploadBasePath = (): string => UPLOAD_BASE_DIR;

export default {
    // Flexible uploads
    uploadSingleFile,
    uploadMultipleFiles,
    // Image-specific
    uploadSingleImage,
    uploadMultipleImages,
    // Document-specific
    uploadSingleDocument,
    uploadMultipleDocuments,
    // Error handler
    handleMulterError,
    getUploadBasePath,
};