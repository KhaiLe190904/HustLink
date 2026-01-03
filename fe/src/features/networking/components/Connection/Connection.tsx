import { Dispatch, SetStateAction, useEffect } from "react";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { Button } from "@/features/authentication/components/Button/Button";
import { useNavigate } from "react-router-dom";

export enum Status {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
}

export interface IConnection {
  id: number;
  author: IUser;
  recipient: IUser;
  status: Status;
  connectionDate: string;
  seen: boolean;
}

interface IConnectionProps {
  connection: IConnection;
  user: IUser | null;
  setConnections: Dispatch<SetStateAction<IConnection[]>>;
}

export function Connection({
  connection,
  user,
  setConnections,
}: IConnectionProps) {
  const navigate = useNavigate();
  const userToDisplay =
    connection.author.id === user?.id
      ? connection.recipient
      : connection.author;

  useEffect(() => {
    if (connection.recipient.id === user?.id) {
      request<void>({
        endpoint: `/api/v1/networking/connections/${connection.id}/seen`,
        method: "PUT",
        onSuccess: () => {},
        onFailure: (error) => console.log(error),
      });
    }
  }, [connection.id, connection.recipient.id, setConnections, user?.id]);

  return (
    <div
      key={connection.id}
      className="flex items-center gap-2 text-sm last:border-b-0 last:mb-0 last:pb-0 border-b border-gray-300 mb-2 pb-2"
    >
      <button
        onClick={() => navigate("/profile/" + userToDisplay.id)}
        className="flex-shrink-0"
      >
        <img
          className="w-12 h-12 rounded-full object-cover hover:ring-2 hover:ring-blue-200 transition-all"
          src={userToDisplay.profilePicture || "/doc1.png"}
          alt="Profile"
        />
      </button>
      <button
        onClick={() => navigate("/profile/" + userToDisplay.id)}
        className="flex-1 text-left hover:text-red-600 transition-colors"
      >
        <h3 className="font-bold text-gray-900 truncate">
          {userToDisplay?.firstName + " " + userToDisplay.lastName}
        </h3>
        <p className="text-gray-600 text-xs truncate">
          {userToDisplay?.position} at {userToDisplay?.company}
        </p>
      </button>
      <div className="ml-auto flex gap-2">
        {connection.status === Status.ACCEPTED ? (
          <Button
            size="small"
            outline
            className="!my-0 !py-1 !px-2 text-xs"
            onClick={() => {
              request<IConnection>({
                endpoint: `/api/v1/networking/connections/${connection.id}`,
                method: "DELETE",
                onSuccess: () => {
                  setConnections((connections) =>
                    connections.filter((c) => c.id !== connection.id)
                  );
                },
                onFailure: (error) => console.log(error),
              });
            }}
          >
            Remove
          </Button>
        ) : (
          <>
            <Button
              size="small"
              outline
              className="!my-0 !py-1 !px-2 text-xs"
              onClick={() => {
                request<IConnection>({
                  endpoint: `/api/v1/networking/connections/${connection.id}`,
                  method: "DELETE",
                  onSuccess: () => {
                    setConnections((connections) =>
                      connections.filter((c) => c.id !== connection.id)
                    );
                  },
                  onFailure: (error) => console.log(error),
                });
              }}
            >
              {user?.id === connection.author.id ? "Cancel" : "Ignore"}
            </Button>
            {user?.id === connection.recipient.id && (
              <Button
                size="small"
                className="!my-0 !py-1 !px-2 text-xs"
                onClick={() => {
                  request<IConnection>({
                    endpoint: `/api/v1/networking/connections/${connection.id}`,
                    method: "PUT",
                    onSuccess: () => {
                      setConnections((connections) =>
                        connections.filter((c) => c.id !== connection.id)
                      );
                    },
                    onFailure: (error) => console.log(error),
                  });
                }}
              >
                Accept
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
