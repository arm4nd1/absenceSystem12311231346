import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, BookOpen, ClipboardList,
  Fingerprint, LogOut, Activity, ChevronRight,
  ShieldCheck, UserCircle, GraduationCap,
} from "lucide-react";
import { useBridgeStatus } from "../hooks/useSessions";
import AIChatWidget from "./AIChatWidget";
import clsx from "clsx";

export default function Layout() {
  const { user, logout, isAdmin, isInstructor } = useAuth();
  const navigate         = useNavigate();
  const { data: bridge } = useBridgeStatus();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const ROLE_BADGE = {
    admin:      { label: "Admin",      cls: "bg-blue-500/20 text-blue-400"      },
    instructor: { label: "Instructor", cls: "bg-indigo-500/20 text-indigo-400"  },
    student:    { label: "Student",    cls: "bg-slate-500/20 text-slate-400"    },
  };
  const badge = ROLE_BADGE[user?.role] || ROLE_BADGE.student;

  const navItems = [
    { to: "/",           icon: LayoutDashboard, label: "Dashboard",  show: true },
    { to: "/students",   icon: Users,           label: "Students",   show: isInstructor },
    { to: "/subjects",   icon: BookOpen,        label: "Subjects",   show: isInstructor },
    { to: "/attendance", icon: ClipboardList,   label: "Attendance", show: true },
    { to: "/sessions",   icon: Fingerprint,     label: "Sessions",   show: isInstructor },
    { to: "/marks",      icon: GraduationCap,   label: "Marks",      show: isInstructor },
    { to: "/reports",    icon: Activity,        label: "Reports",    show: isInstructor },
    { to: "/users",      icon: ShieldCheck,     label: "Users",      show: isAdmin },
    { to: "/profile",    icon: UserCircle,      label: "My Profile", show: !isInstructor },
  ].filter(n => n.show);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col bg-slate-900 border-r border-slate-800 shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600">
            <Fingerprint size={20} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">AttendFP</p>
            <p className="text-xs text-slate-500">Fingerprint System</p>
          </div>
        </div>

        {/* Bridge status (only shown to instructors+) */}
        {isInstructor && (
          <div className="px-4 py-3 border-b border-slate-800/60">
            <div className="flex items-center gap-2 text-xs">
              <span className={clsx(
                "w-2 h-2 rounded-full",
                bridge ? "bg-emerald-400 animate-pulse-dot" : "bg-red-500"
              )} />
              <span className={bridge ? "text-emerald-400" : "text-red-400"}>
                Bridge {bridge ? "connected" : "offline"}
              </span>
              {bridge?.sessionOpen && (
                <span className="ml-auto text-amber-400 font-semibold">● LIVE</span>
              )}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                isActive ? "sidebar-link-active" : "sidebar-link"
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              <ChevronRight size={14} className="ml-auto opacity-30" />
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-800/40">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600
                            flex items-center justify-center text-xs font-bold text-white uppercase shrink-0">
              {user?.name?.[0] || user?.email?.[0] || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">
                {user?.name || user?.email}
              </p>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                {badge.label}
              </span>
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        <Outlet />
      </main>

      {/* Floating AI chat — visible to instructors and admins */}
      {isInstructor && <AIChatWidget />}
    </div>
  );
}
