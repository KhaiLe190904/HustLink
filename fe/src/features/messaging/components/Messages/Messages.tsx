import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { Message } from "@/features/messaging/components/Message/Message";
import classes from "./Messages.module.scss";

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
    <div className={classes.root}>
      {messages.map((message) => (
        <Message key={message.id} message={message} user={user} />
      ))}
    </div>
  );
}
