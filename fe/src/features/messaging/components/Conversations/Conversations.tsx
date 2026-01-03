import { HTMLAttributes, useEffect, useState } from "react";
import { request } from "@/utils/api";
import {
  IUser,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { IMessage } from "@/features/messaging/components/Messages/Messages";

import { Conversation } from "@/features/messaging/components/Conversation/Conversation";
import { useWebSocket } from "@/features/websocket/websocket";

export interface IConversation {
  id: number;
  author: IUser;
  recipient: IUser;
  messages: IMessage[];
}

// We need an interface starting with "I" instead of a Type to have consistency with the rest of the codebase.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface IConversationsProps extends HTMLAttributes<HTMLDivElement> {}

export function Conversations(props: IConversationsProps) {
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const { user } = useAuthentication();
  const websocketClient = useWebSocket();

  useEffect(() => {
    request<IConversation[]>({
      endpoint: "/api/v1/messaging/conversations",
      onSuccess: (data) => setConversations(data),
      onFailure: (error) => console.log(error),
    });
  }, []);

  useEffect(() => {
    const subscription = websocketClient?.subscribe(
      `/topic/users/${user?.id}/conversations`,
      (message) => {
        const conversation = JSON.parse(message.body);
        setConversations((prevConversations) => {
          const index = prevConversations.findIndex(
            (c) => c.id === conversation.id
          );
          if (index === -1) {
            return [conversation, ...prevConversations];
          }
          return prevConversations.map((c) =>
            c.id === conversation.id ? conversation : c
          );
        });
      }
    );
    return () => subscription?.unsubscribe();
  }, [user?.id, websocketClient]);

  return (
    <div {...props}>
      {conversations.map((conversation) => {
        return (
          <Conversation key={conversation.id} conversation={conversation} />
        );
      })}
      {conversations.length === 0 && (
        <div className="p-4 text-center text-gray-500">
          No conversation to display.
        </div>
      )}
    </div>
  );
}
