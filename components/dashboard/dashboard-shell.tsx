import Link from "next/link";
import type { ReactNode } from "react";

type DashboardNavItem = {
  active?: boolean;
  href: string;
  label: string;
};

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
  light: {
    article: "border-stone-200 bg-white",
    label: "text-stone-500",
    value: "text-stone-950",
    description: "text-stone-600",
  },
  accent: {
    article: "border-emerald-200 bg-emerald-50",
    label: "text-emerald-800",
    value: "text-stone-950",
    description: "text-stone-700",
  },
  info: {
    article: "border-sky-200 bg-sky-50",
    label: "text-sky-900",
    value: "text-stone-950",
    description: "text-sky-950/80",
  },
  warning: {
    article: "border-amber-200 bg-amber-50",
    label: "text-amber-900",
    value: "text-stone-950",
    description: "text-amber-950/80",
  },
  danger: {
    article: "border-red-200 bg-red-50",
    label: "text-red-800",
    value: "text-stone-950",
    description: "text-red-900/80",
  },
};

export function DashboardShell({
  children,
  navItems,
  navLabel,
  signedInValue,
}: DashboardShellProps) {
  return (
    <section className="min-h-screen border-t border-stone-200 bg-[#f6f4ef]">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:px-8 lg:py-10">
        <aside className="h-fit rounded-lg border border-stone-200 bg-white p-3 shadow-sm lg:sticky lg:top-28">
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              {navLabel}
            </p>
            <p className="mt-1 text-sm font-semibold text-stone-950">
              Dashboard
            </p>
          </div>

          <nav
            aria-label={`${navLabel} dashboard navigation`}
            className="mt-3 grid gap-1 text-sm font-medium"
          >
            {navItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-2.5 transition ${
                  (item.active ?? index === 0)
                    ? "bg-emerald-700 text-white"
                    : "text-stone-700 hover:bg-stone-50 hover:text-stone-950"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 border-t border-stone-200 px-3 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Signed in
            </p>
            <p className="mt-2 break-words text-sm font-medium leading-6 text-stone-950">
              {signedInValue}
            </p>
          </div>
        </aside>

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
      className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal text-stone-950 sm:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
            {description}
          </p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function DashboardStatCard({
  description,
  label,
  tone = "light",
  value,
}: DashboardStatCardProps) {
  const toneClassNames = statToneClassNames[tone];

  return (
    <article
      className={`rounded-lg border p-5 shadow-sm ${toneClassNames.article}`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${toneClassNames.label}`}
      >
        {label}
      </p>
      <p
        className={`mt-3 break-words text-3xl font-semibold leading-tight ${toneClassNames.value}`}
      >
        {value}
      </p>
      {description ? (
        <p className={`mt-2 text-sm leading-6 ${toneClassNames.description}`}>
          {description}
        </p>
      ) : null}
    </article>
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
    <section id={id} className={`scroll-mt-28 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              {eyebrow}
            </p>
          ) : null}
          <h2
            className={
              eyebrow
                ? "mt-2 text-xl font-semibold text-stone-950"
                : "text-xl font-semibold text-stone-950"
            }
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
