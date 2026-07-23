import Link from "next/link";
import {
  archiveContactRequest,
  markContactRequestRead,
  rejectContactRequest,
  respondToContactRequest,
} from "@/app/provider/dashboard/actions";
import type { ProviderProfileFormData } from "@/components/providers/provider-profile-form";
import { requireProfileRole } from "@/lib/auth/session";
import {
  CONTACT_REQUESTS_PER_PAGE,
  contactDeliveryMethodLabels,
  contactEmailDeliveryStatusClassNames,
  contactEmailDeliveryStatusLabels,
  contactRequestStatusClassNames,
  contactRequestStatusFilters,
  contactRequestStatusLabels,
  getContactRequestStatusFilter,
  getPaginationItems,
  getPositivePage,
  getQueryValue,
  type ContactDeliveryMethod,
  type ContactEmailDeliveryStatus,
  type ContactRequestStatus,
  type ContactRequestStatusFilter,
} from "@/lib/contact-requests";
import type { ProviderProfileStatus } from "@/lib/providers/profile-form";
import { isProviderProfileId } from "@/lib/providers/slug";
import { getServerSupabaseClient } from "@/lib/supabase/server";

type ProviderDashboardPageProps = {
  searchParams: Promise<ProviderDashboardSearchParams>;
};

type ProviderDashboardSearchParams = {
  contactAction?: string | string[];
  inquiry?: string | string[];
  inquiryPage?: string | string[];
  inquiryStatus?: string | string[];
};

type DashboardStatus = ProviderProfileStatus | "not_started";

type ProviderProfileRow = ProviderProfileFormData & {
  service_area: string | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  updated_at: string | null;
};

type ProviderProfileBaseRow = Omit<
  ProviderProfileRow,
  "languageIds" | "specialtyIds"
>;

type ProviderLanguageRow = {
  language_id: string;
};

type ProviderSpecialtyRow = {
  specialty_id: string;
};

type ContactRequestRow = {
  id: string;
  sender_user_id: string | null;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  subject: string;
  message: string;
  delivery_method: ContactDeliveryMethod;
  email_delivery_status: ContactEmailDeliveryStatus;
  email_delivery_error: string | null;
  email_delivered_at: string | null;
  provider_response: string | null;
  status: ContactRequestStatus;
  read_at: string | null;
  responded_at: string | null;
  rejected_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type ContactRequestPageData = {
  rows: ContactRequestRow[];
  selectedRequest: ContactRequestRow | null;
  total: number;
  page: number;
  totalPages: number;
  statusFilter: ContactRequestStatusFilter;
};

type StatusContent = {
  label: string;
  badgeClassName: string;
  summary: string;
  nextStep: string;
};

const statusContent: Record<DashboardStatus, StatusContent> = {
  not_started: {
    label: "Not started",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
    summary: "No provider listing has been started for this account yet.",
    nextStep: "Create the first draft of your provider profile.",
  },
  draft: {
    label: "Draft",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-900",
    summary: "Your listing is private while you prepare it for submission.",
    nextStep: "Finish profile details and submit for admin review.",
  },
  pending_approval: {
    label: "Pending approval",
    badgeClassName: "border-sky-200 bg-sky-50 text-sky-900",
    summary: "Your listing is waiting for admin approval.",
    nextStep: "Watch for approval updates from the MyRealHub team.",
  },
  active: {
    label: "Active",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
    summary: "Your listing is approved and ready for public directory surfaces.",
    nextStep: "Keep service details and contact information current.",
  },
  inactive: {
    label: "Inactive",
    badgeClassName: "border-stone-200 bg-stone-100 text-stone-700",
    summary: "Your listing exists but is hidden from public directory surfaces.",
    nextStep: "Update profile details and request reactivation when ready.",
  },
  rejected: {
    label: "Rejected",
    badgeClassName: "border-red-200 bg-red-50 text-red-800",
    summary: "Your listing needs changes before it can be approved.",
    nextStep: "Review the admin note and update the profile draft.",
  },
};

const dashboardNavItems = [
  { href: "#overview", label: "Overview" },
  { href: "#consumer-tools", label: "Find services" },
  { href: "#inquiries", label: "Inquiries" },
  { href: "/settings", label: "Settings" },
];

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return dateFormatter.format(new Date(value));
}

function getProviderInboxHref({
  page = 1,
  selectedRequestId,
  statusFilter = "all",
}: {
  page?: number;
  selectedRequestId?: string;
  statusFilter?: ContactRequestStatusFilter;
}) {
  const params = new URLSearchParams();

  if (statusFilter !== "all") {
    params.set("inquiryStatus", statusFilter);
  }

  if (page > 1) {
    params.set("inquiryPage", String(page));
  }

  if (selectedRequestId) {
    params.set("inquiry", selectedRequestId);
  }

  const queryString = params.toString();

  return `/provider/dashboard${queryString ? `?${queryString}` : ""}#inquiries`;
}

function getContactRequestReturnPath({
  page,
  selectedRequestId,
  statusFilter,
}: {
  page: number;
  selectedRequestId: string;
  statusFilter: ContactRequestStatusFilter;
}) {
  return getProviderInboxHref({
    page,
    selectedRequestId,
    statusFilter,
  });
}

function getContactActionMessage(action: string | undefined) {
  switch (action) {
    case "read":
      return {
        tone: "success",
        text: "Contact request marked as read.",
      };
    case "responded":
      return {
        tone: "success",
        text: "Response saved. The user can see it in their dashboard.",
      };
    case "rejected":
      return {
        tone: "success",
        text: "Request rejected. The user can see the updated status.",
      };
    case "archived":
      return {
        tone: "success",
        text: "Request moved to Deleted.",
      };
    case "response-empty":
      return {
        tone: "error",
        text: "Write a response before sending it.",
      };
    case "response-too-long":
      return {
        tone: "error",
        text: "Response must be 2,000 characters or fewer.",
      };
    case "not-found":
      return {
        tone: "error",
        text: "That contact request could not be found.",
      };
    case "error":
      return {
        tone: "error",
        text: "The contact request could not be updated. Please try again.",
      };
    default:
      return null;
  }
}

function getContactRequestRangeLabel(contactPage: ContactRequestPageData) {
  if (contactPage.total === 0) {
    return "0 requests";
  }

  const start = (contactPage.page - 1) * CONTACT_REQUESTS_PER_PAGE + 1;
  const end = Math.min(
    contactPage.total,
    contactPage.page * CONTACT_REQUESTS_PER_PAGE,
  );

  return `${start}-${end} of ${contactPage.total}`;
}

function getDisplayName(
  providerProfile: ProviderProfileRow | null,
  fallbackName: string | null,
) {
  return (
    providerProfile?.business_name ??
    providerProfile?.display_name ??
    fallbackName ??
    "Provider account"
  );
}

function getLocationLabel(providerProfile: ProviderProfileRow | null) {
  const parts = [
    providerProfile?.city,
    providerProfile?.province_state,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "Location not added";
}

function getStatusTimestamp(providerProfile: ProviderProfileRow | null) {
  if (!providerProfile) {
    return "Profile not created";
  }

  if (providerProfile.approved_at) {
    return `Approved ${formatDate(providerProfile.approved_at)}`;
  }

  if (providerProfile.submitted_at) {
    return `Submitted ${formatDate(providerProfile.submitted_at)}`;
  }

  return `Updated ${formatDate(providerProfile.updated_at)}`;
}

function countCompletedProfileFields(providerProfile: ProviderProfileRow | null) {
  if (!providerProfile) {
    return 0;
  }

  return [
    providerProfile.business_name,
    providerProfile.display_name,
    providerProfile.category_id,
    providerProfile.bio,
    providerProfile.email,
    providerProfile.phone,
    providerProfile.city,
    providerProfile.province_state,
    providerProfile.country,
    providerProfile.languageIds.length > 0 ? "languages" : null,
    providerProfile.specialtyIds.length > 0 ? "specialties" : null,
  ].filter(Boolean).length;
}

async function getProviderProfile(userId: string) {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("provider_profiles")
    .select(
      [
        "id",
        "category_id",
        "business_name",
        "display_name",
        "bio",
        "phone",
        "email",
        "website_url",
        "city",
        "province_state",
        "country",
        "service_area",
        "profile_image_path",
        "profile_image_url",
        "status",
        "rejection_reason",
        "submitted_at",
        "approved_at",
        "updated_at",
      ].join(","),
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const providerProfile = data as unknown as ProviderProfileBaseRow;
  const [languageRows, specialtyRows] = await Promise.all([
    supabase
      .from("provider_languages")
      .select("language_id")
      .eq("provider_profile_id", providerProfile.id),
    supabase
      .from("provider_specialties")
      .select("specialty_id")
      .eq("provider_profile_id", providerProfile.id),
  ]);

  return {
    ...providerProfile,
    languageIds: ((languageRows.data ?? []) as ProviderLanguageRow[]).map(
      (row) => row.language_id,
    ),
    specialtyIds: ((specialtyRows.data ?? []) as ProviderSpecialtyRow[]).map(
      (row) => row.specialty_id,
    ),
  };
}

const contactRequestColumns = [
  "id",
  "sender_user_id",
  "sender_name",
  "sender_email",
  "sender_phone",
  "subject",
  "message",
  "delivery_method",
  "email_delivery_status",
  "email_delivery_error",
  "email_delivered_at",
  "provider_response",
  "status",
  "read_at",
  "responded_at",
  "rejected_at",
  "archived_at",
  "created_at",
  "updated_at",
].join(",");

async function getContactRequestPageData({
  providerProfileId,
  requestedPage,
  selectedRequestId,
  statusFilter,
}: {
  providerProfileId: string | null;
  requestedPage: number;
  selectedRequestId: string | null;
  statusFilter: ContactRequestStatusFilter;
}): Promise<ContactRequestPageData> {
  if (!providerProfileId) {
    return {
      rows: [],
      selectedRequest: null,
      total: 0,
      page: 1,
      totalPages: 1,
      statusFilter,
    };
  }

  const supabase = await getServerSupabaseClient();
  let countQuery = supabase
    .from("contact_requests")
    .select("id", { count: "exact", head: true })
    .eq("provider_profile_id", providerProfileId);

  if (statusFilter !== "all") {
    countQuery = countQuery.eq("status", statusFilter);
  }

  const { count } = await countQuery;
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CONTACT_REQUESTS_PER_PAGE));
  const page = Math.min(requestedPage, totalPages);
  const rangeStart = (page - 1) * CONTACT_REQUESTS_PER_PAGE;
  const rangeEnd = rangeStart + CONTACT_REQUESTS_PER_PAGE - 1;
  let requestQuery = supabase
    .from("contact_requests")
    .select(contactRequestColumns)
    .eq("provider_profile_id", providerProfileId)
    .order("created_at", { ascending: false })
    .range(rangeStart, rangeEnd);

  if (statusFilter !== "all") {
    requestQuery = requestQuery.eq("status", statusFilter);
  }

  const selectedRequestPromise =
    selectedRequestId && isProviderProfileId(selectedRequestId)
      ? supabase
          .from("contact_requests")
          .select(contactRequestColumns)
          .eq("provider_profile_id", providerProfileId)
          .eq("id", selectedRequestId)
          .maybeSingle()
      : Promise.resolve({ data: null });

  const [requestRows, selectedRequestResult] = await Promise.all([
    requestQuery,
    selectedRequestPromise,
  ]);

  return {
    rows: (requestRows.data ?? []) as unknown as ContactRequestRow[],
    selectedRequest: (selectedRequestResult.data ??
      null) as unknown as ContactRequestRow | null,
    total,
    page,
    totalPages,
    statusFilter,
  };
}

async function getInquirySummary(providerProfileId: string | null) {
  if (!providerProfileId) {
    return {
      total: 0,
      unread: 0,
    };
  }

  const supabase = await getServerSupabaseClient();
  const [totalResult, unreadResult] = await Promise.all([
    supabase
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq("provider_profile_id", providerProfileId),
    supabase
      .from("contact_requests")
      .select("id", { count: "exact", head: true })
      .eq("provider_profile_id", providerProfileId)
      .eq("status", "new"),
  ]);

  return {
    total: totalResult.count ?? 0,
    unread: unreadResult.count ?? 0,
  };
}

function ContactRequestStatusBadge({
  status,
}: {
  status: ContactRequestStatus;
}) {
  return (
    <span
      className={`w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${contactRequestStatusClassNames[status]}`}
    >
      {contactRequestStatusLabels[status]}
    </span>
  );
}

function EmailDeliveryStatusBadge({
  status,
}: {
  status: ContactEmailDeliveryStatus;
}) {
  return (
    <span
      className={`w-fit rounded-md border px-2.5 py-1 text-xs font-semibold ${contactEmailDeliveryStatusClassNames[status]}`}
    >
      Email {contactEmailDeliveryStatusLabels[status]}
    </span>
  );
}

function ContactRequestFilters({
  selectedStatus,
}: {
  selectedStatus: ContactRequestStatusFilter;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Contact request filters">
      {contactRequestStatusFilters.map((option) => {
        const isSelected = option.value === selectedStatus;

        return (
          <Link
            key={option.value}
            href={getProviderInboxHref({
              page: 1,
              statusFilter: option.value,
            })}
            aria-current={isSelected ? "page" : undefined}
            className={`inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold transition ${
              isSelected
                ? "border-stone-950 bg-stone-950 text-white"
                : "border-stone-300 text-stone-700 hover:border-stone-950 hover:text-stone-950"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function ContactRequestPagination({
  contactPage,
}: {
  contactPage: ContactRequestPageData;
}) {
  if (contactPage.totalPages <= 1) {
    return null;
  }

  const previousPage = Math.max(1, contactPage.page - 1);
  const nextPage = Math.min(contactPage.totalPages, contactPage.page + 1);

  return (
    <nav
      className="mt-5 flex flex-col gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Contact request pagination"
    >
      <Link
        href={getProviderInboxHref({
          page: previousPage,
          statusFilter: contactPage.statusFilter,
        })}
        aria-disabled={contactPage.page === 1}
        className={`inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 ${
          contactPage.page === 1 ? "pointer-events-none opacity-50" : ""
        }`}
      >
        Previous
      </Link>

      <div className="flex flex-wrap gap-2">
        {getPaginationItems(contactPage.page, contactPage.totalPages).map(
          (pageNumber) => {
            if (typeof pageNumber !== "number") {
              return (
                <span
                  key={pageNumber}
                  className="inline-flex size-9 items-center justify-center text-xs font-semibold text-stone-400"
                >
                  ...
                </span>
              );
            }

            const isCurrent = pageNumber === contactPage.page;

            return (
              <Link
                key={pageNumber}
                href={getProviderInboxHref({
                  page: pageNumber,
                  statusFilter: contactPage.statusFilter,
                })}
                aria-current={isCurrent ? "page" : undefined}
                className={`inline-flex size-9 items-center justify-center rounded-md border text-xs font-semibold transition ${
                  isCurrent
                    ? "border-stone-950 bg-stone-950 text-white"
                    : "border-stone-300 text-stone-700 hover:border-stone-950 hover:text-stone-950"
                }`}
              >
                {pageNumber}
              </Link>
            );
          },
        )}
      </div>

      <Link
        href={getProviderInboxHref({
          page: nextPage,
          statusFilter: contactPage.statusFilter,
        })}
        aria-disabled={contactPage.page === contactPage.totalPages}
        className={`inline-flex h-9 items-center justify-center rounded-md border border-stone-300 px-3 text-xs font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950 ${
          contactPage.page === contactPage.totalPages
            ? "pointer-events-none opacity-50"
            : ""
        }`}
      >
        Next
      </Link>
    </nav>
  );
}

function ContactRequestListItem({
  contactPage,
  request,
}: {
  contactPage: ContactRequestPageData;
  request: ContactRequestRow;
}) {
  const isSelected = contactPage.selectedRequest?.id === request.id;

  return (
    <Link
      href={getProviderInboxHref({
        page: contactPage.page,
        selectedRequestId: request.id,
        statusFilter: contactPage.statusFilter,
      })}
      aria-current={isSelected ? "page" : undefined}
      className={`block rounded-md border px-4 py-3 transition ${
        isSelected
          ? "border-stone-950 bg-stone-50"
          : "border-stone-200 hover:border-stone-400"
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950">
            {request.sender_name}
          </p>
          <p className="mt-1 break-words text-sm text-stone-600">
            {request.sender_email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ContactRequestStatusBadge status={request.status} />
          {request.email_delivery_status === "failed" ? (
            <EmailDeliveryStatusBadge
              status={request.email_delivery_status}
            />
          ) : null}
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-stone-950">
        {request.subject}
      </p>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {contactDeliveryMethodLabels[request.delivery_method]}
      </p>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-700">
        {request.message}
      </p>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-stone-500">
        {formatDate(request.created_at)}
      </p>
    </Link>
  );
}

function ContactRequestActionMessage({
  action,
}: {
  action: string | undefined;
}) {
  const message = getContactActionMessage(action);

  if (!message) {
    return null;
  }

  const className =
    message.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-red-200 bg-red-50 text-red-800";

  return (
    <p
      className={`mt-5 rounded-md border px-4 py-3 text-sm leading-6 ${className}`}
      role={message.tone === "error" ? "alert" : "status"}
    >
      {message.text}
    </p>
  );
}

function ContactRequestDetail({
  contactPage,
}: {
  contactPage: ContactRequestPageData;
}) {
  const request = contactPage.selectedRequest;

  if (!request) {
    return (
      <div className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-center">
        <p className="text-sm font-semibold text-stone-950">
          Select a contact request
        </p>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Click a request on the left to view the full message and actions.
        </p>
      </div>
    );
  }

  const returnPath = getContactRequestReturnPath({
    page: contactPage.page,
    selectedRequestId: request.id,
    statusFilter: contactPage.statusFilter,
  });
  const isArchived = request.status === "archived";

  return (
    <div className="rounded-md border border-stone-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-950">
            {request.sender_name}
          </p>
          <p className="mt-1 break-words text-sm text-stone-600">
            {request.sender_email}
          </p>
          {request.sender_phone ? (
            <p className="mt-1 break-words text-sm text-stone-600">
              {request.sender_phone}
            </p>
          ) : null}
        </div>
        <ContactRequestStatusBadge status={request.status} />
      </div>

      <dl className="mt-5 grid gap-3 border-t border-stone-200 pt-5 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Subject
          </dt>
          <dd className="mt-1 font-medium text-stone-900">
            {request.subject}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Sent
          </dt>
          <dd className="mt-1 font-medium text-stone-900">
            {formatDate(request.created_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Last updated
          </dt>
          <dd className="mt-1 font-medium text-stone-900">
            {formatDate(request.updated_at)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Delivery
          </dt>
          <dd className="mt-1 font-medium text-stone-900">
            {contactDeliveryMethodLabels[request.delivery_method]}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Email delivery
          </dt>
          <dd className="mt-1 flex flex-wrap gap-2 font-medium text-stone-900">
            <EmailDeliveryStatusBadge
              status={request.email_delivery_status}
            />
            {request.email_delivered_at ? (
              <span>{formatDate(request.email_delivered_at)}</span>
            ) : null}
          </dd>
        </div>
      </dl>

      {request.email_delivery_status === "failed" ? (
        <p
          className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
          role="status"
        >
          {request.email_delivery_error ??
            "Email delivery failed. The inquiry is still available in MyRealHub."}
        </p>
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-stone-950">Message</h3>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
          {request.message}
        </p>
      </div>

      {request.provider_response ? (
        <div className="mt-5 rounded-md border border-stone-200 bg-stone-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-stone-950">
            Provider response
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
            {request.provider_response}
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 border-t border-stone-200 pt-5">
        {request.status === "new" ? (
          <form action={markContactRequestRead}>
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="returnPath" value={returnPath} />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
            >
              Mark as read
            </button>
          </form>
        ) : null}

        {!isArchived ? (
          <>
            <form action={respondToContactRequest} className="grid gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <label
                htmlFor={`response-${request.id}`}
                className="text-sm font-semibold text-stone-950"
              >
                Response to user
              </label>
              <textarea
                id={`response-${request.id}`}
                name="providerResponse"
                defaultValue={request.provider_response ?? ""}
                maxLength={2000}
                className="min-h-32 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-6 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Send response
              </button>
            </form>

            <form action={rejectContactRequest} className="grid gap-3">
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <label
                htmlFor={`reject-${request.id}`}
                className="text-sm font-semibold text-stone-950"
              >
                Rejection note
              </label>
              <textarea
                id={`reject-${request.id}`}
                name="providerResponse"
                placeholder="Optional note for the user"
                maxLength={2000}
                className="min-h-24 w-full resize-y rounded-md border border-stone-300 bg-white px-3 py-3 text-sm leading-6 text-stone-950 outline-none transition placeholder:text-stone-400 focus:border-red-600 focus:ring-4 focus:ring-red-100"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-fit items-center justify-center rounded-md border border-red-300 px-4 text-sm font-semibold text-red-700 transition hover:border-red-700 hover:text-red-800"
              >
                Reject request
              </button>
            </form>

            <form action={archiveContactRequest}>
              <input type="hidden" name="requestId" value={request.id} />
              <input type="hidden" name="returnPath" value={returnPath} />
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
              >
                Delete request
              </button>
            </form>
          </>
        ) : (
          <p className="rounded-md border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-600">
            This request is in Deleted. It remains visible in the sender&apos;s
            message history.
          </p>
        )}
      </div>
    </div>
  );
}

function ContactRequestInbox({
  action,
  contactPage,
}: {
  action: string | undefined;
  contactPage: ContactRequestPageData;
}) {
  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Inquiries
          </p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">
            Contact requests
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Showing {getContactRequestRangeLabel(contactPage)}.
          </p>
        </div>
        <ContactRequestFilters selectedStatus={contactPage.statusFilter} />
      </div>

      <ContactRequestActionMessage action={action} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]">
        <div>
          <div className="grid gap-3">
            {contactPage.rows.length > 0 ? (
              contactPage.rows.map((request) => (
                <ContactRequestListItem
                  key={request.id}
                  contactPage={contactPage}
                  request={request}
                />
              ))
            ) : (
              <div className="rounded-md border border-dashed border-stone-300 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-stone-950">
                  No contact requests found
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  Try another status filter or wait for new profile inquiries.
                </p>
              </div>
            )}
          </div>
          <ContactRequestPagination contactPage={contactPage} />
        </div>

        <ContactRequestDetail contactPage={contactPage} />
      </div>
    </>
  );
}

export default async function ProviderDashboardPage({
  searchParams,
}: ProviderDashboardPageProps) {
  const query = await searchParams;
  const contactAction = getQueryValue(query.contactAction);
  const contactStatusFilter = getContactRequestStatusFilter(
    getQueryValue(query.inquiryStatus),
  );
  const requestedContactPage = getPositivePage(getQueryValue(query.inquiryPage));
  const selectedRequestValue = getQueryValue(query.inquiry);
  const selectedRequestId =
    selectedRequestValue && isProviderProfileId(selectedRequestValue)
      ? selectedRequestValue
      : null;
  const profile = await requireProfileRole("provider");
  const providerProfile = await getProviderProfile(profile.id);
  const [inquirySummary, contactPage] = await Promise.all([
    getInquirySummary(providerProfile?.id ?? null),
    getContactRequestPageData({
      providerProfileId: providerProfile?.id ?? null,
      requestedPage: requestedContactPage,
      selectedRequestId,
      statusFilter: contactStatusFilter,
    }),
  ]);
  const statusKey = providerProfile?.status ?? "not_started";
  const status = statusContent[statusKey];
  const completedFields = countCompletedProfileFields(providerProfile);
  const displayName = getDisplayName(providerProfile, profile.fullName);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:items-start">
        <aside className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm lg:sticky lg:top-28">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Provider
          </p>
          <nav
            aria-label="Provider dashboard navigation"
            className="mt-3 grid gap-1 text-sm font-medium"
          >
            {dashboardNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-2 text-stone-700 transition hover:bg-stone-50 hover:text-stone-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 border-t border-stone-200 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Signed in
            </p>
            <p className="mt-2 break-words text-sm font-medium text-stone-950">
              {profile.email ?? displayName}
            </p>
          </div>
        </aside>

        <div className="grid gap-6">
          <header id="overview" className="scroll-mt-28">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Provider dashboard
            </p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-stone-950">
                  {displayName}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
                  Manage your listing, approval status, and contact requests from
                  one provider workspace.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/search"
                  className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                >
                  Search providers
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
                >
                  Consumer dashboard
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950 hover:text-stone-950"
                >
                  Settings
                </Link>
              </div>
            </div>
          </header>

          <section
            id="consumer-tools"
            className="scroll-mt-28 border-y border-stone-200 py-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-stone-950">
                  Find services for your own real estate needs
                </h2>
                <p className="mt-1 text-sm leading-6 text-stone-600">
                  Search, save, contact, and rate other providers with this
                  account.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/search"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950"
                >
                  Browse directory
                </Link>
                <Link
                  href="/dashboard#saved-providers"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-stone-300 px-4 text-sm font-semibold text-stone-800 transition hover:border-stone-950"
                >
                  Saved providers
                </Link>
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm md:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-500">
                    Profile status
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-stone-950">
                    {status.label}
                  </h2>
                </div>
                <span
                  className={`inline-flex w-fit rounded-md border px-3 py-1 text-sm font-semibold ${status.badgeClassName}`}
                >
                  {status.label}
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-stone-600">
                {status.summary}
              </p>
              <dl className="mt-5 grid gap-4 border-t border-stone-200 pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Status date
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-stone-900">
                    {getStatusTimestamp(providerProfile)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Next step
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-stone-900">
                    {status.nextStep}
                  </dd>
                </div>
              </dl>
              {providerProfile?.rejection_reason ? (
                <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
                  {providerProfile.rejection_reason}
                </p>
              ) : null}
            </article>

            <article className="rounded-lg border border-stone-200 bg-stone-950 p-5 text-white shadow-sm">
              <p className="text-sm font-medium text-stone-300">
                Inquiry snapshot
              </p>
              <p className="mt-3 text-4xl font-semibold">
                {inquirySummary.unread}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-300">
                New requests out of {inquirySummary.total} total.
              </p>
            </article>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">
                Profile fields
              </p>
              <p className="mt-3 text-3xl font-semibold text-stone-950">
                {completedFields}/11
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Core listing fields currently populated.
              </p>
            </article>

            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">Location</p>
              <p className="mt-3 text-lg font-semibold text-stone-950">
                {getLocationLabel(providerProfile)}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {providerProfile?.service_area ?? "Service area not added"}
              </p>
            </article>

            <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-medium text-stone-500">Contact</p>
              <p className="mt-3 break-words text-sm font-semibold text-stone-950">
                {providerProfile?.email ?? profile.email ?? "Email not added"}
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {providerProfile?.phone ?? "Phone not added"}
              </p>
            </article>
          </div>

          <article
            id="inquiries"
            className="scroll-mt-28 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
          >
            <ContactRequestInbox
              action={contactAction}
              contactPage={contactPage}
            />
          </article>
        </div>
      </div>
    </section>
  );
}
