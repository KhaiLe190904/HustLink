import { useEffect, useRef, useState } from "react";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IMessage } from "@/features/messaging/components/Messages/Messages";
import { formatTimestamp } from "@/features/feed/utils/date";

interface IMessageProps {
  message: IMessage;
  user: IUser | null;
}

export function Message({ message, user }: IMessageProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const [showTimestamp, setShowTimestamp] = useState(false);

  useEffect(() => {
    if (!message.isRead && user?.id === message.receiver.id) {
      request<void>({
        endpoint: `/api/v1/messaging/conversations/messages/${message.id}`,
        method: "PUT",
        onSuccess: () => {},
        onFailure: (error) => console.log(error),
      });
    }
  }, [message.id, message.isRead, message.receiver.id, user?.id]);

  useEffect(() => {
    messageRef.current?.scrollIntoView();
  }, []);

  const isMyMessage = message.sender.id === user?.id;
  const otherUser = isMyMessage ? message.receiver : message.sender;

  return (
    <div
      ref={messageRef}
      className={`flex gap-2 items-start w-full relative group ${
        isMyMessage ? "flex-row-reverse" : "flex-row"
      }`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {/* Avatar */}
      <img
        className="w-8 h-8 my-1 rounded-full object-cover flex-shrink-0"
        src={otherUser.profilePicture || "/doc1.png"}
        alt={`${otherUser.firstName} ${otherUser.lastName}`}
      />

      {/* Message bubble and status */}
      <div
        className={`flex flex-col ${
          isMyMessage ? "items-end" : "items-start"
        } max-w-[70%] min-w-0 relative`}
      >
        {/* Timestamp on hover */}
        {showTimestamp && (
          <div
            className={`absolute top-0 ${
              isMyMessage ? "right-full mr-2" : "left-full ml-2"
            } text-xs text-gray-700 bg-gray-200 px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none z-10 shadow-sm`}
          >
            {formatTimestamp(new Date(message.creationAt))}
          </div>
        )}

        <div
          className={`px-4 py-2 ${
            isMyMessage
              ? "bg-[var(--primary-color)] text-white rounded-2xl rounded-br-sm"
              : "bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm"
          }`}
          style={{
            wordWrap: "break-word",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          <div
            style={{
              wordWrap: "break-word",
              overflowWrap: "break-word",
              wordBreak: "break-word",
            }}
          >
            {message.content}
          </div>
        </div>

        {/* Status for my messages */}
        {isMyMessage && (
          <div className="flex items-center gap-2 mt-1 justify-end w-full">
            {message.isRead ? (
              <div className="flex items-center gap-2">
                <img
                  className="w-4 h-4 rounded-full object-cover"
                  src={message.receiver.profilePicture || "/doc1.png"}
                  alt={`${message.receiver.firstName} ${message.receiver.lastName}`}
                />
                <span className="text-xs text-gray-400">Seen</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Sent</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
