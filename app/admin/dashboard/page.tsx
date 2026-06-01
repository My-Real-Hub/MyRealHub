import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { requireProfileRole } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  const profile = await requireProfileRole("admin");

  return (
    <RoleDashboard
      profile={profile}
      role="admin"
      title="Review platform operations"
      description="Admin access is separated from user and provider dashboards for future moderation and approval workflows."
      actions={[
        "Review provider approvals and listing status changes.",
        "Manage directory health and seeded service data.",
        "Prepare admin-only reporting and moderation tools.",
      ]}
    />
  );
}
