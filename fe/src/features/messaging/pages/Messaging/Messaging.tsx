import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { RightSidebar } from "@/features/feed/components/RightSidebar/RightSidebar";

import { Conversations } from "@/features/messaging/components/Conversations/Conversations";

export function Messaging() {
  usePageTitle("Messaging");
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const location = useLocation();
  const creatingNewConversation = location.pathname.includes("new");
  const onConversation = location.pathname.includes("conversations");
  const navigate = useNavigate();
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="grid gap-8 h-full xl:grid-cols-[1fr_20rem] xl:items-start">
      <div className="h-full bg-white rounded-lg border border-gray-300 lg:grid lg:grid-cols-[16rem_1fr]">
        <div
          className="border-r border-gray-300"
          style={{
            display:
              windowWidth >= 1024 || !creatingNewConversation
                ? "block"
                : "none",
          }}
        >
          <div className="flex justify-between items-center gap-4 p-4 border-b border-gray-300">
            <h1 className="font-bold text-lg">Messaging</h1>
            <button
              onClick={() => {
                navigate("conversations/new");
              }}
              className="bg-gray-100 w-8 h-8 p-1 rounded-full transition-colors flex items-center justify-center hover:bg-gray-200"
            >
              +
            </button>
          </div>
          <Conversations
            style={{
              display: onConversation && windowWidth < 1024 ? "none" : "block",
            }}
          />
        </div>

        <Outlet />
      </div>
      <div className="hidden xl:block">
        <RightSidebar />
      </div>
    </div>
  );
}
