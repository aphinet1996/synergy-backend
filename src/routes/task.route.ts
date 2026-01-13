import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validateQuery, validateParams, validateBody } from '@middlewares/validation.middleware';
import taskController from '@controllers/task.controller';
import taskValidation from '@validations/task.validation';

const router = Router();

router.use(authenticate);

router.get(
    '/',
    validateQuery(taskValidation.list),
    taskController.getTasks
);

router.get(
    '/:id',
    validateParams(taskValidation.param),
    taskController.getTask
);

router.post(
    '/',
    validateBody(taskValidation.create),
    taskController.createTask
);

router.put(
    '/:id',
    validateParams(taskValidation.param),
    validateBody(taskValidation.update),
    taskController.updateTask
);

router.delete(
    '/:id',
    validateParams(taskValidation.param),
    taskController.deleteTask
);

// Process routes
router.put(
    '/:taskId/process/:processId',
    validateParams(taskValidation.processUpdateParam),
    validateBody(taskValidation.updateProcess),
    taskController.updateProcess
);

router.post(
    '/:taskId/process/:processId/comment',
    validateParams(taskValidation.commentParam),
    validateBody(taskValidation.createComment),
    taskController.addComment
);

export default router;