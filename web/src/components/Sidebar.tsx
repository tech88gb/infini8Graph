'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
    LayoutDashboard,
    TrendingUp,
    Heart,
    Film,
    Clock,
    Hash,
    Download,
    Settings,
    LogOut,
    ChevronLeft,
    Menu,
    X,
    Megaphone,
    Instagram,
    Lightbulb,
    Bot,
    ChevronDown,
    Check,
    Plus,
    Globe,
    BarChart2
} from 'lucide-react';

const navSections = [
    {
        title: 'Analytics',
        items: [
            { href: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
            { href: '/unified', icon: Globe, label: 'Unified' },
            { href: '/growth', icon: TrendingUp, label: 'Growth' },
            { href: '/engagement', icon: Heart, label: 'Engagement' },
            { href: '/reels', icon: Film, label: 'Reels' },
            { href: '/best-time', icon: Clock, label: 'Best Time' },
            { href: '/hashtags', icon: Hash, label: 'Hashtags' },
            { href: '/insights', icon: Lightbulb, label: 'Content Intel' },
        ]
    },
    {
        title: 'Advertising',
        items: [
            { href: '/ads', icon: Megaphone, label: 'Meta Ads' },
            { href: '/google-ads', icon: BarChart2, label: 'Google Ads' },
        ]
    },
    {
        title: 'Automation',
        items: [
            { href: '/automation', icon: Bot, label: 'Auto-Reply' },
        ]
    },
    {
        title: 'Tools',
        items: [
            { href: '/export', icon: Download, label: 'Export' },
            { href: '/settings', icon: Settings, label: 'Settings' },
        ]
    }
];

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const { user, logout, accounts, activeAccountId, switchAccount, login } = useAuth();
    const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
    const [switching, setSwitching] = useState(false);

    const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts.find(a => a.is_active);

    const handleSwitchAccount = async (accountId: string) => {
        if (accountId === activeAccountId || switching) return;
        setSwitching(true);
        await switchAccount(accountId);
        setAccountDropdownOpen(false);
        setSwitching(false);
    };

    const handleAddAccount = () => {
        login();
    };

    return (
        <>
            {/* Mobile Menu Button */}
            <button
                onClick={onToggle}
                className="mobile-menu-btn"
                aria-label="Toggle Menu"
            >
                {isCollapsed ? <Menu size={20} /> : <X size={20} />}
            </button>

            {/* Overlay for mobile */}
            <div
                className={`sidebar-overlay ${!isCollapsed ? 'visible' : ''}`}
                onClick={onToggle}
            />

            {/* Sidebar */}
            <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${!isCollapsed ? 'open' : ''}`}>
                {/* Header */}
                <div className="sidebar-header">
                    <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' }}>
                        <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #5b5ce2 0%, #7c5cff 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 700,
                            fontSize: 16,
                            boxShadow: '0 10px 24px rgba(96,91,255,0.22)'
                        }}>
                            ∞
                        </div>
                        {!isCollapsed && (
                            <span style={{ fontWeight: 600, fontSize: 16 }}>infini8Graph</span>
                        )}
                    </Link>

                    <button
                        onClick={onToggle}
                        style={{
                            padding: 6,
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--sidebar-muted)',
                            cursor: 'pointer',
                            borderRadius: 4,
                            display: isCollapsed ? 'none' : 'flex'
                        }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                </div>

                {/* Account Switcher */}
                {!isCollapsed && (
                    <div style={{ padding: '12px 12px 0', position: 'relative' }}>
                        <button
                            onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                            className="account-card"
                            style={{
                                width: '100%',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.15s ease',
                                borderRadius: 16,
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.02))'}
                        >
                            <div className="account-avatar">
                                {activeAccount?.profile_picture_url ? (
                                    <img
                                        src={activeAccount.profile_picture_url}
                                        alt=""
                                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <Instagram size={16} />
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    @{activeAccount?.username || user?.username || 'User'}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--sidebar-active)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 1 }}>
                                    {accounts.length > 1 ? 'Click to Switch • Active' : 'Instagram Business'}
                                </div>
                            </div>
                            <ChevronDown
                                size={16}
                                style={{
                                    color: 'var(--sidebar-muted)',
                                    transform: accountDropdownOpen ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.2s'
                                }}
                            />
                        </button>

                        {/* Dropdown */}
                        {accountDropdownOpen && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 12,
                                    right: 12,
                                    marginTop: 4,
                                    background: 'rgba(11,16,32,0.98)',
                                    border: '1px solid var(--sidebar-border)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: 'var(--space-2)',
                                    zIndex: 100,
                                    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
                                    backdropFilter: 'blur(18px)'
                                }}
                            >
                                <div style={{ fontSize: 11, color: 'var(--sidebar-muted)', padding: '6px 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Switch Account
                                </div>

                                {accounts.map((account: any) => (
                                    <button
                                        key={account.id}
                                        onClick={() => handleSwitchAccount(account.id)}
                                        disabled={switching}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px',
                                            background: account.id === activeAccountId ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: switching ? 'wait' : 'pointer',
                                            textAlign: 'left',
                                            transition: 'background 0.15s ease',
                                            opacity: switching ? 0.6 : 1
                                        }}
                                        onMouseOver={(e) => {
                                            if (account.id !== activeAccountId)
                                                e.currentTarget.style.background = 'var(--sidebar-hover)'
                                        }}
                                        onMouseOut={(e) => {
                                            if (account.id !== activeAccountId)
                                                e.currentTarget.style.background = 'transparent'
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: '50%',
                                                background: account.profile_picture_url ? 'transparent' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {account.profile_picture_url ? (
                                                <img
                                                    src={account.profile_picture_url}
                                                    alt=""
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <span style={{ color: 'white', fontWeight: 600, fontSize: 12 }}>
                                                    {account.username?.[0]?.toUpperCase() || '?'}
                                                </span>
                                            )}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 13,
                                                fontWeight: 500,
                                                color: 'white',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                @{account.username}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--sidebar-muted)' }}>
                                                {account.followers_count ? `${account.followers_count.toLocaleString()} followers` : 'Instagram'}
                                            </div>
                                        </div>
                                        {account.id === activeAccountId && (
                                            <Check size={16} style={{ color: '#6366f1' }} />
                                        )}
                                    </button>
                                ))}

                                {/* Add Account Button */}
                                <button
                                    onClick={handleAddAccount}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '10px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        marginTop: 4,
                                        borderTop: '1px solid var(--sidebar-border)',
                                        paddingTop: 14
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--sidebar-hover)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <div
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: '50%',
                                            background: 'var(--sidebar-hover)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px dashed var(--sidebar-muted)'
                                        }}
                                    >
                                        <Plus size={14} style={{ color: 'var(--sidebar-muted)' }} />
                                    </div>
                                    <span style={{ fontSize: 13, color: 'var(--sidebar-muted)', fontWeight: 500 }}>
                                        Add another account
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation */}
                <nav className="sidebar-nav">
                    {navSections.map((section) => (
                        <div key={section.title} className="sidebar-section">
                            {!isCollapsed && (
                                <div className="sidebar-section-title">{section.title}</div>
                            )}
                            {section.items.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`nav-item ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`}
                                        title={isCollapsed ? item.label : undefined}
                                    >
                                        <item.icon size={18} />
                                        {!isCollapsed && <span>{item.label}</span>}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="sidebar-footer">
                    <button
                        onClick={logout}
                        className={`nav-item ${isCollapsed ? 'collapsed' : ''}`}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#f87171'
                        }}
                        title={isCollapsed ? 'Logout' : undefined}
                    >
                        <LogOut size={18} />
                        {!isCollapsed && <span>Logout</span>}
                    </button>
                </div>
            </aside>

            {/* Click outside to close dropdown */}
            {accountDropdownOpen && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 49 }}
                    onClick={() => setAccountDropdownOpen(false)}
                />
            )}
        </>
    );
}
