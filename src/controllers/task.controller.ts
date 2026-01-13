import { Request, Response, NextFunction } from 'express';
import TaskService from '@services/task.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { validateObjectId } from '@/middlewares/validation.middleware';
import { asyncHandler } from '@middlewares/error.middleware';

// Extend AuthRequest
interface TaskRequest extends AuthRequest {
    params: { id: string; taskId?: string; processId?: string };
}

const taskService = new TaskService();

export class TaskController {
    public getTasks = [
        asyncHandler(async (req: TaskRequest, res: Response) => {
            const { tasks, pagination } = await taskService.listTasks(
                req.query as any,
                req.userId!,
                req.role!
            );
            res.status(200).json({
                status: 'success',
                results: tasks.length,
                pagination,
                data: { tasks },
            });
        }),
    ];

    public getTask = [
        validateObjectId('id'),
        asyncHandler(async (req: TaskRequest, res: Response) => {
            const task = await taskService.getTaskById(req.params.id);
            res.status(200).json({
                status: 'success',
                data: { task },
            });
        }),
    ];

    public createTask = [
        asyncHandler(async (req: TaskRequest, res: Response) => {
            const task = await taskService.createTask(req.body, req.userId!);
            res.status(201).json({
                status: 'success',
                message: 'Task created successfully',
                data: { task },
            });
        }),
    ];

    public updateTask = [
        validateObjectId('id'),
        asyncHandler(async (req: TaskRequest, res: Response) => {
            const task = await taskService.updateTask(
                req.params.id,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Task updated successfully',
                data: { task },
            });
        }),
    ];

    public updateProcess = [
        asyncHandler(async (req: TaskRequest, res: Response) => {
            const { taskId, processId } = req.params;
            const task = await taskService.updateProcess(
                taskId!,
                processId!,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Process updated successfully',
                data: { task },
            });
        }),
    ];

    public deleteTask = [
        validateObjectId('id'),
        asyncHandler(async (req: TaskRequest, res: Response) => {
            await taskService.deleteTask(req.params.id, req.userId!);
            res.status(204).json({
                status: 'success',
                message: 'Task deleted successfully',
            });
        }),
    ];

    public addComment = [
        asyncHandler(async (req: TaskRequest, res: Response) => {
            const { taskId, processId } = req.params;
            const task = await taskService.createComment(taskId!, processId!, req.body, req.userId!);
            res.status(201).json({
                status: 'success',
                message: 'Comment added successfully',
                data: { task },
            });
        }),
    ];
}

export default new TaskController();