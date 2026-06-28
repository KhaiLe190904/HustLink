import { CompatClient, Stomp, StompSubscription } from "@stomp/stompjs";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type SafeWebSocketClient = Pick<CompatClient, "subscribe">;

const noopSubscription: StompSubscription = {
  id: "noop",
  unsubscribe: () => {},
};

const WsContext = createContext<SafeWebSocketClient | null>(null);

export const useWebSocket = () => useContext(WsContext);

export const WebSocketContextProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [stompClient, setStompClient] = useState<CompatClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let active = true;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/^https?:/, "")
      : `//${window.location.host}`;

    const wsUrl = import.meta.env.VITE_API_URL
      ? `${import.meta.env.VITE_API_URL.startsWith("https") ? "wss" : "ws"}:${import.meta.env.VITE_API_URL.replace(/^https?:/, "")}/ws`
      : `${protocol}${host}/ws`;

    const client = Stomp.client(wsUrl);
    client.reconnectDelay = 5000;
    client.onWebSocketClose = () => {
      if (!active) return;
      setIsConnected(false);
      setStompClient(null);
    };

    client.connect(
      {},
      () => {
        if (!active) return;
        console.log("Connected to WebSocket");
        setIsConnected(true);
        setStompClient(client);
      },
      (error: unknown) => {
        if (!active) return;
        console.error("Error connecting to WebSocket:", error);
        setIsConnected(false);
        setStompClient(null);
      }
    );

    return () => {
      active = false;
      setIsConnected(false);
      setStompClient(null);
      void client.deactivate();
    };
  }, []);

  const safeClient = useMemo<SafeWebSocketClient | null>(() => {
    if (!stompClient || !isConnected) {
      return null;
    }

    return {
      subscribe: (...args) => {
        if (!stompClient.connected) {
          return noopSubscription;
        }

        try {
          return stompClient.subscribe(...args);
        } catch (error) {
          console.error("WebSocket subscribe failed:", error);
          return noopSubscription;
        }
      },
    };
  }, [isConnected, stompClient]);

  return <WsContext.Provider value={safeClient}>{children}</WsContext.Provider>;
};
