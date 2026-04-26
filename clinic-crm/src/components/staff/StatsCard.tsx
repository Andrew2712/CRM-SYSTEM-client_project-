// src/components/staff/StatsCard.tsx
"use client";

import React from "react";

type Props = {
  label:    string;
  value:    string | number;
  sub?:     string;
  icon:     React.ReactNode;
  color:    string;   // hex
  accent:   string;   // tailwind border class
  onClick?: () => void;
};

export default function StatsCard({ label, value, sub, icon, color, accent, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl border-2 ${accent} shadow-sm p-5 relative overflow-hidden transition-all
        ${onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""}`}
    >
      {/* background circle decoration */}
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10"
        style={{ background: color }} />

      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: color + "20" }}>
        <div style={{ color }}>{icon}</div>
      </div>

      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs font-semibold mt-1" style={{ color }}>{sub}</p>}
    </div>
  );
}