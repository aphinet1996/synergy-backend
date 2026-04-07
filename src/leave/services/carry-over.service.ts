import mongoose from 'mongoose';
import CarryOverConfig from '../models/carry-over-config.model';
import LeaveBalance from '../models/leave-balance.model';
import LeaveType from '../models/leave-type.model';
import LeaveAdjustment from '../models/leave-adjustment.model';
import User from '@models/user.model';
import {
    ICarryOverConfigDoc,
    CreateCarryOverConfigDTO,
    CarryOverCalculationResult,
    CarryOverMethod,
    ExpiryRule
} from '../interfaces/carry-over-config.interface';
import { IBalanceHistory } from '../interfaces/leave-balance.interface';
import { NotFoundException, BadRequestException, ConflictException } from '@exceptions/HttpExcetion';
import { logger } from '@utils/logger';

export class CarryOverService {
    /**
     * Create carry over config
     */
    async createConfig(data: CreateCarryOverConfigDTO, createdBy: string): Promise<ICarryOverConfigDoc> {
        // Check duplicate
        const existing = await CarryOverConfig.findOne({
            year: data.year,
            leaveType: new mongoose.Types.ObjectId(data.leaveType),
            isActive: true,
        });

        if (existing) {
            throw new ConflictException('Carry over config already exists for this year and leave type');
        }

        // Get leave type code
        const leaveType = await LeaveType.findById(data.leaveType);
        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        const config = await CarryOverConfig.create({
            ...data,
            leaveType: new mongoose.Types.ObjectId(data.leaveType),
            leaveTypeCode: leaveType.code,
            eligiblePositions: data.eligiblePositions?.map((id) => new mongoose.Types.ObjectId(id)),
            createdBy: new mongoose.Types.ObjectId(createdBy),
        });

        logger.info(`Carry over config created for year ${data.year}, leave type ${leaveType.code}`);
        return config;
    }

    /**
     * Get configs by year
     */
    async findByYear(year: number): Promise<ICarryOverConfigDoc[]> {
        return CarryOverConfig.findByYear(year);
    }

    /**
     * Update config
     */
    async updateConfig(
        id: string,
        data: Partial<CreateCarryOverConfigDTO>,
        updatedBy: string
    ): Promise<ICarryOverConfigDoc> {
        const config = await CarryOverConfig.findById(id);
        if (!config) {
            throw new NotFoundException('Carry over config not found');
        }

        const updated = await CarryOverConfig.findByIdAndUpdate(
            id,
            { ...data, updatedBy: new mongoose.Types.ObjectId(updatedBy) },
            { new: true, runValidators: true }
        );

        if (!updated) {
            throw new NotFoundException('Update failed');
        }

        logger.info(`Carry over config ${id} updated by ${updatedBy}`);
        return updated;
    }

    /**
     * Delete config (soft delete)
     */
    async deleteConfig(id: string, deletedBy: string): Promise<boolean> {
        const config = await CarryOverConfig.findById(id);
        if (!config) {
            throw new NotFoundException('Carry over config not found');
        }

        config.isActive = false;
        config.updatedBy = new mongoose.Types.ObjectId(deletedBy);
        await config.save();

        logger.info(`Carry over config ${id} deleted by ${deletedBy}`);
        return true;
    }

    /**
     * Calculate carry over for a user
     */
    async calculateCarryOver(
        userId: string,
        fromYear: number,
        toYear: number,
        leaveTypeId: string
    ): Promise<CarryOverCalculationResult> {
        // Get config
        const config = await CarryOverConfig.findByYearAndLeaveType(
            toYear,
            new mongoose.Types.ObjectId(leaveTypeId)
        );

        if (!config || config.method === 'none') {
            return {
                eligible: false,
                reason: 'ไม่มีการยกยอดสำหรับประเภทการลานี้',
                originalRemaining: 0,
                carryOverAmount: 0,
            };
        }

        // Get user
        const user = await User.findById(userId);
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Check eligibility - service months
        if (config.minServiceMonths) {
            const startDate = user.employeeDateStart || user.createdAt;
            if (startDate) {
                const serviceMonths = this.calculateServiceMonths(startDate as Date);
                if (serviceMonths < config.minServiceMonths) {
                    return {
                        eligible: false,
                        reason: `ต้องทำงานอย่างน้อย ${config.minServiceMonths} เดือน (ปัจจุบัน ${serviceMonths} เดือน)`,
                        originalRemaining: 0,
                        carryOverAmount: 0,
                    };
                }
            }
        }

        // Check eligibility - position
        if (config.eligiblePositions && config.eligiblePositions.length > 0) {
            const positionMatch = config.eligiblePositions.some(
                (p) => p.toString() === user.positionId?.toString()
            );
            if (!positionMatch) {
                return {
                    eligible: false,
                    reason: 'ตำแหน่งไม่อยู่ในเกณฑ์ที่มีสิทธิ์ยกยอด',
                    originalRemaining: 0,
                    carryOverAmount: 0,
                };
            }
        }

        // Check eligibility - employee type
        if (config.eligibleEmployeeTypes && config.eligibleEmployeeTypes.length > 0) {
            if (!config.eligibleEmployeeTypes.includes(user.employeeType as any)) {
                return {
                    eligible: false,
                    reason: 'ประเภทพนักงานไม่อยู่ในเกณฑ์ที่มีสิทธิ์ยกยอด',
                    originalRemaining: 0,
                    carryOverAmount: 0,
                };
            }
        }

        // Get previous year balance
        const previousBalance = await LeaveBalance.findByUserAndYear(
            new mongoose.Types.ObjectId(userId),
            fromYear
        );

        if (!previousBalance) {
            return {
                eligible: false,
                reason: 'ไม่พบข้อมูลวันลาของปีก่อน',
                originalRemaining: 0,
                carryOverAmount: 0,
            };
        }

        const balanceItem = previousBalance.balances.find(
            (b) => b.leaveType.toString() === leaveTypeId
        );

        if (!balanceItem || balanceItem.remaining <= 0) {
            return {
                eligible: false,
                reason: 'ไม่มีวันลาเหลือในปีก่อน',
                originalRemaining: balanceItem?.remaining || 0,
                carryOverAmount: 0,
            };
        }

        // Calculate carry over amount based on method
        let carryOverAmount = 0;
        const originalRemaining = balanceItem.remaining;

        switch (config.method) {
            case 'all':
                carryOverAmount = originalRemaining;
                break;

            case 'fixed':
                carryOverAmount = Math.min(originalRemaining, config.maxDays || 0);
                break;

            case 'percentage':
                carryOverAmount = Math.floor(originalRemaining * (config.percentage || 0) / 100);
                break;

            case 'percentage_capped':
                const percentAmount = Math.floor(originalRemaining * (config.percentage || 0) / 100);
                carryOverAmount = Math.min(percentAmount, config.maxDays || 0);
                break;
        }

        // Calculate expiry date
        const expiryDate = this.calculateExpiryDate(toYear, config);

        return {
            eligible: true,
            originalRemaining,
            carryOverAmount,
            expiryDate,
        };
    }

    /**
     * Execute carry over for a user
     */
    async executeCarryOver(
        userId: string,
        fromYear: number,
        toYear: number,
        leaveTypeId: string,
        performedBy: string
    ): Promise<{ success: boolean; carryOverAmount: number; message: string }> {
        // Calculate
        const calculation = await this.calculateCarryOver(userId, fromYear, toYear, leaveTypeId);

        if (!calculation.eligible) {
            return {
                success: false,
                carryOverAmount: 0,
                message: calculation.reason || 'ไม่มีสิทธิ์ยกยอด',
            };
        }

        if (calculation.carryOverAmount <= 0) {
            return {
                success: false,
                carryOverAmount: 0,
                message: 'ไม่มีวันลาที่สามารถยกยอดได้',
            };
        }

        // Get leave type
        const leaveType = await LeaveType.findById(leaveTypeId);
        if (!leaveType) {
            throw new NotFoundException('Leave type not found');
        }

        // Create adjustment for carry over
        await LeaveAdjustment.create({
            user: new mongoose.Types.ObjectId(userId),
            year: toYear,
            leaveType: new mongoose.Types.ObjectId(leaveTypeId),
            leaveTypeCode: leaveType.code,
            adjustmentType: 'carry_over',
            days: calculation.carryOverAmount,
            balanceBefore: 0,
            balanceAfter: calculation.carryOverAmount,
            reason: `ยกยอดจากปี ${fromYear}`,
            sourceYear: fromYear,
            expiryDate: calculation.expiryDate,
            adjustedBy: new mongoose.Types.ObjectId(performedBy),
            adjustedAt: new Date(),
            status: 'approved',
        });

        // Update balance
        const balance = await LeaveBalance.findOrCreateForUser(
            new mongoose.Types.ObjectId(userId),
            toYear
        );

        const balanceIndex = balance.balances.findIndex(
            (b) => b.leaveType.toString() === leaveTypeId
        );

        if (balanceIndex !== -1) {
            const item = balance.balances[balanceIndex];

            // Add history
            const historyEntry: IBalanceHistory = {
                action: 'carry_over',
                date: new Date(),
                before: {
                    total: item.total,
                    used: item.used,
                    pending: item.pending,
                    remaining: item.remaining,
                },
                after: {
                    total: item.total + calculation.carryOverAmount,
                    used: item.used,
                    pending: item.pending,
                    remaining: item.remaining + calculation.carryOverAmount,
                },
                days: calculation.carryOverAmount,
                performedBy: new mongoose.Types.ObjectId(performedBy),
                note: `ยกยอดจากปี ${fromYear} (หมดอายุ: ${calculation.expiryDate ? calculation.expiryDate.toLocaleDateString('th-TH') : 'ไม่หมดอายุ'})`,
            };

            item.fromCarryOver += calculation.carryOverAmount;
            item.total += calculation.carryOverAmount;
            item.remaining += calculation.carryOverAmount;
            item.carryOverExpiryDate = calculation.expiryDate;
            item.history.push(historyEntry);

            balance.lastUpdated = new Date();
            await balance.save();
        }

        logger.info(`Carry over executed: ${calculation.carryOverAmount} days for user ${userId} from ${fromYear} to ${toYear}`);

        return {
            success: true,
            carryOverAmount: calculation.carryOverAmount,
            message: `ยกยอด ${calculation.carryOverAmount} วัน สำเร็จ`,
        };
    }

    /**
     * Execute carry over for all users
     */
    async executeCarryOverForAll(
        fromYear: number,
        toYear: number,
        leaveTypeId: string,
        performedBy: string
    ): Promise<{ total: number; success: number; failed: number }> {
        const users = await User.find({ isActive: true }).select('_id');
        let success = 0;
        let failed = 0;

        for (const user of users) {
            try {
                const result = await this.executeCarryOver(
                    user._id.toString(),
                    fromYear,
                    toYear,
                    leaveTypeId,
                    performedBy
                );
                if (result.success) {
                    success++;
                }
            } catch (error) {
                failed++;
                logger.error(`Carry over failed for user ${user._id}:`, error);
            }
        }

        logger.info(`Bulk carry over: ${success} success, ${failed} failed out of ${users.length} users`);
        return { total: users.length, success, failed };
    }

    /**
     * Process expired carry over (run daily via cron)
     */
    async processExpiredCarryOver(): Promise<number> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find balances with expired carry over
        const balances = await LeaveBalance.find({
            'balances.carryOverExpiryDate': { $lt: today },
            'balances.fromCarryOver': { $gt: 0 },
        });

        let processed = 0;

        for (const balance of balances) {
            for (const item of balance.balances) {
                if (item.carryOverExpiryDate && item.carryOverExpiryDate < today && item.fromCarryOver > 0) {
                    // Calculate how much carry over is still unused
                    const unusedCarryOver = item.fromCarryOver - item.usedFromCarryOver;

                    if (unusedCarryOver > 0) {
                        // Create expired adjustment
                        await LeaveAdjustment.create({
                            user: balance.user,
                            year: balance.year,
                            leaveType: item.leaveType,
                            adjustmentType: 'expired',
                            days: -unusedCarryOver,
                            balanceBefore: item.remaining,
                            balanceAfter: item.remaining - unusedCarryOver,
                            reason: 'วันลายกมาหมดอายุ',
                            adjustedBy: balance.user, // System
                            adjustedAt: new Date(),
                            status: 'approved',
                        });

                        // Update balance
                        const historyEntry: IBalanceHistory = {
                            action: 'carry_over_expired',
                            date: new Date(),
                            before: {
                                total: item.total,
                                used: item.used,
                                pending: item.pending,
                                remaining: item.remaining,
                            },
                            after: {
                                total: item.total - unusedCarryOver,
                                used: item.used,
                                pending: item.pending,
                                remaining: item.remaining - unusedCarryOver,
                            },
                            days: -unusedCarryOver,
                            note: 'วันลายกมาหมดอายุอัตโนมัติ',
                        };

                        item.fromCarryOver = item.usedFromCarryOver;
                        item.total -= unusedCarryOver;
                        item.remaining -= unusedCarryOver;
                        item.carryOverExpiryDate = undefined;
                        item.history.push(historyEntry);

                        processed++;
                    }
                }
            }
            await balance.save();
        }

        logger.info(`Processed ${processed} expired carry overs`);
        return processed;
    }

    // Helper Methods

    private calculateServiceMonths(startDate: Date): number {
        const now = new Date();
        const months = (now.getFullYear() - startDate.getFullYear()) * 12 +
            (now.getMonth() - startDate.getMonth());
        return Math.max(0, months);
    }

    private calculateExpiryDate(year: number, config: ICarryOverConfigDoc): Date | undefined {
        if (config.expiryRule === 'none') {
            return undefined;
        }

        const baseDate = new Date(year, 0, 1); // 1 Jan of target year

        switch (config.expiryRule) {
            case 'end_of_quarter':
                // End of Q1 (31 March)
                return new Date(year, 2, 31, 23, 59, 59);

            case 'end_of_half_year':
                // End of June (30 June)
                return new Date(year, 5, 30, 23, 59, 59);

            case 'fixed_months':
                const expiryMonths = config.expiryMonths || 3;
                const expiry = new Date(year, expiryMonths - 1, 0); // Last day of month
                return expiry;

            case 'fixed_date':
                return config.expiryDate;

            default:
                return undefined;
        }
    }
}

export default CarryOverService;