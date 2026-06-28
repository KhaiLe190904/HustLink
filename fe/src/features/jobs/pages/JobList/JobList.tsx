import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import { Button } from "@/features/authentication/components/Button/Button";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { JobResponse } from "../../types/jobs";
import {
  FiSearch,
  FiMapPin,
  FiBriefcase,
  FiDollarSign,
  FiCpu,
  FiPlus,
} from "react-icons/fi";
import { CompanyRegister } from "@/features/companies/pages/CompanyRegister/CompanyRegister";

export function JobList() {
  const { user } = useAuthentication();
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"all" | "recommended" | "saved">(
    "all"
  );
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [hasCompany, setHasCompany] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const jobsPerPage = 6;

  // Filter states (sau khi click Search)
  const [searchQuery, setSearchQuery] = useState("");
  const [location, setLocation] = useState("");
  const [skill, setSkill] = useState("");
  const [minSalary, setMinSalary] = useState<number | "">("");

  // Temp filter states (khi đang gõ)
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [tempLocation, setTempLocation] = useState("");
  const [tempSkill, setTempSkill] = useState("");
  const [tempMinSalary, setTempMinSalary] = useState<number | "">("");

  const [savedJobIds, setSavedJobIds] = useState<number[]>([]);

  const fetchSavedJobs = useCallback(async () => {
    if (!user) return;
    await request<JobResponse[]>({
      endpoint: "/api/v1/jobs/saved",
      onSuccess: (data) => {
        setSavedJobIds(data.map((j) => j.id));
      },
      onFailure: () => {},
    });
  }, [user]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    let endpoint = "/api/v1/jobs";

    if (viewMode === "recommended") {
      endpoint = "/api/v1/jobs/recommended";
    } else if (viewMode === "saved") {
      endpoint = "/api/v1/jobs/saved";
    } else {
      // Build query string for standard search with pagination
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append("q", searchQuery.trim());
      if (location) params.append("location", location);
      if (skill) params.append("skill", skill);
      if (minSalary) params.append("minSalary", minSalary.toString());
      params.append("page", (currentPage - 1).toString());
      params.append("size", jobsPerPage.toString());
      endpoint = `/api/v1/jobs?${params.toString()}`;
    }

    if (viewMode === "all") {
      await request<{ content: JobResponse[]; totalPages: number }>({
        endpoint,
        onSuccess: (data) => {
          setJobs(data.content || []);
          setTotalPages(data.totalPages || 1);
          setLoading(false);
        },
        onFailure: (err) => {
          toast.error(err || "Could not load jobs list");
          setLoading(false);
        },
      });
    } else {
      await request<JobResponse[]>({
        endpoint,
        onSuccess: (data) => {
          setJobs(data || []);
          setLoading(false);
        },
        onFailure: (err) => {
          toast.error(err || "Could not load jobs list");
          setLoading(false);
        },
      });
    }
  }, [viewMode, searchQuery, location, skill, minSalary, currentPage]);

  const handleSearch = () => {
    setSearchQuery(tempSearchQuery);
    setLocation(tempLocation);
    setSkill(tempSkill);
    setMinSalary(tempMinSalary);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [viewMode]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    fetchSavedJobs();
  }, [fetchSavedJobs]);

  useEffect(() => {
    if (user) {
      request<{ slug?: string }>({
        endpoint: "/api/v1/companies/my",
        onSuccess: (data) => {
          if (data && data.slug) {
            setHasCompany(true);
          } else {
            setHasCompany(false);
          }
        },
        onFailure: () => {
          setHasCompany(false);
        },
      });
    } else {
      setHasCompany(false);
    }
  }, [user]);

  const handleSaveToggle = async (jobId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const isSaved = savedJobIds.includes(jobId);

    await request({
      endpoint: `/api/v1/jobs/${jobId}/save`,
      method: isSaved ? "DELETE" : "POST",
      onSuccess: () => {
        if (isSaved) {
          setSavedJobIds((prev) => prev.filter((id) => id !== jobId));
          toast.success("Job removed from saved list");
          if (viewMode === "saved") {
            setJobs((prev) => prev.filter((j) => j.id !== jobId));
          }
        } else {
          setSavedJobIds((prev) => [...prev, jobId]);
          toast.success("Job saved successfully!");
        }
      },
      onFailure: (err) => toast.error(err),
    });
  };

  const getExperienceLabel = (level: string) => {
    switch (level) {
      case "INTERN":
        return "Intern";
      case "JUNIOR":
        return "Junior (1-2 years)";
      case "MIDDLE":
        return "Middle (2-5 years)";
      case "SENIOR":
        return "Senior (5+ years)";
      case "LEAD":
        return "Lead / Manager";
      default:
        return level;
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case "FULL_TIME":
        return "Full-time";
      case "PART_TIME":
        return "Part-time";
      case "INTERNSHIP":
        return "Internship";
      case "CONTRACT":
        return "Contract";
      default:
        return type;
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      {/* Top Banner */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-red-700 via-red-800 to-amber-600 p-8 text-white shadow-xl shadow-red-950/10">
        <div className="relative z-10 max-w-2xl">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            HustLink Job Board
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
            Job Board & Smart CV Matching
          </h1>
          <p className="mt-2 text-red-100/90 leading-relaxed">
            Find thousands of internships and quality career opportunities.
            Leverage AI to analyze compatibility between your CV and the job
            description (JD).
          </p>
        </div>

        {/* Floating actions for Recruiter */}
        <div className="mt-6 flex flex-wrap gap-3 relative z-10">
          {user?.role === "RECRUITER" && (
            <>
              <Link to="/jobs/recruiter">
                <Button
                  type="button"
                  className="my-0 hover:bg-slate-100 px-5"
                  style={{ color: "#b91c1c", backgroundColor: "#ffffff" }}
                >
                  Recruiter Dashboard
                </Button>
              </Link>
              <Link to="/jobs/new">
                <Button
                  type="button"
                  className="my-0 hover:bg-white/10 px-5 flex items-center gap-1"
                  style={{
                    color: "#ffffff",
                    borderColor: "#ffffff",
                    backgroundColor: "transparent",
                    borderStyle: "solid",
                    borderWidth: "1px",
                  }}
                >
                  <FiPlus /> Post New Job
                </Button>
              </Link>
            </>
          )}
          {user?.role === "USER" && !hasCompany && (
            <Button
              type="button"
              className="my-0 hover:bg-slate-100 px-3.5 py-1.5 text-xs font-semibold w-auto shadow-sm"
              style={{
                color: "#0f172a",
                backgroundColor: "#ffffff",
                border: "none",
              }}
              onClick={() => setShowRegisterModal(true)}
            >
              Register Recruiter Company
            </Button>
          )}
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />
      </div>

      {/* Tabs list */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("all")}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              viewMode === "all"
                ? "bg-red-700 text-white shadow-md shadow-red-700/10"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Jobs
          </button>
          <button
            onClick={() => setViewMode("recommended")}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition flex items-center gap-2 ${
              viewMode === "recommended"
                ? "bg-red-700 text-white shadow-md shadow-red-700/10"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <FiCpu className="animate-pulse text-amber-500" />
            AI Recommendations
          </button>
          <button
            onClick={() => setViewMode("saved")}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              viewMode === "saved"
                ? "bg-red-700 text-white shadow-md shadow-red-700/10"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Saved Jobs
          </button>
        </div>
      </div>

      {/* Advanced Filter Bar (Only for "all" mode) */}
      {viewMode === "all" && (
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="grid gap-4 md:grid-cols-5 items-center">
            {/* Search Input */}
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Job title, keywords..."
                value={tempSearchQuery}
                onChange={(e) => setTempSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* Location Input */}
            <div className="relative">
              <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Location (Hanoi, HCMC...)"
                value={tempLocation}
                onChange={(e) => setTempLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* Skill Input */}
            <div className="relative">
              <FiBriefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Skills (Java, React, SQL...)"
                value={tempSkill}
                onChange={(e) => setTempSkill(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* Salary Min Input */}
            <div className="relative">
              <FiDollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="number"
                placeholder="Min salary (VND)"
                value={tempMinSalary}
                onChange={(e) =>
                  setTempMinSalary(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            {/* Search Button */}
            <div>
              <Button
                type="button"
                onClick={handleSearch}
                className="w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-700/10 transition-all !my-0"
              >
                <FiSearch className="h-4 w-4 stroke-[3]" /> Search
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {(() => {
        if (loading && jobs.length === 0) {
          return (
            <div className="flex h-64 items-center justify-center bg-transparent">
              {/* Completely transparent placeholder - no spinner to prevent ellipse layout shift */}
            </div>
          );
        }

        let activeJobs: JobResponse[] = [];
        let currentJobs: JobResponse[] = [];
        let totalPagesCount = 1;

        if (viewMode === "all") {
          activeJobs = jobs;
          currentJobs = jobs;
          totalPagesCount = totalPages;
        } else {
          activeJobs = jobs.filter((job) => {
            if (!job.applicationDeadline) return true;
            const deadline = new Date(job.applicationDeadline);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return deadline >= today;
          });
          const indexOfLastJob = currentPage * jobsPerPage;
          const indexOfFirstJob = indexOfLastJob - jobsPerPage;
          currentJobs = activeJobs.slice(indexOfFirstJob, indexOfLastJob);
          totalPagesCount = Math.ceil(activeJobs.length / jobsPerPage);
        }

        if (activeJobs.length === 0) {
          return (
            <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm">
              {viewMode === "recommended" ? (
                <div className="max-w-md mx-auto px-4">
                  <FiCpu className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <h3 className="text-lg font-bold text-slate-800">
                    No recommended jobs found
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Please upload and analyze your CV in the{" "}
                    <Link
                      to="/ai/cv"
                      className="text-red-700 font-semibold hover:underline"
                    >
                      AI CV
                    </Link>{" "}
                    tab first to get smart matching recommendations!
                  </p>
                </div>
              ) : viewMode === "saved" ? (
                <div>
                  <p className="text-base font-medium">
                    You have not saved any jobs.
                  </p>
                  <p className="text-sm mt-1">
                    Browse active job postings and save the opportunities you
                    like.
                  </p>
                </div>
              ) : (
                <p className="text-base font-medium">
                  No active jobs matched your filter criteria.
                </p>
              )}
            </div>
          );
        }

        return (
          <div className="relative">
            {/* Grid Jobs list */}
            <div
              className={`grid gap-6 md:grid-cols-2 lg:grid-cols-3 transition-all duration-200 ${loading ? "pointer-events-none select-none" : ""}`}
            >
              {currentJobs.map((job) => {
                const isSaved = savedJobIds.includes(job.id);
                return (
                  <Link
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-red-300 hover:shadow-lg hover:shadow-red-50/40"
                  >
                    <div>
                      {/* Top card info */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-2xl border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center p-1.5 shadow-sm">
                            <img
                              src={
                                job.companyLogo ||
                                "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100"
                              }
                              alt={job.companyName}
                              className="h-full w-full object-contain"
                            />
                          </div>
                          <div>
                            <Link
                              to={`/companies/${job.companySlug}`}
                              className="text-xs font-bold text-slate-500 hover:text-red-700 transition"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {job.companyName}
                            </Link>
                            <p className="text-[10px] text-slate-400 font-semibold">
                              {job.location}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleSaveToggle(job.id, e)}
                          className={`rounded-xl p-2 transition-colors border ${
                            isSaved
                              ? "bg-red-50 border-red-200 text-red-700"
                              : "bg-slate-50 border-slate-200 text-slate-400 hover:text-red-700 hover:bg-red-50"
                          }`}
                          title={isSaved ? "Bỏ lưu việc làm" : "Lưu việc làm"}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4.5 w-4.5"
                            viewBox="0 0 20 20"
                            fill={isSaved ? "currentColor" : "none"}
                            stroke="currentColor"
                            strokeWidth={isSaved ? "0" : "2"}
                          >
                            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                          </svg>
                        </button>
                      </div>

                      {/* Title & Type */}
                      <h3 className="mt-4 font-bold text-slate-900 leading-snug group-hover:text-red-700 transition line-clamp-2">
                        {job.title}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                        <span className="inline-block rounded-lg bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                          {getJobTypeLabel(job.jobType)}
                        </span>
                        <span className="inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {job.workMode}
                        </span>
                        <span className="inline-block rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {getExperienceLabel(job.experienceLevel)}
                        </span>
                      </div>

                      {/* Required Skills */}
                      <div className="mt-4 flex flex-wrap gap-1">
                        {job.skills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-slate-50 border border-slate-100 px-2.5 py-0.5 text-[10px] text-slate-600 font-medium"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.skills.length > 4 && (
                          <span className="rounded-full bg-slate-50 border border-slate-100 px-2 py-0.5 text-[10px] text-slate-400 font-semibold">
                            +{job.skills.length - 4}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            Salary
                          </p>
                          <span className="text-sm font-bold text-slate-800">
                            {job.salaryMin && job.salaryMax
                              ? `${(job.salaryMin / 1000000).toFixed(0)} - ${(job.salaryMax / 1000000).toFixed(0)}M VND`
                              : "Negotiable"}
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                            Deadline
                          </p>
                          <span className="text-xs font-bold text-slate-700">
                            {job.applicationDeadline
                              ? new Date(
                                  job.applicationDeadline
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "No deadline"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPagesCount > 1 && (
              <div
                className={`mt-12 flex justify-center items-center gap-2 transition-opacity duration-200 ${loading ? "pointer-events-none" : ""}`}
              >
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-slate-200 text-xs font-bold rounded-2xl bg-white text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                {Array.from({ length: totalPagesCount }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`h-9 w-9 text-xs font-bold rounded-2xl transition-all ${
                        currentPage === page
                          ? "bg-red-700 text-white shadow-md shadow-red-700/10"
                          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) =>
                      Math.min(prev + 1, totalPagesCount)
                    )
                  }
                  disabled={currentPage === totalPagesCount}
                  className="px-4 py-2 border border-slate-200 text-xs font-bold rounded-2xl bg-white text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        );
      })()}
      {showRegisterModal && (
        <CompanyRegister onClose={() => setShowRegisterModal(false)} />
      )}
    </div>
  );
}
