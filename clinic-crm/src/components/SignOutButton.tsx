'use client';

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut({ 
      redirect: false   // ← Important change
    });
    
    // Manually redirect after sign out
    router.push("/auth/login");
    router.refresh(); // Force refresh session state
  };

  return (
    <button
      onClick={handleSignOut}
      className="px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 border border-red-200 rounded-lg transition-all"
    >
      Sign Out
    </button>
  );
}