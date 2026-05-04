import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { Button } from "@/features/authentication/components/Button/Button";
import { request } from "@/utils/api";

const MAX_CV_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const CVS_PER_PAGE = 5;

interface CvSummary {
  id: number;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  downloadUrl: string;
  analysisScore: number | null;
  analyzed: boolean;
  uploadedAt: string;
}

interface CvUploadResponse {
  id: number;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  storagePath: string | null;
  downloadUrl: string;
  extractedTextPreview: string;
  uploadedAt: string;
  message: string;
}

interface CvAnalysisResponse {
  id: number;
  originalFileName: string;
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  updatedAt: string;
}

interface CvConfigResponse {
  geminiConfigured: boolean;
  dailyAnalysisLimit: number;
  remainingAnalysesToday: number;
}

const friendlyUploadError = (error: string) => {
  if (error.includes("not a valid readable PDF")) {
    return "This file is not a valid readable PDF. Please upload another CV file.";
  }

  return error;
};

const friendlyDeleteError = (error: string) => {
  if (error.includes("already has interview history")) {
    return "This CV already contains interview history, so it cannot be deleted.";
  }

  return error;
};

export function CVUpload() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [dailyAnalysisLimit, setDailyAnalysisLimit] = useState(2);
  const [remainingAnalysesToday, setRemainingAnalysesToday] = useState(0);
  const [cvs, setCvs] = useState<CvSummary[]>([]);
  const [analysis, setAnalysis] = useState<CvAnalysisResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteCv, setConfirmDeleteCv] = useState<CvSummary | null>(
    null
  );

  const loadConfig = useCallback(() => {
    request<CvConfigResponse>({
      endpoint: "/api/v1/ai/cvs/config",
      onSuccess: ({
        geminiConfigured,
        dailyAnalysisLimit,
        remainingAnalysesToday,
      }) => {
        setGeminiConfigured(geminiConfigured);
        setDailyAnalysisLimit(dailyAnalysisLimit);
        setRemainingAnalysesToday(remainingAnalysesToday);
      },
      onFailure: (error) => toast.error(error),
    });
  }, []);

  const loadCvs = useCallback(() => {
    request<CvSummary[]>({
      endpoint: "/api/v1/ai/cvs/mine",
      onSuccess: setCvs,
      onFailure: (error) => toast.error(error),
    });
  }, []);

  useEffect(() => {
    loadConfig();
    loadCvs();
  }, [loadConfig, loadCvs]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(cvs.length / CVS_PER_PAGE));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, cvs.length]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file && file.size > MAX_CV_FILE_SIZE_BYTES) {
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      toast.error("CV file must be 25MB or smaller.");
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please choose a PDF CV first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    setUploading(true);

    await request<CvUploadResponse>({
      endpoint: "/api/v1/ai/cvs/upload",
      method: "POST",
      body: formData,
      onSuccess: (data) => {
        setSelectedFile(null);
        setFileInputKey((current) => current + 1);
        toast.success(data.message);
        loadCvs();
      },
      onFailure: (error) => toast.error(friendlyUploadError(error)),
    });

    setUploading(false);
  };

  const handleDeleteCv = async (cvId: number) => {
    setDeletingId(cvId);
    try {
      await request<void>({
        endpoint: `/api/v1/ai/cvs/${cvId}`,
        method: "DELETE",
        onSuccess: () => {
          if (analysis?.id === cvId) {
            setAnalysis(null);
          }
          toast.success("CV deleted successfully.");
          loadCvs();
        },
        onFailure: (error) => toast.error(friendlyDeleteError(error)),
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAnalyze = async (cvId: number) => {
    const loadingToastId = toast.loading(
      "AI is analyzing your CV. This may take a little while."
    );
    setAnalyzingId(cvId);
    try {
      await request<CvAnalysisResponse>({
        endpoint: `/api/v1/ai/cvs/${cvId}/analysis`,
        method: "POST",
        onSuccess: (data) => {
          setAnalysis(data);
          toast.update(loadingToastId, {
            render: "CV analysis is ready.",
            type: "success",
            isLoading: false,
            autoClose: 3000,
            closeOnClick: true,
          });
          loadCvs();
          loadConfig();
        },
        onFailure: (error) => {
          toast.update(loadingToastId, {
            render: error,
            type: "error",
            isLoading: false,
            autoClose: 4000,
            closeOnClick: true,
          });
        },
      });
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleViewAnalysis = async (cvId: number) => {
    await request<CvAnalysisResponse>({
      endpoint: `/api/v1/ai/cvs/${cvId}/analysis`,
      onSuccess: setAnalysis,
      onFailure: (error) => toast.error(error),
    });
  };

  const totalPages = Math.max(1, Math.ceil(cvs.length / CVS_PER_PAGE));
  const pageStart = (currentPage - 1) * CVS_PER_PAGE;
  const paginatedCvs = cvs.slice(pageStart, pageStart + CVS_PER_PAGE);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
      <section className="grid gap-6">
        <div className="overflow-hidden rounded-3xl border border-red-100 bg-gradient-to-br from-white via-red-50 to-amber-50 shadow-sm">
          <div className="grid gap-6 p-6 md:p-8">
            <div className="grid gap-3">
              <span className="w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
                AI CV Upload
              </span>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Upload CV PDF and prepare for AI-based analysis
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-600">
                  Upload your PDF CV, then run AI analysis when you are ready.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-red-200 bg-white/80 p-6">
              <label
                htmlFor="cv-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-b from-red-50 to-white px-6 py-10 text-center transition hover:border-red-300 hover:bg-red-50/70"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-700">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedFile
                      ? selectedFile.name
                      : "Choose a CV in PDF format"}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    PDF only, maximum file size 25MB.
                  </p>
                </div>
              </label>
              <input
                key={fileInputKey}
                id="cv-upload"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  className="my-0 sm:w-fit sm:px-8"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? "Uploading..." : "Upload CV"}
                </Button>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div>
                    Gemini status:{" "}
                    <strong>
                      {geminiConfigured
                        ? "API key configured"
                        : "API key missing"}
                    </strong>
                  </div>
                  <div className="mt-1">
                    Daily AI analysis limit:{" "}
                    <strong>
                      {remainingAnalysesToday}/{dailyAnalysisLimit} remaining
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Uploaded CVs</h2>
              <p className="text-sm text-gray-500">
                View previous uploads and open analysis when available.
              </p>
            </div>
            <Button
              type="button"
              outline
              className="my-0 sm:w-fit"
              onClick={() => navigate("/ai/interview/history")}
            >
              Interview History
            </Button>
          </div>

          <div className="mt-5 grid gap-4">
            {cvs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                You have not uploaded any CV yet.
              </div>
            ) : (
              paginatedCvs.map((cv) => (
                <article
                  key={cv.id}
                  className="grid gap-4 rounded-2xl border border-gray-200 p-4 lg:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="grid gap-2">
                    <h3 className="line-clamp-2 text-lg font-semibold text-gray-900">
                      {cv.originalFileName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                      <span>{new Date(cv.uploadedAt).toLocaleString()}</span>
                      <span className="hidden text-gray-300 sm:inline">•</span>
                      <a
                        className="font-medium text-red-700 hover:underline"
                        href={cv.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open PDF
                      </a>
                    </div>
                    <p className="text-sm text-gray-600">
                      {cv.analyzed
                        ? `Analyzed • Score ${cv.analysisScore}/100`
                        : "Uploaded • Waiting for analysis"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <Button
                      type="button"
                      outline
                      size="medium"
                      className="my-0 px-4 sm:w-fit"
                      onClick={() => setConfirmDeleteCv(cv)}
                      disabled={deletingId === cv.id}
                    >
                      {deletingId === cv.id ? "Deleting..." : "Delete"}
                    </Button>
                    {cv.analyzed ? (
                      <>
                        <Button
                          type="button"
                          outline
                          size="medium"
                          className="my-0 px-4 sm:w-fit"
                          onClick={() => handleViewAnalysis(cv.id)}
                        >
                          View
                        </Button>
                        <Button
                          type="button"
                          size="medium"
                          className="my-0 px-4 sm:w-fit"
                          onClick={() =>
                            navigate(`/ai/interview?cvId=${cv.id}`)
                          }
                          disabled={!geminiConfigured}
                        >
                          Mock Interview
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="medium"
                          className="my-0 px-4 sm:w-fit"
                          onClick={() => handleAnalyze(cv.id)}
                          disabled={
                            !geminiConfigured ||
                            analyzingId === cv.id ||
                            remainingAnalysesToday <= 0
                          }
                        >
                          {analyzingId === cv.id ? "Analyzing..." : "Analyze"}
                        </Button>
                        <Button
                          type="button"
                          outline
                          size="medium"
                          className="my-0 px-4 sm:w-fit"
                          onClick={() =>
                            navigate(`/ai/interview?cvId=${cv.id}`)
                          }
                          disabled={!geminiConfigured}
                        >
                          Mock Interview
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))
            )}
            {cvs.length > CVS_PER_PAGE ? (
              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    outline
                    size="medium"
                    className="my-0 px-4 sm:w-fit"
                    onClick={() =>
                      setCurrentPage((page) => Math.max(1, page - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    outline
                    size="medium"
                    className="my-0 px-4 sm:w-fit"
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="grid gap-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Latest Analysis</h2>
          {!analysis ? (
            <p className="mt-3 text-sm text-gray-500">
              No analysis is open yet. Upload a CV or choose one that has
              already been analyzed to review the result.
            </p>
          ) : (
            <div className="mt-4 grid gap-5">
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="text-sm text-red-700">Overall CV score</p>
                <p className="mt-1 text-3xl font-bold text-red-800">
                  {analysis.score}/100
                </p>
                <p className="mt-2 text-sm text-red-900">
                  {analysis.originalFileName}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">Summary</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {analysis.summary}
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">Strengths</h3>
                <ul className="mt-2 grid gap-2 text-sm text-gray-600">
                  {analysis.strengths.map((item) => (
                    <li
                      key={item}
                      className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900">Improvements</h3>
                <ul className="mt-2 grid gap-2 text-sm text-gray-600">
                  {analysis.improvements.map((item) => (
                    <li
                      key={item}
                      className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </aside>
      {confirmDeleteCv ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Delete CV?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-800">
                {confirmDeleteCv.originalFileName}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                outline
                size="medium"
                className="my-0 px-4 sm:w-fit"
                onClick={() => setConfirmDeleteCv(null)}
                disabled={deletingId === confirmDeleteCv.id}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="medium"
                className="my-0 px-4 sm:w-fit bg-red-600 hover:bg-red-700"
                disabled={deletingId === confirmDeleteCv.id}
                onClick={async () => {
                  await handleDeleteCv(confirmDeleteCv.id);
                  setConfirmDeleteCv(null);
                }}
              >
                {deletingId === confirmDeleteCv.id ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
