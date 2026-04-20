"use client";
import { useSession, signOut } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";



const navItems = [
  { href: "/dashboard", label: "Admin", icon: "⊞", roles: ["ADMIN"] },
  { href: "/dashboard/patients", label: "Patients", icon: "♟", roles: ["ADMIN","RECEPTIONIST","DOCTOR"] },
  { href: "/dashboard/booking", label: "Booking", icon: "◷", roles: ["ADMIN","RECEPTIONIST"] },
  { href: "/dashboard/doctor", label: "Doctor view", icon: "✚", roles: ["ADMIN","DOCTOR"] },
  { href: "/dashboard/analytics", label: "Analytics", icon: "▦", roles: ["ADMIN"] },
  { href: "/dashboard/notifications", label: "Notifications", icon: "◎", roles: ["ADMIN","RECEPTIONIST"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const role = session?.user?.role ?? "";

  const visible = navItems.filter(n => n.roles.includes(role));

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-900">Vyayamaphysio</div>
          <div className="text-xs text-gray-400 mt-0.5">Clinic management</div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <div className="text-[10px] text-gray-400 px-2 py-2 uppercase tracking-wide">Menu</div>
          {visible.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors
                ${pathname === item.href
                  ? "bg-teal-50 text-teal-700 font-medium"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}`}>
              <span className="w-4 text-center text-sm">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <div className="text-xs text-gray-500 mb-1 px-1">{session?.user?.name}</div>
          <div className="text-[10px] text-gray-400 px-1 mb-2">{role}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
  {children}
</main>
    </div>
  );
}