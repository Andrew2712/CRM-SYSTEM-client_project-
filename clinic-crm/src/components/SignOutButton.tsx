"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({
      redirect: false,
    });

    router.push("/auth/login"); // ✅ correct route
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
        bg-white/10 hover:bg-white/20 border border-white/15 hover:border-white/25
        text-white/70 hover:text-white
        text-xs font-semibold transition-all duration-150 group"
    >
      <svg
        className="w-3.5 h-3.5 text-white/50 group-hover:text-white transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
      Sign Out
    </button>
  );
}