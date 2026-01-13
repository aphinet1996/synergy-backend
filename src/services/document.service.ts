import mongoose, { FilterQuery } from 'mongoose';
import ClinicDocument from '@models/document.model';
import Clinic from '@models/clinic.model';
import { IDocumentDoc, CreateDocumentBody, UpdateDocumentBody } from '@interfaces/document.interface';
import {
    CreateDocumentDTO,
    UpdateDocumentDTO,
    ListDocumentsQueryDTO,
} from '@validations/document.validation';
import {
    NotFoundException,
    ForbiddenException,
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

export class DocumentService {
    /**
     * Get all documents for a clinic
     */
    async getDocuments(
        clinicId: string,
        query: ListDocumentsQueryDTO,
        userId: string
    ): Promise<{
        documents: IDocumentDoc[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
    }> {
        this.validateObjectId(clinicId);

        // Verify clinic exists and user has access
        await this.verifyClinicAccess(clinicId, userId);

        const { search, page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;

        // Build filter
        const filter: FilterQuery<IDocumentDoc> = {
            clinicId: new mongoose.Types.ObjectId(clinicId),
        };

        if (search) {
            filter.title = { $regex: search, $options: 'i' };
        }

        const [documents, total] = await Promise.all([
            ClinicDocument.find(filter)
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('createdBy', 'firstname lastname nickname')
                .populate('updatedBy', 'firstname lastname nickname'),
            ClinicDocument.countDocuments(filter),
        ]);

        return {
            documents,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get single document by ID
     */
    async getDocumentById(
        clinicId: string,
        docId: string,
        userId: string
    ): Promise<IDocumentDoc> {
        this.validateObjectId(clinicId);
        this.validateObjectId(docId);

        // Verify clinic access
        await this.verifyClinicAccess(clinicId, userId);

        const document = await ClinicDocument.findOne({
            _id: docId,
            clinicId: new mongoose.Types.ObjectId(clinicId),
        })
            .populate('createdBy', 'firstname lastname nickname')
            .populate('updatedBy', 'firstname lastname nickname');

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        return document;
    }

    /**
     * Create new document
     */
    async createDocument(
        clinicId: string,
        data: CreateDocumentDTO,
        userId: string
    ): Promise<IDocumentDoc> {
        this.validateObjectId(clinicId);

        // Verify clinic access
        await this.verifyClinicAccess(clinicId, userId);

        const documentInput: CreateDocumentBody = {
            clinicId: new mongoose.Types.ObjectId(clinicId),
            title: data.title,
            content: data.content || '<p></p>',
            createdBy: new mongoose.Types.ObjectId(userId),
        };

        const document = await ClinicDocument.create(documentInput);

        // Populate and return
        const populatedDoc = await ClinicDocument.findById(document._id)
            .populate('createdBy', 'firstname lastname nickname');

        logger.info(`Document created: "${data.title}" in clinic ${clinicId} by ${userId}`);

        return populatedDoc!;
    }

    /**
     * Update document
     */
    async updateDocument(
        clinicId: string,
        docId: string,
        data: UpdateDocumentDTO,
        userId: string
    ): Promise<IDocumentDoc> {
        this.validateObjectId(clinicId);
        this.validateObjectId(docId);

        // Verify clinic access
        await this.verifyClinicAccess(clinicId, userId);

        const document = await ClinicDocument.findOne({
            _id: docId,
            clinicId: new mongoose.Types.ObjectId(clinicId),
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        // Update fields
        const updateData: UpdateDocumentBody = {
            updatedBy: new mongoose.Types.ObjectId(userId),
        };

        if (data.title !== undefined) {
            updateData.title = data.title;
        }

        if (data.content !== undefined) {
            updateData.content = data.content;
        }

        const updatedDocument = await ClinicDocument.findByIdAndUpdate(
            docId,
            updateData,
            { new: true, runValidators: true }
        )
            .populate('createdBy', 'firstname lastname nickname')
            .populate('updatedBy', 'firstname lastname nickname');

        if (!updatedDocument) {
            throw new NotFoundException('Document update failed');
        }

        logger.info(`Document updated: "${updatedDocument.title}" in clinic ${clinicId} by ${userId}`);

        return updatedDocument;
    }

    /**
     * Delete document
     */
    async deleteDocument(
        clinicId: string,
        docId: string,
        userId: string
    ): Promise<boolean> {
        this.validateObjectId(clinicId);
        this.validateObjectId(docId);

        // Verify clinic access
        await this.verifyClinicAccess(clinicId, userId);

        const document = await ClinicDocument.findOne({
            _id: docId,
            clinicId: new mongoose.Types.ObjectId(clinicId),
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        await ClinicDocument.findByIdAndDelete(docId);

        logger.info(`Document deleted: "${document.title}" from clinic ${clinicId} by ${userId}`);

        return true;
    }

    // ==================== PRIVATE HELPERS ====================

    /**
     * Validate MongoDB ObjectId
     */
    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid ID format');
        }
    }

    /**
     * Verify user has access to clinic
     */
    private async verifyClinicAccess(clinicId: string, userId: string): Promise<void> {
        const clinic = await Clinic.findById(clinicId);

        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned to clinic
        const isAssigned = clinic.assignedTo.some(
            (id) => id.toString() === userId
        );

        if (!isAssigned) {
            throw new ForbiddenException('Not authorized to access this clinic');
        }
    }
}

export default DocumentService;