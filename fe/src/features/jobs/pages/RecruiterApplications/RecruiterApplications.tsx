import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import { Button } from "@/features/authentication/components/Button/Button";
import { JobApplicationResponse } from "../../types/jobs";
import {
  FiMail,
  FiFileText,
  FiCpu,
  FiChevronLeft,
  FiSearch,
  FiSliders,
  FiExternalLink,
  FiMessageSquare,
} from "react-icons/fi";
import {
  IConnection,
  Status as ConnectionStatus,
} from "@/features/networking/components/Connection/Connection";

export function RecruiterApplications() {
  const { id: jobId } = useParams<{ id: string }>();
  const [applications, setApplications] = useState<JobApplicationResponse[]>(
    []
  );
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(true);

  // Selected application for detail sidebar
  const [selectedApp, setSelectedApp] = useState<JobApplicationResponse | null>(
    null
  );
  const [updatingStatusId, setUpdatingStatusId] = useState<number | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);

  const navigate = useNavigate();
  const [candidateConnection, setCandidateConnection] =
    useState<IConnection | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sendingMsg, setSendingMsg] = useState(false);

  useEffect(() => {
    if (!selectedApp) {
      setCandidateConnection(null);
      return;
    }
    setLoadingConnection(true);
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections",
      onSuccess: (data) => {
        const conn = data.find(
          (c) =>
            Number(c.author.id) === Number(selectedApp.applicantId) ||
            Number(c.recipient.id) === Number(selectedApp.applicantId)
        );
        setCandidateConnection(conn || null);
        setLoadingConnection(false);
      },
      onFailure: (err) => {
        console.error("Could not load connection status", err);
        setLoadingConnection(false);
      },
    });
  }, [selectedApp]);

  const handleViewCv = async () => {
    if (!selectedApp) return;
    await request<{ url: string }>({
      endpoint: `/api/v1/jobs/applications/${selectedApp.id}/cv-url`,
      onSuccess: (data) => {
        if (data && data.url) {
          window.open(data.url, "_blank");
        } else {
          toast.error("Không lấy được đường dẫn tải CV");
        }
      },
      onFailure: (err) => toast.error("Lỗi khi tải CV: " + err),
    });
  };

  const handleConnectCandidate = async () => {
    if (!selectedApp) return;
    setConnecting(true);
    await request<IConnection>({
      endpoint: `/api/v1/networking/connections?recipientId=${selectedApp.applicantId}`,
      method: "POST",
      onSuccess: (newConn) => {
        toast.success("Đã gửi yêu cầu kết nối");
        setCandidateConnection(newConn);
      },
      onFailure: (err) => toast.error("Không thể kết nối: " + err),
    });
    setConnecting(false);
  };

  const handleSendMessage = async () => {
    if (!selectedApp) return;
    setSendingMsg(true);
    await request<IConversation[]>({
      endpoint: "/api/v1/messaging/conversations",
      onSuccess: async (conversations) => {
        const existing = conversations.find(
          (c) =>
            Number(c.author.id) === Number(selectedApp.applicantId) ||
            Number(c.recipient.id) === Number(selectedApp.applicantId)
        );
        if (existing) {
          navigate(`/messaging/conversations/${existing.id}`);
        } else {
          await request<IConversation>({
            endpoint: "/api/v1/messaging/conversations",
            method: "POST",
            body: JSON.stringify({
              receiverId: selectedApp.applicantId,
              content:
                "Xin chào, tôi muốn trao đổi thêm về hồ sơ ứng tuyển của bạn cho vị trí " +
                selectedApp.jobTitle +
                ".",
              attachmentObjectId: null,
              attachmentKind: null,
            }),
            onSuccess: (newConv) => {
              navigate(`/messaging/conversations/${newConv.id}`);
            },
            onFailure: (err) =>
              toast.error("Không thể tạo cuộc trò chuyện: " + err),
          });
        }
      },
      onFailure: (err) =>
        toast.error("Không thể tải các cuộc trò chuyện: " + err),
    });
    setSendingMsg(false);
  };

  const fetchApplications = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    await request<JobApplicationResponse[]>({
      endpoint: `/api/v1/jobs/${jobId}/applications`,
      onSuccess: (data) => {
        setApplications(data);
        if (data.length > 0) {
          setJobTitle(data[0].jobTitle);
        }
        setLoading(false);
      },
      onFailure: (err) => {
        toast.error("Could not load candidate list: " + err);
        setLoading(false);
      },
    });
  }, [jobId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleStatusChange = async (appId: number, nextStatus: string) => {
    setUpdatingStatusId(appId);
    await request<JobApplicationResponse>({
      endpoint: `/api/v1/jobs/applications/${appId}/status`,
      method: "PATCH",
      body: JSON.stringify({ status: nextStatus }),
      onSuccess: (updatedApp) => {
        toast.success(`Candidate status updated to: ${nextStatus}`);
        setApplications((prev) =>
          prev.map((app) => (app.id === appId ? updatedApp : app))
        );
        if (selectedApp && selectedApp.id === appId) {
          setSelectedApp(updatedApp);
        }
      },
      onFailure: (err) => toast.error("Could not update status: " + err),
    });
    setUpdatingStatusId(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPLIED":
        return (
          <span className="bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Applied
          </span>
        );
      case "VIEWED":
        return (
          <span className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Viewed
          </span>
        );
      case "SHORTLISTED":
        return (
          <span className="bg-purple-50 border border-purple-200 text-purple-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Shortlisted
          </span>
        );
      case "REJECTED":
        return (
          <span className="bg-red-50 border border-red-200 text-red-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Rejected
          </span>
        );
      case "HIRED":
        return (
          <span className="bg-green-50 border border-green-200 text-green-700 rounded-full px-2.5 py-0.5 text-xs font-semibold">
            Hired
          </span>
        );
      default:
        return null;
    }
  };

  // Filter logic
  const filteredApps = applications.filter((app) => {
    const matchSearch =
      app.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.applicantEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "ALL" || app.status === statusFilter;
    const matchScore = app.matchScore >= minScoreFilter;
    return matchSearch && matchStatus && matchScore;
  });

  // Score distribution calculation
  const scoreBuckets = [0, 0, 0, 0, 0]; // 0-20, 21-40, 41-60, 61-80, 81-100
  applications.forEach((app) => {
    const score = app.matchScore;
    if (score <= 20) scoreBuckets[0]++;
    else if (score <= 40) scoreBuckets[1]++;
    else if (score <= 60) scoreBuckets[2]++;
    else if (score <= 80) scoreBuckets[3]++;
    else scoreBuckets[4]++;
  });
  const maxBucketCount = Math.max(...scoreBuckets, 1);

  // Detail panel formatting
  let breakdownData: {
    skills?: number;
    experience?: number;
    keywords?: number;
  } = {};
  if (selectedApp && selectedApp.matchBreakdown) {
    try {
      breakdownData = JSON.parse(selectedApp.matchBreakdown);
    } catch (e) {
      console.error("Error parsing match breakdown", e);
    }
  }

  let reasons: string[] = [];
  let gaps: string[] = [];
  if (selectedApp && selectedApp.matchReasoning) {
    const reasoning = selectedApp.matchReasoning.trim();
    if (reasoning.startsWith("{")) {
      try {
        const parsed = JSON.parse(reasoning);
        reasons = parsed.reasons || [];
        gaps = parsed.gaps || [];
      } catch {
        // Plain text fallback
      }
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      {/* Back button */}
      <Link
        to="/jobs/recruiter"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-700 mb-6 transition"
      >
        <FiChevronLeft className="h-4.5 w-4.5" /> Back to Recruiter Dashboard
      </Link>

      <div className="border-b border-slate-200 pb-5 mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">
          Candidates List
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Job Position:{" "}
          <span className="font-bold text-red-700">
            {jobTitle || `Job ID #${jobId}`}
          </span>
        </p>
      </div>

      {/* Distribution Chart & Quick Filters */}
      <div className="grid gap-6 md:grid-cols-[1.5fr_2.5fr] mb-8">
        {/* Score Distribution Chart */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
            <FiCpu className="text-red-700" /> AI Match Score Distribution
          </h3>
          <div className="flex items-end justify-between h-28 gap-2 pt-2 px-2 border-b border-slate-100">
            {scoreBuckets.map((count, index) => {
              const heightPct = (count / maxBucketCount) * 100;
              const labels = ["0-20", "21-40", "41-60", "61-80", "81-100"];
              return (
                <div
                  key={index}
                  className="flex flex-col items-center flex-1 group relative"
                >
                  {/* Tooltip */}
                  <span className="absolute -top-7 scale-0 group-hover:scale-100 transition-all rounded bg-slate-800 text-[10px] text-white px-2 py-0.5 font-bold z-10">
                    {count} candidate(s)
                  </span>
                  {/* Bar */}
                  <div
                    className="w-full bg-red-100 border-t-2 border-red-700 rounded-t-lg transition-all duration-500 hover:bg-red-200"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: count > 0 ? "4px" : "0px",
                    }}
                  />
                  <span className="text-[10px] font-bold text-slate-400 mt-2">
                    {labels[index]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filter Form */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
            <FiSliders className="text-red-700" /> Candidate Filters
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Search Candidates
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-xs text-slate-800 outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Application Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 px-3 text-xs text-slate-800 outline-none focus:border-red-500"
              >
                <option value="ALL">All</option>
                <option value="APPLIED">New (Applied)</option>
                <option value="VIEWED">Opened (Viewed)</option>
                <option value="SHORTLISTED">Interview (Shortlisted)</option>
                <option value="HIRED">Accepted (Hired)</option>
                <option value="REJECTED">Declined (Rejected)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Min AI Score: {minScoreFilter}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-700 mt-3"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Candidates Split View */}
      <div className="grid gap-6 md:grid-cols-[2.5fr_1.5fr] items-start">
        {/* Table of Candidates */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-700 border-t-transparent"></div>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No candidates found matching the filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-6 py-4">Candidate</th>
                    <th className="px-6 py-4 text-center">AI Match</th>
                    <th className="px-6 py-4">Applied Date</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-medium">
                  {filteredApps.map((app) => (
                    <tr
                      key={app.id}
                      onClick={() => {
                        setSelectedApp(app);
                        if (app.status === "APPLIED") {
                          // Automatically mark as viewed if first time opening
                          handleStatusChange(app.id, "VIEWED");
                        }
                      }}
                      className={`cursor-pointer transition hover:bg-red-50/20 ${
                        selectedApp?.id === app.id ? "bg-red-50/40" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">
                          {app.applicantName}
                        </div>
                        <div className="text-xs text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                          <FiMail /> {app.applicantEmail}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center h-8 w-12 rounded-lg font-black text-xs ${
                            app.matchScore >= 80
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                              : app.matchScore >= 60
                                ? "bg-amber-50 text-amber-800 border border-amber-100"
                                : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {app.matchScore}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(app.appliedAt).toLocaleDateString("en-US")}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(app.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Candidate Side Panel */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm min-h-[400px]">
          {!selectedApp ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16">
              <FiFileText className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium">
                Please select a candidate from the table to view details and AI
                analysis.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Info */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Candidate Profile
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-1">
                  {selectedApp.applicantName}
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  {selectedApp.applicantEmail}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Status:</span>
                  {getStatusBadge(selectedApp.status)}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to={`/profile/${selectedApp.applicantId}`}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                  >
                    View Profile
                  </Link>
                  {loadingConnection ? (
                    <span className="text-xs text-slate-400 font-semibold px-3 py-1.5">
                      Checking...
                    </span>
                  ) : !candidateConnection ? (
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={handleConnectCandidate}
                      className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      {connecting ? "Connecting..." : "Connect"}
                    </button>
                  ) : candidateConnection.status ===
                    ConnectionStatus.PENDING ? (
                    <button
                      type="button"
                      disabled
                      className="px-3 py-1.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl text-xs font-bold cursor-not-allowed"
                    >
                      Connection Pending
                    </button>
                  ) : candidateConnection.status ===
                    ConnectionStatus.ACCEPTED ? (
                    <button
                      type="button"
                      disabled={sendingMsg}
                      onClick={handleSendMessage}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
                    >
                      <FiMessageSquare className="h-3.5 w-3.5" />
                      {sendingMsg ? "Opening Chat..." : "Send Message"}
                    </button>
                  ) : null}
                </div>
              </div>

              {/* Cover Letter */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-1 mb-2">
                  Cover Letter
                </h4>
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 text-xs text-slate-600 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {selectedApp.coverLetter || "No cover letter provided."}
                </div>
              </div>

              {/* CV File Reference */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-1 mb-2">
                  Uploaded CV
                </h4>
                <div className="rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between bg-white text-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-700 min-w-0">
                    <FiFileText className="text-red-700 h-5 w-5 shrink-0" />
                    <span className="truncate">{selectedApp.cvFileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleViewCv}
                      className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <FiExternalLink className="h-3.5 w-3.5" />
                      View CV
                    </button>
                    <span className="text-[10px] text-slate-400 font-bold bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
                      AI Analyzed
                    </span>
                  </div>
                </div>
              </div>

              {/* AI matching details */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-1 mb-3">
                  AI Matching Score: {selectedApp.matchScore}%
                </h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-0.5">
                      <span>Skills</span>
                      <span>
                        {breakdownData.skills ?? selectedApp.matchScore}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full"
                        style={{
                          width: `${breakdownData.skills ?? selectedApp.matchScore}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-0.5">
                      <span>Experience</span>
                      <span>
                        {breakdownData.experience ?? selectedApp.matchScore}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{
                          width: `${breakdownData.experience ?? selectedApp.matchScore}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase border-b border-slate-100 pb-1 mb-2">
                  AI Compatibility Assessment
                </h4>
                {reasons.length > 0 || gaps.length > 0 ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-emerald-50/70 p-3 border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1">
                        Strengths
                      </p>
                      <ul className="list-disc pl-3 text-[10px] text-emerald-950 font-medium space-y-1">
                        {reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-amber-50/70 p-3 border border-amber-100">
                      <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1">
                        Gaps
                      </p>
                      <ul className="list-disc pl-3 text-[10px] text-amber-950 font-medium space-y-1">
                        {gaps.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {selectedApp.matchReasoning}
                  </p>
                )}
              </div>

              {/* Recruiter Actions */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <Button
                  type="button"
                  className={`my-0 px-4 my-3 text-white text-xs w-full font-bold transition-all ${
                    selectedApp.status === "SHORTLISTED"
                      ? "bg-slate-100 text-slate-400! border border-slate-200 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/10"
                  }`}
                  onClick={() =>
                    handleStatusChange(selectedApp.id, "SHORTLISTED")
                  }
                  disabled={
                    updatingStatusId !== null ||
                    selectedApp.status === "SHORTLISTED" ||
                    selectedApp.status === "REJECTED"
                  }
                >
                  {selectedApp.status === "SHORTLISTED"
                    ? "Invited to Interview"
                    : "Invite to Interview"}
                </Button>

                <Button
                  type="button"
                  outline
                  className={`my-0 px-4 text-xs w-full font-bold transition-all ${
                    selectedApp.status === "REJECTED"
                      ? "bg-slate-100 text-slate-400! border border-slate-200 cursor-not-allowed"
                      : "text-red-600 border-red-200 hover:bg-red-50"
                  }`}
                  onClick={() => setShowRejectConfirm(true)}
                  disabled={
                    updatingStatusId !== null ||
                    selectedApp.status === "REJECTED"
                  }
                >
                  {selectedApp.status === "REJECTED" ? "Rejected" : "Reject"}
                </Button>
              </div>

              {/* Custom Modal Confirm Reject */}
              {showRejectConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                  <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl border border-slate-100/80 animate-in zoom-in-95 duration-200">
                    <h3 className="text-lg font-extrabold text-slate-900">
                      Reject Application
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 font-medium leading-relaxed">
                      Are you sure you want to reject{" "}
                      <span className="font-bold text-slate-800">
                        {selectedApp.applicantName}
                      </span>{" "}
                      for this vacancy? This action will update the candidate's
                      profile status to{" "}
                      <span className="font-bold text-red-600">Rejected</span>{" "}
                      and cannot be undone.
                    </p>
                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowRejectConfirm(false)}
                        className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleStatusChange(selectedApp.id, "REJECTED");
                          setShowRejectConfirm(false);
                        }}
                        className="px-4.5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-600/10"
                      >
                        Confirm Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
