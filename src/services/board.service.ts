import Board from '@models/board.model';
import Clinic from '@models/clinic.model';
import User from '@models/user.model';
import { IBoardDoc, CreateBoardBody, UpdateBoardBody } from '@interfaces/board.interface';
import { CreateBoardDTO, UpdateBoardDTO, UpdateBoardElementsDTO } from '@validations/board.validation';
import {
    NotFoundException,
    ForbiddenException,
    ConflictException,
} from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';
import mongoose from 'mongoose';

interface BoardElement {
    id: string;
    version: number;
    isDeleted?: boolean;
    [key: string]: any;
}

// Helper function สำหรับ merge elements
const mergeElements = (existingElements: any[], newElements: any[]): any[] => {
    const elementMap = new Map<string, any>();

    // Add all existing elements
    for (const el of existingElements || []) {
        elementMap.set(el.id, el);
    }

    // Merge new elements (keep newer version)
    for (const el of newElements || []) {
        const existing = elementMap.get(el.id);
        if (!existing || el.version > existing.version) {
            elementMap.set(el.id, el);
        }
    }

    // Filter out deleted elements
    return Array.from(elementMap.values()).filter(el => !el.isDeleted);
};


export class BoardService {

    // ==================== getBoardsByClinic ====================
    async getBoardsByClinic(clinicId: string, userId: string) {
        this.validateObjectId(clinicId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to view this clinic');
        }

        // ✅ เพิ่ม createdAt updatedAt ใน select และใช้ .lean()
        const boards = await Board.find({ clinicId })
            .select('clinicId procedureId name description members createdBy updatedBy createdAt updatedAt')
            .populate('procedureId', 'name')
            .populate('members', 'firstname lastname nickname')
            .populate('createdBy', 'firstname lastname nickname')
            .sort({ createdAt: -1 })
            .lean();  // ✅ เพิ่ม .lean() เพื่อให้ได้ plain object รวม timestamps

        // ✅ Transform _id to id for consistency
        const transformedBoards = boards.map(board => ({
            ...board,
            id: board._id?.toString(),
            procedureId: board.procedureId ? {
                ...board.procedureId,
                id: (board.procedureId as any)._id?.toString(),
            } : board.procedureId,
            createdBy: board.createdBy ? {
                ...board.createdBy,
                id: (board.createdBy as any)._id?.toString(),
            } : board.createdBy,
            members: (board.members || []).map((m: any) => ({
                ...m,
                id: m._id?.toString(),
            })),
        }));

        // Group by procedureId
        const grouped = transformedBoards.reduce((acc, board) => {
            const procId = (board.procedureId as any)?.id || (board.procedureId as any)?._id?.toString();
            if (!acc[procId]) {
                acc[procId] = {
                    procedure: board.procedureId,
                    boards: [],
                };
            }
            acc[procId].boards.push(board);
            return acc;
        }, {} as Record<string, { procedure: any; boards: any[] }>);

        return Object.values(grouped);
    }

    // ==================== getBoardsByProcedure ====================
    async getBoardsByProcedure(clinicId: string, procedureId: string, userId: string) {
        this.validateObjectId(clinicId);
        this.validateObjectId(procedureId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to view this clinic');
        }

        if (!clinic.procedures.some(id => id.toString() === procedureId)) {
            throw new NotFoundException('Procedure not found in this clinic');
        }

        // ✅ ใช้ .lean()
        const boards = await Board.find({ clinicId, procedureId })
            .select('clinicId procedureId name description members createdBy updatedBy createdAt updatedAt')
            .populate('procedureId', 'name')
            .populate('members', 'firstname lastname nickname')
            .populate('createdBy', 'firstname lastname nickname')
            .sort({ createdAt: -1 })
            .lean();

        // ✅ Transform _id to id
        return boards.map(board => ({
            ...board,
            id: board._id?.toString(),
            procedureId: board.procedureId ? {
                ...board.procedureId,
                id: (board.procedureId as any)._id?.toString(),
            } : board.procedureId,
            createdBy: board.createdBy ? {
                ...board.createdBy,
                id: (board.createdBy as any)._id?.toString(),
            } : board.createdBy,
            members: (board.members || []).map((m: any) => ({
                ...m,
                id: m._id?.toString(),
            })),
        }));
    }

    /**
     * Get single board with full Excalidraw data
     */
    async getBoard(clinicId: string, boardId: string, userId: string) {
        this.validateObjectId(clinicId);
        this.validateObjectId(boardId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to view this clinic');
        }

        const board = await Board.findOne({ _id: boardId, clinicId })
            .populate('procedureId', 'name')
            .populate('members', 'firstname lastname nickname')
            .populate('createdBy', 'firstname lastname nickname')
            .populate('updatedBy', 'firstname lastname nickname');

        if (!board) {
            throw new NotFoundException('Board not found');
        }

        return board;
    }

    /**
     * Create a new board
     */
    async createBoard(clinicId: string, data: CreateBoardDTO, createdBy: string) {
        this.validateObjectId(clinicId);
        this.validateObjectId(data.procedureId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(id => id.toString() === createdBy)) {
            throw new ForbiddenException('Not authorized to modify this clinic');
        }

        // Check if procedure belongs to clinic
        if (!clinic.procedures.some(id => id.toString() === data.procedureId)) {
            throw new NotFoundException('Procedure not found in this clinic');
        }

        // Validate members exist
        if (data.members && data.members.length > 0) {
            const existingUsers = await User.find({ _id: { $in: data.members } });
            if (existingUsers.length !== data.members.length) {
                throw new ConflictException('Some members do not exist');
            }
        }

        // Add creator to members if not included
        const members = data.members || [];
        if (!members.includes(createdBy)) {
            members.push(createdBy);
        }

        const boardInput: CreateBoardBody = {
            clinicId: new mongoose.Types.ObjectId(clinicId),
            procedureId: new mongoose.Types.ObjectId(data.procedureId),
            name: data.name,
            description: data.description,
            elements: [],
            members: members.map(id => new mongoose.Types.ObjectId(id)),
            createdBy: new mongoose.Types.ObjectId(createdBy),
        };

        const board = await Board.create(boardInput);

        // Populate for response
        await board.populate([
            { path: 'procedureId', select: 'name' },
            { path: 'members', select: 'firstname lastname nickname' },
            { path: 'createdBy', select: 'firstname lastname nickname' },
        ]);

        logger.info(`Board created: ${board.name} for clinic ${clinicId} by ${createdBy}`);
        return board;
    }

    /**
     * Update board info (name, description, members)
     */
    async updateBoard(
        clinicId: string,
        boardId: string,
        data: UpdateBoardDTO,
        userId: string
    ) {
        this.validateObjectId(clinicId);
        this.validateObjectId(boardId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to modify this clinic');
        }

        const board = await Board.findOne({ _id: boardId, clinicId });
        if (!board) {
            throw new NotFoundException('Board not found');
        }

        // Validate new members exist
        if (data.members && data.members.length > 0) {
            const existingUsers = await User.find({ _id: { $in: data.members } });
            if (existingUsers.length !== data.members.length) {
                throw new ConflictException('Some members do not exist');
            }
        }

        const updateData: UpdateBoardBody = {
            ...data,
            members: data.members?.map(id => new mongoose.Types.ObjectId(id)),
            updatedBy: new mongoose.Types.ObjectId(userId),
        };

        const updatedBoard = await Board.findByIdAndUpdate(
            boardId,
            updateData,
            { new: true, runValidators: true }
        ).populate([
            { path: 'procedureId', select: 'name' },
            { path: 'members', select: 'firstname lastname nickname' },
            { path: 'createdBy', select: 'firstname lastname nickname' },
            { path: 'updatedBy', select: 'firstname lastname nickname' },
        ]);

        if (!updatedBoard) {
            throw new NotFoundException('Board update failed');
        }

        logger.info(`Board updated: ${updatedBoard.name} by ${userId}`);
        return updatedBoard;
    }

    /**
     * Update board elements (save Excalidraw data)
     * ✅ แก้ไขให้ merge elements แทน overwrite
     */
    async updateBoardElements(
        clinicId: string,
        boardId: string,
        data: UpdateBoardElementsDTO,
        userId: string
    ) {
        this.validateObjectId(clinicId);
        this.validateObjectId(boardId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned or is board member
        const board = await Board.findOne({ _id: boardId, clinicId });
        if (!board) {
            throw new NotFoundException('Board not found');
        }

        const isClinicMember = clinic.assignedTo.some(id => id.toString() === userId);
        const isBoardMember = board.members.some(id => id.toString() === userId);

        if (!isClinicMember && !isBoardMember) {
            throw new ForbiddenException('Not authorized to modify this board');
        }

        // ✅ ป้องกันการ save ข้อมูลว่างทับข้อมูลที่มีอยู่
        const incomingElements = data.elements || [];
        const existingElements = board.elements || [];
        
        if (incomingElements.length === 0 && existingElements.length > 0) {
            logger.warn(`Skipping save: would overwrite ${existingElements.length} elements with empty data`);
            // Return existing board without changes
            return board.populate([
                { path: 'procedureId', select: 'name' },
                { path: 'members', select: 'firstname lastname nickname' },
                { path: 'updatedBy', select: 'firstname lastname nickname' },
            ]);
        }

        // ✅ Merge elements แทนการ overwrite
        const mergedElements = mergeElements(existingElements, incomingElements);
        
        // ✅ Merge files
        const mergedFiles = {
            ...(board.files || {}),
            ...(data.files || {}),
        };

        // ✅ Merge appState
        const mergedAppState = {
            ...(board.appState || {}),
            ...(data.appState || {}),
        };

        const updatedBoard = await Board.findByIdAndUpdate(
            boardId,
            {
                elements: mergedElements,
                appState: mergedAppState,
                files: mergedFiles,
                updatedBy: new mongoose.Types.ObjectId(userId),
            },
            { new: true, runValidators: true }
        ).populate([
            { path: 'procedureId', select: 'name' },
            { path: 'members', select: 'firstname lastname nickname' },
            { path: 'updatedBy', select: 'firstname lastname nickname' },
        ]);

        if (!updatedBoard) {
            throw new NotFoundException('Board update failed');
        }

        logger.info(`Board elements saved: ${updatedBoard.name} by ${userId} (${mergedElements.length} elements)`);
        return updatedBoard;
    }

    /**
     * Delete board
     */
    async deleteBoard(clinicId: string, boardId: string, userId: string): Promise<boolean> {
        this.validateObjectId(clinicId);
        this.validateObjectId(boardId);

        const clinic = await Clinic.findById(clinicId);
        if (!clinic) {
            throw new NotFoundException('Clinic not found');
        }

        // Check if user is assigned
        if (!clinic.assignedTo.some(id => id.toString() === userId)) {
            throw new ForbiddenException('Not authorized to modify this clinic');
        }

        const board = await Board.findOne({ _id: boardId, clinicId });
        if (!board) {
            throw new NotFoundException('Board not found');
        }

        await Board.findByIdAndDelete(boardId);
        logger.info(`Board deleted: ${board.name} by ${userId}`);
        return true;
    }

    /**
     * Delete all boards for a clinic
     */
    async deleteBoardsByClinic(clinicId: string): Promise<number> {
        const result = await Board.deleteMany({ clinicId });
        logger.info(`Deleted ${result.deletedCount} boards for clinic ${clinicId}`);
        return result.deletedCount;
    }

    /**
     * Delete all boards for a procedure (when procedure removed from clinic)
     */
    async deleteBoardsByProcedure(clinicId: string, procedureId: string): Promise<number> {
        const result = await Board.deleteMany({ clinicId, procedureId });
        logger.info(`Deleted ${result.deletedCount} boards for procedure ${procedureId}`);
        return result.deletedCount;
    }

    // Private helpers
    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new NotFoundException('Invalid ID');
        }
    }
}

export default BoardService;