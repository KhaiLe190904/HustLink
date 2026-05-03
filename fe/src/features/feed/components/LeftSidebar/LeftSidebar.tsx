import { useEffect, useState } from "react";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IConnection } from "@/features/networking/components/Connection/Connection";
import { useWebSocket } from "@/features/websocket/websocket";
import { useNavigate } from "react-router-dom";
import { FiBookmark, FiUser, FiUsers } from "react-icons/fi";
import { resolveMediaUrl } from "@/utils/storage";
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
    <div className="sticky top-28 overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="relative">
        <div className="h-[74px] bg-gradient-to-br from-slate-200 via-slate-100 to-red-100">
          <img
            src={resolveMediaUrl(user?.coverPicture) || "/cover.jpeg"}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        </div>
        <button
          className="absolute left-1/2 -bottom-11 h-[88px] w-[88px] -translate-x-1/2 cursor-pointer overflow-hidden rounded-full border-4 border-white bg-white shadow-lg transition-all hover:ring-4 hover:ring-red-100"
          onClick={() => navigate("/profile/" + user?.id)}
        >
          <img
            src={resolveMediaUrl(user?.profilePicture) || "/doc1.png"}
            alt="Profile"
            className="w-full h-full object-cover"
          />
        </button>
      </div>

      <div className="border-b border-slate-100 px-5 pb-5 pt-14 text-center">
        <button
          onClick={() => navigate("/profile/" + user?.id)}
          className="cursor-pointer text-base font-bold text-slate-950 transition-colors hover:text-red-700"
        >
          {user?.firstName} {user?.lastName}
        </button>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
          {user?.position} at {user?.company}
        </p>
      </div>

      <div className="grid gap-1 border-b border-slate-100 px-4 py-4 text-sm">
        <button
          onClick={() => navigate("/profile/" + user?.id)}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
        >
          <FiUser className="h-5 w-5 text-slate-500" />
          <span>My Profile</span>
        </button>
        <button
          onClick={() => navigate("/network/connections")}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
        >
          <FiUsers className="h-5 w-5 text-slate-500" />
          <span className="flex-1">Connections</span>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
            {acceptedConnections}
          </span>
        </button>
        <button
          onClick={() => navigate("/profile/" + user?.id)}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
        >
          <FiBookmark className="h-5 w-5 text-slate-500" />
          <span>Saved Items</span>
        </button>
      </div>
    </div>
  );
}
