import { Dispatch, SetStateAction, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import {
  isOversizedUpload,
  isVideoFile,
  MAX_UPLOAD_SIZE_LABEL,
  resolveMediaUrl,
} from "@/utils/storage";
import { FiX } from "react-icons/fi";

const EMPTY_MEDIA_URLS: string[] = [];
export const ARTICLE_CONTENT_PREFIX = "__ARTICLE__:";

interface PostingMadalProps {
  showModal: boolean;
  content?: string;
  mediaUrls?: string[];
  mode?: "post" | "article";
  setShowModal: Dispatch<SetStateAction<boolean>>;
  onSubmit: (
    content: string,
    mediaUrls: string[],
    mediaFiles: File[]
  ) => Promise<void>;
  title: string;
  initialMediaFiles?: string[];
}

export interface ArticlePayload {
  title: string;
  summary: string;
  contentHtml: string;
  tags: string[];
}

function normalizeArticleHtml(contentHtml: string) {
  let normalized = contentHtml;

  normalized = normalized.replace(/<p>\s*##\s*(.*?)\s*<\/p>/gi, "<h2>$1</h2>");
  normalized = normalized.replace(/<p>\s*-\s*(.*?)\s*<\/p>/gi, "<li>$1</li>");
  normalized = normalized.replace(/(<li>.*?<\/li>)/gis, "<ul>$1</ul>");
  normalized = normalized.replace(/<\/ul>\s*<ul>/gi, "");
  normalized = normalized.replace(/<p>\s*<\/p>/gi, "");

  return normalized;
}

function parseArticlePayload(content: string): ArticlePayload | null {
  if (!content.startsWith(ARTICLE_CONTENT_PREFIX)) {
    return null;
  }

  try {
    const raw = content.slice(ARTICLE_CONTENT_PREFIX.length);
    const parsed = JSON.parse(raw) as Partial<ArticlePayload>;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.summary !== "string" ||
      typeof parsed.contentHtml !== "string" ||
      !Array.isArray(parsed.tags)
    ) {
      return null;
    }
    return {
      title: parsed.title,
      summary: parsed.summary,
      contentHtml: parsed.contentHtml,
      tags: parsed.tags.filter((tag) => typeof tag === "string"),
    };
  } catch {
    return null;
  }
}

export function buildArticleContent(payload: ArticlePayload) {
  return `${ARTICLE_CONTENT_PREFIX}${JSON.stringify(payload)}`;
}

function paragraphize(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

export function Madal({
  setShowModal,
  showModal,
  onSubmit,
  content,
  mediaUrls,
  mode = "post",
  title,
}: PostingMadalProps) {
  const normalizedMediaUrls = mediaUrls ?? EMPTY_MEDIA_URLS;
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draftContent, setDraftContent] = useState(content ?? "");
  const [retainedMediaUrls, setRetainedMediaUrls] =
    useState<string[]>(normalizedMediaUrls);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showArticlePreview, setShowArticlePreview] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSummary, setArticleSummary] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const [articleTags, setArticleTags] = useState("");
  const [filePreviews, setFilePreviews] = useState<
    { key: string; previewUrl: string; isVideo: boolean; name: string }[]
  >([]);

  useEffect(() => {
    if (!showModal) {
      return;
    }

    const parsed = content ? parseArticlePayload(content) : null;
    setDraftContent(content ?? "");
    setRetainedMediaUrls(normalizedMediaUrls.filter(Boolean));
    setSelectedFiles([]);
    setError("");
    setShowArticlePreview(false);

    if (parsed) {
      setArticleTitle(parsed.title);
      setArticleSummary(parsed.summary);
      setArticleBody(parsed.contentHtml.replace(/<[^>]+>/g, "\n"));
      setArticleTags(parsed.tags.join(", "));
    } else {
      setArticleTitle("");
      setArticleSummary("");
      setArticleBody(
        "## Introduction\n-\n\n## Main Points\n- Point 1\n- Point 2\n"
      );
      setArticleTags("");
    }
  }, [content, normalizedMediaUrls, showModal]);

  useEffect(() => {
    if (!showModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showModal]);

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

  const articlePayload: ArticlePayload = useMemo(
    () => ({
      title: articleTitle.trim(),
      summary: articleSummary.trim(),
      contentHtml: paragraphize(articleBody),
      tags: articleTags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.replace(/^#/, "")),
    }),
    [articleBody, articleSummary, articleTags, articleTitle]
  );
  const normalizedPreviewHtml = useMemo(
    () => normalizeArticleHtml(articlePayload.contentHtml),
    [articlePayload.contentHtml]
  );

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
    setShowArticlePreview(false);
  };

  const previewCoverFromRetained = retainedMediaUrls.find(
    (url) => !isVideoFile(url)
  );
  const previewCoverFromUpload = filePreviews.find((file) => !file.isVideo);
  const articlePreviewCoverUrl =
    previewCoverFromUpload?.previewUrl ||
    (previewCoverFromRetained ? resolveMediaUrl(previewCoverFromRetained) : "");

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/50"
      onClick={() => {
        resetModalState();
        setShowModal(false);
      }}
    >
      <div
        className="mt-18 mx-4 w-full max-w-4xl rounded-lg border border-gray-300 bg-white p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold">{title}</h3>
          <button
            onClick={() => {
              resetModalState();
              setShowModal(false);
            }}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-gray-200 transition-colors hover:bg-gray-300"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsLoading(true);

            const finalContent =
              mode === "article"
                ? buildArticleContent(articlePayload)
                : draftContent;

            if (!finalContent.trim() && totalMediaCount === 0) {
              setError("");
              setIsLoading(false);
              return;
            }

            if (mode === "article" && !articlePayload.title) {
              setError("Article title is required.");
              setIsLoading(false);
              return;
            }

            try {
              await onSubmit(finalContent, retainedMediaUrls, selectedFiles);
              resetModalState();
              setShowModal(false);
            } catch (submissionError) {
              if (submissionError instanceof Error) {
                setError(submissionError.message);
              } else {
                setError("An error occurred. Please try again later.");
              }
            } finally {
              setIsLoading(false);
            }
          }}
        >
          <div>
            {mode === "article" ? (
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-600">
                    Article editor
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowArticlePreview((prev) => !prev)}
                    className="rounded-full border border-gray-300 px-4 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                  >
                    {showArticlePreview ? "Edit" : "Preview"}
                  </button>
                </div>
                {!showArticlePreview ? (
                  <>
                    <input
                      value={articleTitle}
                      onChange={(event) => setArticleTitle(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-2xl font-bold outline-none focus:border-red-300"
                      placeholder="Article title..."
                    />
                    <input
                      value={articleSummary}
                      onChange={(event) =>
                        setArticleSummary(event.target.value)
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base outline-none focus:border-red-300"
                      placeholder="Short summary..."
                    />
                    <textarea
                      value={articleBody}
                      onChange={(event) => setArticleBody(event.target.value)}
                      className="h-72 w-full resize-none rounded-lg border border-gray-300 p-4 outline-none focus:border-red-300"
                      placeholder="Write your article..."
                    />
                    <input
                      value={articleTags}
                      onChange={(event) => setArticleTags(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-red-300"
                      placeholder="Tags (comma separated): remotework, ai, career"
                    />
                  </>
                ) : (
                  <article className="max-h-[30rem] overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-5">
                    {articlePreviewCoverUrl ? (
                      <img
                        src={articlePreviewCoverUrl}
                        alt="Article cover preview"
                        className="mb-4 h-56 w-full rounded-xl object-cover"
                      />
                    ) : null}
                    <h1 className="text-3xl font-bold text-slate-900">
                      {articlePayload.title || "Untitled article"}
                    </h1>
                    {articlePayload.summary ? (
                      <p className="mt-2 text-lg text-slate-600">
                        {articlePayload.summary}
                      </p>
                    ) : null}
                    {articlePayload.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {articlePayload.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-5 border-t border-slate-700">
                      <div
                        className="overflow-hidden text-slate-700 [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_p]:mt-2 [&_p]:leading-7 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mt-1"
                        dangerouslySetInnerHTML={{ __html: normalizedPreviewHtml }}
                      />
                    </div>
                  </article>
                )}
              </div>
            ) : (
              <textarea
                placeholder="What do you want to talk about?"
                onFocus={() => setError("")}
                onChange={(event) => {
                  setDraftContent(event.target.value);
                  setError("");
                }}
                name="content"
                value={draftContent}
                className="h-80 w-full resize-none rounded-lg border border-gray-300 p-4"
              />
            )}

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
                  {mode === "article"
                    ? `Cover / media (${totalMediaCount}/3 selected)`
                    : `Up to 3 media per post (${totalMediaCount}/3 selected)`}
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
          {error && <div className="text-red-500">{error}</div>}
          <div>
            <Button size="medium" type="submit" disabled={isLoading}>
              {mode === "article" ? "Publish article" : "Post"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
