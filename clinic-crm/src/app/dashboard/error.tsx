"use client";

/**
 * src/app/dashboard/error.tsx
 *
 * Section-specific error boundary for the dashboard segment.
 * Catches errors thrown inside any dashboard route without taking down
 * the entire app — the sidebar and top bar stay intact.
 */

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error.digest ?? error.message);
  }, [error]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 2rem",
        background: "#F5F1E8",
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: "100%",
          background: "#fff",
          borderRadius: 20,
          border: "1px solid #E8E1D5",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: "#FEF2F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            margin: "0 auto 1.25rem",
          }}
        >
          ⚠️
        </div>

        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#2B1A14",
            margin: "0 0 0.5rem",
          }}
        >
          Failed to load this page
        </h2>

        <p
          style={{
            fontSize: 13,
            color: "#7A685F",
            margin: "0 0 1.5rem",
            lineHeight: 1.6,
          }}
        >
          Something went wrong loading this section. Try again or navigate to
          another page.
          {error.digest && (
            <><br /><code style={{ fontSize: 11, color: "#A8998A" }}>ID: {error.digest}</code></>
          )}
        </p>

        <button
          onClick={reset}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 12,
            border: "none",
            background: "linear-gradient(135deg, #3E1F14, #5A1F14)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
