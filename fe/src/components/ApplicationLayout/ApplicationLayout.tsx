import { Outlet } from "react-router-dom";
import classes from "./ApplicationLayout.module.css";
import { Header } from "@/components/Header/Header";
import { WebSocketContextProvider } from "@/features/websocket/websocket";
export function ApplicationLayout() {
  return (
    <WebSocketContextProvider>
    <div className={classes.root}>
      <Header />
      <main className={classes.main}>
        <div className={classes.container}>
          <Outlet />
        </div>
      </main>
    </div>
    </WebSocketContextProvider>
  );
}
