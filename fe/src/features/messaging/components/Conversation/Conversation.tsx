import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { useWebSocket } from "@/features/websocket/websocket";
import { IConversation } from "@/features/messaging/components/Conversations/Conversations";

interface ConversationItemProps {
  conversation: IConversation;
}

export function Conversation(props: ConversationItemProps) {
  const { user } = useAuthentication();
  const navigate = useNavigate();
  const { id } = useParams();
  const ws = useWebSocket();
  const [conversation, setConversation] = useState<IConversation>(
    props.conversation
  );

  const conversationUserToDisplay =
    conversation.recipient.id === user?.id
      ? conversation.author
      : conversation.recipient;
  const unreadMessagesCount = conversation.messages.filter(
    (message) => message.receiver.id === user?.id && !message.isRead
  ).length;

  useEffect(() => {
    const subscription = ws?.subscribe(
      `/topic/conversations/${conversation.id}/messages`,
      (data) => {
        const message = JSON.parse(data.body);
        setConversation((prevConversation) => {
          const index = prevConversation.messages.findIndex(
            (m) => m.id === message.id
          );
          if (index == -1) {
            return {
              ...prevConversation,
              messages: [...prevConversation.messages, message],
            };
          }

          return {
            ...prevConversation,
            messages: prevConversation.messages.map((m) =>
              m.id === message.id ? message : m
            ),
          };
        });
        return () => subscription?.unsubscribe();
      }
    );
  }, [conversation?.id, ws]);

  return (
    <button
      key={conversation.id}
      className={`flex gap-4 items-center text-left p-3 w-full text-sm border-b border-gray-300 pb-4 relative hover:bg-gray-50 transition-colors ${
        id && Number(id) === conversation.id ? "bg-gray-100" : ""
      }`}
      onClick={() => navigate(`/messaging/conversations/${conversation.id}`)}
    >
      <img
        className="w-12 h-12 flex-shrink-0 rounded-full object-cover"
        src={conversationUserToDisplay.profilePicture || "/doc1.png"}
        alt="Profile"
      />

      {unreadMessagesCount > 0 && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-red-500 text-white grid place-items-center w-6 h-6 rounded-full text-xs">
          {unreadMessagesCount}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="font-bold text-gray-900 truncate">
          {conversationUserToDisplay.firstName}{" "}
          {conversationUserToDisplay.lastName}
        </div>
        <div className="line-clamp-1 text-gray-600 overflow-hidden text-ellipsis">
          {conversation.messages[conversation.messages.length - 1]?.content}
        </div>
      </div>
    </button>
  );
}
