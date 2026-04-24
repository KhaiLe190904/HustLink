import { ChangeEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { Button } from "@/features/authentication/components/Button/Button";
import { request } from "@/utils/api";

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

export function CVUpload() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [dailyAnalysisLimit, setDailyAnalysisLimit] = useState(2);
  const [remainingAnalysesToday, setRemainingAnalysesToday] = useState(0);
  const [cvs, setCvs] = useState<CvSummary[]>([]);
  const [analysis, setAnalysis] = useState<CvAnalysisResponse | null>(null);

  const loadConfig = () => {
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
  };

  const loadCvs = () => {
    request<CvSummary[]>({
      endpoint: "/api/v1/ai/cvs/mine",
      onSuccess: setCvs,
      onFailure: (error) => toast.error(error),
    });
  };

  useEffect(() => {
    loadConfig();
    loadCvs();
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
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
        toast.success(data.message);
        loadCvs();
      },
      onFailure: (error) => toast.error(error),
    });

    setUploading(false);
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
                    PDF only for the current MVP.
                  </p>
                </div>
              </label>
              <input
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
              cvs.map((cv) => (
                <article
                  key={cv.id}
                  className="grid gap-4 rounded-2xl border border-gray-200 p-4 md:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="grid gap-1">
                    <h3 className="font-semibold text-gray-900">
                      {cv.originalFileName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Uploaded {new Date(cv.uploadedAt).toLocaleString()}
                    </p>
                    <a
                      className="text-sm font-medium text-red-700 hover:underline"
                      href={cv.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open file
                    </a>
                    <p className="text-sm text-gray-600">
                      Status:{" "}
                      {cv.analyzed
                        ? `Analyzed, score ${cv.analysisScore}/100`
                        : "Uploaded, waiting for AI analysis"}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {cv.analyzed ? (
                      <>
                        <Button
                          type="button"
                          outline
                          className="my-0 px-5 sm:w-fit"
                          onClick={() => handleViewAnalysis(cv.id)}
                        >
                          View Analysis
                        </Button>
                        <Button
                          type="button"
                          className="my-0 px-5 sm:w-fit"
                          onClick={() =>
                            navigate(`/ai/interview?cvId=${cv.id}`)
                          }
                          disabled={!geminiConfigured}
                        >
                          Start Mock Interview
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          className="my-0 px-5 sm:w-fit"
                          onClick={() => handleAnalyze(cv.id)}
                          disabled={
                            !geminiConfigured ||
                            analyzingId === cv.id ||
                            remainingAnalysesToday <= 0
                          }
                        >
                          {analyzingId === cv.id
                            ? "Analyzing..."
                            : "Analyze with Gemini"}
                        </Button>
                        <Button
                          type="button"
                          outline
                          className="my-0 px-5 sm:w-fit"
                          onClick={() =>
                            navigate(`/ai/interview?cvId=${cv.id}`)
                          }
                          disabled={!geminiConfigured}
                        >
                          Start Mock Interview
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))
            )}
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
    </div>
  );
}
