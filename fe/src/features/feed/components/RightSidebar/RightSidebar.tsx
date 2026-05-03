import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IConnection } from "@/features/networking/components/Connection/Connection";
import { resolveMediaUrl } from "@/utils/storage";
import {
  FiArrowUpRight,
  FiCpu,
  FiPlus,
  FiRadio,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";

interface IUserRecommendation {
  user: IUser;
  score: number;
  reasons: {
    mutualConnections: number;
    sameCompany: boolean;
    samePosition: boolean;
    sameLocation: boolean;
    isSecondDegreeConnection: boolean;
    activitySimilarity: number;
  };
}

export function RightSidebar() {
  const [suggestions, setSuggestions] = useState<IUserRecommendation[]>([]);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    request<IUserRecommendation[]>({
      endpoint: "/api/v1/networking/suggestions?limit=10",
      onSuccess: (data) => setSuggestions(data),
      onFailure: (error) => console.log(error),
    });
  }, []);

  const trendingTopics = [
    { tag: "#RemoteWork", posts: "12,456 posts", icon: FiArrowUpRight },
    { tag: "#ArtificialIntelligence", posts: "8,921 posts", icon: FiCpu },
    { tag: "#Layoffs", posts: "5,234 posts", icon: FiTrendingUp },
    { tag: "#DigitalTransformation", posts: "3,112 posts", icon: FiRadio },
  ];
  const stickyTop = "6.5rem";
  const stickyBottomGap = "3rem";
  const visibleSuggestions = suggestions.filter((s) => s.user.id != id).slice(0, 2);

  return (
    <div
      className="sticky grid w-full min-w-0 gap-5 overflow-y-auto overflow-x-hidden pr-1 hide-scrollbar"
      style={{
        top: stickyTop,
        maxHeight: `calc(100vh - ${stickyTop} - ${stickyBottomGap})`,
        paddingBottom: stickyBottomGap,
      }}
    >
      <div className="w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white">
        <div className="px-5 pt-5">
          <h3 className="text-lg font-bold text-slate-950">
            <span className="text-red-700">Trending</span> Topics
          </h3>
        </div>
        <div className="px-4 py-3">
          {trendingTopics.map((topic) => {
            const Icon = topic.icon;

            return (
              <button
                key={topic.tag}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-950">
                    {topic.tag}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-slate-500">
                    {topic.posts}
                  </div>
                </div>
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-red-50 text-red-700">
                  <Icon className="h-4 w-4" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full min-w-0 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white">
        <div className="px-5 pt-5">
          <h3 className="text-lg font-bold text-slate-950">
            <span className="text-red-700">Suggested</span> Connections
          </h3>
        </div>
        <div className="grid max-h-[52vh] gap-4 overflow-y-auto overflow-x-hidden p-4 hide-scrollbar">
          {visibleSuggestions.map((recommendation) => {
              const { user, reasons } = recommendation;
              const reasonTexts: string[] = [];

              if (reasons.mutualConnections > 0) {
                reasonTexts.push(
                  `${reasons.mutualConnections} mutual connection${reasons.mutualConnections > 1 ? "s" : ""}`
                );
              }
              if (reasons.sameCompany) {
                reasonTexts.push("Same company");
              }
              if (reasons.samePosition) {
                reasonTexts.push("Same position");
              }
              if (reasons.sameLocation) {
                reasonTexts.push("Same location");
              }
              if (
                reasons.isSecondDegreeConnection &&
                reasonTexts.length === 0
              ) {
                reasonTexts.push("Friend of friend");
              }

              return (
                <div className="flex w-full min-w-0 gap-3" key={user.id}>
                  <button
                    className="h-12 w-12 flex-shrink-0 cursor-pointer overflow-hidden rounded-full transition-all hover:ring-4 hover:ring-red-100"
                    onClick={() => navigate("/profile/" + user.id)}
                  >
                    <img
                      src={resolveMediaUrl(user.profilePicture) || "/doc1.png"}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => navigate("/profile/" + user.id)}
                      className="group w-full text-left"
                    >
                      <div className="truncate text-sm font-bold text-slate-950 transition-colors group-hover:text-red-700">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="mt-0.5 truncate text-xs font-medium text-slate-500">
                        {user.position} at {user.company}
                      </div>
                      {reasonTexts.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                          <FiUsers className="h-3.5 w-3.5" />
                          <span className="block truncate">
                            {reasonTexts.join(" | ")}
                          </span>
                        </div>
                      )}
                    </button>
                    <button
                      className="mt-2 flex w-full max-w-full items-center justify-center gap-1 overflow-hidden rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
                      onClick={() => {
                        request<IConnection>({
                          endpoint:
                            "/api/v1/networking/connections?recipientId=" +
                            user.id,
                          method: "POST",
                          onSuccess: () => {
                            setSuggestions((prev) =>
                              prev.filter((s) => s.user.id !== user.id)
                            );
                          },
                          onFailure: (error) => console.log(error),
                        });
                      }}
                    >
                      <FiPlus className="h-4 w-4" />
                      Connect
                    </button>
                  </div>
                </div>
              );
            })}

          {visibleSuggestions.length === 0 && (
            <div className="py-4 text-center">
              <p className="text-sm text-slate-500">
                No suggestions available at the moment.
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => navigate("/network/invitations")}
          className="w-full border-t border-slate-100 px-4 py-4 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-red-700"
        >
          View all recommendations
        </button>
      </div>
    </div>
  );
}
