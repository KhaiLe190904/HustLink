import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { request } from "@/utils/api";
import { LeftSidebar } from "@/features/feed/components/LeftSidebar/LeftSidebar";
import { Post, IPost } from "@/features/feed/components/Post/Post";
import { RightSidebar } from "@/features/feed/components/RightSidebar/RightSidebar";

import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
export function PostPage() {
  const [posts, setPosts] = useState<IPost[]>([]);
  const { user } = useAuthentication();
  const { id } = useParams();

  useEffect(() => {
    request<IPost>({
      endpoint: `/api/v1/feed/posts/${id}`,
      onSuccess: (post) => setPosts([post]),
      onFailure: (error) => console.log(error),
    });
  }, [id]);

  return (
    <div className="grid gap-8 xl:grid-cols-[14rem_1fr_20rem] xl:items-start">
      <div className="hidden xl:block">
        <LeftSidebar user={user} />
      </div>
      <div className="flex justify-center">
        {posts.length > 0 && <Post setPosts={setPosts} post={posts[0]} />}
      </div>
      <div className="hidden xl:block">
        <RightSidebar />
      </div>
    </div>
  );
}
