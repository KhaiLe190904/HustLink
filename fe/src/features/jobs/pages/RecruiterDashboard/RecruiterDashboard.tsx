import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import { Button } from "@/features/authentication/components/Button/Button";
import { JobResponse } from "../../types/jobs";
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiEye,
  FiActivity,
  FiArchive,
  FiFolder,
  FiSend,
  FiSearch,
  FiArrowUp,
  FiArrowDown,
} from "react-icons/fi";

const friendlyDeleteError = (error: string) => {
  const lowerError = error.toLowerCase();
  if (
    lowerError.includes("reference constraint") ||
    lowerError.includes("job_applications") ||
    lowerError.includes("foreign key") ||
    lowerError.includes("fkqt4m3c9")
  ) {
    return "This job posting cannot be deleted because it already contains candidate applications.";
  }
  return error;
};

export function RecruiterDashboard() {
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    type: "close" | "delete" | null;
    jobId: number | null;
    title: string;
    message: string;
  }>({
    show: false,
    type: null,
    jobId: null,
    title: "",
    message: "",
  });

  // Filter and Search States
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PUBLISHED" | "DRAFT" | "CLOSED"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "createdNewest" | "createdOldest" | "deadlineSoonest" | "deadlineLatest"
  >("createdNewest");

  // Client-side filtering and sorting
  const filteredJobs = jobs
    .filter((job) => {
      // 1. Status Filter
      if (statusFilter !== "ALL" && job.status !== statusFilter) {
        return false;
      }

      // 2. Search Query (Title, Location, or Skills)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = job.title && job.title.toLowerCase().includes(q);
        const matchLocation =
          job.location && job.location.toLowerCase().includes(q);
        const matchSkills =
          job.skills &&
          Array.isArray(job.skills) &&
          job.skills.some((s) => s && s.toLowerCase().includes(q));
        if (!matchTitle && !matchLocation && !matchSkills) {
          return false;
        }
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "createdNewest") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }
      if (sortBy === "createdOldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
      if (sortBy === "deadlineSoonest") {
        if (!a.applicationDeadline) return 1;
        if (!b.applicationDeadline) return -1;
        return (
          new Date(a.applicationDeadline).getTime() -
          new Date(b.applicationDeadline).getTime()
        );
      }
      if (sortBy === "deadlineLatest") {
        if (!a.applicationDeadline) return 1;
        if (!b.applicationDeadline) return -1;
        return (
          new Date(b.applicationDeadline).getTime() -
          new Date(a.applicationDeadline).getTime()
        );
      }
      return 0;
    });

  const handleSort = (field: "created" | "deadline") => {
    if (field === "created") {
      setSortBy((prev) =>
        prev === "createdNewest" ? "createdOldest" : "createdNewest"
      );
    } else if (field === "deadline") {
      setSortBy((prev) =>
        prev === "deadlineSoonest" ? "deadlineLatest" : "deadlineSoonest"
      );
    }
  };

  const fetchMyJobs = useCallback(async () => {
    setLoading(true);
    await request<JobResponse[]>({
      endpoint: "/api/v1/jobs/my-jobs",
      onSuccess: (data) => {
        setJobs(data);
        setLoading(false);
      },
      onFailure: (err) => {
        toast.error("Could not retrieve your job listings: " + err);
        setLoading(false);
      },
    });
  }, []);

  useEffect(() => {
    fetchMyJobs();
  }, [fetchMyJobs]);

  const handlePublish = async (id: number) => {
    await request({
      endpoint: `/api/v1/jobs/${id}/publish`,
      method: "PATCH",
      onSuccess: () => {
        toast.success("Job posting published successfully!");
        fetchMyJobs();
      },
      onFailure: (err) => toast.error(err),
    });
  };

  const triggerConfirm = (id: number, type: "close" | "delete") => {
    setConfirmModal({
      show: true,
      type,
      jobId: id,
      title: type === "close" ? "Close Job Posting" : "Delete Job Posting",
      message:
        type === "close"
          ? "Are you sure you want to close this job posting? Candidates will no longer be able to apply."
          : "Are you sure you want to permanently delete this job posting and all associated applications? This action cannot be undone.",
    });
  };

  const handleConfirmAction = async () => {
    const { type, jobId } = confirmModal;
    if (!jobId) return;

    if (type === "close") {
      await request({
        endpoint: `/api/v1/jobs/${jobId}/close`,
        method: "PATCH",
        onSuccess: () => {
          toast.success("Job posting closed!");
          fetchMyJobs();
        },
        onFailure: (err) => toast.error(err),
      });
    } else if (type === "delete") {
      await request({
        endpoint: `/api/v1/jobs/${jobId}`,
        method: "DELETE",
        onSuccess: () => {
          toast.success("Job posting deleted successfully.");
          setJobs((prev) => prev.filter((j) => j.id !== jobId));
        },
        onFailure: (err) => toast.error(friendlyDeleteError(err)),
      });
    }
    setConfirmModal({
      show: false,
      type: null,
      jobId: null,
      title: "",
      message: "",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <span className="bg-slate-100 border border-slate-200 text-slate-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Draft
          </span>
        );
      case "PUBLISHED":
        return (
          <span className="bg-green-50 border border-green-200 text-green-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Active
          </span>
        );
      case "CLOSED":
        return (
          <span className="bg-red-50 border border-red-200 text-red-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Closed
          </span>
        );
      default:
        return null;
    }
  };

  // Metrics calculation
  const totalJobs = jobs.length;
  const activeJobs = jobs.filter((j) => j.status === "PUBLISHED").length;
  const draftJobs = jobs.filter((j) => j.status === "DRAFT").length;
  const closedJobs = jobs.filter((j) => j.status === "CLOSED").length;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            Recruitment Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            View job postings, monitor application statuses, and manage
            candidate profiles.
          </p>
        </div>
        <Link to="/jobs/new">
          <Button
            type="button"
            className="my-0 bg-red-700 hover:bg-red-800 text-white flex items-center gap-1.5 px-6"
          >
            <FiPlus className="stroke-[3]" /> Post a Job
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-5 grid-cols-2 md:grid-cols-4 mb-8">
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={`text-left w-full rounded-2xl border p-5 shadow-sm flex items-center gap-4 transition-all duration-200 outline-none ${
            statusFilter === "ALL"
              ? "border-red-500 ring-2 ring-red-50 bg-red-50/10"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
          }`}
        >
          <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <FiFolder className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Total Jobs
            </p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">
              {totalJobs}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("PUBLISHED")}
          className={`text-left w-full rounded-2xl border p-5 shadow-sm flex items-center gap-4 transition-all duration-200 outline-none ${
            statusFilter === "PUBLISHED"
              ? "border-red-500 ring-2 ring-red-50 bg-red-50/10"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
          }`}
        >
          <div className="h-10 w-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <FiActivity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Active
            </p>
            <p className="text-2xl font-black text-green-700 mt-0.5">
              {activeJobs}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("DRAFT")}
          className={`text-left w-full rounded-2xl border p-5 shadow-sm flex items-center gap-4 transition-all duration-200 outline-none ${
            statusFilter === "DRAFT"
              ? "border-red-500 ring-2 ring-red-50 bg-red-50/10"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
          }`}
        >
          <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <FiEdit className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Drafts
            </p>
            <p className="text-2xl font-black text-slate-700 mt-0.5">
              {draftJobs}
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("CLOSED")}
          className={`text-left w-full rounded-2xl border p-5 shadow-sm flex items-center gap-4 transition-all duration-200 outline-none ${
            statusFilter === "CLOSED"
              ? "border-red-500 ring-2 ring-red-50 bg-red-50/10"
              : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
          }`}
        >
          <div className="h-10 w-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <FiArchive className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Closed
            </p>
            <p className="text-2xl font-black text-red-700 mt-0.5">
              {closedJobs}
            </p>
          </div>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by title, location, skill..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            spellCheck={false}
            className="w-full rounded-2xl border border-slate-200 py-2.5 pl-11 pr-4 text-xs text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
        </div>

        {(searchQuery || statusFilter !== "ALL") && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("ALL");
              setSortBy("createdNewest");
            }}
            className="text-xs font-bold text-red-700 hover:text-red-800 transition underline whitespace-nowrap pl-2"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Main Content Card */}
      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-base font-semibold">
              You haven't posted any jobs yet.
            </p>
            <p className="text-sm mt-1">
              Post your first job to start attracting candidates.
            </p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-base font-semibold">
              No jobs matched your filter criteria.
            </p>
            <p className="text-sm mt-1">
              Try resetting or adjusting your search filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">Job Title</th>
                  <th className="px-6 py-4">Status</th>
                  <th
                    className="px-6 py-4 cursor-pointer hover:text-red-700 transition select-none"
                    onClick={() => handleSort("created")}
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      MozUserSelect: "none",
                    }}
                  >
                    <div
                      className="flex items-center gap-1 select-none"
                      style={{ userSelect: "none" }}
                    >
                      Created Date
                      {sortBy === "createdNewest" && (
                        <FiArrowDown className="inline h-3.5 w-3.5 text-red-700" />
                      )}
                      {sortBy === "createdOldest" && (
                        <FiArrowUp className="inline h-3.5 w-3.5 text-red-700" />
                      )}
                    </div>
                  </th>
                  <th
                    className="px-6 py-4 cursor-pointer hover:text-red-700 transition select-none"
                    onClick={() => handleSort("deadline")}
                    style={{
                      userSelect: "none",
                      WebkitUserSelect: "none",
                      MozUserSelect: "none",
                    }}
                  >
                    <div
                      className="flex items-center gap-1 select-none"
                      style={{ userSelect: "none" }}
                    >
                      Deadline
                      {sortBy === "deadlineSoonest" && (
                        <FiArrowUp className="inline h-3.5 w-3.5 text-red-700" />
                      )}
                      {sortBy === "deadlineLatest" && (
                        <FiArrowDown className="inline h-3.5 w-3.5 text-red-700" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-700 font-medium">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4.5">
                      <div className="font-bold text-slate-900">
                        {job.title}
                      </div>
                      <div className="text-xs text-slate-400 font-semibold mt-0.5">
                        {job.location}
                        {job.location && job.skills && job.skills.length > 0
                          ? " • "
                          : ""}
                        {job.skills && Array.isArray(job.skills)
                          ? job.skills.slice(0, 3).join(", ")
                          : ""}
                      </div>
                      {job.status === "PUBLISHED" &&
                        job.applicationDeadline &&
                        new Date(job.applicationDeadline) < new Date() && (
                          <div className="mt-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-0.5 flex items-center gap-1 w-fit font-bold">
                            ⚠️ Expired. Please close or edit the deadline to
                            keep receiving applications.
                          </div>
                        )}
                    </td>
                    <td className="px-6 py-4.5">
                      {getStatusBadge(job.status)}
                    </td>
                    <td className="px-6 py-4.5 text-xs text-slate-500">
                      {new Date(job.createdAt).toLocaleDateString("en-US")}
                    </td>
                    <td className="px-6 py-4.5 text-xs text-slate-500">
                      {job.applicationDeadline
                        ? new Date(job.applicationDeadline).toLocaleDateString(
                            "en-US"
                          )
                        : "No deadline"}
                    </td>
                    <td className="px-6 py-4.5 text-right whitespace-nowrap">
                      <div className="flex justify-end items-center gap-2">
                        {job.status === "DRAFT" && (
                          <Button
                            type="button"
                            size="small"
                            className="my-0 px-3 bg-green-600 hover:bg-green-700 text-white flex items-center gap-1 !w-auto whitespace-nowrap shrink-0"
                            onClick={() => handlePublish(job.id)}
                            title="Publish Job"
                          >
                            <FiSend /> Publish
                          </Button>
                        )}
                        {job.status === "PUBLISHED" && (
                          <Button
                            type="button"
                            outline
                            size="small"
                            className="my-0 px-3 text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1 !w-auto whitespace-nowrap shrink-0"
                            onClick={() => triggerConfirm(job.id, "close")}
                            title="Close Job"
                          >
                            Close
                          </Button>
                        )}
                        <Link to={`/jobs/${job.id}/applications`}>
                          <Button
                            type="button"
                            size="small"
                            className="my-0 px-3.5 bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 !w-auto whitespace-nowrap shrink-0"
                          >
                            <FiEye /> Profiles
                          </Button>
                        </Link>
                        <Link to={`/jobs/${job.id}/edit`}>
                          <button
                            title="Edit"
                            className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-red-700 hover:border-red-200 transition shrink-0"
                          >
                            <FiEdit className="h-4.5 w-4.5" />
                          </button>
                        </Link>
                        <button
                          onClick={() => triggerConfirm(job.id, "delete")}
                          title="Delete"
                          className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:text-red-600 hover:border-red-100 transition shrink-0"
                        >
                          <FiTrash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {confirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900">
              {confirmModal.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {confirmModal.message}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                outline
                className="my-0 px-4 py-2 border-slate-200 text-slate-700 hover:bg-slate-50 !w-auto font-bold"
                onClick={() =>
                  setConfirmModal({
                    show: false,
                    type: null,
                    jobId: null,
                    title: "",
                    message: "",
                  })
                }
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="my-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white !w-auto font-bold"
                onClick={handleConfirmAction}
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
