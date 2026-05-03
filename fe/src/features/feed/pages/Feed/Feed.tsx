import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle.tsx";
import { request } from "@/utils/api.ts";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider.tsx";
import { useWebSocket } from "@/features/websocket/websocket.tsx";
import { LeftSidebar } from "@/features/feed/components/LeftSidebar/LeftSidebar.tsx";
import { Madal } from "@/features/feed/components/Modal/Modal.tsx";
import { IPost, Post } from "@/features/feed/components/Post/Post.tsx";
import { RightSidebar } from "@/features/feed/components/RightSidebar/RightSidebar.tsx";
import { Page } from "@/utils/pagination.ts";
import { resolveMediaUrl, uploadToStorage } from "@/utils/storage";
import { FiEdit3, FiFileText, FiImage, FiVideo } from "react-icons/fi";

const FEED_BATCH_SIZE = 5;
const VIEWED_POSTS_RETRY_DELAY_MS = 2000;

export function Feed() {
  usePageTitle("Feed");

  const [showPostingModal, setShowPostingModal] = useState(false);
  const [modalMode, setModalMode] = useState<"post" | "article">("post");
  const [posts, setPosts] = useState<IPost[]>([]);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [error, setError] = useState("");
  const [nextFeedPage, setNextFeedPage] = useState(0);

  const { user } = useAuthentication();
  const navigate = useNavigate();
  const ws = useWebSocket();

  const postsContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const viewedPostIdsRef = useRef<Set<number>>(new Set());
  const pendingViewedIdsRef = useRef<Set<number>>(new Set());
  const markViewedInFlightRef = useRef(false);
  const viewedPostsRetryTimeoutRef = useRef<number | null>(null);

  const scheduleViewedPostsRetry = () => {
    if (viewedPostsRetryTimeoutRef.current !== null) {
      return;
    }

    viewedPostsRetryTimeoutRef.current = window.setTimeout(() => {
      viewedPostsRetryTimeoutRef.current = null;
      void flushViewedPosts();
    }, VIEWED_POSTS_RETRY_DELAY_MS);
  };

  const flushViewedPosts = async () => {
    if (
      markViewedInFlightRef.current ||
      pendingViewedIdsRef.current.size === 0
    ) {
      return;
    }

    markViewedInFlightRef.current = true;
    const postIds = Array.from(pendingViewedIdsRef.current);
    pendingViewedIdsRef.current.clear();

    await request<void>({
      endpoint: "/api/v1/feed/impressions/viewed",
      method: "POST",
      body: JSON.stringify({ postIds }),
      onSuccess: () => {},
      onFailure: () => {
        postIds.forEach((postId) => pendingViewedIdsRef.current.add(postId));
        scheduleViewedPostsRetry();
      },
    });

    markViewedInFlightRef.current = false;
  };

  const markPostAsViewed = (postId: number) => {
    if (viewedPostIdsRef.current.has(postId)) {
      return;
    }

    viewedPostIdsRef.current.add(postId);
    pendingViewedIdsRef.current.add(postId);
    void flushViewedPosts();
  };

  const fetchPosts = async ({
    replace = false,
    page = 0,
  }: { replace?: boolean; page?: number } = {}) => {
    if (loadingPosts) {
      return;
    }

    setLoadingPosts(true);

    await request<Page<IPost>>({
      endpoint: `/api/v1/feed/paginated?page=${page}&size=${FEED_BATCH_SIZE}`,
      onSuccess: (data) => {
        setError("");
        setPosts((currentPosts) => {
          const basePosts = replace ? [] : currentPosts;
          const existingIds = new Set(basePosts.map((post) => post.id));
          const incomingPosts = data.content.filter(
            (post) => !existingIds.has(post.id)
          );
          return [...basePosts, ...incomingPosts];
        });
        setHasMorePosts(!data.last);
        setNextFeedPage(page + 1);

        if (replace) {
          viewedPostIdsRef.current.clear();
          pendingViewedIdsRef.current.clear();
          setNextFeedPage(1);
        }
      },
      onFailure: (requestError) => setError(requestError),
    });

    setLoadingPosts(false);
  };

  useEffect(() => {
    void fetchPosts({ replace: true, page: 0 });
  }, []);

  useEffect(() => {
    const loadMoreTarget = loadMoreRef.current;
    if (!loadMoreTarget) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loadingPosts || !hasMorePosts) {
          return;
        }

        void fetchPosts({ page: nextFeedPage });
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
  }, [hasMorePosts, loadingPosts, nextFeedPage]);

  useEffect(() => {
    const container = postsContainerRef.current;
    if (!container) {
      return;
    }

    const postElements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-feed-post-id]")
    );

    if (postElements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) {
            return;
          }

          const postId = Number(
            (entry.target as HTMLElement).dataset.feedPostId ?? ""
          );

          if (!Number.isNaN(postId)) {
            markPostAsViewed(postId);
          }
        });
      },
      {
        threshold: [0.6],
      }
    );

    postElements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [posts]);

  useEffect(() => {
    return () => {
      if (viewedPostsRetryTimeoutRef.current !== null) {
        window.clearTimeout(viewedPostsRetryTimeoutRef.current);
      }

      if (pendingViewedIdsRef.current.size === 0) {
        return;
      }

      void fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/feed/impressions/viewed`,
        {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            postIds: Array.from(pendingViewedIdsRef.current),
          }),
        }
      );
    };
  }, []);

  useEffect(() => {
    const subscription = ws?.subscribe(
      `/topic/feed/${user?.id}/post`,
      (data) => {
        const post = JSON.parse(data.body);
        setPosts((currentPosts) => {
          if (
            currentPosts.some((existingPost) => existingPost.id === post.id)
          ) {
            return currentPosts;
          }

          return [post, ...currentPosts];
        });
        setHasMorePosts(true);
      }
    );

    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  useEffect(() => {
    if (!user) {
      return;
    }

    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.author.id === user.id ? { ...post, author: user } : post
      )
    );
  }, [user]);

  const handlePost = async (
    content: string,
    mediaUrls: string[],
    mediaFiles: File[]
  ) => {
    const uploadedMediaUrls = [...mediaUrls];

    for (const mediaFile of mediaFiles.slice(0, 3 - uploadedMediaUrls.length)) {
      const storedObject = await uploadToStorage({
        file: mediaFile,
        scope: mediaFile.type.startsWith("video/")
          ? "FEED_VIDEO"
          : "FEED_IMAGE",
        ownerType: "POST",
      });
      uploadedMediaUrls.push(storedObject.accessUrl);
    }

    await request<IPost>({
      endpoint: "/api/v1/feed/posts",
      method: "POST",
      body: JSON.stringify({
        content,
        picture: uploadedMediaUrls[0] || null,
        mediaUrls: uploadedMediaUrls,
      }),
      onSuccess: (data) => setPosts((currentPosts) => [data, ...currentPosts]),
      onFailure: (requestError) => {
        setError(requestError);
        throw new Error(requestError);
      },
    });
  };

  return (
    <div className="-mx-6 -mt-4 min-h-[calc(100vh-6.25rem)] px-4 py-8 sm:px-6">
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-7 xl:grid-cols-[240px_minmax(0,1fr)_270px]">
        <div className="hidden xl:block h-full">
          <LeftSidebar user={user} />
        </div>

        <div className="grid h-full grid-rows-[auto_1fr] gap-5">
          <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex w-full items-center gap-4 px-5 py-5 text-left">
              <button
                type="button"
                className="cursor-pointer rounded-full transition-all hover:ring-4 hover:ring-red-100"
                onClick={() => navigate(`/profile/${user?.id}`)}
              >
                <img
                  className="h-14 w-14 rounded-full object-cover ring-4 ring-slate-100"
                  src={resolveMediaUrl(user?.profilePicture) || "/doc1.png"}
                  alt=""
                />
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 rounded-2xl px-2 py-1 text-left transition hover:bg-slate-50"
                onClick={() => {
                  setModalMode("post");
                  setShowPostingModal(true);
                }}
              >
                <div className="flex items-center gap-2 text-lg font-bold text-slate-950">
                  <FiEdit3 className="h-5 w-5 text-red-700" />
                  <span>Start a post</span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">
                  Share your professional insights...
                </p>
              </button>
            </div>

            <div className="grid grid-cols-3 border-t border-slate-100 px-3 py-2">
              <button
                className="flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                onClick={() => {
                  setModalMode("post");
                  setShowPostingModal(true);
                }}
                title="Add photos"
              >
                <FiImage className="h-5 w-5" />
                <span>Photo</span>
              </button>

              <button
                className="flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
                onClick={() => {
                  setModalMode("post");
                  setShowPostingModal(true);
                }}
                title="Add videos"
              >
                <FiVideo className="h-5 w-5" />
                <span>Video</span>
              </button>

              <button
                className="flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-red-700"
                onClick={() => {
                  setModalMode("article");
                  setShowPostingModal(true);
                }}
                title="Write an article"
              >
                <FiFileText className="h-5 w-5" />
                <span>Article</span>
              </button>
            </div>

            <Madal
              title={
                modalMode === "article"
                  ? "Creating an article"
                  : "Creating a post"
              }
              mode={modalMode}
              onSubmit={handlePost}
              showModal={showPostingModal}
              setShowModal={setShowPostingModal}
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div ref={postsContainerRef} className="grid gap-5">
            {posts.map((post) => (
              <div key={post.id} data-feed-post-id={post.id}>
                <Post post={post} setPosts={setPosts} />
              </div>
            ))}

            {loadingPosts && (
              <div className="rounded-2xl bg-white p-5 text-center text-sm font-medium text-slate-500">
                Loading more posts...
              </div>
            )}

            {!loadingPosts && hasMorePosts && (
              <div ref={loadMoreRef} className="h-6" />
            )}

            {posts.length === 0 && !loadingPosts && (
              <p className="rounded-[1.75rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center text-slate-500">
                Start connecting with people to build a feed that matters to
                you.
              </p>
            )}
          </div>
        </div>

        <div className="hidden xl:block h-full">
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}
