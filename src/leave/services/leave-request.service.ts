import mongoose from 'mongoose';
import LeaveRequest from '../models/leave-request.model';
import LeaveType from '../models/leave-type.model';
import ApprovalFlow from '../models/approval-flow.model';
import Holiday from '../models/holiday.model';
import User from '@models/user.model';
import Position from '@models/position.model';
import {
    ILeaveRequestDoc,
    LeaveStatus,
    TeamLeaveRequestDTO,
    IApprovalHistory
} from '../interfaces/leave-request.interface';
import { CreateLeaveRequestDTO, LeaveRequestListQueryDTO } from '../validations/leave.validation';
import { NotFoundException, BadRequestException, ForbiddenException } from '@exceptions/HttpExcetion';
import { LeaveBalanceService } from './leave-balance.service';
import { logger } from '@utils/logger';
import { getIO } from '@sockets/index';
// 🔥 Import socket event emitters
import {
    emitLeaveRequestCreated,
    emitLeaveStatusUpdated,
    emitLeaveRequestCancelled,
} from '@sockets/leave.socket';

const HOURS_PER_DAY = 8;

export class LeaveRequestService {
    private balanceService: LeaveBalanceService;

    constructor() {
        this.balanceService = new LeaveBalanceService();
    }

    /**
     * Helper: Extract ID from either ObjectId or populated object
     */
    private getObjectId(field: any): string {
        if (typeof field === 'object' && field._id) {
            return field._id.toString();
        }
        return field.toString();
    }

    /**
     * Create a new leave request
     */
    async create(data: CreateLeaveRequestDTO, userId: string): Promise<ILeaveRequestDoc> {
        this.validateObjectId(userId);

        // Get user info
        const user = await User.findById(userId).select('firstname lastname nickname positionId employeeType');
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Get position name
        let positionName = '';
        if (user.positionId) {
            const position = await Position.findById(user.positionId);
            positionName = position?.name || '';
        }

        // Get leave type
        const leaveType = await LeaveType.findById(data.leaveType);
        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        // Validate dates
        await this.validateDates(data, leaveType);

        // Calculate days
        const { days, hours } = this.calculateDays(data);

        // Check balance
        const year = data.startDate.getFullYear();
        const hasBalance = await this.balanceService.hasBalance(userId, data.leaveType, days, year);
        if (!hasBalance) {
            throw new BadRequestException('Insufficient leave balance');
        }

        // Generate request number
        const requestNumber = await LeaveRequest.generateRequestNumber(year);

        // Get approval flow
        const approvalFlow = await ApprovalFlow.findFlowForPosition(
            user.positionId?.toString() || '',
            data.leaveType
        );

        // Build approval history
        const approvalHistory: IApprovalHistory[] = [];
        if (approvalFlow) {
            for (const step of approvalFlow.steps) {
                // Find users in the approver position
                const approvers = await User.find({
                    positionId: step.approverPosition,
                    isActive: true,
                }).select('_id firstname lastname');

                if (approvers.length > 0) {
                    approvalHistory.push({
                        step: step.stepOrder,
                        approver: approvers[0]._id as mongoose.Types.ObjectId,
                        approverName: `${approvers[0].firstname} ${approvers[0].lastname}`,
                        approverPosition: step.approverPositionName,
                        action: 'pending',
                    });
                } else if (!step.canSkip) {
                    throw new BadRequestException(`No approver found for position: ${step.approverPositionName}`);
                }
            }
        }

        // Create request
        const request = await LeaveRequest.create({
            requestNumber,
            user: new mongoose.Types.ObjectId(userId),
            userName: `${user.firstname} ${user.lastname}`,
            userPosition: positionName,
            leaveType: new mongoose.Types.ObjectId(data.leaveType),
            leaveTypeCode: leaveType.code,
            leaveTypeName: leaveType.name,
            durationType: data.durationType,
            halfDayPeriod: data.halfDayPeriod,
            startDate: data.startDate,
            endDate: data.endDate,
            startTime: data.startTime,
            endTime: data.endTime,
            days,
            hours,
            reason: data.reason,
            attachments: data.attachments || [],
            status: leaveType.requireApproval ? 'pending' : 'approved',
            currentApprovalStep: 1,
            approvalFlow: approvalFlow?._id,
            approvalHistory,
            year,
        });

        // Deduct from balance (as pending)
        await this.balanceService.deductPending(userId, data.leaveType, days, year);

        // If no approval required, confirm immediately
        if (!leaveType.requireApproval) {
            await this.balanceService.confirmPending(userId, data.leaveType, days, year);
            request.approvedAt = new Date();
        }

        logger.info(`Leave request created: ${requestNumber} by user ${userId}`);

        // 🔥 Emit socket event - ส่งไปที่ approvers rooms
        try {
            emitLeaveRequestCreated(getIO(), {
                request: {
                    id: request._id.toString(),
                    requestNumber: request.requestNumber,
                    leaveType: leaveType._id.toString(),
                    leaveTypeName: leaveType.name,
                    startDate: request.startDate,
                    endDate: request.endDate,
                    days: request.days,
                    status: request.status,
                    userName: request.userName,
                },
                approvers: approvalHistory.map((h) => h.approver.toString()),
            });
        } catch (error) {
            logger.error('Failed to emit leave:request-created:', error);
        }

        return request;
    }

    /**
     * Get leave requests for a user
     */
    async findByUser(
        userId: string,
        query: LeaveRequestListQueryDTO
    ): Promise<{ requests: ILeaveRequestDoc[]; pagination: any }> {
        this.validateObjectId(userId);

        const { status, leaveType, year, page = 1, limit = 10 } = query;
        const skip = (page - 1) * limit;

        const filter: any = { user: new mongoose.Types.ObjectId(userId) };
        if (status) filter.status = status;
        if (leaveType) filter.leaveType = new mongoose.Types.ObjectId(leaveType);
        if (year) filter.year = year;

        const [requests, total] = await Promise.all([
            LeaveRequest.find(filter)
                .populate('leaveType', 'name code color icon')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean<ILeaveRequestDoc[]>(),
            LeaveRequest.countDocuments(filter),
        ]);

        return {
            requests,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get pending requests for approver
     */
    async findPendingForApprover(approverId: string): Promise<TeamLeaveRequestDTO[]> {
        this.validateObjectId(approverId);

        const approver = await User.findById(approverId).select('positionId');
        if (!approver) {
            throw new NotFoundException('Approver not found');
        }

        // Find pending requests where approver's position is in the current step
        const requests = await LeaveRequest.find({
            status: 'pending',
            'approvalHistory': {
                $elemMatch: {
                    action: 'pending',
                    approver: new mongoose.Types.ObjectId(approverId),
                },
            },
        })
            .populate('user', 'firstname lastname nickname positionId profile')
            .populate('leaveType', 'name code color icon')
            .sort({ createdAt: 1 })
            .lean();

        // Format for frontend
        return requests.map((r) => this.formatTeamRequest(r));
    }

    /**
     * Get request by ID
     */
    async findById(id: string): Promise<ILeaveRequestDoc> {
        this.validateObjectId(id);

        const request = await LeaveRequest.findById(id)
            .populate('user', 'firstname lastname nickname positionId profile')
            .populate('leaveType', 'name code color icon')
            .lean<ILeaveRequestDoc>();

        if (!request) {
            throw new NotFoundException('Leave request not found');
        }

        return request;
    }

    /**
     * Approve leave request
     */
    async approve(requestId: string, approverId: string, comment?: string): Promise<ILeaveRequestDoc> {
        this.validateObjectId(requestId);
        this.validateObjectId(approverId);

        const request = await LeaveRequest.findById(requestId);
        if (!request) {
            throw new NotFoundException('Leave request not found');
        }

        if (request.status !== 'pending') {
            throw new BadRequestException('Request is not pending');
        }

        // Get approver info
        const approver = await User.findById(approverId).select('firstname lastname');
        const approverName = approver ? `${approver.firstname} ${approver.lastname}` : 'ผู้อนุมัติ';

        // Find the current pending step for this approver
        const stepIndex = request.approvalHistory.findIndex(
            (h) => h.action === 'pending' && h.approver.toString() === approverId
        );

        if (stepIndex === -1) {
            throw new ForbiddenException('Not authorized to approve this request');
        }

        // Update approval history
        request.approvalHistory[stepIndex].action = 'approved';
        request.approvalHistory[stepIndex].actionAt = new Date();
        request.approvalHistory[stepIndex].comment = comment;

        // Check if all steps are approved
        const allApproved = request.approvalHistory.every(
            (h) => h.action === 'approved'
        );

        // Get next approvers (for step approval)
        const nextApprovers = request.approvalHistory
            .filter((h) => h.action === 'pending')
            .map((h) => h.approver.toString());

        if (allApproved) {
            request.status = 'approved';
            request.approvedAt = new Date();

            // Confirm pending balance as used
            const leaveTypeId = this.getObjectId(request.leaveType);
            await this.balanceService.confirmPending(
                request.user.toString(),
                leaveTypeId,
                request.days,
                request.year
            );
        } else {
            // Move to next step
            request.currentApprovalStep += 1;
        }

        await request.save();

        logger.info(`Leave request ${request.requestNumber} approved by ${approverId}`);

        // 🔥 Emit socket event - ส่งไปที่ user room
        try {
            emitLeaveStatusUpdated(getIO(), {
                request: {
                    id: request._id.toString(),
                    requestNumber: request.requestNumber,
                    leaveType: this.getObjectId(request.leaveType),
                    leaveTypeName: request.leaveTypeName,
                    startDate: request.startDate,
                    endDate: request.endDate,
                    days: request.days,
                    status: request.status,
                    userName: request.userName,
                },
                userId: request.user.toString(),
                action: allApproved ? 'fully_approved' : 'step_approved',
                approverName,
                nextApprovers: allApproved ? undefined : nextApprovers,
            });
        } catch (error) {
            logger.error('Failed to emit leave:status-updated:', error);
        }

        return request;
    }

    /**
     * Reject leave request
     */
    async reject(requestId: string, approverId: string, reason: string): Promise<ILeaveRequestDoc> {
        this.validateObjectId(requestId);
        this.validateObjectId(approverId);

        const request = await LeaveRequest.findById(requestId);
        if (!request) {
            throw new NotFoundException('Leave request not found');
        }

        if (request.status !== 'pending') {
            throw new BadRequestException('Request is not pending');
        }

        // Get approver info
        const approver = await User.findById(approverId).select('firstname lastname');
        const approverName = approver ? `${approver.firstname} ${approver.lastname}` : 'ผู้อนุมัติ';

        // Find the current pending step for this approver
        const stepIndex = request.approvalHistory.findIndex(
            (h) => h.action === 'pending' && h.approver.toString() === approverId
        );

        if (stepIndex === -1) {
            throw new ForbiddenException('Not authorized to reject this request');
        }

        // Update approval history
        request.approvalHistory[stepIndex].action = 'rejected';
        request.approvalHistory[stepIndex].actionAt = new Date();
        request.approvalHistory[stepIndex].comment = reason;

        request.status = 'rejected';
        request.rejectedAt = new Date();
        request.rejectedReason = reason;

        await request.save();

        // Release pending balance
        const leaveTypeId = this.getObjectId(request.leaveType);
        await this.balanceService.releasePending(
            request.user.toString(),
            leaveTypeId,
            request.days,
            request.year
        );

        logger.info(`Leave request ${request.requestNumber} rejected by ${approverId}`);

        // 🔥 Emit socket event - ส่งไปที่ user room
        try {
            emitLeaveStatusUpdated(getIO(), {
                request: {
                    id: request._id.toString(),
                    requestNumber: request.requestNumber,
                    leaveType: leaveTypeId,
                    leaveTypeName: request.leaveTypeName,
                    startDate: request.startDate,
                    endDate: request.endDate,
                    days: request.days,
                    status: request.status,
                    userName: request.userName,
                },
                userId: request.user.toString(),
                action: 'rejected',
                approverName,
                rejectedReason: reason,
            });
        } catch (error) {
            logger.error('Failed to emit leave:status-updated:', error);
        }

        return request;
    }

    /**
     * Cancel leave request
     */
    async cancel(requestId: string, userId: string, reason?: string): Promise<ILeaveRequestDoc> {
        this.validateObjectId(requestId);
        this.validateObjectId(userId);

        const request = await LeaveRequest.findById(requestId);
        if (!request) {
            throw new NotFoundException('Leave request not found');
        }

        // Only owner can cancel
        if (request.user.toString() !== userId) {
            throw new ForbiddenException('Not authorized to cancel this request');
        }

        // Can only cancel pending requests
        if (request.status !== 'pending') {
            throw new BadRequestException('Can only cancel pending requests');
        }

        // Get pending approvers before cancelling
        const pendingApprovers = request.approvalHistory
            .filter((h) => h.action === 'pending')
            .map((h) => h.approver.toString());

        request.status = 'cancelled';
        request.cancelledAt = new Date();
        request.cancelledReason = reason;

        await request.save();

        // Release pending balance - use helper to get correct ID
        const leaveTypeId = this.getObjectId(request.leaveType);
        await this.balanceService.releasePending(
            request.user.toString(),
            leaveTypeId,
            request.days,
            request.year
        );

        logger.info(`Leave request ${request.requestNumber} cancelled by ${userId}`);

        // 🔥 Emit socket event - ส่งไปที่ approvers rooms
        try {
            emitLeaveRequestCancelled(getIO(), {
                request: {
                    id: request._id.toString(),
                    requestNumber: request.requestNumber,
                    leaveType: leaveTypeId,
                    leaveTypeName: request.leaveTypeName,
                    startDate: request.startDate,
                    endDate: request.endDate,
                    days: request.days,
                    status: request.status,
                    userName: request.userName,
                },
                approvers: pendingApprovers,
            });
        } catch (error) {
            logger.error('Failed to emit leave:request-cancelled:', error);
        }

        return request;
    }

    /**
     * Get leave calendar (requests within date range)
     */
    async getCalendar(startDate: Date, endDate: Date, userId?: string): Promise<any[]> {
        const filter: any = {
            status: { $in: ['pending', 'approved'] },
            $or: [
                { startDate: { $gte: startDate, $lte: endDate } },
                { endDate: { $gte: startDate, $lte: endDate } },
                { startDate: { $lte: startDate }, endDate: { $gte: endDate } },
            ],
        };

        if (userId) {
            filter.user = new mongoose.Types.ObjectId(userId);
        }

        const requests = await LeaveRequest.find(filter)
            .populate('user', 'firstname lastname nickname')
            .populate('leaveType', 'name code color')
            .select('user leaveType startDate endDate days status durationType halfDayPeriod')
            .lean();

        return requests.map((r: any) => ({
            id: r._id,
            title: userId ? r.leaveTypeName : `${r.user.nickname} - ${r.leaveTypeName}`,
            start: r.startDate,
            end: r.endDate,
            color: r.leaveType?.color || '#6B7280',
            status: r.status,
            days: r.days,
        }));
    }

    async getPendingCountForApprover(approverId: string): Promise<number> {
        this.validateObjectId(approverId);

        const count = await LeaveRequest.countDocuments({
            status: 'pending',
            'approvalHistory': {
                $elemMatch: {
                    action: 'pending',
                    approver: new mongoose.Types.ObjectId(approverId),
                },
            },
        });

        return count;
    }


    // Private Methods

    private async validateDates(data: CreateLeaveRequestDTO, leaveType: any): Promise<void> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startDate = new Date(data.startDate);
        startDate.setHours(0, 0, 0, 0);

        // Check past date
        if (startDate < today && !leaveType.allowPastDate) {
            throw new BadRequestException('Past dates are not allowed for this leave type');
        }

        // Check past date limit
        if (startDate < today && leaveType.allowPastDate) {
            const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff > (leaveType.pastDateLimit || 7)) {
                throw new BadRequestException(`Cannot request leave more than ${leaveType.pastDateLimit || 7} days in the past`);
            }
        }

        // Check half day permission
        if (data.durationType === 'half_day' && !leaveType.allowHalfDay) {
            throw new BadRequestException('Half day leave is not allowed for this leave type');
        }

        // Check hourly permission
        if (data.durationType === 'hours' && !leaveType.allowHours) {
            throw new BadRequestException('Hourly leave is not allowed for this leave type');
        }

        // Check if dates fall on holidays
        const isStartHoliday = await Holiday.isHoliday(data.startDate);
        const isEndHoliday = await Holiday.isHoliday(data.endDate);
        if (isStartHoliday || isEndHoliday) {
            throw new BadRequestException('Cannot request leave on a public holiday');
        }
    }

    private calculateDays(data: CreateLeaveRequestDTO): { days: number; hours?: number } {
        switch (data.durationType) {
            case 'full_day': {
                const start = new Date(data.startDate);
                const end = new Date(data.endDate);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                return { days: diffDays };
            }
            case 'half_day':
                return { days: 0.5 };
            case 'hours': {
                if (!data.startTime || !data.endTime) {
                    throw new BadRequestException('Start and end time are required for hourly leave');
                }
                const startHour = parseInt(data.startTime.split(':')[0]);
                const endHour = parseInt(data.endTime.split(':')[0]);
                let hours = endHour - startHour;
                // Subtract lunch hour if spans lunch time
                if (startHour < 13 && endHour > 12) {
                    hours -= 1;
                }
                const days = Number((hours / HOURS_PER_DAY).toFixed(2));
                return { days, hours };
            }
            default:
                throw new BadRequestException('Invalid duration type');
        }
    }

    private formatTeamRequest(request: any): TeamLeaveRequestDTO {
        return {
            id: request._id.toString(),
            type: request.leaveTypeCode,
            typeName: request.leaveTypeName,
            durationType: request.durationType,
            halfDayPeriod: request.halfDayPeriod,
            startDate: request.startDate,
            endDate: request.endDate,
            startTime: request.startTime,
            endTime: request.endTime,
            days: request.days,
            hours: request.hours,
            reason: request.reason,
            attachments: request.attachments,
            status: request.status,
            createdAt: request.createdAt,
            employee: {
                id: request.user._id.toString(),
                name: `${request.user.firstname} ${request.user.lastname}`,
                position: request.userPosition || '',
                avatar: request.user.profile,
            },
        };
    }

    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid ID format');
        }
    }
}

export default LeaveRequestService;