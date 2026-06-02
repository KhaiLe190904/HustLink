import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IUser } from "../../../../features/authentication/context/AuthenticationContextProvider";
import { request } from "../../../../utils/api";
import { resolveMediaUrl } from "@/utils/storage";
import { FiSearch } from "react-icons/fi";

export function Search() {
  const [searchTerm, setSearchTerm] = useState("");
  const [suggestions, setSuggestions] = useState<IUser[]>([]);
  const [searchMode, setSearchMode] = useState<"hybrid" | "semantic" | "bm25">(
    "bm25"
  );
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequestIdRef = useRef(0);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      latestRequestIdRef.current += 1;
      const currentRequestId = latestRequestIdRef.current;
      setLoading(true);
      request<IUser[]>({
        endpoint:
          "/api/v1/search/users?query=" +
          encodeURIComponent(query) +
          "&mode=" +
          searchMode,
        onSuccess: (data) => {
          if (currentRequestId === latestRequestIdRef.current) {
            setSuggestions(data);
            setLoading(false);
          }
        },
        onFailure: () => {
          if (currentRequestId === latestRequestIdRef.current) {
            setSuggestions([]);
            setLoading(false);
          }
        },
      });
    },
    [searchMode]
  );

  useEffect(() => {
    const query = searchTerm.trim();
    if (query.length < 2) {
      latestRequestIdRef.current += 1;
      setLoading(false);
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void fetchSuggestions(query);
    }, 5000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchTerm, searchMode, fetchSuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const query = searchTerm.trim();
      if (query.length >= 2) {
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }
        void fetchSuggestions(query);
      }
    }
  };

  return (
    <div className="relative">
      <FiSearch className="pointer-events-none absolute left-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-slate-500" />
      <input
        onChange={(e) => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find people, posts, ..."
        value={searchTerm}
        className="h-11 w-full rounded-full border border-slate-200 bg-slate-100/80 pl-[3.25rem] pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-500 hover:bg-slate-50 focus:border-red-200 focus:bg-white focus:ring-4 focus:ring-red-50"
      />
      {searchTerm.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.75rem)] z-[999] rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10">
          <div className="flex items-center gap-2 mb-2 px-1 pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider select-none">
              Mode:
            </span>
            {(["bm25", "semantic", "hybrid"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSearchMode(m)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                  searchMode === m
                    ? "bg-red-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {m === "bm25"
                  ? "Lexical (BM25)"
                  : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="py-6 text-center text-xs font-medium text-slate-400 select-none flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
              <span>Searching...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto pr-1">
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
          ) : (
            <div className="py-6 text-center text-xs font-medium text-slate-400 select-none">
              No profiles found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
