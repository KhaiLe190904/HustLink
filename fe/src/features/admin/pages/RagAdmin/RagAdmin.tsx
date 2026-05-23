import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import { request } from "@/utils/api";

interface RagStatsResponse {
  totalQuestions: number;
  byLevel: Record<string, number>;
  byLanguage: Record<string, number>;
  byCategory: Record<string, number>;
}

interface RagImportItem {
  questionText: string;
  targetPosition: string;
  level: string;
  category: string;
  difficulty: string;
  expectedPoints: string[];
  source: string;
  languageCode: string;
}

interface RagImportResponse {
  importedCount: number;
  skippedCount: number;
  remainingCount: number;
}

interface VectorStoreInitResponse {
  collections: string[];
  dimension: number;
}

interface VectorStoreResetResponse {
  collection: string;
  dimension: number;
  message: string;
}

export function RagAdmin() {
  const [stats, setStats] = useState<RagStatsResponse | null>(null);
  const [parsedItems, setParsedItems] = useState<RagImportItem[]>([]);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetConfirmations, setResetConfirmations] = useState({
    clearVectors: false,
    importAgain: false,
    spendTokensAgain: false,
  });

  const loadStats = async () => {
    await request<RagStatsResponse>({
      endpoint: "/api/v1/admin/rag/stats",
      onSuccess: (data) => setStats(data),
      onFailure: (error) => toast.error(error),
    });
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const onFileChange = async (file: File | null) => {
    if (!file) {
      setParsedItems([]);
      setSelectedFileName("");
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as RagImportItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("JSON must be a non-empty array.");
      }
      setParsedItems(parsed);
      setSelectedFileName(file.name);
      toast.success(`Loaded ${parsed.length} question(s) from ${file.name}.`);
    } catch (error) {
      setParsedItems([]);
      setSelectedFileName("");
      toast.error(
        error instanceof Error ? error.message : "Could not read JSON file."
      );
    }
  };

  const initVectorStore = async () => {
    setIsInitializing(true);
    await request<VectorStoreInitResponse>({
      endpoint: "/api/v1/admin/infra/init-vector-store",
      method: "POST",
      body: JSON.stringify({}),
      onSuccess: (data) => {
        toast.success(
          `Initialized ${data.collections.length} collection(s) with dimension ${data.dimension}.`
        );
      },
      onFailure: (error) => toast.error(error),
    });
    setIsInitializing(false);
  };

  const importQuestions = async () => {
    if (parsedItems.length === 0) {
      toast.error("Choose a JSON file before importing.");
      return;
    }

    setIsImporting(true);
    await request<RagImportResponse>({
      endpoint: "/api/v1/admin/rag/import",
      method: "POST",
      body: JSON.stringify(parsedItems),
      onSuccess: async (data) => {
        toast.success(
          `Imported ${data.importedCount}, skipped ${data.skippedCount}, remaining ${data.remainingCount}.`
        );
        await loadStats();
      },
      onFailure: (error) => toast.error(error),
    });
    setIsImporting(false);
  };

  const reindexQuestions = async () => {
    setIsReindexing(true);
    await request<RagStatsResponse>({
      endpoint: "/api/v1/admin/rag/reindex",
      method: "POST",
      body: JSON.stringify({}),
      onSuccess: (data) => {
        setStats(data);
        toast.success(`Reindexed ${data.totalQuestions} question(s).`);
      },
      onFailure: (error) => toast.error(error),
    });
    setIsReindexing(false);
  };

  const resetInterviewQuestionBank = async () => {
    if (!Object.values(resetConfirmations).every(Boolean)) {
      toast.error("Please confirm all three reset steps first.");
      return;
    }

    setIsResetting(true);
    await request<VectorStoreResetResponse>({
      endpoint: "/api/v1/admin/infra/reset-interview-question-bank",
      method: "POST",
      body: JSON.stringify({}),
      onSuccess: async (data) => {
        toast.success(
          `${data.collection} reset at dimension ${data.dimension}.`
        );
        setResetConfirmations({
          clearVectors: false,
          importAgain: false,
          spendTokensAgain: false,
        });
        await loadStats();
      },
      onFailure: (error) => toast.error(error),
    });
    setIsResetting(false);
  };

  const allResetConfirmed = Object.values(resetConfirmations).every(Boolean);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-red-100 bg-gradient-to-br from-white via-red-50 to-amber-50 p-6 shadow-sm">
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
          Admin RAG Console
        </span>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">
          Import and reindex the interview question bank
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          This page is for initializing Qdrant, importing curated JSON, and
          checking whether the question bank is balanced across level, language,
          and category.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_22rem]">
        <div className="grid gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Import JSON</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use the sample file at{" "}
              <code>be/src/main/resources/seed/questions.seed.json</code>. Each
              item now requires `targetPosition`, `level`, and `expectedPoints`.
            </p>

            <div className="mt-5 grid gap-4">
              <label className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) =>
                    void onFileChange(event.target.files?.[0] ?? null)
                  }
                />
                <span className="block text-sm font-semibold text-slate-900">
                  {selectedFileName ||
                    "Choose a JSON file to preview before import"}
                </span>
                <span className="mt-2 block text-xs text-slate-500">
                  {parsedItems.length > 0
                    ? `${parsedItems.length} question(s) loaded`
                    : "The file stays in your browser until you press Import"}
                </span>
              </label>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  className="my-0 sm:w-fit"
                  onClick={importQuestions}
                  disabled={isImporting || parsedItems.length === 0}
                >
                  {isImporting ? "Importing..." : "Import Questions"}
                </Button>
                <Button
                  type="button"
                  outline
                  className="my-0 sm:w-fit"
                  onClick={reindexQuestions}
                  disabled={isReindexing}
                >
                  {isReindexing ? "Reindexing..." : "Reindex All"}
                </Button>
                <Button
                  type="button"
                  outline
                  className="my-0 sm:w-fit"
                  onClick={initVectorStore}
                  disabled={isInitializing}
                >
                  {isInitializing ? "Initializing..." : "Init Vector Store"}
                </Button>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Clear interview vectors carefully
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-800">
                  This removes only the <code>interview_question_bank</code>{" "}
                  collection in Qdrant, then recreates it empty. It does not
                  import anything by itself, so you stay in control of when
                  embedding tokens are spent again.
                </p>

                <div className="mt-4 grid gap-3">
                  <ConfirmationRow
                    checked={resetConfirmations.clearVectors}
                    label="I understand this permanently clears the interview question vectors from Qdrant."
                    onChange={(checked) =>
                      setResetConfirmations((current) => ({
                        ...current,
                        clearVectors: checked,
                      }))
                    }
                  />
                  <ConfirmationRow
                    checked={resetConfirmations.importAgain}
                    label="I understand I will need to import questions or run Reindex All before RAG can use this bank again."
                    onChange={(checked) =>
                      setResetConfirmations((current) => ({
                        ...current,
                        importAgain: checked,
                      }))
                    }
                  />
                  <ConfirmationRow
                    checked={resetConfirmations.spendTokensAgain}
                    label="I understand a future import or reindex will call embeddings again and spend tokens."
                    onChange={(checked) =>
                      setResetConfirmations((current) => ({
                        ...current,
                        spendTokensAgain: checked,
                      }))
                    }
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    outline
                    className="my-0 border-amber-300 text-amber-900 hover:bg-amber-100 sm:w-fit"
                    onClick={resetInterviewQuestionBank}
                    disabled={isResetting || !allResetConfirmed}
                  >
                    {isResetting
                      ? "Resetting..."
                      : "Clear Qdrant Interview Bank"}
                  </Button>
                  <span className="text-xs text-amber-700">
                    Enabled only after all three confirmations are checked.
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Preview</h2>
            {parsedItems.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Load a JSON file to inspect the first few records before import.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {parsedItems.slice(0, 5).map((item, index) => (
                  <article
                    key={`${item.targetPosition}-${item.level}-${index}`}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
                      <span>{item.targetPosition}</span>
                      <span>{item.level}</span>
                      <span>{item.category}</span>
                      <span>{item.languageCode}</span>
                    </div>
                    <p className="mt-3 font-semibold text-slate-900">
                      {item.questionText}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Expected points: {item.expectedPoints.join("; ")}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="grid gap-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Stats</h2>
            {!stats ? (
              <p className="mt-3 text-sm text-slate-500">
                Loading statistics...
              </p>
            ) : (
              <div className="mt-4 grid gap-4 text-sm text-slate-700">
                <div className="rounded-2xl bg-red-50 px-4 py-3">
                  Total questions: <strong>{stats.totalQuestions}</strong>
                </div>
                <MetricGroup title="By level" values={stats.byLevel} />
                <MetricGroup title="By language" values={stats.byLanguage} />
                <MetricGroup title="By category" values={stats.byCategory} />
              </div>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}

function ConfirmationRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-white px-3 py-3 text-sm text-slate-700">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-amber-600"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function MetricGroup({
  title,
  values,
}: {
  title: string;
  values: Record<string, number>;
}) {
  return (
    <div>
      <p className="font-semibold text-slate-900">{title}</p>
      <div className="mt-2 grid gap-2">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="rounded-xl bg-slate-50 px-3 py-2">
            {key}: <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
