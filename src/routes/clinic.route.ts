import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { validateQuery, validateParams, validateBody } from '@middlewares/validation.middleware';
import clinicController from '@controllers/clinic.controller';
import clinicValidation from '@validations/clinic.validation';
import boardController from '@controllers/board.controller';
import boardValidation from '@validations/board.validation';
import documentController from '@controllers/document.controller';
import documentValidation from '@validations/document.validation';

const router = Router();

router.use(authenticate);

// ==================== CLINIC ROUTES ====================

router.get(
    '/',
    validateQuery(clinicValidation.list),
    clinicController.getClinics
);

router.get(
    '/:id',
    validateParams(clinicValidation.param),
    clinicController.getClinic
);

router.get(
    '/:id/procedures',
    validateParams(clinicValidation.param),
    clinicController.getClinicProcedures
);

router.post(
    '/',
    validateBody(clinicValidation.create),
    clinicController.createClinic
);

router.put(
    '/:id',
    validateParams(clinicValidation.param),
    validateBody(clinicValidation.update),
    clinicController.updateClinic
);

router.delete(
    '/:id',
    validateParams(clinicValidation.param),
    clinicController.deleteClinic
);

// ==================== TIMELINE ROUTES ====================

// GET /clinic/:id/timeline - Get timeline
router.get(
    '/:id/timeline',
    validateParams(clinicValidation.param),
    clinicController.getTimeline
);

// PUT /clinic/:id/timeline - Update entire timeline
router.put(
    '/:id/timeline',
    validateParams(clinicValidation.param),
    validateBody(clinicValidation.updateTimeline),
    clinicController.updateTimeline
);

// POST /clinic/:id/timeline/item - Add single timeline item
router.post(
    '/:id/timeline/item',
    validateParams(clinicValidation.param),
    validateBody(clinicValidation.timelineItem),
    clinicController.addTimelineItem
);

// PATCH /clinic/:id/timeline/item/:itemId - Update single item (for drag)
router.patch(
    '/:id/timeline/item/:itemId',
    validateParams(clinicValidation.timelineItemParam),
    validateBody(clinicValidation.updateTimelineItem),
    clinicController.updateTimelineItem
);

// DELETE /clinic/:id/timeline/item/:itemId - Delete single item
router.delete(
    '/:id/timeline/item/:itemId',
    validateParams(clinicValidation.timelineItemParam),
    clinicController.deleteTimelineItem
);

// ==================== DOCUMENT ROUTES ====================

// GET /clinic/:id/documents - List all documents
router.get(
    '/:id/documents',
    validateParams(documentValidation.clinicParam),
    validateQuery(documentValidation.list),
    documentController.getDocuments
);

// GET /clinic/:id/documents/:docId - Get single document
router.get(
    '/:id/documents/:docId',
    validateParams(documentValidation.documentParam),
    documentController.getDocument
);

// POST /clinic/:id/documents - Create new document
router.post(
    '/:id/documents',
    validateParams(documentValidation.clinicParam),
    validateBody(documentValidation.create),
    documentController.createDocument
);

// PUT /clinic/:id/documents/:docId - Update document
router.put(
    '/:id/documents/:docId',
    validateParams(documentValidation.documentParam),
    validateBody(documentValidation.update),
    documentController.updateDocument
);

// DELETE /clinic/:id/documents/:docId - Delete document
router.delete(
    '/:id/documents/:docId',
    validateParams(documentValidation.documentParam),
    documentController.deleteDocument
);

// ==================== BOARD ROUTES ====================

// GET /clinic/:id/boards - Get all boards grouped by procedure (metadata)
router.get(
    '/:id/boards',
    validateParams(boardValidation.clinicParam),
    boardController.getBoards
);

// GET /clinic/:id/boards/procedure/:procedureId - Get boards for a procedure
router.get(
    '/:id/boards/procedure/:procedureId',
    validateParams(boardValidation.procedureBoardsParam),
    boardController.getBoardsByProcedure
);

// GET /clinic/:id/boards/:boardId - Get single board with Excalidraw data
router.get(
    '/:id/boards/:boardId',
    validateParams(boardValidation.param),
    boardController.getBoard
);

// POST /clinic/:id/boards - Create new board
router.post(
    '/:id/boards',
    validateParams(boardValidation.clinicParam),
    validateBody(boardValidation.create),
    boardController.createBoard
);

// PUT /clinic/:id/boards/:boardId - Update board info
router.put(
    '/:id/boards/:boardId',
    validateParams(boardValidation.param),
    validateBody(boardValidation.update),
    boardController.updateBoard
);

// PUT /clinic/:id/boards/:boardId/elements - Save Excalidraw data
router.put(
    '/:id/boards/:boardId/elements',
    validateParams(boardValidation.param),
    validateBody(boardValidation.updateElements),
    boardController.updateBoardElements
);

// DELETE /clinic/:id/boards/:boardId - Delete board
router.delete(
    '/:id/boards/:boardId',
    validateParams(boardValidation.param),
    boardController.deleteBoard
);

export default router;