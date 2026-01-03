import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IConnection } from "@/features/networking/components/Connection/Connection";
import { Button } from "@/features/authentication/components/Button/Button";
export function RightSidebar() {
  const [suggestions, setSuggestions] = useState<IUser[]>([]);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    request<IUser[]>({
      endpoint: "/api/v1/networking/suggestions",
      onSuccess: (data) => {
        const shuffled = data.sort(() => 0.5 - Math.random());
        setSuggestions(shuffled.slice(0, 2));
      },
      onFailure: (error) => console.log(error),
    });
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-300 p-4 shadow-sm">
      <h3 className="font-bold mb-2 text-gray-900">Add to your connexions</h3>
      <div className="grid gap-4">
        {suggestions
          .filter((s) => s.id != id)
          .map((suggestion) => {
            return (
              <div className="flex gap-3 text-xs" key={suggestion.id}>
                <button
                  className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-blue-200 transition-all cursor-pointer"
                  onClick={() => navigate("/profile/" + suggestion.id)}
                >
                  <img
                    src={suggestion.profilePicture || "/doc1.png"}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate("/profile/" + suggestion.id)}
                    className="text-left w-full hover:text-red-600 transition-colors cursor-pointer"
                  >
                    <div className="font-bold text-gray-900 truncate">
                      {suggestion.firstName} {suggestion.lastName}
                    </div>
                    <div className="text-gray-600 text-xs truncate">
                      {suggestion.position} at {suggestion.company}
                    </div>
                  </button>
                  <Button
                    size="small"
                    outline
                    className="w-auto mt-1 !my-0 !py-1 !px-2 text-xs"
                    onClick={() => {
                      request<IConnection>({
                        endpoint:
                          "/api/v1/networking/connections?recipientId=" +
                          suggestion.id,
                        method: "POST",
                        onSuccess: () => {
                          setSuggestions(
                            suggestions.filter((s) => s.id !== suggestion.id)
                          );
                        },
                        onFailure: (error) => console.log(error),
                      });
                    }}
                  >
                    + Connect
                  </Button>
                </div>
              </div>
            );
          })}

        {suggestions.length === 0 && (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">
              No suggestions available at the moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
