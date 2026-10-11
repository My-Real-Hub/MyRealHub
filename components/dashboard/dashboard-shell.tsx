import Link from "next/link";
import type { ReactNode } from "react";
import {
  AdminDashboardNavigation,
  type DashboardNavItem,
} from "./admin-dashboard-navigation";

type DashboardShellProps = {
  children: ReactNode;
  navItems: DashboardNavItem[];
  navLabel: string;
  signedInValue: string;
};
type DashboardHeaderProps = {
  actions?: ReactNode;
  description: string;
  eyebrow: string;
  id?: string;
  title: string;
};
type DashboardStatCardProps = {
  description?: string;
  href?: string;
  label: string;
  tone?: "light" | "accent" | "info" | "warning" | "danger";
  value: ReactNode;
};
type DashboardSectionProps = {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  id: string;
  title: string;
};
const statToneClassNames = {
  light: "border-stone-200 bg-white text-stone-600",
  accent: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-sky-200 bg-sky-50 text-sky-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
};
export function DashboardShell({
  children,
  navItems,
  navLabel,
  signedInValue,
}: DashboardShellProps) {
  return (
    <section className="admin-dashboard min-h-screen border-t border-stone-200 bg-[#f6f7f5]">
      <div className="mx-auto grid w-full max-w-[1440px] gap-7 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:px-8 lg:py-10">
        <AdminDashboardNavigation
          navItems={navItems}
          navLabel={navLabel}
          signedInValue={signedInValue}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
export function DashboardHeader({
  actions,
  description,
  eyebrow,
  id = "overview",
  title,
}: DashboardHeaderProps) {
  return (
    <header
      id={id}
      className="admin-dashboard-section flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between"
    >
      <div className="min-w-0 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
          {eyebrow}
        </p>
        <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
export function DashboardStatCard({
  description,
  href,
  label,
  tone = "light",
  value,
}: DashboardStatCardProps) {
  const className = `block min-w-0 rounded-2xl border p-5 ${statToneClassNames[tone]} ${href ? "transition hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700" : ""}`;
  const content = (
    <>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-3 break-words text-3xl font-semibold leading-tight tracking-tight text-stone-950">
        {value}
      </p>
      {description ? (
        <p className="mt-2 text-xs leading-5 text-stone-500">{description}</p>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <article className={className}>{content}</article>
  );
}
export function DashboardSection({
  actions,
  children,
  className = "",
  description,
  eyebrow,
  id,
  title,
}: DashboardSectionProps) {
  return (
    <section
      id={id}
      className={`admin-dashboard-section rounded-2xl border border-stone-200 bg-white p-5 sm:p-6 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
              {eyebrow}
            </p>
          ) : null}
          <h2
            className={`${eyebrow ? "mt-2 " : ""}text-xl font-semibold tracking-tight text-stone-950`}
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
