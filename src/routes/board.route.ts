import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validateParams, validateBody } from '@middlewares/validation.middleware';
import boardController from '@controllers/board.controller';
import boardValidation from '@validations/board.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /clinic/:id/boards - Get all boards for a clinic (metadata)
router.get(
    '/:id/boards',
    validateParams(boardValidation.clinicParam),
    boardController.getBoards
);

// GET /clinic/:id/boards/:procedureId - Get single board with Excalidraw data
router.get(
    '/:id/boards/:procedureId',
    validateParams(boardValidation.param),
    boardController.getBoard
);

// PUT /clinic/:id/boards/:procedureId - Save board
router.put(
    '/:id/boards/:procedureId',
    validateParams(boardValidation.param),
    validateBody(boardValidation.update),
    boardController.updateBoard
);

// DELETE /clinic/:id/boards/:procedureId - Delete board
router.delete(
    '/:id/boards/:procedureId',
    validateParams(boardValidation.param),
    boardController.deleteBoard
);

export default router;