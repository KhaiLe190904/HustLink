import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import { request } from "@/utils/api";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";

interface InterviewQuestionResponse {
  id: number;
  questionOrder: number;
  totalQuestions: number;
  category: string;
  text: string;
  answerTimeLimitSeconds: number;
}

interface InterviewStartResponse {
  sessionId: number;
  cvId: number;
  cvFileName: string;
  jobPosition: string;
  languageCode: string;
  totalQuestions: number;
  answerTimeLimitSeconds: number;
  currentQuestion: InterviewQuestionResponse;
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

interface InterviewSubmitAnswerResponse {
  sessionId: number;
  completed: boolean;
  answeredQuestions: number;
  totalQuestions: number;
  nextQuestion: InterviewQuestionResponse | null;
  results: InterviewResultResponse | null;
}

interface RecognitionResultLike {
  0: {
    transcript: string;
  };
}

interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
}

interface RecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => RecognitionInstance;
    webkitSpeechRecognition?: new () => RecognitionInstance;
  }
}

export function Interview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthentication();
  const selectedCvId = Number(searchParams.get("cvId") ?? "");
  const [jobPosition, setJobPosition] = useState(user?.position ?? "");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<InterviewStartResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] =
    useState<InterviewQuestionResponse | null>(null);
  const [result, setResult] = useState<InterviewResultResponse | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const recognitionRef = useRef<RecognitionInstance | null>(null);
  const timeoutSubmittedRef = useRef<number | null>(null);
  const answerTextRef = useRef("");
  const listeningBaseTextRef = useRef("");

  useEffect(() => {
    answerTextRef.current = answerText;
  }, [answerText]);

  useEffect(() => {
    const RecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const liveTranscript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      const baseText = listeningBaseTextRef.current;
      const nextAnswerText = [baseText, liveTranscript]
        .filter((value) => value.length > 0)
        .join(baseText && liveTranscript ? " " : "")
        .trim();
      setAnswerText(nextAnswerText);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "network") {
        toast.error(
          "Microphone recognition service is unavailable. Check your internet connection or continue by typing."
        );
        return;
      }
      if (event.error && event.error !== "aborted") {
        toast.error(`Microphone error: ${event.error}`);
      }
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      recognition.stop();
      window.speechSynthesis?.cancel();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const speech = window.speechSynthesis;
    if (!speech) {
      return;
    }

    const handleVoicesChanged = () => setVoicesReady(true);
    speech.onvoiceschanged = handleVoicesChanged;
    handleVoicesChanged();

    return () => {
      speech.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (!currentQuestion || result || submitting) {
      return;
    }

    const interval = window.setInterval(() => {
      setSecondsRemaining((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [currentQuestion, result, submitting]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || !currentQuestion) {
      return;
    }

    recognitionRef.current.lang = session?.languageCode ?? "en-US";
    listeningBaseTextRef.current = answerTextRef.current.trim();
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch {
      toast.info("Microphone is already recording.");
    }
  }, [currentQuestion, session?.languageCode]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const pickVoice = useCallback((languageCode: string) => {
    const voices = window.speechSynthesis?.getVoices() ?? [];
    if (voices.length === 0) {
      return null;
    }

    return (
      voices.find(
        (voice) =>
          voice.lang?.toLowerCase() === languageCode.toLowerCase() &&
          voice.name.toLowerCase().includes("google")
      ) ||
      voices.find((voice) =>
        voice.lang
          ?.toLowerCase()
          .startsWith(languageCode.slice(0, 2).toLowerCase())
      ) ||
      voices[0]
    );
  }, []);

  const speakQuestion = useCallback(
    (text: string, languageCode: string) => {
      if (!window.speechSynthesis || !text.trim()) {
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageCode;
      const selectedVoice = pickVoice(languageCode);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = 0.96;
      window.speechSynthesis.speak(utterance);
    },
    [pickVoice]
  );

  useEffect(() => {
    if (!currentQuestion || result) {
      return;
    }

    setSecondsRemaining(currentQuestion.answerTimeLimitSeconds);
    setAnswerText("");
    answerTextRef.current = "";
    listeningBaseTextRef.current = "";
    timeoutSubmittedRef.current = null;
    stopListening();
    speakQuestion(currentQuestion.text, session?.languageCode ?? "en-US");
  }, [
    currentQuestion,
    result,
    session?.languageCode,
    speakQuestion,
    stopListening,
  ]);

  const handleStartInterview = async () => {
    if (!selectedCvId) {
      toast.error("Please start the mock interview from a CV first.");
      return;
    }

    setStarting(true);
    const loadingToastId = toast.loading(
      "Preparing your mock interview questions..."
    );

    await request<InterviewStartResponse>({
      endpoint: "/api/v1/ai/interviews/start",
      method: "POST",
      body: JSON.stringify({
        cvId: selectedCvId,
        jobPosition,
      }),
      onSuccess: (data) => {
        setSession(data);
        setSecondsRemaining(data.currentQuestion.answerTimeLimitSeconds);
        setAnswerText("");
        timeoutSubmittedRef.current = null;
        setCurrentQuestion(data.currentQuestion);
        toast.update(loadingToastId, {
          render: "Interview is ready. Good luck!",
          type: "success",
          isLoading: false,
          autoClose: 2500,
          closeOnClick: true,
        });
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

    setStarting(false);
  };

  const submitAnswer = useCallback(
    async (autoSubmit = false) => {
      if (!session || !currentQuestion) {
        return;
      }

      if (!autoSubmit && !answerText.trim()) {
        toast.error("Please record or type an answer before continuing.");
        return;
      }

      stopListening();
      setSubmitting(true);
      const isFinalQuestion =
        currentQuestion.questionOrder >= currentQuestion.totalQuestions;
      const loadingToastId = isFinalQuestion
        ? toast.loading("AI is evaluating your interview answers...")
        : null;

      await request<InterviewSubmitAnswerResponse>({
        endpoint: `/api/v1/ai/interviews/${session.sessionId}/answers`,
        method: "POST",
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answerText,
          durationSeconds:
            currentQuestion.answerTimeLimitSeconds - secondsRemaining,
        }),
        onSuccess: (data) => {
          if (data.completed && data.results) {
            setResult(data.results);
            setCurrentQuestion(null);
            if (loadingToastId) {
              toast.update(loadingToastId, {
                render: "Interview results are ready.",
                type: "success",
                isLoading: false,
                autoClose: 3000,
                closeOnClick: true,
              });
            }
            return;
          }

          if (data.nextQuestion) {
            setSecondsRemaining(data.nextQuestion.answerTimeLimitSeconds);
            setAnswerText("");
            timeoutSubmittedRef.current = null;
            setCurrentQuestion(data.nextQuestion);
          }
          if (loadingToastId) {
            toast.dismiss(loadingToastId);
          }
        },
        onFailure: (error) => {
          if (loadingToastId) {
            toast.update(loadingToastId, {
              render: error,
              type: "error",
              isLoading: false,
              autoClose: 4000,
              closeOnClick: true,
            });
          } else {
            toast.error(error);
          }
        },
      });

      setSubmitting(false);
    },
    [answerText, currentQuestion, secondsRemaining, session, stopListening]
  );

  useEffect(() => {
    if (
      !currentQuestion ||
      submitting ||
      result ||
      secondsRemaining > 0 ||
      timeoutSubmittedRef.current === currentQuestion.id
    ) {
      return;
    }

    timeoutSubmittedRef.current = currentQuestion.id;
    void submitAnswer(true);
  }, [currentQuestion, result, secondsRemaining, submitAnswer, submitting]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (result) {
    return (
      <div className="grid gap-6">
        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-teal-50 p-6 shadow-sm">
          <span className="w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Interview Complete
          </span>
          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Your mock interview results are ready
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                {result.cvFileName} · {result.jobPosition}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
              <p className="text-sm text-emerald-700">Overall score</p>
              <p className="text-4xl font-bold text-emerald-800">
                {result.overallScore}/100
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-gray-700">
            {result.summary}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button
              type="button"
              className="my-0 sm:w-fit"
              onClick={() => navigate(`/ai/interview?cvId=${result.cvId}`)}
            >
              Practice Again
            </Button>
            <Button
              type="button"
              outline
              className="my-0 sm:w-fit"
              onClick={() => navigate("/ai/interview/history")}
            >
              Interview History
            </Button>
            <Button
              type="button"
              outline
              className="my-0 sm:w-fit"
              onClick={() => navigate("/ai/cv")}
            >
              Back to CV Workspace
            </Button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.8fr)]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Question Reviews
            </h2>
            <div className="mt-5 grid gap-4">
              {result.reviews.map((review) => (
                <article
                  key={review.questionId}
                  className="rounded-2xl border border-gray-200 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
                        Question {review.questionOrder} · {review.category}
                      </p>
                      <h3 className="mt-2 font-semibold text-gray-900">
                        {review.questionText}
                      </h3>
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
              <h2 className="text-xl font-bold text-gray-900">
                Overall Strengths
              </h2>
              <ul className="mt-4 grid gap-2">
                {result.strengths.map((item) => (
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
              <h2 className="text-xl font-bold text-gray-900">
                What to improve next
              </h2>
              <ul className="mt-4 grid gap-2">
                {result.improvements.map((item) => (
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
      </div>
    );
  }

  if (!session || !currentQuestion) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-3xl border border-red-100 bg-gradient-to-br from-white via-red-50 to-amber-50 p-6 shadow-sm md:p-8">
          <span className="w-fit rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
            AI Mock Interview
          </span>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Practice a realistic 5-question interview with voice input
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            We will generate 5 personalized questions from your CV, read each
            question aloud, give you up to 2 minutes to answer, convert your mic
            response to text, then evaluate the whole interview with Gemini at
            the end.
          </p>

          <div className="mt-6 grid gap-4 rounded-3xl border border-white/70 bg-white/80 p-5">
            <div>
              <label
                htmlFor="job-position"
                className="text-sm font-semibold text-gray-900"
              >
                Target job position
              </label>
              <input
                id="job-position"
                value={jobPosition}
                onChange={(event) => setJobPosition(event.target.value)}
                placeholder="Junior Software Engineer"
                className="mt-2 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="my-0 sm:w-fit"
                onClick={handleStartInterview}
                disabled={starting || !selectedCvId}
              >
                {starting ? "Preparing..." : "Start Mock Interview"}
              </Button>
              <Button
                type="button"
                outline
                className="my-0 sm:w-fit"
                onClick={() => navigate("/ai/interview/history")}
              >
                Interview History
              </Button>
              <Button
                type="button"
                outline
                className="my-0 sm:w-fit"
                onClick={() => navigate("/ai/cv")}
              >
                Back to CV Workspace
              </Button>
            </div>
          </div>
        </section>

        <aside className="grid gap-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Interview flow</h2>
            <ul className="mt-4 grid gap-3 text-sm text-gray-600">
              <li className="rounded-xl bg-gray-50 px-4 py-3">
                1. AI generates 5 questions from your CV and target role.
              </li>
              <li className="rounded-xl bg-gray-50 px-4 py-3">
                2. Browser reads each question aloud with speech synthesis.
              </li>
              <li className="rounded-xl bg-gray-50 px-4 py-3">
                3. You answer by mic or by typing if needed.
              </li>
              <li className="rounded-xl bg-gray-50 px-4 py-3">
                4. After question 5, Gemini evaluates the full interview.
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Voice support</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Browser speech APIs work best on Chrome and Edge. Even if
              microphone recognition is unavailable, you can still complete the
              interview by typing your answer manually.
            </p>
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Microphone support:{" "}
              <strong>
                {speechSupported ? "Available" : "Text-only fallback"}
              </strong>
            </div>
            <div className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900">
              Selected CV:{" "}
              <strong>
                {selectedCvId
                  ? `CV #${selectedCvId}`
                  : "Please choose from AI CV page"}
              </strong>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-700">
              Question {currentQuestion.questionOrder}/
              {currentQuestion.totalQuestions}
            </span>
            <h1 className="mt-3 text-2xl font-bold text-gray-900">
              {session.jobPosition}
            </h1>
            <p className="mt-1 text-sm text-gray-500">{session.cvFileName}</p>
          </div>
          <div
            className={`rounded-2xl px-4 py-3 text-right ${
              secondsRemaining <= 15
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            <p className="text-xs uppercase tracking-[0.18em]">Time left</p>
            <p className="text-2xl font-bold">{formatTime(secondsRemaining)}</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
              {currentQuestion.category}
            </span>
            <Button
              type="button"
              outline
              className="my-0 sm:w-fit"
              onClick={() =>
                speakQuestion(currentQuestion.text, session.languageCode)
              }
              disabled={!voicesReady}
            >
              Replay Question
            </Button>
          </div>
          <h2 className="mt-4 text-2xl font-bold leading-9 text-gray-900">
            {currentQuestion.text}
          </h2>
          <p className="mt-3 text-sm text-gray-600">
            Answer naturally as if you were in a real interview. You can speak,
            then edit the transcript before moving on.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="my-0 sm:w-fit"
              onClick={isListening ? stopListening : startListening}
              disabled={!speechSupported || submitting}
            >
              {isListening ? "Stop Microphone" : "Start Microphone"}
            </Button>
            <Button
              type="button"
              outline
              className="my-0 sm:w-fit"
              onClick={() => {
                setAnswerText("");
                answerTextRef.current = "";
                listeningBaseTextRef.current = "";
              }}
              disabled={submitting}
            >
              Clear Transcript
            </Button>
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              isListening
                ? "border-red-300 bg-red-50 text-red-800"
                : "border-gray-200 bg-gray-50 text-gray-600"
            }`}
          >
            {isListening
              ? "Listening... speak clearly into your microphone."
              : speechSupported
                ? "Microphone is idle. You can also type your answer manually."
                : "Speech recognition is not available in this browser, but you can still type your answer."}
          </div>

          <textarea
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            placeholder="Your answer transcript will appear here. You can edit it before continuing."
            className="min-h-[14rem] w-full rounded-3xl border border-gray-200 px-4 py-4 text-sm leading-6 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-100"
          />

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              className="my-0 sm:w-fit"
              onClick={() => void submitAnswer(false)}
              disabled={submitting}
            >
              {submitting
                ? "Saving Answer..."
                : currentQuestion.questionOrder ===
                    currentQuestion.totalQuestions
                  ? "Finish Interview"
                  : "Next Question"}
            </Button>
            <Button
              type="button"
              outline
              className="my-0 sm:w-fit"
              onClick={() => navigate("/ai/cv")}
              disabled={submitting}
            >
              Exit Interview
            </Button>
          </div>
        </div>
      </section>

      <aside className="grid gap-6">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Interview tips</h2>
          <ul className="mt-4 grid gap-3 text-sm text-gray-600">
            <li className="rounded-xl bg-gray-50 px-4 py-3">
              Give a clear, direct answer first, then add supporting detail.
            </li>
            <li className="rounded-xl bg-gray-50 px-4 py-3">
              Mention concrete projects, responsibilities, and outcomes.
            </li>
            <li className="rounded-xl bg-gray-50 px-4 py-3">
              If speech recognition misses something, edit the transcript before
              moving on.
            </li>
          </ul>
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Current status</h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-600">
            <div className="rounded-xl bg-red-50 px-4 py-3">
              Role: <strong>{session.jobPosition}</strong>
            </div>
            <div className="rounded-xl bg-red-50 px-4 py-3">
              Mode:{" "}
              <strong>{speechSupported ? "Voice + Text" : "Text only"}</strong>
            </div>
            <div className="rounded-xl bg-red-50 px-4 py-3">
              Time per question:{" "}
              <strong>
                {Math.floor(currentQuestion.answerTimeLimitSeconds / 60)}{" "}
                minutes
              </strong>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
