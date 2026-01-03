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

enum NotificationType {
  LIKE = "LIKE",
  COMMENT = "COMMENT",
}
export interface INotification {
  id: number;
  recipient: IUser;
  actor: IUser;
  read: boolean;
  type: NotificationType;
  resourceId: number;
  creationDate: string;
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

  return (
    <div className="grid gap-8 grid-cols-1 xl:grid-cols-[14rem_1fr_20rem] xl:items-start [&_.left]:hidden [&_.right]:hidden xl:[&_.left]:block xl:[&_.right]:block">
      <div className="hidden xl:block">
        <LeftSidebar user={user} />
      </div>
      <div className="bg-white rounded-lg border border-gray-300">
        {notifications.map((notification) => (
          <INotification
            key={notification.id}
            notification={notification}
            setNotifications={setNotifications}
          />
        ))}
        {notifications.length === 0 && (
          <p className="p-4 text-gray-500 text-center">No notifications</p>
        )}
      </div>
      <div className="hidden xl:block">
        <RightSidebar />
      </div>
    </div>
  );
}

function INotification({
  notification,
  setNotifications,
}: {
  notification: INotification;

  setNotifications: Dispatch<SetStateAction<INotification[]>>;
}) {
  const navigate = useNavigate();

  function markNotificationAsRead(notificationId: number) {
    request({
      endpoint: `/api/v1/notifications/${notificationId}`,
      method: "PUT",
      onSuccess: () => {
        setNotifications((prev) =>
          prev.map((notification) =>
            notification.id === notificationId
              ? { ...notification, isRead: true }
              : notification
          )
        );
      },
      onFailure: (error) => console.log(error),
    });
  }
  return (
    <button
      onClick={() => {
        markNotificationAsRead(notification.id);
        navigate(`/posts/${notification.resourceId}`);
      }}
      className={`flex items-center gap-2 p-4 w-full text-left last:border-b-0 border-b border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer ${
        !notification.read ? "bg-gray-100" : ""
      }`}
    >
      <img
        src={notification.actor.profilePicture || "/doc1.png"}
        alt="Profile"
        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
      />

      <p className="mr-auto text-sm">
        <strong className="text-gray-900">
          {notification.actor.firstName + " " + notification.actor.lastName}
        </strong>{" "}
        <span className="text-gray-600">
          {notification.type === NotificationType.LIKE
            ? "liked"
            : "commented on"}{" "}
          your post.
        </span>
      </p>
      <TimeAgo date={notification.creationDate} />
    </button>
  );
}
