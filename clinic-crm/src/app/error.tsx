"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error.digest ?? error.message);
  }, [error]);

  return (
    <html>
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#F5F1E8",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
          }}
        >
          <div
            style={{
              maxWidth: 440,
              width: "100%",
              background: "#fff",
              borderRadius: 20,
              border: "1px solid #E8E1D5",
              padding: "2.5rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "#FEF2F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                margin: "0 auto 1.5rem",
              }}
            >
              ⚠️
            </div>

            <h1
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#2B1A14",
                margin: "0 0 0.5rem",
              }}
            >
              Something went wrong
            </h1>

            <p
              style={{
                fontSize: 14,
                color: "#7A685F",
                margin: "0 0 2rem",
                lineHeight: 1.6,
              }}
            >
              An unexpected error occurred. Our team has been notified. Please
              try again — if the problem persists, contact support.
            </p>

            {error.digest && (
              <p
                style={{
                  fontSize: 11,
                  color: "#A8998A",
                  fontFamily: "monospace",
                  margin: "0 0 1.5rem",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={reset}
                style={{
                  padding: "10px 24px",
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

              <Link
                href="/"
                style={{
                  padding: "10px 24px",
                  borderRadius: 12,
                  border: "1px solid #E8E1D5",
                  background: "#fff",
                  color: "#5A1F14",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                Go home
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}