/**
 * src/components/ui/index.tsx
 *
 * VYAYAMA PHYSIO — Design System Components
 * ──────────────────────────────────────────
 * All reusable primitives for the Vyayama brand.
 * Import from "@/components/ui"
 *
 * Components:
 *  - Button (primary | secondary | accent | ghost | danger)
 *  - Card
 *  - Input
 *  - Select (styled wrapper)
 *  - Badge / StatusBadge
 *  - Avatar
 *  - SectionHeader
 *  - EmptyState
 *  - Spinner
 *  - PageWrapper
 *  - TableWrapper
 */

"use client";

import React from "react";

// ─── Color Tokens (matches globals.css) ──────────────────────────────────────

export const tokens = {
  primary:        "#5B1A0E",
  primaryDark:    "#3A0F08",
  primaryLight:   "#7A2A1A",
  accent:         "#D46A2E",
  accentSoft:     "#F4A261",
  accentMuted:    "#FAD5B2",
  background:     "#F5F1E8",
  surface:        "#FFFFFF",
  surfaceAlt:     "#FBF8F3",
  border:         "#E8E0D0",
  borderStrong:   "#C8B8A8",
  textPrimary:    "#2B1B17",
  textSecondary:  "#7A6A64",
  textMuted:      "#A89990",
  success:        "#2D7A4F",
  successBg:      "#EAF5EE",
  error:          "#C0392B",
  errorBg:        "#FCECEA",
  warning:        "#B7650A",
  warningBg:      "#FEF3E2",
} as const;

// ─── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "danger";
type ButtonSize    = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  ButtonVariant;
  size?:     ButtonSize;
  loading?:  boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const BUTTON_STYLES: Record<ButtonVariant, React.CSSProperties & { hover?: React.CSSProperties }> = {
  primary: {
    background: tokens.primary,
    color: "#FFFFFF",
    border: `1px solid ${tokens.primaryDark}`,
  },
  secondary: {
    background: "transparent",
    color: tokens.primary,
    border: `1.5px solid ${tokens.primary}`,
  },
  accent: {
    background: tokens.accent,
    color: "#FFFFFF",
    border: `1px solid #B85A20`,
  },
  ghost: {
    background: "transparent",
    color: tokens.textSecondary,
    border: `1px solid ${tokens.border}`,
  },
  danger: {
    background: tokens.error,
    color: "#FFFFFF",
    border: `1px solid #A0302A`,
  },
};

const BUTTON_SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-6 py-3 text-sm rounded-2xl gap-2.5",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const baseStyle = BUTTON_STYLES[variant];
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      style={{
        ...baseStyle,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: fullWidth ? "100%" : undefined,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.55 : 1,
        transition: "all 150ms ease",
        whiteSpace: "nowrap",
        ...style,
      }}
      className={`${BUTTON_SIZE[size]} font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget;
        if (variant === "primary")   el.style.background = tokens.primaryDark;
        if (variant === "secondary") el.style.background = `${tokens.primary}10`;
        if (variant === "accent")    el.style.background = "#B85A20";
        if (variant === "ghost")     el.style.background = tokens.surfaceAlt;
        if (variant === "danger")    el.style.background = "#A0302A";
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return;
        e.currentTarget.style.background = baseStyle.background as string;
      }}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Spinner size="sm" color={variant === "secondary" || variant === "ghost" ? tokens.primary : "#fff"} />
          {children}
        </span>
      ) : (
        <>
          {leftIcon}
          {children}
          {rightIcon}
        </>
      )}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hoverable?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const CARD_PADDING = {
  none: "",
  sm:   "p-4",
  md:   "p-5",
  lg:   "p-6",
};

export function Card({
  children,
  className = "",
  padding = "md",
  hoverable = false,
  style,
  onClick,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl overflow-hidden
        ${CARD_PADDING[padding]}
        ${hoverable ? "cursor-pointer transition-all duration-200" : ""}
        ${className}
      `}
      style={{
        background: tokens.surface,
        border: `1px solid ${tokens.border}`,
        boxShadow: "0 1px 3px 0 rgba(91,26,14,0.06), 0 1px 2px -1px rgba(91,26,14,0.06)",
        ...(hoverable ? { transition: "all 200ms ease" } : {}),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (hoverable) {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 4px 12px 0 rgba(91,26,14,0.10), 0 2px 6px -1px rgba(91,26,14,0.08)";
          (e.currentTarget as HTMLElement).style.borderColor = tokens.borderStrong;
        }
      }}
      onMouseLeave={(e) => {
        if (hoverable) {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 1px 3px 0 rgba(91,26,14,0.06), 0 1px 2px -1px rgba(91,26,14,0.06)";
          (e.currentTarget as HTMLElement).style.borderColor = tokens.border;
        }
      }}
    >
      {children}
    </div>
  );
}

// ── Card Header / Body helpers ────────────────────────────────────────────────

export function CardHeader({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`px-5 py-4 flex items-center justify-between ${className}`}
      style={{ borderBottom: `1px solid ${tokens.border}` }}
    >
      {children}
    </div>
  );
}

export function CardBody({
  children,
  className = "",
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={`${padding ? "p-5" : ""} ${className}`}>
      {children}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:      string;
  error?:      string;
  leftIcon?:   React.ReactNode;
  rightIcon?:  React.ReactNode;
  helpText?:   string;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  helpText,
  className = "",
  id,
  ...props
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
          style={{ color: tokens.textSecondary }}
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: tokens.textMuted }}>
            {leftIcon}
          </div>
        )}
        <input
          id={inputId}
          className={`
            w-full rounded-xl px-4 py-3 text-sm font-medium
            transition-all duration-150 outline-none
            ${leftIcon ? "pl-10" : ""}
            ${rightIcon ? "pr-10" : ""}
            ${className}
          `}
          style={{
            background: tokens.surface,
            border: `1.5px solid ${error ? tokens.error : tokens.border}`,
            color: tokens.textPrimary,
            boxShadow: "0 1px 2px 0 rgba(91,26,14,0.04)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? tokens.error : tokens.accent;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? "rgba(192,57,43,0.12)" : "rgba(212,106,46,0.12)"}`;
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? tokens.error : tokens.border;
            e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(91,26,14,0.04)";
            props.onBlur?.(e);
          }}
          placeholder={props.placeholder}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2"
            style={{ color: tokens.textMuted }}>
            {rightIcon}
          </div>
        )}
      </div>
      {(error || helpText) && (
        <p
          className="text-xs mt-1.5 font-medium"
          style={{ color: error ? tokens.error : tokens.textMuted }}
        >
          {error ?? helpText}
        </p>
      )}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?:    string;
  error?:    string;
  helpText?: string;
}

export function Textarea({ label, error, helpText, className = "", id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
          style={{ color: tokens.textSecondary }}
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 outline-none resize-none ${className}`}
        style={{
          background: tokens.surface,
          border: `1.5px solid ${error ? tokens.error : tokens.border}`,
          color: tokens.textPrimary,
          boxShadow: "0 1px 2px 0 rgba(91,26,14,0.04)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = error ? tokens.error : tokens.accent;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${error ? "rgba(192,57,43,0.12)" : "rgba(212,106,46,0.12)"}`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? tokens.error : tokens.border;
          e.currentTarget.style.boxShadow = "0 1px 2px 0 rgba(91,26,14,0.04)";
        }}
        {...props}
      />
      {(error || helpText) && (
        <p className="text-xs mt-1.5 font-medium" style={{ color: error ? tokens.error : tokens.textMuted }}>
          {error ?? helpText}
        </p>
      )}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:    string;
  error?:    string;
  helpText?: string;
  options:   { value: string; label: string }[];
}

export function Select({ label, error, helpText, options, className = "", id, ...props }: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[11px] font-bold uppercase tracking-widest mb-1.5"
          style={{ color: tokens.textSecondary }}
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`w-full rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 outline-none appearance-none ${className}`}
        style={{
          background: `${tokens.surface} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237A6A64' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E") right 14px center / 12px no-repeat`,
          border: `1.5px solid ${error ? tokens.error : tokens.border}`,
          color: tokens.textPrimary,
          paddingRight: "40px",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = tokens.accent;
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(212,106,46,0.12)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? tokens.error : tokens.border;
          e.currentTarget.style.boxShadow = "none";
        }}
        {...props}
      >
        {options.map(({ value, label: optLabel }) => (
          <option key={value} value={value}>{optLabel}</option>
        ))}
      </select>
      {(error || helpText) && (
        <p className="text-xs mt-1.5 font-medium" style={{ color: error ? tokens.error : tokens.textMuted }}>
          {error ?? helpText}
        </p>
      )}
    </div>
  );
}

// ─── Badge / StatusBadge ──────────────────────────────────────────────────────

type BadgeVariant = "primary" | "accent" | "success" | "error" | "warning" | "neutral";

interface BadgeProps {
  variant?:  BadgeVariant;
  children:  React.ReactNode;
  dot?:      boolean;
  pulse?:    boolean;
  className?: string;
}

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string; border: string; dot: string }> = {
  primary: { bg: "#F0E8E5", color: tokens.primary,    border: "#DBC8C2", dot: tokens.primary },
  accent:  { bg: "#FEF0E6", color: tokens.accent,     border: "#F5C9A0", dot: tokens.accent },
  success: { bg: tokens.successBg, color: tokens.success, border: "#B5DFC7", dot: tokens.success },
  error:   { bg: tokens.errorBg,   color: tokens.error,   border: "#F0B9B4", dot: tokens.error },
  warning: { bg: tokens.warningBg, color: tokens.warning, border: "#F5CFA0", dot: tokens.warning },
  neutral: { bg: "#F5F1E8", color: tokens.textSecondary, border: tokens.border, dot: tokens.textMuted },
};

export function Badge({ variant = "neutral", children, dot = false, pulse = false, className = "" }: BadgeProps) {
  const s = BADGE_STYLES[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${className}`}
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {(dot || pulse) && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pulse ? "animate-pulse" : ""}`}
          style={{ background: s.dot }}
        />
      )}
      {children}
    </span>
  );
}

// Pre-configured status badge for appointments
export function AppointmentStatusBadge({ status, isNow }: { status: string; isNow?: boolean }) {
  if (isNow) {
    return (
      <Badge variant="warning" dot pulse>In Progress</Badge>
    );
  }
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    ATTENDED:  { variant: "success", label: "Attended" },
    MISSED:    { variant: "error",   label: "Missed" },
    CONFIRMED: { variant: "accent",  label: "Confirmed" },
    CANCELLED: { variant: "neutral", label: "Cancelled" },
  };
  const cfg = map[status] ?? map.CANCELLED;
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

// Pre-configured status badge for patients
export function PatientStatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    NEW:        { variant: "accent",  label: "New" },
    RETURNING:  { variant: "primary", label: "Returning" },
    DISCHARGED: { variant: "neutral", label: "Discharged" },
    INACTIVE:   { variant: "warning", label: "Inactive" },
  };
  const cfg = map[status] ?? map.INACTIVE;
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "#F0E8E5", color: "#5B1A0E" },
  { bg: "#FEF0E6", color: "#D46A2E" },
  { bg: "#FAF5FF", color: "#7C3AED" },
  { bg: "#EFF6FF", color: "#2563EB" },
  { bg: "#F0FDF4", color: "#16A34A" },
  { bg: "#FFF7ED", color: "#EA580C" },
];

interface AvatarProps {
  name:   string;
  size?:  "xs" | "sm" | "md" | "lg";
  shape?: "circle" | "rounded";
}

const AVATAR_SIZE = {
  xs: { dim: "w-6 h-6",  text: "text-[9px]" },
  sm: { dim: "w-8 h-8",  text: "text-[11px]" },
  md: { dim: "w-10 h-10", text: "text-xs" },
  lg: { dim: "w-12 h-12", text: "text-sm" },
};

export function Avatar({ name, size = "sm", shape = "rounded" }: AvatarProps) {
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const palette  = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const sz       = AVATAR_SIZE[size];
  const radius   = shape === "circle" ? "rounded-full" : "rounded-xl";

  return (
    <div
      className={`${sz.dim} ${sz.text} ${radius} flex items-center justify-center font-black flex-shrink-0`}
      style={{ background: palette.bg, color: palette.color }}
    >
      {initials}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title:     string;
  subtitle?: string;
  action?:   React.ReactNode;
  icon?:     React.ReactNode;
}

export function SectionHeader({ title, subtitle, action, icon }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${tokens.primary}12`, color: tokens.primary }}
          >
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight" style={{ color: tokens.textPrimary }}>
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm mt-0.5" style={{ color: tokens.textMuted }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?:     React.ReactNode;
  title:     string;
  subtitle?: string;
  action?:   React.ReactNode;
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      {icon && (
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: `${tokens.primary}0E`, color: `${tokens.primary}60` }}
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-bold" style={{ color: tokens.textSecondary }}>{title}</p>
      {subtitle && <p className="text-xs mt-1" style={{ color: tokens.textMuted }}>{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

export function Spinner({ size = "md", color }: { size?: "sm" | "md" | "lg"; color?: string }) {
  const dim = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-10 h-10" : "w-6 h-6";
  const borderW = size === "sm" ? "border-2" : "border-[3px]";
  return (
    <div
      className={`${dim} ${borderW} rounded-full animate-spin flex-shrink-0`}
      style={{
        borderColor: `${color ?? tokens.accent}30`,
        borderTopColor: color ?? tokens.accent,
      }}
    />
  );
}

// Full-page loading state
export function PageLoading({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: tokens.background }}
    >
      <Spinner size="lg" />
      <p className="text-sm font-medium" style={{ color: tokens.textMuted }}>{message}</p>
    </div>
  );
}

// ─── Page Wrapper ─────────────────────────────────────────────────────────────

export function PageWrapper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`min-h-screen ${className}`}
      style={{ background: tokens.background }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {children}
      </div>
    </div>
  );
}

// ─── Table Wrapper (responsive scrollable) ───────────────────────────────────

export function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <div className="min-w-full px-1">
        {children}
      </div>
    </div>
  );
}

// ─── Table Head Cell ─────────────────────────────────────────────────────────

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap"
      style={{
        background: tokens.surfaceAlt,
        color: tokens.textMuted,
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      {children}
    </th>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title:     string;
  value:     string | number;
  subtitle?: string;
  icon?:     React.ReactNode;
  active?:   boolean;
  onClick?:  () => void;
  accent?:   "primary" | "accent" | "error";
}

const STAT_ACCENT = {
  primary: { bg: tokens.primary, iconBg: `${tokens.primary}12`, iconColor: tokens.primary },
  accent:  { bg: tokens.accent,  iconBg: `${tokens.accent}12`,  iconColor: tokens.accent },
  error:   { bg: "#C0392B",      iconBg: "#FCECEA",             iconColor: "#C0392B" },
};

export function StatCard({ title, value, subtitle, icon, active = false, onClick, accent = "primary" }: StatCardProps) {
  const a = STAT_ACCENT[accent];

  return (
    <button
      onClick={onClick}
      className="text-left w-full rounded-2xl p-5 transition-all duration-200 border-2 focus:outline-none"
      style={{
        background: active ? a.bg : tokens.surface,
        borderColor: active ? a.bg : tokens.border,
        boxShadow: active
          ? `0 4px 16px 0 ${a.bg}35`
          : "0 1px 3px 0 rgba(91,26,14,0.06)",
        cursor: onClick ? "pointer" : "default",
      }}
      onMouseEnter={(e) => {
        if (!active && onClick) {
          (e.currentTarget as HTMLElement).style.borderColor = a.bg + "80";
          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px 0 rgba(91,26,14,0.10)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active && onClick) {
          (e.currentTarget as HTMLElement).style.borderColor = tokens.border;
          (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px 0 rgba(91,26,14,0.06)";
        }
      }}
    >
      {icon && (
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
          style={{
            background: active ? "rgba(255,255,255,0.20)" : a.iconBg,
            color: active ? "#FFFFFF" : a.iconColor,
          }}
        >
          {icon}
        </div>
      )}

      <p
        className="text-[10px] font-bold uppercase tracking-widest mb-1"
        style={{ color: active ? "rgba(255,255,255,0.65)" : tokens.textMuted }}
      >
        {title}
      </p>

      <p
        className="text-4xl font-black tracking-tight"
        style={{ color: active ? "#FFFFFF" : tokens.textPrimary }}
      >
        {value}
      </p>

      {subtitle && (
        <p
          className="text-xs font-semibold mt-2"
          style={{ color: active ? "rgba(255,255,255,0.65)" : tokens.textSecondary }}
        >
          {subtitle}
        </p>
      )}
    </button>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full h-px ${className}`}
      style={{ background: tokens.border }}
    />
  );
}