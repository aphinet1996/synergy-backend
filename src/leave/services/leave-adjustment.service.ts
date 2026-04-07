import mongoose from 'mongoose';
import LeaveAdjustment from '../models/leave-adjustment.model';
import LeaveBalance from '../models/leave-balance.model';
import LeaveType from '../models/leave-type.model';
import User from '@models/user.model';
import { ILeaveAdjustmentDoc, CreateAdjustmentDTO, AdjustmentType } from '../interfaces/leave-adjustment.interface';
import { IBalanceHistory } from '../interfaces/leave-balance.interface';
import { NotFoundException, BadRequestException, ForbiddenException } from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

export class LeaveAdjustmentService {
    /**
     * Create adjustment (HR ปรับยอด)
     */
    async create(data: CreateAdjustmentDTO, adjustedBy: string): Promise<ILeaveAdjustmentDoc> {
        this.validateObjectId(data.user);
        this.validateObjectId(data.leaveType);

        // Get user
        const user = await User.findById(data.user);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Get leave type
        const leaveType = await LeaveType.findById(data.leaveType);
        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        // Get current balance
        const balance = await LeaveBalance.findOrCreateForUser(
            new mongoose.Types.ObjectId(data.user),
            data.year
        );

        const balanceItem = balance.balances.find(
            (b) => b.leaveType.toString() === data.leaveType
        );

        if (!balanceItem) {
            throw new BadRequestException('Leave type not found in user balance');
        }

        const balanceBefore = balanceItem.remaining;
        const balanceAfter = balanceBefore + data.days;

        if (balanceAfter < 0) {
            throw new BadRequestException('Adjustment would result in negative balance');
        }

        // Create adjustment record
        const adjustment = await LeaveAdjustment.create({
            user: new mongoose.Types.ObjectId(data.user),
            year: data.year,
            leaveType: new mongoose.Types.ObjectId(data.leaveType),
            leaveTypeCode: leaveType.code,
            adjustmentType: data.adjustmentType,
            days: data.days,
            balanceBefore,
            balanceAfter,
            reason: data.reason,
            relatedUser: data.relatedUser ? new mongoose.Types.ObjectId(data.relatedUser) : undefined,
            sourceYear: data.sourceYear,
            expiryDate: data.expiryDate,
            adjustedBy: new mongoose.Types.ObjectId(adjustedBy),
            adjustedAt: new Date(),
            requiresApproval: false,
            status: 'approved',
        });

        // Update balance
        await this.applyAdjustmentToBalance(
            data.user,
            data.year,
            data.leaveType,
            data.days,
            data.adjustmentType,
            adjustment._id.toString(),
            adjustedBy,
            data.reason
        );

        logger.info(`Leave adjustment created: ${adjustment._id} for user ${data.user} by ${adjustedBy}`);
        return adjustment;
    }

    /**
     * Apply adjustment to balance with history tracking
     */
    private async applyAdjustmentToBalance(
        userId: string,
        year: number,
        leaveTypeId: string,
        days: number,
        adjustmentType: AdjustmentType,
        adjustmentId: string,
        performedBy: string,
        note: string
    ): Promise<void> {
        const balance = await LeaveBalance.findOne({
            user: new mongoose.Types.ObjectId(userId),
            year,
        });

        if (!balance) {
            throw new NotFoundException('Balance not found');
        }

        const balanceIndex = balance.balances.findIndex(
            (b) => b.leaveType.toString() === leaveTypeId
        );

        if (balanceIndex === -1) {
            throw new BadRequestException('Leave type not found in balance');
        }

        const item = balance.balances[balanceIndex];

        // Create history entry
        const historyEntry: IBalanceHistory = {
            action: 'adjustment',
            date: new Date(),
            before: {
                total: item.total,
                used: item.used,
                pending: item.pending,
                remaining: item.remaining,
            },
            after: {
                total: item.total + days,
                used: item.used,
                pending: item.pending,
                remaining: item.remaining + days,
            },
            days,
            adjustmentId: new mongoose.Types.ObjectId(adjustmentId),
            performedBy: new mongoose.Types.ObjectId(performedBy),
            note,
        };

        // Update balance
        if (adjustmentType === 'carry_over') {
            item.fromCarryOver += days;
        } else {
            item.fromAdjustment += days;
        }
        item.total += days;
        item.remaining += days;
        item.history.push(historyEntry);

        balance.lastUpdated = new Date();
        await balance.save();
    }

    /**
     * Get all adjustments (admin) - NEW
     */
    async findAll(year?: number): Promise<ILeaveAdjustmentDoc[]> {
        const query: any = {};
        if (year) query.year = year;

        return LeaveAdjustment.find(query)
            .populate('user', 'firstname lastname employeeId')
            .populate('leaveType', 'name code color')
            .populate('adjustedBy', 'firstname lastname')
            .populate('relatedUser', 'firstname lastname')
            .populate('approvedBy', 'firstname lastname')
            .sort({ adjustedAt: -1 })
            .exec();
    }

    /**
     * Get adjustments by user
     */
    async findByUser(userId: string, year?: number): Promise<ILeaveAdjustmentDoc[]> {
        this.validateObjectId(userId);
        return LeaveAdjustment.findByUser(new mongoose.Types.ObjectId(userId), year);
    }

    /**
     * Get adjustment by ID
     */
    async findById(id: string): Promise<ILeaveAdjustmentDoc> {
        this.validateObjectId(id);

        const adjustment = await LeaveAdjustment.findById(id)
            .populate('user', 'firstname lastname')
            .populate('leaveType', 'name code')
            .populate('adjustedBy', 'firstname lastname')
            .populate('approvedBy', 'firstname lastname');

        if (!adjustment) {
            throw new NotFoundException('Adjustment not found');
        }

        return adjustment;
    }

    /**
     * Transfer days between users
     */
    async transferDays(
        fromUserId: string,
        toUserId: string,
        leaveTypeId: string,
        days: number,
        year: number,
        reason: string,
        performedBy: string
    ): Promise<{ from: ILeaveAdjustmentDoc; to: ILeaveAdjustmentDoc }> {
        if (days <= 0) {
            throw new BadRequestException('Days must be positive');
        }

        if (fromUserId === toUserId) {
            throw new BadRequestException('Cannot transfer to the same user');
        }

        // Deduct from source user
        const fromAdjustment = await this.create(
            {
                user: fromUserId,
                year,
                leaveType: leaveTypeId,
                adjustmentType: 'transfer_out',
                days: -days,
                reason: `โอนให้พนักงานอื่น: ${reason}`,
                relatedUser: toUserId,
            },
            performedBy
        );

        // Add to target user
        const toAdjustment = await this.create(
            {
                user: toUserId,
                year,
                leaveType: leaveTypeId,
                adjustmentType: 'transfer_in',
                days: days,
                reason: `รับโอนจากพนักงานอื่น: ${reason}`,
                relatedUser: fromUserId,
            },
            performedBy
        );

        logger.info(`Leave transfer: ${days} days from ${fromUserId} to ${toUserId}`);
        return { from: fromAdjustment, to: toAdjustment };
    }

    /**
     * Bulk bonus (ให้โบนัสวันลาหลายคน)
     */
    async bulkBonus(
        userIds: string[],
        leaveTypeId: string,
        days: number,
        year: number,
        reason: string,
        performedBy: string
    ): Promise<number> {
        let count = 0;

        for (const userId of userIds) {
            try {
                await this.create(
                    {
                        user: userId,
                        year,
                        leaveType: leaveTypeId,
                        adjustmentType: 'bonus',
                        days,
                        reason,
                    },
                    performedBy
                );
                count++;
            } catch (error) {
                logger.error(`Failed to add bonus for user ${userId}:`, error);
            }
        }

        logger.info(`Bulk bonus: ${count}/${userIds.length} users received ${days} days`);
        return count;
    }

    /**
     * Get pending approvals (ถ้าต้องมีคน approve)
     */
    async findPendingApprovals(): Promise<ILeaveAdjustmentDoc[]> {
        return LeaveAdjustment.findPendingApprovals();
    }

    /**
     * Approve adjustment
     */
    async approve(adjustmentId: string, approvedBy: string): Promise<ILeaveAdjustmentDoc> {
        this.validateObjectId(adjustmentId);

        const adjustment = await LeaveAdjustment.findById(adjustmentId);
        if (!adjustment) {
            throw new NotFoundException('Adjustment not found');
        }

        if (adjustment.status !== 'pending') {
            throw new BadRequestException('Adjustment is not pending');
        }

        adjustment.status = 'approved';
        adjustment.approvedBy = new mongoose.Types.ObjectId(approvedBy);
        adjustment.approvedAt = new Date();
        await adjustment.save();

        // Apply to balance
        await this.applyAdjustmentToBalance(
            adjustment.user.toString(),
            adjustment.year,
            adjustment.leaveType.toString(),
            adjustment.days,
            adjustment.adjustmentType,
            adjustment._id.toString(),
            approvedBy,
            adjustment.reason
        );

        logger.info(`Adjustment ${adjustmentId} approved by ${approvedBy}`);
        return adjustment;
    }

    /**
     * Reject adjustment
     */
    async reject(adjustmentId: string, rejectedBy: string, reason: string): Promise<ILeaveAdjustmentDoc> {
        this.validateObjectId(adjustmentId);

        const adjustment = await LeaveAdjustment.findById(adjustmentId);
        if (!adjustment) {
            throw new NotFoundException('Adjustment not found');
        }

        if (adjustment.status !== 'pending') {
            throw new BadRequestException('Adjustment is not pending');
        }

        adjustment.status = 'rejected';
        await adjustment.save();

        logger.info(`Adjustment ${adjustmentId} rejected by ${rejectedBy}: ${reason}`);
        return adjustment;
    }

    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid ID format');
        }
    }
}

export default LeaveAdjustmentService;