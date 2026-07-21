import { useEffect, useState, useCallback } from "react";
import { request } from "@/utils/api";
import {
  FiSearch,
  FiSliders,
  FiUserCheck,
  FiShield,
  FiAlertTriangle,
  FiX,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: "USER" | "RECRUITER" | "ADMIN";
  banned: boolean;
  suspensionExpiresAt: string | null;
  profilePicture: string | null;
  associatedCompanyName?: string | null;
  emailVerified: boolean;
}

interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

interface CustomSelectProps<T> {
  value: T;
  onChange: (val: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
}

function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = "Select...",
  icon,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClose = () => setOpen(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [open]);

  return (
    <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-2xl border border-slate-200 py-3 px-4 text-sm text-slate-800 bg-white outline-none hover:border-slate-300 transition text-left focus:border-red-500 shadow-sm"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <span className="pointer-events-none text-slate-400">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-100 max-h-60 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full rounded-xl px-4 py-2 text-left text-sm transition font-semibold ${
                o.value === value
                  ? "bg-red-50 text-red-700 font-bold"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getPaginationRange(current: number, total: number) {
  const range: (number | string)[] = [];
  const delta = 1;

  for (let i = 0; i < total; i++) {
    if (
      i === 0 ||
      i === total - 1 ||
      (i >= current - delta && i <= current + delta)
    ) {
      range.push(i);
    } else if (range[range.length - 1] !== "...") {
      range.push("...");
    }
  }
  return range;
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "ban" | "suspend" | "role" | null;
    user: User | null;
  }>({
    show: false,
    type: null,
    user: null,
  });

  const [banReason, setBanReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendDays, setSuspendDays] = useState(7);
  const [newRole, setNewRole] = useState<"USER" | "RECRUITER" | "ADMIN" | "">(
    ""
  );

  // Recruiter warning & company fields
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [companies, setCompanies] = useState<{ id: number; name: string }[]>(
    []
  );
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | "">("");
  const [companyMode, setCompanyMode] = useState<"join" | "create">("join");
  const [newCompanyName, setNewCompanyName] = useState("");

  const checkRecruiterWarning = async (userId: number) => {
    await request<{
      isLastRecruiter: boolean;
      companies: { id: number; name: string }[];
    }>({
      endpoint: `/api/v1/admin/users/${userId}/check-last-recruiter`,
      onSuccess: (data) => {
        if (data.isLastRecruiter && data.companies.length > 0) {
          const names = data.companies.map((c) => c.name).join(", ");
          setWarningMessage(
            `With this change, the following companies (${names}) will be automatically closed. Do you want to continue?`
          );
        } else {
          setWarningMessage(null);
        }
      },
      onFailure: () => setWarningMessage(null),
    });
  };

  const fetchActiveCompanies = async () => {
    await request<{ content: { id: number; name: string }[] }>({
      endpoint: "/api/v1/admin/companies/paged?status=ACTIVE&size=200",
      onSuccess: (data) => {
        setCompanies(data.content || []);
      },
      onFailure: (err) => {
        toast.error(err || "Failed to fetch companies list");
      },
    });
  };

  useEffect(() => {
    if (
      actionModal.show &&
      actionModal.type === "role" &&
      actionModal.user &&
      newRole
    ) {
      const u = actionModal.user;
      if (u.role === "RECRUITER" && newRole !== "RECRUITER") {
        checkRecruiterWarning(u.id);
      } else {
        setWarningMessage(null);
      }
    } else {
      setWarningMessage(null);
    }
  }, [newRole, actionModal.show, actionModal.type, actionModal.user]);

  useEffect(() => {
    if (
      actionModal.show &&
      actionModal.type === "role" &&
      newRole === "RECRUITER"
    ) {
      fetchActiveCompanies();
    }
  }, [newRole, actionModal.show, actionModal.type]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (appliedSearchQuery.trim()) {
      params.append("q", appliedSearchQuery.trim());
    }
    if (roleFilter !== "ALL") {
      params.append("role", roleFilter);
    }
    if (statusFilter !== "ALL") {
      params.append("status", statusFilter);
    }
    params.append("page", String(currentPage));
    params.append("size", "10");

    await request<PageResponse<User>>({
      endpoint: `/api/v1/admin/users?${params.toString()}`,
      onSuccess: (data) => {
        setUsers(data.content);
        setTotalPages(data.totalPages);
        setLoading(false);
      },
      onFailure: (err) => {
        toast.error(err || "Failed to retrieve users list");
        setLoading(false);
      },
    });
  }, [appliedSearchQuery, roleFilter, statusFilter, currentPage]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearchQuery(searchQuery.trim());
    setCurrentPage(0);
  };

  const handleUnban = async (id: number) => {
    await request({
      endpoint: `/api/v1/admin/users/${id}/unban`,
      method: "POST",
      onSuccess: () => {
        toast.success("User ban/suspension lifted successfully.");
        fetchUsers();
      },
      onFailure: (err) => toast.error(err),
    });
  };

  const handleBan = async () => {
    if (!actionModal.user) return;
    await request({
      endpoint: `/api/v1/admin/users/${actionModal.user.id}/ban`,
      method: "POST",
      body: JSON.stringify({
        reason: banReason || "Violated community standards permanently.",
      }),
      onSuccess: () => {
        toast.success("User permanently banned.");
        setBanReason("");
        setActionModal({ show: false, type: null, user: null });
        fetchUsers();
      },
      onFailure: (err) => toast.error(err),
    });
  };

  const handleSuspend = async () => {
    if (!actionModal.user) return;
    await request({
      endpoint: `/api/v1/admin/users/${actionModal.user.id}/suspend`,
      method: "POST",
      body: JSON.stringify({
        reason: suspendReason || "Violated community standards.",
        days: suspendDays,
      }),
      onSuccess: () => {
        toast.success(`User suspended for ${suspendDays} days.`);
        setSuspendReason("");
        setActionModal({ show: false, type: null, user: null });
        fetchUsers();
      },
      onFailure: (err) => toast.error(err),
    });
  };

  const handleRoleChange = async () => {
    if (!actionModal.user) return;

    const body: Record<string, string | number> = { role: newRole };
    if (newRole === "RECRUITER") {
      if (companyMode === "join") {
        if (!selectedCompanyId) {
          toast.error("Please select a company to join.");
          return;
        }
        body.companyId = selectedCompanyId;
      } else {
        if (!newCompanyName.trim()) {
          toast.error("Please enter a company name.");
          return;
        }
        body.companyName = newCompanyName.trim();
      }
    }

    await request({
      endpoint: `/api/v1/admin/users/${actionModal.user.id}/role`,
      method: "PATCH",
      body: JSON.stringify(body),
      onSuccess: () => {
        toast.success(`User role updated to ${newRole}.`);
        setActionModal({ show: false, type: null, user: null });
        setSelectedCompanyId("");
        setNewCompanyName("");
        fetchUsers();
      },
      onFailure: (err) => toast.error(err),
    });
  };

  const getUserStatus = (user: User) => {
    if (user.banned) {
      return (
        <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[10px] font-extrabold text-red-700 uppercase tracking-wider">
          Banned
        </span>
      );
    }
    if (user.suspensionExpiresAt) {
      const expiry = new Date(user.suspensionExpiresAt);
      if (expiry > new Date()) {
        const diffDays = Math.ceil(
          (expiry.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return (
          <span
            className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700 uppercase tracking-wider"
            title={`Until ${expiry.toLocaleString()}`}
          >
            Suspended ({diffDays}d)
          </span>
        );
      }
    }
    if (user.emailVerified === false) {
      return (
        <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
          Inactive
        </span>
      );
    }
    return (
      <span className="rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-[10px] font-extrabold text-green-700 uppercase tracking-wider">
        Active
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-24 text-sm text-slate-800 outline-none transition focus:border-red-500"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-red-700 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-800 transition cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <CustomSelect
              value={roleFilter}
              onChange={(val) => {
                setRoleFilter(val);
                setCurrentPage(0);
              }}
              options={[
                { value: "ALL", label: "All Roles" },
                { value: "USER", label: "User (Alumni/Student)" },
                { value: "RECRUITER", label: "Recruiter" },
              ]}
              icon={<FiSliders className="text-slate-400" />}
            />
          </div>

          <div>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(0);
              }}
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "ACTIVE", label: "Active Users" },
                { value: "INACTIVE", label: "Inactive Users" },
                { value: "SUSPENDED", label: "Suspended Users" },
                { value: "BANNED", label: "Banned Users" },
              ]}
              icon={<FiSliders className="text-slate-400" />}
            />
          </div>
        </div>
      </div>

      {/* Users List Container */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-6">User Accounts</h2>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            No users match your criteria.
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm transition bg-white"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={item.profilePicture || "/doc1.png"}
                    alt={item.firstName}
                    className="h-12 w-12 rounded-full object-cover flex-shrink-0 border border-slate-100 bg-slate-50"
                  />
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        {item.firstName} {item.lastName}
                      </h3>
                      {getUserStatus(item)}
                    </div>
                    <p className="text-xs text-slate-400 font-semibold mt-1">
                      {item.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="inline-block rounded-lg bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                        {item.role}
                      </span>
                      {item.role === "RECRUITER" &&
                        item.associatedCompanyName && (
                          <span className="inline-block rounded-lg bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-extrabold text-blue-600 uppercase tracking-wider">
                            Company: {item.associatedCompanyName}
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end flex-wrap">
                  {item.banned ||
                  (item.suspensionExpiresAt &&
                    new Date(item.suspensionExpiresAt) > new Date()) ? (
                    <button
                      type="button"
                      className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border border-green-200 text-xs font-bold transition shadow-sm cursor-pointer"
                      onClick={() => handleUnban(item.id)}
                    >
                      <FiUserCheck className="h-4 w-4" /> Unban / Unsuspend
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white border border-amber-200 text-xs font-bold transition shadow-sm cursor-pointer"
                        onClick={async () => {
                          setActionModal({
                            show: true,
                            type: "suspend",
                            user: item,
                          });
                          setSuspendReason("");
                          setSuspendDays(7);
                          setWarningMessage(null);
                          if (item.role === "RECRUITER") {
                            await checkRecruiterWarning(item.id);
                          }
                        }}
                      >
                        <FiAlertTriangle className="h-4 w-4" /> Suspend
                      </button>
                      <button
                        type="button"
                        className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 text-xs font-bold transition shadow-sm cursor-pointer"
                        onClick={async () => {
                          setActionModal({
                            show: true,
                            type: "ban",
                            user: item,
                          });
                          setBanReason("");
                          setWarningMessage(null);
                          if (item.role === "RECRUITER") {
                            await checkRecruiterWarning(item.id);
                          }
                        }}
                      >
                        <FiShield className="h-4 w-4" /> Ban
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs font-bold transition shadow-sm cursor-pointer"
                    onClick={() => {
                      setActionModal({ show: true, type: "role", user: item });
                      setNewRole(item.role);
                      setWarningMessage(null);
                      setSelectedCompanyId("");
                      setNewCompanyName("");
                    }}
                  >
                    Change Role
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>

            {getPaginationRange(currentPage, totalPages).map((p, index) => {
              if (p === "...") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="px-3 py-2 text-slate-400 text-sm font-bold"
                  >
                    ...
                  </span>
                );
              }
              const pageIndex = p as number;
              return (
                <button
                  key={pageIndex}
                  onClick={() => setCurrentPage(pageIndex)}
                  className={`rounded-xl px-4 py-2 text-sm font-bold transition cursor-pointer ${
                    currentPage === pageIndex
                      ? "bg-red-700 text-white shadow-md"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {pageIndex + 1}
                </button>
              );
            })}

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
              }
              disabled={currentPage === totalPages - 1}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Action Modals */}
      {actionModal.show && actionModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                {actionModal.type === "ban" && "Permanently Ban User"}
                {actionModal.type === "suspend" && "Temporarily Suspend User"}
                {actionModal.type === "role" && "Update Account Role"}
              </h3>
              <button
                onClick={() =>
                  setActionModal({ show: false, type: null, user: null })
                }
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition cursor-pointer"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <img
                  src={actionModal.user.profilePicture || "/doc1.png"}
                  alt={actionModal.user.firstName}
                  className="h-10 w-10 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">
                    {actionModal.user.firstName} {actionModal.user.lastName}
                  </h4>
                  <p className="text-xs text-slate-400 font-semibold">
                    {actionModal.user.email}
                  </p>
                </div>
              </div>

              {warningMessage && (
                <div className="flex gap-2 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs font-semibold text-amber-800">
                  <FiAlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600 animate-pulse" />
                  <span>{warningMessage}</span>
                </div>
              )}

              {actionModal.type === "ban" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Reason for Ban
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter reason for permanent ban (required, will be logged)"
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 outline-none transition focus:border-red-500"
                  />
                  <p className="text-[14px] text-red-500 font-semibold leading-relaxed">
                    Warning: A banned user is blocked permanently from
                    authentication.
                  </p>
                </div>
              )}

              {actionModal.type === "suspend" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Suspension Duration (Days)
                    </label>
                    <CustomSelect
                      value={suspendDays}
                      onChange={setSuspendDays}
                      options={[
                        { value: 1, label: "1 Day" },
                        { value: 3, label: "3 Days" },
                        { value: 7, label: "7 Days" },
                        { value: 14, label: "14 Days" },
                        { value: 30, label: "30 Days" },
                        { value: 90, label: "90 Days" },
                      ]}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Reason for Suspension
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Enter reason for temporary suspension (required)"
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 outline-none transition focus:border-red-500"
                    />
                    <p className="text-[14px] text-amber-600 font-semibold leading-relaxed">
                      Suspension will block the user until the period expires.
                    </p>
                  </div>
                </div>
              )}

              {actionModal.type === "role" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">
                      Target Role
                    </label>
                    <CustomSelect
                      value={newRole}
                      onChange={(val) =>
                        setNewRole(val as "USER" | "RECRUITER" | "ADMIN")
                      }
                      options={[
                        { value: "USER", label: "User (Standard account)" },
                        { value: "RECRUITER", label: "Recruiter" },
                        { value: "ADMIN", label: "Administrator" },
                      ]}
                    />
                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      Promotion to Admin gives this user access to all
                      configurations, user actions, and reports.
                    </p>
                  </div>

                  {newRole === "RECRUITER" && (
                    <div className="space-y-4 border-t border-slate-100 pt-3">
                      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">
                        Company Association Mode
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="companyMode"
                            checked={companyMode === "join"}
                            onChange={() => setCompanyMode("join")}
                            className="accent-blue-600"
                          />
                          Join Existing Company
                        </label>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="companyMode"
                            checked={companyMode === "create"}
                            onChange={() => setCompanyMode("create")}
                            className="accent-blue-600"
                          />
                          Create New Company
                        </label>
                      </div>

                      {companyMode === "join" ? (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase block">
                            Select Company
                          </label>
                          <CustomSelect
                            value={selectedCompanyId}
                            onChange={(val) => setSelectedCompanyId(val)}
                            options={[
                              {
                                value: "",
                                label: "-- Choose an active company --",
                              },
                              ...companies.map((c) => ({
                                value: c.id,
                                label: c.name,
                              })),
                            ]}
                          />
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 uppercase block">
                            New Company Name
                          </label>
                          <input
                            type="text"
                            placeholder="Enter new company name..."
                            value={newCompanyName}
                            onChange={(e) => setNewCompanyName(e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 outline-none transition focus:border-red-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-50 pt-4">
              <Button
                type="button"
                outline
                className="my-0 px-4 py-2 border-slate-200 text-slate-700 hover:bg-slate-50 w-auto text-xs"
                onClick={() =>
                  setActionModal({ show: false, type: null, user: null })
                }
              >
                Cancel
              </Button>
              <Button
                type="button"
                className={`my-0 px-5 py-2 text-white w-auto text-xs font-bold ${
                  actionModal.type === "ban"
                    ? "bg-red-600 hover:bg-red-700"
                    : actionModal.type === "suspend"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-blue-600 hover:bg-blue-700"
                }`}
                onClick={async () => {
                  if (actionModal.type === "ban") {
                    await handleBan();
                  } else if (actionModal.type === "suspend") {
                    await handleSuspend();
                  } else if (actionModal.type === "role") {
                    await handleRoleChange();
                  }
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
