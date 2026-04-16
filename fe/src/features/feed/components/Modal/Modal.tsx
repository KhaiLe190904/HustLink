import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import {
  isOversizedUpload,
  isVideoFile,
  MAX_UPLOAD_SIZE_LABEL,
  resolveMediaUrl,
} from "@/utils/storage";

const EMPTY_MEDIA_URLS: string[] = [];

interface PostingMadalProps {
  showModal: boolean;
  content?: string;
  mediaUrls?: string[];
  setShowModal: Dispatch<SetStateAction<boolean>>;
  onSubmit: (
    content: string,
    mediaUrls: string[],
    mediaFiles: File[]
  ) => Promise<void>;
  title: string;
  initialMediaFiles?: string[];
}
export function Madal({
  setShowModal,
  showModal,
  onSubmit,
  content,
  mediaUrls,
  title,
}: PostingMadalProps) {
  const normalizedMediaUrls = mediaUrls ?? EMPTY_MEDIA_URLS;
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draftContent, setDraftContent] = useState(content ?? "");
  const [retainedMediaUrls, setRetainedMediaUrls] =
    useState<string[]>(normalizedMediaUrls);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<
    { key: string; previewUrl: string; isVideo: boolean; name: string }[]
  >([]);

  useEffect(() => {
    if (!showModal) {
      return;
    }

    setDraftContent(content ?? "");
    setRetainedMediaUrls(normalizedMediaUrls.filter(Boolean));
    setSelectedFiles([]);
    setError("");
  }, [content, normalizedMediaUrls, showModal]);

  useEffect(() => {
    const previews = selectedFiles.map((file) => ({
      key: `${file.name}-${file.lastModified}`,
      previewUrl: URL.createObjectURL(file),
      isVideo: file.type.startsWith("video/"),
      name: file.name,
    }));
    setFilePreviews(previews);

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.previewUrl));
    };
  }, [selectedFiles]);

  if (!showModal) return null;

  const totalMediaCount = retainedMediaUrls.length + selectedFiles.length;

  const appendFiles = (files: File[]) => {
    if (!files.length) {
      return;
    }

    const validFiles = files.filter((file) => {
      if (isOversizedUpload(file)) {
        toast.error(
          `${file.name} exceeds the ${MAX_UPLOAD_SIZE_LABEL} upload limit.`
        );
        return false;
      }
      return true;
    });

    const availableSlots = Math.max(
      0,
      3 - (retainedMediaUrls.length + selectedFiles.length)
    );
    if (availableSlots === 0) {
      toast.error("You can upload up to 3 media files per post.");
      return;
    }

    setSelectedFiles((currentFiles) => [
      ...currentFiles,
      ...validFiles.slice(0, availableSlots),
    ]);

    if (validFiles.length > availableSlots) {
      toast.error("Only the first 3 media files can be attached to a post.");
    }
  };

  const resetModalState = () => {
    setDraftContent(content ?? "");
    setRetainedMediaUrls(normalizedMediaUrls.filter(Boolean));
    setSelectedFiles([]);
    setError("");
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-start z-[9999]">
      {" "}
      {/* .root styles */}
      <div className="bg-white rounded-lg border border-gray-300 w-full max-w-3xl mx-4 mt-18 p-4">
        {" "}
        {/* .modal styles */}
        <div className="flex justify-between items-center mb-4">
          {" "}
          {/* .header styles */}
          <h3 className="font-bold">{title}</h3> {/* .title styles */}
          <button
            onClick={() => {
              resetModalState();
              setShowModal(false);
            }}
            className="bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors cursor-pointer" /* header button styles */
          >
            X
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsLoading(true);

            if (!draftContent.trim() && totalMediaCount === 0) {
              setError("");
              setIsLoading(false);
              return;
            }

            try {
              await onSubmit(draftContent, retainedMediaUrls, selectedFiles);
              resetModalState();
              setShowModal(false);
            } catch (error) {
              if (error instanceof Error) {
                setError(error.message);
              } else {
                setError("An error occurred. Please try again later.");
              }
            } finally {
              setIsLoading(false);
            }
          }}
        >
          <div>
            {" "}
            {/* .body - minimal wrapper */}
            <textarea
              placeholder="What do you want to talk about?"
              onFocus={() => setError("")}
              onChange={(event) => {
                setDraftContent(event.target.value);
                setError("");
              }}
              name="content"
              value={draftContent}
              className="w-full h-80 resize-none border border-gray-300 rounded-lg p-4" /* textarea styles */
            />
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      appendFiles(files);
                      event.currentTarget.value = "";
                    }}
                  />
                  <svg
                    className="h-5 w-5 text-blue-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Photos</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      appendFiles(files);
                      event.currentTarget.value = "";
                    }}
                  />
                  <svg
                    className="h-5 w-5 text-green-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                  </svg>
                  <span>Videos</span>
                </label>
                <span className="text-xs text-gray-500">
                  Up to 3 media per post ({totalMediaCount}/3 selected)
                </span>
              </div>

              {(selectedFiles.length > 0 || retainedMediaUrls.length > 0) && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {retainedMediaUrls.map((url) => (
                    <div
                      key={url}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                    >
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setRetainedMediaUrls((currentUrls) =>
                              currentUrls.filter((mediaUrl) => mediaUrl !== url)
                            )
                          }
                          className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white hover:bg-black/80"
                        >
                          Remove
                        </button>
                      </div>
                      {isVideoFile(url) ? (
                        <video
                          src={resolveMediaUrl(url)}
                          className="h-32 w-full bg-black object-cover"
                          muted
                          controls
                        />
                      ) : (
                        <img
                          src={resolveMediaUrl(url)}
                          alt="Existing post media"
                          className="h-32 w-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                  {filePreviews.map((preview) => (
                    <div
                      key={preview.key}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                    >
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedFiles((currentFiles) =>
                              currentFiles.filter(
                                (file) =>
                                  `${file.name}-${file.lastModified}` !==
                                  preview.key
                              )
                            )
                          }
                          className="absolute right-2 top-2 z-10 rounded-full bg-black/70 px-2 py-1 text-xs font-medium text-white hover:bg-black/80"
                        >
                          Remove
                        </button>
                        {preview.isVideo ? (
                          <video
                            src={preview.previewUrl}
                            className="h-32 w-full bg-black object-cover"
                            muted
                            controls
                          />
                        ) : (
                          <img
                            src={preview.previewUrl}
                            alt={preview.name}
                            className="h-32 w-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-3">
                        <div className="line-clamp-1 text-sm font-medium text-gray-800">
                          {preview.name}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {preview.isVideo ? "Video" : "Image"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {error && <div className="text-red-500">{error}</div>}{" "}
          {/* .error styles */}
          <div>
            {" "}
            {/* .footer - minimal wrapper */}
            <Button size="medium" type="submit" disabled={isLoading}>
              Post
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
