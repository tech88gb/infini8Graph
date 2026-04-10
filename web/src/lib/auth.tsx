'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import Cookies from 'js-cookie';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from './api';

interface User {
    userId: string;
    googleEmail: string | null;
    metaConnected: boolean;
    instagramUserId: string | null;
    username: string | null;
}

interface Account {
    id: string;
    instagram_user_id: string;
    username: string;
    name: string;
    profile_picture_url: string | null;
    followers_count: number;
    is_active: boolean;
    is_enabled: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    accounts: Account[];
    activeAccountId: string | null;
    login: () => Promise<void>;
    connectMeta: () => Promise<void>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    switchAccount: (accountId: string) => Promise<boolean>;
    refreshAccounts: () => Promise<void>;
    syncSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
    const authChecked = useRef(false);

    const clearSessionState = useCallback(() => {
        setUser(null);
        setAccounts([]);
        setActiveAccountId(null);
    }, []);

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

    const syncSession = useCallback(async () => {
        try {
            const response = await authApi.getMe();

            if (response.data.success && response.data.user) {
                const apiUser = response.data.user;
                setUser({
                    userId: apiUser.userId || apiUser.id,
                    googleEmail: apiUser.googleEmail || null,
                    metaConnected: apiUser.metaConnected === true,
                    instagramUserId: apiUser.instagramUserId || null,
                    username: apiUser.username || null
                });
                await refreshAccounts();
            } else {
                clearSessionState();
            }
        } catch (err) {
            console.error('Session sync failed:', err);
            clearSessionState();
        }

        await queryClient.invalidateQueries();
        await queryClient.refetchQueries({ type: 'active' });
    }, [clearSessionState, queryClient, refreshAccounts]);

    const checkAuth = useCallback(async () => {
        // Only check auth once
        if (authChecked.current) return;
        authChecked.current = true;

        try {
            const response = await authApi.getMe();

            if (response.data.success && response.data.user) {
                const apiUser = response.data.user;
                setUser({
                    userId: apiUser.userId || apiUser.id,
                    googleEmail: apiUser.googleEmail || null,
                    metaConnected: apiUser.metaConnected === true,
                    instagramUserId: apiUser.instagramUserId || null,
                    username: apiUser.username || null
                });
                // Fetch accounts after successful auth
                await refreshAccounts();
            } else {
                clearSessionState();
            }
        } catch (err) {
            console.error('Auth Check Failed:', err);
            clearSessionState();
        } finally {
            setLoading(false);
        }
    }, [clearSessionState, refreshAccounts]);

    const login = async () => {
        try {
            const response = await authApi.getLoginUrl();
            if (!response.data.success) return;

            // User explicitly requested full-page redirect in same tab
            window.location.href = response.data.loginUrl;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const connectMeta = async () => {
        const response = user?.metaConnected
            ? await authApi.reconnectMeta()
            : await authApi.connectMeta();

        if (!response.data.success || !response.data.loginUrl) {
            throw new Error(response.data.error || 'Failed to start Meta connection');
        }

        window.location.href = response.data.loginUrl;
    };


    const logout = async () => {
        try {
            await authApi.logout();
        } catch {
            // Ignore logout errors
        }
        clearSessionState();
        localStorage.removeItem('auth_token');
        Cookies.remove('auth_token', { path: '/' });
        queryClient.clear();
        window.location.href = '/login';
    };

    const switchAccount = async (accountId: string): Promise<boolean> => {
        try {
            const response = await authApi.switchAccount(accountId);
            if (response.data.success) {
                await syncSession();
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
    }, [checkAuth]);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            accounts,
            activeAccountId,
            login,
            connectMeta,
            logout,
            checkAuth,
            switchAccount,
            refreshAccounts,
            syncSession
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
