import express from 'express';
import * as adsController from '../controllers/adsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Test permissions
router.get('/test-permissions', adsController.testAdsPermissions);

// Ad accounts
router.get('/accounts', adsController.getAdAccounts);

// Detailed insights for an account
router.get('/accounts/:adAccountId/insights', adsController.getAdInsights);
router.get('/accounts/:adAccountId/demographics', adsController.getDemographics);
router.get('/accounts/:adAccountId/placements', adsController.getPlacements);
router.get('/accounts/:adAccountId/geography', adsController.getGeography);

// Campaigns
router.get('/accounts/:adAccountId/campaigns', adsController.getCampaigns);

// Ad Sets
router.get('/accounts/:adAccountId/adsets', adsController.getAdSets);

// Individual Ads
router.get('/accounts/:adAccountId/ads', adsController.getAds);

// Conversion Funnel Analytics
router.get('/accounts/:adAccountId/funnel', adsController.getConversionFunnel);

// Campaign Intelligence (deep analytics)
router.get('/accounts/:adAccountId/intelligence', adsController.getCampaignIntelligence);

// Advanced Analytics (Fatigue, LQS, Creative Forensics, Learning Phase)
router.get('/accounts/:adAccountId/advanced', adsController.getAdvancedAnalytics);

// Deep Insights (Per-campaign funnels, Bounce Gap, Video Hook Analysis, Placement Arbitrage)
router.get('/accounts/:adAccountId/deep-insights', adsController.getDeepInsights);

// Page insights
router.get('/page-insights', adsController.getPageInsights);

export default router;

