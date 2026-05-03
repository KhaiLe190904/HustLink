import logo from "/logo.svg";
import { NavLink, useLocation } from "react-router-dom";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { useEffect, useState } from "react";
import { Profile } from "@/components/Header/components/Profile";
import { Search } from "@/components/Header/components/Search/Search";
import { useWebSocket } from "@/features/websocket/websocket";
import { request } from "@/utils/api";
import { INotification } from "@/features/feed/pages/Notifications/Notifications";
import { IConversation } from "@/features/messaging/components/Conversations/Conversations";
import { IConnection } from "@/features/networking/components/Connection/Connection";
import {
  FiBell,
  FiBriefcase,
  FiFileText,
  FiHome,
  FiMenu,
  FiMessageCircle,
  FiUsers,
  FiX,
} from "react-icons/fi";
export function Header() {
  const { user } = useAuthentication();
  const webSocketClient = useWebSocket();
  const location = useLocation();
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

  const navItems = [
    { to: "/", label: "Home", icon: FiHome, badge: 0 },
    { to: "/ai/cv", label: "AI CV", icon: FiFileText, badge: 0 },
    {
      to: "/network",
      label: "Network",
      icon: FiUsers,
      badge: location.pathname.includes("network") ? 0 : invitations.length,
    },
    { to: "/jobs", label: "Jobs", icon: FiBriefcase, badge: 0 },
    {
      to: "/messaging",
      label: "Messaging",
      icon: FiMessageCircle,
      badge: location.pathname.includes("messaging") ? 0 : nonReadMessagesCount,
    },
    {
      to: "/notifications",
      label: "Notifications",
      icon: FiBell,
      badge: nonReadNotificationCount,
    },
  ];

  const closeMenus = () => {
    setShowProfileMenu(false);
    if (window.innerWidth <= 1080) {
      setShowNavigationMenu(false);
    }
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-[100] border-b border-slate-200/80 bg-white/95 text-sm text-slate-600 shadow-sm backdrop-blur-xl">
      <div className="mx-auto grid h-[72px] w-full max-w-[1400px] grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6">
        <NavLink to="/" className="flex items-center">
          <img
            src={logo}
            alt="HustLink"
            className="h-12 w-auto transition-transform hover:scale-[1.02]"
          />
        </NavLink>

        <div className="hidden justify-self-center lg:block lg:w-[380px] xl:w-[520px]">
          <Search />
        </div>

        <div className="flex items-center justify-end gap-2">
          {showNavigationMenu ? (
            <ul className="absolute right-4 top-[82px] grid w-[min(22rem,calc(100vw-2rem))] gap-1 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10 lg:relative lg:right-auto lg:top-auto lg:flex lg:w-auto lg:items-center lg:gap-1 lg:border-none lg:bg-transparent lg:p-0 lg:shadow-none">
              {navItems.map((item) => {
                const Icon = item.icon;

                return (
                  <li key={item.to} className="relative">
                    <NavLink
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-2xl px-4 py-3 font-semibold transition-all lg:flex-col lg:gap-1 lg:px-3 lg:py-2 ${
                          isActive
                            ? "bg-red-50 text-red-700 lg:bg-slate-100"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                        }`
                      }
                      onClick={closeMenus}
                    >
                      <span className="relative">
                        <Icon className="h-5 w-5" />
                        {item.badge > 0 ? (
                          <span className="absolute -right-2.5 -top-2.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                            {item.badge > 9 ? "9+" : item.badge}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-sm lg:text-[11px]">
                        {item.label}
                      </span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          ) : null}

          <button
            className="grid h-11 w-11 place-items-center rounded-2xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 lg:hidden"
            onClick={() => {
              setShowNavigationMenu((prev) => !prev);
              setShowProfileMenu(false);
            }}
            aria-label="Toggle navigation"
          >
            {showNavigationMenu ? (
              <FiX className="h-5 w-5" />
            ) : (
              <FiMenu className="h-5 w-5" />
            )}
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
