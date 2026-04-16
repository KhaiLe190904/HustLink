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

const FEED_BATCH_SIZE = 5;

export function Feed() {
  usePageTitle("Feed");

  const [showPostingModal, setShowPostingModal] = useState(false);
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
      },
    });

    markViewedInFlightRef.current = false;

    if (pendingViewedIdsRef.current.size > 0) {
      void flushViewedPosts();
    }
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
      onFailure: (requestError) => setError(requestError),
    });
  };

  return (
    <div className="h-full grid gap-6 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <div className="hidden xl:block h-full">
        <LeftSidebar user={user} />
      </div>

      <div className="grid gap-4 h-full grid-rows-[auto_1fr]">
        <div className="bg-white rounded-lg border border-gray-300 p-4">
          <div className="grid grid-cols-[3.5rem_1fr] gap-3 mb-4">
            <button
              className="cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all rounded-full"
              onClick={() => navigate(`/profile/${user?.id}`)}
            >
              <img
                className="w-14 h-14 rounded-full"
                src={resolveMediaUrl(user?.profilePicture) || "/doc1.png"}
                alt=""
              />
            </button>

            <button
              className="text-left px-4 py-3 border border-gray-300 rounded-full hover:bg-gray-50 text-gray-600 font-medium transition-all"
              onClick={() => setShowPostingModal(true)}
            >
              Start a post
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="flex items-center justify-center rounded-full p-3 text-gray-600 transition-all hover:bg-blue-50 hover:text-blue-600"
              onClick={() => setShowPostingModal(true)}
              title="Add photos"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <button
              className="flex items-center justify-center rounded-full p-3 text-gray-600 transition-all hover:bg-green-50 hover:text-green-600"
              onClick={() => setShowPostingModal(true)}
              title="Add videos"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </button>
          </div>

          <Madal
            title="Creating a post"
            onSubmit={handlePost}
            showModal={showPostingModal}
            setShowModal={setShowPostingModal}
          />
        </div>

        {error && <div className="text-red-500">{error}</div>}

        <div ref={postsContainerRef}>
          {posts.map((post) => (
            <div key={post.id} data-feed-post-id={post.id}>
              <Post post={post} setPosts={setPosts} />
            </div>
          ))}

          {loadingPosts && (
            <div className="p-4 text-center text-gray-500">
              Loading more posts...
            </div>
          )}

          {!loadingPosts && hasMorePosts && (
            <div ref={loadMoreRef} className="h-6" />
          )}

          {posts.length === 0 && !loadingPosts && (
            <p>
              Start connecting with people to build a feed that matters to you.
            </p>
          )}
        </div>
      </div>

      <div className="hidden xl:block h-full">
        <RightSidebar />
      </div>
    </div>
  );
}
