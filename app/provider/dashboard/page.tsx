import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { requireProfileRole } from "@/lib/auth/session";

export default async function ProviderDashboardPage() {
  const profile = await requireProfileRole("provider");

  return (
    <RoleDashboard
      profile={profile}
      role="provider"
      title="Manage your provider presence"
      description="Provider tools are isolated from regular user and admin areas so listing work stays role-aware."
      actions={[
        "Prepare and update provider listing details.",
        "Review profile status and approval readiness.",
        "Manage service coverage, specialties, and contact details.",
      ]}
    />
  );
}
