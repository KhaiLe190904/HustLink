import { useEffect, useState } from "react";
import { request } from "@/utils/api";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { useWebSocket } from "@/features/websocket/websocket";
import {
  Connection,
  IConnection,
} from "@/features/networking/components/Connection/Connection";
import { Title } from "@/features/networking/components/Title/Title";

export function Connections() {
  const [connexions, setConnections] = useState<IConnection[]>([]);
  const { user } = useAuthentication();
  const ws = useWebSocket();

  useEffect(() => {
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections",
      onSuccess: (data) => setConnections(data),
      onFailure: (error) => console.log(error),
    });
  }, []);

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
      <Title>Connections ({connexions.length})</Title>

      <>
        {connexions.map((connection) => (
          <Connection
            key={connection.id}
            connection={connection}
            user={user}
            setConnections={setConnections}
          />
        ))}
        {connexions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No connections yet.
          </div>
        )}
      </>
    </div>
  );
}
