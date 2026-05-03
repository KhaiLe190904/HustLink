import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { IoSend } from "react-icons/io5";
import { AiFillLike, AiOutlineLike } from "react-icons/ai";
import { FaRegComment } from "react-icons/fa";
import { Input } from "@/components/Input/Input";
import { Comment, IComment } from "@/features/feed/components/Comment/Comment";
import { IPost } from "@/features/feed/components/Post/Post";
import { TimeAgo } from "@/features/feed/components/TimeAgo/TimeAgo";
import { isVideoFile, resolveMediaUrl } from "@/utils/storage";
import { ARTICLE_CONTENT_PREFIX } from "@/features/feed/components/Modal/Modal";

interface CommentModalProps {
  showModal: boolean;
  setShowModal: Dispatch<SetStateAction<boolean>>;
  post: IPost;
  comments: IComment[];
  content: string;
  setContent: Dispatch<SetStateAction<string>>;
  onSubmitComment: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  deleteComment: (id: number) => Promise<void>;
  editComment: (id: number, content: string) => Promise<void>;
  loadMoreComments?: () => Promise<void>;
  hasMoreComments?: boolean;
  loadingComments?: boolean;
  commentsCount: number;
  likesCount: number;
  likedByCurrentUser: boolean;
  onLike: () => Promise<void>;
  likeDisabled?: boolean;
}

interface ParsedArticleContent {
  title: string;
  summary: string;
  contentHtml: string;
  tags: string[];
}

function normalizeArticleHtml(contentHtml: string) {
  let normalized = contentHtml;

  normalized = normalized.replace(/<p>\s*##\s*(.*?)\s*<\/p>/gi, "<h2>$1</h2>");
  normalized = normalized.replace(/<p>\s*-\s*(.*?)\s*<\/p>/gi, "<li>$1</li>");
  normalized = normalized.replace(/(<li>.*?<\/li>)/gis, "<ul>$1</ul>");
  normalized = normalized.replace(/<\/ul>\s*<ul>/gi, "");
  normalized = normalized.replace(/<p>\s*<\/p>/gi, "");

  return normalized;
}

function parseArticleContent(content: string): ParsedArticleContent | null {
  if (!content.startsWith(ARTICLE_CONTENT_PREFIX)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      content.slice(ARTICLE_CONTENT_PREFIX.length)
    ) as Partial<ParsedArticleContent>;

    if (
      typeof parsed.title !== "string" ||
      typeof parsed.summary !== "string" ||
      typeof parsed.contentHtml !== "string" ||
      !Array.isArray(parsed.tags)
    ) {
      return null;
    }

    return {
      title: parsed.title,
      summary: parsed.summary,
      contentHtml: normalizeArticleHtml(parsed.contentHtml),
      tags: parsed.tags.filter((tag) => typeof tag === "string"),
    };
  } catch {
    return null;
  }
}

export function CommentModal({
  showModal,
  setShowModal,
  post,
  comments,
  content,
  setContent,
  onSubmitComment,
  deleteComment,
  editComment,
  loadMoreComments,
  hasMoreComments,
  loadingComments,
  commentsCount,
  likesCount,
  likedByCurrentUser,
  onLike,
  likeDisabled,
}: CommentModalProps) {
  const article = parseArticleContent(post.content);
  const isArticle = !!article;
  const [articleExpanded, setArticleExpanded] = useState(false);
  const navigate = useNavigate();
  const commentsContainerRef = useRef<HTMLDivElement>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const postMediaUrls =
    post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : post.picture
        ? [post.picture]
        : [];

  useEffect(() => {
    setCurrentMediaIndex(0);
  }, [post.id, post.picture, post.mediaUrls, showModal]);

  useEffect(() => {
    setArticleExpanded(false);
  }, [post.id, showModal]);

  useEffect(() => {
    if (showModal && commentsContainerRef.current) {
      setTimeout(() => {
        commentsContainerRef.current!.scrollTop = 0; // Scroll to newest
      }, 100);
    }
  }, [showModal]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
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
      <div className="bg-white rounded-2xl w-full max-w-[95vw] h-[94vh] shadow-2xl animate-[slideUp_0.3s_ease-out] flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side - Post Content */}
        <div className="lg:w-[62%] flex flex-col border-r border-gray-200 bg-gray-50 max-h-[45vh] lg:max-h-full">
          {/* Header - Mobile only */}
          <div className="flex lg:hidden justify-between items-center p-4 border-b border-gray-200 bg-white flex-shrink-0">
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
          <div className="flex flex-1 flex-col min-h-0">
            <div className="p-4 flex-shrink-0">
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
              {isArticle && article ? (
                <div className="mb-4">
                  <h2 className="text-3xl font-bold text-slate-900">
                    {article.title}
                  </h2>
                  {article.summary ? (
                    <p className="mt-1 text-slate-600">{article.summary}</p>
                  ) : null}
                  {article.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {article.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"
                        >
                          #{tag.replace(/^#/, "")}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {articleExpanded ? (
                    <div className="mt-4 border-t border-slate-700">
                      <div
                        className="overflow-hidden text-slate-700 [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_p]:mt-2 [&_p]:leading-7 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1"
                        dangerouslySetInnerHTML={{
                          __html: article.contentHtml,
                        }}
                      />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setArticleExpanded((prev) => !prev)}
                    className="mt-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                  >
                    {articleExpanded ? "Show less" : "Show more"}
                  </button>
                </div>
              ) : (
                <p className="mb-4 whitespace-pre-wrap text-gray-800">
                  {post.content}
                </p>
              )}
            </div>

            {/* Post Media */}
            {postMediaUrls.length > 0 && (
              <div className="relative flex flex-1 min-h-0 items-center justify-center bg-white">
                {isVideoFile(postMediaUrls[currentMediaIndex]) ? (
                  <video
                    src={resolveMediaUrl(postMediaUrls[currentMediaIndex])}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-full max-w-full bg-white object-contain"
                  />
                ) : (
                  <img
                    src={resolveMediaUrl(postMediaUrls[currentMediaIndex])}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                  />
                )}
                {postMediaUrls.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentMediaIndex((prev) =>
                          prev === 0 ? postMediaUrls.length - 1 : prev - 1
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white transition hover:bg-black/80"
                    >
                      {"<"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentMediaIndex((prev) =>
                          prev === postMediaUrls.length - 1 ? 0 : prev + 1
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 px-3 py-2 text-white transition hover:bg-black/80"
                    >
                      {">"}
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
                      {currentMediaIndex + 1}/{postMediaUrls.length}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Comments Section */}
        <div className="lg:w-[38%] flex flex-col bg-white flex-1 lg:flex-none min-h-0">
          {/* Header - Desktop only */}
          <div className="hidden lg:flex justify-between items-center p-4 border-b border-gray-200 flex-shrink-0">
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
          <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3 bg-white flex-shrink-0">
            <button
              type="button"
              disabled={likeDisabled}
              onClick={() => void onLike()}
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                likedByCurrentUser
                  ? "bg-blue-50 text-blue-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              } disabled:cursor-wait`}
            >
              {likedByCurrentUser ? (
                <AiFillLike className="h-4 w-4" />
              ) : (
                <AiOutlineLike className="h-4 w-4" />
              )}
              <span>{likedByCurrentUser ? "Liked" : "Like"}</span>
            </button>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <AiFillLike className="h-4 w-4 text-blue-500" />
                {likesCount}
              </span>
              <span className="flex items-center gap-1">
                <FaRegComment className="h-4 w-4" />
                {commentsCount}
              </span>
            </div>
          </div>

          <div className="border-b border-gray-200 p-2 bg-white flex-shrink-0">
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
            className="flex-1 overflow-y-auto p-4 min-h-0"
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
