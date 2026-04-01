'use client';

import { useState } from 'react';
import { Instagram, BarChart3, TrendingUp, Zap, ArrowRight, Shield, Bot, Star } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

const features = [
    { icon: BarChart3, label: 'Deep Instagram Analytics', desc: 'Post-level metrics, reach, saves & engagement scores' },
    { icon: TrendingUp, label: 'Growth Intelligence', desc: 'Audience signals and trend forecasting in real time' },
    { icon: Zap, label: 'Google Ads Intelligence', desc: 'ROAS, wasted spend, and competitor threat analysis' },
    { icon: Bot, label: 'Automation Workflows', desc: 'Auto-reply to comments and DMs on autopilot' },
];

const stats = [
    { value: '12+', label: 'Analytics Modules' },
    { value: '2', label: 'Ad Platforms' },
    { value: '100%', label: 'API Official' },
];

export default function LoginPage() {
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setIsLoggingIn(true);
        setError(null);
        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                credentials: 'include',
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const data = await response.json();
            if (data.success && data.loginUrl) {
                window.location.href = data.loginUrl;
            } else {
                setError('Failed to get login URL');
                setIsLoggingIn(false);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Connection error. Is the backend running?');
            setIsLoggingIn(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            minHeight: '100vh',
            background: '#05070f',
            fontFamily: "'Inter', -apple-system, sans-serif",
            overflow: 'hidden',
        }}>
            {/* ───── LEFT PANEL ───── */}
            <div style={{
                flex: '0 0 58%',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '60px 72px',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                background: 'radial-gradient(ellipse 80% 60% at 30% 20%, rgba(99,102,241,0.14) 0%, transparent 60%), radial-gradient(ellipse 60% 60% at 70% 80%, rgba(139,92,246,0.10) 0%, transparent 55%), #05070f',
            }}>
                {/* Grid overlay */}
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.035,
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                    backgroundSize: '48px 48px',
                }} />

                {/* Glow orbs */}
                <div style={{ position: 'absolute', top: '-100px', left: '-80px', width: '480px', height: '480px', borderRadius: '50%', background: 'rgba(99,102,241,0.10)', filter: 'blur(80px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: '-80px', right: '-60px', width: '360px', height: '360px', borderRadius: '50%', background: 'rgba(139,92,246,0.09)', filter: 'blur(70px)', pointerEvents: 'none' }} />

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, maxWidth: '520px' }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '52px' }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '14px',
                            background: 'linear-gradient(135deg, #5b5ce2 0%, #7c5cff 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 12px 32px rgba(99,91,255,0.30)',
                            fontSize: '22px', fontWeight: 800, color: '#fff',
                        }}>∞</div>
                        <span style={{ fontSize: '22px', fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>infini8Graph</span>
                    </div>

                    {/* Headline */}
                    <h1 style={{ fontSize: '44px', fontWeight: 800, lineHeight: 1.12, color: '#ffffff', marginBottom: '18px', letterSpacing: '-1.2px' }}>
                        The intelligence layer<br />
                        <span style={{ background: 'linear-gradient(90deg, #a5b4fc, #c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            for cross-channel growth.
                        </span>
                    </h1>

                    <p style={{ fontSize: '17px', color: '#8e98b8', lineHeight: 1.7, marginBottom: '44px', maxWidth: '440px' }}>
                        Unified analytics, Google Ads intelligence, and automated workflows — built for creators, agencies, and brand teams.
                    </p>

                    {/* Stats row */}
                    <div style={{ display: 'flex', gap: '32px', marginBottom: '48px', paddingBottom: '44px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        {stats.map((s, i) => (
                            <div key={i}>
                                <div style={{ fontSize: '28px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>{s.value}</div>
                                <div style={{ fontSize: '13px', color: '#5c6888', marginTop: '2px', fontWeight: 500 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Features */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {features.map((f, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '11px', flexShrink: 0,
                                    background: 'rgba(99,102,241,0.10)',
                                    border: '1px solid rgba(99,102,241,0.18)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#818cf8',
                                }}>
                                    <f.icon size={18} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '2px' }}>{f.label}</div>
                                    <div style={{ fontSize: '13px', color: '#5c6888', lineHeight: 1.5 }}>{f.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Trust badges */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '40px', flexWrap: 'wrap' }}>
                        {['Official Meta Graph API', 'Official Google Ads API', 'AES-256 Encrypted'].map((badge, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 14px', borderRadius: '100px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                fontSize: '12px', color: '#8e98b8', fontWeight: 500,
                            }}>
                                <Shield size={12} style={{ color: '#818cf8' }} />
                                {badge}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ───── RIGHT PANEL ───── */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 40px',
                background: 'radial-gradient(ellipse 70% 50% at 60% 20%, rgba(99,102,241,0.07) 0%, transparent 60%), #05070f',
                position: 'relative',
            }}>
                {/* Top bar */}
                <div style={{ position: 'absolute', top: '28px', right: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Star size={13} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                    <span style={{ fontSize: '13px', color: '#5c6888', fontWeight: 500 }}>Trusted by agencies & creators</span>
                </div>

                <div style={{ width: '100%', maxWidth: '360px' }}>
                    {/* Header */}
                    <div style={{ marginBottom: '36px', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '10px', letterSpacing: '-0.4px' }}>
                            Connect your account
                        </h2>
                        <p style={{ fontSize: '15px', color: '#6b7694', lineHeight: 1.6 }}>
                            Sign in with Instagram to access your analytics, intelligence, and automation workspace.
                        </p>
                    </div>

                    {/* Card */}
                    <div style={{
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '20px',
                        padding: '32px',
                        boxShadow: '0 32px 80px rgba(0,0,0,0.32)',
                    }}>
                        {error && (
                            <div style={{
                                marginBottom: '20px', padding: '14px 16px', borderRadius: '12px',
                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                                color: '#fca5a5', fontSize: '14px', lineHeight: 1.5,
                            }}>
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleLogin}
                            disabled={isLoggingIn}
                            style={{
                                width: '100%', padding: '15px 20px',
                                borderRadius: '12px', border: 'none', cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                                background: isLoggingIn
                                    ? 'rgba(99,102,241,0.5)'
                                    : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                                color: '#fff', fontSize: '16px', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                boxShadow: isLoggingIn ? 'none' : '0 8px 32px rgba(99,102,241,0.28)',
                                transition: 'all 0.2s ease',
                                letterSpacing: '-0.1px',
                            }}
                        >
                            {isLoggingIn ? (
                                <>
                                    <div style={{
                                        width: '20px', height: '20px', borderRadius: '50%',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: '#fff',
                                        animation: 'spin 0.7s linear infinite',
                                    }} />
                                    Connecting…
                                </>
                            ) : (
                                <>
                                    <Instagram size={20} />
                                    Continue with Instagram
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                        <div style={{
                            marginTop: '20px', padding: '14px 16px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <p style={{ fontSize: '13px', color: '#5c6888', textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                                <span style={{ color: '#c7d0e8', fontWeight: 600 }}>Requirement:</span> You need an Instagram Business or Creator account connected to a Facebook Page.
                            </p>
                        </div>
                    </div>

                    <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#3d4560', lineHeight: 1.6 }}>
                        By continuing, you agree to our{' '}
                        <a href="#" style={{ color: '#6366f1', textDecoration: 'none' }}>Terms of Service</a>
                        {' '}and{' '}
                        <a href="#" style={{ color: '#6366f1', textDecoration: 'none' }}>Privacy Policy</a>
                    </p>
                </div>

                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );
}
