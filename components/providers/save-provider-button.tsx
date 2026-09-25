import Link from "next/link";
import { saveProvider, unsaveProvider } from "@/app/providers/save-actions";

type SaveProviderButtonProps = {
  isSaved: boolean;
  isSignedIn: boolean;
  providerId: string;
  returnPath: string;
  savedLabel?: string;
  size?: "default" | "compact";
  unsavedLabel?: string;
};

const baseClassName =
  "inline-flex items-center justify-center rounded-md text-sm font-semibold transition focus:outline-none focus:ring-4";

const sizeClassNames = {
  compact: "h-10 px-4",
  default: "h-11 px-4",
};

function getLoginHref(returnPath: string) {
  return `/login?next=${encodeURIComponent(returnPath)}&reason=save-provider`;
}

export function SaveProviderButton({
  isSaved,
  isSignedIn,
  providerId,
  returnPath,
  savedLabel = "Saved",
  size = "default",
  unsavedLabel = "Save provider",
}: SaveProviderButtonProps) {
  const sizeClassName = sizeClassNames[size];

  if (!isSignedIn) {
    return (
      <Link
        href={getLoginHref(returnPath)}
        className={`${baseClassName} ${sizeClassName} w-full border border-stone-300 text-stone-800 hover:border-teal-800 hover:text-teal-900 focus:ring-teal-100`}
      >
        Log in to save
      </Link>
    );
  }

  return (
    <form action={isSaved ? unsaveProvider : saveProvider}>
      <input type="hidden" name="providerId" value={providerId} />
      <input type="hidden" name="returnPath" value={returnPath} />
      <button
        type="submit"
        className={
          isSaved
            ? `${baseClassName} ${sizeClassName} w-full border border-teal-700 bg-teal-50 text-teal-800 hover:bg-teal-100 focus:ring-teal-100`
            : `${baseClassName} ${sizeClassName} w-full border border-stone-300 text-stone-800 hover:border-teal-800 hover:text-teal-900 focus:ring-teal-100`
        }
      >
        {isSaved ? savedLabel : unsavedLabel}
      </button>
    </form>
  );
}
