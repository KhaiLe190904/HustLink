import { Link, useNavigate } from "react-router-dom";
import { request } from "@/utils/api";
import {
  INotification,
  NotificationType,
} from "@/features/feed/pages/Notifications/Notifications";
import { TimeAgo } from "@/features/feed/components/TimeAgo/TimeAgo";
import { FiBell, FiCheck } from "react-icons/fi";
import { useEffect, useRef, useState } from "react";

interface NotificationDropdownProps {
  notifications: INotification[];
  setNotifications: React.Dispatch<React.SetStateAction<INotification[]>>;
  onClose: () => void;
}

export function NotificationDropdown({
  notifications,
  setNotifications,
  onClose,
}: NotificationDropdownProps) {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        // Find if user clicked on the notification toggle button itself
        const toggleButton = document.getElementById("notification-toggle-btn");
        if (toggleButton && toggleButton.contains(event.target as Node)) {
          return;
        }
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const markAllAsRead = () => {
    request({
      endpoint: "/api/v1/notifications/mark-all-read",
      method: "PUT",
      onSuccess: () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      },
      onFailure: (err) => console.error(err),
    });
  };

  const markNotificationAsRead = (id: number) => {
    request({
      endpoint: `/api/v1/notifications/${id}`,
      method: "PUT",
      onSuccess: () => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
      },
      onFailure: (err) => console.error(err),
    });
  };

  const handleNotificationClick = (notification: INotification) => {
    markNotificationAsRead(notification.id);
    onClose();
    switch (notification.type) {
      case NotificationType.LIKE:
      case NotificationType.COMMENT:
        navigate(`/posts/${notification.resourceId}`);
        break;
      case NotificationType.EVENT_REMINDER:
        navigate(`/events/${notification.resourceId}`);
        break;
      case NotificationType.JOB_APPLICATION:
        navigate(`/jobs/${notification.resourceId}/applications`);
        break;
      default:
        break;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full z-50 mt-3 w-[22rem] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 animate-in fade-in slide-in-from-top-3 duration-200"
    >
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
        <div>
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <FiBell className="text-red-700" /> Notifications
          </h3>
          {unreadCount > 0 && (
            <span className="text-[10px] text-red-700 font-extrabold uppercase mt-0.5 block">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 rounded-xl bg-red-50 hover:bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 transition"
          >
            <FiCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100">
        {notifications.slice(0, 8).map((notification) => (
          <NotificationItemRow
            key={notification.id}
            notification={notification}
            onClick={() => handleNotificationClick(notification)}
          />
        ))}

        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 px-5 text-center text-slate-400">
            <FiBell className="h-8 w-8 text-slate-200 mb-2" />
            <p className="text-xs font-medium">You're all caught up!</p>
          </div>
        )}
      </div>

      <Link
        to="/notifications"
        onClick={onClose}
        className="block border-t border-slate-100 px-5 py-3.5 text-center text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-red-700 transition"
      >
        See all notifications
      </Link>
    </div>
  );
}

function NotificationItemRow({
  notification,
  onClick,
}: {
  notification: INotification;
  onClick: () => void;
}) {
  const [eventDetails, setEventDetails] = useState<{
    title: string;
    startAt: string;
  } | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (notification.type === NotificationType.EVENT_REMINDER) {
      request<{ title: string; startAt: string }>({
        endpoint: `/api/v1/events/${notification.resourceId}`,
        onSuccess: (data) => {
          setEventDetails({ title: data.title, startAt: data.startAt });
        },
        onFailure: (error) => console.log(error),
      });

      const interval = setInterval(() => {
        setNow(new Date());
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [notification]);

  const getNotificationText = () => {
    const suffix =
      notification.additionalActorsCount &&
      notification.additionalActorsCount > 0
        ? ` and ${notification.additionalActorsCount} other${notification.additionalActorsCount > 1 ? "s" : ""}`
        : "";

    switch (notification.type) {
      case NotificationType.LIKE:
        return `${suffix} liked your post.`;
      case NotificationType.COMMENT:
        return `${suffix} commented on your post.`;
      case NotificationType.EVENT_REMINDER: {
        if (!eventDetails) return "reminded: Event starts soon.";
        const startAt = new Date(eventDetails.startAt);
        const diffMs = startAt.getTime() - now.getTime();

        if (diffMs <= 0) {
          return `reminded: Event "${eventDetails.title}" has started.`;
        }

        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays >= 1) {
          const hours = diffHours % 24;
          const hoursText =
            hours > 0 ? ` ${hours} hour${hours > 1 ? "s" : ""}` : "";
          return `reminded: Event "${eventDetails.title}" starts in ${diffDays} day${diffDays > 1 ? "s" : ""}${hoursText}.`;
        }
        if (diffHours >= 1) {
          const minutes = diffMinutes % 60;
          const minutesText =
            minutes > 0 ? ` ${minutes} minute${minutes > 1 ? "s" : ""}` : "";
          return `reminded: Event "${eventDetails.title}" starts in ${diffHours} hour${diffHours > 1 ? "s" : ""}${minutesText}.`;
        }
        return `reminded: Event "${eventDetails.title}" starts in ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}.`;
      }
      case NotificationType.JOB_APPLICATION:
        return "applied for your job.";
      default:
        return "sent a notification.";
    }
  };

  const isRead = notification.read ?? notification.isRead;

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-slate-50/80 ${
        !isRead ? "bg-blue-50/40 hover:bg-blue-50/60" : ""
      }`}
    >
      <img
        src={notification.actor.profilePicture || "/doc1.png"}
        alt=""
        className="h-10 w-10 shrink-0 rounded-full object-cover border border-slate-100"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-800 leading-normal">
          <span className="font-bold text-slate-950">
            {notification.actor.firstName} {notification.actor.lastName}
          </span>{" "}
          {getNotificationText()}
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400">
            <TimeAgo date={notification.creationDate} />
          </span>
          {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />}
        </div>
      </div>
    </button>
  );
}
