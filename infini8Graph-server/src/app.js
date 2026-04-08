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
import googleAuthRoutes from './routes/googleAuth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Trust proxy for ngrok/load balancers
app.set('trust proxy', 1);


if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        const skipPaths = ['/api/automation/activity', '/api/automation/rules', '/health'];
        if (!skipPaths.some((p) => req.originalUrl.startsWith(p))) {
            console.log(`📡 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
        }
        next();
    });
}

// Security middleware
app.use(helmet());

// Allow both local dev and ngrok origins for CORS
const allowedOrigins = [
    'http://localhost:3000',
    'https://graph.infini8.org',
    'https://infini8graph.vercel.app',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Auth-Token', 'ngrok-skip-browser-warning']
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/automation', automationRoutes);
app.use('/api/google/auth', googleAuthRoutes);

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
    console.log(`Server listening on port ${PORT}`);
});

export default app;
