import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/Input/Input";
import {
  useAuthentication,
  IUser,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { formatTimestamp } from "@/features/feed/utils/date";

export interface IComment {
  id: number;
  content: string;
  author: IUser;
  creationDate: string;
  updatedDate?: string;
}

interface CommentProps {
  comment: IComment;
  deleteComment: (commentId: number) => Promise<void>;
  editComment: (commentId: number, content: string) => Promise<void>;
}

export function Comment({ comment, deleteComment, editComment }: CommentProps) {
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing] = useState(false);
  const [commentContent, setCommentContent] = useState(comment.content);
  const { user } = useAuthentication();

  return (
    <div
      key={comment.id}
      className="relative last:mb-0 last:pb-0 last:border-b-0 mb-3 pb-3 border-b border-gray-200"
    >
      {!editing ? (
        <>
          <div className="flex gap-2 items-start">
            <button
              onClick={() => {
                navigate(`/profile/${comment.author.id}`);
              }}
              className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <img
                className="w-8 h-8 my-1 rounded-full object-cover"
                src={comment.author.profilePicture || "/doc1.png"}
                alt=""
              />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1 relative">
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => {
                      navigate(`/profile/${comment.author.id}`);
                    }}
                    className="text-left hover:underline"
                  >
                    <div className="font-semibold text-sm text-gray-900">
                      {comment.author.firstName + " " + comment.author.lastName}
                    </div>
                  </button>
                  <div className="text-xs font-mono text-gray-600 line-clamp-1">
                    {comment.author.position + " at " + comment.author.company}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Timestamp */}
                  <div className="text-xs text-gray-500 whitespace-nowrap">
                    {formatTimestamp(new Date(comment.creationDate))}
                  </div>
                  {comment.author.id == user?.id && (
                    <div className="relative">
                      <button
                        className={`w-6 h-6 rounded-full grid place-items-center transition-all duration-300 cursor-pointer ${
                          showActions ? "bg-gray-200" : "hover:bg-gray-100"
                        }`}
                        onClick={() => setShowActions(!showActions)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 128 512"
                          className="w-3 h-3 text-gray-600"
                        >
                          <path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z" />
                        </svg>
                      </button>
                      {showActions && (
                        <div className="absolute right-0 top-8 z-10 flex flex-col items-start bg-white rounded-lg shadow-lg border border-gray-200 p-1 text-xs min-w-[80px]">
                          <button
                            onClick={() => setEditing(true)}
                            className="w-full text-left cursor-pointer hover:bg-gray-100 px-3 py-1.5 rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className="w-full text-left cursor-pointer hover:bg-gray-100 px-3 py-1.5 rounded transition-colors text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-sm text-black mb-1 whitespace-pre-wrap break-words">
                {comment.content}
              </div>
              {/* Space reserved for reply button */}
            </div>
          </div>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await editComment(comment.id, commentContent);
            setEditing(false);
            setShowActions(false);
          }}
        >
          <Input
            label="Edit your comment"
            type="text"
            value={commentContent}
            onChange={(e) => {
              setCommentContent(e.target.value);
            }}
            placeholder="Edit your comment"
            size="small"
          />
        </form>
      )}
    </div>
  );
}

export default Comment;
