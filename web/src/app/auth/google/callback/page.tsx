'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function GoogleCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Connecting your Google Ads account...');

    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');
        const email = searchParams.get('email');

        if (error) {
            setStatus('error');
            setMessage(`Connection failed: ${decodeURIComponent(error)}`);
            // Redirect back to dashboard after 4 seconds
            setTimeout(() => router.push('/dashboard'), 4000);
            return;
        }

        if (success === 'true') {
            setStatus('success');
            setMessage(email
                ? `Successfully connected ${decodeURIComponent(email)}`
                : 'Google Ads account connected!'
            );
            // Redirect back to dashboard after 2 seconds
            setTimeout(() => router.push('/dashboard'), 2000);
            return;
        }

        // Fallback: no params at all
        setStatus('error');
        setMessage('Something went wrong. Redirecting back...');
        setTimeout(() => router.push('/dashboard'), 3000);
    }, [searchParams, router]);

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--background)',
            flexDirection: 'column',
            gap: 20,
        }}>
            {/* Icon */}
            <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
                background: status === 'success'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : status === 'error'
                        ? 'rgba(239, 68, 68, 0.12)'
                        : 'rgba(99, 102, 241, 0.12)',
                transition: 'background 0.3s ease',
            }}>
                {status === 'loading' && (
                    <div style={{
                        width: 32,
                        height: 32,
                        border: '3px solid rgba(99,102,241,0.2)',
                        borderTopColor: '#6366f1',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite',
                    }} />
                )}
                {status === 'success' && '✓'}
                {status === 'error' && '✕'}
            </div>

            {/* Message */}
            <div style={{ textAlign: 'center' }}>
                <h2 style={{
                    fontSize: 20,
                    fontWeight: 600,
                    marginBottom: 8,
                    color: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : 'var(--foreground)',
                }}>
                    {status === 'loading' ? 'Connecting Google Ads...' : status === 'success' ? 'Connected!' : 'Connection Failed'}
                </h2>
                <p style={{ color: 'var(--muted)', fontSize: 14 }}>{message}</p>
                {(status === 'success' || status === 'error') && (
                    <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8 }}>
                        Redirecting you back to the dashboard...
                    </p>
                )}
            </div>

            {/* Manual redirect button */}
            <button
                onClick={() => router.push('/dashboard')}
                style={{
                    padding: '10px 24px',
                    background: 'rgba(99,102,241,0.1)',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: 8,
                    color: '#6366f1',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 500,
                }}
            >
                Go to Dashboard
            </button>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

export default function GoogleCallbackPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p>Processing Google Authentication...</p>
                </div>
            </div>
        }>
            <GoogleCallbackContent />
        </Suspense>
    );
}
