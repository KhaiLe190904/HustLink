import {
  ChangeEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { FiEye, FiRefreshCw, FiX } from "react-icons/fi";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import { request } from "@/utils/api";
import { JobResponse } from "@/features/jobs/types/jobs";

interface PageResponse<T> {
  content: T[];
}

interface CVJobAnalysisResponse {
  id: number;
  cvId: number;
  cvFileName: string;
  job: JobResponse;
  score: number;
  status: "PENDING" | "ANALYZING" | "COMPLETED" | "FAILED";
  summary: string;
  strengths: string[];
  improvements: string[];
  extractedSkills: string[];
  matchScore: number;
  matchBreakdown: string;
  matchReasoning: string;
  updatedAt: string;
}

type SourceTab = "url" | "pdf" | "existing";

const RECOMMENDED_CACHE_PREFIX = "hustlink:jd-workspace:recommended:";

export function JDWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cvId = Number(searchParams.get("cvId") ?? "");
  const mode = searchParams.get("mode") ?? "analysis";
  const [sourceMode, setSourceMode] = useState<SourceTab>("url");
  const [url, setUrl] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<JobResponse[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | "">("");
  const [selectedJob, setSelectedJob] = useState<JobResponse | null>(null);
  const [previewJob, setPreviewJob] = useState<JobResponse | null>(null);
  const [analysis, setAnalysis] = useState<CVJobAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [progress, setProgress] = useState<"analysis" | null>(null);
  const [pollingId, setPollingId] = useState<number | null>(null);

  const loadJobs = useCallback(() => {
    request<PageResponse<JobResponse>>({
      endpoint: "/api/v1/jobs?size=50",
      onSuccess: (data) => setJobs(data.content ?? []),
      onFailure: (error) => toast.error(error),
    });
  }, []);

  const fetchAnalysis = useCallback(
    (jobId: number) => {
      if (!cvId || !jobId) return;
      request<CVJobAnalysisResponse | null>({
        endpoint: `/api/v1/ai/cvs/${cvId}/jd-analysis?jobId=${jobId}`,
        onSuccess: (data) => {
          if (data && data.id) {
            setAnalysis(data);
            if (data.status === "ANALYZING" || data.status === "PENDING") {
              setPollingId(data.id);
            }
          } else {
            setAnalysis(null);
          }
        },
        onFailure: (error) => toast.error(error),
      });
    },
    [cvId]
  );

  const loadRecommendedJobs = useCallback(
    (force = false) => {
      if (!cvId) {
        return;
      }

      if (!force) {
        const cached = readRecommendedJobsCache(cvId);
        if (cached) {
          setRecommendedJobs(cached);
          return;
        }
      }

      request<JobResponse[]>({
        endpoint: `/api/v1/jobs/recommended?cvId=${cvId}`,
        onSuccess: (data) => {
          const topJobs = (data ?? []).slice(0, 4);
          setRecommendedJobs(topJobs);
          writeRecommendedJobsCache(cvId, topJobs);
        },
        onFailure: () => setRecommendedJobs([]),
      });
    },
    [cvId]
  );

  useEffect(() => {
    loadJobs();
    loadRecommendedJobs();
  }, [loadJobs, loadRecommendedJobs]);

  const selectJob = (job: JobResponse) => {
    setSelectedJob(job);
    setSelectedJobId(job.id);
    setAnalysis(null);
    const params = new URLSearchParams(window.location.search);
    params.set("jobId", job.id.toString());
    navigate(`/ai/jd-workspace?${params.toString()}`, { replace: true });
    fetchAnalysis(job.id);
  };

  const importUrl = async () => {
    if (!url.trim()) {
      toast.error("Please enter a JD URL.");
      return;
    }
    if (!isTopCvUrl(url)) {
      toast.error("Currently only TopCV JD URLs are supported.");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Importing JD URL...");
    await request<JobResponse>({
      endpoint: "/api/v1/jobs/import/url",
      method: "POST",
      body: JSON.stringify({ url }),
      onSuccess: (job) => {
        selectJob(job);
        toast.update(toastId, {
          render: "JD imported as a draft job.",
          type: "success",
          isLoading: false,
          autoClose: 3000,
        });
      },
      onFailure: (error) => {
        toast.update(toastId, {
          render: error,
          type: "error",
          isLoading: false,
          autoClose: 3000,
        });
      },
    });
    setLoading(false);
  };

  const importPdf = async () => {
    if (!pdf) {
      toast.error("Please choose a JD PDF.");
      return;
    }
    const formData = new FormData();
    formData.append("file", pdf);
    setLoading(true);
    const toastId = toast.loading("Importing JD PDF...");
    await request<JobResponse>({
      endpoint: "/api/v1/jobs/import/pdf",
      method: "POST",
      body: formData,
      onSuccess: (job) => {
        selectJob(job);
        toast.update(toastId, {
          render: "JD PDF imported as a draft job.",
          type: "success",
          isLoading: false,
          autoClose: 3000,
        });
      },
      onFailure: (error) => {
        toast.update(toastId, {
          render: error,
          type: "error",
          isLoading: false,
          autoClose: 3000,
        });
      },
    });
    setLoading(false);
  };

  const analyze = async () => {
    const jobId = selectedJob?.id || Number(selectedJobId);
    if (!cvId || !jobId) {
      toast.error("Please select a CV and JD first.");
      return;
    }
    setLoading(true);
    setProgress("analysis");
    await request<CVJobAnalysisResponse>({
      endpoint: `/api/v1/ai/cvs/${cvId}/jd-analysis?jobId=${jobId}`,
      method: "POST",
      onSuccess: (data) => {
        setAnalysis(data);
        setSelectedJob(data.job);
        if (data.status === "ANALYZING" || data.status === "PENDING") {
          setPollingId(data.id);
        } else if (data.status === "COMPLETED") {
          toast.success("CV-JD analysis is ready.");
          setProgress(null);
          setLoading(false);
        }
      },
      onFailure: (error) => {
        toast.error(error);
        setProgress(null);
        setLoading(false);
      },
    });
  };

  const openPreview = async (
    job: JobResponse,
    event?: MouseEvent<HTMLButtonElement>
  ) => {
    event?.stopPropagation();
    setPreviewLoading(true);
    await request<JobResponse>({
      endpoint: `/api/v1/jobs/${job.id}`,
      onSuccess: (data) => setPreviewJob(data),
      onFailure: (error) => toast.error(error),
    });
    setPreviewLoading(false);
  };

  useEffect(() => {
    const urlJobId = Number(searchParams.get("jobId") ?? "");
    if (urlJobId && !selectedJob) {
      const foundInJobs = jobs.find((j) => j.id === urlJobId);
      if (foundInJobs) {
        setSelectedJob(foundInJobs);
        setSelectedJobId(foundInJobs.id);
        fetchAnalysis(foundInJobs.id);
        return;
      }
      const foundInRecs = recommendedJobs.find((j) => j.id === urlJobId);
      if (foundInRecs) {
        setSelectedJob(foundInRecs);
        setSelectedJobId(foundInRecs.id);
        fetchAnalysis(foundInRecs.id);
        return;
      }

      request<JobResponse>({
        endpoint: `/api/v1/jobs/${urlJobId}`,
        onSuccess: (data) => {
          setSelectedJob(data);
          setSelectedJobId(data.id);
          fetchAnalysis(data.id);
        },
        onFailure: () => {
          const params = new URLSearchParams(window.location.search);
          params.delete("jobId");
          navigate(`/ai/jd-workspace?${params.toString()}`, { replace: true });
        },
      });
    }
  }, [
    searchParams,
    jobs,
    recommendedJobs,
    selectedJob,
    fetchAnalysis,
    navigate,
  ]);

  useEffect(() => {
    if (!pollingId) return;

    setProgress("analysis");
    setLoading(true);

    const interval = setInterval(() => {
      request<CVJobAnalysisResponse>({
        endpoint: `/api/v1/ai/cvs/jd-analyses/${pollingId}`,
        onSuccess: (data) => {
          if (data.status === "COMPLETED") {
            setAnalysis(data);
            setSelectedJob(data.job);
            toast.success("CV-JD analysis is ready.");
            setProgress(null);
            setLoading(false);
            setPollingId(null);
          } else if (data.status === "FAILED") {
            toast.error("CV-JD analysis failed. Please try again.");
            setProgress(null);
            setLoading(false);
            setPollingId(null);
          }
        },
        onFailure: (error) => {
          toast.error(error);
          setProgress(null);
          setLoading(false);
          setPollingId(null);
        },
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [pollingId]);

  const activeJob =
    selectedJob || jobs.find((job) => job.id === Number(selectedJobId)) || null;

  const parseReasoning = () => {
    if (!analysis?.matchReasoning) return { reasons: [], gaps: [] };
    try {
      const parsed = JSON.parse(analysis.matchReasoning);
      return { reasons: parsed.reasons || [], gaps: parsed.gaps || [] };
    } catch {
      return { reasons: [], gaps: [analysis.matchReasoning] };
    }
  };

  const reasoning = parseReasoning();

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
          JD Workspace
        </span>
        <h1 className="mt-4 text-3xl font-bold text-gray-900">
          Choose a JD before analyzing this CV
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          Import a live JD URL, upload a JD PDF, or choose an existing job. The
          analysis result includes CV review and CV-JD matching in one step.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-slate-900">JD source:</span>
          {(["url", "pdf", "existing"] as SourceTab[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSourceMode(item)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                sourceMode === item
                  ? "bg-red-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {item === "url"
                ? "JD URL"
                : item === "pdf"
                  ? "JD PDF"
                  : "Existing Job"}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-3xl border border-slate-100 bg-slate-50/60 p-5">
          {sourceMode === "url" ? (
            <div className="grid gap-3">
              <label
                className="text-sm font-semibold text-slate-900"
                htmlFor="jd-url"
              >
                JD URL
              </label>
              <input
                id="jd-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.topcv.vn/viec-lam/..."
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
              />
              <Button
                type="button"
                className="my-0 sm:w-fit"
                onClick={importUrl}
                disabled={loading}
              >
                Import JD URL
              </Button>
            </div>
          ) : sourceMode === "pdf" ? (
            <div className="grid gap-3">
              <label
                className="text-sm font-semibold text-slate-900"
                htmlFor="jd-pdf"
              >
                JD PDF
              </label>
              <input
                id="jd-pdf"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setPdf(event.target.files?.[0] ?? null)
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              />
              <Button
                type="button"
                className="my-0 sm:w-fit"
                onClick={importPdf}
                disabled={loading}
              >
                Import JD PDF
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              <label
                className="text-sm font-semibold text-slate-900"
                htmlFor="existing-job"
              >
                Existing job
              </label>
              <select
                id="existing-job"
                value={selectedJobId}
                onChange={(event) => {
                  const value =
                    event.target.value === "" ? "" : Number(event.target.value);
                  setSelectedJobId(value);
                  const job = jobs.find((job) => job.id === value) ?? null;
                  setSelectedJob(job);
                  setAnalysis(null);
                  if (value !== "") {
                    const params = new URLSearchParams(window.location.search);
                    params.set("jobId", value.toString());
                    navigate(`/ai/jd-workspace?${params.toString()}`, {
                      replace: true,
                    });
                    fetchAnalysis(value);
                  } else {
                    const params = new URLSearchParams(window.location.search);
                    params.delete("jobId");
                    navigate(`/ai/jd-workspace?${params.toString()}`, {
                      replace: true,
                    });
                  }
                }}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
              >
                <option value="">Choose a job...</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} - {job.companyName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {activeJob ? (
          <SelectedJobPanel
            job={activeJob}
            loading={loading || previewLoading}
            mode={mode}
            analysisId={
              analysis?.status === "COMPLETED" ? analysis.id : undefined
            }
            analysisStatus={analysis?.status}
            onAnalyze={analyze}
            onPreview={() => openPreview(activeJob)}
            onStartInterview={() =>
              analysis && navigate(`/ai/interview?analysisId=${analysis.id}`)
            }
          />
        ) : null}

        {analysis && analysis.status === "COMPLETED" ? (
          <div className="mt-6 grid gap-5 rounded-3xl border border-slate-200 bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-700">
                  CV analysis score
                </p>
                <p className="mt-1 text-4xl font-black text-emerald-800">
                  {analysis.score}/100
                </p>
              </div>
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  CV-JD match score
                </p>
                <p className="mt-1 text-4xl font-black text-red-800">
                  {analysis.matchScore}%
                </p>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-700">
              {analysis.summary}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <AnalysisList
                title="Strengths"
                items={[...analysis.strengths, ...reasoning.reasons]}
                tone="green"
              />
              <AnalysisList
                title="Gaps & suggested edits"
                items={[...analysis.improvements, ...reasoning.gaps]}
                tone="amber"
              />
            </div>
          </div>
        ) : null}
      </section>

      <aside className="space-y-5">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Current CV</h2>
          <p className="mt-2 text-sm text-gray-600">
            CV #{cvId || "missing"} will be evaluated against the selected JD.
          </p>
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            TopCV URLs are preferred because their JD sections are usually
            structured and easier to parse.
          </div>
        </section>

        <RecommendedJobsPanel
          jobs={recommendedJobs}
          selectedJobId={selectedJobId}
          loading={previewLoading}
          onReload={() => loadRecommendedJobs(true)}
          onSelect={selectJob}
          onPreview={openPreview}
        />
      </aside>

      {previewJob ? (
        <JobPreviewModal
          job={previewJob}
          onClose={() => setPreviewJob(null)}
          onUse={() => {
            selectJob(previewJob);
            setPreviewJob(null);
          }}
        />
      ) : null}

      {progress === "analysis" ? (
        <ProgressModal
          title="Analyzing CV with JD"
          message="The system is reading the CV, comparing it with the selected JD, calculating match score, and preparing suggested edits."
          steps={[
            "Extracting the most relevant CV signals",
            "Comparing experience, skills, and JD requirements",
            "Generating strengths, gaps, and rewrite suggestions",
          ]}
        />
      ) : null}
    </div>
  );
}

function ProgressModal({
  title,
  message,
  steps,
}: {
  title: string;
  message: string;
  steps: string[];
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-red-100 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <div className="absolute h-14 w-14 animate-spin rounded-full border-4 border-red-200 border-t-red-700" />
            <div className="h-3 w-3 rounded-full bg-red-700" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
              Please wait
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-900">{title}</h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-5 grid gap-2">
          {steps.map((step) => (
            <div
              key={step}
              className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
              {step}
            </div>
          ))}
        </div>
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/3 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-red-700" />
        </div>
      </div>
    </div>
  );
}

function RecommendedJobsPanel({
  jobs,
  selectedJobId,
  loading,
  onReload,
  onSelect,
  onPreview,
}: {
  jobs: JobResponse[];
  selectedJobId: number | "";
  loading: boolean;
  onReload: () => void;
  onSelect: (job: JobResponse) => void;
  onPreview: (job: JobResponse, event?: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Recommended jobs
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Top 4 for this CV.
          </p>
        </div>
        <button
          type="button"
          onClick={onReload}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          title="Reload recommendations"
        >
          <FiRefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            No cached recommendations yet.
          </div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className={`rounded-2xl border p-3 transition ${
                selectedJobId === job.id
                  ? "border-red-200 bg-red-50/50"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-1.5">
                  <img
                    src={
                      job.companyLogo ||
                      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100"
                    }
                    alt={job.companyName}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                    {job.title}
                  </h3>
                  <p className="mt-1 truncate text-xs font-medium text-slate-500">
                    {job.companyName} - {job.location || "No location"}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-700">
                    {formatSalary(job)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onSelect(job)}
                  className="flex-1 rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-800"
                >
                  Analyze CV with JD
                </button>
                <button
                  type="button"
                  onClick={(event) => onPreview(job, event)}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiEye className="h-3.5 w-3.5" />
                  Preview
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SelectedJobPanel({
  job,
  loading,
  mode,
  analysisStatus,
  analysisId,
  onAnalyze,
  onPreview,
  onStartInterview,
}: {
  job: JobResponse;
  loading: boolean;
  mode: string;
  analysisStatus?: string;
  analysisId?: number;
  onAnalyze: () => void;
  onPreview: () => void;
  onStartInterview: () => void;
}) {
  return (
    <div className="mt-5 rounded-3xl border border-red-100 bg-red-50/40 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
        Selected JD
      </p>
      <h2 className="mt-2 text-xl font-bold text-slate-900">{job.title}</h2>
      <p className="mt-1 text-sm text-slate-600">
        {job.companyName} - {job.location || "No location"} - {job.status}
      </p>
      <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-700">
        {job.requirements || job.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="button"
          className="my-0 sm:w-fit"
          onClick={onAnalyze}
          disabled={
            loading ||
            analysisStatus === "ANALYZING" ||
            analysisStatus === "PENDING"
          }
        >
          {analysisStatus === "ANALYZING" || analysisStatus === "PENDING"
            ? "Analyzing..."
            : loading
              ? "Analyzing..."
              : "Analyze CV with JD"}
        </Button>
        <button
          type="button"
          onClick={onPreview}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiEye className="h-4 w-4" />
          Preview
        </button>
        {analysisId && analysisStatus === "COMPLETED" ? (
          <Button
            type="button"
            outline
            className="my-0 sm:w-fit"
            onClick={onStartInterview}
          >
            Start Mock Interview
          </Button>
        ) : mode === "interview" &&
          (!analysisStatus || analysisStatus === "FAILED") ? (
          <span className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            Analyze first to unlock mock interview.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function JobPreviewModal({
  job,
  onClose,
  onUse,
}: {
  job: JobResponse;
  onClose: () => void;
  onUse: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <div className="max-h-[88vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-white p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
              JD Preview
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">
              {job.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {job.companyName} - {job.location || "No location"} -{" "}
              {formatSalary(job)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
            aria-label="Close preview"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="grid gap-5">
            <PreviewSection title="Description" content={job.description} />
            <PreviewSection title="Requirements" content={job.requirements} />
            <PreviewSection
              title="Responsibilities"
              content={job.responsibilities}
            />
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="font-bold text-slate-900">General Information</h3>
            <div className="mt-4 grid gap-4 text-sm">
              <InfoRow
                label="Work mode"
                value={`${getJobTypeLabel(job.jobType)} - ${job.workMode}`}
              />
              <InfoRow
                label="Experience"
                value={getExperienceLabel(job.experienceLevel)}
              />
              <InfoRow
                label="Deadline"
                value={formatDeadline(job.applicationDeadline)}
              />
            </div>
            <div className="mt-5 border-t border-slate-200 pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Skills
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {job.skills.length ? (
                  job.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No skills listed.</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onUse}
              className="mt-5 w-full rounded-2xl bg-red-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-800"
            >
              Use this JD
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}

function PreviewSection({
  title,
  content,
}: {
  title: string;
  content: string | null;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
        {content || "No content available."}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function AnalysisList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "amber";
}) {
  const color =
    tone === "green"
      ? "bg-emerald-50 text-emerald-800"
      : "bg-amber-50 text-amber-900";
  return (
    <div>
      <h3 className="font-bold text-slate-900">{title}</h3>
      <ul className="mt-2 grid gap-2">
        {items
          .filter(Boolean)
          .slice(0, 6)
          .map((item, index) => (
            <li
              key={`${item}-${index}`}
              className={`rounded-2xl px-3 py-2 text-sm ${color}`}
            >
              {item}
            </li>
          ))}
      </ul>
    </div>
  );
}

function getJobTypeLabel(jobType: JobResponse["jobType"]) {
  const labels = {
    FULL_TIME: "Full-time",
    PART_TIME: "Part-time",
    INTERNSHIP: "Internship",
    CONTRACT: "Contract",
  };
  return labels[jobType] ?? jobType;
}

function getExperienceLabel(experienceLevel: string) {
  const labels: Record<string, string> = {
    INTERN: "Intern",
    JUNIOR: "Junior (1-2 years)",
    MIDDLE: "Middle (2-5 years)",
    SENIOR: "Senior (5+ years)",
    LEAD: "Lead",
  };
  return labels[experienceLevel] ?? experienceLevel;
}

function formatSalary(job: JobResponse) {
  if (job.salaryMin && job.salaryMax) {
    return `${(job.salaryMin / 1000000).toFixed(0)} - ${(job.salaryMax / 1000000).toFixed(0)}M ${job.salaryCurrency || "VND"}`;
  }
  if (job.salaryMin) {
    return `From ${(job.salaryMin / 1000000).toFixed(0)}M ${job.salaryCurrency || "VND"}`;
  }
  if (job.salaryMax) {
    return `Up to ${(job.salaryMax / 1000000).toFixed(0)}M ${job.salaryCurrency || "VND"}`;
  }
  return "Negotiable";
}

function formatDeadline(deadline: string | null) {
  if (!deadline) {
    return "No deadline";
  }
  return new Date(deadline).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function readRecommendedJobsCache(cvId: number) {
  try {
    const raw = localStorage.getItem(`${RECOMMENDED_CACHE_PREFIX}${cvId}`);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as JobResponse[];
    return Array.isArray(parsed) ? parsed.slice(0, 4) : null;
  } catch {
    return null;
  }
}

function writeRecommendedJobsCache(cvId: number, jobs: JobResponse[]) {
  try {
    localStorage.setItem(
      `${RECOMMENDED_CACHE_PREFIX}${cvId}`,
      JSON.stringify(jobs.slice(0, 4))
    );
  } catch {
    // Browser storage can be unavailable in private mode; recommendations still work without cache.
  }
}

function isTopCvUrl(value: string) {
  try {
    const parsed = new URL(
      value.trim().startsWith("http") ? value.trim() : `https://${value.trim()}`
    );
    return (
      parsed.hostname === "topcv.vn" || parsed.hostname.endsWith(".topcv.vn")
    );
  } catch {
    return false;
  }
}
