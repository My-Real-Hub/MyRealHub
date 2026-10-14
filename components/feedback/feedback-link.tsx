"use client";

import type { MouseEvent, ReactNode } from "react";

type FeedbackLinkProps = {
  ariaCurrent?: "page";
  className?: string;
  children?: ReactNode;
};

export function FeedbackLink({
  ariaCurrent,
  className,
  children = "Feedback",
}: FeedbackLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.href = `/feedback?from=${encodeURIComponent(window.location.href)}`;
  }

  return (
    <a
      href="/feedback"
      aria-current={ariaCurrent}
      className={className}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
