import { Request, Response } from 'express';
import { AuthRequest } from '@middlewares/auth.middleware';
import { asyncHandler } from '@middlewares/error.middleware';
import {
    LeaveTypeService,
    HolidayService,
    ApprovalFlowService,
    LeaveQuotaService,
    LeaveBalanceService,
    LeaveRequestService,
} from '../services/index';
import { LeaveAdjustmentService } from '../services/leave-adjustment.service';

const leaveTypeService = new LeaveTypeService();
const holidayService = new HolidayService();
const approvalFlowService = new ApprovalFlowService();
const leaveQuotaService = new LeaveQuotaService();
const leaveBalanceService = new LeaveBalanceService();
const leaveRequestService = new LeaveRequestService();
const leaveAdjustmentService = new LeaveAdjustmentService();

// Leave Type Controller
export class LeaveTypeController {
    getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
        const includeInactive = req.query.includeInactive === 'true';
        const leaveTypes = await leaveTypeService.findAll(includeInactive);
        res.json({ status: 'success', data: { leaveTypes } });
    });

    getById = asyncHandler(async (req: AuthRequest, res: Response) => {
        const leaveType = await leaveTypeService.findById(req.params.id);
        res.json({ status: 'success', data: { leaveType } });
    });

    create = asyncHandler(async (req: AuthRequest, res: Response) => {
        const leaveType = await leaveTypeService.create(req.body, req.userId!);
        res.status(201).json({ status: 'success', data: { leaveType } });
    });

    update = asyncHandler(async (req: AuthRequest, res: Response) => {
        const leaveType = await leaveTypeService.update(req.params.id, req.body, req.userId!);
        res.json({ status: 'success', data: { leaveType } });
    });

    delete = asyncHandler(async (req: AuthRequest, res: Response) => {
        await leaveTypeService.delete(req.params.id, req.userId!);
        res.status(204).send();
    });

    seedDefaults = asyncHandler(async (req: AuthRequest, res: Response) => {
        const leaveTypes = await leaveTypeService.seedDefaults(req.userId!);
        res.status(201).json({
            status: 'success',
            message: `Seeded ${leaveTypes.length} default leave types`,
            data: { leaveTypes }
        });
    });
}

// Holiday Controller
export class HolidayController {
    getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { holidays, pagination } = await holidayService.findAll(req.query as any);
        res.json({ status: 'success', data: { holidays }, pagination });
    });

    getByYear = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = parseInt(req.params.year);
        const publishedOnly = req.query.published === 'true';
        const holidays = await holidayService.findByYear(year, publishedOnly);
        res.json({ status: 'success', data: { holidays } });
    });

    getById = asyncHandler(async (req: AuthRequest, res: Response) => {
        const holiday = await holidayService.findById(req.params.id);
        res.json({ status: 'success', data: { holiday } });
    });

    getUpcoming = asyncHandler(async (req: AuthRequest, res: Response) => {
        const count = parseInt(req.query.count as string) || 5;
        const holidays = await holidayService.getUpcoming(count);
        res.json({ status: 'success', data: { holidays } });
    });

    create = asyncHandler(async (req: AuthRequest, res: Response) => {
        const holiday = await holidayService.create(req.body, req.userId!);
        res.status(201).json({ status: 'success', data: { holiday } });
    });

    bulkImport = asyncHandler(async (req: AuthRequest, res: Response) => {
        const result = await holidayService.bulkImport(req.body, req.userId!);
        res.status(201).json({
            status: 'success',
            message: `Created ${result.created} holidays, skipped ${result.skipped}`,
            data: result
        });
    });

    update = asyncHandler(async (req: AuthRequest, res: Response) => {
        const holiday = await holidayService.update(req.params.id, req.body, req.userId!);
        res.json({ status: 'success', data: { holiday } });
    });

    delete = asyncHandler(async (req: AuthRequest, res: Response) => {
        await holidayService.delete(req.params.id, req.userId!);
        res.status(204).send();
    });

    publishByYear = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = parseInt(req.params.year);
        const count = await holidayService.publishByYear(year, req.userId!);
        res.json({ status: 'success', message: `Published ${count} holidays` });
    });

    unpublishByYear = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = parseInt(req.params.year);
        const count = await holidayService.unpublishByYear(year, req.userId!);
        res.json({ status: 'success', message: `Unpublished ${count} holidays` });
    });
}

// Approval Flow Controller
export class ApprovalFlowController {
    getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
        const flows = await approvalFlowService.findAll();
        res.json({ status: 'success', data: { flows } });
    });

    getById = asyncHandler(async (req: AuthRequest, res: Response) => {
        const flow = await approvalFlowService.findById(req.params.id);
        res.json({ status: 'success', data: { flow } });
    });

    create = asyncHandler(async (req: AuthRequest, res: Response) => {
        const flow = await approvalFlowService.create(req.body, req.userId!);
        res.status(201).json({ status: 'success', data: { flow } });
    });

    update = asyncHandler(async (req: AuthRequest, res: Response) => {
        const flow = await approvalFlowService.update(req.params.id, req.body, req.userId!);
        res.json({ status: 'success', data: { flow } });
    });

    delete = asyncHandler(async (req: AuthRequest, res: Response) => {
        await approvalFlowService.delete(req.params.id, req.userId!);
        res.status(204).send();
    });

    getByPosition = asyncHandler(async (req: AuthRequest, res: Response) => {
        const flows = await approvalFlowService.findByRequesterPosition(req.params.positionId);
        res.json({ status: 'success', data: { flows } });
    });
}

// Leave Quota Controller
export class LeaveQuotaController {
    getByYear = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = parseInt(req.params.year);
        const quotas = await leaveQuotaService.findByYear(year);
        res.json({ status: 'success', data: { quotas } });
    });

    getById = asyncHandler(async (req: AuthRequest, res: Response) => {
        const quota = await leaveQuotaService.findById(req.params.id);
        res.json({ status: 'success', data: { quota } });
    });

    create = asyncHandler(async (req: AuthRequest, res: Response) => {
        const quota = await leaveQuotaService.create(req.body, req.userId!);
        res.status(201).json({ status: 'success', data: { quota } });
    });

    update = asyncHandler(async (req: AuthRequest, res: Response) => {
        const quota = await leaveQuotaService.update(req.params.id, req.body, req.userId!);
        res.json({ status: 'success', data: { quota } });
    });

    delete = asyncHandler(async (req: AuthRequest, res: Response) => {
        await leaveQuotaService.delete(req.params.id, req.userId!);
        res.status(204).send();
    });

    copyToYear = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { fromYear, toYear } = req.body;
        const count = await leaveQuotaService.copyToYear(fromYear, toYear, req.userId!);
        res.json({ status: 'success', message: `Copied ${count} quotas` });
    });
}

// Leave Balance Controller
export class LeaveBalanceController {
    getMyBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        const balance = await leaveBalanceService.getBalance(req.userId!, year);
        res.json({ status: 'success', data: balance });
    });

    getUserBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        const balance = await leaveBalanceService.getBalance(req.params.userId, year);
        res.json({ status: 'success', data: balance });
    });

    initializeMyBalance = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = req.body.year || new Date().getFullYear();
        const balance = await leaveBalanceService.initializeUserBalance(req.userId!, year);
        res.json({ status: 'success', data: { balance } });
    });

    initializeAllUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = req.body.year || new Date().getFullYear();
        const result = await leaveBalanceService.initializeAllUsers(year);
        res.json({ status: 'success', message: `Initialized ${result.initialized} users, skipped ${result.skipped}`, data: result });
    });

    // NEW: Get all user balances (admin)
    getAllBalances = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
        const balances = await leaveBalanceService.getAllBalances(year);
        res.json({ status: 'success', data: { balances } });
    });
}

// Leave Request Controller
export class LeaveRequestController {
    // Employee endpoints
    getMyRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { requests, pagination } = await leaveRequestService.findByUser(
            req.userId!,
            req.query as any
        );
        res.json({ status: 'success', data: { requests }, pagination });
    });

    getById = asyncHandler(async (req: AuthRequest, res: Response) => {
        const request = await leaveRequestService.findById(req.params.id);
        res.json({ status: 'success', data: { request } });
    });

    create = asyncHandler(async (req: AuthRequest, res: Response) => {
        const request = await leaveRequestService.create(req.body, req.userId!);
        res.status(201).json({
            status: 'success',
            message: 'Leave request submitted successfully',
            data: { request }
        });
    });

    cancel = asyncHandler(async (req: AuthRequest, res: Response) => {
        const request = await leaveRequestService.cancel(
            req.params.id,
            req.userId!,
            req.body.reason
        );
        res.json({
            status: 'success',
            message: 'Leave request cancelled',
            data: { request }
        });
    });

    // Manager endpoints
    getPendingApprovals = asyncHandler(async (req: AuthRequest, res: Response) => {
        const requests = await leaveRequestService.findPendingForApprover(req.userId!);
        res.json({ status: 'success', data: { requests } });
    });

    approve = asyncHandler(async (req: AuthRequest, res: Response) => {
        const request = await leaveRequestService.approve(
            req.params.id,
            req.userId!,
            req.body.comment
        );
        res.json({
            status: 'success',
            message: 'Leave request approved',
            data: { request }
        });
    });

    reject = asyncHandler(async (req: AuthRequest, res: Response) => {
        const request = await leaveRequestService.reject(
            req.params.id,
            req.userId!,
            req.body.reason
        );
        res.json({
            status: 'success',
            message: 'Leave request rejected',
            data: { request }
        });
    });

    // Calendar
    getCalendar = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { startDate, endDate, userId } = req.query;
        const events = await leaveRequestService.getCalendar(
            new Date(startDate as string),
            new Date(endDate as string),
            userId as string
        );
        res.json({ status: 'success', data: { events } });
    });

    getPendingCount = asyncHandler(async (req: AuthRequest, res: Response) => {
        const count = await leaveRequestService.getPendingCountForApprover(req.userId!);
        res.json({
            success: true,
            data: { count }
        });
    });
}

// Leave Adjustment Controller (NEW)
export class LeaveAdjustmentController {
    // Get all adjustments (admin)
    getAll = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        const adjustments = await leaveAdjustmentService.findAll(year);
        res.json({ status: 'success', data: { adjustments } });
    });

    // Get adjustments by user
    getByUser = asyncHandler(async (req: AuthRequest, res: Response) => {
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        const adjustments = await leaveAdjustmentService.findByUser(req.params.userId, year);
        res.json({ status: 'success', data: { adjustments } });
    });

    // Get adjustment by ID
    getById = asyncHandler(async (req: AuthRequest, res: Response) => {
        const adjustment = await leaveAdjustmentService.findById(req.params.id);
        res.json({ status: 'success', data: { adjustment } });
    });

    // Create adjustment
    create = asyncHandler(async (req: AuthRequest, res: Response) => {
        const adjustment = await leaveAdjustmentService.create(req.body, req.userId!);
        res.status(201).json({ status: 'success', data: { adjustment } });
    });

    // Transfer days between users
    transfer = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { fromUser, toUser, leaveType, days, year, reason } = req.body;
        const result = await leaveAdjustmentService.transferDays(
            fromUser,
            toUser,
            leaveType,
            days,
            year,
            reason,
            req.userId!
        );
        res.status(201).json({
            status: 'success',
            message: `Transferred ${days} days successfully`,
            data: result
        });
    });

    // Bulk bonus
    bulkBonus = asyncHandler(async (req: AuthRequest, res: Response) => {
        const { userIds, leaveType, days, year, reason } = req.body;
        const count = await leaveAdjustmentService.bulkBonus(
            userIds,
            leaveType,
            days,
            year,
            reason,
            req.userId!
        );
        res.status(201).json({
            status: 'success',
            message: `Added bonus to ${count} users`,
            data: { count }
        });
    });

    // Get pending approvals
    getPending = asyncHandler(async (req: AuthRequest, res: Response) => {
        const adjustments = await leaveAdjustmentService.findPendingApprovals();
        res.json({ status: 'success', data: { adjustments } });
    });

    // Approve adjustment
    approve = asyncHandler(async (req: AuthRequest, res: Response) => {
        const adjustment = await leaveAdjustmentService.approve(req.params.id, req.userId!);
        res.json({
            status: 'success',
            message: 'Adjustment approved',
            data: { adjustment }
        });
    });

    // Reject adjustment
    reject = asyncHandler(async (req: AuthRequest, res: Response) => {
        const adjustment = await leaveAdjustmentService.reject(
            req.params.id,
            req.userId!,
            req.body.reason
        );
        res.json({
            status: 'success',
            message: 'Adjustment rejected',
            data: { adjustment }
        });
    });
}

// Export instances
export const leaveTypeController = new LeaveTypeController();
export const holidayController = new HolidayController();
export const approvalFlowController = new ApprovalFlowController();
export const leaveQuotaController = new LeaveQuotaController();
export const leaveBalanceController = new LeaveBalanceController();
export const leaveRequestController = new LeaveRequestController();
export const leaveAdjustmentController = new LeaveAdjustmentController();

export default {
    leaveType: leaveTypeController,
    holiday: holidayController,
    approvalFlow: approvalFlowController,
    leaveQuota: leaveQuotaController,
    leaveBalance: leaveBalanceController,
    leaveRequest: leaveRequestController,
    leaveAdjustment: leaveAdjustmentController,
};