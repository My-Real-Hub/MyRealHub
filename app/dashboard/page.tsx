import { RoleDashboard } from "@/components/dashboard/role-dashboard";
import { requireProfileRole } from "@/lib/auth/session";

export default async function UserDashboardPage() {
  const profile = await requireProfileRole("user");

  return (
    <RoleDashboard
      profile={profile}
      role="user"
      title="Manage your saved real estate services"
      description="Your dashboard keeps regular account activity separate from provider and admin tools."
      actions={[
        "Review saved providers and service categories.",
        "Track future contact requests and notes.",
        "Keep account details ready for upcoming profile features.",
      ]}
    />
  );
}
