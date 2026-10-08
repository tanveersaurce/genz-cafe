import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { partnerController } from './partner.controller';

const router = Router();
router.use(authenticate);

// Partners
router.get('/', authorize('partners:view'), partnerController.listPartners);
router.get('/summary', authorize('partners:view'), partnerController.getSummary);
router.get('/:id', authorize('partners:view'), partnerController.getPartner);
router.post('/', authorize('partners:manage'), partnerController.createPartner);
router.patch('/:id', authorize('partners:manage'), partnerController.updatePartner);

// Shares
router.get('/shares/current', authorize('partners:view'), partnerController.getCurrentShares);
router.get('/shares/history', authorize('partners:view'), partnerController.listShareSchedules);
router.post('/shares', authorize('partners:manage'), partnerController.createShareSchedule);

// Capital
router.get('/capital', authorize('partners:view'), partnerController.listCapitalEntries);
router.post('/capital', authorize('partners:manage'), partnerController.createCapitalEntry);
router.post('/capital/:id/reverse', authorize('partners:manage'), partnerController.reverseCapitalEntry);

// Withdrawals
router.get('/withdrawals', authorize('partners:view'), partnerController.listWithdrawals);
router.post('/withdrawals', authorize('partners:manage'), partnerController.createWithdrawal);
router.post('/withdrawals/:id/reverse', authorize('partners:manage'), partnerController.reverseWithdrawal);

// Ledger
router.get('/:id/ledger', authorize('partners:view'), partnerController.getPartnerLedger);

export const partnerRoutes = router;
