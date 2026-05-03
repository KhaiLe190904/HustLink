import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IPost, Post } from "@/features/feed/components/Post/Post";
import { Page } from "@/utils/pagination";

interface IActivityProps {
  user: IUser | null;
  authUser: IUser | null;
  id: string | undefined;
}
export function Activity({ user, authUser, id }: IActivityProps) {
  const [posts, setPosts] = useState<IPost[]>([]);
  useEffect(() => {
    request<Page<IPost>>({
      endpoint: `/api/v1/feed/posts/user/${id}/paginated?page=0&size=10`,
      onSuccess: (data) => setPosts(data.content),
      onFailure: (error) => console.log(error),
    });
  }, [id]);
  return (
    <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
      <h2 className="mb-4 text-xl font-bold text-slate-900">Latest post</h2>
      <div>
        {posts.length > 0 ? (
          <>
            <Post key={posts[0].id} post={posts[0]} setPosts={setPosts} />

            <Link
              className="mt-4 inline-block rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              to={`/profile/${user?.id}/posts`}
            >
              See more
            </Link>
          </>
        ) : (
          <p className="py-8 text-center text-slate-500">
            {authUser?.id == user?.id
              ? "You have no posts yet."
              : "This user has no posts yet."}
          </p>
        )}
      </div>
    </div>
  );
}
