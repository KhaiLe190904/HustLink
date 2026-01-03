import { useEffect, useState } from "react";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IConnection } from "@/features/networking/components/Connection/Connection";
import { useWebSocket } from "@/features/websocket/websocket";
import { useNavigate } from "react-router-dom";
interface ILeftSidebarProps {
  user: IUser | null;
}
export function LeftSidebar({ user }: ILeftSidebarProps) {
  const [connections, setConnections] = useState<IConnection[]>([]);
  const ws = useWebSocket();
  const navigate = useNavigate();
  useEffect(() => {
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections?userId=" + user?.id,
      onSuccess: (data) => setConnections(data),
      onFailure: (error) => console.log(error),
    });
  }, [user?.id]);

  useEffect(() => {
    const subscription = ws?.subscribe(
      "/topic/users/" + user?.id + "/connections/accepted",
      (data) => {
        const connection = JSON.parse(data.body);
        setConnections((connections) => [...connections, connection]);
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
    <div className="text-center p-4 bg-white rounded-lg border border-gray-300 shadow-sm">
      <div className="h-28 -m-4 rounded-t-lg overflow-hidden">
        <img
          src={user?.coverPicture || "/cover.jpeg"}
          alt="Cover"
          className="w-full h-full object-cover"
        />
      </div>
      <button
        className="-mt-12 w-24 h-24 mx-auto rounded-full overflow-hidden border-2 border-white relative z-10 hover:ring-2 hover:ring-blue-200 transition-all shadow-lg cursor-pointer"
        onClick={() => navigate("/profile/" + user?.id)}
      >
        <img
          src={user?.profilePicture || "/doc1.png"}
          alt="Profile"
          className="w-full h-full object-cover"
        />
      </button>
      <div className="font-bold my-2 text-gray-900 hover:text-red-600 cursor-pointer transition-colors">
        {user?.firstName + " " + user?.lastName}
      </div>
      <div className="border-b border-gray-200 pb-2 text-sm text-gray-600">
        {user?.position + " at " + user?.company}
      </div>
      <div className="text-left text-xs mt-4 text-gray-600 space-y-1">
        <div className="flex justify-between items-center w-full">
          <span>Connexions</span>
          <span className="font-bold text-red-600">
            {
              connections.filter(
                (connection) => connection.status === "ACCEPTED"
              ).length
            }
          </span>
        </div>
      </div>
    </div>
  );
}
