// import { Router } from 'express';
// import { authenticate, authorize } from '@middlewares/auth.middleware';
// import { validate } from '@middlewares/validation.middleware';
// import leaveValidation from '../validations/leave.validation';
// import {
//     leaveTypeController,
//     holidayController,
//     approvalFlowController,
//     leaveQuotaController,
//     leaveBalanceController,
//     leaveRequestController,
// } from '../controllers/leave.controller';

// const router = Router();

// // All routes require authentication
// router.use(authenticate);

// // Leave Type Routes (Admin only)
// router
//     .route('/types')
//     .get(leaveTypeController.getAll)
//     .post(
//         authorize('admin'),
//         validate(leaveValidation.createLeaveType),
//         leaveTypeController.create
//     );

// router.post(
//     '/types/seed',
//     authorize('admin'),
//     leaveTypeController.seedDefaults
// );

// router
//     .route('/types/:id')
//     .get(leaveTypeController.getById)
//     .put(
//         authorize('admin'),
//         validate(leaveValidation.updateLeaveType),
//         leaveTypeController.update
//     )
//     .delete(authorize('admin'), leaveTypeController.delete);

// // Holiday Routes
// router
//     .route('/holidays')
//     .get(holidayController.getAll)
//     .post(
//         authorize('admin'),
//         validate(leaveValidation.createHoliday),
//         holidayController.create
//     );

// router.get('/holidays/upcoming', holidayController.getUpcoming);

// router.post(
//     '/holidays/bulk',
//     authorize('admin'),
//     validate(leaveValidation.bulkHoliday),
//     holidayController.bulkImport
// );

// router.get('/holidays/year/:year', holidayController.getByYear);

// router.post(
//     '/holidays/year/:year/publish',
//     authorize('admin'),
//     holidayController.publishByYear
// );

// router.post(
//     '/holidays/year/:year/unpublish',
//     authorize('admin'),
//     holidayController.unpublishByYear
// );

// router
//     .route('/holidays/:id')
//     .get(holidayController.getById)
//     .put(
//         authorize('admin'),
//         validate(leaveValidation.updateHoliday),
//         holidayController.update
//     )
//     .delete(authorize('admin'), holidayController.delete);

// // Approval Flow Routes (Admin only)
// router
//     .route('/approval-flows')
//     .get(authorize('admin', 'manager'), approvalFlowController.getAll)
//     .post(
//         authorize('admin'),
//         validate(leaveValidation.createApprovalFlow),
//         approvalFlowController.create
//     );

// router.get(
//     '/approval-flows/position/:positionId',
//     authorize('admin', 'manager'),
//     approvalFlowController.getByPosition
// );

// router
//     .route('/approval-flows/:id')
//     .get(authorize('admin', 'manager'), approvalFlowController.getById)
//     .put(
//         authorize('admin'),
//         validate(leaveValidation.updateApprovalFlow),
//         approvalFlowController.update
//     )
//     .delete(authorize('admin'), approvalFlowController.delete);

// // Leave Quota Routes (Admin only)
// router.get('/quotas/year/:year', authorize('admin'), leaveQuotaController.getByYear);

// router.post(
//     '/quotas',
//     authorize('admin'),
//     validate(leaveValidation.createLeaveQuota),
//     leaveQuotaController.create
// );

// router.post('/quotas/copy', authorize('admin'), leaveQuotaController.copyToYear);

// router
//     .route('/quotas/:id')
//     .get(authorize('admin'), leaveQuotaController.getById)
//     .put(
//         authorize('admin'),
//         validate(leaveValidation.updateLeaveQuota),
//         leaveQuotaController.update
//     )
//     .delete(authorize('admin'), leaveQuotaController.delete);

// // Leave Balance Routes
// router.get('/balance', leaveBalanceController.getMyBalance);
// router.post('/balance/initialize', leaveBalanceController.initializeMyBalance);

// router.get(
//     '/balance/user/:userId',
//     authorize('admin', 'manager'),
//     leaveBalanceController.getUserBalance
// );

// router.post(
//     '/balance/initialize-all',
//     authorize('admin'),
//     leaveBalanceController.initializeAllUsers
// );

// // Leave Request Routes
// // Employee routes
// router
//     .route('/requests')
//     .get(leaveRequestController.getMyRequests)
//     .post(
//         validate(leaveValidation.createLeaveRequest),
//         leaveRequestController.create
//     );

// router.get('/requests/calendar', leaveRequestController.getCalendar);

// router.get('/requests/:id', leaveRequestController.getById);

// router.post(
//     '/requests/:id/cancel',
//     validate(leaveValidation.cancelLeaveRequest),
//     leaveRequestController.cancel
// );

// // Manager/Approver routes
// router.get(
//     '/requests/pending/approvals',
//     authorize('admin', 'manager'),
//     leaveRequestController.getPendingApprovals
// );

// router.post(
//     '/requests/:id/approve',
//     authorize('admin', 'manager'),
//     validate(leaveValidation.approveLeaveRequest),
//     leaveRequestController.approve
// );

// router.post(
//     '/requests/:id/reject',
//     authorize('admin', 'manager'),
//     validate(leaveValidation.rejectLeaveRequest),
//     leaveRequestController.reject
// );

// export default router;

import { Router } from 'express';
import { authenticate, authorize } from '@middlewares/auth.middleware';
import { validate } from '@middlewares/validation.middleware';
import leaveValidation from '../validations/leave.validation';
import {
    leaveTypeController,
    holidayController,
    approvalFlowController,
    leaveQuotaController,
    leaveBalanceController,
    leaveRequestController,
    leaveAdjustmentController,
} from '../controllers/leave.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Leave Type Routes (Admin only)
router
    .route('/types')
    .get(leaveTypeController.getAll)
    .post(
        authorize('admin'),
        validate(leaveValidation.createLeaveType),
        leaveTypeController.create
    );

router.post(
    '/types/seed',
    authorize('admin'),
    leaveTypeController.seedDefaults
);

router
    .route('/types/:id')
    .get(leaveTypeController.getById)
    .put(
        authorize('admin'),
        validate(leaveValidation.updateLeaveType),
        leaveTypeController.update
    )
    .delete(authorize('admin'), leaveTypeController.delete);

// Holiday Routes
router
    .route('/holidays')
    .get(holidayController.getAll)
    .post(
        authorize('admin'),
        validate(leaveValidation.createHoliday),
        holidayController.create
    );

router.get('/holidays/upcoming', holidayController.getUpcoming);

router.post(
    '/holidays/bulk',
    authorize('admin'),
    validate(leaveValidation.bulkHoliday),
    holidayController.bulkImport
);

router.get('/holidays/year/:year', holidayController.getByYear);

router.post(
    '/holidays/year/:year/publish',
    authorize('admin'),
    holidayController.publishByYear
);

router.post(
    '/holidays/year/:year/unpublish',
    authorize('admin'),
    holidayController.unpublishByYear
);

router
    .route('/holidays/:id')
    .get(holidayController.getById)
    .put(
        authorize('admin'),
        validate(leaveValidation.updateHoliday),
        holidayController.update
    )
    .delete(authorize('admin'), holidayController.delete);

// Approval Flow Routes (Admin only)
router
    .route('/approval-flows')
    .get(authorize('admin', 'manager'), approvalFlowController.getAll)
    .post(
        authorize('admin'),
        validate(leaveValidation.createApprovalFlow),
        approvalFlowController.create
    );

router.get(
    '/approval-flows/position/:positionId',
    authorize('admin', 'manager'),
    approvalFlowController.getByPosition
);

router
    .route('/approval-flows/:id')
    .get(authorize('admin', 'manager'), approvalFlowController.getById)
    .put(
        authorize('admin'),
        validate(leaveValidation.updateApprovalFlow),
        approvalFlowController.update
    )
    .delete(authorize('admin'), approvalFlowController.delete);

// Leave Quota Routes (Admin only)
router.get('/quotas/year/:year', authorize('admin'), leaveQuotaController.getByYear);

router.post(
    '/quotas',
    authorize('admin'),
    validate(leaveValidation.createLeaveQuota),
    leaveQuotaController.create
);

router.post('/quotas/copy', authorize('admin'), leaveQuotaController.copyToYear);

router
    .route('/quotas/:id')
    .get(authorize('admin'), leaveQuotaController.getById)
    .put(
        authorize('admin'),
        validate(leaveValidation.updateLeaveQuota),
        leaveQuotaController.update
    )
    .delete(authorize('admin'), leaveQuotaController.delete);

// Leave Balance Routes
router.get('/balance', leaveBalanceController.getMyBalance);
router.post('/balance/initialize', leaveBalanceController.initializeMyBalance);

router.get(
    '/balance/user/:userId',
    authorize('admin', 'manager'),
    leaveBalanceController.getUserBalance
);

router.post(
    '/balance/initialize-all',
    authorize('admin'),
    leaveBalanceController.initializeAllUsers
);

// NEW: Get all user balances (admin)
router.get(
    '/balances/all',
    authorize('admin'),
    leaveBalanceController.getAllBalances
);

// Leave Adjustment Routes (Admin only) - NEW
router.get(
    '/adjustments',
    authorize('admin'),
    leaveAdjustmentController.getAll
);

router.get(
    '/adjustments/pending',
    authorize('admin'),
    leaveAdjustmentController.getPending
);

router.get(
    '/adjustments/user/:userId',
    authorize('admin', 'manager'),
    leaveAdjustmentController.getByUser
);

router.post(
    '/adjustments',
    authorize('admin'),
    validate(leaveValidation.createAdjustment),
    leaveAdjustmentController.create
);

router.post(
    '/adjustments/transfer',
    authorize('admin'),
    validate(leaveValidation.transferDays),
    leaveAdjustmentController.transfer
);

router.post(
    '/adjustments/bulk-bonus',
    authorize('admin'),
    validate(leaveValidation.bulkBonus),
    leaveAdjustmentController.bulkBonus
);

router.get(
    '/adjustments/:id',
    authorize('admin', 'manager'),
    leaveAdjustmentController.getById
);

router.post(
    '/adjustments/:id/approve',
    authorize('admin'),
    leaveAdjustmentController.approve
);

router.post(
    '/adjustments/:id/reject',
    authorize('admin'),
    validate(leaveValidation.rejectAdjustment),
    leaveAdjustmentController.reject
);

// Leave Request Routes
// Employee routes
router
    .route('/requests')
    .get(leaveRequestController.getMyRequests)
    .post(
        validate(leaveValidation.createLeaveRequest),
        leaveRequestController.create
    );

router.get('/requests/calendar', leaveRequestController.getCalendar);

router.get('/requests/:id', leaveRequestController.getById);

router.post(
    '/requests/:id/cancel',
    validate(leaveValidation.cancelLeaveRequest),
    leaveRequestController.cancel
);

// Manager/Approver routes
router.get(
    '/requests/pending/count',
    authorize('admin', 'manager'),  // เฉพาะ admin/manager
    leaveRequestController.getPendingCount
);

router.get(
    '/requests/pending/approvals',
    authorize('admin', 'manager'),
    leaveRequestController.getPendingApprovals
);

router.post(
    '/requests/:id/approve',
    authorize('admin', 'manager'),
    validate(leaveValidation.approveLeaveRequest),
    leaveRequestController.approve
);

router.post(
    '/requests/:id/reject',
    authorize('admin', 'manager'),
    validate(leaveValidation.rejectLeaveRequest),
    leaveRequestController.reject
);

export default router;