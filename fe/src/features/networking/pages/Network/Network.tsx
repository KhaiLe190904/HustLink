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
import { Button } from "@/features/authentication/components/Button/Button";

export function Network() {
  usePageTitle("Network");
  const [connections, setConnections] = useState<IConnection[]>([]);
  const [invitations, setInvitations] = useState<IConnection[]>([]);
  const [suggestions, setSuggestions] = useState<IUser[]>([]);
  const navigate = useNavigate();
  const ws = useWebSocket();
  const { user } = useAuthentication();

  useEffect(() => {
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections",
      onSuccess: (data) => setConnections(data),
      onFailure: (error) => console.log(error),
    });
  }, []);

  useEffect(() => {
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections?status=PENDING",
      onSuccess: (data) => setInvitations(data),
      onFailure: (error) => console.log(error),
    });
  }, []);

  useEffect(() => {
    request<IUser[]>({
      endpoint: "/api/v1/networking/suggestions",
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
              s.id !== connection.author.id && s.id !== connection.recipient.id
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
        setConnections((connections) => [connection, ...connections]);
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
        setConnections((connections) =>
          connections.filter((c) => c.id !== connection.id)
        );
        setInvitations((invitations) =>
          invitations.filter((c) => c.id !== connection.id)
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  return (
    <div className="grid lg:grid-cols-[20rem_1fr] lg:gap-4 lg:items-start">
      <div className="hidden lg:block bg-white rounded-lg border border-gray-300 p-4 h-max">
        <Title>Manage my network</Title>
        <div className="grid gap-1">
          <NavLink
            to="invitations"
            className={({ isActive }) =>
              `flex items-center gap-2 last:border-b-0 last:mb-0 last:pb-0 border-b border-gray-300 mb-2 pb-2 hover:text-red-600 transition-colors ${
                isActive ? "text-[var(--primary-color)]" : ""
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
            <span className="ml-auto font-bold w-8 h-8 rounded-full flex justify-center items-center bg-gray-100">
              {invitations.length}
            </span>
          </NavLink>
          <NavLink
            to="connections"
            className={({ isActive }) =>
              `flex items-center gap-2 last:border-b-0 last:mb-0 last:pb-0 border-b border-gray-300 mb-2 pb-2 hover:text-red-600 transition-colors ${
                isActive ? "text-[var(--primary-color)]" : ""
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
            <span className="ml-auto font-bold w-8 h-8 rounded-full flex justify-center items-center bg-gray-100">
              {connections.length}
            </span>
          </NavLink>
        </div>
      </div>
      <div className="grid gap-4">
        <Outlet />

        {suggestions.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-300 p-4">
            <Title>People you may know</Title>
            <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="rounded-lg border border-gray-300 text-center text-sm bg-white shadow-sm"
                >
                  <div className="relative mb-12">
                    <img
                      src={suggestion.coverPicture || "/cover.jpeg"}
                      alt="Cover"
                      className="h-20 w-full object-cover rounded-t-lg"
                    />
                    <button
                      onClick={() => navigate("/profile/" + suggestion.id)}
                      className="absolute -bottom-12 left-1/2 transform -translate-x-1/2"
                    >
                      <img
                        className="w-24 h-24 rounded-full mx-auto border-4 border-white object-cover hover:ring-2 hover:ring-blue-200 transition-all"
                        src={suggestion.profilePicture || "/doc1.png"}
                        alt="Profile"
                      />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 mb-1">
                      {suggestion.firstName} {suggestion.lastName}
                    </h3>
                    <p className="text-gray-600 text-xs mb-3">
                      {suggestion.position} at {suggestion.company}
                    </p>
                    <Button
                      outline
                      size="small"
                      className="w-max mx-auto !my-0"
                      onClick={() => {
                        request<IConnection>({
                          endpoint:
                            "/api/v1/networking/connections?recipientId=" +
                            suggestion.id,
                          method: "POST",
                          onSuccess: () => {
                            setSuggestions(
                              suggestions.filter((s) => s.id !== suggestion.id)
                            );
                          },
                          onFailure: (error) => console.log(error),
                        });
                      }}
                    >
                      Connect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
