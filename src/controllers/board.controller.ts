import { Response } from 'express';
import BoardService from '@services/board.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@middlewares/error.middleware';

interface ClinicBoardRequest extends AuthRequest {
    params: { id: string };
}

interface ProcedureBoardsRequest extends AuthRequest {
    params: { id: string; procedureId: string };
}

interface BoardRequest extends AuthRequest {
    params: { id: string; boardId: string };
}

const boardService = new BoardService();

export class BoardController {

    /**
     * GET /clinic/:id/boards
     * Get all boards for a clinic grouped by procedure (metadata only)
     */
    public getBoards = [
        asyncHandler(async (req: ClinicBoardRequest, res: Response) => {
            const grouped = await boardService.getBoardsByClinic(
                req.params.id,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                data: { procedures: grouped },
            });
        }),
    ];

    /**
     * GET /clinic/:id/boards/procedure/:procedureId
     * Get boards for a specific procedure
     */
    public getBoardsByProcedure = [
        asyncHandler(async (req: ProcedureBoardsRequest, res: Response) => {
            const boards = await boardService.getBoardsByProcedure(
                req.params.id,
                req.params.procedureId,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                results: boards.length,
                data: { boards },
            });
        }),
    ];

    /**
     * GET /clinic/:id/boards/:boardId
     * Get single board with full Excalidraw data
     */
    public getBoard = [
        asyncHandler(async (req: BoardRequest, res: Response) => {
            const board = await boardService.getBoard(
                req.params.id,
                req.params.boardId,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                data: { board },
            });
        }),
    ];

    /**
     * POST /clinic/:id/boards
     * Create a new board
     */
    public createBoard = [
        asyncHandler(async (req: ClinicBoardRequest, res: Response) => {
            const board = await boardService.createBoard(
                req.params.id,
                req.body,
                req.userId!
            );
            res.status(201).json({
                status: 'success',
                message: 'Board created successfully',
                data: { board },
            });
        }),
    ];

    /**
     * PUT /clinic/:id/boards/:boardId
     * Update board info (name, description, members)
     */
    public updateBoard = [
        asyncHandler(async (req: BoardRequest, res: Response) => {
            const board = await boardService.updateBoard(
                req.params.id,
                req.params.boardId,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Board updated successfully',
                data: { board },
            });
        }),
    ];

    /**
     * PUT /clinic/:id/boards/:boardId/elements
     * Save Excalidraw data
     */
    public updateBoardElements = [
        asyncHandler(async (req: BoardRequest, res: Response) => {
            const board = await boardService.updateBoardElements(
                req.params.id,
                req.params.boardId,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Board saved successfully',
                data: { board },
            });
        }),
    ];

    /**
     * DELETE /clinic/:id/boards/:boardId
     * Delete board
     */
    public deleteBoard = [
        asyncHandler(async (req: BoardRequest, res: Response) => {
            await boardService.deleteBoard(
                req.params.id,
                req.params.boardId,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Board deleted successfully',
            });
        }),
    ];
}

export default new BoardController();