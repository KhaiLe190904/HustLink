import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import { Button } from "@/features/authentication/components/Button/Button";
import { EventResponse } from "../../types/events";
import { FiChevronLeft, FiUpload, FiX } from "react-icons/fi";
import {
  uploadToStorage,
  resolveMediaUrl,
  isOversizedUpload,
  MAX_UPLOAD_SIZE_LABEL,
} from "@/utils/storage";

interface CompanyDetail {
  id: number;
  name: string;
}

const getLocalDateTimeString = (date: Date): string => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

export function EventForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [myCompany, setMyCompany] = useState<CompanyDetail | null>(null);

  const [formData, setFormData] = useState(() => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    return {
      title: "",
      description: "",
      startAt: getLocalDateTimeString(now),
      endAt: getLocalDateTimeString(oneHourLater),
      mode: "OFFLINE",
      onlineLink: "",
      venue: "",
      cityCode: "HANOI",
      capacity: "",
      coverImageUrl: "",
      type: "WORKSHOP",
      tagsText: "",
    };
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [originalStartAt, setOriginalStartAt] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (isOversizedUpload(file)) {
        toast.error(`File size exceeds limit of ${MAX_UPLOAD_SIZE_LABEL}`);
        return;
      }
      setCoverFile(file);
      setCoverPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreviewUrl(null);
    setFormData((prev) => ({ ...prev, coverImageUrl: "" }));
  };

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  // Fetch recruiter's company
  useEffect(() => {
    request<CompanyDetail>({
      endpoint: "/api/v1/companies/my",
      onSuccess: (data) => {
        setMyCompany(data);
      },
      onFailure: () => {
        // Fallback or ignore for standard admins who might not have a specific company linked
      },
    });
  }, []);

  // Fetch event details for editing
  useEffect(() => {
    if (isEdit) {
      const fetchEvent = async () => {
        setFetching(true);
        await request<EventResponse>({
          endpoint: `/api/v1/events/${id}`,
          onSuccess: (data) => {
            // Format dates (remove seconds/milliseconds for input type=datetime-local)
            const fmtStart = data.startAt ? data.startAt.slice(0, 16) : "";
            const fmtEnd = data.endAt ? data.endAt.slice(0, 16) : "";

            setOriginalStartAt(fmtStart);
            setFormData({
              title: data.title,
              description: data.description,
              startAt: fmtStart,
              endAt: fmtEnd,
              mode: data.mode,
              onlineLink: data.onlineLink || "",
              venue: data.venue || "",
              cityCode: data.cityCode || "HANOI",
              capacity: data.capacity !== null ? data.capacity.toString() : "",
              coverImageUrl: data.coverImageUrl || "",
              type: data.type,
              tagsText: data.tags ? data.tags.join(", ") : "",
            });
            setFetching(false);
          },
          onFailure: (err) => {
            toast.error("Could not load event details: " + err);
            setFetching(false);
            navigate("/events");
          },
        });
      };
      fetchEvent();
    }
  }, [id, isEdit, navigate]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Please enter an event title");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Please enter an event description");
      return;
    }
    if (!formData.startAt || !formData.endAt) {
      toast.error("Please select both start and end times");
      return;
    }

    const startAtDate = new Date(formData.startAt);
    const now = new Date();
    const hasStartAtChanged = isEdit
      ? formData.startAt !== originalStartAt
      : true;

    if (
      hasStartAtChanged &&
      startAtDate.getTime() < now.getTime() - 5 * 60 * 1000
    ) {
      toast.error("Start time cannot be in the past");
      return;
    }
    const endAtDate = new Date(formData.endAt);
    if (endAtDate.getTime() <= startAtDate.getTime()) {
      toast.error("End time must be after start time");
      return;
    }

    const tags = formData.tagsText
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setLoading(true);
    try {
      let coverImageUrl = formData.coverImageUrl;

      if (coverFile) {
        const storedObject = await uploadToStorage({
          file: coverFile,
          scope: "EVENT_COVER",
          ownerType: "EVENT",
        });
        coverImageUrl = storedObject.accessUrl;
      }

      const body = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        startAt: `${formData.startAt}:00`,
        endAt: `${formData.endAt}:00`,
        mode: formData.mode,
        onlineLink:
          formData.mode === "ONLINE" || formData.mode === "HYBRID"
            ? formData.onlineLink.trim() || null
            : null,
        venue:
          formData.mode === "OFFLINE" || formData.mode === "HYBRID"
            ? formData.venue.trim() || null
            : null,
        cityCode:
          formData.mode === "OFFLINE" || formData.mode === "HYBRID"
            ? formData.cityCode
            : null,
        capacity: formData.capacity ? Number(formData.capacity) : null,
        coverImageUrl: coverImageUrl.trim() || null,
        hostCompanyId: myCompany ? myCompany.id : null,
        type: formData.type,
        tags: tags,
      };

      await request<EventResponse>({
        endpoint: isEdit ? `/api/v1/events/${id}` : "/api/v1/events",
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(body),
        onSuccess: (savedEvent) => {
          toast.success(
            isEdit
              ? "Event updated successfully!"
              : "Event created successfully!"
          );
          navigate(`/events/${isEdit ? id : savedEvent.id}`);
        },
        onFailure: (err) => {
          toast.error(err || "Error processing event");
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-700 mb-6 transition"
      >
        <FiChevronLeft className="h-4.5 w-4.5" /> Back
      </button>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-100/40">
        <div className="bg-gradient-to-r from-red-700 to-indigo-900 p-6 text-white md:p-8">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            Event & Seminar
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            {isEdit ? "Edit Event" : "Create New Event"}
          </h1>
          <p className="mt-2 text-sm text-red-100/90">
            Provide detailed information regarding content, schedule, and venue
            to share learning and recruiting opportunities with the HUST student
            community.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 md:p-8">
          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="title"
            >
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Example: Workshop: Outstanding Backend Engineer Career Path..."
              required
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="type"
              >
                Event Category
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
              >
                <option value="WORKSHOP">Hands-on Workshop</option>
                <option value="TALK_SHOW">Orientation Talkshow</option>
                <option value="CAREER_FAIR">Career Fair</option>
                <option value="WEBINAR">Online Webinar</option>
                <option value="NETWORKING">Networking Event</option>
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="mode"
              >
                Event Mode
              </label>
              <select
                id="mode"
                name="mode"
                value={formData.mode}
                onChange={handleChange}
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
              >
                <option value="OFFLINE">Offline</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="startAt"
              >
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                id="startAt"
                name="startAt"
                value={formData.startAt}
                onChange={handleChange}
                min={isEdit ? undefined : getLocalDateTimeString(new Date())}
                required
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
              />
            </div>

            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="endAt"
              >
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                id="endAt"
                name="endAt"
                value={formData.endAt}
                onChange={handleChange}
                min={formData.startAt || getLocalDateTimeString(new Date())}
                required
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
              />
            </div>
          </div>

          {(formData.mode === "OFFLINE" || formData.mode === "HYBRID") && (
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <label
                  className="block text-sm font-semibold text-slate-700"
                  htmlFor="venue"
                >
                  Venue <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="venue"
                  name="venue"
                  value={formData.venue}
                  onChange={handleChange}
                  placeholder="Example: C2 Hall, HUST"
                  required
                  className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
                />
              </div>

              <div>
                <label
                  className="block text-sm font-semibold text-slate-700"
                  htmlFor="cityCode"
                >
                  City
                </label>
                <select
                  id="cityCode"
                  name="cityCode"
                  value={formData.cityCode}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
                >
                  <option value="HANOI">Hanoi</option>
                  <option value="HCMC">Ho Chi Minh City</option>
                  <option value="DANANG">Da Nang</option>
                </select>
              </div>
            </div>
          )}

          {(formData.mode === "ONLINE" || formData.mode === "HYBRID") && (
            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="onlineLink"
              >
                Online Meeting Link (Zoom, Teams, Meet...)
              </label>
              <input
                type="url"
                id="onlineLink"
                name="onlineLink"
                value={formData.onlineLink}
                onChange={handleChange}
                placeholder="https://zoom.us/j/..."
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
              />
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="capacity"
              >
                Capacity Limit (leave blank if unlimited)
              </label>
              <input
                type="number"
                id="capacity"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                placeholder="Example: 100"
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Event Cover Image
            </label>
            <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-red-500">
              {coverPreviewUrl || formData.coverImageUrl ? (
                <div className="relative group rounded-xl overflow-hidden h-48 w-full bg-slate-100">
                  <img
                    src={
                      coverPreviewUrl || resolveMediaUrl(formData.coverImageUrl)
                    }
                    alt="Cover Preview"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3">
                    <label className="cursor-pointer rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition shadow">
                      Change Image
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition shadow"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center cursor-pointer py-10">
                  <FiUpload className="h-10 w-10 text-slate-400 mb-3" />
                  <span className="text-sm font-semibold text-slate-600">
                    Click to upload cover image
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    PNG, JPG, JPEG up to {MAX_UPLOAD_SIZE_LABEL}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="tagsText"
            >
              Tags <span className="text-slate-400">(comma-separated)</span>
            </label>
            <input
              type="text"
              id="tagsText"
              name="tagsText"
              value={formData.tagsText}
              onChange={handleChange}
              placeholder="Example: AI, ChatGPT, TechTalk, career_fair"
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
            />
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="description"
            >
              Event Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={6}
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe topics, speakers, agenda, schedule..."
              required
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500"
            ></textarea>
          </div>

          {myCompany && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 text-xs font-semibold text-indigo-800">
              This event will be co-organized by your company:{" "}
              <strong>{myCompany.name}</strong>.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              outline
              onClick={() => navigate(-1)}
              className="my-0 px-6 py-2.5 sm:w-fit"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="my-0 px-8 py-2.5 sm:w-fit bg-red-700 hover:bg-red-800 text-white font-bold"
            >
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
