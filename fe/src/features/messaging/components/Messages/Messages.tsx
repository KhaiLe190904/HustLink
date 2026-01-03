import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { Message } from "@/features/messaging/components/Message/Message";
import {
  formatMessageDivider,
  shouldShowDivider,
} from "@/features/feed/utils/date";

export interface IMessage {
  id: number;
  sender: IUser;
  receiver: IUser;
  content: string;
  isRead: boolean;
  creationAt: string;
}

interface IMessagesProps {
  messages: IMessage[];
  user: IUser | null;
}

export function Messages({ messages, user }: IMessagesProps) {
  return (
    <div className="p-4 flex flex-col items-start gap-4 overflow-y-auto">
      {messages.map((message, index) => {
        const currentDate = new Date(message.creationAt);
        const prevMessage = index > 0 ? messages[index - 1] : null;
        const showDivider =
          prevMessage &&
          shouldShowDivider(new Date(prevMessage.creationAt), currentDate);

        return (
          <div key={message.id} className="w-full">
            {showDivider && (
              <div className="flex justify-center w-full my-4">
                <span className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded-full">
                  {formatMessageDivider(currentDate)}
                </span>
              </div>
            )}
            <Message message={message} user={user} />
          </div>
        );
      })}
    </div>
  );
}
