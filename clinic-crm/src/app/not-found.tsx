/**
 * src/app/not-found.tsx
 *
 * PRODUCTION FIX: Renders a branded 404 page instead of the default Next.js
 * 404 screen. Place this at the app root so all unmatched routes use it.
 * You can also add a not-found.tsx inside /dashboard or /patient for
 * section-specific 404 pages.
 */

import Link from "next/link";

export default function NotFound() {
  return (
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
            fontSize: 56,
            fontWeight: 900,
            color: "#5A1F14",
            lineHeight: 1,
            margin: "0 0 0.5rem",
          }}
        >
          404
        </div>

        <h1
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#2B1A14",
            margin: "0 0 0.5rem",
          }}
        >
          Page not found
        </h1>

        <p
          style={{
            fontSize: 14,
            color: "#7A685F",
            margin: "0 0 2rem",
            lineHeight: 1.6,
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link
            href="/dashboard"
            style={{
              padding: "10px 24px",
              borderRadius: 12,
              background: "linear-gradient(135deg, #3E1F14, #5A1F14)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Go to dashboard
          </Link>

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
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
