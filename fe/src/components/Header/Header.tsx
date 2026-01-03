import logo from "/logo.svg";
import { NavLink } from "react-router-dom";
import { Input } from "@/components/Input/Input";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { useEffect, useState } from "react";
import { Profile } from "@/components/Header/components/Profile";
import { useWebSocket } from "@/features/websocket/websocket";
import { request } from "@/utils/api";
import { INotification } from "@/features/feed/pages/Notifications/Notifications";
import { IConversation } from "@/features/messaging/components/Conversations/Conversations";
import { IConnection } from "@/features/networking/components/Connection/Connection";
export function Header() {
  const { user } = useAuthentication();
  const webSocketClient = useWebSocket();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNavigationMenu, setShowNavigationMenu] = useState(
    window.innerWidth > 1080 ? true : false
  );
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const [invitations, setInvitations] = useState<IConnection[]>([]);

  const nonReadMessagesCount = conversations.reduce((acc, conversation) => {
    return (
      acc +
      conversation.messages.filter(
        (message) => message.sender.id !== user?.id && !message.isRead
      ).length
    );
  }, 0);
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const nonReadNotificationCount = notifications.filter(
    (notification) => !notification.read
  ).length;

  useEffect(() => {
    const handleResize = () => {
      setShowNavigationMenu(window.innerWidth > 1080);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    request<INotification[]>({
      endpoint: "/api/v1/notifications",
      onSuccess: setNotifications,
      onFailure: (error) => console.log(error),
    });
  }, []);

  useEffect(() => {
    request<IConversation[]>({
      endpoint: "/api/v1/messaging/conversations",
      onSuccess: setConversations,
      onFailure: (error) => console.log(error),
    });
  }, []);

  useEffect(() => {
    const subscribtion = webSocketClient?.subscribe(
      `/topic/users/${user?.id}/notifications`,
      (message) => {
        const notification = JSON.parse(message.body);
        setNotifications((prev) => {
          const index = prev.findIndex((n) => n.id === notification.id);
          if (index === -1) {
            return [notification, ...prev];
          }
          return prev.map((n) => (n.id === notification.id ? notification : n));
        });
      }
    );
    return () => subscribtion?.unsubscribe();
  }, [user?.id, webSocketClient]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      `/topic/users/${user?.id}/conversations`,
      (message) => {
        const conversation = JSON.parse(message.body);
        setConversations((prev) => {
          const index = prev.findIndex((c) => c.id === conversation.id);
          if (index === -1) {
            return [conversation, ...prev];
          }
          return prev.map((c) => (c.id === conversation.id ? conversation : c));
        });
      }
    );
    return () => subscription?.unsubscribe();
  }, [user?.id, webSocketClient]);

  useEffect(() => {
    const subscriptions = conversations.map((conversation) => {
      return webSocketClient?.subscribe(
        `/topic/conversations/${conversation.id}/messages`,
        (data) => {
          const message = JSON.parse(data.body);
          setConversations((prev) => {
            return prev.map((c) => {
              if (c.id === conversation.id) {
                const index = c.messages.findIndex((m) => m.id === message.id);
                if (index === -1) {
                  return {
                    ...c,
                    messages: [...c.messages, message],
                  };
                }
                return {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === message.id ? message : m
                  ),
                };
              }
              return c;
            });
          });
        }
      );
    });

    return () => {
      subscriptions.forEach((subscription) => subscription?.unsubscribe());
    };
  }, [conversations, webSocketClient]);

  useEffect(() => {
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections?status=PENDING",
      onSuccess: (data) =>
        setInvitations(
          data.filter((c) => !c.seen && c.recipient.id === user?.id)
        ),
      onFailure: (error) => console.log(error),
    });
  }, [user?.id]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      "/topic/users/" + user?.id + "/connections/new",
      (data) => {
        const connection = JSON.parse(data.body);
        setInvitations((connections) =>
          connection.recipient.id === user?.id
            ? [connection, ...connections]
            : connections
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, webSocketClient]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      "/topic/users/" + user?.id + "/connections/accepted",
      (data) => {
        const connection = JSON.parse(data.body);
        setInvitations((invitations) =>
          invitations.filter((c) => c.id !== connection.id)
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, webSocketClient]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      "/topic/users/" + user?.id + "/connections/remove",
      (data) => {
        const connection = JSON.parse(data.body);
        setInvitations((invitations) =>
          invitations.filter((c) => c.id !== connection.id)
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, webSocketClient]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      "/topic/users/" + user?.id + "/connections/seen",
      (data) => {
        const connection = JSON.parse(data.body);
        setInvitations((invitations) =>
          invitations.filter((c) => c.id !== connection.id)
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, webSocketClient]);

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm text-gray-600 text-sm sticky top-0 z-[100] backdrop-blur-sm">
      <div className="max-w-6xl px-4 mx-auto w-full grid grid-cols-[1fr_auto] relative gap-6 py-2">
        <div className="grid gap-4 grid-cols-[auto_1fr] lg:grid-cols-[auto_1fr_auto] items-center">
          <NavLink to="/" className="flex items-center">
            <img
              src={logo}
              alt="HustLink"
              className="w-30 h-15 transition-transform hover:scale-105"
            />
          </NavLink>
          <div className="max-w-md mt-3 hidden lg:block">
            <Input
              type="text"
              placeholder="🔍 Find people, posts..."
              className="!my-0"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-6">
          {showNavigationMenu ? (
            <ul className="absolute top-16 right-4 bg-white border border-gray-200 rounded-xl p-3 w-72 grid gap-1 shadow-lg lg:relative lg:flex lg:items-center lg:w-auto lg:gap-4 lg:bg-transparent lg:border-none lg:top-0 lg:right-0 lg:p-0 lg:shadow-none">
              <li>
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all lg:flex-col lg:gap-1 lg:p-2 lg:rounded-md hover:bg-gray-100 lg:hover:bg-gray-50 ${
                      isActive
                        ? "text-[var(--primary-color)] bg-blue-50 lg:bg-transparent font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`
                  }
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (window.innerWidth <= 1080) {
                      setShowNavigationMenu(false);
                    }
                  }}
                >
                  <svg
                    className="w-6 h-6 lg:w-5 lg:h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M23 9v2h-2v7a3 3 0 01-3 3h-4v-6h-4v6H6a3 3 0 01-3-3v-7H1V9l11-7 5 3.18V2h3v5.09z" />
                  </svg>
                  <span className="text-sm font-medium lg:text-xs">Home</span>
                </NavLink>
              </li>
              <li className="relative">
                <NavLink
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (window.innerWidth <= 1080) {
                      setShowNavigationMenu(false);
                    }
                  }}
                  to="/network"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all lg:flex-col lg:gap-1 lg:p-2 lg:rounded-md hover:bg-gray-100 lg:hover:bg-gray-50 ${
                      isActive
                        ? "text-[var(--primary-color)] bg-blue-50 lg:bg-transparent font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`
                  }
                >
                  <div className="relative">
                    <svg
                      className="w-6 h-6 lg:w-5 lg:h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 16v6H3v-6a3 3 0 013-3h3a3 3 0 013 3zm5.5-3A3.5 3.5 0 1014 9.5a3.5 3.5 0 003.5 3.5zm1 2h-2a2.5 2.5 0 00-2.5 2.5V22h7v-4.5a2.5 2.5 0 00-2.5-2.5zM7.5 2A4.5 4.5 0 1012 6.5 4.49 4.49 0 007.5 2z" />
                    </svg>
                    {invitations.length > 0 &&
                    !location.pathname.includes("network") ? (
                      <span className="absolute -top-2 -right-4 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center font-medium shadow-sm">
                        {invitations.length > 9 ? "9+" : invitations.length}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm font-medium lg:text-xs">
                    Network
                  </span>
                </NavLink>
              </li>
              <li className="relative">
                <NavLink
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (window.innerWidth <= 1080) {
                      setShowNavigationMenu(false);
                    }
                  }}
                  to="/jobs"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all lg:flex-col lg:gap-1 lg:p-2 lg:rounded-md hover:bg-gray-100 lg:hover:bg-gray-50 ${
                      isActive
                        ? "text-[var(--primary-color)] bg-blue-50 lg:bg-transparent font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`
                  }
                >
                  <svg
                    className="w-6 h-6 lg:w-5 lg:h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17 6V5a3 3 0 00-3-3h-4a3 3 0 00-3 3v1H2v4a3 3 0 003 3h14a3 3 0 003-3V6zM9 5a1 1 0 011-1h4a1 1 0 011 1v1H9zm10 9a4 4 0 003-1.38V17a3 3 0 01-3 3H5a3 3 0 01-3-3v-4.38A4 4 0 005 14z" />
                  </svg>
                  <span className="text-sm font-medium lg:text-xs">Jobs</span>
                </NavLink>
              </li>
              <li className="relative">
                <NavLink
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (window.innerWidth <= 1080) {
                      setShowNavigationMenu(false);
                    }
                  }}
                  to="/messaging"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all lg:flex-col lg:gap-1 lg:p-2 lg:rounded-md hover:bg-gray-100 lg:hover:bg-gray-50 ${
                      isActive
                        ? "text-[var(--primary-color)] bg-blue-50 lg:bg-transparent font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`
                  }
                >
                  <div className="relative">
                    <svg
                      className="w-6 h-6 lg:w-5 lg:h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M16 4H8a7 7 0 000 14h4v4l8.16-5.39A6.78 6.78 0 0023 11a7 7 0 00-7-7zm-8 8.25A1.25 1.25 0 119.25 11 1.25 1.25 0 018 12.25zm4 0A1.25 1.25 0 1113.25 11 1.25 1.25 0 0112 12.25zm4 0A1.25 1.25 0 1117.25 11 1.25 1.25 0 0116 12.25z" />
                    </svg>
                    {nonReadMessagesCount > 0 &&
                    !location.pathname.includes("messaging") ? (
                      <span className="absolute -top-2 -right-4 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center font-medium shadow-sm">
                        {nonReadMessagesCount > 9 ? "9+" : nonReadMessagesCount}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm font-medium lg:text-xs">
                    Messaging
                  </span>
                </NavLink>
              </li>
              <li className="relative">
                <NavLink
                  onClick={() => {
                    setShowProfileMenu(false);
                    if (window.innerWidth <= 1080) {
                      setShowNavigationMenu(false);
                    }
                  }}
                  to="/notifications"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all lg:flex-col lg:gap-1 lg:p-2 lg:rounded-md hover:bg-gray-100 lg:hover:bg-gray-50 ${
                      isActive
                        ? "text-[var(--primary-color)] bg-blue-50 lg:bg-transparent font-medium"
                        : "text-gray-600 hover:text-gray-900"
                    }`
                  }
                >
                  <div className="relative">
                    <svg
                      className="w-6 h-6 lg:w-5 lg:h-5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M22 19h-8.28a2 2 0 11-3.44 0H2v-1a4.52 4.52 0 011.17-2.83l1-1.17h15.7l1 1.17A4.42 4.42 0 0122 18zM18.21 7.44A6.27 6.27 0 0012 2a6.27 6.27 0 00-6.21 5.44L5 13h14z" />
                    </svg>
                    {nonReadNotificationCount > 0 ? (
                      <span className="absolute -top-2 -right-4 bg-red-500 text-white rounded-full text-xs w-5 h-5 flex items-center justify-center font-medium shadow-sm">
                        {nonReadNotificationCount > 9
                          ? "9+"
                          : nonReadNotificationCount}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm font-medium lg:text-xs">
                    Notifications
                  </span>
                </NavLink>
              </li>
            </ul>
          ) : null}
          <button
            className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-100 transition-all lg:hidden"
            onClick={() => {
              setShowNavigationMenu((prev) => !prev);
              setShowProfileMenu(false);
            }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M3 12h18M3 6h18M3 18h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-medium">Menu</span>
          </button>
          {user ? (
            <Profile
              setShowNavigationMenu={setShowNavigationMenu}
              showProfileMenu={showProfileMenu}
              setShowProfileMenu={setShowProfileMenu}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
