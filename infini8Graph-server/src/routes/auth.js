import express from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ── Google Login (primary identity) ──────────────────────────
// Step 1: Returns Google OAuth URL
router.get('/login', authController.login);
// Step 2: Google redirects here after consent (GOOGLE_LOGIN_REDIRECT_URL must point here)
router.get('/google/callback', authController.googleCallback);

// ── Meta Setup (one-time, protected) ─────────────────────────
// Returns Meta OAuth URL (user must be logged in via Google first)
router.get('/meta/connect', authenticate, authController.metaConnect);
// Re-initiate Meta setup (change pages/accounts)
router.post('/meta/reconnect', authenticate, authController.metaReconnect);
// Meta OAuth redirects here after granting permissions (META_REDIRECT_URI must point here)
router.get('/callback', authController.callback);

// ── Session management ────────────────────────────────────────
router.post('/exchange', authController.exchangeCode);
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authenticate, authController.refreshToken);

// ── Multi-account management ──────────────────────────────────
router.get('/accounts', authenticate, authController.getAccounts);
router.patch('/accounts/:accountId/enabled', authenticate, authController.updateAccountEnabled);
router.post('/switch/:accountId', authenticate, authController.switchAccount);

export default router;
