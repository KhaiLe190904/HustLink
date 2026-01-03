import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IPost, Post } from "@/features/feed/components/Post/Post";

interface IActivityProps {
  user: IUser | null;
  authUser: IUser | null;
  id: string | undefined;
}
export function Activity({ user, authUser, id }: IActivityProps) {
  const [posts, setPosts] = useState<IPost[]>([]);
  useEffect(() => {
    request<IPost[]>({
      endpoint: `/api/v1/feed/posts/user/${id}`,
      onSuccess: (data) => setPosts(data),
      onFailure: (error) => console.log(error),
    });
  }, [id]);
  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Latest post</h2>
      <div>
        {posts.length > 0 ? (
          <>
            <Post
              key={posts[posts.length - 1].id}
              post={posts[posts.length - 1]}
              setPosts={setPosts}
            />

            <Link
              className="inline-block mt-4 text-red-600 hover:text-red-800 font-medium transition-colors"
              to={`/profile/${user?.id}/posts`}
            >
              See more
            </Link>
          </>
        ) : (
          <p className="text-gray-500 text-center py-8">
            {authUser?.id == user?.id
              ? "You have no posts yet."
              : "This user has no posts yet."}
          </p>
        )}
      </div>
    </div>
  );
}
