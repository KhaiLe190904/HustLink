import { Outlet } from "react-router-dom";
import { Header } from "@/components/Header/Header";
import { WebSocketContextProvider } from "@/features/websocket/websocket";

export function ApplicationLayout() {
  return (
    <WebSocketContextProvider>
      <div className="min-h-screen">
        <Header />
        <main className="pt-25">
          <div className="max-w-[1400px] w-full mx-auto px-6 py-4">
            <Outlet />
          </div>
        </main>
      </div>
    </WebSocketContextProvider>
  );
}
