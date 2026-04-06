'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push('/login');
            } else if (!user.metaConnected) {
                // Professional redirect: They are logged in but need the one-time Meta setup
                router.push('/connect-meta');
            }
        }
    }, [user, loading, router]);

    // Check for mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Load sidebar state from localStorage (desktop only)
    useEffect(() => {
        if (!isMobile) {
            const saved = localStorage.getItem('sidebar-collapsed');
            if (saved) {
                setSidebarCollapsed(JSON.parse(saved));
            }
        } else {
            setSidebarCollapsed(true); // Default closed on mobile
        }
    }, [isMobile]);

    const toggleSidebar = () => {
        const newState = !sidebarCollapsed;
        setSidebarCollapsed(newState);
        if (!isMobile) {
            localStorage.setItem('sidebar-collapsed', JSON.stringify(newState));
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, #050816 0%, #000212 100%)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                    <p className="text-muted">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user || !user.metaConnected) return null;

    return (
        <div>
            <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
            <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                {children}
            </main>
        </div>
    );
}
