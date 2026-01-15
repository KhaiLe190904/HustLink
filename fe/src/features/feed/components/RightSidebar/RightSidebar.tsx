import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IConnection } from "@/features/networking/components/Connection/Connection";

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
      endpoint: "/api/v1/networking/suggestions?limit=2",
      onSuccess: (data) => setSuggestions(data),
      onFailure: (error) => console.log(error),
    });
  }, []);

  const trendingTopics = [
    { tag: "#RemoteWork", posts: "12,456 posts" },
    { tag: "#ArtificialIntelligence", posts: "8,921 posts" },
    { tag: "#Layoffs", posts: "5,234 posts" },
    { tag: "#DigitalTransformation", posts: "3,112 posts" },
  ];

  return (
    <div className="space-y-4 sticky top-30">
      {/* Add to your connections */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-base text-gray-900">
            Add to your connections
          </h3>
        </div>
        <div className="p-4 space-y-4">
          {suggestions
            .filter((s) => s.user.id != id)
            .map((recommendation) => {
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
                <div className="flex gap-3" key={user.id}>
                  <button
                    className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-red-500 transition-all cursor-pointer"
                    onClick={() => navigate("/profile/" + user.id)}
                  >
                    <img
                      src={user.profilePicture || "/doc1.png"}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate("/profile/" + user.id)}
                      className="text-left w-full group"
                    >
                      <div className="font-semibold text-sm text-gray-900 truncate group-hover:text-red-600 group-hover:underline transition-colors">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-gray-600 truncate mt-0.5">
                        {user.position} at {user.company}
                      </div>
                      {reasonTexts.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <svg
                            className="w-3 h-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zM14 17a6 6 0 00-12 0h12zM13 8a1 1 0 100 2h4a1 1 0 100-2h-4z" />
                          </svg>
                          <span className="truncate">
                            {reasonTexts.join(" • ")}
                          </span>
                        </div>
                      )}
                    </button>
                    <button
                      className="mt-2 px-4 py-1.5 bg-[var(--primary-color)] text-white rounded-full font-semibold text-sm hover:bg-red-700 hover:scale-105 hover:shadow-md active:scale-95 transition-all w-full flex items-center justify-center gap-1"
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
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                        />
                      </svg>
                      Connect
                    </button>
                  </div>
                </div>
              );
            })}

          {suggestions.length === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">
                No suggestions available at the moment.
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => navigate("/network/invitations")}
          className="w-full px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 border-t border-gray-200 transition-colors"
        >
          View all recommendations →
        </button>
      </div>

      {/* Trending Topics */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-700"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
              clipRule="evenodd"
            />
          </svg>
          <h3 className="font-semibold text-base text-gray-900">
            Trending Topics
          </h3>
        </div>
        <div className="p-2">
          {trendingTopics.map((topic, index) => (
            <button
              key={index}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded transition-colors"
            >
              <div className="font-semibold text-sm text-blue-600 hover:underline">
                {topic.tag}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">{topic.posts}</div>
            </button>
          ))}
        </div>
        <button className="w-full px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50 border-t border-gray-200 transition-colors flex items-center justify-center gap-1">
          <span>Show more</span>
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
