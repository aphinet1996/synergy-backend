import mongoose from 'mongoose';
import LeaveBalance from '../models/leave-balance.model';
import LeaveQuota from '../models/leave-quota.model';
import LeaveType from '../models/leave-type.model';
import User from '@models/user.model';
import { ILeaveBalanceDoc, ILeaveBalanceItem, LeaveBalanceResponseDTO } from '../interfaces/leave-balance.interface';
import { NotFoundException, BadRequestException } from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

export class LeaveBalanceService {
    /**
     * Helper: Extract leaveType ID from either ObjectId or populated object
     */
    private getLeaveTypeId(leaveType: any): string {
        if (typeof leaveType === 'object' && leaveType._id) {
            return leaveType._id.toString();
        }
        return leaveType.toString();
    }

    /**
     * Get leave balance for a user
     */
    async getBalance(userId: string, year?: number): Promise<LeaveBalanceResponseDTO | null> {
        this.validateObjectId(userId);

        const targetYear = year || new Date().getFullYear();

        // Find or create balance
        let balance = await LeaveBalance.findByUserAndYear(
            new mongoose.Types.ObjectId(userId),
            targetYear
        );

        // If no balance exists, try to initialize from quota
        if (!balance) {
            balance = await this.initializeUserBalance(userId, targetYear);

            // ✅ FIX: If still no balance (no quota found), return null
            if (!balance) {
                logger.info(`No balance available for user ${userId} year ${targetYear} - quota not configured`);
                return null;
            }
        }

        // Get leave types for enriching response
        const leaveTypes = await LeaveType.find({ isActive: true });
        const leaveTypeMap = new Map(leaveTypes.map((lt) => [lt._id.toString(), lt]));

        // Build response
        const balancesWithDetails = balance.balances.map((b) => {
            // Handle both ObjectId and populated object
            const leaveTypeId = typeof b.leaveType === 'object' && b.leaveType._id
                ? b.leaveType._id.toString()
                : b.leaveType.toString();

            const leaveType = leaveTypeMap.get(leaveTypeId);

            // If leaveType was populated, use it directly
            const populatedLeaveType = typeof b.leaveType === 'object' && b.leaveType._id
                ? b.leaveType as any
                : null;

            return {
                leaveType: {
                    id: leaveTypeId,
                    code: b.leaveTypeCode || populatedLeaveType?.code || leaveType?.code || 'other',
                    name: b.leaveTypeName || populatedLeaveType?.name || leaveType?.name || 'Unknown',
                    color: populatedLeaveType?.color || leaveType?.color || '#6B7280',
                    icon: populatedLeaveType?.icon || leaveType?.icon,
                },
                total: b.total,
                used: b.used,
                pending: b.pending,
                remaining: b.remaining,
                carryOver: b.fromCarryOver || 0,
            };
        });

        const summary = {
            totalDays: balance.balances.reduce((sum, b) => sum + b.total, 0),
            usedDays: balance.balances.reduce((sum, b) => sum + b.used, 0),
            pendingDays: balance.balances.reduce((sum, b) => sum + b.pending, 0),
            remainingDays: balance.balances.reduce((sum, b) => sum + b.remaining, 0),
        };

        return {
            year: targetYear,
            balances: balancesWithDetails,
            summary,
        };
    }

    /**
     * Initialize balance for a user from quotas
     * Balance MUST come from quota - if no quota exists, cannot create balance
     */
    async initializeUserBalance(userId: string, year: number): Promise<ILeaveBalanceDoc | null> {
        this.validateObjectId(userId);

        const user = await User.findById(userId).select('positionId employeeType');
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // positionId is now ObjectId reference (or undefined)
        const positionId = user.positionId && mongoose.Types.ObjectId.isValid(user.positionId.toString())
            ? user.positionId.toString()
            : undefined;

        // Find applicable quota - this is REQUIRED
        const quota = await LeaveQuota.findQuotaForUser(
            year,
            positionId,
            user.employeeType
        );

        // ✅ FIX: If no quota exists, cannot create balance
        if (!quota) {
            logger.warn(`No quota found for user ${userId} (position: ${positionId}, employeeType: ${user.employeeType}) for year ${year}. Cannot initialize balance.`);
            return null;  // Return null instead of creating from defaultDays
        }

        // Build balances from quota
        const balances: ILeaveBalanceItem[] = quota.quotas.map((q) => ({
            leaveType: q.leaveType,
            leaveTypeCode: q.leaveTypeCode,
            leaveTypeName: '', // Will be populated from leaveType
            fromQuota: q.days,
            fromCarryOver: 0,
            fromAdjustment: 0,
            total: q.days,
            usedFromCarryOver: 0,
            usedFromQuota: 0,
            used: 0,
            pending: 0,
            remaining: q.days,
            history: [],
        }));

        // Populate leave type names
        for (const balance of balances) {
            const leaveType = await LeaveType.findById(balance.leaveType);
            if (leaveType) {
                balance.leaveTypeName = leaveType.name;
            }
        }

        logger.info(`Initialized balance for user ${userId} from quota for year ${year}`);

        return LeaveBalance.initializeForUser(
            new mongoose.Types.ObjectId(userId),
            year,
            balances
        );
    }

    /**
     * Deduct balance when leave request is submitted (to pending)
     */
    async deductPending(userId: string, leaveTypeId: string, days: number, year?: number): Promise<void> {
        this.validateObjectId(userId);
        this.validateObjectId(leaveTypeId);

        const targetYear = year || new Date().getFullYear();

        const balance = await LeaveBalance.findOrCreateForUser(
            new mongoose.Types.ObjectId(userId),
            targetYear
        );

        await balance.updateBalance(new mongoose.Types.ObjectId(leaveTypeId), days, true);
        logger.info(`Deducted ${days} pending days from user ${userId} for leave type ${leaveTypeId}`);
    }

    /**
     * Confirm pending balance as used (when approved)
     */
    async confirmPending(userId: string, leaveTypeId: string, days: number, year?: number): Promise<void> {
        this.validateObjectId(userId);
        this.validateObjectId(leaveTypeId);

        const targetYear = year || new Date().getFullYear();

        const balance = await LeaveBalance.findByUserAndYear(
            new mongoose.Types.ObjectId(userId),
            targetYear
        );

        if (!balance) {
            throw new NotFoundException('Leave balance not found');
        }

        await balance.confirmPending(new mongoose.Types.ObjectId(leaveTypeId), days);
        logger.info(`Confirmed ${days} pending days as used for user ${userId}`);
    }

    /**
     * Release pending balance (when cancelled or rejected)
     */
    async releasePending(userId: string, leaveTypeId: string, days: number, year?: number): Promise<void> {
        this.validateObjectId(userId);
        this.validateObjectId(leaveTypeId);

        const targetYear = year || new Date().getFullYear();

        const balance = await LeaveBalance.findByUserAndYear(
            new mongoose.Types.ObjectId(userId),
            targetYear
        );

        if (!balance) {
            throw new NotFoundException('Leave balance not found');
        }

        await balance.releaseBalance(new mongoose.Types.ObjectId(leaveTypeId), days, true);
        logger.info(`Released ${days} pending days for user ${userId}`);
    }

    /**
     * Release used balance (when approved request is cancelled after the fact)
     */
    async releaseUsed(userId: string, leaveTypeId: string, days: number, year?: number): Promise<void> {
        this.validateObjectId(userId);
        this.validateObjectId(leaveTypeId);

        const targetYear = year || new Date().getFullYear();

        const balance = await LeaveBalance.findByUserAndYear(
            new mongoose.Types.ObjectId(userId),
            targetYear
        );

        if (!balance) {
            throw new NotFoundException('Leave balance not found');
        }

        await balance.releaseBalance(new mongoose.Types.ObjectId(leaveTypeId), days, false);
        logger.info(`Released ${days} used days for user ${userId}`);
    }

    /**
     * Check if user has sufficient balance
     */
    async hasBalance(userId: string, leaveTypeId: string, days: number, year?: number): Promise<boolean> {
        this.validateObjectId(userId);
        this.validateObjectId(leaveTypeId);

        const targetYear = year || new Date().getFullYear();

        const balance = await LeaveBalance.findByUserAndYear(
            new mongoose.Types.ObjectId(userId),
            targetYear
        );

        if (!balance) {
            // Try to initialize from quota
            const newBalance = await this.initializeUserBalance(userId, targetYear);

            // ✅ FIX: If no quota found, user has no balance
            if (!newBalance) {
                logger.warn(`Cannot check balance for user ${userId} - no quota configured for year ${targetYear}`);
                return false;
            }

            const leaveBalance = newBalance.balances.find(
                (b) => this.getLeaveTypeId(b.leaveType) === leaveTypeId
            );
            return leaveBalance ? leaveBalance.remaining >= days : false;
        }

        const leaveBalance = balance.balances.find(
            (b) => this.getLeaveTypeId(b.leaveType) === leaveTypeId
        );

        return leaveBalance ? leaveBalance.remaining >= days : false;
    }

    /**
     * Initialize balances for all active users for a year
     * Only initializes if quota exists for the user
     */
    async initializeAllUsers(year: number): Promise<{ initialized: number; skipped: number }> {
        const users = await User.find({ isActive: true }).select('_id');
        let initialized = 0;
        let skipped = 0;

        for (const user of users) {
            try {
                const existing = await LeaveBalance.findByUserAndYear(
                    user._id as mongoose.Types.ObjectId,
                    year
                );
                if (!existing) {
                    const balance = await this.initializeUserBalance(user._id.toString(), year);
                    if (balance) {
                        initialized++;
                    } else {
                        skipped++; // No quota found for this user
                    }
                }
            } catch (error) {
                logger.error(`Failed to initialize balance for user ${user._id}:`, error);
                skipped++;
            }
        }

        logger.info(`Initialized leave balances: ${initialized} users initialized, ${skipped} skipped (no quota) for year ${year}`);
        return { initialized, skipped };
    }

    /**
     * Carry over remaining days from previous year
     */
    async carryOverFromPreviousYear(
        userId: string,
        year: number,
        maxCarryOver?: number
    ): Promise<void> {
        this.validateObjectId(userId);

        const previousYear = year - 1;
        const previousBalance = await LeaveBalance.findByUserAndYear(
            new mongoose.Types.ObjectId(userId),
            previousYear
        );

        if (!previousBalance) {
            return; // No previous balance to carry over
        }

        const currentBalance = await LeaveBalance.findOrCreateForUser(
            new mongoose.Types.ObjectId(userId),
            year
        );

        // Carry over annual leave only (or configurable)
        const annualLeaveType = await LeaveType.findByCode('annual');
        if (!annualLeaveType) return;

        const annualLeaveTypeId = annualLeaveType._id.toString();

        const previousAnnual = previousBalance.balances.find(
            (b) => this.getLeaveTypeId(b.leaveType) === annualLeaveTypeId
        );

        if (previousAnnual && previousAnnual.remaining > 0) {
            let carryOverDays = previousAnnual.remaining;
            if (maxCarryOver !== undefined) {
                carryOverDays = Math.min(carryOverDays, maxCarryOver);
            }

            const currentAnnualIndex = currentBalance.balances.findIndex(
                (b) => this.getLeaveTypeId(b.leaveType) === annualLeaveTypeId
            );

            if (currentAnnualIndex !== -1) {
                currentBalance.balances[currentAnnualIndex].fromCarryOver = carryOverDays;
                currentBalance.balances[currentAnnualIndex].total += carryOverDays;
                currentBalance.balances[currentAnnualIndex].remaining += carryOverDays;
                await currentBalance.save();

                logger.info(`Carried over ${carryOverDays} days for user ${userId} from ${previousYear} to ${year}`);
            }
        }
    }

    async getAllBalances(year: number): Promise<any[]> {
        const balances = await LeaveBalance.find({ year })
            .populate('user', 'firstname lastname employeeId positionId')
            .populate('balances.leaveType', 'name code color')
            .exec();

        return balances.map(balance => {
            const user = balance.user as any;
            return {
                id: user._id.toString(),
                _id: user._id.toString(),
                firstname: user.firstname,
                lastname: user.lastname,
                employeeId: user.employeeId,
                balances: balance.balances.map(b => ({
                    leaveType: b.leaveType,
                    total: b.total,
                    used: b.used,
                    pending: b.pending,
                    remaining: b.remaining,
                })),
            };
        });
    }

    private validateObjectId(id: string): void {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid ID format');
        }
    }
}

export default LeaveBalanceService;