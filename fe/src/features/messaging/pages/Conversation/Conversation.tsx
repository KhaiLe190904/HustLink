import { FormEvent, useEffect, useState } from "react";
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
import { Messages } from "@/features/messaging/components/Messages/Messages";
import { IoSend } from "react-icons/io5";
export function Conversation() {
  const [postingMessage, setPostingMessage] = useState<boolean>(false);
  const [content, setContent] = useState<string>("");
  const [suggestingUsers, setSuggestingUsers] = useState<IUser[]>([]);
  const [search, setSearch] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<IUser | null>(null);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [conversation, setConversation] = useState<IConversation | null>(null);
  const [conversations, setConversations] = useState<IConversation[]>([]);
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
        onSuccess: (data) => setConversation(data),
        onFailure: () => navigate("/messaging"),
      });
    }
  }, [id, navigate]);

  useEffect(() => {
    const subscription = websocketClient?.subscribe(
      `/topic/conversations/${conversation?.id}/messages`,
      (data) => {
        const message = JSON.parse(data.body);

        setConversation((prevConversation) => {
          if (!prevConversation) return null;
          const index = prevConversation.messages.findIndex(
            (m) => m.id === message.id
          );
          if (index === -1) {
            return {
              ...prevConversation,
              messages: [...prevConversation.messages, message],
            };
          }
          return {
            ...prevConversation,
            messages: prevConversation?.messages.map((m) =>
              m.id === message.id ? message : m
            ),
          };
        });
      }
    );
    return () => subscription?.unsubscribe();
  }, [conversation?.id, websocketClient]);

  async function addMessageToConversation(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!content.trim()) return;
    setPostingMessage(true);
    await request<void>({
      endpoint: `/api/v1/messaging/conversations/${conversation?.id}/messages`,
      method: "POST",
      body: JSON.stringify({
        receiverId:
          conversation?.recipient.id == user?.id
            ? conversation?.author.id
            : conversation?.recipient.id,
        content,
      }),
      onSuccess: () => {},
      onFailure: (error) => console.log(error),
    });
    setPostingMessage(false);
  }

  async function createConversationWithMessage(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    if (!content.trim()) return;

    const message = {
      receiverId: selectedUser?.id,
      content,
    };
    await request<IConversation>({
      endpoint: "/api/v1/messaging/conversations",
      method: "POST",
      body: JSON.stringify(message),
      onSuccess: (conversation) =>
        navigate(`/messaging/conversations/${conversation.id}`),
      onFailure: (error) => console.log(error),
    });
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
                  src={conversationUserToDisplay?.profilePicture || "/doc1.png"}
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
                              src={user.profilePicture || "/doc1.png"}
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
                    src={selectedUser.profilePicture || "/doc1.png"}
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
            <Messages messages={conversation.messages} user={user} />
          )}
          <form
            className="px-4 py-3 bg-white border-t border-gray-200"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!content.trim()) return;
              if (conversation) {
                await addMessageToConversation(e);
              } else {
                await createConversationWithMessage(e);
              }
              setContent("");
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
              <button
                type="submit"
                className="w-10 h-10 rounded-full bg-[var(--primary-color)] flex items-center justify-center text-white hover:bg-[var(--primary-color)]/90 active:scale-95 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300 disabled:active:scale-100 flex-shrink-0 mb-0.5"
                disabled={
                  postingMessage ||
                  !content.trim() ||
                  (creatingNewConversation && !selectedUser)
                }
              >
                <IoSend className="w-5 h-5" />
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
