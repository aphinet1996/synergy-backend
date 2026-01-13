import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { validateQuery, validateParams, validateBody } from '@middlewares/validation.middleware';
import procedureController from '@controllers/procedure.controller';
import procedureValidation from '@validations/procedure.validation';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ==================== PUBLIC ROUTES (All authenticated users) ====================

// GET /procedure/active - Get active procedures for dropdown/form
router.get(
    '/active',
    procedureController.getActiveProcedures
);

// ==================== ADMIN ROUTES ====================

// GET /procedure - List all procedures (admin only)
router.get(
    '/',
    authorize('admin'),
    validateQuery(procedureValidation.list),
    procedureController.getProcedures
);

// GET /procedure/:id - Get single procedure (admin only)
router.get(
    '/:id',
    authorize('admin'),
    validateParams(procedureValidation.param),
    procedureController.getProcedure
);

// POST /procedure - Create procedure (admin only)
router.post(
    '/',
    authorize('admin'),
    validateBody(procedureValidation.create),
    procedureController.createProcedure
);

// POST /procedure/bulk - Bulk create procedures (admin only)
router.post(
    '/bulk',
    authorize('admin'),
    validateBody(procedureValidation.bulkCreate),
    procedureController.bulkCreateProcedures
);

// PUT /procedure/:id - Update procedure (admin only)
router.put(
    '/:id',
    authorize('admin'),
    validateParams(procedureValidation.param),
    validateBody(procedureValidation.update),
    procedureController.updateProcedure
);

// DELETE /procedure/:id - Delete procedure (admin only)
router.delete(
    '/:id',
    authorize('admin'),
    validateParams(procedureValidation.param),
    procedureController.deleteProcedure
);

// PATCH /procedure/:id/deactivate - Deactivate procedure (admin only)
router.patch(
    '/:id/deactivate',
    authorize('admin'),
    validateParams(procedureValidation.param),
    procedureController.deactivateProcedure
);

// PATCH /procedure/:id/activate - Activate procedure (admin only)
router.patch(
    '/:id/activate',
    authorize('admin'),
    validateParams(procedureValidation.param),
    procedureController.activateProcedure
);

export default router;