import { Server, Socket } from 'socket.io';
import { AuthService } from '@services/auth.service';
import { logger } from '@utils/logger';

// Types

interface LeaveSocketData {
    userId: string;
    userRole: string;
    userName: string;
}

interface LeaveRequestInfo {
    id: string;
    requestNumber: string;
    leaveType: string;
    leaveTypeName: string;
    startDate: Date;
    endDate: Date;
    days: number;
    status: string;
    userName: string;
}

// State Management

// Store connected users for targeted notifications
// userId -> Set of socketIds (one user can have multiple connections)
const connectedUsers = new Map<string, Set<string>>();

// Store user roles for approver tracking
const userRoles = new Map<string, string>(); // userId -> role

// Socket Setup

export function setupLeaveSocket(io: Server): void {
    const leaveNamespace = io.of('/leave');
    const authService = new AuthService();

    // Authentication middleware for socket
    leaveNamespace.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;

            if (!token) {
                return next(new Error('Authentication required'));
            }

            // Remove 'Bearer ' prefix if present
            const cleanToken = String(token).startsWith('Bearer ')
                ? String(token).slice(7)
                : String(token);

            // Use AuthService directly to verify token and get user
            const user = await authService.verifyUserByToken(cleanToken);

            if (!user) {
                return next(new Error('Invalid token'));
            }

            // Attach user data to socket
            socket.data = {
                userId: user._id.toString(),
                userRole: user.role,
                userName: user.firstname
                    ? `${user.firstname} ${user.lastname || ''}`.trim()
                    : user.username,
            } as LeaveSocketData;

            next();
        } catch (error: any) {
            logger.error('Socket authentication failed:', error.message);

            if (error.message?.includes('expired')) {
                return next(new Error('Token expired'));
            }
            next(new Error('Authentication failed'));
        }
    });

    leaveNamespace.on('connection', (socket: Socket) => {
        const userData = socket.data as LeaveSocketData;

        logger.info(`Leave socket connected: ${userData.userId} (${socket.id})`);

        // Track connected user
        if (!connectedUsers.has(userData.userId)) {
            connectedUsers.set(userData.userId, new Set());
        }
        connectedUsers.get(userData.userId)!.add(socket.id);

        // Track user role
        userRoles.set(userData.userId, userData.userRole);

        // Join user's personal room for direct notifications
        socket.join(`user:${userData.userId}`);

        // Join role-based rooms for managers/admins
        if (['admin', 'manager'].includes(userData.userRole)) {
            socket.join('approvers');
            logger.debug(`User ${userData.userId} joined approvers room`);
        }

        // Room Subscriptions

        // Subscribe to specific leave request updates
        socket.on('subscribe:request', (requestId: string) => {
            socket.join(`request:${requestId}`);
            logger.debug(`User ${userData.userId} subscribed to request ${requestId}`);
        });

        socket.on('unsubscribe:request', (requestId: string) => {
            socket.leave(`request:${requestId}`);
            logger.debug(`User ${userData.userId} unsubscribed from request ${requestId}`);
        });

        // Subscribe to team updates (for managers)
        socket.on('subscribe:team', (teamId: string) => {
            if (['admin', 'manager'].includes(userData.userRole)) {
                socket.join(`team:${teamId}`);
                logger.debug(`Manager ${userData.userId} subscribed to team ${teamId}`);
            }
        });

        socket.on('unsubscribe:team', (teamId: string) => {
            socket.leave(`team:${teamId}`);
            logger.debug(`User ${userData.userId} unsubscribed from team ${teamId}`);
        });

        // Subscribe to department updates
        socket.on('subscribe:department', (departmentId: string) => {
            socket.join(`department:${departmentId}`);
            logger.debug(`User ${userData.userId} subscribed to department ${departmentId}`);
        });

        // Disconnect Handling

        socket.on('disconnect', (reason) => {
            logger.info(`Leave socket disconnected: ${userData.userId} (${socket.id}) - ${reason}`);

            // Remove from tracking
            const userSockets = connectedUsers.get(userData.userId);
            if (userSockets) {
                userSockets.delete(socket.id);
                if (userSockets.size === 0) {
                    connectedUsers.delete(userData.userId);
                    userRoles.delete(userData.userId);
                }
            }
        });

        // Error handling
        socket.on('error', (error) => {
            logger.error(`Leave socket error for user ${userData.userId}:`, error);
        });
    });

    logger.info('Leave socket namespace initialized at /leave');
}

// Event Types

export interface LeaveRequestCreatedEvent {
    request: LeaveRequestInfo;
    approvers: string[]; // User IDs of approvers
    teamId?: string;
    departmentId?: string;
}

export interface LeaveStatusUpdatedEvent {
    request: LeaveRequestInfo;
    userId: string; // Requester's user ID
    action: 'step_approved' | 'fully_approved' | 'rejected';
    approverName?: string;
    rejectedReason?: string;
    nextApprovers?: string[]; // For step approval
}

export interface LeaveRequestCancelledEvent {
    request: LeaveRequestInfo;
    approvers: string[]; // User IDs of approvers who were pending
}

export interface LeaveBalanceUpdatedEvent {
    userId: string;
    leaveType: string;
    leaveTypeName: string;
    previousBalance: number;
    newBalance: number;
    reason: string;
}

// Event Emitters

/**
 * Emit event when a new leave request is created
 * Notifies all designated approvers
 */
export function emitLeaveRequestCreated(io: Server, data: LeaveRequestCreatedEvent): void {
    const leaveNamespace = io.of('/leave');

    // Notify each approver individually
    for (const approverId of data.approvers) {
        leaveNamespace.to(`user:${approverId}`).emit('leave:request-created', {
            request: data.request,
            message: `ใบลาใหม่จาก ${data.request.userName}`,
            timestamp: new Date(),
        });
    }

    // Also emit to approvers room for dashboard updates
    leaveNamespace.to('approvers').emit('leave:new-pending', {
        request: data.request,
        timestamp: new Date(),
    });

    // Notify team if specified
    if (data.teamId) {
        leaveNamespace.to(`team:${data.teamId}`).emit('leave:team-request', {
            request: data.request,
            timestamp: new Date(),
        });
    }

    // Notify department if specified
    if (data.departmentId) {
        leaveNamespace.to(`department:${data.departmentId}`).emit('leave:department-request', {
            request: data.request,
            timestamp: new Date(),
        });
    }

    logger.debug(`Emitted leave:request-created for request ${data.request.requestNumber}`);
}

/**
 * Emit event when leave request status is updated
 * Notifies the requester and relevant parties
 */
export function emitLeaveStatusUpdated(io: Server, data: LeaveStatusUpdatedEvent): void {
    const leaveNamespace = io.of('/leave');

    // Build message based on action
    let message = '';
    let notificationType: 'success' | 'info' | 'error' = 'info';

    switch (data.action) {
        case 'fully_approved':
            message = `ใบลาของคุณได้รับการอนุมัติเรียบร้อยแล้ว`;
            notificationType = 'success';
            break;
        case 'step_approved':
            message = `ใบลาของคุณได้รับการอนุมัติจาก ${data.approverName || 'ผู้อนุมัติ'} แล้ว รอขั้นตอนถัดไป`;
            notificationType = 'info';
            break;
        case 'rejected':
            message = `ใบลาของคุณไม่ได้รับการอนุมัติ: ${data.rejectedReason || 'ไม่ระบุเหตุผล'}`;
            notificationType = 'error';
            break;
    }

    // Notify the requester
    leaveNamespace.to(`user:${data.userId}`).emit('leave:status-updated', {
        request: data.request,
        action: data.action,
        message,
        notificationType,
        approverName: data.approverName,
        rejectedReason: data.rejectedReason,
        timestamp: new Date(),
    });

    // Notify request subscribers (e.g., HR viewing the request)
    leaveNamespace.to(`request:${data.request.id}`).emit('leave:request-updated', {
        request: data.request,
        action: data.action,
        timestamp: new Date(),
    });

    // If step approved, notify next approvers
    if (data.action === 'step_approved' && data.nextApprovers) {
        for (const approverId of data.nextApprovers) {
            leaveNamespace.to(`user:${approverId}`).emit('leave:pending-approval', {
                request: data.request,
                message: `มีใบลารอการอนุมัติจาก ${data.request.userName}`,
                timestamp: new Date(),
            });
        }
    }

    // Update approvers dashboard
    leaveNamespace.to('approvers').emit('leave:pending-updated', {
        request: data.request,
        action: data.action,
        timestamp: new Date(),
    });

    logger.debug(`Emitted leave:status-updated for request ${data.request.requestNumber} - ${data.action}`);
}

/**
 * Emit event when leave request is cancelled
 * Notifies pending approvers
 */
export function emitLeaveRequestCancelled(io: Server, data: LeaveRequestCancelledEvent): void {
    const leaveNamespace = io.of('/leave');

    // Notify each pending approver
    for (const approverId of data.approvers) {
        leaveNamespace.to(`user:${approverId}`).emit('leave:request-cancelled', {
            request: data.request,
            message: `${data.request.userName} ยกเลิกใบลา`,
            timestamp: new Date(),
        });
    }

    // Notify request subscribers
    leaveNamespace.to(`request:${data.request.id}`).emit('leave:request-updated', {
        request: data.request,
        action: 'cancelled',
        timestamp: new Date(),
    });

    // Update approvers dashboard
    leaveNamespace.to('approvers').emit('leave:pending-updated', {
        request: data.request,
        action: 'cancelled',
        timestamp: new Date(),
    });

    logger.debug(`Emitted leave:request-cancelled for request ${data.request.requestNumber}`);
}

/**
 * Emit event when user's leave balance is updated
 * Notifies the user about balance changes
 */
export function emitLeaveBalanceUpdated(io: Server, data: LeaveBalanceUpdatedEvent): void {
    const leaveNamespace = io.of('/leave');

    leaveNamespace.to(`user:${data.userId}`).emit('leave:balance-updated', {
        leaveType: data.leaveType,
        leaveTypeName: data.leaveTypeName,
        previousBalance: data.previousBalance,
        newBalance: data.newBalance,
        reason: data.reason,
        timestamp: new Date(),
    });

    logger.debug(`Emitted leave:balance-updated for user ${data.userId}`);
}

/**
 * Broadcast message to all connected users
 * Use for system-wide announcements
 */
export function broadcastToAll(io: Server, event: string, data: any): void {
    const leaveNamespace = io.of('/leave');
    leaveNamespace.emit(event, {
        ...data,
        timestamp: new Date(),
    });
    logger.debug(`Broadcast ${event} to all users`);
}

// Utility Functions

/**
 * Get online status for a user
 */
export function isUserOnline(userId: string): boolean {
    return connectedUsers.has(userId) && connectedUsers.get(userId)!.size > 0;
}

/**
 * Get count of online users
 */
export function getOnlineUserCount(): number {
    return connectedUsers.size;
}

/**
 * Get list of online user IDs
 */
export function getOnlineUsers(): string[] {
    return Array.from(connectedUsers.keys());
}

/**
 * Get list of online approvers (managers/admins)
 */
export function getOnlineApprovers(): string[] {
    const approvers: string[] = [];
    for (const [userId, role] of userRoles.entries()) {
        if (['admin', 'manager'].includes(role) && isUserOnline(userId)) {
            approvers.push(userId);
        }
    }
    return approvers;
}

/**
 * Get socket count for a specific user
 */
export function getUserSocketCount(userId: string): number {
    const sockets = connectedUsers.get(userId);
    return sockets ? sockets.size : 0;
}

/**
 * Send direct message to a specific user
 */
export function sendToUser(io: Server, userId: string, event: string, data: any): void {
    const leaveNamespace = io.of('/leave');
    leaveNamespace.to(`user:${userId}`).emit(event, {
        ...data,
        timestamp: new Date(),
    });
}

// Export

export default {
    setupLeaveSocket,
    emitLeaveRequestCreated,
    emitLeaveStatusUpdated,
    emitLeaveRequestCancelled,
    emitLeaveBalanceUpdated,
    broadcastToAll,
    isUserOnline,
    getOnlineUserCount,
    getOnlineUsers,
    getOnlineApprovers,
    getUserSocketCount,
    sendToUser,
};