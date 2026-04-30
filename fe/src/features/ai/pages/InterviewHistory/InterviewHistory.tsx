import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import { request } from "@/utils/api";
import { Page } from "@/utils/pagination";

interface InterviewSessionSummaryResponse {
  sessionId: number;
  cvId: number;
  cvFileName: string;
  jobPosition: string;
  languageCode: string;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
  overallScore: number | null;
  startedAt: string;
  completedAt: string | null;
}

interface InterviewAnswerReviewResponse {
  questionId: number;
  questionOrder: number;
  category: string;
  questionText: string;
  answerText: string;
  durationSeconds: number | null;
  score: number | null;
  feedback: string;
  strengths: string[];
  improvements: string[];
}

interface InterviewResultResponse {
  sessionId: number;
  cvId: number;
  cvFileName: string;
  jobPosition: string;
  languageCode: string;
  overallScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  reviews: InterviewAnswerReviewResponse[];
  completedAt: string;
}

export function InterviewHistory() {
  const navigate = useNavigate();
  const [pageNumber, setPageNumber] = useState(0);
  const [historyPage, setHistoryPage] =
    useState<Page<InterviewSessionSummaryResponse> | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingResultSessionId, setLoadingResultSessionId] = useState<
    number | null
  >(null);
  const [selectedResult, setSelectedResult] =
    useState<InterviewResultResponse | null>(null);

  const loadHistory = useCallback(
    async (page = pageNumber) => {
      setLoadingHistory(true);
      await request<Page<InterviewSessionSummaryResponse>>({
        endpoint: `/api/v1/ai/interviews/history?page=${page}&size=10`,
        onSuccess: (data) => {
          setHistoryPage(data);
        },
        onFailure: (error) => toast.error(error),
      });
      setLoadingHistory(false);
    },
    [pageNumber]
  );

  useEffect(() => {
    void loadHistory(pageNumber);
  }, [loadHistory, pageNumber]);

  const loadResult = async (sessionId: number) => {
    setLoadingResultSessionId(sessionId);
    await request<InterviewResultResponse>({
      endpoint: `/api/v1/ai/interviews/${sessionId}/results`,
      onSuccess: (data) => setSelectedResult(data),
      onFailure: (error) => toast.error(error),
    });
    setLoadingResultSessionId(null);
  };

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return "-";
    }
    return new Date(value).toLocaleString();
  };

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Interview History
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Review all mock interview sessions saved in your account.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              outline
              className="my-0 sm:w-fit"
              onClick={() => navigate("/ai/cv")}
            >
              Back
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {loadingHistory && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-600">
              Loading interview history...
            </div>
          )}

          {!loadingHistory &&
            (!historyPage || historyPage.content.length === 0) && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-500">
                No interview sessions yet.
              </div>
            )}

          {!loadingHistory &&
            historyPage?.content.map((session) => (
              <article
                key={session.sessionId}
                className="rounded-2xl border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">
                      Session #{session.sessionId}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-gray-900">
                      {session.jobPosition}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {session.cvFileName}
                    </p>
                  </div>
                  <div
                    className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] ${
                      session.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {session.status}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    Started:{" "}
                    <strong>{formatDateTime(session.startedAt)}</strong>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    Completed:{" "}
                    <strong>{formatDateTime(session.completedAt)}</strong>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    Progress:{" "}
                    <strong>
                      {session.answeredQuestions}/{session.totalQuestions}
                    </strong>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    Score:{" "}
                    <strong>
                      {session.overallScore == null
                        ? "Not available"
                        : `${session.overallScore}/100`}
                    </strong>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {session.status === "COMPLETED" && (
                    <Button
                      type="button"
                      className="my-0 sm:w-fit"
                      onClick={() => void loadResult(session.sessionId)}
                      disabled={loadingResultSessionId === session.sessionId}
                    >
                      {loadingResultSessionId === session.sessionId
                        ? "Loading Result..."
                        : "View Result"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    outline
                    className="my-0 sm:w-fit"
                    onClick={() =>
                      navigate(`/ai/interview?cvId=${session.cvId}`)
                    }
                  >
                    Practice Again
                  </Button>
                </div>
              </article>
            ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button
            type="button"
            outline
            className="my-0 sm:w-fit"
            onClick={() => setPageNumber((prev) => Math.max(0, prev - 1))}
            disabled={!historyPage || historyPage.first || loadingHistory}
          >
            Previous
          </Button>
          <p className="text-sm text-gray-500">
            Page {(historyPage?.number ?? 0) + 1} /{" "}
            {Math.max(historyPage?.totalPages ?? 1, 1)}
          </p>
          <Button
            type="button"
            outline
            className="my-0 sm:w-fit"
            onClick={() => setPageNumber((prev) => prev + 1)}
            disabled={!historyPage || historyPage.last || loadingHistory}
          >
            Next
          </Button>
        </div>
      </section>

      {!selectedResult ? (
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Selected Result</h2>
          <p className="mt-3 text-sm text-gray-500">
            Choose a completed session and press View Result to see full
            details.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-teal-50 p-6 shadow-sm">
            <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Selected Interview Result
            </span>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">
                  {selectedResult.cvFileName}
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  {selectedResult.jobPosition}
                </p>
              </div>
              <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
                <p className="text-sm text-emerald-700">Overall score</p>
                <p className="text-4xl font-bold text-emerald-800">
                  {selectedResult.overallScore}/100
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-3xl text-sm leading-6 text-gray-700">
              {selectedResult.summary}
            </p>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.8fr)]">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900">
                Question Reviews
              </h3>
              <div className="mt-5 grid gap-4">
                {selectedResult.reviews.map((review) => (
                  <article
                    key={review.questionId}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
                          Question {review.questionOrder} · {review.category}
                        </p>
                        <h4 className="mt-2 font-semibold text-gray-900">
                          {review.questionText}
                        </h4>
                      </div>
                      <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                        {review.score ?? 0}/100
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">Your answer</p>
                      <p className="mt-2 leading-6">
                        {review.answerText || "No answer recorded."}
                      </p>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-gray-700">
                      {review.feedback}
                    </p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Strengths
                        </p>
                        <ul className="mt-2 grid gap-2">
                          {review.strengths.map((item) => (
                            <li
                              key={item}
                              className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Improvements
                        </p>
                        <ul className="mt-2 grid gap-2">
                          {review.improvements.map((item) => (
                            <li
                              key={item}
                              className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"
                            >
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <aside className="grid gap-6">
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900">
                  Overall Strengths
                </h3>
                <ul className="mt-4 grid gap-2">
                  {selectedResult.strengths.map((item) => (
                    <li
                      key={item}
                      className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold text-gray-900">
                  What to improve next
                </h3>
                <ul className="mt-4 grid gap-2">
                  {selectedResult.improvements.map((item) => (
                    <li
                      key={item}
                      className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}
