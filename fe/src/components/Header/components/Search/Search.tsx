import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IUser } from "../../../../features/authentication/context/AuthenticationContextProvider";
import { request } from "../../../../utils/api";
import { resolveMediaUrl } from "@/utils/storage";
import { FiSearch } from "react-icons/fi";

export function Search() {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<IUser[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.length > 0) {
        request<IUser[]>({
          endpoint:
            "/api/v1/search/users?query=" + encodeURIComponent(searchTerm),
          onSuccess: (data) => setSuggestions(data),
          onFailure: () => setSuggestions([]),
        });
      } else {
        setSuggestions([]);
      }
    };
    const delayDebounceFn = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <div className="relative">
      <FiSearch className="pointer-events-none absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-500" />
      <input
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Find people, posts, ..."
        value={searchTerm}
        className="h-11 w-full rounded-full border border-slate-200 bg-slate-100/80 pl-[3.25rem] pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-500 hover:bg-slate-50 focus:border-red-200 focus:bg-white focus:ring-4 focus:ring-red-50"
      />
      {suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-[999] max-h-72 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10">
          {suggestions.map((user) => (
            <li
              key={user.id}
              className="border-b border-slate-100 last:border-b-0"
            >
              <button
                onClick={() => {
                  setSuggestions([]);
                  setSearchTerm("");
                  navigate(`/profile/${user.id}`);
                }}
                className="flex w-full items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-slate-50"
              >
                <img
                  className="h-11 w-11 rounded-full object-cover"
                  src={resolveMediaUrl(user.profilePicture) || "/doc1.png"}
                  alt=""
                />
                <div className="min-w-0 text-left">
                  <div className="truncate text-sm font-bold text-slate-950">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="truncate text-xs font-medium text-slate-500">
                    {user.position} at {user.company}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
