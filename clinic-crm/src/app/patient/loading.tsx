/**
 * src/app/patient/loading.tsx
 * Loading skeleton for the patient portal segment.
 */

export default function PatientLoading() {
  return (
    <div style={{ padding: "2rem", background: "#F5F1E8", minHeight: "100%" }}>
      <div
        style={{
          height: 24,
          width: 180,
          borderRadius: 8,
          background: "linear-gradient(90deg, #E8E0D0 25%, #F0E8DC 50%, #E8E0D0 75%)",
          backgroundSize: "400px 100%",
          animation: "shimmer 1.4s infinite",
          marginBottom: "1.5rem",
        }}
      />
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 80,
            borderRadius: 14,
            background: "linear-gradient(90deg, #E8E0D0 25%, #F0E8DC 50%, #E8E0D0 75%)",
            backgroundSize: "400px 100%",
            animation: `shimmer 1.4s ${i * 0.12}s infinite`,
            marginBottom: 12,
          }}
        />
      ))}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
      `}</style>
    </div>
  );
}
