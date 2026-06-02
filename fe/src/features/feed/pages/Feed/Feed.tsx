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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const { user } = useAuthentication();
  const navigate = useNavigate();
  const ws = useWebSocket();

  const postsContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const viewedPostIdsRef = useRef<Set<number>>(new Set());
  const pendingViewedIdsRef = useRef<Set<number>>(new Set());
  const markViewedInFlightRef = useRef(false);
  const viewedPostsRetryTimeoutRef = useRef<number | null>(null);
  const inFlightRequestsRef = useRef<Set<string>>(new Set());

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

    const requestKey = `${replace ? "replace" : "append"}-${page}`;
    if (inFlightRequestsRef.current.has(requestKey)) {
      return;
    }
    inFlightRequestsRef.current.add(requestKey);

    setLoadingPosts(true);

    try {
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
            setInitialLoadComplete(true);
          }
        },
        onFailure: (requestError) => setError(requestError),
      });
    } finally {
      setLoadingPosts(false);
      inFlightRequestsRef.current.delete(requestKey);
    }
  };

  useEffect(() => {
    void fetchPosts({ replace: true, page: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadMoreTarget = loadMoreRef.current;
    if (!loadMoreTarget) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          !entry?.isIntersecting ||
          loadingPosts ||
          !hasMorePosts ||
          !initialLoadComplete
        ) {
          return;
        }

        void fetchPosts({ page: nextFeedPage });
      },
      {
        rootMargin: "10px 0px",
        threshold: 0.1,
      }
    );

    observer.observe(loadMoreTarget);

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMorePosts, loadingPosts, nextFeedPage, initialLoadComplete]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialLoadComplete) {
      return;
    }

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
  }, [user?.id, ws, initialLoadComplete]);

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

            {posts.length === 0 && loadingPosts && (
              <>
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </>
            )}

            {posts.length > 0 && loadingPosts && <PostSkeleton />}

            {!loadingPosts && hasMorePosts && (
              <div ref={loadMoreRef} className="h-6" />
            )}

            {posts.length > 0 && !hasMorePosts && !loadingPosts && (
              <div className="rounded-[1.75rem] border border-slate-200 bg-gradient-to-r from-red-50/50 via-white to-red-50/50 p-6 text-center shadow-sm flex flex-col items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xl select-none animate-pulse">
                  ✓
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  You've caught up for this session
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  Click the button below to load new recommendations and update
                  your feed with fresh posts.
                </p>
                <button
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    void fetchPosts({ replace: true, page: 0 });
                  }}
                  className="cursor-pointer mt-1 rounded-full bg-red-600 px-5 py-2 text-xs font-semibold text-white transition-all shadow-md shadow-red-600/10 hover:bg-red-700 hover:shadow-lg hover:scale-[1.02]"
                >
                  Refresh Feed
                </button>
              </div>
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

function PostSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] animate-pulse">
      {/* Top author details */}
      <div className="flex items-start gap-3 pb-3">
        {/* Avatar skeleton */}
        <div className="h-[52px] w-[52px] rounded-full bg-slate-200/80" />

        {/* Text details skeleton */}
        <div className="flex-1 min-w-0 space-y-2 mt-1">
          <div className="h-4 w-32 rounded bg-slate-200/80" />
          <div className="h-3 w-48 rounded bg-slate-100" />
          <div className="h-3 w-20 rounded bg-slate-100/80" />
        </div>
      </div>

      {/* Content lines skeleton */}
      <div className="space-y-2.5 py-4">
        <div className="h-4 w-full rounded bg-slate-200/60" />
        <div className="h-4 w-[92%] rounded bg-slate-200/60" />
        <div className="h-4 w-[65%] rounded bg-slate-200/60" />
      </div>

      {/* Optional image placeholder to look premium */}
      <div className="my-2 h-48 w-full rounded-2xl bg-slate-100/80" />

      {/* Bottom stats and action buttons skeleton */}
      <div className="flex items-center justify-between border-t border-slate-100 mt-4 pt-3">
        <div className="h-3 w-16 rounded bg-slate-100" />
        <div className="h-3 w-20 rounded bg-slate-100" />
      </div>
    </div>
  );
}
