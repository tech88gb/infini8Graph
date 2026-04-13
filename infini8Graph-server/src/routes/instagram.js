import express from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/overview', analyticsController.getOverview);
router.get('/overview-audience', analyticsController.getOverviewAudience);
router.get('/growth', analyticsController.getGrowth);
router.get('/best-time', analyticsController.getBestTime);
router.get('/hashtags', analyticsController.getHashtags);
router.get('/reels', analyticsController.getReels);
router.get('/posts', analyticsController.getPosts);
router.get('/export', analyticsController.exportData);
router.get('/content-intelligence', analyticsController.getContentIntelligence);
router.get('/unified-overview', analyticsController.getUnifiedOverview);

export default router;
