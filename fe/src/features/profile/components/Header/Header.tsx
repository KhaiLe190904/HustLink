import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Input } from "@/components/Input/Input";
import { request } from "@/utils/api";
import { IUser } from "@/features/authentication/context/AuthenticationContextProvider";
import { IConnection } from "@/features/networking/components/Connection/Connection";
import {
  isOversizedUpload,
  MAX_UPLOAD_SIZE_LABEL,
  resolveMediaUrl,
  uploadToStorage,
} from "@/utils/storage";

import { Button } from "@/features/authentication/components/Button/Button";
import { FiSave, FiX } from "react-icons/fi";
import { ReportContentModal } from "@/features/feed/components/ReportContentModal/ReportContentModal";
interface ILocationSuggestion {
  locationDisplay: string;
  locationKey: string;
}
interface ITopProps {
  user: IUser | null;
  authUser: IUser | null;
  onUpdate: (user: IUser) => void;
}
export function Header({ user, authUser, onUpdate }: ITopProps) {
  const [editingInfo, setEditingInfo] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [info, setInfo] = useState({
    firstName: user?.firstName,
    lastName: user?.lastName,
    position: user?.position,
    company: user?.company,
    locationDisplay: user?.locationDisplay || "",
    locationKey: user?.locationKey,
    profilePicture: user?.profilePicture,
    coverPicture: user?.coverPicture,
  });
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(
    null
  );
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState<
    ILocationSuggestion[]
  >([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [connexions, setConnections] = useState<IConnection[]>([]);
  const [invitations, setInvitations] = useState<IConnection[]>([]);
  const connection =
    connexions.find(
      (c) => c.recipient.id === user?.id || c.author.id === user?.id
    ) ||
    invitations.find(
      (c) => c.recipient.id === user?.id || c.author.id === user?.id
    );
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    "Unnamed user";
  const displayHeadline =
    user?.position && user?.company
      ? `${user.position} at ${user.company}`
      : user?.position || user?.company || "";
  const displayLocation = user?.locationDisplay || "";

  useEffect(() => {
    setInfo({
      firstName: user?.firstName,
      lastName: user?.lastName,
      position: user?.position,
      company: user?.company,
      locationDisplay: user?.locationDisplay || "",
      locationKey: user?.locationKey,
      profilePicture: user?.profilePicture,
      coverPicture: user?.coverPicture,
    });
    setLocationQuery(user?.locationDisplay || "");
    setLocationError("");
  }, [user]);

  useEffect(() => {
    if (!profileImageFile) {
      setProfilePreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(profileImageFile);
    setProfilePreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [profileImageFile]);

  useEffect(() => {
    if (!coverImageFile) {
      setCoverPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(coverImageFile);
    setCoverPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [coverImageFile]);

  useEffect(() => {
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections",
      onSuccess: (data) => setConnections(data),
      onFailure: (error) => console.log(error),
    });
  }, []);

  useEffect(() => {
    request<IConnection[]>({
      endpoint: "/api/v1/networking/connections?status=PENDING",
      onSuccess: (data) => setInvitations(data),
      onFailure: (error) => console.log(error),
    });
  }, [user?.id]);

  useEffect(() => {
    if (!editingInfo || locationQuery.trim().length < 2) {
      setLocationSuggestions([]);
      return;
    }
    const timeoutId = window.setTimeout(() => {
      request<ILocationSuggestion[]>({
        endpoint: `/api/v1/locations/search?query=${encodeURIComponent(
          locationQuery.trim()
        )}&limit=5`,
        onSuccess: (data) => setLocationSuggestions(data),
        onFailure: () => setLocationSuggestions([]),
      });
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [editingInfo, locationQuery]);

  async function updateInfo() {
    try {
      if (!(info.locationDisplay || "").trim()) {
        throw new Error("Please choose your location.");
      }

      if (!(info.locationKey || "").trim()) {
        throw new Error("Please select a location from search results.");
      }

      if (profileImageFile && isOversizedUpload(profileImageFile)) {
        throw new Error(
          `${profileImageFile.name} exceeds the ${MAX_UPLOAD_SIZE_LABEL} upload limit.`
        );
      }

      if (coverImageFile && isOversizedUpload(coverImageFile)) {
        throw new Error(
          `${coverImageFile.name} exceeds the ${MAX_UPLOAD_SIZE_LABEL} upload limit.`
        );
      }

      let profilePicture = info.profilePicture;
      let coverPicture = info.coverPicture;

      if (profileImageFile) {
        const storedObject = await uploadToStorage({
          file: profileImageFile,
          scope: "PROFILE_IMAGE",
          ownerType: "USER",
          ownerId: user?.id,
        });
        profilePicture = storedObject.accessUrl;
      }

      if (coverImageFile) {
        const storedObject = await uploadToStorage({
          file: coverImageFile,
          scope: "PROFILE_COVER",
          ownerType: "USER",
          ownerId: user?.id,
        });
        coverPicture = storedObject.accessUrl;
      }

      await request<IUser>({
        endpoint: `/api/v1/authentication/profile/${user?.id}?firstName=${encodeURIComponent(info.firstName || "")}&lastName=${encodeURIComponent(info.lastName || "")}&position=${encodeURIComponent(info.position || "")}&company=${encodeURIComponent(info.company || "")}&locationDisplay=${encodeURIComponent(info.locationDisplay || "")}&locationKey=${encodeURIComponent(info.locationKey || "")}&profilePicture=${encodeURIComponent(profilePicture || "")}&coverPicture=${encodeURIComponent(coverPicture || "")}`,
        method: "PUT",
        onSuccess: (data) => {
          onUpdate(data);
          setEditingInfo(false);
          setProfileImageFile(null);
          setCoverImageFile(null);
          setLocationError("");
        },
        onFailure: (error) => {
          toast.error(error);
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update profile.";
      if (
        message.includes("location") ||
        message.includes("Location") ||
        message.includes("search results")
      ) {
        setLocationError(message);
      }
      toast.error(message);
      setProfileImageFile(null);
      setCoverImageFile(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <img
        className="h-52 w-full object-cover"
        src={
          editingInfo
            ? coverPreviewUrl ||
              resolveMediaUrl(info.coverPicture) ||
              "/cover.jpeg"
            : resolveMediaUrl(user?.coverPicture) || "/cover.jpeg"
        }
        alt="Cover"
      />

      <div className="relative -mt-16 ml-6 mb-4">
        <img
          className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-lg"
          src={
            editingInfo
              ? profilePreviewUrl ||
                resolveMediaUrl(info.profilePicture) ||
                "/doc1.png"
              : resolveMediaUrl(user?.profilePicture) || "/doc1.png"
          }
          alt="Profile"
        />
      </div>

      <div className="relative px-6 pb-6">
        <div>
          {!editingInfo ? (
            <div>
              <div className="mb-1 text-3xl font-bold text-slate-900">
                {displayName}
              </div>
              {displayHeadline ? (
                <div className="mb-1 text-lg text-slate-700">
                  {displayHeadline}
                </div>
              ) : null}
              {displayLocation ? (
                <div className="text-sm text-slate-500">{displayLocation}</div>
              ) : null}

              {user?.id === authUser?.id ? (
                <button
                  className="absolute right-4 top-1 grid h-10 w-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
                  onClick={() => setEditingInfo(true)}
                >
                  <svg
                    className="h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 512 512"
                    fill="currentColor"
                  >
                    <path d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z" />
                  </svg>
                </button>
              ) : (
                <button
                  className="absolute right-4 top-1 grid h-10 w-10 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-650 cursor-pointer"
                  title="Report Profile"
                  onClick={() => setShowReportModal(true)}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 128 512"
                    className="w-3.5 h-3.5"
                    fill="currentColor"
                  >
                    <path d="M64 360a56 56 0 1 0 0 112 56 56 0 1 0 0-112zm0-160a56 56 0 1 0 0 112 56 56 0 1 0 0-112zM120 96A56 56 0 1 0 8 96a56 56 0 1 0 112 0z" />
                  </svg>
                </button>
              )}

              {user?.id !== authUser?.id && (
                <>
                  {!connection ? (
                    <Button
                      size="medium"
                      outline
                      className="mt-4"
                      onClick={() => {
                        request<IConnection>({
                          endpoint:
                            "/api/v1/networking/connections?recipientId=" +
                            user?.id,
                          method: "POST",
                          onSuccess: (data) => {
                            setInvitations([...invitations, data]);
                          },
                          onFailure: (error) => console.log(error),
                        });
                      }}
                    >
                      + Connect
                    </Button>
                  ) : (
                    <Button
                      size="medium"
                      outline
                      className="mt-4"
                      onClick={() => {
                        request<IConnection>({
                          endpoint: `/api/v1/networking/connections/${connection?.id}`,
                          method: "DELETE",
                          onSuccess: () => {
                            setConnections((connections) =>
                              connections.filter((c) => c.id !== connection?.id)
                            );
                            setInvitations((invitations) =>
                              invitations.filter((c) => c.id !== connection?.id)
                            );
                          },
                          onFailure: (error) => console.log(error),
                        });
                      }}
                    >
                      {connection?.status === "ACCEPTED"
                        ? "Remove connection"
                        : authUser?.id === connection?.author.id
                          ? "Cancel invitation"
                          : "Ignore invitation"}
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-3">
                <div className="mb-1 text-3xl font-bold text-slate-900">
                  {[(info.firstName || "").trim(), (info.lastName || "").trim()]
                    .filter(Boolean)
                    .join(" ") || "Unnamed user"}
                </div>
                {(info.position || "").trim() || (info.company || "").trim() ? (
                  <div className="mb-1 text-lg text-slate-700">
                    {(info.position || "").trim() && (info.company || "").trim()
                      ? `${(info.position || "").trim()} at ${(info.company || "").trim()}`
                      : (info.position || "").trim() ||
                        (info.company || "").trim()}
                  </div>
                ) : null}
                {(info.locationDisplay || "").trim() ? (
                  <div className="text-sm text-slate-500">
                    {(info.locationDisplay || "").trim()}
                  </div>
                ) : null}
              </div>
              <div className="mb-2 flex justify-end gap-4">
                <button
                  className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100"
                  onClick={() => {
                    setEditingInfo(false);
                    setInfo({
                      firstName: user?.firstName || "",
                      lastName: user?.lastName || "",
                      company: user?.company || "",
                      position: user?.position || "",
                      locationDisplay: user?.locationDisplay || "",
                      locationKey: user?.locationKey || "",
                      profilePicture: user?.profilePicture || "",
                      coverPicture: user?.coverPicture || "",
                    });
                    setLocationQuery(user?.locationDisplay || "");
                    setShowLocationSuggestions(false);
                    setLocationError("");
                    setProfileImageFile(null);
                    setCoverImageFile(null);
                  }}
                >
                  <FiX className="h-7 w-7" />
                </button>
                <button
                  className="grid h-9 w-9 place-items-center rounded-full text-emerald-600 transition hover:bg-emerald-50"
                  onClick={updateInfo}
                >
                  <FiSave className="h-7 w-7" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Input
                  value={info?.firstName}
                  onChange={(e) =>
                    setInfo({ ...info, firstName: e.target.value })
                  }
                  placeholder="First name"
                />
                <Input
                  value={info?.lastName}
                  onChange={(e) =>
                    setInfo({ ...info, lastName: e.target.value })
                  }
                  placeholder="Last name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 -mt-2">
                <Input
                  value={info?.company}
                  onChange={(e) =>
                    setInfo({ ...info, company: e.target.value })
                  }
                  placeholder="Company"
                />
                <Input
                  value={info?.position}
                  onChange={(e) =>
                    setInfo({ ...info, position: e.target.value })
                  }
                  placeholder="Position"
                />
              </div>
              <div className="relative -mt-2">
                <input
                  value={locationQuery}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setLocationQuery(nextValue);
                    setInfo({
                      ...info,
                      locationDisplay: nextValue,
                      locationKey: "",
                    });
                    setLocationError(
                      nextValue.trim()
                        ? "Please select a location from suggestions."
                        : ""
                    );
                    setShowLocationSuggestions(true);
                  }}
                  onFocus={() => {
                    setShowLocationSuggestions(true);
                    if (
                      !(info.locationKey || "").trim() &&
                      locationQuery.trim()
                    ) {
                      setLocationError(
                        "Please select a location from suggestions."
                      );
                    }
                  }}
                  onBlur={() =>
                    window.setTimeout(
                      () => setShowLocationSuggestions(false),
                      150
                    )
                  }
                  placeholder="Search city (e.g. Ho Chi Minh City, Vietnam)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-red-300"
                />
                {showLocationSuggestions && locationSuggestions.length > 0 ? (
                  <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {locationSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.locationKey}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setLocationQuery(suggestion.locationDisplay);
                          setInfo({
                            ...info,
                            locationDisplay: suggestion.locationDisplay,
                            locationKey: suggestion.locationKey,
                          });
                          setLocationError("");
                          setShowLocationSuggestions(false);
                        }}
                        className="block w-full border-b border-slate-100 px-4 py-2 text-left text-base text-slate-700 last:border-b-0 hover:bg-slate-50"
                      >
                        {suggestion.locationDisplay}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {locationError ? (
                <p className="mt-2 text-sm text-red-500">{locationError}</p>
              ) : null}
              <div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
                  <label className="text-sm font-medium text-gray-700">
                    Profile image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-2 block w-full text-sm text-gray-600"
                    onChange={(e) =>
                      setProfileImageFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
                  <label className="text-sm font-medium text-gray-700">
                    Cover image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-2 block w-full text-sm text-gray-600"
                    onChange={(e) =>
                      setCoverImageFile(e.target.files?.[0] ?? null)
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {user?.id && (
        <ReportContentModal
          showModal={showReportModal}
          setShowModal={setShowReportModal}
          targetType="USER"
          targetId={user.id}
        />
      )}
    </div>
  );
}
