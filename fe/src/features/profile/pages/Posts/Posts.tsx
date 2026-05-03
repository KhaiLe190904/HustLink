import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader } from "@/components/Loader/Loader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { request } from "@/utils/api";
import {
  IUser,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { LeftSidebar } from "@/features/feed/components/LeftSidebar/LeftSidebar";
import { IPost, Post } from "@/features/feed/components/Post/Post";
import { RightSidebar } from "@/features/feed/components/RightSidebar/RightSidebar";
import { Page } from "@/utils/pagination";
import { throttle } from "@/utils/throttle";

export function Posts() {
  const { id } = useParams();
  const [posts, setPosts] = useState<IPost[]>([]);
  const [postsPage, setPostsPage] = useState<number>(0);
  const [hasMorePosts, setHasMorePosts] = useState<boolean>(true);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const { user: authUser } = useAuthentication();
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);
  usePageTitle("Posts | " + user?.firstName + " " + user?.lastName);
  useEffect(() => {
    if (id == authUser?.id) {
      setUser(authUser);
      setLoading(false);
    } else {
      request<IUser>({
        endpoint: `/api/v1/authentication/users/${id}`,
        onSuccess: (data) => {
          setUser(data);
          setLoading(false);
        },
        onFailure: (error) => console.log(error),
      });
    }
  }, [authUser, id]);

  useEffect(() => {
    setLoadingPosts(true);
    request<Page<IPost>>({
      endpoint: `/api/v1/feed/posts/user/${id}/paginated?page=0&size=20`,
      onSuccess: (data) => {
        setPosts(data.content);
        setHasMorePosts(!data.last);
        setPostsPage(0);
      },
      onFailure: (error) => console.log(error),
    }).finally(() => setLoadingPosts(false));
  }, [id]);

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
          endpoint: `/api/v1/feed/posts/user/${id}/paginated?page=${nextPage}&size=20`,
          onSuccess: (data) => {
            setPosts((prev) => [...prev, ...data.content]);
            setHasMorePosts(!data.last);
            setPostsPage(nextPage);
          },
          onFailure: (error) => console.log(error),
        }).finally(() => setLoadingPosts(false));
      }
    }, 200); // Max 1 call per 200ms

    window.addEventListener("scroll", handleScroll);
    return () => {
      handleScroll.cancel();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [id, postsPage, hasMorePosts, loadingPosts]);

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

  if (loading) {
    return <Loader />;
  }
  return (
    <div className="grid gap-8 xl:grid-cols-[14rem_minmax(0,1fr)_20rem] xl:items-start">
      <div className="hidden xl:block">
        <LeftSidebar user={user} />
      </div>
      <div className="grid gap-4">
        <h1 className="text-2xl font-bold text-slate-900">
          {user?.firstName + " " + user?.lastName + "'s posts"}
        </h1>
        {posts.map((post) => (
          <Post key={post.id} post={post} setPosts={setPosts} />
        ))}
        {loadingPosts && (
          <div className="rounded-3xl border border-slate-200/80 bg-white p-4 text-center text-slate-500">
            Loading more posts...
          </div>
        )}
        {posts.length === 0 && !loadingPosts && (
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-8 text-center shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
            <p className="text-slate-500">No post to display.</p>
          </div>
        )}
      </div>
      <div className="hidden xl:block">
        <RightSidebar />
      </div>
    </div>
  );
}
