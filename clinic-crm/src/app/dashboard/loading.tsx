/**
 * src/app/dashboard/loading.tsx
 *
 * PRODUCTION FIX: Shown automatically by Next.js during server-side data
 * fetching in the dashboard segment. Without this, users see a blank white
 * screen while waiting for the dashboard to load.
 *
 * This skeleton matches the layout's background colour and dimensions.
 */

export default function DashboardLoading() {
  return (
    <div
      style={{
        padding: "2rem",
        background: "#F5F1E8",
        minHeight: "100%",
      }}
    >
      {/* Page header skeleton */}
      <div
        style={{
          height: 28,
          width: 220,
          borderRadius: 8,
          background: "linear-gradient(90deg, #E8E0D0 25%, #F0E8DC 50%, #E8E0D0 75%)",
          backgroundSize: "400px 100%",
          animation: "shimmer 1.4s infinite",
          marginBottom: "0.5rem",
        }}
      />
      <div
        style={{
          height: 16,
          width: 160,
          borderRadius: 6,
          background: "linear-gradient(90deg, #E8E0D0 25%, #F0E8DC 50%, #E8E0D0 75%)",
          backgroundSize: "400px 100%",
          animation: "shimmer 1.4s infinite",
          marginBottom: "2rem",
        }}
      />

      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 16,
          marginBottom: "2rem",
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: 96,
              borderRadius: 16,
              background: "linear-gradient(90deg, #E8E0D0 25%, #F0E8DC 50%, #E8E0D0 75%)",
              backgroundSize: "400px 100%",
              animation: `shimmer 1.4s ${i * 0.1}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Content block */}
      <div
        style={{
          height: 320,
          borderRadius: 16,
          background: "linear-gradient(90deg, #E8E0D0 25%, #F0E8DC 50%, #E8E0D0 75%)",
          backgroundSize: "400px 100%",
          animation: "shimmer 1.4s 0.2s infinite",
        }}
      />

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
      `}</style>
    </div>
  );
}
