import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { request } from "@/utils/api";
import {
  IUser,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { IConnection } from "@/features/networking/components/Connection/Connection";
import { Title } from "@/features/networking/components/Title/Title";
import { useWebSocket } from "@/features/websocket/websocket";
import { Page } from "@/utils/pagination";

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

export function Network() {
  usePageTitle("Network");
  const [connectionCount, setConnectionCount] = useState(0);
  const [invitations, setInvitations] = useState<IConnection[]>([]);
  const [suggestions, setSuggestions] = useState<IUserRecommendation[]>([]);
  const navigate = useNavigate();
  const ws = useWebSocket();
  const { user } = useAuthentication();

  useEffect(() => {
    request<Page<IConnection>>({
      endpoint: "/api/v1/networking/connections/paginated?page=0&size=1",
      onSuccess: (data) => setConnectionCount(data.totalElements),
      onFailure: (error) => console.log(error),
    });
  }, []);

  useEffect(() => {
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections?status=PENDING",
      onSuccess: (data) => setInvitations(data),
      onFailure: (error) => console.log(error),
    });

    request<IUserRecommendation[]>({
      endpoint: "/api/v1/networking/suggestions?limit=10",
      onSuccess: (data) => setSuggestions(data),
      onFailure: (error) => console.log(error),
    });
  }, []);

  useEffect(() => {
    const subscription = ws?.subscribe(
      "/topic/users/" + user?.id + "/connections/new",
      (data) => {
        const connection = JSON.parse(data.body);
        setInvitations((connections) => [connection, ...connections]);
        setSuggestions((suggestions) =>
          suggestions.filter(
            (s) =>
              s.user.id !== connection.author.id &&
              s.user.id !== connection.recipient.id
          )
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  useEffect(() => {
    const subscription = ws?.subscribe(
      "/topic/users/" + user?.id + "/connections/accepted",
      (data) => {
        const connection = JSON.parse(data.body);
        setConnectionCount((count) => count + 1);
        setInvitations((invitations) =>
          invitations.filter((c) => c.id !== connection.id)
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  useEffect(() => {
    const subscription = ws?.subscribe(
      "/topic/users/" + user?.id + "/connections/remove",
      (data) => {
        const connection = JSON.parse(data.body);
        setConnectionCount((count) => Math.max(0, count - 1));
        setInvitations((invitations) =>
          invitations.filter((c) => c.id !== connection.id)
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  return (
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
      <div className="hidden h-max rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_30px_rgba(15,23,42,0.04)] lg:block">
        <Title>Manage my network</Title>
        <div className="grid gap-1">
          <NavLink
            to="invitations"
            className={({ isActive }) =>
              `mb-2 flex items-center gap-2 rounded-2xl border border-slate-200/80 px-3 py-2.5 text-sm font-semibold transition-colors hover:text-red-600 ${
                isActive
                  ? "bg-red-50 text-[var(--primary-color)]"
                  : "text-slate-700"
              }`
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="w-6 h-6"
            >
              <path d="M15 13.25V21H9v-7.75A2.25 2.25 0 0 1 11.25 11h1.5A2.25 2.25 0 0 1 15 13.25m5-.25h-1a2 2 0 0 0-2 2v6h5v-6a2 2 0 0 0-2-2M12 3a3 3 0 1 0 3 3 3 3 0 0 0-3-3m7.5 8A2.5 2.5 0 1 0 17 8.5a2.5 2.5 0 0 0 2.5 2.5M5 13H4a2 2 0 0 0-2 2v6h5v-6a2 2 0 0 0-2-2m-.5-7A2.5 2.5 0 1 0 7 8.5 2.5 2.5 0 0 0 4.5 6"></path>
            </svg>
            <span>Invitations</span>
            <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700">
              {invitations.length}
            </span>
          </NavLink>
          <NavLink
            to="connections"
            className={({ isActive }) =>
              `mb-2 flex items-center gap-2 rounded-2xl border border-slate-200/80 px-3 py-2.5 text-sm font-semibold transition-colors hover:text-red-600 ${
                isActive
                  ? "bg-red-50 text-[var(--primary-color)]"
                  : "text-slate-700"
              }`
            }
          >
            <svg
              className="w-6 h-6"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 16v6H3v-6a3 3 0 013-3h3a3 3 0 013 3zm5.5-3A3.5 3.5 0 1014 9.5a3.5 3.5 0 003.5 3.5zm1 2h-2a2.5 2.5 0 00-2.5 2.5V22h7v-4.5a2.5 2.5 0 00-2.5-2.5zM7.5 2A4.5 4.5 0 1012 6.5 4.49 4.49 0 007.5 2z"></path>
            </svg>
            <span>Connections</span>
            <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700">
              {connectionCount}
            </span>
          </NavLink>
        </div>
      </div>
      <div className="grid gap-4">
        <Outlet />

        {suggestions.length > 0 ? (
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
            <Title>People you may know</Title>
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
              {suggestions.map((recommendation) => {
                const { user, reasons } = recommendation;
                const reasonTexts: string[] = [];

                if (reasons.mutualConnections > 0) {
                  reasonTexts.push(`${reasons.mutualConnections} mutual`);
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
                  <div
                    key={user.id}
                    className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-center text-sm shadow-sm"
                  >
                    <div className="relative mb-12">
                      <img
                        src={user.coverPicture || "/cover.jpeg"}
                        alt="Cover"
                        className="h-20 w-full object-cover"
                      />
                      <button
                        onClick={() => navigate("/profile/" + user.id)}
                        className="absolute -bottom-12 left-1/2 transform -translate-x-1/2"
                      >
                        <img
                          className="mx-auto h-24 w-24 rounded-full border-4 border-white object-cover transition-all hover:ring-2 hover:ring-red-200"
                          src={user.profilePicture || "/doc1.png"}
                          alt="Profile"
                        />
                      </button>
                    </div>
                    <div className="p-4">
                      <h3 className="mb-1 font-bold text-slate-900">
                        {user.firstName} {user.lastName}
                      </h3>
                      <p className="mb-2 text-xs text-slate-500">
                        {user.position} at {user.company}
                      </p>
                      <div className="mb-3 flex h-5 items-center justify-center gap-1 text-xs text-slate-500">
                        {reasonTexts.length > 0 ? (
                          <>
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zM14 17a6 6 0 00-12 0h12zM13 8a1 1 0 100 2h4a1 1 0 100-2h-4z" />
                            </svg>
                            <span>{reasonTexts.join(" • ")}</span>
                          </>
                        ) : (
                          <span>&nbsp;</span>
                        )}
                      </div>
                      <button
                        className="mx-auto flex items-center justify-center gap-2 rounded-full bg-[var(--primary-color)] px-6 py-2 text-sm font-semibold text-white transition-all hover:bg-red-700 hover:shadow-lg active:scale-95"
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
            </div>
          </div>
        ) : (
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-8 text-center shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
            <svg
              className="mx-auto mb-4 h-16 w-16 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              No more suggestions
            </h3>
            <p className="text-sm text-slate-500">
              You've seen all available recommendations. Check back later for
              new connections!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
