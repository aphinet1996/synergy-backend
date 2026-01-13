import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validateQuery, validateParams, validateBody } from '@middlewares/validation.middleware';
import {
    uploadSingleFile,
    uploadMultipleFiles,
    uploadSingleImage,
    uploadMultipleImages,
    uploadSingleDocument,
    uploadMultipleDocuments,
    handleMulterError,
} from '@middlewares/upload.middleware';
import uploadController from '@controllers/upload.controller';
import uploadValidation from '@validations/upload.validation';

const router = Router();

// All upload routes require authentication
router.use(authenticate);

// ============================================
// Flexible Upload (Images & Documents)
// ============================================

/**
 * @route   POST /api/v1/uploads/file
 * @desc    Upload single file (image or document)
 * @query   folder - clinics | tasks | users | general
 * @query   type - image | document | any (default: any)
 * @body    file (multipart/form-data)
 * @access  Private
 */
router.post(
    '/file',
    validateQuery(uploadValidation.uploadQuery),
    uploadSingleFile,
    handleMulterError,
    uploadController.uploadFile
);

/**
 * @route   POST /api/v1/uploads/files
 * @desc    Upload multiple files (max 10)
 * @query   folder - clinics | tasks | users | general
 * @query   type - image | document | any (default: any)
 * @body    files[] (multipart/form-data)
 * @access  Private
 */
router.post(
    '/files',
    validateQuery(uploadValidation.uploadQuery),
    uploadMultipleFiles,
    handleMulterError,
    uploadController.uploadFiles
);

// ============================================
// Image-Specific Endpoints
// ============================================

/**
 * @route   POST /api/v1/uploads/image
 * @desc    Upload single image (JPEG, PNG, WebP, GIF only)
 * @query   folder - clinics | tasks | users | general
 * @body    image (multipart/form-data)
 * @access  Private
 */
router.post(
    '/image',
    validateQuery(uploadValidation.uploadQuery),
    uploadSingleImage,
    handleMulterError,
    uploadController.uploadImage
);

/**
 * @route   POST /api/v1/uploads/images
 * @desc    Upload multiple images (max 5)
 * @query   folder - clinics | tasks | users | general
 * @body    images[] (multipart/form-data)
 * @access  Private
 */
router.post(
    '/images',
    validateQuery(uploadValidation.uploadQuery),
    uploadMultipleImages,
    handleMulterError,
    uploadController.uploadImages
);

// ============================================
// Document-Specific Endpoints
// ============================================

/**
 * @route   POST /api/v1/uploads/document
 * @desc    Upload single document (PDF, Word, Excel, etc.)
 * @query   folder - clinics | tasks | users | general
 * @body    document (multipart/form-data)
 * @access  Private
 */
router.post(
    '/document',
    validateQuery(uploadValidation.uploadQuery),
    uploadSingleDocument,
    handleMulterError,
    uploadController.uploadDocument
);

/**
 * @route   POST /api/v1/uploads/documents
 * @desc    Upload multiple documents (max 10)
 * @query   folder - clinics | tasks | users | general
 * @body    documents[] (multipart/form-data)
 * @access  Private
 */
router.post(
    '/documents',
    validateQuery(uploadValidation.uploadQuery),
    uploadMultipleDocuments,
    handleMulterError,
    uploadController.uploadDocuments
);

// ============================================
// Delete & Check Endpoints
// ============================================

/**
 * @route   DELETE /api/v1/uploads/:filename
 * @desc    Delete file by filename
 * @query   folder - clinics | tasks | users | general
 * @access  Private
 */
router.delete(
    '/:filename',
    validateParams(uploadValidation.deleteParam),
    validateQuery(uploadValidation.deleteQuery),
    uploadController.deleteFile
);

/**
 * @route   POST /api/v1/uploads/delete-by-url
 * @desc    Delete file by URL
 * @body    { url: string }
 * @access  Private
 */
router.post(
    '/delete-by-url',
    validateBody(uploadValidation.deleteByUrl),
    uploadController.deleteFileByUrl
);

/**
 * @route   POST /api/v1/uploads/delete-multiple
 * @desc    Delete multiple files by URLs
 * @body    { urls: string[] }
 * @access  Private
 */
router.post(
    '/delete-multiple',
    uploadController.deleteMultipleFiles
);

/**
 * @route   GET /api/v1/uploads/check/:filename
 * @desc    Check if file exists and get info
 * @query   folder - clinics | tasks | users | general
 * @access  Private
 */
router.get(
    '/check/:filename',
    validateParams(uploadValidation.deleteParam),
    validateQuery(uploadValidation.deleteQuery),
    uploadController.checkFile
);

export default router;