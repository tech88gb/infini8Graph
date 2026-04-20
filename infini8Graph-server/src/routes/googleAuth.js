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
router.get('/auction-insights', authenticate, googleAuthController.getAuctionInsightsData);
router.get('/search-terms', authenticate, googleAuthController.getSearchTerms);
router.get('/quality-score', authenticate, googleAuthController.getQualityScore);
router.get('/assets', authenticate, googleAuthController.getAssetData);
router.get('/bidding', authenticate, googleAuthController.getBiddingData);
router.get('/geo', authenticate, googleAuthController.getGeoData);
router.get('/local-presence', authenticate, googleAuthController.getLocalPresenceData);
router.get('/accounts', authenticate, googleAuthController.getAccounts);
router.post('/update-account', authenticate, googleAuthController.updateAccount);

export default router;
