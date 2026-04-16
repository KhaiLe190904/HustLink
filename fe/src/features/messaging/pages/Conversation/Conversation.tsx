import { FormEvent, useEffect, useState, useRef } from "react";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";
import { Input } from "@/components/Input/Input";
import { request } from "@/utils/api";
import {
  IUser,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { useWebSocket } from "@/features/websocket/websocket";
import { IConversation } from "@/features/messaging/components/Conversations/Conversations";
import { IConnection } from "@/features/networking/components/Connection/Connection";
import {
  Messages,
  IMessage,
} from "@/features/messaging/components/Messages/Messages";
import { IoSend } from "react-icons/io5";
import { Page } from "@/utils/pagination";
import {
  isOversizedUpload,
  MAX_UPLOAD_SIZE_LABEL,
  resolveMediaUrl,
  uploadToStorage,
} from "@/utils/storage";
export function Conversation() {
  const [postingMessage, setPostingMessage] = useState<boolean>(false);
  const [uploadStage, setUploadStage] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [suggestingUsers, setSuggestingUsers] = useState<IUser[]>([]);
  const [search, setSearch] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [conversation, setConversation] = useState<IConversation | null>(null);
  const [conversations, setConversations] = useState<IConversation[]>([]);
  const [messages, setMessages] = useState<IMessage[]>([]);
  const [messagesPage, setMessagesPage] = useState<number>(0);
  const [hasMoreMessages, setHasMoreMessages] = useState<boolean>(true);
  const [loadingMessages, setLoadingMessages] = useState<boolean>(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const websocketClient = useWebSocket();
  const { id } = useParams();
  const navigate = useNavigate();
  const creatingNewConversation = id === "new";
  const { user } = useAuthentication();

  useEffect(() => {
    request<IConversation[]>({
      endpoint: "/api/v1/messaging/conversations",
      onSuccess: (data) => setConversations(data),
      onFailure: (error) => console.log(error),
    });
  }, []);

  useEffect(() => {
    const subscription = websocketClient?.subscribe(
      `/topic/users/${user?.id}/conversations`,
      (message) => {
        const conversation = JSON.parse(message.body);
        console.log(conversation);
        setConversations((prevConversations) => {
          const index = prevConversations.findIndex(
            (c) => c.id === conversation.id
          );
          if (index === -1) {
            return [conversation, ...prevConversations];
          }
          return prevConversations.map((c) =>
            c.id === conversation.id ? conversation : c
          );
        });
      }
    );
    return () => subscription?.unsubscribe();
  }, [user?.id, websocketClient]);

  useEffect(() => {
    if (id == "new") {
      setConversation(null);
      setMessages([]);
      setMessagesPage(0);
      setHasMoreMessages(true);
      request<IConnection[]>({
        endpoint: "/api/v1/networking/connections",
        onSuccess: (data) =>
          setSuggestingUsers(
            data.map((c) => (c.author.id === user?.id ? c.recipient : c.author))
          ),
        onFailure: (error) => console.log(error),
      });
    } else {
      request<IConversation>({
        endpoint: `/api/v1/messaging/conversations/${id}`,
        onSuccess: (data) => {
          setConversation(data);
          setMessages([]);
          setMessagesPage(0);
          setHasMoreMessages(true);
        },
        onFailure: () => navigate("/messaging"),
      });
    }
  }, [id, navigate, user?.id]);

  // Fetch messages with pagination
  useEffect(() => {
    if (!conversation?.id) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setLoadingMessages(true);
      await request<Page<IMessage>>({
        endpoint: `/api/v1/messaging/conversations/${conversation.id}/messages?page=0&size=20`,
        onSuccess: (data) => {
          // Backend returns newest first (DESC), reverse to get oldest first
          setMessages([...data.content].reverse());
          setHasMoreMessages(!data.last);
          setMessagesPage(0);
        },
        onFailure: (error) => console.log(error),
      });
      setLoadingMessages(false);
    };

    fetchMessages();
  }, [conversation?.id]);

  useEffect(() => {
    const subscription = websocketClient?.subscribe(
      `/topic/conversations/${conversation?.id}/messages`,
      (data) => {
        const message = JSON.parse(data.body);
        setMessages((prev) => {
          const index = prev.findIndex((m) => m.id === message.id);
          if (index === -1) {
            return [...prev, message];
          }
          return prev.map((m) => (m.id === message.id ? message : m));
        });
      }
    );
    return () => subscription?.unsubscribe();
  }, [conversation?.id, websocketClient]);

  const loadMoreMessages = async () => {
    if (!conversation?.id || loadingMessages || !hasMoreMessages) return;

    const nextPage = messagesPage + 1;
    setLoadingMessages(true);
    await request<Page<IMessage>>({
      endpoint: `/api/v1/messaging/conversations/${conversation.id}/messages?page=${nextPage}&size=20`,
      onSuccess: (data) => {
        // Prepend older messages (backend returns newest first, we reverse to get oldest first)
        setMessages((prev) => [...data.content].reverse().concat(prev));
        setHasMoreMessages(!data.last);
        setMessagesPage(nextPage);
      },
      onFailure: (error) => console.log(error),
    });
    setLoadingMessages(false);
  };

  async function addMessageToConversation(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!content.trim() && !attachment) return;
    setPostingMessage(true);
    setUploadStage(
      attachment ? "Uploading attachment..." : "Sending message..."
    );
    let attachmentObjectId: number | undefined;
    let attachmentKind: string | undefined;
    if (attachment) {
      const storedObject = await uploadToStorage({
        file: attachment,
        scope: attachment.type.startsWith("image/")
          ? "MESSAGE_IMAGE"
          : attachment.type.startsWith("video/")
            ? "MESSAGE_VIDEO"
            : "MESSAGE_FILE",
        ownerType: "CONVERSATION",
        ownerId: conversation?.id,
      });
      attachmentObjectId = storedObject.id;
      attachmentKind = attachment.type.startsWith("image/")
        ? "IMAGE"
        : attachment.type.startsWith("video/")
          ? "VIDEO"
          : "FILE";
    }
    setUploadStage("Sending message...");
    await request<void>({
      endpoint: `/api/v1/messaging/conversations/${conversation?.id}/messages`,
      method: "POST",
      body: JSON.stringify({
        receiverId:
          conversation?.recipient.id == user?.id
            ? conversation?.author.id
            : conversation?.recipient.id,
        content,
        attachmentObjectId,
        attachmentKind,
      }),
      onSuccess: () => {},
      onFailure: (error) => console.log(error),
    });
    setPostingMessage(false);
    setUploadStage("");
  }

  async function createConversationWithMessage(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!content.trim() && !attachment) return;
    setPostingMessage(true);
    setUploadStage(
      attachment ? "Uploading attachment..." : "Creating conversation..."
    );
    let attachmentObjectId: number | undefined;
    let attachmentKind: string | undefined;
    if (attachment) {
      const storedObject = await uploadToStorage({
        file: attachment,
        scope: attachment.type.startsWith("image/")
          ? "MESSAGE_IMAGE"
          : attachment.type.startsWith("video/")
            ? "MESSAGE_VIDEO"
            : "MESSAGE_FILE",
        ownerType: "CONVERSATION",
      });
      attachmentObjectId = storedObject.id;
      attachmentKind = attachment.type.startsWith("image/")
        ? "IMAGE"
        : attachment.type.startsWith("video/")
          ? "VIDEO"
          : "FILE";
    }

    const message = {
      receiverId: selectedUser?.id,
      content,
      attachmentObjectId,
      attachmentKind,
    };
    await request<IConversation>({
      endpoint: "/api/v1/messaging/conversations",
      method: "POST",
      body: JSON.stringify(message),
      onSuccess: (conversation) =>
        navigate(`/messaging/conversations/${conversation.id}`),
      onFailure: (error) => console.log(error),
    });
    setPostingMessage(false);
    setUploadStage("");
  }

  const conversationUserToDisplay =
    conversation?.recipient.id === user?.id
      ? conversation?.author
      : conversation?.recipient;
  return (
    <div
      className={`grid h-[calc(100vh-12rem)] lg:h-[calc(100vh-8rem)] ${
        creatingNewConversation
          ? "grid-rows-[1fr_auto] lg:grid-rows-[1fr_auto]"
          : "grid-rows-[auto_auto_1fr_auto] lg:grid-rows-[auto_1fr_auto]"
      }`}
    >
      {(conversation || creatingNewConversation) && (
        <>
          <div className="p-4 border-b border-gray-300 lg:hidden">
            <button
              className="bg-gray-100 w-8 h-8 p-2 rounded-full transition-colors grid items-center justify-center place-items-center hover:bg-gray-200"
              onClick={() => navigate("/messaging")}
            >
              {"<"}
            </button>
          </div>
          {conversation && (
            <div className="p-4 grid items-center grid-cols-[3rem_1fr] gap-2 border-b border-gray-300 rounded-b-lg">
              <button
                onClick={() =>
                  navigate(`/profile/${conversationUserToDisplay?.id}`)
                }
              >
                <img
                  className="w-12 h-12 rounded-full object-cover"
                  src={
                    resolveMediaUrl(
                      conversationUserToDisplay?.profilePicture
                    ) || "/doc1.png"
                  }
                  alt="Profile"
                />
              </button>
              <div>
                <div className="font-bold text-gray-900">
                  {conversationUserToDisplay?.firstName}{" "}
                  {conversationUserToDisplay?.lastName}
                </div>
                <div className="text-gray-600 text-sm">
                  {conversationUserToDisplay?.position} at{" "}
                  {conversationUserToDisplay?.company}
                </div>
              </div>
            </div>
          )}
          {creatingNewConversation && (
            <form
              className="px-4 relative"
              onSubmit={(e) => e.preventDefault()}
            >
              <p style={{ marginTop: "1rem" }}>
                Starting a new conversation {selectedUser && "with:"}
              </p>
              {!selectedUser && (
                <div className="relative">
                  <Input
                    label=""
                    type="text"
                    name="recipient"
                    placeholder="Type a name"
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                    value={search}
                  />
                  {showDropdown && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 max-h-[300px] overflow-y-auto z-50">
                      {suggestingUsers
                        .filter(
                          (user) =>
                            !search ||
                            user.firstName
                              ?.toLowerCase()
                              .includes(search.toLowerCase()) ||
                            user.lastName
                              ?.toLowerCase()
                              .includes(search.toLowerCase())
                        )
                        .map((user) => (
                          <button
                            key={user.id}
                            className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                            onClick={() => {
                              const conversation = conversations.find(
                                (c) =>
                                  c.recipient.id === user.id ||
                                  c.author.id === user.id
                              );
                              if (conversation) {
                                navigate(
                                  `/messaging/conversations/${conversation.id}`
                                );
                              } else {
                                setSelectedUser(user);
                                setSearch("");
                                setShowDropdown(false);
                              }
                            }}
                          >
                            <img
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                              src={
                                resolveMediaUrl(user.profilePicture) ||
                                "/doc1.png"
                              }
                              alt=""
                            />
                            <div className="text-left flex-1">
                              <div className="font-medium text-gray-900">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-gray-600 text-sm">
                                {user.position} at {user.company}
                              </div>
                            </div>
                          </button>
                        ))}
                      {suggestingUsers.filter(
                        (user) =>
                          !search ||
                          user.firstName
                            ?.toLowerCase()
                            .includes(search.toLowerCase()) ||
                          user.lastName
                            ?.toLowerCase()
                            .includes(search.toLowerCase())
                      ).length === 0 && (
                        <div className="p-4 text-gray-500 text-center">
                          {search
                            ? `No users found matching "${search}"`
                            : "No connections available"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedUser && (
                <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <img
                    className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    src={
                      resolveMediaUrl(selectedUser.profilePicture) ||
                      "/doc1.png"
                    }
                    alt=""
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </div>
                    <div className="text-gray-600 text-sm">
                      {selectedUser.position} at {selectedUser.company}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="bg-gray-200 w-8 h-8 rounded-full transition-colors flex items-center justify-center hover:bg-red-500 hover:text-white flex-shrink-0"
                  >
                    X
                  </button>
                </div>
              )}

              {suggestingUsers.length === 0 && (
                <div>You need to have connections to start a conversation.</div>
              )}
            </form>
          )}
          {conversation && (
            <div
              ref={messagesContainerRef}
              className="overflow-y-auto"
              onScroll={(e) => {
                const target = e.currentTarget;
                // Load older messages within 100px from top
                if (
                  target.scrollTop < 100 &&
                  hasMoreMessages &&
                  !loadingMessages
                ) {
                  const currentScrollHeight = target.scrollHeight;
                  loadMoreMessages().then(() => {
                    setTimeout(() => {
                      if (messagesContainerRef.current) {
                        const newScrollHeight =
                          messagesContainerRef.current.scrollHeight;
                        messagesContainerRef.current.scrollTop =
                          newScrollHeight - currentScrollHeight; // Preserve position
                      }
                    }, 0);
                  });
                }
              }}
            >
              <Messages messages={messages} user={user} />
              {loadingMessages && (
                <div className="p-4 text-center text-gray-500">
                  Loading more messages...
                </div>
              )}
            </div>
          )}
          <form
            className="px-4 py-3 bg-white border-t border-gray-200"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!content.trim() && !attachment) return;
              if (conversation) {
                await addMessageToConversation(e);
              } else {
                await createConversationWithMessage(e);
              }
              setContent("");
              setAttachment(null);
              if (attachmentInputRef.current) {
                attachmentInputRef.current.value = "";
              }
              setSelectedUser(null);
            }}
          >
            <div className="flex items-end gap-2">
              <textarea
                onChange={(e) => setContent(e.target.value)}
                value={content}
                name="content"
                rows={1}
                className="flex-1 pl-4 pr-4 py-3 border border-gray-300 rounded-3xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent bg-gray-50 hover:bg-white transition-colors resize-none overflow-y-auto min-h-[48px] max-h-32 hide-scrollbar"
                placeholder="Write a message..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const form = e.currentTarget.form;
                    if (form && content.trim()) {
                      form.requestSubmit();
                    }
                  }
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  const scrollHeight = target.scrollHeight;
                  const maxHeight = 128; // max-h-32 = 8rem = 128px

                  const computedStyle = window.getComputedStyle(target);
                  const lineHeight = parseFloat(computedStyle.lineHeight) || 24;
                  const paddingTop = parseFloat(computedStyle.paddingTop) || 12;
                  const paddingBottom =
                    parseFloat(computedStyle.paddingBottom) || 12;
                  const totalPadding = paddingTop + paddingBottom;

                  const contentHeight = scrollHeight - totalPadding;
                  const sixLinesHeight = 6 * lineHeight;

                  if (scrollHeight <= maxHeight) {
                    target.style.height = `${scrollHeight}px`;
                  } else {
                    target.style.height = `${maxHeight}px`;
                  }

                  // Show scrollbar only when content exceeds 6 lines
                  if (contentHeight > sixLinesHeight) {
                    target.classList.remove("hide-scrollbar");
                    target.classList.add("styled-scrollbar");
                  } else {
                    target.classList.add("hide-scrollbar");
                    target.classList.remove("styled-scrollbar");
                  }
                }}
              />
              <label className="mb-0.5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 transition hover:bg-gray-50">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,.pdf,.doc,.docx,.zip,.txt"
                  onChange={(e) => {
                    const nextAttachment = e.target.files?.[0] ?? null;
                    if (nextAttachment && isOversizedUpload(nextAttachment)) {
                      toast.error(
                        `${nextAttachment.name} exceeds the ${MAX_UPLOAD_SIZE_LABEL} upload limit.`
                      );
                      e.currentTarget.value = "";
                      setAttachment(null);
                      return;
                    }
                    setAttachment(nextAttachment);
                  }}
                />
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14m-7-7h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </label>
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-[var(--primary-color)] flex items-center justify-center text-white hover:bg-[var(--primary-color)]/90 active:scale-95 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 disabled:active:scale-100 flex-shrink-0 mb-0.5"
                disabled={
                  postingMessage ||
                  (!content.trim() && !attachment) ||
                  (creatingNewConversation && !selectedUser)
                }
              >
                <IoSend className="w-5 h-5" />
              </button>
            </div>
            {attachment ? (
              <div className="mt-2 text-xs text-gray-500">
                Attached: {attachment.name}
                <button
                  type="button"
                  className="ml-2 text-red-600 hover:underline"
                  onClick={() => setAttachment(null)}
                >
                  Remove
                </button>
              </div>
            ) : null}
            {postingMessage && uploadStage ? (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{uploadStage}</span>
                  <span>Please wait</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--primary-color)]" />
                </div>
              </div>
            ) : null}
          </form>
        </>
      )}
    </div>
  );
}
