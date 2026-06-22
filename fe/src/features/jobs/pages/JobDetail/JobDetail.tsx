import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import { Button } from "@/features/authentication/components/Button/Button";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { JobResponse, JobApplicationResponse } from "../../types/jobs";
import {
  FiBriefcase,
  FiDollarSign,
  FiClock,
  FiCpu,
  FiCheck,
  FiX,
  FiFileText,
  FiChevronLeft,
} from "react-icons/fi";

interface CvSummary {
  id: number;
  originalFileName: string;
  analyzed: boolean;
  uploadedAt: string;
}

export function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthentication();

  const [job, setJob] = useState<JobResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<JobApplicationResponse | null>(
    null
  );
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Apply form state
  const [myCvs, setMyCvs] = useState<CvSummary[]>([]);
  const [selectedCvId, setSelectedCvId] = useState<number | "">("");
  const [coverLetter, setCoverLetter] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchJobData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    // Fetch Job Detail
    await request<JobResponse>({
      endpoint: `/api/v1/jobs/${id}`,
      onSuccess: (jobData) => {
        setJob(jobData);

        // If logged in, fetch user's applications to see if they already applied
        if (user) {
          request<JobApplicationResponse[]>({
            endpoint: "/api/v1/jobs/my-applications",
            onSuccess: (apps) => {
              const matchedApp = apps.find((app) => app.jobId === jobData.id);
              if (matchedApp) {
                setApplication(matchedApp);
              }
            },
            onFailure: () => {},
          });
        }
      },
      onFailure: (err) => {
        toast.error(err || "Could not load job details");
      },
    });
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    fetchJobData();
  }, [fetchJobData]);

  const loadMyCvs = async () => {
    await request<CvSummary[]>({
      endpoint: "/api/v1/ai/cvs/mine",
      onSuccess: (data) => {
        setMyCvs(data);
        if (data.length > 0) {
          setSelectedCvId(data[0].id);
        }
      },
      onFailure: (err) => toast.error("Could not load CV list: " + err),
    });
  };

  const handleOpenApplyModal = () => {
    if (!user) {
      toast.info("Please sign in to apply");
      navigate("/authentication/login");
      return;
    }
    setShowApplyModal(true);
    loadMyCvs();
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCvId) {
      toast.error("Please select a CV to apply");
      return;
    }

    setSubmitting(true);
    await request<JobApplicationResponse>({
      endpoint: `/api/v1/jobs/${job?.id}/apply`,
      method: "POST",
      body: JSON.stringify({
        cvId: Number(selectedCvId),
        coverLetter: coverLetter,
      }),
      onSuccess: (data) => {
        toast.success("Applied successfully!");
        setApplication(data);
        setShowApplyModal(false);
      },
      onFailure: (err) => {
        toast.error(err || "Error applying for job");
      },
    });
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-xl text-center py-16">
        <h2 className="text-2xl font-bold text-slate-800">Job Not Found</h2>
        <p className="mt-2 text-slate-500">
          The link does not exist, or the job posting is closed.
        </p>
        <Link
          to="/jobs"
          className="mt-4 inline-block text-red-700 font-semibold hover:underline"
        >
          Back to Job Board
        </Link>
      </div>
    );
  }

  const isExpired = job.applicationDeadline
    ? new Date(job.applicationDeadline) < new Date()
    : false;

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

  const getAppStatusBadge = (status: string) => {
    switch (status) {
      case "APPLIED":
        return (
          <span className="bg-blue-50 border border-blue-200 text-blue-800 rounded-full px-3.5 py-1 text-xs font-semibold">
            Applied
          </span>
        );
      case "VIEWED":
        return (
          <span className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-full px-3.5 py-1 text-xs font-semibold">
            Viewed
          </span>
        );
      case "SHORTLISTED":
        return (
          <span className="bg-purple-50 border border-purple-200 text-purple-800 rounded-full px-3.5 py-1 text-xs font-semibold">
            Shortlisted
          </span>
        );
      case "REJECTED":
        return (
          <span className="bg-red-50 border border-red-200 text-red-800 rounded-full px-3.5 py-1 text-xs font-semibold">
            Rejected
          </span>
        );
      case "HIRED":
        return (
          <span className="bg-green-50 border border-green-200 text-green-800 rounded-full px-3.5 py-1 text-xs font-semibold">
            Hired
          </span>
        );
      default:
        return null;
    }
  };

  // Parse breakdown
  let breakdownData: {
    skills?: number;
    experience?: number;
    keywords?: number;
  } = {};
  if (application && application.matchBreakdown) {
    try {
      breakdownData = JSON.parse(application.matchBreakdown);
    } catch (e) {
      console.error("Error parsing match breakdown", e);
    }
  }

  // Parse Gemini reasoning structure if JSON
  let reasons: string[] = [];
  let gaps: string[] = [];
  const rawReasoning = application?.matchReasoning || "";
  if (rawReasoning.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawReasoning);
      reasons = parsed.reasons || [];
      gaps = parsed.gaps || [];
    } catch {
      // Treat as plain text if it fails to parse
    }
  }

  const selectedCv = myCvs.find((cv) => cv.id === Number(selectedCvId));
  const isSelectedCvAnalyzed = selectedCv ? selectedCv.analyzed : false;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      {/* Back navigation */}
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-700 mb-6 transition"
      >
        <FiChevronLeft className="h-4.5 w-4.5" /> Back to Job Board
      </Link>

      <div className="grid gap-6 md:grid-cols-[2.2fr_1fr]">
        {/* Left Column - Details */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
              <div className="flex gap-4">
                <div className="h-16 w-16 rounded-2xl border border-slate-200/60 bg-white flex items-center justify-center p-2 shadow-sm shrink-0">
                  <img
                    src={
                      job.companyLogo ||
                      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=150"
                    }
                    alt={job.companyName}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-extrabold text-slate-900 leading-snug">
                    {job.title}
                  </h1>
                  <p className="mt-1 text-sm font-bold text-red-700 hover:underline">
                    <Link to={`/companies/${job.companySlug}`}>
                      {job.companyName}
                    </Link>
                  </p>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {job.location}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 text-slate-700">
              {/* Description */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 border-l-4 border-red-700 pl-3 mb-3">
                  Job Description
                </h3>
                <p className="text-sm leading-relaxed whitespace-pre-line bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                  {job.description}
                </p>
              </div>

              {/* Requirements */}
              {job.requirements && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 border-l-4 border-red-700 pl-3 mb-3">
                    Requirements
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                    {job.requirements}
                  </p>
                </div>
              )}

              {/* Responsibilities */}
              {job.responsibilities && (
                <div>
                  <h3 className="text-lg font-bold text-slate-900 border-l-4 border-red-700 pl-3 mb-3">
                    Responsibilities & Benefits
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-line bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                    {job.responsibilities}
                  </p>
                </div>
              )}

              {/* Skills required */}
              <div>
                <h3 className="text-lg font-bold text-slate-900 border-l-4 border-red-700 pl-3 mb-3">
                  Required Skills
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {job.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-red-50 border border-red-100 px-3.5 py-1 text-xs text-red-700 font-semibold"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Match Score Breakdown & Reasoning */}
          {application && (
            <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-white via-red-50/10 to-amber-50/15 p-6 md:p-8 shadow-sm">
              <div className="flex items-center gap-3 border-b border-red-100/50 pb-4 mb-6">
                <div className="h-10 w-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center">
                  <FiCpu className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    AI Match Compatibility Analysis
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Analysis generated by Gemini model based on your profile and
                    CV
                  </p>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-[1fr_2.5fr]">
                {/* Radial Score Gauge */}
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl border border-red-200/50 bg-white">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    CV-JD Similarity
                  </span>
                  <div className="relative flex items-center justify-center h-28 w-28">
                    {/* SVG circle gauge */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        strokeWidth="8"
                        stroke="#F1F5F9"
                        fill="transparent"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        strokeWidth="8"
                        stroke="#B91C1C"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 46}
                        strokeDashoffset={
                          2 * Math.PI * 46 * (1 - application.matchScore / 100)
                        }
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-2xl font-black text-slate-900">
                      {application.matchScore}%
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-center text-slate-500">
                    CV:{" "}
                    <span className="text-red-700">
                      {application.cvFileName}
                    </span>
                  </p>
                </div>

                {/* Score components list */}
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 text-sm">
                    Detailed Score Breakdown
                  </h3>

                  {/* Skill compatibility */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                      <span>Skill Compatibility</span>
                      <span>
                        {breakdownData.skills ?? application.matchScore}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full"
                        style={{
                          width: `${breakdownData.skills ?? application.matchScore}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Experience compatibility */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                      <span>Experience Level</span>
                      <span>
                        {breakdownData.experience ?? application.matchScore}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                          width: `${breakdownData.experience ?? application.matchScore}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Keyword compatibility */}
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                      <span>Keyword Boost</span>
                      <span>
                        {breakdownData.keywords ?? application.matchScore}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-600 rounded-full"
                        style={{
                          width: `${breakdownData.keywords ?? application.matchScore}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Gemini reasoning text */}
              <div className="mt-6 border-t border-slate-100 pt-6">
                <h3 className="font-bold text-slate-900 text-sm mb-3">
                  AI Compatibility Assessment
                </h3>
                {reasons.length > 0 || gaps.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Strengths */}
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
                      <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <FiCheck className="stroke-[3]" /> Strengths
                      </h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-emerald-950 font-medium">
                        {reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    {/* Gaps */}
                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
                      <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <FiX className="stroke-[3]" /> Gaps
                      </h4>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-amber-950 font-medium">
                        {gaps.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line bg-white/70 rounded-2xl p-4 border border-red-100/50">
                    {rawReasoning}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Spec details */}
        <div className="space-y-6">
          {/* Quick specs card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">
              General Information
            </h3>

            <div className="flex items-start gap-3 text-sm">
              <FiBriefcase className="text-slate-400 mt-1 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Work Mode
                </p>
                <p className="font-semibold text-slate-700">
                  {getJobTypeLabel(job.jobType)} • {job.workMode}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <FiDollarSign className="text-slate-400 mt-1 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Salary
                </p>
                <p className="font-semibold text-slate-700">
                  {job.salaryMin && job.salaryMax
                    ? `${(job.salaryMin / 1000000).toFixed(0)}M - ${(job.salaryMax / 1000000).toFixed(0)}M ${job.salaryCurrency}`
                    : "Negotiable"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <FiClock className="text-slate-400 mt-1 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Experience
                </p>
                <p className="font-semibold text-slate-700">
                  {getExperienceLabel(job.experienceLevel)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 text-sm">
              <FiClock className="text-slate-400 mt-1 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                  Application Deadline
                </p>
                <p
                  className={`font-semibold ${isExpired ? "text-red-600" : "text-slate-700"}`}
                >
                  {job.applicationDeadline
                    ? `${new Date(job.applicationDeadline).toLocaleDateString("en-US")}${isExpired ? " (Expired)" : ""}`
                    : "No deadline"}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex flex-col gap-2.5">
              {application ? (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 font-bold text-center">
                    Application Status
                  </p>
                  <div className="flex justify-center">
                    {getAppStatusBadge(application.status)}
                  </div>
                </div>
              ) : isExpired ? (
                <Button
                  type="button"
                  disabled
                  className="my-0 w-full bg-slate-100 text-slate-400 border border-slate-200 font-bold py-3.5 rounded-2xl cursor-not-allowed text-center"
                >
                  Deadline Expired
                </Button>
              ) : user?.role === "USER" ? (
                <Button
                  type="button"
                  className="my-0 w-full bg-red-700 hover:bg-red-800 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-red-700/10 text-center"
                  onClick={handleOpenApplyModal}
                >
                  Apply Now
                </Button>
              ) : null}
            </div>
          </div>

          {/* Company Brief Card */}
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 mb-4">
              About the Company
            </h3>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-xl border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center p-1.5 shadow-sm">
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
                <h4 className="font-bold text-slate-800 leading-tight">
                  {job.companyName}
                </h4>
                <Link
                  to={`/companies/${job.companySlug}`}
                  className="text-xs text-red-700 font-semibold hover:underline"
                >
                  View Company Page →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Apply Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 md:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FiFileText className="text-red-700" /> Submit Application
              </h3>
              <button
                onClick={() => setShowApplyModal(false)}
                className="rounded-xl p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-5">
              <div>
                <label
                  className="block text-sm font-semibold text-slate-700"
                  htmlFor="cvSelect"
                >
                  Select CV for Application{" "}
                  <span className="text-red-500">*</span>
                </label>
                {myCvs.length === 0 ? (
                  <div className="mt-1.5 rounded-2xl border border-dashed border-red-200 bg-red-50/50 p-4 text-center">
                    <p className="text-xs text-slate-600 font-medium">
                      You haven't uploaded any CV yet.
                    </p>
                    <Link
                      to="/ai/cv"
                      className="mt-2 inline-block text-xs font-bold text-red-700 hover:underline"
                    >
                      Go to CV Upload page to upload PDF →
                    </Link>
                  </div>
                ) : (
                  <>
                    <select
                      id="cvSelect"
                      value={selectedCvId}
                      onChange={(e) =>
                        setSelectedCvId(
                          e.target.value === "" ? "" : Number(e.target.value)
                        )
                      }
                      className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      required
                    >
                      {myCvs.map((cv) => (
                        <option key={cv.id} value={cv.id}>
                          {cv.originalFileName} (Uploaded:{" "}
                          {new Date(cv.uploadedAt).toLocaleDateString("en-US")})
                        </option>
                      ))}
                    </select>
                    {selectedCvId && !isSelectedCvAnalyzed && (
                      <div className="mt-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-amber-950">
                        <p className="text-xs font-semibold leading-relaxed">
                          ⚠️ <strong>This CV has not been analyzed yet.</strong>
                        </p>
                        <p className="text-[11px] mt-1">
                          To ensure accurate skill and experience matching,
                          please go to the{" "}
                          <Link
                            to="/ai/cv"
                            className="font-bold text-red-700 hover:underline"
                          >
                            AI CV
                          </Link>{" "}
                          page and click <strong>Analyze</strong> for this CV
                          before applying.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div>
                <label
                  className="block text-sm font-semibold text-slate-700"
                  htmlFor="coverLetter"
                >
                  Cover Letter
                </label>
                <textarea
                  id="coverLetter"
                  rows={5}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Explain why you are the perfect candidate for this job, highlight key experiences..."
                  className="mt-1.5 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
                ></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  outline
                  onClick={() => setShowApplyModal(false)}
                  className="my-0 px-5"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting || !selectedCvId || !isSelectedCvAnalyzed
                  }
                  className="my-0 px-6 bg-red-700 hover:bg-red-800 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "AI is analyzing..." : "Submit Application"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
