import { Dispatch, FormEvent, SetStateAction, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IoSend } from "react-icons/io5";
import { Input } from "@/components/Input/Input";
import { Comment, IComment } from "@/features/feed/components/Comment/Comment";
import { IPost } from "@/features/feed/components/Post/Post";
import { TimeAgo } from "@/features/feed/components/TimeAgo/TimeAgo";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";

interface CommentModalProps {
  showModal: boolean;
  setShowModal: Dispatch<SetStateAction<boolean>>;
  post: IPost;
  comments: IComment[];
  likes: IUser[];
  content: string;
  setContent: Dispatch<SetStateAction<string>>;
  onSubmitComment: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  deleteComment: (id: number) => Promise<void>;
  editComment: (id: number, content: string) => Promise<void>;
  loadMoreComments?: () => Promise<void>;
  hasMoreComments?: boolean;
  loadingComments?: boolean;
  commentsCount: number;
}

export function CommentModal({
  showModal,
  setShowModal,
  post,
  comments,
  likes,
  content,
  setContent,
  onSubmitComment,
  deleteComment,
  editComment,
  loadMoreComments,
  hasMoreComments,
  loadingComments,
  commentsCount,
}: CommentModalProps) {
  const navigate = useNavigate();
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showModal && commentsContainerRef.current) {
      setTimeout(() => {
        commentsContainerRef.current!.scrollTop = 0; // Scroll to newest
      }, 100);
    }
  }, [showModal]);

  if (!showModal) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowModal(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 flex justify-center items-center z-[9999] p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] shadow-2xl animate-[slideUp_0.3s_ease-out] flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side - Post Content */}
        <div className="lg:w-1/2 flex flex-col border-r border-gray-200 bg-gray-50">
          {/* Header - Mobile only */}
          <div className="flex lg:hidden justify-between items-center p-4 border-b border-gray-200 bg-white">
            <h3 className="font-bold text-lg text-gray-900">
              {post.author.firstName}'s post
            </h3>
            <button
              onClick={() => setShowModal(false)}
              className="bg-gray-100 w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Post Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <button
                className="flex gap-3 items-center mb-3 hover:bg-white/50 p-2 rounded-lg transition-colors w-full text-left"
                onClick={() => {
                  navigate(`/profile/${post.author.id}`);
                  setShowModal(false);
                }}
              >
                <img
                  className="w-10 h-10 rounded-full object-cover"
                  src={post.author.profilePicture || "/doc1.png"}
                  alt={post.author.firstName}
                />
                <div>
                  <div className="font-semibold text-gray-900 text-sm">
                    {post.author.firstName + " " + post.author.lastName}
                  </div>
                  <div className="text-xs text-gray-600">
                    {post.author.position} at {post.author.company}
                  </div>
                  <TimeAgo
                    date={post.creationDate}
                    edited={!!post.updateDate}
                    className="text-xs"
                  />
                </div>
              </button>
              <p className="text-gray-800 whitespace-pre-wrap mb-4">
                {post.content}
              </p>
            </div>

            {/* Post Image */}
            {post.picture && (
              <div className="bg-black flex items-center justify-center">
                <img
                  src={post.picture}
                  alt=""
                  className="w-full h-auto object-contain max-h-[60vh]"
                />
              </div>
            )}

            {/* Likes count */}
            {likes.length > 0 && (
              <div className="p-4">
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{likes.length}</span>{" "}
                  {likes.length === 1 ? "person likes" : "people like"} this
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Comments Section */}
        <div className="lg:w-1/2 flex flex-col bg-white">
          {/* Header - Desktop only */}
          <div className="hidden lg:flex justify-between items-center p-4 border-b border-gray-200">
            <h3 className="font-bold text-lg text-gray-900">
              Comments ({commentsCount})
            </h3>
            <button
              onClick={() => setShowModal(false)}
              className="bg-gray-100 w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Comment Input - Fixed at top */}
          <div className="border-b border-gray-200 p-2 bg-white">
            <form
              onSubmit={onSubmitComment}
              className="flex gap-2 items-center"
            >
              <div className="flex-1 bg-gray-100 rounded-lg">
                <Input
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write a comment..."
                  className="!mb-0"
                  wrapperClassName="!mb-0 !mt-0"
                  size="small"
                />
              </div>
              <button
                type="submit"
                disabled={!content.trim()}
                className="flex-shrink-0 bg-blue-600 text-white w-10 h-10 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center"
                title="Post comment"
              >
                <IoSend className="w-5 h-5" />
              </button>
            </form>
          </div>

          {/* Comments List - Scrollable */}
          <div
            ref={commentsContainerRef}
            className="flex-1 overflow-y-auto p-4"
            onScroll={(e) => {
              const target = e.currentTarget;
              // Load older comments within 200px from bottom
              if (
                target.scrollHeight - target.scrollTop - target.clientHeight <
                  200 &&
                hasMoreComments &&
                !loadingComments &&
                loadMoreComments
              ) {
                loadMoreComments();
              }
            }}
          >
            {comments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg
                  className="w-16 h-16 mx-auto mb-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                <p className="text-sm">No comments yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Be the first to comment!
                </p>
              </div>
            ) : (
              <>
                {loadingComments && (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Loading more comments...
                  </div>
                )}
                {comments.map((comment) => (
                  <Comment
                    key={comment.id}
                    comment={comment}
                    deleteComment={deleteComment}
                    editComment={editComment}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
