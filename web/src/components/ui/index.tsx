'use client';

import React, { forwardRef } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
    return (
        <div className={`card ${className}`} {...props}>
            {children}
        </div>
    );
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function CardHeader({ children, className = '', ...props }: CardHeaderProps) {
    return (
        <div className={`card-header ${className}`} {...props}>
            {children}
        </div>
    );
}

interface CardTitleProps {
    children: React.ReactNode;
    subtitle?: string;
}

export function CardTitle({ children, subtitle }: CardTitleProps) {
    return (
        <div>
            <h3 className="card-title">{children}</h3>
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
    );
}

interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function CardBody({ children, className = '', ...props }: CardBodyProps) {
    return (
        <div className={`card-body ${className}`} {...props}>
            {children}
        </div>
    );
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function CardFooter({ children, className = '', ...props }: CardFooterProps) {
    return (
        <div className={`card-footer ${className}`} {...props}>
            {children}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// BUTTON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    block?: boolean;
    children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ variant = 'primary', size = 'md', isLoading, block, children, className = '', disabled, ...props }, ref) => {
        const variantClass = variant === 'primary' ? 'btn-primary' :
            variant === 'secondary' ? 'btn-secondary' :
                variant === 'ghost' ? 'btn-ghost' :
                    variant === 'danger' ? 'btn-danger' : '';

        const sizeClass = size === 'sm' ? 'btn-sm' :
            size === 'lg' ? 'btn-lg' : '';

        return (
            <button
                ref={ref}
                className={`btn ${variantClass} ${sizeClass} ${block ? 'btn-block' : ''} ${className}`}
                disabled={disabled || isLoading}
                {...props}
            >
                {isLoading ? (
                    <>
                        <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        Loading...
                    </>
                ) : children}
            </button>
        );
    }
);

Button.displayName = 'Button';

// ═══════════════════════════════════════════════════════════════════════════
// INPUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    hint?: string;
    error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, hint, error, className = '', ...props }, ref) => {
        return (
            <div className="form-group">
                {label && <label className="form-label">{label}</label>}
                <input
                    ref={ref}
                    className={`input ${error ? 'input-error' : ''} ${className}`}
                    {...props}
                />
                {hint && !error && <p className="form-hint">{hint}</p>}
                {error && <p className="form-hint" style={{ color: 'var(--danger)' }}>{error}</p>}
            </div>
        );
    }
);

Input.displayName = 'Input';

// ═══════════════════════════════════════════════════════════════════════════
// TEXTAREA COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    hint?: string;
    error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, hint, error, className = '', ...props }, ref) => {
        return (
            <div className="form-group">
                {label && <label className="form-label">{label}</label>}
                <textarea
                    ref={ref}
                    className={`input ${error ? 'input-error' : ''} ${className}`}
                    {...props}
                />
                {hint && !error && <p className="form-hint">{hint}</p>}
                {error && <p className="form-hint" style={{ color: 'var(--danger)' }}>{error}</p>}
            </div>
        );
    }
);

Textarea.displayName = 'Textarea';

// ═══════════════════════════════════════════════════════════════════════════
// TOGGLE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ToggleProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
}

export function Toggle({ checked, onChange, disabled, label }: ToggleProps) {
    return (
        <label className="toggle" style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <input
                type="checkbox"
                className="toggle-input"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
            />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
            {label && <span style={{ marginLeft: 'var(--space-3)', fontWeight: 500 }}>{label}</span>}
        </label>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECKBOX COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface CheckboxProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
    label?: string;
}

export function Checkbox({ checked, onChange, disabled, label }: CheckboxProps) {
    return (
        <label className="checkbox" style={{ opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <input
                type="checkbox"
                className="checkbox-input"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
            />
            <span className="checkbox-box">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            </span>
            {label && <span style={{ fontWeight: 500, fontSize: 'var(--text-base)' }}>{label}</span>}
        </label>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHIP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface ChipProps {
    children: React.ReactNode;
    onRemove?: () => void;
}

export function Chip({ children, onRemove }: ChipProps) {
    return (
        <span className="chip">
            {children}
            {onRemove && (
                <button type="button" className="chip-remove" onClick={onRemove} aria-label="Remove">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'primary';

interface BadgeProps {
    variant?: BadgeVariant;
    pill?: boolean;
    children: React.ReactNode;
}

export function Badge({ variant = 'primary', pill, children }: BadgeProps) {
    const variantClass = `badge-${variant}`;
    return (
        <span className={`badge ${variantClass} ${pill ? 'badge-pill' : ''}`}>
            {children}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// SPINNER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
}

export function Spinner({ size = 'md' }: SpinnerProps) {
    const sizeClass = size === 'lg' ? 'spinner-lg' : '';
    const sizeStyle = size === 'sm' ? { width: 16, height: 16, borderWidth: 2 } : {};
    return <div className={`spinner ${sizeClass}`} style={sizeStyle} />;
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST HOOK
// ═══════════════════════════════════════════════════════════════════════════

interface ToastProps {
    type: 'success' | 'error' | 'info';
    message: string;
}

export function Toast({ type, message }: ToastProps) {
    const typeClass = type === 'success' ? 'toast-success' :
        type === 'error' ? 'toast-error' : 'toast-info';

    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';

    return (
        <div className={`toast ${typeClass}`}>
            <span>{icon}</span>
            <span>{message}</span>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY STATE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface EmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="empty-state">
            {icon && <div className="empty-state-icon">{icon}</div>}
            <p className="empty-state-title">{title}</p>
            {description && <p className="empty-state-description">{description}</p>}
            {action && <div style={{ marginTop: 'var(--space-4)' }}>{action}</div>}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE HEADER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, icon, actions }: PageHeaderProps) {
    return (
        <div className="page-header flex items-center justify-between">
            <div className="flex items-center gap-4">
                {icon && <div className="page-icon">{icon}</div>}
                <div>
                    <h1 className="page-title">{title}</h1>
                    {subtitle && <p className="page-subtitle">{subtitle}</p>}
                </div>
            </div>
            {actions}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING PAGE
// ═══════════════════════════════════════════════════════════════════════════

interface LoadingPageProps {
    text?: string;
}

export function LoadingPage({ text = 'Loading...' }: LoadingPageProps) {
    return (
        <div className="flex items-center justify-center" style={{ height: '100vh', background: 'var(--background)' }}>
            <div className="text-center">
                <Spinner size="lg" />
                <p className="text-muted mt-4">{text}</p>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOLTIP COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface TooltipProps {
    children: React.ReactNode;
    content: string;
}

export function Tooltip({ children, content }: TooltipProps) {
    return (
        <span className="tooltip-container">
            <span className="tooltip-trigger">
                {children}
            </span>
            <span className="tooltip-content">
                {content}
            </span>
        </span>
    );
}

export function InfoIcon() {
    return (
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ opacity: 0.5 }}>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
        </svg>
    );
}
