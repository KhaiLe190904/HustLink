import { useEffect, useState, useCallback } from "react";
import { request } from "@/utils/api";
import {
  FiSliders,
  FiAlertTriangle,
  FiCheckCircle,
  FiTrash2,
  FiSlash,
  FiX,
  FiExternalLink,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string | null;
}

interface ContentReport {
  id: number;
  reporter: User;
  targetType: "POST" | "COMMENT" | "USER";
  targetId: number;
  reason: "SPAM" | "TOXICITY" | "INAPPROPRIATE" | "PLAGIARISM" | "OTHER";
  details: string;
  status: "PENDING" | "ACTION_TAKEN" | "DISMISSED";
  createdAt: string;
  reviewedBy: User | null;
  reviewedAt: string | null;
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

export function AdminReports() {
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [targetTypeFilter, setTargetTypeFilter] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Review Modal
  const [reviewModal, setReviewModal] = useState<{
    show: boolean;
    report: ContentReport | null;
    contentPreview: string | null;
    authorName: string | null;
    authorId: number | null;
    loadingPreview: boolean;
  }>({
    show: false,
    report: null,
    contentPreview: null,
    authorName: null,
    authorId: null,
    loadingPreview: false,
  });

  const [reviewAction, setReviewAction] = useState<
    "DISMISS" | "REMOVE_CONTENT" | "SUSPEND" | "BAN"
  >("DISMISS");
  const [reviewNotes, setReviewNotes] = useState("");
  const [suspensionDays, setSuspensionDays] = useState(7);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") {
      params.append("status", statusFilter);
    }
    if (targetTypeFilter !== "ALL") {
      params.append("targetType", targetTypeFilter);
    }
    params.append("page", String(currentPage));
    params.append("size", "10");

    await request<PageResponse<ContentReport>>({
      endpoint: `/api/v1/admin/reports?${params.toString()}`,
      onSuccess: (data) => {
        setReports(data.content);
        setTotalPages(data.totalPages);
        setLoading(false);
      },
      onFailure: (err) => {
        toast.error(err || "Failed to retrieve reports list");
        setLoading(false);
      },
    });
  }, [statusFilter, targetTypeFilter, currentPage]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Load preview data when opening modal
  const handleOpenReviewModal = async (report: ContentReport) => {
    setReviewModal({
      show: true,
      report,
      contentPreview: null,
      authorName: null,
      authorId: null,
      loadingPreview: true,
    });
    setReviewAction("DISMISS");
    setReviewNotes("");
    setSuspensionDays(7);

    let previewText = "No direct preview available.";
    let authorName: string | null = null;
    let authorId: number | null = null;

    try {
      if (report.targetType === "POST") {
        await request<{
          content: string | null;
          author: { id: number; firstName: string; lastName: string };
        }>({
          endpoint: `/api/v1/feed/posts/${report.targetId}`,
          onSuccess: (post) => {
            previewText = post.content || "[Empty post content]";
            authorName = `${post.author.firstName} ${post.author.lastName}`;
            authorId = post.author.id;
          },
          onFailure: () => {
            previewText =
              "[Content could not be retrieved (maybe deleted or hidden)]";
          },
        });
      } else if (report.targetType === "USER") {
        await request<User>({
          endpoint: `/api/v1/authentication/users/${report.targetId}`,
          onSuccess: (user) => {
            previewText = `User profile of ${user.firstName} ${user.lastName}`;
            authorName = `${user.firstName} ${user.lastName}`;
            authorId = user.id;
          },
          onFailure: () => {
            previewText = "[User profile not found]";
          },
        });
      }
    } catch (e) {
      console.error(e);
    }

    setReviewModal((prev) => ({
      ...prev,
      contentPreview: previewText,
      authorName,
      authorId,
      loadingPreview: false,
    }));
  };

  const handleConfirmReview = async () => {
    if (!reviewModal.report) return;

    await request({
      endpoint: `/api/v1/admin/reports/${reviewModal.report.id}/review`,
      method: "PATCH",
      body: JSON.stringify({
        action: reviewAction,
        notes: reviewNotes || "Reviewed by admin.",
        suspensionDays,
      }),
      onSuccess: () => {
        toast.success("Moderation action applied successfully.");
        setReviewModal({
          show: false,
          report: null,
          contentPreview: null,
          authorName: null,
          authorId: null,
          loadingPreview: false,
        });
        fetchReports();
      },
      onFailure: (err) => toast.error(err),
    });
  };

  const getReasonLabelColor = (reason: string) => {
    switch (reason) {
      case "TOXICITY":
        return "bg-red-50 text-red-700 border-red-100";
      case "INAPPROPRIATE":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "SPAM":
        return "bg-slate-50 text-slate-700 border-slate-100";
      default:
        return "bg-blue-50 text-blue-700 border-blue-100";
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <CustomSelect
              value={statusFilter}
              onChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(0);
              }}
              options={[
                { value: "PENDING", label: "Pending Reports" },
                { value: "ACTION_TAKEN", label: "Action Taken" },
                { value: "DISMISSED", label: "Dismissed Reports" },
                { value: "ALL", label: "All Reports" },
              ]}
              icon={<FiSliders className="text-slate-400" />}
            />
          </div>

          <div>
            <CustomSelect
              value={targetTypeFilter}
              onChange={(val) => {
                setTargetTypeFilter(val);
                setCurrentPage(0);
              }}
              options={[
                { value: "ALL", label: "All Target Types" },
                { value: "POST", label: "Post Content" },
                { value: "COMMENT", label: "Comment Content" },
                { value: "USER", label: "User Profiles" },
              ]}
              icon={<FiSliders className="text-slate-400" />}
            />
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-6">
          Content Reports
        </h2>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
          </div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
            No reports found matching these filters.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="rounded-2xl border border-slate-200 p-5 flex flex-col md:flex-row justify-between items-start gap-4 hover:shadow-sm transition bg-white"
              >
                <div className="space-y-2 flex-grow">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-xs text-slate-400">
                      REPORT #{report.id}
                    </span>
                    <span className="rounded-lg bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9px] font-extrabold text-slate-600 uppercase tracking-wider">
                      {report.targetType}
                    </span>
                    <span
                      className={`rounded-lg border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${getReasonLabelColor(report.reason)}`}
                    >
                      {report.reason}
                    </span>

                    {report.status === "PENDING" && (
                      <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[9px] font-extrabold text-amber-700 uppercase tracking-wider ml-auto md:ml-0">
                        Pending
                      </span>
                    )}
                    {report.status === "ACTION_TAKEN" && (
                      <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[9px] font-extrabold text-red-700 uppercase tracking-wider ml-auto md:ml-0">
                        Action Taken
                      </span>
                    )}
                    {report.status === "DISMISSED" && (
                      <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-0.5 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider ml-auto md:ml-0">
                        Dismissed
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-700 leading-relaxed font-medium">
                    &ldquo;{report.details || "No details provided"}&rdquo;
                  </p>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 font-semibold">
                    <span>
                      Reporter: {report.reporter.firstName}{" "}
                      {report.reporter.lastName} ({report.reporter.email})
                    </span>
                    <span>•</span>
                    <span>
                      Date: {new Date(report.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {report.status !== "PENDING" && report.reviewedBy && (
                    <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-500 flex items-center gap-2">
                      <FiCheckCircle className="text-slate-400 h-4 w-4 shrink-0" />
                      <span>
                        Reviewed by{" "}
                        <strong className="font-semibold text-slate-700">
                          {report.reviewedBy.firstName}{" "}
                          {report.reviewedBy.lastName}
                        </strong>{" "}
                        on{" "}
                        {report.reviewedAt
                          ? new Date(report.reviewedAt).toLocaleString()
                          : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center shrink-0 self-end md:self-center">
                  {report.status === "PENDING" ? (
                    <button
                      type="button"
                      className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 text-xs font-bold transition shadow-sm cursor-pointer"
                      onClick={() => handleOpenReviewModal(report)}
                    >
                      <FiAlertTriangle className="h-4 w-4" /> Review & Action
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex h-9 px-4 items-center justify-center gap-1 rounded-xl bg-slate-50 text-slate-350 border border-slate-100 text-xs font-bold transition cursor-not-allowed"
                    >
                      Resolved
                    </button>
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
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition cursor-pointer ${
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
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewModal.show && reviewModal.report && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FiAlertTriangle className="text-red-600" />
                <span>Review Report #{reviewModal.report.id}</span>
              </h3>
              <button
                onClick={() =>
                  setReviewModal({
                    show: false,
                    report: null,
                    contentPreview: null,
                    authorName: null,
                    authorId: null,
                    loadingPreview: false,
                  })
                }
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition cursor-pointer"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 border border-slate-100 rounded-2xl font-semibold text-slate-500">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase">
                    Target ID / Type
                  </span>
                  <span className="text-slate-700 font-bold">
                    {reviewModal.report.targetType}{" "}
                    {reviewModal.report.targetId}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase">
                    Reason
                  </span>
                  <span className="text-slate-700 font-bold">
                    {reviewModal.report.reason}
                  </span>
                </div>
              </div>

              {/* Reported Content Preview Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Reported Content Details
                </label>
                {reviewModal.loadingPreview ? (
                  <div className="h-16 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-700 border-t-transparent"></div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50/20 border border-red-100/50 rounded-2xl text-sm text-slate-800 font-medium leading-relaxed max-h-[140px] overflow-y-auto whitespace-pre-wrap">
                    {reviewModal.contentPreview}
                  </div>
                )}
                {reviewModal.authorName && reviewModal.authorId && (
                  <div className="flex items-center justify-between mt-1 text-xs">
                    <span className="text-slate-400 font-medium">
                      Author:{" "}
                      <strong className="text-slate-700 font-bold">
                        {reviewModal.authorName}
                      </strong>
                    </span>
                    <a
                      href={`/profile/${reviewModal.authorId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 font-bold"
                    >
                      View Profile <FiExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Action Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Select Action
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      reviewAction === "DISMISS"
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setReviewAction("DISMISS")}
                  >
                    <FiCheckCircle className="h-4 w-4" /> Dismiss Report
                  </button>

                  <button
                    type="button"
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      reviewAction === "REMOVE_CONTENT"
                        ? "bg-red-700 text-white border-red-700"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setReviewAction("REMOVE_CONTENT")}
                  >
                    <FiTrash2 className="h-4 w-4" /> Hide Content
                  </button>

                  <button
                    type="button"
                    disabled={!reviewModal.authorId}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      reviewAction === "SUSPEND"
                        ? "bg-amber-600 text-white border-amber-600"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setReviewAction("SUSPEND")}
                  >
                    <FiAlertTriangle className="h-4 w-4" /> Suspend Author
                  </button>

                  <button
                    type="button"
                    disabled={!reviewModal.authorId}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                      reviewAction === "BAN"
                        ? "bg-red-800 text-white border-red-800"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                    onClick={() => setReviewAction("BAN")}
                  >
                    <FiSlash className="h-4 w-4" /> Ban Author
                  </button>
                </div>
              </div>

              {/* Suspension duration selection */}
              {reviewAction === "SUSPEND" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Suspension Days
                  </label>
                  <CustomSelect
                    value={suspensionDays}
                    onChange={setSuspensionDays}
                    options={[
                      { value: 1, label: "1 Day" },
                      { value: 3, label: "3 Days" },
                      { value: 7, label: "7 Days" },
                      { value: 14, label: "14 Days" },
                      { value: 30, label: "30 Days" },
                    ]}
                  />
                </div>
              )}

              {/* Review notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Admin Action Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter moderation details or suspension reason..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 outline-none transition focus:border-red-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-50 pt-4">
              <Button
                type="button"
                outline
                className="my-0 px-4 py-2 border-slate-200 text-slate-700 hover:bg-slate-50 w-auto text-xs"
                onClick={() =>
                  setReviewModal({
                    show: false,
                    report: null,
                    contentPreview: null,
                    authorName: null,
                    authorId: null,
                    loadingPreview: false,
                  })
                }
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="my-0 px-5 py-2 bg-red-700 hover:bg-red-800 text-white w-auto text-xs font-bold"
                onClick={handleConfirmReview}
              >
                Apply Resolution
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
