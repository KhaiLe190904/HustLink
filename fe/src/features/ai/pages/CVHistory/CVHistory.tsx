import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiClock,
  FiFileText,
  FiMessageCircle,
} from "react-icons/fi";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import { JobResponse } from "@/features/jobs/types/jobs";
import { request } from "@/utils/api";

interface CVJobAnalysisResponse {
  id: number;
  cvId: number;
  cvFileName: string;
  job: JobResponse;
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  extractedSkills: string[];
  matchScore: number;
  matchBreakdown: string;
  matchReasoning: string;
  updatedAt: string;
}

export function CVHistory() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cvId = searchParams.get("cvId");
  const [analyses, setAnalyses] = useState<CVJobAnalysisResponse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadHistory = useCallback(() => {
    setLoading(true);
    const query = cvId ? `?cvId=${cvId}` : "";
    request<CVJobAnalysisResponse[]>({
      endpoint: `/api/v1/ai/cvs/jd-analyses${query}`,
      onSuccess: (data) => {
        setAnalyses(data ?? []);
        setSelectedId((current) => current ?? data?.[0]?.id ?? null);
      },
      onFailure: (error) => toast.error(error),
    }).finally(() => setLoading(false));
  }, [cvId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const selected = useMemo(
    () =>
      analyses.find((analysis) => analysis.id === selectedId) ??
      analyses[0] ??
      null,
    [analyses, selectedId]
  );

  const reasoning = useMemo(
    () => parseReasoning(selected?.matchReasoning),
    [selected]
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="min-w-0 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-red-700">
              AI CV History
            </span>
            <h1 className="mt-4 text-2xl font-black text-slate-900">
              CV-JD analyses
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Review saved evaluations and continue mock interviews from the
              same JD context.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
              Loading history...
            </div>
          ) : analyses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
              No CV-JD analysis has been saved yet. Start from AI CV Upload and
              analyze a CV with a JD.
            </div>
          ) : (
            analyses.map((analysis) => (
              <button
                key={analysis.id}
                type="button"
                onClick={() => setSelectedId(analysis.id)}
                className={`w-full overflow-hidden rounded-2xl border p-4 text-left transition ${
                  selected?.id === analysis.id
                    ? "border-red-200 bg-red-50/60"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-red-700 shadow-sm">
                    <FiBriefcase className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="line-clamp-2 break-words text-sm font-black leading-5 text-slate-900">
                      {analysis.job.title}
                    </h2>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                      {analysis.job.companyName}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className="rounded-full bg-white px-2 py-1 text-slate-700">
                        CV {analysis.score}/100
                      </span>
                      <span className="rounded-full bg-white px-2 py-1 text-red-700">
                        Match {analysis.matchScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        {!selected ? (
          <div className="grid min-h-[28rem] place-items-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <div>
              <FiFileText className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-500">
                Choose an analysis to review.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <FiClock className="h-4 w-4" />
                  {new Date(selected.updatedAt).toLocaleString()}
                </p>
                <h2 className="mt-3 text-3xl font-black leading-tight text-slate-950">
                  {selected.job.title}
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  {selected.job.companyName} -{" "}
                  {selected.job.location || "No location"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  CV: {selected.cvFileName}
                </p>
              </div>
              <div className="grid w-full shrink-0 grid-cols-1 gap-2 sm:w-auto sm:grid-cols-2 lg:w-40 lg:grid-cols-1">
                <Button
                  type="button"
                  size="medium"
                  className="my-0 whitespace-nowrap"
                  onClick={() =>
                    navigate(`/ai/interview?analysisId=${selected.id}`)
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    <FiMessageCircle className="h-4 w-4" />
                    Mock Interview
                  </span>
                </Button>
                <Button
                  type="button"
                  outline
                  size="medium"
                  className="my-0 whitespace-nowrap"
                  onClick={() => navigate(`/jobs/${selected.job.id}`)}
                >
                  Open JD
                </Button>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ScoreCard
                label="CV analysis score"
                value={`${selected.score}/100`}
                tone="emerald"
              />
              <ScoreCard
                label="CV-JD match score"
                value={`${selected.matchScore}%`}
                tone="red"
              />
            </div>

            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <h3 className="font-black text-slate-900">Summary</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                {selected.summary}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <AnalysisList
                title="Strengths"
                items={[...selected.strengths, ...reasoning.reasons]}
                tone="green"
              />
              <AnalysisList
                title="Gaps & suggested edits"
                items={[...selected.improvements, ...reasoning.gaps]}
                tone="amber"
              />
            </div>

            <div className="rounded-3xl border border-slate-100 p-5">
              <h3 className="font-black text-slate-900">Extracted CV skills</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.extractedSkills.length ? (
                  selected.extractedSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                    >
                      {skill}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No extracted skills saved.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ScoreCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "red";
}) {
  const color =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-800"
      : "bg-red-50 text-red-800";
  return (
    <div className={`rounded-3xl p-5 ${color}`}>
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-2 text-4xl font-black">{value}</p>
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
  const uniqueItems = Array.from(new Set(items.filter(Boolean)));
  return (
    <div>
      <h3 className="font-black text-slate-900">{title}</h3>
      <ul className="mt-3 grid gap-2">
        {uniqueItems.length ? (
          uniqueItems.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className={`rounded-2xl px-4 py-3 text-sm leading-6 ${color}`}
            >
              {item}
            </li>
          ))
        ) : (
          <li className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No details saved.
          </li>
        )}
      </ul>
    </div>
  );
}

function parseReasoning(value?: string) {
  if (!value) {
    return { reasons: [] as string[], gaps: [] as string[] };
  }
  try {
    const parsed = JSON.parse(value);
    return {
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
    };
  } catch {
    return { reasons: [] as string[], gaps: [value] };
  }
}
