import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import { JobApplicationResponse } from "../../types/jobs";
import { FiClock, FiChevronLeft, FiCpu, FiExternalLink } from "react-icons/fi";

export function MyApplications() {
  const [applications, setApplications] = useState<JobApplicationResponse[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const fetchMyApplications = useCallback(async () => {
    setLoading(true);
    await request<JobApplicationResponse[]>({
      endpoint: "/api/v1/jobs/my-applications",
      onSuccess: (data) => {
        setApplications(data);
        setLoading(false);
      },
      onFailure: (err) => {
        toast.error("Could not retrieve applications list: " + err);
        setLoading(false);
      },
    });
  }, []);

  useEffect(() => {
    fetchMyApplications();
  }, [fetchMyApplications]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPLIED":
        return (
          <span className="bg-blue-50 border border-blue-200 text-blue-800 rounded-full px-3 py-0.5 text-xs font-semibold">
            Applied
          </span>
        );
      case "VIEWED":
        return (
          <span className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-full px-3 py-0.5 text-xs font-semibold">
            Viewed
          </span>
        );
      case "SHORTLISTED":
        return (
          <span className="bg-purple-50 border border-purple-200 text-purple-800 rounded-full px-3 py-0.5 text-xs font-semibold">
            Shortlisted
          </span>
        );
      case "REJECTED":
        return (
          <span className="bg-red-50 border border-red-200 text-red-800 rounded-full px-3 py-0.5 text-xs font-semibold">
            Rejected
          </span>
        );
      case "HIRED":
        return (
          <span className="bg-green-50 border border-green-200 text-green-800 rounded-full px-3 py-0.5 text-xs font-semibold">
            Hired
          </span>
        );
      default:
        return (
          <span className="bg-slate-50 border border-slate-200 text-slate-800 rounded-full px-3 py-0.5 text-xs font-semibold capitalize">
            {status.toLowerCase()}
          </span>
        );
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8">
      {/* Back to Job Board */}
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-700 mb-6 transition"
      >
        <FiChevronLeft className="h-4.5 w-4.5" /> Back to Jobs Board
      </Link>

      <div className="border-b border-slate-200 pb-5 mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">
          My Applications
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track the status of your submitted job applications and view AI
          compatibility analysis.
        </p>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
        </div>
      ) : applications.length === 0 ? (
        <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm">
          <p className="text-base font-semibold">
            You haven't submitted any applications yet.
          </p>
          <p className="text-sm mt-1">
            Browse active job postings and find matching opportunities to submit
            your profile!
          </p>
          <Link
            to="/jobs"
            className="mt-4 inline-block text-sm font-bold text-red-700 hover:underline"
          >
            Explore Jobs Now →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Link
              key={app.id}
              to={`/jobs/${app.jobId}`}
              className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-md"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {app.companyName}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <FiClock /> Applied on{" "}
                    {new Date(app.appliedAt).toLocaleDateString("en-US")}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 group-hover:text-red-700 transition">
                  {app.jobTitle}
                </h3>
                <div className="text-xs text-slate-500">
                  CV used:{" "}
                  <span className="font-semibold text-slate-700">
                    {app.cvFileName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 justify-end">
                {/* AI Score pill */}
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <FiCpu /> AI Match
                  </span>
                  <span
                    className={`inline-flex items-center justify-center px-3 py-1 rounded-xl font-black text-sm border ${
                      app.matchScore >= 80
                        ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                        : app.matchScore >= 60
                          ? "bg-amber-50 text-amber-800 border-amber-100"
                          : "bg-slate-50 text-slate-700 border-slate-200"
                    }`}
                  >
                    {app.matchScore}%
                  </span>
                </div>

                {/* Status Badge */}
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Status
                  </span>
                  {getStatusBadge(app.status)}
                </div>

                <span className="text-slate-300 group-hover:text-red-700 transition pl-2">
                  <FiExternalLink className="h-5 w-5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
