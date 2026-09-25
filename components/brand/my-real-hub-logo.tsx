import Image from "next/image";

type MyRealHubLogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
};

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function MyRealHubLogo({
  className,
  markClassName,
  showWordmark = true,
  wordmarkClassName,
}: MyRealHubLogoProps) {
  return (
    <span className={cx("inline-flex items-center gap-3", className)}>
      <span
        className={cx(
          "relative inline-flex shrink-0 items-center justify-center overflow-visible",
          markClassName ?? "size-12",
        )}
      >
        <Image
          src="/brand/myrealhub-logo.png"
          alt=""
          aria-hidden="true"
          fill
          sizes="72px"
          className="object-contain"
        />
      </span>

      {showWordmark ? (
        <span
          className={
            wordmarkClassName ?? "relative h-8 w-36 sm:w-40"
          }
        >
          <Image
            src="/brand/myrealhub-wordmark.png"
            alt=""
            aria-hidden="true"
            fill
            sizes="192px"
            className="object-contain object-left"
          />
          <span className="sr-only">MyRealHub</span>
        </span>
      ) : null}
    </span>
  );
}
