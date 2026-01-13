import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { validateQuery, validateParams, validateBody } from '@middlewares/validation.middleware';
import positionController from '@controllers/position.controller';
import positionValidation from '@validations/position.validation';

const router = Router();

router.use(authenticate);

// Public routes (for dropdown, etc.)
router.get(
    '/active',
    positionController.getActivePositions
);

// Admin routes
router.get(
    '/',
    validateQuery(positionValidation.list),
    authorize('admin', 'manager'),
    positionController.getPositions
);

router.get(
    '/:id',
    validateParams(positionValidation.param),
    authorize('admin', 'manager'),
    positionController.getPosition
);

router.post(
    '/',
    validateBody(positionValidation.create),
    authorize('admin'),
    positionController.createPosition
);

router.put(
    '/:id',
    validateParams(positionValidation.param),
    validateBody(positionValidation.update),
    authorize('admin'),
    positionController.updatePosition
);

router.patch(
    '/:id/toggle',
    validateParams(positionValidation.param),
    authorize('admin'),
    positionController.togglePosition
);

router.delete(
    '/:id',
    validateParams(positionValidation.param),
    authorize('admin'),
    positionController.deletePosition
);

// Hard delete (permanent) - super admin only
router.delete(
    '/:id/permanent',
    validateParams(positionValidation.param),
    authorize('admin'),
    positionController.hardDeletePosition
);

export default router;