import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader } from "@/components/Loader/Loader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { request } from "@/utils/api";
import {
  IUser,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { RightSidebar } from "@/features/feed/components/RightSidebar/RightSidebar";
import { About } from "@/features/profile/components/About/About";
import { Activity } from "@/features/profile/components/Activity/Activity";
import { Header } from "@/features/profile/components/Header/Header";

export function Profile() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const { user: authUser, setUser: setAuthUser } = useAuthentication();
  const [user, setUser] = useState<IUser | null>(null);

  usePageTitle(user?.firstName + " " + user?.lastName);

  useEffect(() => {
    setLoading(true);
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

  const handleUpdate = (updatedUser: IUser) => {
    setUser(updatedUser);
    // Nếu đang xem profile của chính mình, cập nhật cả authUser trong context
    if (id == authUser?.id) {
      setAuthUser(updatedUser);
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_20rem] xl:items-start">
      <section className="grid gap-6">
        <Header user={user} authUser={authUser} onUpdate={handleUpdate} />
        <About user={user} authUser={authUser} onUpdate={handleUpdate} />
        <Activity authUser={authUser} user={user} id={id} />

        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <h2 className="font-bold mb-4">Experience</h2>
          <p className="text-gray-600">TODO()</p>
        </div>
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <h2 className="font-bold mb-4">Education</h2>
          <p className="text-gray-600">TODO()</p>
        </div>
      </section>
      <div className="hidden xl:block">
        <RightSidebar />
      </div>
    </div>
  );
}
