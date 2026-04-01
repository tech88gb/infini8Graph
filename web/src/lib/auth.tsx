'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { authApi } from './api';

interface User {
    userId: string;
    instagramUserId: string;
    username: string;
}

interface Account {
    id: string;
    instagram_user_id: string;
    username: string;
    name: string;
    profile_picture_url: string | null;
    followers_count: number;
    is_active: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    accounts: Account[];
    activeAccountId: string | null;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    switchAccount: (accountId: string) => Promise<boolean>;
    refreshAccounts: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
    const authChecked = useRef(false);

    const refreshAccounts = useCallback(async () => {
        try {
            const response = await authApi.getAccounts();
            if (response.data.success) {
                setAccounts(response.data.accounts || []);
                setActiveAccountId(response.data.activeAccountId || null);
            }
        } catch (err) {
            console.error('Failed to fetch accounts:', err);
        }
    }, []);

    const checkAuth = async () => {
        // Check for token in URL (from OAuth redirect)
        if (typeof window !== 'undefined') {
            console.log('🔥 CURRENT URL:', window.location.href);
            const params = new URLSearchParams(window.location.search);
            const tokenFromUrl = params.get('token');

            if (tokenFromUrl) {
                console.log('Got token from URL, saving...');
                const Cookies = (await import('js-cookie')).default;
                Cookies.set('auth_token', tokenFromUrl, { path: '/', sameSite: 'Lax' });
                localStorage.setItem('auth_token', tokenFromUrl);

                // Clean URL without refresh
                window.history.replaceState({}, '', window.location.pathname);

                // If this page is running inside the OAuth popup, notify the
                // parent window and close — the parent will do a full reload.
                if (window.opener && !window.opener.closed) {
                    window.opener.postMessage({ type: 'OAUTH_SUCCESS' }, window.location.origin);
                    window.close();
                    return; // Don't continue auth check in the popup
                }
            }
        }

        // Only check auth once
        if (authChecked.current) return;
        authChecked.current = true;

        try {
            const response = await authApi.getMe();

            if (response.data.success) {
                setUser(response.data.user);
                // Fetch accounts after successful auth
                await refreshAccounts();
            } else {
                setUser(null);
            }
        } catch (err) {
            console.error('Auth Check Failed:', err);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async () => {
        try {
            // Open popup synchronously to avoid browser popup blockers
            const width = 600;
            const height = 700;
            const left = Math.round((screen.width - width) / 2);
            const top = Math.round((screen.height - height) / 2);

            const popup = window.open(
                '',
                'facebook_oauth',
                `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
            );

            const response = await authApi.getLoginUrl();
            if (!response.data.success) {
                if (popup) popup.close();
                return;
            }

            const loginUrl = response.data.loginUrl;

            if (!popup) {
                // Fallback: if popup was blocked, do a full redirect
                window.location.href = loginUrl;
                return;
            }

            // Navigate the open window
            popup.location.href = loginUrl;

            // Listen for the callback page to post a message when auth is done
            const handleMessage = async (event: MessageEvent) => {
                if (event.data?.type === 'OAUTH_SUCCESS') {
                    window.removeEventListener('message', handleMessage);
                    clearInterval(pollTimer);
                    popup.close();
                    window.location.reload();
                }
            };
            window.addEventListener('message', handleMessage);

            // Fallback poll
            const pollTimer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(pollTimer);
                    window.removeEventListener('message', handleMessage);
                    window.location.reload();
                }
            }, 800);

        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };


    const logout = async () => {
        try {
            await authApi.logout();
        } catch {
            // Ignore logout errors
        }
        setUser(null);
        setAccounts([]);
        setActiveAccountId(null);
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
    };

    const switchAccount = async (accountId: string): Promise<boolean> => {
        try {
            const response = await authApi.switchAccount(accountId);
            if (response.data.success) {
                // Update token
                const Cookies = (await import('js-cookie')).default;
                Cookies.set('auth_token', response.data.jwt, { path: '/', sameSite: 'Lax' });
                localStorage.setItem('auth_token', response.data.jwt);

                // Update user context
                setUser({
                    userId: user?.userId || '',
                    instagramUserId: response.data.account.id,
                    username: response.data.account.username
                });

                setActiveAccountId(accountId);

                // Refresh accounts to update is_active flags
                await refreshAccounts();

                // Reload to refresh dashboard data with new account
                window.location.reload();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Switch account error:', error);
            return false;
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            accounts,
            activeAccountId,
            login,
            logout,
            checkAuth,
            switchAccount,
            refreshAccounts
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
