'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState('Processing login...');

    useEffect(() => {
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        console.log('Auth Callback Params:', { token: token ? 'Present' : 'Missing', error });

        if (error) {
            setStatus(`Error: ${error}`);
            setTimeout(() => router.push('/login'), 3000);
            return;
        }

        if (token) {
            console.log('Setting auth cookie...');
            // Store the token in a cookie (client-side for dev)
            const isSecure = window.location.protocol === 'https:';
            Cookies.set('auth_token', token, {
                expires: 7,
                secure: isSecure,
                sameSite: 'Lax',
                path: '/'
            });

            // Backup: Save to localStorage as well
            localStorage.setItem('auth_token', token);

            setStatus('Login successful! Token received.');

            // Verify immediate save
            const saved = localStorage.getItem('auth_token');
            if (saved) {
                console.log('Token successfully saved to localStorage');
            } else {
                console.error('Failed to save to localStorage');
            }

        } else {
            console.warn('No token found in URL params');
            setStatus('No token received');
        }
    }, [searchParams, router]);

    const handleContinue = () => {
        router.push('/dashboard');
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--background)' }}>
            <div className="text-center">
                <div className="text-2xl font-bold mb-4">{status}</div>
                <div className="text-[var(--muted)] mb-4 font-mono text-xs max-w-md break-all p-4 bg-black/10 rounded">
                    {searchParams.get('token') ? 'Token received' : 'No token'}
                </div>

                {searchParams.get('token') && (
                    <button
                        onClick={handleContinue}
                        className="btn px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Continue to Dashboard
                    </button>
                )}

                <div className="mt-4">
                    <button onClick={() => router.push('/login')} className="text-sm text-[var(--muted)] hover:underline">
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="spinner mb-4"></div>
                    <p>Processing Authentication...</p>
                </div>
            </div>
        }>
            <AuthCallbackContent />
        </Suspense>
    );
}

