import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import {
  useAuthentication,
  IUser,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { Button } from "@/features/authentication/components/Button/Button";
import { JobResponse } from "@/features/jobs/types/jobs";
import { FiEdit, FiCalendar, FiMapPin } from "react-icons/fi";
import { EventResponse } from "@/features/events/types/events";

interface CompanyDetail {
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
  status: string;
  createdAt: string;
}

interface CompanyMemberInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  profilePicture: string | null;
}

export function CompanyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const { user, setUser } = useAuthentication();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [people, setPeople] = useState<CompanyMemberInfo[]>([]);
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [activeTab, setActiveTab] = useState<
    "about" | "jobs" | "people" | "events"
  >("about");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (
      tabParam === "events" ||
      tabParam === "jobs" ||
      tabParam === "people" ||
      tabParam === "about"
    ) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [loading, setLoading] = useState(true);
  const [isMyCompany, setIsMyCompany] = useState(false);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedWorkModes, setSelectedWorkModes] = useState<string[]>([]);

  const fetchCompanyData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    await request<CompanyDetail>({
      endpoint: `/api/v1/companies/${slug}`,
      onSuccess: (data) => {
        setCompany(data);
        // Fetch jobs of this company
        request<JobResponse[]>({
          endpoint: `/api/v1/companies/${data.id}/jobs`,
          onSuccess: (jobsData) => setJobs(jobsData),
          onFailure: (err) => console.error(err),
        });
        // Fetch people (HUST members) in this company
        request<CompanyMemberInfo[]>({
          endpoint: `/api/v1/companies/${data.id}/people`,
          onSuccess: (peopleData) => setPeople(peopleData),
          onFailure: (err) => console.error(err),
        });
      },
      onFailure: (err) => {
        toast.error(err || "Could not load company details");
      },
    });
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  // Check if current user is owner of the company
  useEffect(() => {
    if (user && company) {
      request<CompanyDetail>({
        endpoint: "/api/v1/companies/my",
        onSuccess: (myComp) => {
          if (myComp && myComp.id === company.id) {
            setIsMyCompany(true);
          }
        },
        onFailure: () => {},
      });
    }
  }, [user, company]);

  useEffect(() => {
    if (company) {
      request<EventResponse[]>({
        endpoint: `/api/v1/companies/${company.id}/events?includeDrafts=${isMyCompany}`,
        onSuccess: (eventsData) => setEvents(eventsData),
        onFailure: (err) => console.error(err),
      });
    }
  }, [company, isMyCompany]);

  const filteredJobs = jobs.filter((job) => {
    if (
      selectedJobTypes.length > 0 &&
      !selectedJobTypes.includes(job.jobType)
    ) {
      return false;
    }
    if (
      selectedWorkModes.length > 0 &&
      !selectedWorkModes.includes(job.workMode)
    ) {
      return false;
    }
    return true;
  });

  const handleCloseCompany = () => {
    setShowConfirmModal(true);
  };

  const fetchUpdatedUser = async () => {
    await request<IUser>({
      endpoint: "/api/v1/authentication/users/me",
      onSuccess: (data) => setUser(data),
      onFailure: (err) => console.error(err),
    });
  };

  const confirmCloseCompany = async () => {
    if (!company) return;
    await request({
      endpoint: `/api/v1/companies/${company.id}`,
      method: "DELETE",
      onSuccess: () => {
        toast.success("Company closed successfully!");
        fetchCompanyData();
        fetchUpdatedUser();
      },
      onFailure: (err) => toast.error(err || "Failed to close company"),
    });
    setShowConfirmModal(false);
  };

  const handleReopenCompany = async () => {
    if (!company) return;
    await request({
      endpoint: `/api/v1/companies/${company.id}/reopen`,
      method: "PATCH",
      onSuccess: () => {
        toast.success("Company reopened successfully!");
        fetchCompanyData();
        fetchUpdatedUser();
      },
      onFailure: (err) => toast.error(err || "Failed to reopen company"),
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="mx-auto max-w-xl text-center py-16">
        <h2 className="text-2xl font-bold text-slate-800">Company Not Found</h2>
        <p className="mt-2 text-slate-500">
          The page doesn't exist, or the company is pending approval.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-red-700 font-semibold hover:underline"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      {company.status === "SUSPENDED" && (
        <div className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-lg">
              This company is temporarily closed
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              All events, job postings, and member activities are suspended.
              Only owners and administrators can manage this page.
            </p>
          </div>
          {(isMyCompany || user?.role === "ADMIN") && (
            <button
              type="button"
              className="my-0 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl transition shadow-sm shrink-0 whitespace-nowrap text-sm sm:text-base cursor-pointer hover:shadow-md"
              onClick={handleReopenCompany}
            >
              Reopen Company
            </button>
          )}
        </div>
      )}

      {/* Cover and Header Section */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="relative h-48 w-full bg-slate-100">
          <img
            src={
              company.coverUrl ||
              "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200"
            }
            alt="Cover"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="px-6 py-6 md:px-8 md:py-8 flex flex-col md:flex-row md:items-end justify-between gap-6 relative">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6 md:-mt-16">
            <div className="h-28 w-28 rounded-2xl border-4 border-white bg-white shadow-md overflow-hidden flex items-center justify-center z-10">
              <img
                src={
                  company.logoUrl ||
                  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150"
                }
                alt="Logo"
                className="h-full w-full object-contain p-2"
              />
            </div>
            <div className="text-center md:text-left">
              <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                {company.name}
                {company.status === "PENDING" && (
                  <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-semibold text-amber-800">
                    Pending Approval
                  </span>
                )}
                {company.status === "SUSPENDED" && (
                  <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-0.5 text-xs font-semibold text-slate-700">
                    Closed (Suspended)
                  </span>
                )}
              </h1>
              <p className="mt-1 text-slate-500 font-medium">
                {company.industry} • {company.headquarters}
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-center flex-wrap md:flex-nowrap">
            {isMyCompany && (
              <Link to={`/companies/${company.id}/edit`} className="shrink-0">
                <Button
                  type="button"
                  className="my-0 px-5 bg-red-700 hover:bg-red-800 text-white flex items-center gap-1.5 !w-auto shrink-0 whitespace-nowrap"
                >
                  <FiEdit className="h-4 w-4" /> Edit Profile
                </Button>
              </Link>
            )}
            {(isMyCompany || user?.role === "ADMIN") &&
              company.status === "ACTIVE" && (
                <Button
                  type="button"
                  className="my-0 px-5 bg-red-700 hover:bg-red-800 text-white flex items-center gap-1.5 font-bold !w-auto shrink-0 whitespace-nowrap"
                  onClick={handleCloseCompany}
                >
                  Close Company
                </Button>
              )}
            {(isMyCompany || user?.role === "ADMIN") &&
              company.status === "SUSPENDED" && (
                <Button
                  type="button"
                  className="my-0 px-5 bg-green-600 hover:bg-green-700 text-white flex items-center gap-1.5 font-bold !w-auto shrink-0 whitespace-nowrap"
                  onClick={handleReopenCompany}
                >
                  Reopen Company
                </Button>
              )}
            {user?.role === "ADMIN" && company.status === "PENDING" && (
              <Button
                type="button"
                className="my-0 px-6 bg-green-600 hover:bg-green-700 text-white !w-auto shrink-0 whitespace-nowrap"
                onClick={async () => {
                  await request({
                    endpoint: `/api/v1/admin/companies/${company.id}/approve`,
                    method: "PATCH",
                    onSuccess: () => {
                      toast.success("Company approved successfully!");
                      fetchCompanyData();
                    },
                    onFailure: (err) => toast.error(err),
                  });
                }}
              >
                Approve
              </Button>
            )}
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex border-t border-slate-100 bg-slate-50/50 px-6 md:px-8">
          <button
            onClick={() => setActiveTab("about")}
            className={`border-b-2 px-4 py-4 text-sm font-semibold transition-all ${
              activeTab === "about"
                ? "border-red-700 text-red-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            About
          </button>
          <button
            onClick={() => setActiveTab("jobs")}
            className={`border-b-2 px-4 py-4 text-sm font-semibold transition-all ${
              activeTab === "jobs"
                ? "border-red-700 text-red-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Jobs ({jobs.length})
          </button>
          <button
            onClick={() => setActiveTab("people")}
            className={`border-b-2 px-4 py-4 text-sm font-semibold transition-all ${
              activeTab === "people"
                ? "border-red-700 text-red-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Members ({people.length})
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={`border-b-2 px-4 py-4 text-sm font-semibold transition-all ${
              activeTab === "events"
                ? "border-red-700 text-red-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Events ({events.length})
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="mt-6">
        {activeTab === "about" && (
          <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Detailed Information
              </h2>
              <p className="mt-4 text-slate-600 leading-relaxed whitespace-pre-line">
                {company.description ||
                  "No detailed description available for this company."}
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">
                Overview
              </h3>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">
                  Website
                </p>
                <a
                  href={company.website || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-red-700 hover:underline break-all"
                >
                  {company.website || "Not updated"}
                </a>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">
                  Company Size
                </p>
                <p className="text-sm font-medium text-slate-700">
                  {company.size || "Not updated"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">
                  Headquarters
                </p>
                <p className="text-sm font-medium text-slate-700">
                  {company.headquarters || "Not updated"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold uppercase">
                  Created On
                </p>
                <p className="text-sm font-medium text-slate-700">
                  {new Date(company.createdAt).toLocaleDateString("en-US")}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "jobs" && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Active Job Openings
            </h2>
            {jobs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                This company hasn't posted any job openings yet.
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-4">
                {/* Left Sidebar Filter */}
                <div className="md:col-span-1 space-y-6 border-r border-slate-100 pr-6">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Job Type
                    </h3>
                    <div className="space-y-2.5">
                      {[
                        { value: "FULL_TIME", label: "Full-time" },
                        { value: "PART_TIME", label: "Part-time" },
                        { value: "INTERNSHIP", label: "Internship" },
                        { value: "CONTRACT", label: "Contract" },
                      ].map((type) => (
                        <label
                          key={type.value}
                          className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer hover:text-slate-900"
                        >
                          <input
                            type="checkbox"
                            checked={selectedJobTypes.includes(type.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedJobTypes((prev) => [
                                  ...prev,
                                  type.value,
                                ]);
                              } else {
                                setSelectedJobTypes((prev) =>
                                  prev.filter((t) => t !== type.value)
                                );
                              }
                            }}
                            className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-4 w-4"
                          />
                          {type.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Work Mode
                    </h3>
                    <div className="space-y-2.5">
                      {[
                        { value: "ON_SITE", label: "On-site" },
                        { value: "REMOTE", label: "Remote" },
                        { value: "HYBRID", label: "Hybrid" },
                      ].map((mode) => (
                        <label
                          key={mode.value}
                          className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer hover:text-slate-900"
                        >
                          <input
                            type="checkbox"
                            checked={selectedWorkModes.includes(mode.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedWorkModes((prev) => [
                                  ...prev,
                                  mode.value,
                                ]);
                              } else {
                                setSelectedWorkModes((prev) =>
                                  prev.filter((m) => m !== mode.value)
                                );
                              }
                            }}
                            className="rounded border-slate-300 text-red-600 focus:ring-red-500 h-4 w-4"
                          />
                          {mode.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {(selectedJobTypes.length > 0 ||
                    selectedWorkModes.length > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedJobTypes([]);
                        setSelectedWorkModes([]);
                      }}
                      className="text-xs font-bold text-red-700 hover:text-red-800 transition underline"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>

                {/* Right Job Listings Grid */}
                <div className="md:col-span-3">
                  {filteredJobs.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                      No jobs match your selected filter criteria.
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                      {filteredJobs.map((job) => (
                        <Link
                          key={job.id}
                          to={`/jobs/${job.id}`}
                          className="group rounded-2xl border border-slate-200 p-5 transition hover:border-red-200 hover:shadow-md hover:shadow-red-50/50 flex flex-col justify-between"
                        >
                          <div>
                            <h3 className="font-bold text-slate-900 group-hover:text-red-700 transition line-clamp-1">
                              {job.title}
                            </h3>
                            <p className="mt-1 text-xs text-slate-500 font-medium">
                              {job.location} • {job.jobType} • {job.workMode}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-1">
                              {job.skills.slice(0, 3).map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 font-medium"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">
                              {job.salaryMin && job.salaryMax
                                ? `${(job.salaryMin / 1000000).toFixed(0)}M - ${(job.salaryMax / 1000000).toFixed(0)}M VND`
                                : "Negotiable"}
                            </span>
                            <span className="text-xs text-red-700 font-semibold group-hover:underline">
                              Details →
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "people" && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Employees Working Here
            </h2>
            {people.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                No people are currently listed as working here.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {people.map((person) => (
                  <Link
                    key={person.id}
                    to={`/profile/${person.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-red-200 hover:shadow-sm"
                  >
                    <img
                      src={
                        person.profilePicture ||
                        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100"
                      }
                      alt="Avatar"
                      className="h-12 w-12 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 truncate hover:text-red-700">
                        {person.firstName} {person.lastName}
                      </h4>
                      <p className="text-xs text-slate-500 truncate">
                        {person.position || "Alumnus/Employee"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "events" && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6">
              Company Events
            </h2>
            {events.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                This company hasn't organized any events yet.
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.id}`}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-red-200 hover:shadow-md hover:shadow-red-50/50 flex flex-col"
                  >
                    <div className="relative h-40 bg-slate-100 shrink-0">
                      <img
                        src={
                          event.coverImageUrl ||
                          "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600"
                        }
                        alt={event.title}
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                      <span className="absolute left-4 top-4 rounded-lg bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-md">
                        {event.type.replace("_", " ")}
                      </span>
                      {event.status === "DRAFT" && (
                        <span className="absolute right-4 top-4 rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                          Draft
                        </span>
                      )}
                      {event.status === "CANCELLED" && (
                        <span className="absolute right-4 top-4 rounded-lg bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider">
                          Cancelled
                        </span>
                      )}
                    </div>
                    <div className="p-5 flex flex-col justify-between flex-1">
                      <div>
                        <h3 className="font-bold text-slate-900 group-hover:text-red-700 transition line-clamp-1">
                          {event.title}
                        </h3>
                        <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1.5 font-medium">
                        <div className="flex items-center gap-2">
                          <FiCalendar className="text-slate-400 shrink-0" />
                          <span>
                            {new Date(event.startAt).toLocaleDateString(
                              "en-US",
                              { dateStyle: "medium" }
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <FiMapPin className="text-slate-400 shrink-0" />
                          <span className="truncate">
                            {event.mode === "ONLINE" ? "Online" : event.venue}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900">Close Company</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Are you sure you want to close "{company.name}"? This will suspend
              all company activities and job postings. You can reopen it at any
              time.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                outline
                className="my-0 px-4 py-2 border-slate-200 text-slate-700 hover:bg-slate-50 w-auto"
                onClick={() => setShowConfirmModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="my-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white w-auto font-bold"
                onClick={confirmCloseCompany}
              >
                Confirm Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
