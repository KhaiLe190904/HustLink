import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { request } from "@/utils/api";
import { IUser, useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { LeftSidebar } from "@/features/feed/components/LeftSidebar/LeftSidebar";
import { RightSidebar } from "@/features/feed/components/RightSidebar/RightSidebar";
import { TimeAgo } from "@/features/feed/components/TimeAgo/TimeAgo";
import classes from "./Notifications.module.scss";
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
    <div className={classes.root}>
      <div className={classes.left}>
        <LeftSidebar user={user} />
      </div>
      <div className={classes.center}>
        {notifications.map((notification) => (
          <INotification
            key={notification.id}
            notification={notification}
            setNotifications={setNotifications}
          />
        ))}
        {notifications.length === 0 && (
          <p
            style={{
              padding: "1rem",
            }}
          >
            No notifications
          </p>
        )}
      </div>
      <div className={classes.right}>
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
      className={
        notification.read
          ? classes.notification
          : `${classes.notification} ${classes.unread}`
      }
    >
      <img
        src={notification.actor.profilePicture || "/doc1.png"}
        alt=""
        className={classes.avatar}
      />

      <p
        style={{
          marginRight: "auto",
        }}
      >
        <strong>
          {notification.actor.firstName + " " + notification.actor.lastName}
        </strong>{" "}
        {notification.type === NotificationType.LIKE ? "liked" : "commented on"}{" "}
        your post.
      </p>
      <TimeAgo date={notification.creationDate} />
    </button>
  );
}
