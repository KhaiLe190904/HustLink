import { useEffect, useRef, useState } from "react";
import {
  FaFilePdf,
  FaFileAlt,
  FaDownload,
  FaExternalLinkAlt,
} from "react-icons/fa";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IMessage } from "@/features/messaging/components/Messages/Messages";
import { formatTimestamp } from "@/features/feed/utils/date";
import {
  downloadPrivateObject,
  fetchPrivateDownloadUrl,
  isPdfFile,
  resolveMediaUrl,
} from "@/utils/storage";

interface IMessageProps {
  message: IMessage;
  user: IUser | null;
  showDeliveryStatus?: boolean;
}

export function Message({
  message,
  user,
  showDeliveryStatus = false,
}: IMessageProps) {
  const messageRef = useRef<HTMLDivElement>(null);
  const [showTimestamp, setShowTimestamp] = useState(false);
  const [openingAttachment, setOpeningAttachment] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!message.isRead && user?.id === message.receiver.id) {
      request<void>({
        endpoint: `/api/v1/messaging/conversations/messages/${message.id}`,
        method: "PUT",
        onSuccess: () => {},
        onFailure: (error) => console.log(error),
      });
    }
  }, [message.id, message.isRead, message.receiver.id, user?.id]);

  useEffect(() => {
    messageRef.current?.scrollIntoView();
  }, []);

  useEffect(() => {
    if (
      !message.attachmentObjectId ||
      attachmentUrl ||
      (message.attachmentKind !== "IMAGE" && message.attachmentKind !== "VIDEO")
    ) {
      return;
    }

    fetchPrivateDownloadUrl(message.attachmentObjectId)
      .then(setAttachmentUrl)
      .catch((error) => console.log(error));
  }, [attachmentUrl, message.attachmentObjectId]);

  const isMyMessage = message.sender.id === user?.id;
  const otherUser = isMyMessage ? message.receiver : message.sender;

  const getAttachmentMeta = () => {
    if (isPdfFile(message.attachmentFileName, message.attachmentContentType)) {
      return {
        label: "PDF attachment",
        icon: <FaFilePdf className="h-5 w-5" />,
      };
    }
    return {
      label: "File attachment",
      icon: <FaFileAlt className="h-5 w-5" />,
    };
  };

  const attachmentMeta = getAttachmentMeta();
  const isPdfAttachment = isPdfFile(
    message.attachmentFileName,
    message.attachmentContentType
  );

  const openAttachment = async () => {
    try {
      setOpeningAttachment(true);
      const url =
        attachmentUrl ??
        (message.attachmentObjectId
          ? await fetchPrivateDownloadUrl(message.attachmentObjectId)
          : null);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } finally {
      setOpeningAttachment(false);
    }
  };

  const downloadAttachment = async () => {
    try {
      setOpeningAttachment(true);
      if (!message.attachmentObjectId) {
        return;
      }
      await downloadPrivateObject(
        message.attachmentObjectId,
        message.attachmentFileName || "attachment"
      );
    } finally {
      setOpeningAttachment(false);
    }
  };

  return (
    <div
      ref={messageRef}
      className={`flex gap-2 items-start w-full relative group ${
        isMyMessage ? "flex-row-reverse" : "flex-row"
      }`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      {/* Avatar */}
      <img
        className="w-8 h-8 my-1 rounded-full object-cover flex-shrink-0"
        src={resolveMediaUrl(otherUser.profilePicture) || "/doc1.png"}
        alt={`${otherUser.firstName} ${otherUser.lastName}`}
      />

      {/* Message bubble and status */}
      <div
        className={`flex flex-col ${
          isMyMessage ? "items-end" : "items-start"
        } max-w-[70%] min-w-0 relative`}
      >
        {/* Timestamp on hover */}
        {showTimestamp && (
          <div
            className={`absolute top-0 ${
              isMyMessage ? "right-full mr-2" : "left-full ml-2"
            } text-xs text-gray-700 bg-gray-200 px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none z-10 shadow-sm`}
          >
            {formatTimestamp(new Date(message.creationAt))}
          </div>
        )}

        <div
          className={`px-4 py-2 ${
            isMyMessage
              ? "bg-[var(--primary-color)] text-white rounded-2xl rounded-br-sm"
              : "bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm"
          }`}
          style={{
            wordWrap: "break-word",
            overflowWrap: "break-word",
            wordBreak: "break-word",
          }}
        >
          <div
            style={{
              wordWrap: "break-word",
              overflowWrap: "break-word",
              wordBreak: "break-word",
            }}
          >
            {message.content}
          </div>
          {message.attachmentObjectId && message.attachmentKind === "IMAGE" ? (
            <button
              type="button"
              className="mt-3 block w-full overflow-hidden rounded-xl"
              onClick={openAttachment}
            >
              {attachmentUrl ? (
                <img
                  src={attachmentUrl}
                  alt={message.attachmentFileName || "Image attachment"}
                  className="max-h-72 w-full rounded-xl object-cover"
                />
              ) : (
                <div
                  className={`rounded-xl border px-3 py-6 text-center text-sm ${
                    isMyMessage
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  Loading image...
                </div>
              )}
            </button>
          ) : message.attachmentObjectId &&
            message.attachmentKind === "VIDEO" ? (
            <div className="mt-3 overflow-hidden rounded-xl">
              {attachmentUrl ? (
                <video
                  src={attachmentUrl}
                  controls
                  playsInline
                  className="max-h-80 w-full rounded-xl bg-black"
                />
              ) : (
                <div
                  className={`rounded-xl border px-3 py-6 text-center text-sm ${
                    isMyMessage
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  Loading video...
                </div>
              )}
            </div>
          ) : message.attachmentObjectId ? (
            <div
              className={`mt-3 rounded-xl border px-3 py-3 text-left text-sm ${
                isMyMessage
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full ${
                    isMyMessage
                      ? "bg-white/15 text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {attachmentMeta.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{attachmentMeta.label}</div>
                  <div className="mt-1 truncate text-xs opacity-80">
                    {message.attachmentFileName || "Attachment"}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {isPdfAttachment ? (
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                      isMyMessage
                        ? "bg-white text-[var(--primary-color)]"
                        : "bg-gray-900 text-white"
                    }`}
                    onClick={openAttachment}
                  >
                    <FaExternalLinkAlt className="h-3 w-3" />
                    <span>{openingAttachment ? "Opening..." : "Open"}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
                    isMyMessage
                      ? "border-white/30 text-white"
                      : "border-gray-300 text-gray-700"
                  }`}
                  onClick={downloadAttachment}
                >
                  <FaDownload className="h-3 w-3" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Status for my messages */}
        {isMyMessage && showDeliveryStatus && (
          <div className="flex items-center gap-2 mt-1 justify-end w-full">
            {message.isRead ? (
              <div className="flex items-center gap-2">
                <img
                  className="w-4 h-4 rounded-full object-cover"
                  src={
                    resolveMediaUrl(message.receiver.profilePicture) ||
                    "/doc1.png"
                  }
                  alt={`${message.receiver.firstName} ${message.receiver.lastName}`}
                />
                <span className="text-xs text-gray-400">Seen</span>
              </div>
            ) : (
              <span className="text-xs text-gray-400">Sent</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
