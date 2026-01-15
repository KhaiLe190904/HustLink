import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IUser } from "../../../../features/authentication/context/AuthenticationContextProvider";
import { request } from "../../../../utils/api";
import { Input } from "../../../Input/Input";

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
      <Input
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="🔍 Find people, posts, ..."
        size="medium"
        value={searchTerm}
        className="placeholder:text-gray-400 placeholder:text-sm"
      />
      {suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-b-md z-[999] max-h-64 overflow-y-auto shadow-md">
          {suggestions.map((user) => (
            <li
              key={user.id}
              className="border-b border-gray-200 last:border-b-0"
            >
              <button
                onClick={() => {
                  setSuggestions([]);
                  setSearchTerm("");
                  navigate(`/profile/${user.id}`);
                }}
                className="flex items-center gap-2 p-2 w-full hover:bg-gray-50 transition-colors"
              >
                <img
                  className="w-12 h-12 rounded-full object-cover"
                  src={user.profilePicture || "/doc1.png"}
                  alt=""
                />
                <div className="text-left">
                  <div className="font-bold text-sm">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-gray-600">
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
