import { Response } from 'express';
import multer from 'multer';
import LeadService from '@services/lead.service';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@middlewares/error.middleware';

interface LeadRequest extends AuthRequest {
    params: { id: string };
}

const leadService = new LeadService();

// Memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB ต่อไฟล์
});

export class LeadController {
    /**
     * GET /lead
     */
    public getLeads = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const rawStatus = req.query.status;
            const statusArray = LeadController.parseStatusParam(rawStatus);

            const { leads, pagination } = await leadService.listLeads(
                { ...(req.query as any), status: statusArray },
                req.userId!
            );
            res.status(200).json({
                status: 'success',
                results: leads.length,
                pagination,
                data: { leads },
            });
        }),
    ];

    private static parseStatusParam(raw: unknown): string[] | undefined {
        if (raw === undefined || raw === null || raw === '') return undefined;
        if (Array.isArray(raw)) {
            return raw.flatMap((v) => String(v).split(',')).map((s) => s.trim()).filter(Boolean);
        }
        return String(raw)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    /**
     * GET /lead/:id
     */
    public getLead = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const lead = await leadService.getLeadById(req.params.id, req.userId!);
            res.status(200).json({
                status: 'success',
                data: { lead },
            });
        }),
    ];

    /**
     * GET /lead/:id/history
     */
    public getLeadHistory = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const result = await leadService.getLeadHistory(req.params.id, req.userId!);
            res.status(200).json({
                status: 'success',
                data: result,
            });
        }),
    ];

    /**
     * POST /lead
     */
    public createLead = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const lead = await leadService.createLead(req.body, req.userId!);
            res.status(201).json({
                status: 'success',
                message: 'Lead created successfully',
                data: { lead },
            });
        }),
    ];

    /**
     * PUT /lead/:id
     */
    public updateLead = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const lead = await leadService.updateLead(req.params.id, req.body, req.userId!);
            res.status(200).json({
                status: 'success',
                message: 'Lead updated successfully',
                data: { lead },
            });
        }),
    ];

    /**
     * PUT /lead/:id/arrived
     * แก้ไขหัตถการย้อนหลัง (เฉพาะ status = arrived)
     */
    public editArrivedLead = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const result = await leadService.editArrivedLead(req.params.id, req.body, req.userId!);
            res.status(200).json({
                status: 'success',
                message: 'Lead procedures updated successfully',
                data: result,
            });
        }),
    ];

    /**
     * DELETE /lead/:id
     */
    public deleteLead = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            await leadService.deleteLead(req.params.id, req.userId!);
            res.status(200).json({
                status: 'success',
                message: 'Lead deleted successfully',
            });
        }),
    ];

    /**
     * GET /lead/patient/search
     * Proxy ไปยัง lead-api GET /patients/search (ยิงทีละคลินิกที่ user ดูแล แล้ว merge)
     */
    public searchPatients = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const { q, limit } = req.query as { q: string; limit?: string };
            const result = await leadService.searchPatients(q, Number(limit) || 5, req.userId!);
            res.status(200).json({
                status: 'success',
                data: result,
            });
        }),
    ];

    /**
     * GET /lead/patient/check-tel
     * Proxy ไปยัง lead-api GET /patients/check-tel (เช็คทุกคลินิกที่ user ดูแล)
     */
    public checkPhoneDuplicate = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const { tel, excludeId } = req.query as { tel: string; excludeId?: string };
            const result = await leadService.checkPhoneDuplicate(tel, excludeId, req.userId!);
            res.status(200).json({
                status: 'success',
                data: result,
            });
        }),
    ];

    /**
     * GET /lead/setting/options?clinicId=<synergy clinic ObjectId>
     * Proxy ไปยัง lead-api GET /options/clinics/:clinicId
     * ถ้าไม่ส่ง clinicId มา จะใช้คลินิกแรกที่ user ดูแลเป็นตัวแทน
     */
    public getSettingOptions = [
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const { clinicId } = req.query as { clinicId?: string };
            const result = await leadService.getSettingOptions(req.userId!, clinicId);
            res.status(200).json({
                status: 'success',
                data: result,
            });
        }),
    ];

    /**
     * POST /lead/upload/slip
     * Proxy ไปยัง lead-api POST /uploads/slip (field: slip)
     */
    public uploadSlip = [
        upload.single('slip'),
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const file = (req as any).file as Express.Multer.File | undefined;
            if (!file) {
                return res.status(400).json({
                    status: 'error',
                    message: 'No file uploaded (expected field name "slip")',
                });
            }
            const result = await leadService.uploadSlip({
                buffer: file.buffer,
                originalname: file.originalname,
                mimetype: file.mimetype,
            });
            res.status(200).json({
                status: 'success',
                data: result,
            });
        }),
    ];

    /**
     * POST /lead/upload/receipt
     * Proxy ไปยัง lead-api POST /uploads/receipt (field: receipt)
     */
    public uploadReceipt = [
        upload.single('receipt'),
        asyncHandler(async (req: LeadRequest, res: Response) => {
            const file = (req as any).file as Express.Multer.File | undefined;
            if (!file) {
                return res.status(400).json({
                    status: 'error',
                    message: 'No file uploaded (expected field name "receipt")',
                });
            }
            const result = await leadService.uploadReceipt({
                buffer: file.buffer,
                originalname: file.originalname,
                mimetype: file.mimetype,
            });
            res.status(200).json({
                status: 'success',
                data: result,
            });
        }),
    ];
}

export default new LeadController();