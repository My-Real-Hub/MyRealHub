"use client";

import type { MouseEvent, ReactNode } from "react";

type FeedbackLinkProps = {
  className?: string;
  children?: ReactNode;
};

export function FeedbackLink({
  className,
  children = "Feedback",
}: FeedbackLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.href =
      `/feedback?from=${encodeURIComponent(window.location.href)}`;
  }

  return (
    <a href="/feedback" className={className} onClick={handleClick}>
      {children}
    </a>
  );
}
