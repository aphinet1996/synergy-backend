// import { Request, Response, NextFunction } from 'express';
// import ClinicService from '@services/clinic.service';
// import { AuthRequest } from '@middlewares/auth.middleware';
// import { asyncHandler } from '@middlewares/error.middleware';


// // Extend AuthRequest
// interface ClinicRequest extends AuthRequest {
//     params: { id: string };
// }

// const clinicService = new ClinicService();

// export class ClinicController {
//     public getClinics = [
//         asyncHandler(async (req: ClinicRequest, res: Response) => {
//             const { clinics, pagination } = await clinicService.listClinics(
//                 req.query as any,
//                 req.userId!
//             );
//             res.status(200).json({
//                 status: 'success',
//                 results: clinics.length,
//                 pagination,
//                 data: { clinics },
//             });
//         }),
//     ];

//     public getClinic = [
//         asyncHandler(async (req: ClinicRequest, res: Response) => {
//             const clinic = await clinicService.getClinicById(req.params.id);
//             res.status(200).json({
//                 status: 'success',
//                 data: { clinic },
//             });
//         }),
//     ];

//     public createClinic = [
//         asyncHandler(async (req: ClinicRequest, res: Response) => {
//             const clinic = await clinicService.createClinic(req.body, req.userId!);
//             res.status(201).json({
//                 status: 'success',
//                 message: 'Clinic created successfully',
//                 data: { clinic },
//             });
//         }),
//     ];

//     public updateClinic = [
//         asyncHandler(async (req: ClinicRequest, res: Response) => {
//             const clinic = await clinicService.updateClinic(
//                 req.params.id,
//                 req.body,
//                 req.userId!
//             );
//             res.status(200).json({
//                 status: 'success',
//                 message: 'Clinic updated successfully',
//                 data: { clinic },
//             });
//         }),
//     ];

//     public deleteClinic = [
//         asyncHandler(async (req: ClinicRequest, res: Response) => {
//             await clinicService.deleteClinic(req.params.id, req.userId!);
//             res.status(204).json({
//                 status: 'success',
//                 message: 'Clinic deleted successfully',
//             });
//         }),
//     ];
// }

// export default new ClinicController();

import { Request, Response, NextFunction } from 'express';
import ClinicService from '@services/clinic.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@middlewares/error.middleware';


// Extend AuthRequest
interface ClinicRequest extends AuthRequest {
    params: { id: string };
}

interface TimelineItemRequest extends AuthRequest {
    params: { id: string; itemId: string };
}

const clinicService = new ClinicService();

export class ClinicController {
    public getClinics = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const { clinics, pagination } = await clinicService.listClinics(
                req.query as any,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                results: clinics.length,
                pagination,
                data: { clinics },
            });
        }),
    ];

    public getClinic = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const clinic = await clinicService.getClinicById(req.params.id);
            res.status(200).json({
                status: 'success',
                data: { clinic },
            });
        }),
    ];

    /**
     * GET /clinic/:id/procedures
     * Get procedures for a clinic (lightweight for Board tab)
     */
    public getClinicProcedures = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const procedures = await clinicService.getClinicProcedures(
                req.params.id,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                results: procedures.length,
                data: { procedures },
            });
        }),
    ];

    public createClinic = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const clinic = await clinicService.createClinic(req.body, req.userId!);
            res.status(201).json({
                status: 'success',
                message: 'Clinic created successfully',
                data: { clinic },
            });
        }),
    ];

    public updateClinic = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const clinic = await clinicService.updateClinic(
                req.params.id,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Clinic updated successfully',
                data: { clinic },
            });
        }),
    ];

    public deleteClinic = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            await clinicService.deleteClinic(req.params.id, req.userId!);
            res.status(204).json({
                status: 'success',
                message: 'Clinic deleted successfully',
            });
        }),
    ];

    // ==================== TIMELINE HANDLERS ====================

    /**
     * GET /clinic/:id/timeline
     * Get timeline for a clinic
     */
    public getTimeline = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const result = await clinicService.getTimeline(
                req.params.id,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                data: result,
            });
        }),
    ];

    /**
     * PUT /clinic/:id/timeline
     * Update entire timeline
     */
    public updateTimeline = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const clinic = await clinicService.updateTimeline(
                req.params.id,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Timeline updated successfully',
                data: { 
                    timeline: clinic.timeline,
                    totalWeeks: clinic.totalWeeks,
                },
            });
        }),
    ];

    /**
     * POST /clinic/:id/timeline/item
     * Add single timeline item
     */
    public addTimelineItem = [
        asyncHandler(async (req: ClinicRequest, res: Response) => {
            const clinic = await clinicService.addTimelineItem(
                req.params.id,
                req.body,
                req.userId!
            );
            res.status(201).json({
                status: 'success',
                message: 'Timeline item added successfully',
                data: { 
                    timeline: clinic.timeline,
                },
            });
        }),
    ];

    /**
     * PATCH /clinic/:id/timeline/item/:itemId
     * Update single timeline item (for drag operations)
     */
    public updateTimelineItem = [
        asyncHandler(async (req: TimelineItemRequest, res: Response) => {
            const clinic = await clinicService.updateTimelineItem(
                req.params.id,
                req.params.itemId,
                req.body,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Timeline item updated successfully',
                data: { 
                    timeline: clinic.timeline,
                },
            });
        }),
    ];

    /**
     * DELETE /clinic/:id/timeline/item/:itemId
     * Delete single timeline item
     */
    public deleteTimelineItem = [
        asyncHandler(async (req: TimelineItemRequest, res: Response) => {
            const clinic = await clinicService.deleteTimelineItem(
                req.params.id,
                req.params.itemId,
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                message: 'Timeline item deleted successfully',
                data: { 
                    timeline: clinic.timeline,
                },
            });
        }),
    ];
}

export default new ClinicController();