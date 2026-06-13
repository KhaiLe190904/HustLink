import { useEffect, useState, useRef } from "react";
import { request } from "@/utils/api";
import { FiSearch, FiX, FiSend, FiCheck } from "react-icons/fi";
import { toast } from "react-toastify";
import { resolveMediaUrl } from "@/utils/storage";
import {
  IUser,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { IConversation } from "@/features/messaging/components/Conversations/Conversations";
import { IConnection } from "@/features/networking/components/Connection/Connection";

interface SharePostModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  postId: number;
}

export function SharePostModal({
  showModal,
  setShowModal,
  postId,
}: SharePostModalProps) {
  const { user } = useAuthentication();
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<IConversation[]>([]);

  // Connections Pagination State
  const [connections, setConnections] = useState<IConnection[]>([]);
  const [connectionsPage, setConnectionsPage] = useState(0);
  const [hasMoreConnections, setHasMoreConnections] = useState(true);
  const [loadingConnections, setLoadingConnections] = useState(false);

  const [sharedTargets, setSharedTargets] = useState<Record<string, boolean>>(
    {}
  );
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [sharing, setSharing] = useState(false);

  const isInitialMount = useRef(true);

  const loadConnections = async (
    pageToLoad: number,
    reset: boolean = false
  ) => {
    if (loadingConnections) return;
    setLoadingConnections(true);

    const params = new URLSearchParams();
    params.append("status", "ACCEPTED");
    params.append("page", String(pageToLoad));
    params.append("size", "6");
    if (searchQuery.trim()) {
      params.append("query", searchQuery.trim());
    }

    await request<any>({
      endpoint: `/api/v1/networking/connections/paginated?${params.toString()}`,
      onSuccess: (data) => {
        const newConnections = data.content || [];
        if (reset) {
          setConnections(newConnections);
          setConnectionsPage(1);
        } else {
          setConnections((prev) => [...prev, ...newConnections]);
          setConnectionsPage(pageToLoad + 1);
        }
        setHasMoreConnections(!data.last);
        setLoadingConnections(false);
      },
      onFailure: (err) => {
        console.error(err);
        setLoadingConnections(false);
      },
    });
  };

  // Fetch conversations once on open
  useEffect(() => {
    if (!showModal) return;

    const loadConversations = async () => {
      setLoadingConversations(true);
      await request<IConversation[]>({
        endpoint: "/api/v1/messaging/conversations",
        onSuccess: (data) => setConversations(data),
        onFailure: (err) => console.error(err),
      });
      setLoadingConversations(false);
    };

    loadConversations();
    setSharedTargets({});
  }, [showModal]);

  // Debounced search for connections from backend
  useEffect(() => {
    if (!showModal) return;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadConnections(0, true);
      return;
    }

    const delayDebounce = setTimeout(() => {
      loadConnections(0, true);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, showModal]);

  // Reset initial mount ref when modal closes
  useEffect(() => {
    if (!showModal) {
      isInitialMount.current = true;
      setConnections([]);
      setConnectionsPage(0);
      setHasMoreConnections(true);
      setSearchQuery("");
      setSharing(false);
    }
  }, [showModal]);

  const handleShareToConversation = async (conversation: IConversation) => {
    if (sharing) return;
    setSharing(true);
    const targetUserId =
      conversation.recipient.id === user?.id
        ? conversation.author.id
        : conversation.recipient.id;

    await request({
      endpoint: `/api/v1/messaging/conversations/${conversation.id}/messages`,
      method: "POST",
      body: JSON.stringify({
        receiverId: targetUserId,
        content: "Shared a post.",
        sharedPostId: postId,
      }),
      onSuccess: () => {
        toast.success("Post shared successfully!");
        setSharedTargets((prev) => ({ ...prev, [conversation.id]: true }));
      },
      onFailure: (err) => toast.error(err || "Failed to share post"),
    });
    setSharing(false);
  };

  const handleShareToConnection = async (connection: IConnection) => {
    if (sharing) return;
    setSharing(true);
    const targetUser =
      connection.author.id === user?.id
        ? connection.recipient
        : connection.author;

    // Create a new conversation and send the post
    await request<IConversation>({
      endpoint: "/api/v1/messaging/conversations",
      method: "POST",
      body: JSON.stringify({
        receiverId: targetUser.id,
        content: "Shared a post.",
        sharedPostId: postId,
      }),
      onSuccess: (newConv) => {
        toast.success("Post shared successfully!");
        setSharedTargets((prev) => ({
          ...prev,
          [`conn-${connection.id}`]: true,
        }));
        // Add to conversations so they don't see it as connection anymore in list
        setConversations((prev) => [newConv, ...prev]);
      },
      onFailure: (err) => toast.error(err || "Failed to share post"),
    });
    setSharing(false);
  };

  if (!showModal) return null;

  // Find users who already have active conversations with us
  const existingConversationUserIds = new Set(
    conversations.map((c) =>
      c.recipient.id === user?.id ? c.author.id : c.recipient.id
    )
  );

  // Filter connections who do NOT have an active conversation
  const eligibleConnections = connections.filter((conn) => {
    const targetUser =
      conn.author.id === user?.id ? conn.recipient : conn.author;
    return !existingConversationUserIds.has(targetUser.id);
  });

  const matchesSearch = (u: IUser) => {
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    return (
      fullName.includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0">
          <h3 className="text-lg font-bold text-slate-900">Share Post</h3>
          <button
            onClick={() => setShowModal(false)}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition cursor-pointer"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-4 shrink-0">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 py-2.5 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-red-500"
          />
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
          {loadingConversations && connections.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
            </div>
          ) : (
            <>
              {/* Active Conversations Section */}
              {conversations
                .filter((c) => {
                  const other =
                    c.recipient.id === user?.id ? c.author : c.recipient;
                  return matchesSearch(other);
                })
                .map((conv) => {
                  const otherUser =
                    conv.recipient.id === user?.id
                      ? conv.author
                      : conv.recipient;
                  const alreadyShared = !!sharedTargets[conv.id];

                  return (
                    <div
                      key={conv.id}
                      className="flex items-center justify-between gap-3 p-2 hover:bg-slate-50 rounded-2xl transition"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            resolveMediaUrl(otherUser.profilePicture) ||
                            "/doc1.png"
                          }
                          alt=""
                          className="w-10 h-10 rounded-full object-cover border border-slate-100"
                        />
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">
                            {otherUser.firstName} {otherUser.lastName}
                          </h4>
                          <p className="text-xs text-slate-400 font-semibold line-clamp-1">
                            {otherUser.position || "Member"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={alreadyShared || sharing}
                        onClick={() => handleShareToConversation(conv)}
                        className={`flex h-9 px-4 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
                          alreadyShared
                            ? "bg-slate-100 text-slate-400 border border-slate-150 cursor-default"
                            : sharing
                              ? "bg-slate-100 text-slate-400 border border-slate-150 cursor-not-allowed"
                              : "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200"
                        }`}
                      >
                        {alreadyShared ? (
                          <>
                            <FiCheck className="h-4 w-4" /> Sent
                          </>
                        ) : (
                          <>
                            <FiSend className="h-3.5 w-3.5" /> Send
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}

              {/* Connections (No active conversation yet) Section */}
              {eligibleConnections.map((conn) => {
                const otherUser =
                  conn.author.id === user?.id ? conn.recipient : conn.author;
                const targetKey = `conn-${conn.id}`;
                const alreadyShared = !!sharedTargets[targetKey];

                return (
                  <div
                    key={conn.id}
                    className="flex items-center justify-between gap-3 p-2 hover:bg-slate-50 rounded-2xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          resolveMediaUrl(otherUser.profilePicture) ||
                          "/doc1.png"
                        }
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-slate-100"
                      />
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          {otherUser.firstName} {otherUser.lastName}
                        </h4>
                        <p className="text-xs text-slate-400 font-semibold line-clamp-1">
                          {otherUser.position || "Member"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={alreadyShared || sharing}
                      onClick={() => handleShareToConnection(conn)}
                      className={`flex h-9 px-4 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer ${
                        alreadyShared
                          ? "bg-slate-100 text-slate-400 border border-slate-150 cursor-default"
                          : sharing
                            ? "bg-slate-100 text-slate-400 border border-slate-150 cursor-not-allowed"
                            : "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200"
                      }`}
                    >
                      {alreadyShared ? (
                        <>
                          <FiCheck className="h-4 w-4" /> Sent
                        </>
                      ) : (
                        <>
                          <FiSend className="h-3.5 w-3.5" /> Send
                        </>
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Load More Button */}
              {hasMoreConnections && (
                <button
                  type="button"
                  disabled={loadingConnections}
                  onClick={() => loadConnections(connectionsPage)}
                  className="w-full text-center py-2 text-xs font-bold text-blue-600 hover:text-blue-800 transition disabled:opacity-50 cursor-pointer"
                >
                  {loadingConnections
                    ? "Loading friends..."
                    : "Load more friends"}
                </button>
              )}

              {conversations.length === 0 &&
                eligibleConnections.length === 0 &&
                !loadingConnections && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    You need connections to share posts.
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
