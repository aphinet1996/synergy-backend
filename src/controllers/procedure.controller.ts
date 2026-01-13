import { Request, Response } from 'express';
import ProcedureService from '@services/procedure.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@middlewares/error.middleware';

interface ProcedureRequest extends AuthRequest {
    params: { id: string };
}

const procedureService = new ProcedureService();

export class ProcedureController {

    /**
     * GET /procedure
     * List all procedures (with pagination, search, filter)
     */
    public getProcedures = [
        asyncHandler(async (req: ProcedureRequest, res: Response) => {
            const { procedures, pagination } = await procedureService.listProcedures(
                req.query as any
            );
            res.status(200).json({
                status: 'success',
                results: procedures.length,
                pagination,
                data: { procedures },
            });
        }),
    ];

    /**
     * GET /procedure/active
     * Get all active procedures (for dropdown/form)
     */
    public getActiveProcedures = [
        asyncHandler(async (req: ProcedureRequest, res: Response) => {
            const procedures = await procedureService.getActiveProcedures();
            res.status(200).json({
                status: 'success',
                results: procedures.length,
                data: { procedures },
            });
        }),
    ];

    /**
     * GET /procedure/:id
     * Get single procedure
     */
    public getProcedure = [
        asyncHandler(async (req: ProcedureRequest, res: Response) => {
            const procedure = await procedureService.getProcedureById(req.params.id);
            res.status(200).json({
                status: 'success',
                data: { procedure },
            });
        }),
    ];

    /**
     * POST /procedure
     * Create new procedure
     */
    public createProcedure = [
        asyncHandler(async (req: ProcedureRequest, res: Response) => {
            const procedure = await procedureService.createProcedure(
                req.body,
                req.userId!
            );
            res.status(201).json({
                status: 'success',
                message: 'Procedure created successfully',
                data: { procedure }, 
            });
        }),
    ];

    /**
     * POST /procedure/bulk
     * Bulk create procedures
     */
    public bulkCreateProcedures = [
        asyncHandler(async (req: ProcedureRequest, res: Response) => {
            const { created, skipped } = await procedureService.bulkCreateProcedures(
                req.body,
                req.userId!
            );
            res.status(201).json({
                status: 'success',
                message: `${created.length} procedures created, ${skipped.length} skipped`,
                data: { 
                    created,
                    skipped,
                },
            });
        }),
    ];

    /**
     * PUT /procedure/:id
     * Update procedure
     */
    public updateProcedure = [
        asyncHandler(async (req: ProcedureRequest, res: Response) => {
            const procedure = await procedureService.updateProcedure(
                req.params.id,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Procedure updated successfully',
                data: { procedure },
            });
        }),
    ];

    /**
     * DELETE /procedure/:id
     * Delete procedure
     */
    public deleteProcedure = [
        asyncHandler(async (req: ProcedureRequest, res: Response) => {
            await procedureService.deleteProcedure(req.params.id, req.userId!);
            res.status(200).json({
                status: 'success',
                message: 'Procedure deleted successfully',
            });
        }),
    ];

    /**
     * PATCH /procedure/:id/deactivate
     * Soft delete (deactivate)
     */
    public deactivateProcedure = [
        asyncHandler(async (req: ProcedureRequest, res: Response) => {
            const procedure = await procedureService.deactivateProcedure(
                req.params.id,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Procedure deactivated successfully',
                data: { procedure },
            });
        }),
    ];

    /**
     * PATCH /procedure/:id/activate
     * Activate procedure
     */
    public activateProcedure = [
        asyncHandler(async (req: ProcedureRequest, res: Response) => {
            const procedure = await procedureService.activateProcedure(
                req.params.id,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Procedure activated successfully',
                data: { procedure },
            });
        }),
    ];
}

export default new ProcedureController();