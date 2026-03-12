import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import instagramRoutes from './routes/instagram.js';
import adsRoutes from './routes/ads.js';
import webhookRoutes from './routes/webhook.js';
import automationRoutes from './routes/automationRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Trust proxy for ngrok/load balancers
app.set('trust proxy', 1);

console.log('🚀 SERVER STARTING IN:', process.cwd());
// Global Request Logger (Super Debug)
app.use((req, res, next) => {
    console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Security middleware
app.use(helmet());

// Allow both local dev and ngrok origins for CORS
const allowedOrigins = [
    'http://localhost:3000',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token']
}));

// Rate limiting (increased for development)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'development' ? 1000 : 100,
    message: { success: false, error: 'Too many requests' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DEBUG PROOF OF LIFE
app.get('/test-live-code', (req, res) => {
    res.send('<h1>I AM RUNNING THE NEW CODE 🔥</h1>');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/automation', automationRoutes);

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 infini8Graph API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
