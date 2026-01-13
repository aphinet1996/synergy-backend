import { Request, Response, NextFunction } from 'express';
import TodoService from '@services/todo.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { validateObjectId } from '@/middlewares/validation.middleware';
import { asyncHandler } from '@middlewares/error.middleware';

// Extend AuthRequest
interface TodoRequest extends AuthRequest {
    params: { id: string };
}

const todoService = new TodoService();

export class TodoController {
    public getTodos = [
        asyncHandler(async (req: TodoRequest, res: Response) => {
            const { todos, pagination } = await todoService.listTodos(
                req.query as any,
                req.userId!,
                req.role!
            );
            res.status(200).json({
                status: 'success',
                results: todos.length,
                pagination,
                data: { todos },
            });
        }),
    ];

    public getTeamTodos = [
        asyncHandler(async (req: TodoRequest, res: Response) => {
            const { todos, pagination } = await todoService.listTeamTodos(
                req.query as any,
                req.userId!,
                req.role!
            );
            res.status(200).json({
                status: 'success',
                results: todos.length,
                pagination,
                data: { todos },
            });
        }),
    ];

    public getTodo = [
        validateObjectId('id'),
        asyncHandler(async (req: TodoRequest, res: Response) => {
            const todo = await todoService.getTodoById(req.params.id);
            res.status(200).json({
                status: 'success',
                data: { todo },
            });
        }),
    ];

    public createTodo = [
        asyncHandler(async (req: TodoRequest, res: Response) => {
            const todo = await todoService.createTodo(req.body, req.userId!);
            res.status(201).json({
                status: 'success',
                message: 'Todo created successfully',
                // data: { todo },
                data: {
                    id: todo._id,
                    name: todo.name
                }
            });
        }),
    ];

    public updateTodo = [
        validateObjectId('id'),
        asyncHandler(async (req: TodoRequest, res: Response) => {
            const todo = await todoService.updateTodo(
                req.params.id,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Todo updated successfully',
                // data: { todo },
                data: {
                    id: todo._id,
                    name: todo.name
                }
            });
        }),
    ];

    public toggleTodo = [
        validateObjectId('id'),
        asyncHandler(async (req: TodoRequest, res: Response) => {
            const todo = await todoService.toggleTodoStatus(
                req.params.id,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Todo status toggled successfully',
                data: { todo },
            });
        }),
    ];

    public deleteTodo = [
        validateObjectId('id'),
        asyncHandler(async (req: TodoRequest, res: Response) => {
            await todoService.deleteTodo(req.params.id, req.userId!);
            res.status(204).json({
                status: 'success',
                message: 'Todo deleted successfully',
            });
        }),
    ];

    public getTodayStats = [
        asyncHandler(async (req: TodoRequest, res: Response) => {
            const stats = await todoService.getTodayStats(req.userId!);
            res.status(200).json({
                status: 'success',
                data: { stats },
            });
        }),
    ];
}

export default new TodoController();