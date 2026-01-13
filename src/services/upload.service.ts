import fs from 'fs';
import path from 'path';
import {
    IUploadResponse,
    UploadFolder,
    UPLOAD_FOLDERS,
    getFileCategory,
} from '@interfaces/upload.interface';
import { NotFoundException, ValidationException } from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import { getUploadBasePath } from '@middlewares/upload.middleware';
import { BASE_URL, UPLOADS_PATH } from '@config/index';

export class UploadService {
    private baseUrl: string;
    private uploadsPath: string;

    constructor() {
        // http://localhost:3000
        this.baseUrl = BASE_URL || 'http://localhost:3000';
        // /uploads
        this.uploadsPath = UPLOADS_PATH || '/uploads';
    }

    /**
     * Process single uploaded file
     */
    async processUpload(
        file: Express.Multer.File | undefined,
        folder: UploadFolder
    ): Promise<IUploadResponse> {
        if (!file) {
            throw new ValidationException('No file uploaded');
        }

        const fileUrl = this.generateFileUrl(file.filename, folder);
        const category = getFileCategory(file.mimetype);

        logger.info(`File uploaded: ${file.filename} (${category}) to ${folder}`);

        return {
            url: fileUrl,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            folder,
            category,
        };
    }

    /**
     * Process multiple uploaded files
     */
    async processMultipleUploads(
        files: Express.Multer.File[] | undefined,
        folder: UploadFolder
    ): Promise<IUploadResponse[]> {
        if (!files || files.length === 0) {
            throw new ValidationException('No files uploaded');
        }

        const results = files.map((file) => ({
            url: this.generateFileUrl(file.filename, folder),
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            folder,
            category: getFileCategory(file.mimetype),
        }));

        logger.info(`${files.length} files uploaded to ${folder}`);

        return results;
    }

    /**
     * Delete a file by filename and folder
     */
    async deleteFile(filename: string, folder: UploadFolder): Promise<boolean> {
        const filePath = this.getFilePath(filename, folder);

        if (!fs.existsSync(filePath)) {
            throw new NotFoundException('File not found');
        }

        // Security: Ensure file is within upload directory
        const basePath = getUploadBasePath();
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(basePath)) {
            throw new ValidationException('Invalid file path');
        }

        try {
            fs.unlinkSync(filePath);
            logger.info(`File deleted: ${filename} from ${folder}`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete file: ${filename}`, error);
            throw new ValidationException('Failed to delete file');
        }
    }

    /**
     * Delete file by URL
     */
    async deleteFileByUrl(fileUrl: string): Promise<boolean> {
        const { filename, folder } = this.parseFileUrl(fileUrl);
        return this.deleteFile(filename, folder);
    }

    /**
     * Delete multiple files by URLs
     */
    async deleteMultipleByUrls(fileUrls: string[]): Promise<{ deleted: string[]; failed: string[] }> {
        const deleted: string[] = [];
        const failed: string[] = [];

        for (const url of fileUrls) {
            try {
                await this.deleteFileByUrl(url);
                deleted.push(url);
            } catch (error) {
                failed.push(url);
                logger.warn(`Failed to delete: ${url}`);
            }
        }

        return { deleted, failed };
    }

    /**
     * Check if file exists
     */
    async fileExists(filename: string, folder: UploadFolder): Promise<boolean> {
        const filePath = this.getFilePath(filename, folder);
        return fs.existsSync(filePath);
    }

    /**
     * Get file info
     */
    async getFileInfo(filename: string, folder: UploadFolder): Promise<{
        exists: boolean;
        url?: string;
        size?: number;
        createdAt?: Date;
    }> {
        const filePath = this.getFilePath(filename, folder);

        if (!fs.existsSync(filePath)) {
            return { exists: false };
        }

        const stats = fs.statSync(filePath);
        return {
            exists: true,
            url: this.generateFileUrl(filename, folder),
            size: stats.size,
            createdAt: stats.birthtime,
        };
    }

    /**
     * Clean up orphaned files (files not referenced in DB)
     */
    async cleanupOrphanedFiles(
        folder: UploadFolder,
        activeUrls: string[]
    ): Promise<{ deleted: number; kept: number }> {
        const folderPath = path.join(getUploadBasePath(), folder);

        if (!fs.existsSync(folderPath)) {
            return { deleted: 0, kept: 0 };
        }

        const files = fs.readdirSync(folderPath);
        const activeFilenames = new Set(
            activeUrls.map((url) => {
                try {
                    return this.parseFileUrl(url).filename;
                } catch {
                    return null;
                }
            }).filter(Boolean)
        );

        let deleted = 0;
        let kept = 0;

        for (const filename of files) {
            if (activeFilenames.has(filename)) {
                kept++;
            } else {
                try {
                    fs.unlinkSync(path.join(folderPath, filename));
                    deleted++;
                } catch (error) {
                    logger.error(`Failed to delete orphaned file: ${filename}`);
                }
            }
        }

        logger.info(`Cleanup ${folder}: deleted ${deleted}, kept ${kept}`);
        return { deleted, kept };
    }

    // ============================================
    // Private Helpers
    // ============================================

    /**
     * Generate file URL
     * Result: http://localhost:3000/uploads/tasks/uuid-123.jpg
     */
    private generateFileUrl(filename: string, folder: UploadFolder): string {
        // baseUrl = http://localhost:3000
        // uploadsPath = /uploads
        // Result: http://localhost:3000/uploads/tasks/filename.jpg
        return `${this.baseUrl}${this.uploadsPath}/${folder}/${filename}`;
    }

    private getFilePath(filename: string, folder: UploadFolder): string {
        return path.join(getUploadBasePath(), folder, filename);
    }

    private parseFileUrl(fileUrl: string): { filename: string; folder: UploadFolder } {
        try {
            const url = new URL(fileUrl);
            const pathParts = url.pathname.split('/');

            // Expected: /uploads/{folder}/{filename}
            const uploadsIndex = pathParts.indexOf('uploads');
            if (uploadsIndex === -1 || pathParts.length < uploadsIndex + 3) {
                throw new Error('Invalid URL format');
            }

            const folder = pathParts[uploadsIndex + 1] as UploadFolder;
            const filename = pathParts[uploadsIndex + 2];

            if (!UPLOAD_FOLDERS[folder]) {
                throw new Error('Invalid folder');
            }

            return { filename, folder };
        } catch (error) {
            throw new ValidationException('Invalid file URL format');
        }
    }
}

export default UploadService;