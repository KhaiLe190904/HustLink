import { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import { request } from "@/utils/api";
import { Button } from "@/features/authentication/components/Button/Button";
import { FiCheck, FiX, FiSearch, FiSliders, FiEye } from "react-icons/fi";

interface Company {
  id: number;
  name: string;
  slug: string;
  description: string;
  website: string;
  industry: string;
  size: string;
  headquarters: string;
  logoUrl: string | null;
  coverUrl: string | null;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  createdAt: string;
}

interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

export function CompanyAdmin() {
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");

  // Pending State
  const [pendingCompanies, setPendingCompanies] = useState<Company[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  // All Directory State
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [showConfirmModal, setShowConfirmModal] = useState<{
    show: boolean;
    companyId: number | null;
    companyName?: string;
    action: "reject" | "close" | null;
  }>({
    show: false,
    companyId: null,
    action: null,
  });

  const fetchPendingCompanies = useCallback(async () => {
    setPendingLoading(true);
    await request<Company[]>({
      endpoint: "/api/v1/admin/companies?status=PENDING",
      onSuccess: (data) => {
        setPendingCompanies(data);
        setPendingLoading(false);
      },
      onFailure: (err) => {
        toast.error(err || "Could not retrieve pending companies list");
        setPendingLoading(false);
      },
    });
  }, []);

  const fetchAllCompanies = useCallback(async () => {
    setAllLoading(true);
    const params = new URLSearchParams();
    if (appliedSearchQuery.trim()) {
      params.append("q", appliedSearchQuery.trim());
    }
    if (statusFilter !== "ALL") {
      params.append("status", statusFilter);
    }
    params.append("page", String(currentPage));
    params.append("size", String(6));

    await request<PageResponse<Company>>({
      endpoint: `/api/v1/admin/companies/paged?${params.toString()}`,
      onSuccess: (data) => {
        setAllCompanies(data.content);
        setTotalPages(data.totalPages);
        setAllLoading(false);
      },
      onFailure: (err) => {
        toast.error(err || "Could not retrieve companies list");
        setAllLoading(false);
      },
    });
  }, [appliedSearchQuery, statusFilter, currentPage]);

  useEffect(() => {
    if (activeTab === "pending") {
      fetchPendingCompanies();
    } else {
      fetchAllCompanies();
    }
  }, [activeTab, fetchPendingCompanies, fetchAllCompanies]);

  const handleApprove = async (id: number) => {
    await request({
      endpoint: `/api/v1/admin/companies/${id}/approve`,
      method: "PATCH",
      onSuccess: () => {
        toast.success("Company approved successfully!");
        if (activeTab === "pending") {
          fetchPendingCompanies();
        } else {
          fetchAllCompanies();
        }
      },
      onFailure: (err) => toast.error(err),
    });
  };

  const handleReject = async (id: number) => {
    await request({
      endpoint: `/api/v1/admin/companies/${id}/reject`,
      method: "PATCH",
      onSuccess: () => {
        toast.success("Company registration request rejected and removed.");
        if (activeTab === "pending") {
          fetchPendingCompanies();
        } else {
          fetchAllCompanies();
        }
      },
      onFailure: (err) => toast.error(err),
    });
  };

  const handleCloseActiveCompany = async (id: number) => {
    await request({
      endpoint: `/api/v1/companies/${id}`,
      method: "DELETE",
      onSuccess: () => {
        toast.success("Company closed successfully!");
        fetchAllCompanies();
      },
      onFailure: (err) => toast.error(err || "Failed to close company"),
    });
  };

  const handleReopen = async (id: number) => {
    await request({
      endpoint: `/api/v1/companies/${id}/reopen`,
      method: "PATCH",
      onSuccess: () => {
        toast.success("Company reopened successfully!");
        fetchAllCompanies();
      },
      onFailure: (err) => toast.error(err || "Failed to reopen company"),
    });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearchQuery(searchQuery.trim());
    setCurrentPage(0);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Top Banner Accent */}
      <div className="overflow-hidden rounded-3xl bg-gradient-to-r from-red-700 to-indigo-900 p-6 text-white md:p-8 shadow-xl shadow-red-950/10 mb-8">
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          Admin Dashboard
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Company Management
        </h1>
        <p className="mt-2 text-sm text-red-100/90">
          Review, approve, and audit registered companies and recruiter access.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab("pending")}
          className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "pending"
              ? "bg-red-700 text-white shadow-md shadow-red-700/10"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Pending Approvals ({pendingCompanies.length})
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
            activeTab === "all"
              ? "bg-red-700 text-white shadow-md shadow-red-700/10"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All Directory
        </button>
      </div>

      {/* Contents */}
      {activeTab === "pending" ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Pending Registrations
          </h2>

          {pendingLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
            </div>
          ) : pendingCompanies.length === 0 ? (
            <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              There are currently no pending company registration requests.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCompanies.map((company) => (
                <div
                  key={company.id}
                  className="rounded-2xl border border-slate-200 p-6 flex flex-col md:flex-row justify-between gap-6 hover:shadow-sm transition bg-white"
                >
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      {company.name}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                      <span>Industry: {company.industry || "Unknown"}</span>
                      <span>Size: {company.size}</span>
                      <span>Headquarters: {company.headquarters}</span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                      {company.description || "No description provided."}
                    </p>
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-red-700 font-semibold hover:underline block"
                      >
                        Website: {company.website}
                      </a>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-center md:self-end">
                    <button
                      type="button"
                      title="Approve"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border border-green-200 transition-colors shadow-sm"
                      onClick={() => handleApprove(company.id)}
                    >
                      <FiCheck className="h-5 w-5 stroke-[2.5]" />
                    </button>
                    <button
                      type="button"
                      title="Reject"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 transition-colors shadow-sm"
                      onClick={() =>
                        setShowConfirmModal({
                          show: true,
                          companyId: company.id,
                          action: "reject",
                        })
                      }
                    >
                      <FiX className="h-5 w-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <form onSubmit={handleSearchSubmit} className="relative">
                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by company name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-24 text-sm text-slate-800 outline-none transition focus:border-red-500"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800 transition"
                >
                  Search
                </button>
              </form>

              <div className="relative">
                <FiSliders className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-red-500 appearance-none bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active (Approved)</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="SUSPENDED">Closed (Suspended)</option>
                </select>
              </div>
            </div>
          </div>

          {/* List Table / Grid */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Company Directory
            </h2>

            {allLoading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
              </div>
            ) : allCompanies.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                No companies found matching the criteria.
              </div>
            ) : (
              <div className="space-y-4">
                {allCompanies.map((company) => (
                  <div
                    key={company.id}
                    className="rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm transition bg-white"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl border border-slate-100 overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
                        <img
                          src={
                            company.logoUrl ||
                            "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100"
                          }
                          alt={company.name}
                          className="h-full w-full object-contain p-2"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-bold text-slate-900 text-lg leading-snug">
                            {company.name}
                          </h3>
                          {company.status === "ACTIVE" ? (
                            <span className="rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-[10px] font-extrabold text-green-700 uppercase tracking-wider">
                              Active
                            </span>
                          ) : company.status === "SUSPENDED" ? (
                            <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                              Closed
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">
                              Pending
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                          {company.industry || "General"} •{" "}
                          {company.headquarters || "Unknown HQ"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
                      {company.status === "PENDING" ? (
                        <>
                          <button
                            type="button"
                            title="Approve"
                            className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border border-green-200 text-xs font-bold transition shadow-sm"
                            onClick={() => handleApprove(company.id)}
                          >
                            <FiCheck className="h-4 w-4" /> Approve
                          </button>
                          <button
                            type="button"
                            title="Reject"
                            className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 text-xs font-bold transition shadow-sm"
                            onClick={() =>
                              setShowConfirmModal({
                                show: true,
                                companyId: company.id,
                                action: "reject",
                              })
                            }
                          >
                            <FiX className="h-4 w-4" /> Reject
                          </button>
                        </>
                      ) : company.status === "SUSPENDED" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-green-50 text-green-600 hover:bg-green-600 hover:text-white border border-green-200 text-xs font-bold transition shadow-sm"
                            onClick={() => handleReopen(company.id)}
                          >
                            <FiCheck className="h-4 w-4" /> Reopen
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Link
                            to={`/companies/${company.slug}`}
                            className="block"
                          >
                            <button
                              type="button"
                              className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 text-xs font-bold transition shadow-sm"
                            >
                              <FiEye className="h-4 w-4" /> View Profile
                            </button>
                          </Link>
                          <button
                            type="button"
                            className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 text-xs font-bold transition shadow-sm"
                            onClick={() =>
                              setShowConfirmModal({
                                show: true,
                                companyId: company.id,
                                companyName: company.name,
                                action: "close",
                              })
                            }
                          >
                            <FiX className="h-4 w-4" /> Close
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(0, prev - 1))
                  }
                  disabled={currentPage === 0}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                      currentPage === i
                        ? "bg-red-700 text-white shadow-md"
                        : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
                  }
                  disabled={currentPage === totalPages - 1}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showConfirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900">
              {showConfirmModal.action === "reject"
                ? "Reject Registration Request"
                : "Close Company"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {showConfirmModal.action === "reject"
                ? "Are you sure you want to reject this company registration request? This will permanently delete the company profile and ownership mappings."
                : `Are you sure you want to close "${showConfirmModal.companyName || ""}"? This will suspend all company activities and job postings. You can reopen it later.`}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                outline
                className="my-0 px-4 py-2 border-slate-200 text-slate-700 hover:bg-slate-50 w-auto"
                onClick={() =>
                  setShowConfirmModal({
                    show: false,
                    companyId: null,
                    action: null,
                  })
                }
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="my-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white w-auto font-bold"
                onClick={async () => {
                  if (showConfirmModal.companyId !== null) {
                    if (showConfirmModal.action === "reject") {
                      await handleReject(showConfirmModal.companyId);
                    } else if (showConfirmModal.action === "close") {
                      await handleCloseActiveCompany(
                        showConfirmModal.companyId
                      );
                    }
                  }
                  setShowConfirmModal({
                    show: false,
                    companyId: null,
                    action: null,
                  });
                }}
              >
                {showConfirmModal.action === "reject"
                  ? "Confirm Reject"
                  : "Confirm Close"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
