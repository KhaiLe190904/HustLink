import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, SetStateAction } from "react";
import { request } from "@/utils/api";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { useWebSocket } from "@/features/websocket/websocket";
import {
  Connection,
  IConnection,
} from "@/features/networking/components/Connection/Connection";
import { Title } from "@/features/networking/components/Title/Title";
import { Page } from "@/utils/pagination";

const CONNECTIONS_BATCH_SIZE = 10;

export function Connections() {
  const [connections, setConnections] = useState<IConnection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [showingAll, setShowingAll] = useState(false);
  const [hasMoreConnections, setHasMoreConnections] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [nextConnectionsPage, setNextConnectionsPage] = useState(0);
  const [connectionsTotal, setConnectionsTotal] = useState(0);
  const [error, setError] = useState("");
  const { user } = useAuthentication();
  const ws = useWebSocket();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const getConnectionUser = useCallback(
    (connection: IConnection) =>
      connection.author.id === user?.id
        ? connection.recipient
        : connection.author,
    [user?.id]
  );

  const connectionMatchesQuery = useCallback(
    (connection: IConnection, query: string) => {
      if (!query.trim()) {
        return true;
      }

      const connectionUser = getConnectionUser(connection);
      const searchableText = [
        connectionUser.firstName,
        connectionUser.lastName,
        connectionUser.position,
        connectionUser.company,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query.trim().toLowerCase());
    },
    [getConnectionUser]
  );

  const updateConnections = useCallback(
    (update: SetStateAction<IConnection[]>) => {
      setConnections((currentConnections) => {
        const nextConnections =
          typeof update === "function" ? update(currentConnections) : update;
        const totalDifference =
          nextConnections.length - currentConnections.length;

        if (totalDifference !== 0) {
          setConnectionsTotal((total) => Math.max(0, total + totalDifference));
        }

        return nextConnections;
      });
    },
    []
  );

  const fetchConnections = useCallback(
    async ({
      page = 0,
      query = activeQuery,
      replace = false,
    }: {
      page?: number;
      query?: string;
      replace?: boolean;
    } = {}) => {
      if (loadingConnections) {
        return;
      }

      setLoadingConnections(true);
      const queryParam = query.trim()
        ? `&query=${encodeURIComponent(query.trim())}`
        : "";

      await request<Page<IConnection>>({
        endpoint: `/api/v1/networking/connections/paginated?page=${page}&size=${CONNECTIONS_BATCH_SIZE}${queryParam}`,
        onSuccess: (data) => {
          setError("");
          setConnections((currentConnections) => {
            const baseConnections = replace ? [] : currentConnections;
            const existingIds = new Set(
              baseConnections.map((connection) => connection.id)
            );
            const incomingConnections = data.content.filter(
              (connection) => !existingIds.has(connection.id)
            );

            return [...baseConnections, ...incomingConnections];
          });
          setConnectionsTotal(data.totalElements);
          setHasMoreConnections(!data.last);
          setNextConnectionsPage(page + 1);
        },
        onFailure: (requestError) => setError(requestError),
      });

      setLoadingConnections(false);
    },
    [activeQuery, loadingConnections]
  );

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setError(
        "Enter a name, position, or company to search your connections."
      );
      return;
    }

    setActiveQuery(trimmedQuery);
    setHasSearched(true);
    setShowingAll(false);
    setNextConnectionsPage(0);
    void fetchConnections({ page: 0, query: trimmedQuery, replace: true });
  };

  const handleShowAll = () => {
    setSearchQuery("");
    setActiveQuery("");
    setHasSearched(false);
    setShowingAll(true);
    setNextConnectionsPage(0);
    void fetchConnections({ page: 0, query: "", replace: true });
  };

  useEffect(() => {
    const loadMoreTarget = loadMoreRef.current;
    if (!loadMoreTarget || (!hasSearched && !showingAll)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          !entry?.isIntersecting ||
          loadingConnections ||
          !hasMoreConnections
        ) {
          return;
        }

        void fetchConnections({ page: nextConnectionsPage });
      },
      {
        rootMargin: "300px 0px",
        threshold: 0.1,
      }
    );

    observer.observe(loadMoreTarget);

    return () => {
      observer.disconnect();
    };
  }, [
    fetchConnections,
    hasMoreConnections,
    hasSearched,
    loadingConnections,
    nextConnectionsPage,
    showingAll,
  ]);

  useEffect(() => {
    const subscription = ws?.subscribe(
      "/topic/users/" + user?.id + "/connections/accepted",
      (data) => {
        const connection = JSON.parse(data.body);
        if (!showingAll && !hasSearched) {
          return;
        }

        if (!connectionMatchesQuery(connection, activeQuery)) {
          return;
        }

        setConnections((currentConnections) => {
          if (currentConnections.some((c) => c.id === connection.id)) {
            return currentConnections;
          }

          setConnectionsTotal((total) => total + 1);
          return [connection, ...currentConnections];
        });
      }
    );

    return () => subscription?.unsubscribe();
  }, [
    activeQuery,
    connectionMatchesQuery,
    hasSearched,
    showingAll,
    user?.id,
    ws,
  ]);

  useEffect(() => {
    const subscription = ws?.subscribe(
      "/topic/users/" + user?.id + "/connections/remove",
      (data) => {
        const connection = JSON.parse(data.body);
        setConnections((currentConnections) => {
          const nextConnections = currentConnections.filter(
            (c) => c.id !== connection.id
          );

          if (nextConnections.length !== currentConnections.length) {
            setConnectionsTotal((total) => Math.max(0, total - 1));
          }

          return nextConnections;
        });
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  return (
    <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Title>
          Connections {(hasSearched || showingAll) && `(${connectionsTotal})`}
        </Title>
        <button
          type="button"
          onClick={handleShowAll}
          disabled={loadingConnections && showingAll}
          className="rounded-full border border-[var(--primary-color)] px-4 py-2 text-sm font-semibold text-[var(--primary-color)] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Show all
        </button>
      </div>

      <form onSubmit={handleSearch} className="mt-4 flex gap-2">
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search your connections"
          className="flex-1 rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
        />
        <button
          type="submit"
          disabled={loadingConnections}
          className="rounded-full bg-[var(--primary-color)] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Search
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        {connections.map((connection) => (
          <Connection
            key={connection.id}
            connection={connection}
            user={user}
            setConnections={updateConnections}
          />
        ))}

        {!hasSearched && !showingAll && connections.length === 0 && (
          <div className="py-8 text-center text-slate-500">
            Search your connections or click Show all to load them.
          </div>
        )}

        {(hasSearched || showingAll) &&
          !loadingConnections &&
          connections.length === 0 && (
            <div className="py-8 text-center text-slate-500">
              No connections found.
            </div>
          )}

        {loadingConnections && (
          <div className="py-8 text-center text-slate-500">
            Loading connections...
          </div>
        )}

        {!loadingConnections && hasMoreConnections && (
          <div ref={loadMoreRef} className="h-6" />
        )}
      </div>
    </div>
  );
}
