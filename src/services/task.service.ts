import Task from '@models/task.model';
import {
    ITaskDoc,
    CreateTaskBody,
    UpdateTaskBody,
    IComment,
    CreateCommentBody,
    TaskListResponseDTO,
    TaskAssigneeDTO,
    TaskProcessDTO,
    taskStatus
} from '@interfaces/task.interface'
import { UserRole } from '@interfaces/user.interface';
import Clinic from '@models/clinic.model';
import User from '@models/user.model';
import { CreateTaskDTO, UpdateTaskDTO, ListTaskQueryDTO, CreateCommentDTO, UpdateProcessDTO } from '@validations/task.validation';
import {
    NotFoundException,
    BadRequestException,
    ConflictException,
    ForbiddenException
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import mongoose, { FilterQuery, Types } from 'mongoose';

const isAdminOrManager = (role: UserRole): boolean => {
    return role === 'admin' || role === 'manager';
};

// Status priority for calculating task status (lower = earlier in workflow)
const STATUS_PRIORITY: Record<taskStatus, number> = {
    'pending': 0,
    'process': 1,
    'review': 2,
    'done': 3,
    'delete': 4,
};

// Calculate task status based on all process statuses
const calculateTaskStatus = (processStatuses: taskStatus[]): taskStatus => {
    // Filter out 'delete' status for calculation
    const activeStatuses = processStatuses.filter(s => s !== 'delete');

    if (activeStatuses.length === 0) {
        return 'pending';
    }

    // Check if all statuses are the same
    const allSame = activeStatuses.every(s => s === activeStatuses[0]);

    if (allSame) {
        // If all processes have same status, task gets that status
        return activeStatuses[0];
    }

    // If different, get the minimum (earliest in workflow)
    let minStatus = activeStatuses[0];
    let minPriority = STATUS_PRIORITY[minStatus];

    for (const status of activeStatuses) {
        if (STATUS_PRIORITY[status] < minPriority) {
            minPriority = STATUS_PRIORITY[status];
            minStatus = status;
        }
    }

    return minStatus;
};

export class TaskService {

    async createTask(data: CreateTaskDTO, createdBy: string): Promise<ITaskDoc> {

        const clinic = await Clinic.findById(data.clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        const existingTask = await Task.isTaskExist(data.name, data.clinicId);
        if (existingTask) {
            throw new ConflictException('Task already exists in this clinic');
        }

        for (const proc of data.process) {
            const assignees = await User.find({ _id: { $in: proc.assignee } });
            if (assignees.length !== proc.assignee.length) {
                throw new ConflictException('Some assignees do not exist');
            }
        }

        const taskInput: CreateTaskBody = {
            ...data,
            clinicId: new mongoose.Types.ObjectId(data.clinicId),
            process: data.process.map(p => ({
                ...p,
                assignee: p.assignee.map(id => new mongoose.Types.ObjectId(id)),
                comments: []
            })),
            createdBy: new mongoose.Types.ObjectId(createdBy),
        };

        const task = await Task.create(taskInput);
        logger.info(`Task created: ${task.name} for clinic ${data.clinicId} by ${createdBy}`);
        return task.populate('clinicId');
    }

    async getTaskById(id: string): Promise<ITaskDoc> {
        const task = await Task.findById(id)
            .populate('clinicId', 'name clinicLevel')
            .populate('process.assignee', 'firstname lastname nickname username')
            .populate('process.comments.user', 'firstname lastname');
        if (!task) {
            throw new NotFoundException('Task not found');
        }
        return task;
    }

    async listTasks(
        query: ListTaskQueryDTO,
        currentUserId: string,
        userRole: UserRole
    ): Promise<{ tasks: TaskListResponseDTO[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }> {
        const { search, status, priority, clinicId, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        // Build filter based on user role
        let filter: FilterQuery<ITaskDoc> = {};

        // Employee can only see tasks they created or are assigned to
        if (!isAdminOrManager(userRole)) {
            filter.$or = [
                { createdBy: new mongoose.Types.ObjectId(currentUserId) },
                { 'process.assignee': new mongoose.Types.ObjectId(currentUserId) },
            ];
        }

        // Apply additional filters
        if (clinicId) filter.clinicId = new mongoose.Types.ObjectId(clinicId);
        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        if (search) {
            const searchFilter = {
                $or: [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                ],
            };
            if (filter.$or) {
                filter = { $and: [{ $or: filter.$or }, searchFilter] };
            } else {
                filter = { ...filter, ...searchFilter };
            }
        }

        const [tasks, total] = await Promise.all([
            Task.find(filter)
                .sort({ dueDate: 1 })
                .skip(skip)
                .limit(limit)
                .populate('clinicId', 'name')
                .populate('process.assignee', '_id firstname lastname nickname username')
                .populate('createdBy', 'firstname lastname username')
                // .lean(),
                .exec() as Promise<ITaskDoc[]>,
            Task.countDocuments(filter),
        ]);

        // Transform tasks to DTO format
        const transformedTasks: TaskListResponseDTO[] = tasks.map(task => {
            let totalComments = 0;
            let totalAttachments = task.attachments?.length || 0;

            // Transform process array
            const processArray: TaskProcessDTO[] = (task.process || []).map((proc: any) => {
                totalAttachments += proc.attachments?.length || 0;
                totalComments += proc.comments?.length || 0;

                // Transform assignees in this process
                const assignees: TaskAssigneeDTO[] = (proc.assignee || [])
                    .filter((assignee: any) => assignee && typeof assignee === 'object')
                    .map((assignee: any) => ({
                        id: assignee._id?.toString() || '',
                        firstname: assignee.firstname || '',
                        lastname: assignee.lastname || '',
                        nickname: assignee.nickname || '',
                    }));

                return {
                    id: proc._id?.toString() || '',
                    name: proc.name || '',
                    status: proc.status || 'pending',
                    assignee: assignees,
                };
            });

            // Extract clinic info
            const clinicData = task.clinicId as any;
            const clinic = {
                id: clinicData?._id?.toString() || '',
                name: {
                    en: typeof clinicData?.name === 'object' ? clinicData.name.en || '' : clinicData?.name || '',
                    th: typeof clinicData?.name === 'object' ? clinicData.name.th || '' : '',
                }
            };

            // Extract creator info
            const creator = task.createdBy as any;
            const createdByName = creator?.firstname && creator?.lastname
                ? `${creator.firstname} ${creator.lastname}`
                : creator?.username || '';

            return {
                id: task._id.toString(),
                name: task.name,
                description: task.description,
                priority: task.priority,
                status: task.status,
                dueDate: task.dueDate?.toISOString() || '',
                tag: task.tag || [],
                clinic,
                process: processArray,
                commentAmount: totalComments,
                attachmentsAmount: totalAttachments,
                createdAt: task.createdAt?.toISOString() || '',
                createdBy: createdByName,
            };
        });

        return {
            tasks: transformedTasks,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async updateTask(id: string, data: UpdateTaskDTO, userId: string): Promise<ITaskDoc> {
        const taskObjId = new mongoose.Types.ObjectId(id);
        const userObjId = new mongoose.Types.ObjectId(userId);

        const existingTask = await Task.findById(taskObjId)
            .populate('clinicId', 'name clinicLevel')
            .populate('process.assignee', 'firstname lastname username')
            .populate('process.comments.user', 'firstname lastname');
        if (!existingTask) {
            throw new NotFoundException('Task not found');
        }

        if (existingTask.createdBy.toString() !== userId) {
            throw new ForbiddenException('Only the creator can update this task');
        }

        if (existingTask.status === 'done' || existingTask.status === 'review') {
            throw new BadRequestException('Cannot update tasks with status "done" or "review"');
        }

        const { clinicId, process, ...restData } = data;
        const updateData: Partial<UpdateTaskBody> = { ...restData };

        if (clinicId) {
            updateData.clinicId = new mongoose.Types.ObjectId(clinicId);
        }

        if (process && Array.isArray(process)) {
            const newProcessArray: any[] = existingTask.process.map((existingP: any) => ({
                ...existingP.toObject(),
                _id: existingP._id,
            }));

            process.forEach((newP: any, index: number) => {
                if (index < newProcessArray.length) {
                    const existingP = newProcessArray[index];
                    newProcessArray[index] = {
                        _id: existingP._id,
                        name: newP.name !== undefined ? newP.name : existingP.name,
                        assignee: newP.assignee ? newP.assignee.map((id: string) => new mongoose.Types.ObjectId(id)) : existingP.assignee,
                        status: newP.status !== undefined ? newP.status : existingP.status,
                        attachments: newP.attachments !== undefined ? newP.attachments : existingP.attachments,
                        comments: existingP.comments,
                    };
                } else {
                    newProcessArray.push({
                        name: newP.name,
                        assignee: newP.assignee ? newP.assignee.map((id: string) => new mongoose.Types.ObjectId(id)) : [],
                        status: newP.status || 'pending',
                        attachments: newP.attachments || [],
                        comments: [],
                    });
                }
            });

            updateData.process = newProcessArray;
        }

        updateData.updatedBy = userObjId;

        const updatedTask = await Task.findByIdAndUpdate(
            taskObjId,
            { $set: updateData },
            { new: true, runValidators: true }
        )
            .populate('clinicId', 'name clinicLevel')
            .populate('process.assignee', 'firstname lastname username')
            .populate('process.comments.user', 'firstname lastname');

        if (!updatedTask) {
            throw new BadRequestException('Failed to update task');
        }

        logger.info(`Task updated: ${updatedTask.name} by ${userId}`);
        return updatedTask;
    }

    /**
     * Update a specific process within a task
     * - Only assignee of the process can update
     * - Auto-calculates task status based on all process statuses
     */
    async updateProcess(
        taskId: string,
        processId: string,
        data: UpdateProcessDTO,
        userId: string
    ): Promise<ITaskDoc> {
        const taskObjId = new mongoose.Types.ObjectId(taskId);
        const processObjId = new mongoose.Types.ObjectId(processId);
        const userObjId = new mongoose.Types.ObjectId(userId);

        // Find task and specific process
        const task = await Task.findById(taskObjId);
        if (!task) {
            throw new NotFoundException('Task not found');
        }

        // Find the process
        const processIndex = task.process.findIndex(
            (p: any) => p._id.toString() === processId
        );

        if (processIndex === -1) {
            throw new NotFoundException('Process not found');
        }

        const targetProcess = task.process[processIndex];

        // Check if user is assigned to this process
        const isAssignee = targetProcess.assignee.some(
            (assigneeId: any) => assigneeId.toString() === userId
        );

        if (!isAssignee) {
            throw new ForbiddenException('Only assigned users can update this process');
        }

        // Update process fields
        if (data.status !== undefined) {
            targetProcess.status = data.status;
        }
        if (data.attachments !== undefined) {
            targetProcess.attachments = data.attachments;
        }

        // Calculate new task status based on all process statuses
        const processStatuses = task.process.map((p: any) => p.status as taskStatus);
        const newTaskStatus = calculateTaskStatus(processStatuses);

        // Update task status and updatedBy
        task.status = newTaskStatus;
        task.updatedBy = userObjId;

        await task.save();

        // Return populated task
        const updatedTask = await Task.findById(taskObjId)
            .populate('clinicId', 'name clinicLevel')
            .populate('process.assignee', 'firstname lastname nickname username')
            .populate('process.comments.user', 'firstname lastname');

        logger.info(`Process ${processId} updated in task ${taskId} by ${userId}. Task status: ${newTaskStatus}`);
        return updatedTask!;
    }

    async deleteTask(id: string, deletedBy: string): Promise<boolean> {
        const task = await Task.findById(id);
        if (!task) {
            throw new NotFoundException('Task not found');
        }

        if (task.createdBy.toString() !== deletedBy) {
            throw new ForbiddenException('Not authorized to delete this task');
        }

        task.status = 'delete';
        task.updatedBy = new mongoose.Types.ObjectId(deletedBy);
        await task.save();

        logger.info(`Task soft-deleted: ${task.name} by ${deletedBy}`);
        return true;
    }

    async createComment(taskId: string, processId: string, data: CreateCommentDTO, userId: string): Promise<IComment> {
        const taskObjId = new mongoose.Types.ObjectId(taskId);
        const processObjId = new mongoose.Types.ObjectId(processId);
        const userObjId = new mongoose.Types.ObjectId(userId);

        const newComment: CreateCommentBody = {
            text: data.text,
            user: userObjId,
        };

        const result = await Task.updateOne(
            {
                _id: taskObjId,
                'process._id': processObjId,
            },
            {
                $push: {
                    'process.$.comments': {
                        ...newComment
                    }
                }
            }
        );

        if (result.modifiedCount === 0) {
            throw new NotFoundException('Task or Process not found');
        }

        const savedComment: IComment = {
            ...newComment
        };

        logger.info(`Comment added to process ${processId} in task ${taskId} by ${userId}`);
        return savedComment;
    }
}

export default TaskService;