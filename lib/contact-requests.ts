export const CONTACT_REQUESTS_PER_PAGE = 10;

export type ContactRequestStatus =
  | "new"
  | "read"
  | "responded"
  | "rejected"
  | "archived";

export type ContactRequestStatusFilter = "all" | ContactRequestStatus;

export const contactRequestStatusFilters = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "responded", label: "Responded" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Deleted" },
] satisfies Array<{ value: ContactRequestStatusFilter; label: string }>;

export const contactRequestStatusLabels = {
  new: "New",
  read: "Read",
  responded: "Responded",
  rejected: "Rejected",
  archived: "Deleted",
} satisfies Record<ContactRequestStatus, string>;

export const contactRequestStatusClassNames = {
  new: "border-emerald-200 bg-emerald-50 text-emerald-900",
  read: "border-sky-200 bg-sky-50 text-sky-900",
  responded: "border-violet-200 bg-violet-50 text-violet-900",
  rejected: "border-red-200 bg-red-50 text-red-800",
  archived: "border-stone-200 bg-stone-100 text-stone-700",
} satisfies Record<ContactRequestStatus, string>;

export function getContactRequestStatusFilter(value: string | undefined) {
  const status = contactRequestStatusFilters.find(
    (option) => option.value === value,
  );

  return status?.value ?? "all";
}

export function getPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis-start" | "ellipsis-end"> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    items.push("ellipsis-start");
  }

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (end < totalPages - 1) {
    items.push("ellipsis-end");
  }

  items.push(totalPages);

  return items;
}

export function getPositivePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function getQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
