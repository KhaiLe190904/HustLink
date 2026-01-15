import { useEffect, useState, useRef } from "react";
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
import { throttle } from "@/utils/throttle.ts";

export function Feed() {
  usePageTitle("Feed");
  const [showPostingModal, setShowPostingModal] = useState(false);
  const { user } = useAuthentication();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<IPost[]>([]);
  const [postsPage, setPostsPage] = useState<number>(0);
  const [hasMorePosts, setHasMorePosts] = useState<boolean>(true);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [error, setError] = useState("");
  const ws = useWebSocket();
  const postsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoadingPosts(true);
      await request<Page<IPost>>({
        endpoint: `/api/v1/feed/paginated?page=0&size=20`,
        onSuccess: (data) => {
          setPosts(data.content);
          setHasMorePosts(!data.last);
          setPostsPage(0);
        },
        onFailure: (error) => setError(error),
      });
      setLoadingPosts(false);
    };
    fetchPosts();
  }, []);

  useEffect(() => {
    const handleScroll = throttle(() => {
      if (loadingPosts || !hasMorePosts) return;

      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const clientHeight = window.innerHeight;

      // Load more within 200px from bottom
      if (scrollHeight - scrollTop - clientHeight < 200) {
        const nextPage = postsPage + 1;
        setLoadingPosts(true);
        request<Page<IPost>>({
          endpoint: `/api/v1/feed/paginated?page=${nextPage}&size=20`,
          onSuccess: (data) => {
            setPosts((prev) => [...prev, ...data.content]);
            setHasMorePosts(!data.last);
            setPostsPage(nextPage);
          },
          onFailure: (error) => setError(error),
        }).finally(() => setLoadingPosts(false));
      }
    }, 200); // Max 1 call per 200ms

    window.addEventListener("scroll", handleScroll);
    return () => {
      handleScroll.cancel();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [postsPage, hasMorePosts, loadingPosts]);

  useEffect(() => {
    const subscription = ws?.subscribe(
      `/topic/feed/${user?.id}/post`,
      (data) => {
        const post = JSON.parse(data.body);
        setPosts((posts) => [post, ...posts]);
      }
    );
    return () => subscription?.unsubscribe();
  }, [user?.id, ws]);

  // Cập nhật thông tin author trong posts khi user thay đổi
  useEffect(() => {
    if (user) {
      setPosts((currentPosts) =>
        currentPosts.map((post) =>
          post.author.id === user.id ? { ...post, author: user } : post
        )
      );
    }
  }, [user]);

  const handlePost = async (content: string, picture: string) => {
    await request<IPost>({
      endpoint: "/api/v1/feed/posts",
      method: "POST",
      body: JSON.stringify({ content, picture }),
      onSuccess: (data) => setPosts([data, ...posts]),
      onFailure: (error) => setError(error),
    });
  };

  return (
    <div className="h-full grid gap-6 grid-cols-1 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      {/* .root styles with responsive */}
      <div className="hidden xl:block h-full">
        <LeftSidebar user={user} />
      </div>
      <div className="grid gap-4 h-full grid-rows-[auto_1fr]">
        {" "}
        {/* .center styles */}
        <div className="bg-white rounded-lg border border-gray-300 p-4">
          {" "}
          {/* .posting styles */}
          <div className="grid grid-cols-[3.5rem_1fr] gap-3 mb-4">
            <button
              className="cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all rounded-full"
              onClick={() => {
                navigate(`/profile/${user?.id}`);
              }}
            >
              <img
                className="w-14 h-14 rounded-full" /* .avatar styles */
                src={user?.profilePicture || "/doc1.png"}
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
          <div className="grid grid-cols-4 gap-1">
            <button
              className="flex items-center justify-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-gray-600 font-medium transition-all"
              onClick={() => setShowPostingModal(true)}
            >
              <svg
                className="w-5 h-5 text-blue-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm">Photo</span>
            </button>
            <button
              className="flex items-center justify-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-gray-600 font-medium transition-all"
              onClick={() => setShowPostingModal(true)}
            >
              <svg
                className="w-5 h-5 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
              <span className="text-sm">Video</span>
            </button>
            <button
              className="flex items-center justify-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-gray-600 font-medium transition-all"
              onClick={() => setShowPostingModal(true)}
            >
              <svg
                className="w-5 h-5 text-orange-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-sm">Event</span>
            </button>
            <button
              className="flex items-center justify-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-gray-600 font-medium transition-all"
              onClick={() => setShowPostingModal(true)}
            >
              <svg
                className="w-5 h-5 text-red-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z"
                  clipRule="evenodd"
                />
                <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
              </svg>
              <span className="text-sm">Article</span>
            </button>
          </div>
          <Madal
            title="Creating a post"
            onSubmit={handlePost}
            showModal={showPostingModal}
            setShowModal={setShowPostingModal}
          />
        </div>
        {error && <div className="text-red-500">{error}</div>}{" "}
        {/* .error styles */}
        <div ref={postsContainerRef}>
          {" "}
          {/* .feed minimal wrapper */}
          {posts.map((post) => (
            <Post key={post.id} post={post} setPosts={setPosts} />
          ))}
          {loadingPosts && (
            <div className="p-4 text-center text-gray-500">
              Loading more posts...
            </div>
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
