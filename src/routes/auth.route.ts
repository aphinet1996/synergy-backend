import { Router } from 'express';
import authController from '@controllers/auth.controller';
import { authenticate } from '@middlewares/auth.middleware';
import { validateBody } from '@middlewares/validation.middleware';
import { authValidation } from '@validations/auth.validation';

const router = Router();

// Public routes
router.post(
    '/register',
    validateBody(authValidation.register),
    authController.register
);

router.post(
    '/login',
    validateBody(authValidation.login),
    authController.login
);

router.post(
    '/refresh-token',
    validateBody(authValidation.refreshToken),
    authController.refreshToken
);

router.post(
    '/forgot-password',
    validateBody(authValidation.forgotPassword),
    authController.forgotPassword
);

router.post(
    '/reset-password',
    validateBody(authValidation.resetPassword),
    authController.resetPassword
);

// Protected routes
router.use(authenticate);

router.post('/logout', authController.logout);
router.get('/me', authController.getMe);

router.patch(
    '/profile',
    validateBody(authValidation.updateProfile),
    authController.updateProfile
);

router.post(
    '/change-password',
    validateBody(authValidation.changePassword),
    authController.changePassword
);

export default router;
