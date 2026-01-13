import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validateQuery, validateParams, validateBody } from '@middlewares/validation.middleware';
import todoController from '@controllers/todo.controller';
import todoValidation from '@validations/todo.validation';

const router = Router();

router.use(authenticate);

router.get(
    '/stats/today',
    todoController.getTodayStats
);

router.get(
    '/team',
    validateQuery(todoValidation.team),
    todoController.getTeamTodos
);

router.get(
    '/',
    validateQuery(todoValidation.list),
    todoController.getTodos
);

router.get(
    '/:id',
    validateParams(todoValidation.param),
    todoController.getTodo
);

router.post(
    '/',
    validateBody(todoValidation.create),
    todoController.createTodo
);

router.put(
    '/:id',
    validateParams(todoValidation.param),
    validateBody(todoValidation.update),
    todoController.updateTodo
);

router.patch(
    '/:id/toggle',
    validateParams(todoValidation.param),
    todoController.toggleTodo
);

router.delete(
    '/:id',
    validateParams(todoValidation.param),
    todoController.deleteTodo
);

export default router;