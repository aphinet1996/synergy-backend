import Todo from '@models/todo.model';
import {
    ITodoDoc,
    CreateTodoBody,
    UpdateTodoBody,
    TodoListResponseDTO,
} from '@interfaces/todo.interface';
import { UserRole } from '@interfaces/user.interface';
import Clinic from '@models/clinic.model';
import { CreateTodoDTO, UpdateTodoDTO, ListTodoQueryDTO, TeamTodoQueryDTO } from '@validations/todo.validation';
import {
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import mongoose, { FilterQuery } from 'mongoose';

const isAdminOrManager = (role: UserRole): boolean => {
    return role === 'admin' || role === 'manager';
};

export class TodoService {

    async createTodo(data: CreateTodoDTO, createdBy: string): Promise<ITodoDoc> {
        const clinic = await Clinic.findById(data.clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        const todoInput: CreateTodoBody = {
            name: data.name,
            description: data.description,
            clinicId: new mongoose.Types.ObjectId(data.clinicId),
            priority: data.priority,
            createdBy: new mongoose.Types.ObjectId(createdBy),
        };

        const todo = await Todo.create(todoInput);
        logger.info(`Todo created: ${todo.name} for clinic ${data.clinicId} by ${createdBy}`);
        return todo.populate('clinicId');
    }

    async getTodoById(id: string): Promise<ITodoDoc> {
        const todo = await Todo.findById(id)
            .populate('clinicId', 'name clinicLevel')
            .populate('createdBy', 'firstname lastname nickname')
            .populate('updatedBy', 'firstname lastname nickname');
        if (!todo) {
            throw new NotFoundException('Todo not found');
        }
        return todo;
    }

    async listTodos(
        query: ListTodoQueryDTO,
        currentUserId: string,
        userRole: UserRole
    ): Promise<{ todos: TodoListResponseDTO[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }> {
        const { status, priority, clinicId, startDate, endDate, page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;

        // Build filter - user can only see their own todos
        let filter: FilterQuery<ITodoDoc> = {
            createdBy: new mongoose.Types.ObjectId(currentUserId),
        };

        // Apply additional filters
        if (clinicId) filter.clinicId = new mongoose.Types.ObjectId(clinicId);
        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        // Filter by date range
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = startDate;
            if (endDate) filter.createdAt.$lte = endDate;
        }

        const [todos, total] = await Promise.all([
            Todo.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('clinicId', 'name')
                .populate('createdBy', 'firstname lastname nickname')
                .populate('updatedBy', 'firstname lastname nickname'),
            Todo.countDocuments(filter),
        ]);

        // Transform todos to DTO format
        const transformedTodos: TodoListResponseDTO[] = todos.map(todo => {
            // Extract clinic info
            const clinicData = todo.clinicId as any;
            const clinic = {
                id: clinicData?._id?.toString() || '',
                name: {
                    en: typeof clinicData?.name === 'object' ? clinicData.name.en || '' : clinicData?.name || '',
                    th: typeof clinicData?.name === 'object' ? clinicData.name.th || '' : '',
                }
            };

            // Extract creator info
            const creator = todo.createdBy as any;
            const createdByName = creator?.firstname && creator?.lastname
                ? `${creator.firstname} ${creator.lastname}`
                : '';

            // Extract updater info
            const updater = todo.updatedBy as any;
            const updatedByName = updater?.firstname && updater?.lastname
                ? `${updater.firstname} ${updater.lastname}`
                : undefined;

            return {
                id: todo._id.toString(),
                name: todo.name,
                description: todo.description,
                priority: todo.priority,
                status: todo.status,
                clinic,
                createdAt: todo.createdAt?.toISOString() || '',
                updatedAt: todo.updatedAt?.toISOString(),
                createdBy: createdByName,
                updatedBy: updatedByName,
            };
        });

        return {
            todos: transformedTodos,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async listTeamTodos(
        query: TeamTodoQueryDTO,
        currentUserId: string,
        userRole: UserRole
    ): Promise<{ todos: TodoListResponseDTO[]; pagination: { page: number; limit: number; total: number; totalPages: number }; }> {
        // Only admin/manager can see team todos
        if (!isAdminOrManager(userRole)) {
            throw new ForbiddenException('Only admin or manager can view team todos');
        }

        const { status, priority, clinicId, userId, date, page = 1, limit = 50 } = query;
        const skip = (page - 1) * limit;

        let filter: FilterQuery<ITodoDoc> = {};

        if (clinicId) filter.clinicId = new mongoose.Types.ObjectId(clinicId);
        if (userId) filter.createdBy = new mongoose.Types.ObjectId(userId);
        if (status) filter.status = status;
        if (priority) filter.priority = priority;

        // Filter by specific date
        if (date) {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            filter.createdAt = { $gte: startOfDay, $lte: endOfDay };
        }

        const [todos, total] = await Promise.all([
            Todo.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('clinicId', 'name')
                .populate('createdBy', 'firstname lastname nickname')
                .populate('updatedBy', 'firstname lastname nickname'),
            Todo.countDocuments(filter),
        ]);

        // Transform todos to DTO format
        const transformedTodos: TodoListResponseDTO[] = todos.map(todo => {
            const clinicData = todo.clinicId as any;
            const clinic = {
                id: clinicData?._id?.toString() || '',
                name: {
                    en: typeof clinicData?.name === 'object' ? clinicData.name.en || '' : clinicData?.name || '',
                    th: typeof clinicData?.name === 'object' ? clinicData.name.th || '' : '',
                }
            };

            const creator = todo.createdBy as any;
            const createdByName = creator?.firstname && creator?.lastname
                ? `${creator.firstname} ${creator.lastname}`
                : '';

            const updater = todo.updatedBy as any;
            const updatedByName = updater?.firstname && updater?.lastname
                ? `${updater.firstname} ${updater.lastname}`
                : undefined;

            return {
                id: todo._id.toString(),
                name: todo.name,
                description: todo.description,
                priority: todo.priority,
                status: todo.status,
                clinic,
                createdAt: todo.createdAt?.toISOString() || '',
                updatedAt: todo.updatedAt?.toISOString(),
                createdBy: createdByName,
                updatedBy: updatedByName,
            };
        });

        return {
            todos: transformedTodos,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async updateTodo(id: string, data: UpdateTodoDTO, userId: string): Promise<ITodoDoc> {
        const todoObjId = new mongoose.Types.ObjectId(id);
        const userObjId = new mongoose.Types.ObjectId(userId);

        const existingTodo = await Todo.findById(todoObjId)
            .populate('clinicId', 'name clinicLevel')
            .populate('createdBy', 'firstname lastname nickname')
            .populate('updatedBy', 'firstname lastname nickname');

        if (!existingTodo) {
            throw new NotFoundException('Todo not found');
        }

        if (existingTodo.createdBy._id.toString() !== userId) {
            throw new ForbiddenException('Only the creator can update this todo');
        }

        const { clinicId, ...restData } = data;
        const updateData: Partial<UpdateTodoBody> = { ...restData };

        if (clinicId) {
            updateData.clinicId = new mongoose.Types.ObjectId(clinicId);
        }

        updateData.updatedBy = userObjId;

        const updatedTodo = await Todo.findByIdAndUpdate(
            todoObjId,
            { $set: updateData },
            { new: true, runValidators: true }
        )
            .populate('clinicId', 'name clinicLevel')
            .populate('createdBy', 'firstname lastname nickname')
            .populate('updatedBy', 'firstname lastname nickname');

        if (!updatedTodo) {
            throw new BadRequestException('Failed to update todo');
        }

        logger.info(`Todo updated: ${updatedTodo.name} by ${userId}`);
        return updatedTodo;
    }

    async toggleTodoStatus(id: string, userId: string): Promise<ITodoDoc> {
        const todoObjId = new mongoose.Types.ObjectId(id);
        const userObjId = new mongoose.Types.ObjectId(userId);

        const todo = await Todo.findById(todoObjId);
        if (!todo) {
            throw new NotFoundException('Todo not found');
        }

        if (todo.createdBy.toString() !== userId) {
            throw new ForbiddenException('Only the creator can toggle this todo');
        }

        todo.status = todo.status === 'pending' ? 'done' : 'pending';
        todo.updatedBy = userObjId;
        await todo.save();

        const updatedTodo = await Todo.findById(todoObjId)
            .populate('clinicId', 'name clinicLevel')
            .populate('createdBy', 'firstname lastname nickname')
            .populate('updatedBy', 'firstname lastname nickname');

        logger.info(`Todo toggled: ${todo.name} to ${todo.status} by ${userId}`);
        return updatedTodo!;
    }

    async deleteTodo(id: string, deletedBy: string): Promise<boolean> {
        const todo = await Todo.findById(id);
        if (!todo) {
            throw new NotFoundException('Todo not found');
        }

        if (todo.createdBy.toString() !== deletedBy) {
            throw new ForbiddenException('Not authorized to delete this todo');
        }

        await Todo.findByIdAndDelete(id);
        logger.info(`Todo deleted: ${todo.name} by ${deletedBy}`);
        return true;
    }

    async getTodayStats(userId: string): Promise<{ total: number; completed: number; pending: number }> {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const [total, completed] = await Promise.all([
            Todo.countDocuments({
                createdBy: new mongoose.Types.ObjectId(userId),
                createdAt: { $gte: startOfDay, $lte: endOfDay },
            }),
            Todo.countDocuments({
                createdBy: new mongoose.Types.ObjectId(userId),
                createdAt: { $gte: startOfDay, $lte: endOfDay },
                status: 'done',
            }),
        ]);

        return { total, completed, pending: total - completed };
    }
}

export default TodoService;