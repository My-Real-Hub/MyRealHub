import type { SVGProps } from "react";
import { ProviderDashboardIcon } from "@/components/dashboard/provider-dashboard-icon";
import type { PlatformFeedbackType } from "@/lib/feedback";

export const feedbackPrimaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:bg-stone-300";
export const feedbackSecondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-60";

const iconPaths = {
  bug: "M8 6l-2-3 M16 6l2-3 M9 6h6a3 3 0 0 1 3 3v6a6 6 0 0 1-12 0V9a3 3 0 0 1 3-3Z M6 11H3 M18 11h3 M6 16H3 M18 16h3 M12 10v11 M8 10h8",
  idea: "M9 18h6 M9 21h6 M8 14a7 7 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z M10 8a3 3 0 0 1 3-2",
  image:
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z M3 16l6-6 4 4 3-3 5 5 M16 7h.01",
  lock: "M6 10h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
} as const;

export function FeedbackIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: keyof typeof iconPaths }) {
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
      <path d={iconPaths[name]} />
    </svg>
  );
}

const reportTips = [
  {
    title: "Where it happened",
    description: "Name the page or feature you were using.",
  },
  {
    title: "What you noticed",
    description: "Describe the problem and how to repeat it.",
  },
  {
    title: "What you expected",
    description: "Explain what should have happened instead.",
  },
];
const suggestionTips = [
  {
    title: "Your idea",
    description: "Describe the feature or change you have in mind.",
  },
  {
    title: "How it would help",
    description: "Tell us what it would make easier for you.",
  },
  {
    title: "A practical example",
    description: "Share a situation where you would use it.",
  },
];
const generalTips = [
  {
    title: "Report a problem",
    description: "Tell us about something that is not working as expected.",
  },
  {
    title: "Suggest an improvement",
    description: "Share an idea that would make MyRealHub more useful.",
  },
  {
    title: "Add some context",
    description: "A clear example or screenshot helps us understand.",
  },
];

export function FeedbackGuide({ type }: { type?: PlatformFeedbackType }) {
  const tips =
    type === "bug"
      ? reportTips
      : type === "suggestion"
        ? suggestionTips
        : generalTips;
  return (
    <section
      className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"
      aria-labelledby="feedback-guide-title"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        <FeedbackIcon name="idea" />
      </span>
      <h2
        id="feedback-guide-title"
        className="mt-4 text-base font-semibold tracking-tight text-stone-950"
      >
        {type ? "Helpful details" : "What you can share"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-stone-500">
        {type
          ? "A few specifics help the team understand your feedback."
          : "Help us make the experience better for everyone."}
      </p>
      <ul className="mt-5 space-y-4">
        {tips.map((tip) => (
          <li key={tip.title} className="flex items-start gap-2.5">
            <ProviderDashboardIcon
              name="check"
              className="mt-0.5 size-4 shrink-0 text-emerald-700"
            />
            <div>
              <p className="text-sm font-medium text-stone-800">{tip.title}</p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                {tip.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
