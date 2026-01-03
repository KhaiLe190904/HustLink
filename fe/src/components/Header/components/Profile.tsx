import { Link, useNavigate } from "react-router-dom";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { Button } from "@/features/authentication/components/Button/Button";

interface ProfileProps {
  setShowNavigationMenu: (show: boolean) => void;
  showProfileMenu: boolean;
  setShowProfileMenu: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Profile({
  showProfileMenu,
  setShowProfileMenu,
  setShowNavigationMenu,
}: ProfileProps) {
  const auth = useAuthentication();
  const navigate = useNavigate();

  if (!auth) return null;

  const { logout, user } = auth;

  return (
    <div className="relative">
      <button
        className="flex items-center gap-3 p-3 rounded-lg transition-all lg:flex-col lg:gap-1 lg:p-2 lg:rounded-md hover:bg-gray-100 lg:hover:bg-gray-50 text-gray-600 hover:text-gray-900"
        onClick={() => {
          setShowProfileMenu((prev) => !prev);
          if (window.innerWidth <= 1080) {
            setShowNavigationMenu(false);
          }
        }}
      >
        <img
          className="w-6 h-6 lg:w-5 lg:h-5 rounded-full"
          src={
            user?.profilePicture
              ? `${import.meta.env.VITE_API_URL}/api/v1/storage/${
                  user?.profilePicture
                }`
              : "/doc1.png"
          }
          alt=""
        />
        <span className="text-sm font-medium lg:text-xs whitespace-nowrap">
          {user?.firstName + " " + user?.lastName?.charAt(0) + "."}
        </span>
      </button>
      {showProfileMenu ? (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl p-4 w-72 shadow-lg z-50">
          <div className="grid gap-3 grid-cols-[3rem_1fr] items-center">
            <img
              className="w-12 h-12 rounded-full"
              src={
                user?.profilePicture
                  ? `${import.meta.env.VITE_API_URL}/api/v1/storage/${
                      user?.profilePicture
                    }`
                  : "/doc1.png"
              }
              alt=""
            />
            <div>
              <div className="font-semibold text-gray-900 whitespace-nowrap">
                {user?.firstName + " " + user?.lastName}
              </div>
              <div className="text-sm text-gray-600">
                {user?.position + " at " + user?.company}
              </div>
            </div>
          </div>
          <div className="grid gap-2 mt-4 pt-3 border-t border-gray-100">
            <Button
              size="small"
              className="mb-0 w-full"
              outline
              onClick={() => {
                setShowProfileMenu(false);
                navigate("/profile/" + user?.id);
              }}
            >
              View Profile
            </Button>
            <Link
              to="/logout"
              className="text-sm text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
            >
              Sign Out
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
