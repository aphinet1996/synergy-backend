import { Response } from 'express';
import { UploadService } from '@services/upload.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@middlewares/error.middleware';
import { MulterRequest, UploadFolder } from '@interfaces/upload.interface';

interface UploadRequest extends AuthRequest, MulterRequest {
    query: { folder?: UploadFolder; type?: string };
    params: { filename?: string };
}

const uploadService = new UploadService();

export class UploadController {
    /**
     * Upload single file (image or document)
     * POST /api/v1/uploads/file?folder=tasks&type=any
     */
    public uploadFile = asyncHandler(async (req: UploadRequest, res: Response) => {
        const folder = (req.query.folder as UploadFolder) || 'general';
        const result = await uploadService.processUpload(
            req.file,
            folder
        );

        res.status(201).json({
            status: 'success',
            message: 'File uploaded successfully',
            data: result,
        });
    });

    /**
     * Upload multiple files (images and/or documents)
     * POST /api/v1/uploads/files?folder=tasks&type=any
     */
    public uploadFiles = asyncHandler(async (req: UploadRequest, res: Response) => {
        const folder = (req.query.folder as UploadFolder) || 'general';
        const results = await uploadService.processMultipleUploads(
            req.files as Express.Multer.File[],
            folder
        );

        res.status(201).json({
            status: 'success',
            message: `${results.length} files uploaded successfully`,
            data: results,
        });
    });

    /**
     * Upload single image
     * POST /api/v1/uploads/image?folder=clinics
     */
    public uploadImage = asyncHandler(async (req: UploadRequest, res: Response) => {
        const folder = (req.query.folder as UploadFolder) || 'general';
        const result = await uploadService.processUpload(
            req.file,
            folder
        );

        res.status(201).json({
            status: 'success',
            message: 'Image uploaded successfully',
            data: result,
        });
    });

    /**
     * Upload multiple images
     * POST /api/v1/uploads/images?folder=clinics
     */
    public uploadImages = asyncHandler(async (req: UploadRequest, res: Response) => {
        const folder = (req.query.folder as UploadFolder) || 'general';
        const results = await uploadService.processMultipleUploads(
            req.files as Express.Multer.File[],
            folder
        );

        res.status(201).json({
            status: 'success',
            message: `${results.length} images uploaded successfully`,
            data: results,
        });
    });

    /**
     * Upload single document
     * POST /api/v1/uploads/document?folder=tasks
     */
    public uploadDocument = asyncHandler(async (req: UploadRequest, res: Response) => {
        const folder = (req.query.folder as UploadFolder) || 'general';
        const result = await uploadService.processUpload(
            req.file,
            folder
        );

        res.status(201).json({
            status: 'success',
            message: 'Document uploaded successfully',
            data: result,
        });
    });

    /**
     * Upload multiple documents
     * POST /api/v1/uploads/documents?folder=tasks
     */
    public uploadDocuments = asyncHandler(async (req: UploadRequest, res: Response) => {
        const folder = (req.query.folder as UploadFolder) || 'general';
        const results = await uploadService.processMultipleUploads(
            req.files as Express.Multer.File[],
            folder
        );

        res.status(201).json({
            status: 'success',
            message: `${results.length} documents uploaded successfully`,
            data: results,
        });
    });

    /**
     * Delete file by filename
     * DELETE /api/v1/uploads/:filename?folder=tasks
     */
    public deleteFile = asyncHandler(async (req: UploadRequest, res: Response) => {
        const { filename } = req.params;
        const folder = (req.query.folder as UploadFolder) || 'general';

        await uploadService.deleteFile(filename!, folder);

        res.status(200).json({
            status: 'success',
            message: 'File deleted successfully',
        });
    });

    /**
     * Delete file by URL
     * POST /api/v1/uploads/delete-by-url
     */
    public deleteFileByUrl = asyncHandler(async (req: UploadRequest, res: Response) => {
        const { url } = req.body;

        await uploadService.deleteFileByUrl(url);

        res.status(200).json({
            status: 'success',
            message: 'File deleted successfully',
        });
    });

    /**
     * Delete multiple files by URLs
     * POST /api/v1/uploads/delete-multiple
     */
    public deleteMultipleFiles = asyncHandler(async (req: UploadRequest, res: Response) => {
        const { urls } = req.body;

        const result = await uploadService.deleteMultipleByUrls(urls);

        res.status(200).json({
            status: 'success',
            message: `Deleted ${result.deleted.length} files`,
            data: result,
        });
    });

    /**
     * Check if file exists
     * GET /api/v1/uploads/check/:filename?folder=tasks
     */
    public checkFile = asyncHandler(async (req: UploadRequest, res: Response) => {
        const { filename } = req.params;
        const folder = (req.query.folder as UploadFolder) || 'general';

        const info = await uploadService.getFileInfo(filename!, folder);

        res.status(200).json({
            status: 'success',
            data: info,
        });
    });
}

export default new UploadController();