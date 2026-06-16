import type { ButtonHTMLAttributes, ReactNode } from "react";

type Tone = "default" | "gold" | "emerald" | "danger";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function AdminCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <article className={cx("admin-card", className)}>{children}</article>;
}

export function AdminChartCard({
  title,
  subtitle,
  actions,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AdminCard className={cx("admin-chart-card", className)}>
      <div className="admin-card__header">
        <div>
          <h2 className="admin-card__title">{title}</h2>
          {subtitle ? <p className="admin-card__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="admin-card__actions">{actions}</div> : null}
      </div>
      {children}
    </AdminCard>
  );
}

export function AdminBadge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cx("admin-badge", `admin-badge--${tone}`, className)}>{children}</span>;
}

export function AdminButton({
  children,
  variant = "secondary",
  className,
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx("admin-button", `admin-button--${variant}`, className)}
    >
      {children}
    </button>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx("admin-empty-state", compact && "admin-empty-state--compact")}>
      <div className="admin-empty-state__glow" aria-hidden="true" />
      <p className="admin-empty-state__title">{title}</p>
      <p className="admin-empty-state__text">{description}</p>
      {action ? <div className="admin-empty-state__action">{action}</div> : null}
    </div>
  );
}

export function AdminPageHeader({
  title,
  subtitle,
  eyebrow,
  meta,
  actions,
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-header">
      <div className="admin-page-header__copy">
        {eyebrow ? <p className="admin-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="admin-page-header__title">{title}</h1>
        <p className="admin-page-header__subtitle">{subtitle}</p>
        {meta ? <div className="admin-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="admin-page-header__actions">{actions}</div> : null}
    </header>
  );
}

export function AdminKpiCard({
  label,
  value,
  description,
  trend,
  icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  description?: string;
  trend?: string;
  icon?: ReactNode;
  tone?: Tone;
  hint?: string;
}) {
  const isLongValue = value.length > 18 || value.includes("://") || value.includes("/");

  return (
    <AdminCard
      className={cx("admin-kpi-card", `admin-kpi-card--${tone}`)}
    >
      <div className="admin-kpi-card__top">
        <div>
          <p className="admin-kpi-card__label" title={hint}>
            {label}
          </p>
          <p
            className={cx("admin-kpi-card__value", isLongValue && "admin-kpi-card__value--long")}
            title={value}
          >
            {value}
          </p>
        </div>
        <div className="admin-kpi-card__icon" aria-hidden="true">
          {icon ?? <span className="admin-kpi-card__icon-dot" />}
        </div>
      </div>
      <div className="admin-kpi-card__bottom">
        {description ? <p className="admin-kpi-card__description">{description}</p> : <span />}
        {trend ? (
          <AdminBadge
            tone={tone === "danger" ? "danger" : tone === "emerald" ? "emerald" : "gold"}
            className="admin-kpi-card__trend"
          >
            {trend}
          </AdminBadge>
        ) : null}
      </div>
    </AdminCard>
  );
}

export function AdminTable({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx("admin-table-shell", className)}>{children}</div>;
}

export function AdminFilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("admin-filter-bar", className)}>{children}</div>;
}

export function AdminAuditLog({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminCard className={cx("admin-audit-log", className)}>
      <div className="admin-card__header">
        <div>
          <h2 className="admin-card__title">{title}</h2>
          {subtitle ? <p className="admin-card__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </AdminCard>
  );
}
