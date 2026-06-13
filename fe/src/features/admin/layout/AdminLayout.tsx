import { NavLink, Outlet, useLocation, Navigate } from "react-router-dom";
import {
  FiTrendingUp,
  FiUsers,
  FiAlertTriangle,
  FiBriefcase,
  FiDatabase,
} from "react-icons/fi";
import { usePageTitle } from "@/hooks/usePageTitle";

export function AdminLayout() {
  usePageTitle("Admin Console");
  const location = useLocation();

  const menuItems = [
    { to: "/admin/overview", label: "Overview & Stats", icon: FiTrendingUp },
    { to: "/admin/users", label: "User Accounts", icon: FiUsers },
    { to: "/admin/reports", label: "Content Reports", icon: FiAlertTriangle },
    { to: "/admin/companies", label: "Company Approvals", icon: FiBriefcase },
    { to: "/admin/rag", label: "RAG Configuration", icon: FiDatabase },
  ];

  // If visiting raw /admin, redirect to /admin/overview
  if (location.pathname === "/admin" || location.pathname === "/admin/") {
    return <Navigate to="/admin/overview" replace />;
  }

  return (
    <div className="grid gap-8 grid-cols-1 md:grid-cols-[16rem_1fr] md:items-start">
      {/* Admin Sidebar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm space-y-1">
        <div className="px-4 py-3 mb-2 border-b border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Admin Control Center
          </p>
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition-all text-sm cursor-pointer ${
                  isActive
                    ? "bg-red-50 text-red-700 font-bold"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>

      {/* Admin Workspace */}
      <div className="space-y-6">
        <Outlet />
      </div>
    </div>
  );
}
