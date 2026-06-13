import { useEffect, useState } from "react";
import { request } from "@/utils/api";
import {
  FiUsers,
  FiFileText,
  FiBriefcase,
  FiCalendar,
  FiAlertTriangle,
  FiCpu,
  FiTrendingUp,
} from "react-icons/fi";
import { toast } from "react-toastify";

interface OverviewStats {
  usersCount: number;
  postsCount: number;
  jobsCount: number;
  companiesCount: number;
  eventsCount: number;
  pendingCompaniesCount: number;
  pendingReportsCount: number;
}

interface AIUsageSummary {
  totalCost: number;
  totalTokens: number;
  totalRequests: number;
  requestsByType: Record<string, number>;
  costByType: Record<string, number>;
}

interface TimeseriesPoint {
  date: string;
  cost: number;
}

export function AdminOverview() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [aiSummary, setAiSummary] = useState<AIUsageSummary | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<TimeseriesPoint | null>(
    null
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await request<OverviewStats>({
          endpoint: "/api/v1/admin/stats/overview",
          onSuccess: (data) => setStats(data),
          onFailure: (err) =>
            toast.error("Failed to load overview stats: " + err),
        });

        await request<AIUsageSummary>({
          endpoint: "/api/v1/admin/ai-usage/summary",
          onSuccess: (data) => setAiSummary(data),
          onFailure: (err) =>
            toast.error("Failed to load AI usage summary: " + err),
        });

        await request<TimeseriesPoint[]>({
          endpoint: "/api/v1/admin/ai-usage/timeseries",
          onSuccess: (data) => setTimeseries(data),
          onFailure: (err) =>
            toast.error("Failed to load AI usage chart data: " + err),
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center bg-white rounded-3xl border border-slate-200">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
      </div>
    );
  }

  // Calculate SVG Chart points
  const width = 600;
  const height = 220;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxCost =
    timeseries.length > 0
      ? Math.max(...timeseries.map((p) => p.cost), 0.05)
      : 0.05;

  const points = timeseries.map((point, i) => {
    const x = paddingLeft + (i / (timeseries.length - 1 || 1)) * chartWidth;
    const y = paddingTop + chartHeight - (point.cost / maxCost) * chartHeight;
    return { x, y, point };
  });

  const linePath =
    points.length > 0
      ? `M ${points[0].x} ${points[0].y} ` +
        points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(" ")
      : "";

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
      : "";

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-5 grid-cols-2 lg:grid-cols-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FiUsers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Users</p>
            <h3 className="text-xl font-extrabold text-slate-800">
              {stats?.usersCount || 0}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FiFileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Posts</p>
            <h3 className="text-xl font-extrabold text-slate-800">
              {stats?.postsCount || 0}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FiBriefcase className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Active Jobs</p>
            <h3 className="text-xl font-extrabold text-slate-800">
              {stats?.jobsCount || 0}
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FiCalendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Total Events</p>
            <h3 className="text-xl font-extrabold text-slate-800">
              {stats?.eventsCount || 0}
            </h3>
          </div>
        </div>
      </div>

      {/* Actionable Alerts */}
      {(stats?.pendingCompaniesCount || 0) > 0 ||
      (stats?.pendingReportsCount || 0) > 0 ? (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
          {stats?.pendingCompaniesCount && stats.pendingCompaniesCount > 0 ? (
            <div className="bg-amber-50/50 border border-amber-200 rounded-3xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FiBriefcase className="text-amber-600 h-6 w-6" />
                <div>
                  <h4 className="font-bold text-amber-800 text-sm">
                    Pending Company Approvals
                  </h4>
                  <p className="text-xs text-amber-600">
                    {stats.pendingCompaniesCount} company profile request(s)
                    awaiting review.
                  </p>
                </div>
              </div>
              <a
                href="/admin/companies"
                className="bg-amber-600 text-white hover:bg-amber-700 transition px-4 py-1.5 rounded-xl text-xs font-bold shrink-0 shadow-sm shadow-amber-600/10"
              >
                Review Approvals
              </a>
            </div>
          ) : null}

          {stats?.pendingReportsCount && stats.pendingReportsCount > 0 ? (
            <div className="bg-red-50/50 border border-red-200 rounded-3xl p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FiAlertTriangle className="text-red-600 h-6 w-6" />
                <div>
                  <h4 className="font-bold text-red-800 text-sm">
                    Active Content Reports
                  </h4>
                  <p className="text-xs text-red-600">
                    {stats.pendingReportsCount} report(s) of potential
                    violations require attention.
                  </p>
                </div>
              </div>
              <a
                href="/admin/reports"
                className="bg-red-600 text-white hover:bg-red-700 transition px-4 py-1.5 rounded-xl text-xs font-bold shrink-0 shadow-sm shadow-red-600/10"
              >
                Review Reports
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* AI Cost Analytics Card */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Cost stats */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:col-span-1 space-y-6 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <FiCpu className="text-red-700" />
              <span>AI Token & Cost usage</span>
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Real-time monitoring of estimated Gemini API expenditure.
              Automatic AI Moderation is bypassed; all costs originate from
              user-requested operations.
            </p>
          </div>

          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase">
                  Total Cost
                </p>
                <h4 className="text-2xl font-black text-slate-800">
                  ${(aiSummary?.totalCost || 0).toFixed(4)}
                </h4>
              </div>
              <FiTrendingUp className="text-red-700 h-8 w-8 bg-red-50 p-2 rounded-2xl" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase">
                  Requests
                </p>
                <h5 className="text-lg font-extrabold text-slate-800">
                  {aiSummary?.totalRequests || 0}
                </h5>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase">
                  Tokens
                </p>
                <h5 className="text-lg font-extrabold text-slate-800">
                  {((aiSummary?.totalTokens || 0) / 1000).toFixed(1)}k
                </h5>
              </div>
            </div>
          </div>
        </div>

        {/* timeseries chart */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">
              API Cost Timeseries
            </h3>
            <span className="text-xs bg-slate-100 font-bold text-slate-500 px-3 py-1 rounded-full">
              Last 30 Days
            </span>
          </div>

          {/* SVG Area Chart */}
          <div className="relative">
            {timeseries.length === 0 ? (
              <div className="flex h-[220px] items-center justify-center text-slate-400 border border-dashed border-slate-100 rounded-2xl text-sm">
                No recent API usage data available.
              </div>
            ) : (
              <>
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  className="w-full h-auto overflow-visible"
                >
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#b91c1c"
                        stopOpacity="0.25"
                      />
                      <stop
                        offset="100%"
                        stopColor="#b91c1c"
                        stopOpacity="0.0"
                      />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const yVal = paddingTop + (idx / 3) * chartHeight;
                    const val = maxCost - (idx / 3) * maxCost;
                    return (
                      <g key={idx}>
                        <line
                          x1={paddingLeft}
                          y1={yVal}
                          x2={width - paddingRight}
                          y2={yVal}
                          stroke="#f1f5f9"
                          strokeWidth="1"
                        />
                        <text
                          x={paddingLeft - 8}
                          y={yVal + 4}
                          textAnchor="end"
                          className="fill-slate-400 text-[10px] font-bold font-sans"
                        >
                          ${val.toFixed(3)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Filled Area */}
                  {areaPath && <path d={areaPath} fill="url(#chartGrad)" />}

                  {/* Line */}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#b91c1c"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Date labels on x-axis (first and last to prevent clutter) */}
                  {points.length > 1 && (
                    <>
                      <text
                        x={points[0].x}
                        y={height - 8}
                        className="fill-slate-400 text-[10px] font-semibold"
                        textAnchor="start"
                      >
                        {points[0].point.date}
                      </text>
                      <text
                        x={points[points.length - 1].x}
                        y={height - 8}
                        className="fill-slate-400 text-[10px] font-semibold"
                        textAnchor="end"
                      >
                        {points[points.length - 1].point.date}
                      </text>
                    </>
                  )}

                  {/* Invisible rects for hover detection */}
                  {points.map((pt, idx) => {
                    const rectWidth = chartWidth / timeseries.length;
                    return (
                      <rect
                        key={idx}
                        x={pt.x - rectWidth / 2}
                        y={paddingTop}
                        width={rectWidth}
                        height={chartHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredPoint(pt.point)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}

                  {/* Render tooltip point */}
                  {hoveredPoint &&
                    (() => {
                      const ptIdx = timeseries.findIndex(
                        (p) => p.date === hoveredPoint.date
                      );
                      if (ptIdx !== -1) {
                        const pt = points[ptIdx];
                        return (
                          <g>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="5"
                              fill="#b91c1c"
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                          </g>
                        );
                      }
                      return null;
                    })()}
                </svg>

                {/* Tooltip Overlay */}
                {hoveredPoint ? (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white rounded-xl py-1.5 px-3 text-xs shadow-md border border-slate-700/50 backdrop-blur-sm flex items-center gap-2.5 animate-in fade-in duration-100">
                    <span className="font-bold">{hoveredPoint.date}:</span>
                    <span className="font-extrabold text-red-400">
                      ${hoveredPoint.cost.toFixed(5)}
                    </span>
                  </div>
                ) : (
                  <div className="text-center text-[10px] text-slate-400 italic">
                    Hover over chart to see daily api costs
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Feature Breakdown Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-800 mb-6">
          AI Usage Breakdown by Feature
        </h3>

        {!aiSummary ||
        Object.keys(aiSummary.requestsByType || {}).length === 0 ? (
          <div className="py-8 text-center text-slate-400 border border-dashed border-slate-100 rounded-2xl">
            No features have used AI resources.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(aiSummary.requestsByType || {}).map(
              ([type, requests]) => {
                const cost = aiSummary.costByType?.[type] || 0;
                const percent =
                  aiSummary.totalCost > 0
                    ? (cost / aiSummary.totalCost) * 100
                    : 0;

                // Friendly names for type
                const friendlyNames: Record<string, string> = {
                  CV_ANALYSIS: "AI CV Analyzer",
                  AI_INTERVIEW: "Mock Interviewer",
                  RAG_QUERY: "Career Assistant (RAG)",
                  POST_CHECK: "AI Post Moderator",
                };

                return (
                  <div
                    key={type}
                    className="border border-slate-100 p-5 rounded-2xl flex flex-col justify-between hover:shadow-sm transition"
                  >
                    <div>
                      <h4 className="font-bold text-slate-700 text-sm leading-snug">
                        {friendlyNames[type] || type}
                      </h4>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-xl font-black text-slate-800">
                          ${cost.toFixed(4)}
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          spent
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-red-700 h-full rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                        <span>{requests} API Request(s)</span>
                        <span>{percent.toFixed(1)}% of total</span>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}
