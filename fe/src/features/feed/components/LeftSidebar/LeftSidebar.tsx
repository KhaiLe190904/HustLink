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

  const acceptedConnections = connections.filter(
    (connection) => connection.status === "ACCEPTED"
  ).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden sticky top-30 ">
      {/* Cover & Avatar Section */}
      <div className="relative">
        <div className="h-16 bg-gradient-to-r from-blue-400 to-purple-400">
          <img
            src={user?.coverPicture || "/cover.jpeg"}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        </div>
        <button
          className="absolute left-1/2 -translate-x-1/2 -bottom-10 w-20 h-20 rounded-full overflow-hidden border-4 border-white bg-white hover:ring-2 hover:ring-red-500 transition-all cursor-pointer shadow-md"
          onClick={() => navigate("/profile/" + user?.id)}
        >
          <img
            src={user?.profilePicture || "/doc1.png"}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </button>
      </div>

      {/* Profile Info */}
      <div className="text-center pt-12 pb-3 px-3 border-b border-gray-200">
        <button
          onClick={() => navigate("/profile/" + user?.id)}
          className="font-semibold text-base text-gray-900 hover:text-red-600 hover:underline cursor-pointer transition-colors"
        >
          {user?.firstName} {user?.lastName}
        </button>
        <p className="text-sm text-gray-600 mt-1">
          {user?.position} at {user?.company}
        </p>
      </div>

      {/* Stats Section */}
      <div className="px-3 py-3 border-b border-gray-200 text-sm space-y-2">
        <button
          onClick={() => navigate("/network/connections")}
          className="w-full flex justify-between items-center hover:bg-gray-50 py-1 rounded transition-colors group"
        >
          <span className="text-gray-600 group-hover:text-gray-900">
            Connections
          </span>
          <span className="font-semibold text-black">
            {acceptedConnections}
          </span>
        </button>
      </div>

      {/* My Items */}
      <button
        onClick={() => navigate("/profile/" + user?.id)}
        className="w-full px-3 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          <span>My Items</span>
        </div>
      </button>
    </div>
  );
}
