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

interface SidebarAccount {
    id: string;
    username: string;
    name?: string | null;
    profile_picture_url?: string | null;
    followers_count?: number | null;
    is_active?: boolean;
    is_enabled?: boolean;
}

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
    const { user, logout, accounts, activeAccountId, switchAccount, connectMeta } = useAuth();
    const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [accountSearch, setAccountSearch] = useState('');

    const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts.find(a => a.is_active);
    const filteredAccounts = accounts.filter((account: SidebarAccount) => {
        const search = accountSearch.trim().toLowerCase();
        if (!search) return true;
        return [account.username, account.name]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(search);
    });

    const handleSwitchAccount = async (accountId: string) => {
        if (accountId === activeAccountId || switching) return;
        setSwitching(true);
        await switchAccount(accountId);
        setAccountDropdownOpen(false);
        setSwitching(false);
    };

    const handleAddAccount = () => {
        connectMeta().catch((error) => {
            console.error('Meta connect error:', error);
        });
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
            <aside 
                className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${!isCollapsed ? 'open' : ''}`}
                onClick={isCollapsed ? onToggle : undefined}
                style={{ cursor: isCollapsed ? 'pointer' : 'default' }}
            >
                {/* Header */}
                <div 
                    className="sidebar-header" 
                    style={{ 
                        flexDirection: isCollapsed ? 'column' : 'row',
                        gap: isCollapsed ? 16 : 0,
                        justifyContent: isCollapsed ? 'center' : 'space-between',
                        padding: isCollapsed ? '24px 0' : '24px 16px',
                        borderBottom: '1px solid var(--sidebar-border)'
                    }}
                >
                    <Link href="/dashboard" style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 12, 
                        textDecoration: 'none', 
                        color: 'inherit',
                        justifyContent: 'center'
                    }}>
                        <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: 18,
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                        }}>
                            ∞
                        </div>
                        {!isCollapsed && (
                            <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.04em', color: 'var(--foreground)' }}>infini8Graph</span>
                        )}
                    </Link>

                    {!isCollapsed && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle();
                            }}
                            style={{
                                padding: 6,
                                background: 'white',
                                border: '1px solid var(--border)',
                                color: 'var(--muted)',
                                cursor: 'pointer',
                                borderRadius: 6,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                        >
                            <ChevronLeft size={14} />
                        </button>
                    )}
                </div>

                {!isCollapsed && (
                    <div style={{ padding: '20px 16px 12px', position: 'relative' }}>
                        <button
                            onClick={() => setAccountDropdownOpen(!accountDropdownOpen)}
                            className="account-card"
                            style={{
                                width: '100%',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s ease',
                                borderRadius: 14,
                                border: '1px solid var(--border)',
                                background: 'var(--background-alt)',
                                padding: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12
                            }}
                        >
                            <div style={{ 
                                width: 36, 
                                height: 36, 
                                borderRadius: 10,
                                background: 'white', 
                                border: '1px solid var(--border)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                            }}>
                                {activeAccount?.profile_picture_url ? (
                                    <img
                                        src={activeAccount.profile_picture_url}
                                        alt=""
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <Instagram size={16} />
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                                    @{activeAccount?.username || user?.username || 'User'}
                                </div>
                                <div style={{ fontSize: 10, color: 'var(--success)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }}></div>
                                    Active
                                </div>
                            </div>
                            <ChevronDown
                                size={14}
                                style={{
                                    color: 'var(--muted)',
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
                                    background: 'white',
                                    border: '1px solid var(--border)',
                                    borderRadius: '16px',
                                    padding: '8px',
                                    zIndex: 100,
                                    boxShadow: 'var(--shadow-xl)',
                                    maxHeight: '350px',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <div style={{ flexShrink: 0, fontSize: 11, color: 'var(--sidebar-muted)', padding: '6px 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Switch Account
                                </div>
                                {accounts.length > 3 && (
                                    <input
                                        value={accountSearch}
                                        onChange={(e) => setAccountSearch(e.target.value)}
                                        placeholder="Search accounts..."
                                        style={{
                                            width: '100%',
                                            margin: '4px 0 6px',
                                            padding: '9px 10px',
                                            borderRadius: 'var(--radius-md)',
                                            border: '1px solid var(--sidebar-border)',
                                            background: 'rgba(255,255,255,0.04)',
                                            color: 'white',
                                            outline: 'none',
                                            fontSize: 12,
                                        }}
                                    />
                                )}

                                <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px', margin: '4px 0' }}>
                                    {filteredAccounts.length === 0 ? (
                                        <div style={{ padding: '14px 10px', color: 'var(--sidebar-muted)', fontSize: 12 }}>
                                            No accounts match that search.
                                        </div>
                                    ) : filteredAccounts.map((account: SidebarAccount) => (
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
                                                fontWeight: 700,
                                                color: 'var(--foreground)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                @{account.username}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontWeight: 500 }}>
                                                <span>{account.followers_count ? `${account.followers_count.toLocaleString()} followers` : 'Instagram'}</span>
                                                {account.id === activeAccountId && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Active</span>}
                                                {account.is_enabled === false && <span style={{ color: 'var(--warning)', fontWeight: 700 }}>Hidden</span>}
                                            </div>
                                        </div>
                                        {account.id === activeAccountId && (
                                            <Check size={16} style={{ color: '#6366f1' }} />
                                        )}
                                    </button>
                                    ))}
                                </div>

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
                                        borderTop: '1px solid var(--border)',
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
