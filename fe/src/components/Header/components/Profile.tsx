import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { resolveMediaUrl } from "@/utils/storage";
import {
  FiChevronDown,
  FiFileText,
  FiLogOut,
  FiUser,
  FiBriefcase,
  FiCalendar,
} from "react-icons/fi";
import { request } from "@/utils/api";

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
  const [myCompanySlug, setMyCompanySlug] = useState<string | null>(null);

  useEffect(() => {
    if (auth?.user) {
      request<any>({
        endpoint: "/api/v1/companies/my",
        onSuccess: (data) => {
          if (data && data.slug) {
            setMyCompanySlug(data.slug);
          } else {
            setMyCompanySlug(null);
          }
        },
        onFailure: () => {
          setMyCompanySlug(null);
        },
      });
    } else {
      setMyCompanySlug(null);
    }
  }, [auth?.user]);

  if (!auth) return null;

  const { logout, user } = auth;

  return (
    <div className="relative">
      <button
        className="flex h-11 items-center gap-2 rounded-full px-2 pl-2 pr-3 text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
        onClick={() => {
          setShowProfileMenu((prev) => !prev);
          if (window.innerWidth <= 1080) {
            setShowNavigationMenu(false);
          }
        }}
      >
        <span className="relative">
          <img
            className="h-9 w-9 rounded-full object-cover ring-2 ring-white"
            src={resolveMediaUrl(user?.profilePicture) || "/doc1.png"}
            alt=""
          />
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
        </span>
        <span className="hidden max-w-24 truncate text-sm font-bold lg:block">
          {user?.firstName}
        </span>
        {user?.role === "ADMIN" && (
          <span className="hidden lg:block rounded-md bg-red-50 border border-red-200 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-red-700 shrink-0">
            Admin
          </span>
        )}
        {user?.role === "RECRUITER" && (
          <span className="hidden lg:block rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-blue-700 shrink-0">
            Recruiter
          </span>
        )}
        <FiChevronDown
          className={`h-4 w-4 transition ${showProfileMenu ? "rotate-180" : ""}`}
        />
      </button>

      {showProfileMenu ? (
        <div className="absolute right-0 top-full z-50 mt-3 w-[19rem] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
          <div className="bg-gradient-to-br from-slate-950 to-red-900 px-5 pb-5 pt-6 text-white">
            <div className="flex items-center gap-3">
              <img
                className="h-14 w-14 rounded-full object-cover ring-4 ring-white/20"
                src={resolveMediaUrl(user?.profilePicture) || "/doc1.png"}
                alt=""
              />
              <div className="min-w-0">
                <div className="truncate text-base font-bold">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs font-medium text-white/75">
                  {user?.position} at {user?.company}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-1 p-2">
            <button
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-red-700"
              onClick={() => {
                setShowProfileMenu(false);
                navigate("/profile/" + user?.id);
              }}
            >
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-red-50 text-red-700">
                <FiUser className="h-4 w-4" />
              </span>
              View Profile
            </button>

            {user?.role === "USER" && (
              <button
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-red-700"
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate("/jobs/my-applications");
                }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiFileText className="h-4 w-4" />
                </span>
                My Applications
              </button>
            )}

            {user?.role === "USER" && (
              <button
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-red-700"
                onClick={() => {
                  setShowProfileMenu(false);
                  navigate("/ai/cv");
                }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiFileText className="h-4 w-4" />
                </span>
                AI CV
              </button>
            )}

            {myCompanySlug && (
              <>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-red-700"
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate(`/companies/${myCompanySlug}`);
                  }}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiBriefcase className="h-4 w-4" />
                  </span>
                  My Company
                </button>
                <button
                  className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50 hover:text-red-700"
                  onClick={() => {
                    setShowProfileMenu(false);
                    navigate(`/companies/${myCompanySlug}?tab=events`);
                  }}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiCalendar className="h-4 w-4" />
                  </span>
                  My Company Events
                </button>
              </>
            )}

            <Link
              to="/logout"
              className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-red-50 hover:text-red-700"
              onClick={(e) => {
                e.preventDefault();
                logout();
              }}
            >
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-red-50 text-red-700">
                <FiLogOut className="h-4 w-4" />
              </span>
              Sign Out
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
