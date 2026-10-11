import type { SVGProps } from "react";

export type ProviderDashboardIconName =
  | "overview"
  | "inquiries"
  | "listing"
  | "search"
  | "settings"
  | "arrow"
  | "location"
  | "mail"
  | "phone"
  | "check"
  | "bookmark";

const paths: Record<ProviderDashboardIconName, string> = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  inquiries:
    "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z M8 11h8 M8 15h5",
  listing:
    "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z M14 2v6h6 M8 13h8 M8 17h5",
  search: "M21 21l-4.3-4.3 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M9 3l1-1h4l1 1 .5 2 2 1 2-.5 1.5 2.6-.5 2-1.5 1.4v2l1.5 1.4.5 2-1.5 2.6-2-.5-2 1-.5 2-1 1h-4l-1-1-.5-2-2-1-2 .5L3 16.5l.5-2L5 13v-2L3.5 9.6l-.5-2 1.5-2.6 2 .5 2-1Z",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  location:
    "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z M22 6l-10 7L2 6",
  phone:
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z",
  check: "M5 12l4 4L19 6",
  bookmark: "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z",
};

export function ProviderDashboardIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: ProviderDashboardIconName }) {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
