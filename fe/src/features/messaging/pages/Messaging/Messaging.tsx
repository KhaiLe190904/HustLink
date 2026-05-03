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
  const showConversationList = windowWidth >= 1024 || !creatingNewConversation;
  const navigate = useNavigate();
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_20rem] xl:items-start">
      <div
        className={`h-[calc(100vh-8.5rem)] min-h-[36rem] overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] lg:grid ${
          showConversationList ? "lg:grid-cols-[18rem_1fr]" : "lg:grid-cols-1"
        }`}
      >
        <div
          className={`${showConversationList ? "border-r border-slate-200/90" : ""} min-h-0 bg-slate-50/50`}
          style={{
            display: showConversationList ? "block" : "none",
          }}
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200/90 p-4">
              <h1 className="text-lg font-bold text-slate-900">Messaging</h1>
              <button
                onClick={() => {
                  navigate("conversations/new");
                }}
                className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
              >
                +
              </button>
            </div>
            <Conversations
              className="min-h-0 flex-1 overflow-y-auto"
              style={{
                display:
                  onConversation && windowWidth < 1024 ? "none" : "block",
              }}
            />
          </div>
        </div>
        <div className="min-h-0 min-w-0 overflow-hidden">
          <Outlet />
        </div>
      </div>
      <div className="hidden xl:block">
        <RightSidebar />
      </div>
    </div>
  );
}
