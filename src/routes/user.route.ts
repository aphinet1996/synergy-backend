import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { validateQuery, validateParams, validateBody } from '@middlewares/validation.middleware';
import userController from '@controllers/user.controller';
import userValidation from '@validations/user.validation';

const router = Router();

router.use(authenticate);

router.get('/me', userController.getMe);

// Admin/Manager routes
router.get(
    '/',
    validateQuery(userValidation.list),
    authorize('admin', 'manager'),
    userController.getUsers
);

router.get(
    '/:id',
    validateParams(userValidation.param),
    userController.getUser
);

router.post(
    '/',
    validateBody(userValidation.create),
    // authorize('admin', 'manager'),
    userController.createUser
);

router.put(
    '/:id',
    validateParams(userValidation.param),
    validateBody(userValidation.update),
    userController.updateUser
);

router.delete(
    '/:id',
    validateParams(userValidation.param),
    authorize('admin'),
    userController.deleteUser
);

export default router;