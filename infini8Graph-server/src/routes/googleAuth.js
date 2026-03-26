import express from 'express';
import * as googleAuthController from '../controllers/googleAuthController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ==================== AUTH ====================
router.get('/login', authenticate, googleAuthController.login);
router.get('/callback', googleAuthController.callback);
router.get('/status', authenticate, googleAuthController.getStatus);
router.post('/disconnect', authenticate, googleAuthController.disconnect);

// ==================== ADS DATA ====================
router.get('/ads-performance', authenticate, googleAuthController.getAdsPerformanceData);
router.get('/campaigns', authenticate, googleAuthController.getCampaigns);
router.get('/budget', authenticate, googleAuthController.getBudget);
router.get('/keywords', authenticate, googleAuthController.getKeywords);
router.get('/creatives', authenticate, googleAuthController.getCreatives);
router.get('/cross-platform', authenticate, googleAuthController.getCrossPlatform);
router.get('/alerts', authenticate, googleAuthController.getAlerts);

export default router;
