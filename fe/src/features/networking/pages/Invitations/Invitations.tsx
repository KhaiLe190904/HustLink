import { useEffect, useState } from "react";
import { request } from "@/utils/api";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import {
  Connection,
  IConnection,
} from "@/features/networking/components/Connection/Connection";
import { Title } from "@/features/networking/components/Title/Title";
import { useWebSocket } from "@/features/websocket/websocket";
export function Invitations() {
  const [connexions, setConnections] = useState<IConnection[]>([]);
  const [sent, setSent] = useState(false);
  const { user } = useAuthentication();
  const filtredConnections = sent
    ? connexions.filter((c) => c.author.id === user?.id)
    : connexions.filter((c) => c.recipient.id === user?.id);
  const ws = useWebSocket();

  useEffect(() => {
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections?status=PENDING",
      onSuccess: (data) => setConnections(data),
      onFailure: (error) => console.log(error),
    });
  }, [user?.id]);

  useEffect(() => {
    const subscription = ws?.subscribe(
      "/topic/users/" + user?.id + "/connections/new",
      (data) => {
        const connection = JSON.parse(data.body);
        setConnections((connections) => [connection, ...connections]);
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  useEffect(() => {
    const subscription = ws?.subscribe(
      "/topic/users/" + user?.id + "/connections/accepted",
      (data) => {
        const connection = JSON.parse(data.body);
        setConnections((connections) =>
          connections.filter((c) => c.id !== connection.id)
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  useEffect(() => {
    const subscription = ws?.subscribe(
      "/topic/users/" + user?.id + "/connections/remove",
      (data) => {
        const connection = JSON.parse(data.body);
        setConnections((connections) =>
          connections.filter((c) => c.id !== connection.id)
        );
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-4">
      <Title>Invitations ({connexions.length})</Title>
      <div className="flex items-center gap-2 border-b border-gray-300 pb-2 mb-2">
        <button
          className={`red rounded-full px-2 py-1 text-xs transition-colors ${
            !sent ? "bg-[var(--primary-color)] text-white" : ""
          }`}
          onClick={() => setSent(false)}
        >
          Received
        </button>
        <button
          className={`red rounded-full px-2 py-1 text-xs transition-colors ${
            sent ? "bg-[var(--primary-color)] text-white" : ""
          }`}
          onClick={() => setSent(true)}
        >
          Sent
        </button>
      </div>
      {filtredConnections.map((connection) => (
        <Connection
          key={connection.id}
          connection={connection}
          user={user}
          setConnections={setConnections}
        />
      ))}
      {filtredConnections.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No invitation {sent ? "sent" : "received"} yet.
        </div>
      )}
    </div>
  );
}
