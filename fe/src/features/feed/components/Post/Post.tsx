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
import { Madal } from "@/features/feed/components/Modal/Modal";
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

export function Post({ post, setPosts }: PostProps) {
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
          title="Editing your post"
          content={post.content}
          mediaUrls={post.mediaUrls}
          onSubmit={editPost}
          showModal={editing}
          setShowModal={setEditing}
        />
      ) : null}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-3 relative hover:shadow-md transition-shadow">
        {" "}
        {/* .root styles */}
        <div className="flex gap-3 items-start p-4 justify-between">
          {" "}
          {/* .top styles */}
          <div className="flex gap-3 items-start flex-1">
            {" "}
            {/* .author styles */}
            <button
              className="cursor-pointer flex-shrink-0 hover:opacity-80 transition-opacity"
              onClick={() => {
                navigate(`/profile/${post.author.id}`);
              }}
            >
              <img
                className="w-16 h-16 rounded-full" /* .avatar styles */
                src={resolveMediaUrl(post.author.profilePicture) || "/doc1.png"}
                alt=""
              />
            </button>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => navigate(`/profile/${post.author.id}`)}
                className="text-left hover:text-blue-600 hover:underline transition-colors"
              >
                <div className="font-semibold text-sm text-gray-900 line-clamp-1">
                  {" "}
                  {/* .name styles */}
                  {post.author.firstName + " " + post.author.lastName}
                </div>
              </button>
              <div className="text-xs text-gray-600 line-clamp-1 mt-0.5">
                {" "}
                {/* .title styles */}
                {post.author.position} at {post.author.company}
              </div>
              <div className="flex items-center gap-1 mt-1">
                <TimeAgo
                  date={post.creationDate}
                  edited={!!post.updateDate}
                  className="text-xs text-gray-500"
                />{" "}
                {/* .date styles */}
                <span className="text-gray-400">•</span>
              </div>
            </div>
          </div>
          <div>
            {post.author.id == user?.id && (
              <button
                className={`bg-transparent w-6 h-6 rounded-full grid place-items-center transition-all duration-300 cursor-pointer ${
                  showMenu ? "bg-gray-300" : "hover:bg-gray-300"
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
              <div className="absolute right-5 top-11 flex flex-col items-start bg-gray-300 rounded-lg p-2 text-xs gap-2">
                {" "}
                {/* .menu styles */}
                <button
                  onClick={() => setEditing(true)}
                  className="w-full text-left border-b border-gray-400 pb-1 cursor-pointer hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => deletePost(post.id)}
                  className="w-full text-left cursor-pointer hover:bg-gray-200 px-2 py-1 rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="px-4 pb-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </div>{" "}
        {/* .content styles */}
        {postMediaUrls.length > 0 && (
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
        <div className="flex justify-between items-center px-4 py-1">
          {" "}
          {/* .stats styles */}
          {likesCount > 0 ? (
            <button
              onClick={() => setShowCommentModal(true)}
              className="py-1 text-xs text-gray-600 hover:text-blue-600 hover:underline cursor-pointer transition-colors flex items-center gap-1"
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
              className="py-1 px-4 text-xs cursor-pointer hover:text-black transition-colors"
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
        <div className="flex gap-20 justify-between p-1 border-t border-gray-300">
          {" "}
          {/* .actions styles */}
          <button
            disabled={postLiked == undefined}
            onClick={like}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg flex-1 font-medium text-sm transition-all hover:bg-gray-100 ${
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
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg flex-1 font-medium text-sm text-gray-700 transition-all hover:bg-gray-100 cursor-pointer" /* action button styles */
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
