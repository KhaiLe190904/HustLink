import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/Input/Input";
import { Box } from "@/features/authentication/components/Box/Box";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { Button } from "@/features/authentication/components/Button/Button";
import { request } from "@/utils/api";

interface ILocationSuggestion {
  locationDisplay: string;
  locationKey: string;
}

export function Profile() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { user, setUser } = useAuthentication();
  const [error, setError] = useState("");
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    company: "",
    position: "",
    locationDisplay: "",
    locationKey: "",
  });
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<
    ILocationSuggestion[]
  >([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);

  useEffect(() => {
    if (step !== 2 || locationQuery.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      request<ILocationSuggestion[]>({
        endpoint: `/api/v1/locations/search?query=${encodeURIComponent(
          locationQuery.trim()
        )}&limit=5`,
        onSuccess: (suggestions) => setLocationSuggestions(suggestions),
        onFailure: () => setLocationSuggestions([]),
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [step, locationQuery]);

  const onSubmit = async () => {
    if (!data.firstName || !data.lastName) {
      setError("Please fill in your first and last name.");
      return;
    }
    if (!data.company || !data.position) {
      setError("Please fill in your latest company and position.");
      return;
    }
    if (!data.locationDisplay) {
      setError("Please choose your location.");
      return;
    }
    if (!data.locationKey) {
      setError("Please select a location from search results.");
      return;
    }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/authentication/profile/${user?.id}?firstName=${
          data.firstName
        }&lastName=${data.lastName}&company=${data.company}&position=${data.position}&locationDisplay=${encodeURIComponent(
          data.locationDisplay
        )}&locationKey=${encodeURIComponent(data.locationKey)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
      } else {
        const { message } = await res.json();
        throw new Error(message);
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      navigate("/");
    }
  };
  return (
    <div className="">
      <Box >
        <h1>Only one last step</h1>
        <p>Tell us about you so we can personalize your experience.</p>
        {step === 0 && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <Input
              onFocus={() => setError("")}
              required
              label="First Name"
              name="firstName"
              onChange={(e) =>
                setData((prev) => ({ ...prev, firstName: e.target.value }))
              }
            ></Input>
            <Input
              onFocus={() => setError("")}
              required
              label="Last Name"
              name="lastName"
              onChange={(e) =>
                setData((prev) => ({ ...prev, lastName: e.target.value }))
              }
            ></Input>
          </div>
        )}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <Input
              onFocus={() => setError("")}
              label="Latest company"
              name="company"
              onChange={(e) =>
                setData((prev) => ({ ...prev, company: e.target.value }))
              }
            ></Input>
            <Input
              onFocus={() => setError("")}
              onChange={(e) =>
                setData((prev) => ({ ...prev, position: e.target.value }))
              }
              label="Latest position"
              name="position"
            ></Input>
          </div>
        )}
        {step == 2 && (
          <div className="relative mt-2">
            <Input
              value={locationQuery}
              onFocus={() => {
                setError("");
                setShowLocationSuggestions(true);
              }}
              onBlur={() =>
                window.setTimeout(() => setShowLocationSuggestions(false), 150)
              }
              label="Location"
              name="location"
              onChange={(e) => {
                const value = e.target.value;
                setLocationQuery(value);
                setData((prev) => ({
                  ...prev,
                  locationDisplay: value,
                  locationKey: "",
                }));
                if (value.trim()) {
                  setError("Please select a location from search results.");
                } else {
                  setError("");
                }
                setShowLocationSuggestions(true);
              }}
            ></Input>
            {showLocationSuggestions && locationSuggestions.length > 0 ? (
              <div className="absolute z-30 -mt-3 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {locationSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.locationKey}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setLocationQuery(suggestion.locationDisplay);
                      setData((prev) => ({
                        ...prev,
                        locationDisplay: suggestion.locationDisplay,
                        locationKey: suggestion.locationKey,
                      }));
                      setError("");
                      setShowLocationSuggestions(false);
                    }}
                    className="block w-full border-b border-slate-100 px-4 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                  >
                    {suggestion.locationDisplay}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {error && <p className="text-red-500 text-sm -mt-2">{error}</p>}
        <div className="flex gap-4 justify-end">
          {step > 0 && (
            <Button outline onClick={() => setStep((prev) => prev - 1)}>
              Back
            </Button>
          )}
          {step < 2 && (
            <Button
              disabled={
                (step === 0 && (!data.firstName || !data.lastName)) ||
                (step === 1 && (!data.company || !data.position))
              }
              onClick={() => setStep((prev) => prev + 1)}
            >
              Next
            </Button>
          )}
          {step === 2 && (
            <Button
              disabled={!data.locationDisplay || !data.locationKey}
              onClick={onSubmit}
            >
              Submit
            </Button>
          )}
        </div>
      </Box>
    </div>
  );
}
