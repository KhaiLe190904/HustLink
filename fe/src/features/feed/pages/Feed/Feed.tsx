import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle.tsx";
import { request } from "@/utils/api.ts";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider.tsx";
import { useWebSocket } from "@/features/websocket/websocket.tsx";
import { LeftSidebar } from "@/features/feed/components/LeftSidebar/LeftSidebar.tsx";
import { Madal } from "@/features/feed/components/Modal/Modal.tsx";
import { IPost, Post } from "@/features/feed/components/Post/Post.tsx";
import { RightSidebar } from "@/features/feed/components/RightSidebar/RightSidebar.tsx";
import { Button } from "@/features/authentication/components/Button/Button.tsx";

export function Feed() {
  usePageTitle("Feed");
  const [showPostingModal, setShowPostingModal] = useState(false);
  const { user } = useAuthentication();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<IPost[]>([]);
  const [error, setError] = useState("");
  const ws = useWebSocket();

  useEffect(() => {
    const fetchPosts = async () => {
      await request<IPost[]>({
        endpoint: "/api/v1/feed",
        onSuccess: (data) => setPosts(data),
        onFailure: (error) => setError(error),
      });
    };
    fetchPosts();
  }, []);

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
    <div className="h-full grid gap-8 grid-cols-1 xl:grid-cols-[14rem_1fr_20rem] xl:items-start [&_.left]:hidden [&_.right]:hidden xl:[&_.left]:block xl:[&_.right]:block">
      {" "}
      {/* .root styles with responsive */}
      <div className="hidden xl:block">
        {" "}
        {/* .left responsive */}
        <LeftSidebar user={user} />
      </div>
      <div className="grid gap-4 h-full grid-rows-[auto_1fr]">
        {" "}
        {/* .center styles */}
        <div className="bg-white rounded-lg border border-gray-300 p-4 grid grid-cols-[5rem_1fr] gap-4">
          {" "}
          {/* .posting styles */}
          <button
            className="cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all rounded-full"
            onClick={() => {
              navigate(`/profile/${user?.id}`);
            }}
          >
            <img
              className="w-20 h-20 rounded-full" /* .avatar styles */
              src={user?.profilePicture || "/doc1.png"}
              alt=""
            />
          </button>
          <Button outline onClick={() => setShowPostingModal(true)}>
            Start a post
          </Button>
          <Madal
            title="Creating a post"
            onSubmit={handlePost}
            showModal={showPostingModal}
            setShowModal={setShowPostingModal}
          />
        </div>
        {error && <div className="text-red-500">{error}</div>}{" "}
        {/* .error styles */}
        <div>
          {" "}
          {/* .feed minimal wrapper */}
          {posts.map((post) => (
            <Post key={post.id} post={post} setPosts={setPosts} />
          ))}
          {posts.length === 0 && (
            <p>
              Start connecting with poople to build a feed that matters to you.
            </p>
          )}
        </div>
      </div>
      <div className="hidden xl:block">
        {" "}
        {/* .right responsive */}
        <RightSidebar />
      </div>
    </div>
  );
}
