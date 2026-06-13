import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "@/utils/api";
import {
  IUser,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { LeftSidebar } from "@/features/feed/components/LeftSidebar/LeftSidebar";
import { RightSidebar } from "@/features/feed/components/RightSidebar/RightSidebar";
import { TimeAgo } from "@/features/feed/components/TimeAgo/TimeAgo";
import { usePageTitle } from "@/hooks/usePageTitle";

export enum NotificationType {
  LIKE = "LIKE",
  COMMENT = "COMMENT",
  EVENT_REMINDER = "EVENT_REMINDER",
  JOB_APPLICATION = "JOB_APPLICATION",
}
export interface INotification {
  id: number;
  recipient: IUser;
  actor: IUser;
  read: boolean;
  isRead?: boolean;
  type: NotificationType;
  resourceId: number;
  creationDate: string;
  additionalActorsCount?: number;
}

export function Notifications() {
  usePageTitle("Notifications");
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const { user } = useAuthentication();

  useEffect(() => {
    const fetchNotifications = async () => {
      await request<INotification[]>({
        endpoint: "/api/v1/notifications",
        onSuccess: setNotifications,
        onFailure: (error) => console.log(error),
      });
    };

    fetchNotifications();
  }, []);

  const handleMarkAllRead = () => {
    request({
      endpoint: "/api/v1/notifications/mark-all-read",
      method: "PUT",
      onSuccess: () => {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true, isRead: true }))
        );
      },
      onFailure: (error) => console.log(error),
    });
  };

  return (
    <div className="grid gap-8 grid-cols-1 xl:grid-cols-[14rem_1fr_20rem] xl:items-start [&_.left]:hidden [&_.right]:hidden xl:[&_.left]:block xl:[&_.right]:block">
      <div className="hidden xl:block">
        <LeftSidebar user={user} />
      </div>
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Notifications</h2>
          {notifications.some((n) => !(n.read ?? n.isRead)) && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div>
          {notifications.map((notification) => (
            <INotificationComponent
              key={notification.id}
              notification={notification}
              setNotifications={setNotifications}
            />
          ))}
          {notifications.length === 0 && (
            <div className="p-8 text-center">
              <div className="text-slate-300 text-5xl mb-2">🔔</div>
              <p className="text-slate-500 font-medium">
                You're all caught up!
              </p>
              <p className="text-slate-400 text-sm mt-1">
                No new notifications at the moment.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="hidden xl:block">
        <RightSidebar />
      </div>
    </div>
  );
}

function INotificationComponent({
  notification,
  setNotifications,
}: {
  notification: INotification;
  setNotifications: Dispatch<SetStateAction<INotification[]>>;
}) {
  const navigate = useNavigate();
  const [eventDetails, setEventDetails] = useState<{
    title: string;
    startAt: string;
  } | null>(null);
  const [now, setNow] = useState(new Date());

  const isRead = notification.read ?? notification.isRead;

  useEffect(() => {
    if (notification.type === NotificationType.EVENT_REMINDER) {
      request<any>({
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

  function markNotificationAsRead(notificationId: number) {
    request({
      endpoint: `/api/v1/notifications/${notificationId}`,
      method: "PUT",
      onSuccess: () => {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ||
            (n.type === notification.type &&
              n.resourceId === notification.resourceId)
              ? { ...n, read: true, isRead: true }
              : n
          )
        );
      },
      onFailure: (error) => console.log(error),
    });
  }

  const handleNotificationClick = () => {
    markNotificationAsRead(notification.id);
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
        if (!eventDetails) return "reminded: Event is starting soon.";
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
        return "sent you a notification.";
    }
  };

  return (
    <button
      onClick={handleNotificationClick}
      className={`flex items-center gap-4 p-5 w-full text-left last:border-b-0 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer ${
        !isRead ? "bg-blue-50/40 hover:bg-blue-50/60" : ""
      }`}
    >
      <img
        src={notification.actor.profilePicture || "/doc1.png"}
        alt="Profile"
        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-slate-100"
      />

      <p className="mr-auto text-sm">
        <strong className="text-slate-800 font-semibold">
          {notification.actor.firstName + " " + notification.actor.lastName}
        </strong>{" "}
        <span className="text-slate-600">{getNotificationText()}</span>
      </p>
      <TimeAgo date={notification.creationDate} />
    </button>
  );
}
