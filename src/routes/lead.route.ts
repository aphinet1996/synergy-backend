import { Router } from 'express';
import { authenticate } from '@middlewares/auth.middleware';
import { validateQuery, validateParams, validateBody } from '@middlewares/validation.middleware';
import leadController from '@controllers/lead.controller';
import leadValidation from '@validations/lead.validation';

const router = Router();

router.use(authenticate);

// GET /lead - List (filtered by clinics user is assigned to)
router.get(
    '/',
    validateQuery(leadValidation.list),
    leadController.getLeads
);

// GET /lead/patient/search - Proxy to lead-api GET /patients/search
router.get(
    '/patient/search',
    validateQuery(leadValidation.searchPatient),
    leadController.searchPatients
);

// GET /lead/patient/check-tel - Proxy to lead-api GET /patients/check-tel
router.get(
    '/patient/check-tel',
    validateQuery(leadValidation.checkTel),
    leadController.checkPhoneDuplicate
);

// GET /lead/setting/options - Proxy to lead-api GET /options/clinics/:clinicId
router.get(
    '/setting/options',
    validateQuery(leadValidation.settingOptions),
    leadController.getSettingOptions
);

// POST /lead/upload/slip — Proxy to lead-api POST /uploads/slip
router.post(
    '/upload/slip',
    leadController.uploadSlip
);

// POST /lead/upload/receipt — Proxy to lead-api POST /uploads/receipt
router.post(
    '/upload/receipt',
    leadController.uploadReceipt
);

// GET /lead/:id/history
router.get(
    '/:id/history',
    validateParams(leadValidation.param),
    leadController.getLeadHistory
);

// PUT /lead/:id/arrived - แก้ไขหัตถการย้อนหลัง (เฉพาะ status arrived)
router.put(
    '/:id/arrived',
    validateParams(leadValidation.param),
    validateBody(leadValidation.editArrived),
    leadController.editArrivedLead
);

// GET /lead/:id
router.get(
    '/:id',
    validateParams(leadValidation.param),
    leadController.getLead
);

// POST /lead - Create
router.post(
    '/',
    validateBody(leadValidation.create),
    leadController.createLead
);

// PUT /lead/:id - Update
router.put(
    '/:id',
    validateParams(leadValidation.param),
    validateBody(leadValidation.update),
    leadController.updateLead
);

// DELETE /lead/:id
router.delete(
    '/:id',
    validateParams(leadValidation.param),
    leadController.deleteLead
);

export default router;