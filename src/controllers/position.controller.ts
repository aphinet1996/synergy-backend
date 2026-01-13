import { Request, Response, NextFunction } from 'express';
import PositionService from '@services/position.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { validateObjectId } from '@/middlewares/validation.middleware';
import { asyncHandler } from '@middlewares/error.middleware';

// Extend AuthRequest
interface PositionRequest extends AuthRequest {
    params: { id: string };
}

const positionService = new PositionService();

export class PositionController {
    public getPositions = [
        asyncHandler(async (req: PositionRequest, res: Response) => {
            const { positions, pagination } = await positionService.listPositions(
                req.query as any
            );
            res.status(200).json({
                status: 'success',
                results: positions.length,
                pagination,
                data: { positions },
            });
        }),
    ];

    public getActivePositions = [
        asyncHandler(async (req: PositionRequest, res: Response) => {
            const positions = await positionService.getActivePositions();
            res.status(200).json({
                status: 'success',
                results: positions.length,
                data: { positions },
            });
        }),
    ];

    public getPosition = [
        validateObjectId('id'),
        asyncHandler(async (req: PositionRequest, res: Response) => {
            const position = await positionService.getPositionById(req.params.id);
            res.status(200).json({
                status: 'success',
                data: { position },
            });
        }),
    ];

    public createPosition = [
        asyncHandler(async (req: PositionRequest, res: Response) => {
            const position = await positionService.createPosition(req.body, req.userId!);
            res.status(201).json({
                status: 'success',
                message: 'Position created successfully',
                data: { position },
            });
        }),
    ];

    public updatePosition = [
        validateObjectId('id'),
        asyncHandler(async (req: PositionRequest, res: Response) => {
            const position = await positionService.updatePosition(
                req.params.id,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Position updated successfully',
                data: { position },
            });
        }),
    ];

    public togglePosition = [
        validateObjectId('id'),
        asyncHandler(async (req: PositionRequest, res: Response) => {
            const position = await positionService.togglePositionStatus(
                req.params.id,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Position status toggled successfully',
                data: { position },
            });
        }),
    ];

    public deletePosition = [
        validateObjectId('id'),
        asyncHandler(async (req: PositionRequest, res: Response) => {
            await positionService.deletePosition(req.params.id, req.userId!);
            res.status(200).json({
                status: 'success',
                message: 'Position deleted successfully',
            });
        }),
    ];

    public hardDeletePosition = [
        validateObjectId('id'),
        asyncHandler(async (req: PositionRequest, res: Response) => {
            await positionService.hardDeletePosition(req.params.id, req.userId!);
            res.status(204).json({
                status: 'success',
                message: 'Position permanently deleted',
            });
        }),
    ];
}

export default new PositionController();