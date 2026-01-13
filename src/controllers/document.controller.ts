import { Request, Response } from 'express';
import DocumentService from '@services/document.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@middlewares/error.middleware';

// Request interfaces
interface ClinicRequest extends AuthRequest {
    params: { id: string };
}

interface DocumentRequest extends AuthRequest {
    params: { id: string; docId: string };
}

const documentService = new DocumentService();

export class DocumentController {
    /**
     * GET /clinic/:id/documents
     * List all documents for a clinic
     */
    public getDocuments = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const { documents, pagination } = await documentService.getDocuments(
                req.params.id,
                req.query as any,
                req.userId!
            );

            res.status(200).json({
                status: 'success',
                results: documents.length,
                pagination,
                data: { documents },
            });
        }),
    ];

    /**
     * GET /clinic/:id/documents/:docId
     * Get single document
     */
    public getDocument = [
        asyncHandler(async (req: DocumentRequest, res: Response) => {
            const document = await documentService.getDocumentById(
                req.params.id,
                req.params.docId,
                req.userId!
            );

            res.status(200).json({
                status: 'success',
                data: { document },
            });
        }),
    ];

    /**
     * POST /clinic/:id/documents
     * Create new document
     */
    public createDocument = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const document = await documentService.createDocument(
                req.params.id,
                req.body,
                req.userId!
            );

            res.status(201).json({
                status: 'success',
                message: 'Document created successfully',
                data: { document },
            });
        }),
    ];

    /**
     * PUT /clinic/:id/documents/:docId
     * Update document (title or content)
     */
    public updateDocument = [
        asyncHandler(async (req: DocumentRequest, res: Response) => {
            const document = await documentService.updateDocument(
                req.params.id,
                req.params.docId,
                req.body,
                req.userId!
            );

            res.status(200).json({
                status: 'success',
                message: 'Document updated successfully',
                data: { document },
            });
        }),
    ];

    /**
     * DELETE /clinic/:id/documents/:docId
     * Delete document
     */
    public deleteDocument = [
        asyncHandler(async (req: DocumentRequest, res: Response) => {
            await documentService.deleteDocument(
                req.params.id,
                req.params.docId,
                req.userId!
            );

            res.status(200).json({
                status: 'success',
                message: 'Document deleted successfully',
            });
        }),
    ];
}

export default new DocumentController();