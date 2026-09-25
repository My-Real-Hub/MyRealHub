import type { CurrentProfile } from "@/lib/auth/session";
import type { ProfileRole } from "@/lib/auth/roles";

type RoleDashboardProps = {
  profile: CurrentProfile;
  role: ProfileRole;
  title: string;
  description: string;
  actions: string[];
};

const roleLabels: Record<ProfileRole, string> = {
  user: "User",
  provider: "Provider",
  admin: "Admin",
};

export function RoleDashboard({
  profile,
  role,
  title,
  description,
  actions,
}: RoleDashboardProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          {roleLabels[role]} dashboard
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          {title}
        </h1>
        <p className="mt-4 text-base leading-7 text-stone-600">
          {description}
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Signed in as</p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            {profile.fullName ?? profile.email ?? "MyRealHub account"}
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Role: <span className="font-semibold">{roleLabels[profile.role]}</span>
          </p>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Available here</p>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-stone-700">
            {actions.map((action) => (
              <li key={action} className="rounded-md bg-stone-50 px-4 py-3">
                {action}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
