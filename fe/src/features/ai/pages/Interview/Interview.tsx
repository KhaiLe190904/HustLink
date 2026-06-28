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
  level: string;
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
  level: string;
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

interface CustomSelectProps<T> {
  value: T;
  onChange: (val: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  icon?: React.ReactNode;
}

function CustomSelect<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = "Select...",
  icon,
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handleClose = () => setOpen(false);
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, [open]);

  return (
    <div
      className="relative w-full text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rounded-2xl border border-gray-200 py-3 px-4 text-sm text-gray-800 bg-white outline-none hover:border-gray-300 transition text-left focus:border-red-300 focus:ring-2 focus:ring-red-100 shadow-sm"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
        </div>
        <span className="pointer-events-none text-gray-400">
          <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-2 duration-100 max-h-60 overflow-y-auto">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full rounded-xl px-4 py-2 text-left text-sm transition font-semibold ${
                o.value === value
                  ? "bg-red-50 text-red-700 font-bold"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Interview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthentication();
  const selectedCvId = Number(searchParams.get("cvId") ?? "");
  const [jobPosition, setJobPosition] = useState("");
  const [interviewLevel, setInterviewLevel] = useState("");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState<InterviewStartResponse | null>(null);
  const [currentQuestion, setCurrentQuestion] =
    useState<InterviewQuestionResponse | null>(null);
  const [result, setResult] = useState<InterviewResultResponse | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [checkingActive, setCheckingActive] = useState(true);

  useEffect(() => {
    const checkActiveSession = async () => {
      setCheckingActive(true);
      await request<InterviewStartResponse>({
        endpoint: "/api/v1/ai/interviews/active",
        onSuccess: (data) => {
          if (data) {
            setSession(data);
            setCurrentQuestion(data.currentQuestion);
            setSecondsRemaining(data.currentQuestion.answerTimeLimitSeconds);
            setAnswerText("");
          }
          setCheckingActive(false);
        },
        onFailure: () => {
          setCheckingActive(false);
        },
      });
    };
    void checkActiveSession();
  }, []);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voicesReady, setVoicesReady] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem("interview_speech_muted");
    return saved ? saved === "true" : true; // Default to true (muted)
  });

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem("interview_speech_muted", String(next));
      if (next && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };
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
    if (!isMuted) {
      speakQuestion(currentQuestion.text, session?.languageCode ?? "en-US");
    }
  }, [
    currentQuestion,
    result,
    session?.languageCode,
    speakQuestion,
    stopListening,
    isMuted,
  ]);

  useEffect(() => {
    if (isMuted && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [isMuted]);

  const handleStartInterview = async () => {
    if (!selectedCvId) {
      toast.error("Please start the mock interview from a CV first.");
      return;
    }
    if (!jobPosition.trim()) {
      toast.error("Please enter a target job position.");
      return;
    }
    if (!interviewLevel) {
      toast.error("Please select a candidate level.");
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
        level: interviewLevel,
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

  const isFinalQuestion =
    currentQuestion &&
    currentQuestion.questionOrder >= currentQuestion.totalQuestions;

  if (checkingActive) {
    return (
      <div className="flex h-64 items-center justify-center bg-transparent">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
      </div>
    );
  }

  if (starting) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] animate-pulse">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="h-6 bg-slate-200 rounded w-24"></div>
              <div className="h-8 bg-slate-200 rounded w-48 mt-3"></div>
              <div className="h-4 bg-slate-100 rounded w-36 mt-1"></div>
            </div>
            <div className="rounded-2xl px-4 py-3 bg-slate-100 h-16 w-28 flex flex-col justify-center">
              <div className="h-3 bg-slate-200 rounded w-3/4"></div>
              <div className="h-6 bg-slate-200 rounded w-1/2 mt-1"></div>
            </div>
          </div>
          <div className="rounded-3xl border border-red-50 bg-gradient-to-br from-red-50/30 to-white/50 p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="h-6 bg-red-100/50 rounded-full w-20"></div>
              <div className="h-9 bg-slate-100 rounded-xl w-32 border border-slate-200/50"></div>
            </div>
            <div className="space-y-2">
              <div className="h-7 bg-slate-200 rounded w-full"></div>
              <div className="h-7 bg-slate-200 rounded w-5/6"></div>
            </div>
            <div className="h-4 bg-slate-100 rounded w-2/3"></div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="h-10 bg-slate-200 rounded-xl w-32"></div>
              <div className="h-10 bg-slate-100 rounded-xl w-32 border border-slate-200/40"></div>
            </div>
            <div className="h-10 bg-slate-100 rounded-xl w-full"></div>
            <div className="h-40 bg-slate-100 rounded-3xl w-full"></div>
            <div className="flex gap-3">
              <div className="h-10 bg-red-100/50 rounded-xl w-32"></div>
              <div className="h-10 bg-slate-100 rounded-xl w-32 border border-slate-200/40"></div>
            </div>
          </div>
        </section>
        <aside className="grid gap-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="h-6 bg-slate-200 rounded w-1/3"></div>
            <div className="h-12 bg-slate-50 rounded-xl w-full"></div>
            <div className="h-12 bg-slate-50 rounded-xl w-full"></div>
            <div className="h-12 bg-slate-50 rounded-xl w-full"></div>
          </div>
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="h-6 bg-slate-200 rounded w-1/3"></div>
            <div className="h-16 bg-slate-50 rounded-xl w-full"></div>
            <div className="h-12 bg-amber-50/50 rounded-xl w-full border border-amber-100/40"></div>
            <div className="h-12 bg-red-50/50 rounded-xl w-full border border-red-100/40"></div>
          </div>
        </aside>
      </div>
    );
  }

  if (submitting && isFinalQuestion) {
    return (
      <div className="grid gap-6 animate-pulse">
        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/30 p-6 shadow-sm space-y-4">
          <div className="h-6 bg-emerald-100/50 rounded-full w-32"></div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2 w-2/3">
              <div className="h-9 bg-slate-200 rounded w-3/4"></div>
              <div className="h-4 bg-slate-100 rounded w-1/2"></div>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 shadow-sm w-36 h-20 flex flex-col justify-center border border-emerald-100/30">
              <div className="h-3 bg-emerald-200/50 rounded w-3/4"></div>
              <div className="h-8 bg-emerald-200/80 rounded w-1/2 mt-1"></div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-11/12"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          </div>
        </section>
        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.8fr)]">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            <div className="h-6 bg-slate-200 rounded w-1/4"></div>
            <div className="h-32 bg-slate-50 rounded-2xl w-full"></div>
            <div className="h-32 bg-slate-50 rounded-2xl w-full"></div>
          </div>
          <aside className="grid gap-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
              <div className="h-6 bg-slate-200 rounded w-1/3"></div>
              <div className="h-10 bg-emerald-50/50 rounded-xl w-full border border-emerald-100/40"></div>
              <div className="h-10 bg-emerald-50/50 rounded-xl w-full border border-emerald-100/40"></div>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
              <div className="h-6 bg-slate-200 rounded w-1/3"></div>
              <div className="h-10 bg-amber-50/50 rounded-xl w-full border border-amber-100/40"></div>
              <div className="h-10 bg-amber-50/50 rounded-xl w-full border border-amber-100/40"></div>
            </div>
          </aside>
        </section>
      </div>
    );
  }

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
                {result.cvFileName} · {result.jobPosition} · {result.level}
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
            question aloud, give you up to 5 minutes to answer, convert your mic
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
            <div className="flex flex-col">
              <label
                htmlFor="interview-level"
                className="text-sm font-semibold text-gray-900 mb-2"
              >
                Candidate level
              </label>
              <CustomSelect
                value={interviewLevel}
                onChange={setInterviewLevel}
                placeholder="Select level..."
                options={[
                  { value: "INTERN", label: "Intern" },
                  { value: "FRESHER", label: "Fresher" },
                  { value: "JUNIOR", label: "Junior" },
                  { value: "SENIOR", label: "Senior" },
                ]}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="my-0 sm:w-fit"
                onClick={handleStartInterview}
                disabled={
                  starting ||
                  !selectedCvId ||
                  !jobPosition.trim() ||
                  !interviewLevel
                }
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
            <div className="flex gap-2">
              <Button
                type="button"
                outline
                className="my-0 sm:w-fit flex items-center gap-1.5"
                onClick={toggleMute}
              >
                {isMuted ? (
                  <>
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M3.63 3.63L2.22 5.04l4.69 4.69H3v6h4l5 5V13.8L18.42 20c-.72.48-1.53.84-2.42 1.05v-2.05c1.44-.31 2.76-.94 3.86-1.81l2.09 2.09 1.41-1.41L3.63 3.63zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                    <span>Muted</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 fill-current text-red-700 animate-pulse"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                    <span>Auto-read</span>
                  </>
                )}
              </Button>
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
              Level: <strong>{session.level}</strong>
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
