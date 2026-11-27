"use client";

import Link from "next/link";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", color: "#1c1917" }}>
        <main>
          <h1>MyRealHub could not be loaded</h1>
          <p>Please try again. If the problem continues, return to the homepage.</p>
          <button onClick={() => retry()}>Try again</button>{" "}
          <Link href="/">Go to homepage</Link>
        </main>
      </body>
    </html>
  );
}
