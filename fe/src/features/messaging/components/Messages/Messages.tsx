import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { Message } from "@/features/messaging/components/Message/Message";
import { IPost } from "@/features/feed/components/Post/Post";
import {
  formatMessageDivider,
  shouldShowDivider,
} from "@/features/feed/utils/date";

export interface IMessage {
  id: number;
  sender: IUser;
  receiver: IUser;
  content: string;
  attachmentObjectId?: number;
  attachmentKind?: string;
  attachmentFileName?: string;
  attachmentContentType?: string;
  isRead: boolean;
  creationAt: string;
  sharedPost?: IPost;
}

interface IMessagesProps {
  messages: IMessage[];
  user: IUser | null;
}

export function Messages({ messages, user }: IMessagesProps) {
  let latestMyMessageId: number | undefined;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].sender.id === user?.id) {
      latestMyMessageId = messages[index].id;
      break;
    }
  }

  return (
    <div className="p-4 flex flex-col items-start gap-4">
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
            <Message
              message={message}
              user={user}
              showDeliveryStatus={message.id === latestMyMessageId}
            />
          </div>
        );
      })}
    </div>
  );
}
