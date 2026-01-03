import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header/Header";
import { WebSocketContextProvider } from "@/features/websocket/websocket";

export function ApplicationLayout() {
  return (
    <WebSocketContextProvider>
      <div className="min-h-screen grid gap-4 grid-rows-[auto_1fr]">
        <Header />
        <main className="flex flex-col flex-1">
          <div className="max-w-[74rem] w-full mx-auto px-[var(--container-padding,1rem)] py-[var(--container-padding,1rem)] h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </WebSocketContextProvider>
  );
}
