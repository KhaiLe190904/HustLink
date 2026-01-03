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

export function Posts() {
  const { id } = useParams();
  const [posts, setPosts] = useState<IPost[]>([]);
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
    request<IPost[]>({
      endpoint: `/api/v1/feed/posts/user/${id}`,
      onSuccess: (data) => setPosts(data),
      onFailure: (error) => console.log(error),
    });
  }, [id]);

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
    <div className="grid gap-8 xl:grid-cols-[14rem_1fr_20rem] xl:items-start">
      <div className="hidden xl:block">
        <LeftSidebar user={user} />
      </div>
      <div className="grid gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.firstName + " " + user?.lastName + "'s posts"}
        </h1>
        {posts.map((post) => (
          <Post key={post.id} post={post} setPosts={setPosts} />
        ))}
        {posts.length === 0 && (
          <div className="bg-white border border-gray-300 rounded-lg p-8 text-center">
            <p className="text-gray-500">No post to display.</p>
          </div>
        )}
      </div>
      <div className="hidden xl:block">
        <RightSidebar />
      </div>
    </div>
  );
}
