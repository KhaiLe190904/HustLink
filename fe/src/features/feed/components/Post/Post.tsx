import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { request } from "@/utils/api";
import {
  IUser,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { useWebSocket } from "@/features/websocket/websocket";
import { IComment } from "@/features/feed/components/Comment/Comment";
import {
  ARTICLE_CONTENT_PREFIX,
  Madal,
} from "@/features/feed/components/Modal/Modal";
import { TimeAgo } from "@/features/feed/components/TimeAgo/TimeAgo";
import { CommentModal } from "@/features/feed/components/CommentModal/CommentModal";
import { AiOutlineLike, AiFillLike } from "react-icons/ai";
import { FaRegComment } from "react-icons/fa";
import { Page } from "@/utils/pagination";
import { isVideoFile, resolveMediaUrl, uploadToStorage } from "@/utils/storage";

export interface IPost {
  id: number;
  content: string;
  author: IUser;
  picture?: string;
  mediaUrls?: string[];
  creationDate: string;
  updateDate?: string;
  likesCount: number;
  commentsCount: number;
  likedByCurrentUser: boolean;
}

interface PostProps {
  post: IPost;
  setPosts: Dispatch<SetStateAction<IPost[]>>;
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

export function Post({ post, setPosts }: PostProps) {
  const article = parseArticleContent(post.content);
  const isArticle = !!article;
  const postMediaUrls =
    post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : post.picture
        ? [post.picture]
        : [];
  const [comments, setComments] = useState<IComment[]>([]);
  const [commentsPage, setCommentsPage] = useState<number>(0);
  const [hasMoreComments, setHasMoreComments] = useState<boolean>(true);
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [commentsCount, setCommentsCount] = useState<number>(
    post.commentsCount
  );
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [likesCount, setLikesCount] = useState<number>(post.likesCount);
  const [content, setContent] = useState("");
  const navigate = useNavigate();
  const { user } = useAuthentication();
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [articleExpanded, setArticleExpanded] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const webSocketClient = useWebSocket();

  const [postLiked, setPostLiked] = useState<boolean>(post.likedByCurrentUser);

  useEffect(() => {
    setLikesCount(post.likesCount ?? 0);
    setCommentsCount(post.commentsCount ?? 0);
    setPostLiked(post.likedByCurrentUser ?? false);
  }, [post.commentsCount, post.likedByCurrentUser, post.likesCount]);

  useEffect(() => {
    setCurrentMediaIndex(0);
    setArticleExpanded(false);
  }, [post.id, post.picture, post.mediaUrls]);

  // Fetch comments only when modal opens
  useEffect(() => {
    if (!showCommentModal) {
      setComments([]);
      setCommentsPage(0);
      setHasMoreComments(true);
      return;
    }

    const fetchComments = async () => {
      setLoadingComments(true);
      await request<Page<IComment>>({
        endpoint: `/api/v1/feed/posts/${post.id}/comments/paginated?page=0&size=20`,
        onSuccess: (data) => {
          setComments(data.content); // Backend returns DESC (newest first)
          setHasMoreComments(!data.last);
          setCommentsPage(0);
        },
        onFailure: (error) => {
          console.error(error);
        },
      });
      setLoadingComments(false);
    };
    fetchComments();
  }, [post.id, showCommentModal]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      `/topic/likes/${post.id}`,
      (message) => {
        const likes = JSON.parse(message.body);
        setLikesCount(likes.length);
        setPostLiked(likes.some((like: IUser) => like.id === user?.id));
      }
    );
    return () => subscription?.unsubscribe();
  }, [post.id, user?.id, webSocketClient]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      `/topic/comments/${post.id}`,
      (message) => {
        const comment = JSON.parse(message.body);
        const isOwnComment = comment.author?.id === user?.id;

        if (showCommentModal) {
          setComments((prev) => {
            const index = prev.findIndex((c) => c.id === comment.id);
            if (index === -1) {
              // Only increment if it's not from current user (avoid double counting)
              if (!isOwnComment) {
                setCommentsCount((prevCount) => prevCount + 1);
              }
              return [comment, ...prev];
            }
            return prev.map((c) => (c.id === comment.id ? comment : c));
          });
        } else {
          // Only increment if it's not from current user (avoid double counting)
          if (!isOwnComment) {
            setCommentsCount((prevCount) => prevCount + 1);
          }
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, [post.id, webSocketClient, showCommentModal, user?.id]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      `/topic/comments/${post.id}/delete`,
      (message) => {
        const comment = JSON.parse(message.body);
        setCommentsCount((prev) => Math.max(0, prev - 1));

        if (showCommentModal) {
          setComments((prev) => prev.filter((c) => c.id !== comment.id));
        }
      }
    );

    return () => subscription?.unsubscribe();
  }, [post.id, webSocketClient, showCommentModal]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      `/topic/posts/${post.id}/delete`,
      () => {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
      }
    );
    return () => subscription?.unsubscribe();
  }, [post.id, setPosts, webSocketClient]);

  useEffect(() => {
    const subscription = webSocketClient?.subscribe(
      `/topic/posts/${post.id}/edit`,
      (data) => {
        const post = JSON.parse(data.body);
        setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
      }
    );
    return () => subscription?.unsubscribe();
  }, [post.id, setPosts, webSocketClient]);

  const like = async () => {
    await request<IPost>({
      endpoint: `/api/v1/feed/posts/${post.id}/like`,
      method: "PUT",
      onSuccess: () => {},
      onFailure: (error) => {
        console.error(error);
      },
    });
  };

  const postComment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content) {
      return;
    }
    await request<IPost>({
      endpoint: `/api/v1/feed/posts/${post.id}/comments`,
      method: "POST",
      body: JSON.stringify({ content }),
      onSuccess: () => {
        setContent("");
        setCommentsCount((prev) => prev + 1); // Increment count for own comment
      },
      onFailure: (error) => {
        console.error(error);
      },
    });
  };

  const deleteComment = async (id: number) => {
    await request<void>({
      endpoint: `/api/v1/feed/comments/${id}`,
      method: "DELETE",
      onSuccess: () => {
        setComments((prev) => prev.filter((c) => c.id !== id));
        setCommentsCount((prev) => Math.max(0, prev - 1));
      },
      onFailure: (error) => {
        console.error(error);
      },
    });
  };

  const editComment = async (id: number, content: string) => {
    await request<IComment>({
      endpoint: `/api/v1/feed/comments/${id}`,
      method: "PUT",
      body: JSON.stringify({ content }),
      onSuccess: (data) => {
        setComments((prev) =>
          prev.map((c) => {
            if (c.id === id) {
              return data;
            }
            return c;
          })
        );
      },
      onFailure: (error) => {
        console.error(error);
      },
    });
  };

  const loadMoreComments = async () => {
    if (loadingComments || !hasMoreComments) return;
    const nextPage = commentsPage + 1;
    setLoadingComments(true);
    await request<Page<IComment>>({
      endpoint: `/api/v1/feed/posts/${post.id}/comments/paginated?page=${nextPage}&size=20`,
      onSuccess: (data) => {
        // Backend returns DESC order (older comments on next page)
        // Append older comments at the end
        setComments((prev) => [...prev, ...data.content]);
        setHasMoreComments(!data.last);
        setCommentsPage(nextPage);
      },
      onFailure: (error) => console.error(error),
    });
    setLoadingComments(false);
  };

  const deletePost = async (id: number) => {
    await request<void>({
      endpoint: `/api/v1/feed/posts/${id}`,
      method: "DELETE",
      onSuccess: () => {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      },
      onFailure: (error) => {
        console.error(error);
      },
    });
  };

  const editPost = async (
    content: string,
    mediaUrls: string[],
    mediaFiles: File[]
  ) => {
    const nextMediaUrls = [...mediaUrls];
    for (const mediaFile of mediaFiles.slice(0, 3 - nextMediaUrls.length)) {
      const storedObject = await uploadToStorage({
        file: mediaFile,
        scope: mediaFile.type.startsWith("video/")
          ? "FEED_VIDEO"
          : "FEED_IMAGE",
        ownerType: "POST",
        ownerId: post.id,
      });
      nextMediaUrls.push(storedObject.accessUrl);
    }

    await request<IPost>({
      endpoint: `/api/v1/feed/posts/${post.id}`,
      method: "PUT",
      body: JSON.stringify({
        content,
        picture: nextMediaUrls[0] || null,
        mediaUrls: nextMediaUrls,
      }),
      onSuccess: (data) => {
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id === post.id) {
              return data;
            }
            return p;
          })
        );
        setShowMenu(false);
      },
      onFailure: (error) => {
        throw new Error(error);
      },
    });
  };

  return (
    <>
      {editing ? (
        <Madal
          title={isArticle ? "Editing your article" : "Editing your post"}
          mode={isArticle ? "article" : "post"}
          content={post.content}
          mediaUrls={post.mediaUrls}
          onSubmit={editPost}
          showModal={editing}
          setShowModal={setEditing}
        />
      ) : null}
      <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
        {" "}
        {/* .root styles */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          {" "}
          {/* .top styles */}
          <div className="flex gap-3 items-start flex-1">
            {" "}
            {/* .author styles */}
            <button
              className="flex-shrink-0 cursor-pointer rounded-full transition-all hover:ring-4 hover:ring-red-100"
              onClick={() => {
                navigate(`/profile/${post.author.id}`);
              }}
            >
              <img
                className="h-[52px] w-[52px] rounded-full object-cover ring-4 ring-slate-50" /* .avatar styles */
                src={resolveMediaUrl(post.author.profilePicture) || "/doc1.png"}
                alt=""
              />
            </button>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => navigate(`/profile/${post.author.id}`)}
                className="text-left transition-colors hover:text-red-700"
              >
                <div className="line-clamp-1 text-sm font-bold text-slate-950">
                  {" "}
                  {/* .name styles */}
                  {post.author.firstName + " " + post.author.lastName}
                </div>
              </button>
              <div className="mt-0.5 line-clamp-1 text-xs font-medium text-slate-500">
                {" "}
                {/* .title styles */}
                {post.author.position} at {post.author.company}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <TimeAgo
                  date={post.creationDate}
                  edited={!!post.updateDate}
                  className="text-xs text-slate-400"
                />{" "}
                {/* .date styles */}
              </div>
            </div>
          </div>
          <div>
            {post.author.id == user?.id && (
              <button
                className={`grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-transparent text-slate-500 transition-all duration-300 ${
                  showMenu ? "bg-slate-100" : "hover:bg-slate-100"
                }`} /* .toggle styles */
                onClick={() => setShowMenu(!showMenu)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 128 512"
                  className="w-3 h-3"
                >
                  {" "}
                  {/* toggle svg styles */}
                  <path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z" />
                </svg>
              </button>
            )}
            {showMenu && (
              <div className="absolute right-5 top-[3.25rem] z-20 grid w-36 gap-1 rounded-2xl border border-slate-200 bg-white p-2 text-sm font-semibold shadow-xl shadow-slate-900/10">
                {" "}
                {/* .menu styles */}
                <button
                  onClick={() => setEditing(true)}
                  className="w-full cursor-pointer rounded-xl px-3 py-2 text-left text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => deletePost(post.id)}
                  className="w-full cursor-pointer rounded-xl px-3 py-2 text-left text-red-700 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        {isArticle && article ? (
          <div className="px-5 pb-4">
            {!isVideoFile(postMediaUrls[0]) && postMediaUrls[0] ? (
              <img
                src={resolveMediaUrl(postMediaUrls[0])}
                alt={article.title}
                className="mb-4 h-64 w-full rounded-2xl object-cover"
              />
            ) : null}
            <h2 className="text-3xl font-bold leading-tight text-slate-950">
              {article.title}
            </h2>
            {article.summary ? (
              <p className="mt-2 text-lg text-slate-600">{article.summary}</p>
            ) : null}
            {article.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                  >
                    #{tag.replace(/^#/, "")}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-5 border-t border-slate-700">
              <div
                className={`overflow-hidden text-slate-700 [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_p]:mt-2 [&_p]:leading-7 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1 ${
                  articleExpanded ? "" : "max-h-56"
                }`}
                dangerouslySetInnerHTML={{ __html: article.contentHtml }}
              />
            </div>
            <button
              type="button"
              onClick={() => setArticleExpanded((prev) => !prev)}
              className="mt-4 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              {articleExpanded ? "Show less" : "Read more"}
            </button>
          </div>
        ) : (
          <div className="px-5 pb-4 text-[15px] leading-6 text-slate-800 whitespace-pre-wrap">
            {post.content}
          </div>
        )}{" "}
        {/* .content styles */}
        {!isArticle && postMediaUrls.length > 0 && (
          <div className="relative bg-black">
            {isVideoFile(postMediaUrls[currentMediaIndex]) ? (
              <video
                src={resolveMediaUrl(postMediaUrls[currentMediaIndex])}
                controls
                playsInline
                preload="metadata"
                onClick={() => setShowCommentModal(true)}
                className="w-full bg-black cursor-pointer"
              />
            ) : (
              <img
                src={resolveMediaUrl(postMediaUrls[currentMediaIndex])}
                alt=""
                onClick={() => setShowCommentModal(true)}
                className="w-full object-cover cursor-pointer"
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
        )}{" "}
        {/* .picture styles */}
        <div className="flex items-center justify-between px-5 py-2">
          {" "}
          {/* .stats styles */}
          {likesCount > 0 ? (
            <button
              onClick={() => setShowCommentModal(true)}
              className="flex cursor-pointer items-center gap-1 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-blue-600"
            >
              {" "}
              {/* .stat styles */}
              <AiFillLike className="w-3.5 h-3.5 text-blue-500" />
              <span>
                {likesCount} {likesCount === 1 ? "like" : "likes"}
              </span>
            </button>
          ) : (
            <div></div>
          )}
          {commentsCount > 0 ? (
            <button
              className="cursor-pointer px-4 py-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-950"
              onClick={() => setShowCommentModal(true)}
            >
              {" "}
              {/* .stat styles */}
              <span>
                {commentsCount} {commentsCount === 1 ? "comment" : "comments"}
              </span>
            </button>
          ) : (
            <div></div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-2">
          {" "}
          {/* .actions styles */}
          <button
            disabled={postLiked == undefined}
            onClick={like}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all hover:bg-slate-50 ${
              postLiked ? "text-blue-600" : "text-gray-700"
            } disabled:cursor-wait cursor-pointer`} /* action button styles */
          >
            {postLiked ? (
              <AiFillLike className="w-5 h-5" />
            ) : (
              <AiOutlineLike className="w-5 h-5" />
            )}
            <span>
              {postLiked == undefined
                ? "Loading"
                : postLiked
                  ? "Liked"
                  : "Like"}
            </span>
          </button>
          <button
            onClick={() => {
              setShowCommentModal(true);
            }}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50" /* action button styles */
          >
            <FaRegComment className="w-5 h-5" />
            <span>Comment</span>
          </button>
        </div>
      </div>

      {/* Comment Modal */}
      <CommentModal
        showModal={showCommentModal}
        setShowModal={setShowCommentModal}
        post={post}
        comments={comments}
        content={content}
        setContent={setContent}
        onSubmitComment={postComment}
        deleteComment={deleteComment}
        editComment={editComment}
        loadMoreComments={loadMoreComments}
        hasMoreComments={hasMoreComments}
        loadingComments={loadingComments}
        commentsCount={commentsCount}
        likesCount={likesCount}
        likedByCurrentUser={postLiked ?? false}
        onLike={like}
        likeDisabled={postLiked == undefined}
      />
    </>
  );
}
