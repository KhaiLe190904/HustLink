import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import { Button } from "@/features/authentication/components/Button/Button";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { EventResponse } from "../../types/events";
import {
  FiCalendar,
  FiMapPin,
  FiClock,
  FiUsers,
  FiLink,
  FiChevronLeft,
  FiEdit,
  FiTrash2,
  FiSlash,
} from "react-icons/fi";

export function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthentication();

  const [event, setEvent] = useState<EventResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState<string>("NONE");
  const [updatingRsvp, setUpdatingRsvp] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    show: boolean;
    action: "cancel" | "delete" | null;
  }>({
    show: false,
    action: null,
  });

  const fetchEventData = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    // Fetch Event Details
    await request<EventResponse>({
      endpoint: `/api/v1/events/${id}`,
      onSuccess: (data) => {
        setEvent(data);

        // Fetch current user's RSVP status if logged in
        if (user) {
          request<{ status: string }>({
            endpoint: `/api/v1/events/${id}/rsvp-status`,
            onSuccess: (res) => {
              setRsvpStatus(res.status || "NONE");
            },
            onFailure: () => {
              setRsvpStatus("NONE");
            },
          });
        } else {
          setRsvpStatus("NONE");
        }
      },
      onFailure: (err) => {
        toast.error(err || "Could not load event information");
      },
    });
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  const handleRsvp = async (status: string) => {
    if (!user) {
      toast.info("Please log in to register for the event");
      navigate("/authentication/login");
      return;
    }

    setUpdatingRsvp(true);
    if (status === "NONE") {
      // Cancel RSVP
      await request({
        endpoint: `/api/v1/events/${id}/rsvp`,
        method: "DELETE",
        onSuccess: () => {
          toast.success("RSVP cancelled successfully");
          setRsvpStatus("NONE");
          fetchEventData();
        },
        onFailure: (err) => toast.error(err),
      });
    } else {
      // Submit RSVP
      await request({
        endpoint: `/api/v1/events/${id}/rsvp`,
        method: "POST",
        body: JSON.stringify({ status }),
        onSuccess: () => {
          toast.success(
            `RSVP updated: ${status === "GOING" ? "Going" : "Interested"}`
          );
          setRsvpStatus(status);
          fetchEventData();
        },
        onFailure: (err) => toast.error(err),
      });
    }
    setUpdatingRsvp(false);
  };

  const handleCancelEventClick = () => {
    setShowConfirmModal({ show: true, action: "cancel" });
  };

  const confirmCancelEvent = async () => {
    await request<EventResponse>({
      endpoint: `/api/v1/events/${id}/cancel`,
      method: "PATCH",
      onSuccess: (data) => {
        toast.success("Event has been cancelled!");
        setEvent(data);
      },
      onFailure: (err) => toast.error(err),
    });
    setShowConfirmModal({ show: false, action: null });
  };

  const handlePublishEvent = async () => {
    if (!id) return;
    await request<EventResponse>({
      endpoint: `/api/v1/events/${id}/publish`,
      method: "PATCH",
      onSuccess: (data) => {
        toast.success("Event published successfully!");
        setEvent(data);
      },
      onFailure: (err) => toast.error(err || "Failed to publish event"),
    });
  };

  const handleDeleteEventClick = () => {
    setShowConfirmModal({ show: true, action: "delete" });
  };

  const confirmDeleteEvent = async () => {
    await request({
      endpoint: `/api/v1/events/${id}`,
      method: "DELETE",
      onSuccess: () => {
        toast.success("Event deleted successfully!");
        navigate("/events");
      },
      onFailure: (err) => toast.error(err),
    });
    setShowConfirmModal({ show: false, action: null });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-xl text-center py-16">
        <h2 className="text-2xl font-bold text-slate-800">Event Not Found</h2>
        <p className="mt-2 text-slate-500">
          The link does not exist or the event has been deleted.
        </p>
        <Link
          to="/events"
          className="mt-4 inline-block text-red-700 font-semibold hover:underline"
        >
          Back to Events List
        </Link>
      </div>
    );
  }

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case "TALK_SHOW":
        return "Talk Show";
      case "WORKSHOP":
        return "Workshop";
      case "CAREER_FAIR":
        return "Career Fair";
      case "WEBINAR":
        return "Webinar";
      case "NETWORKING":
        return "Networking";
      default:
        return type;
    }
  };

  const getEventModeLabel = (mode: string) => {
    switch (mode) {
      case "ONLINE":
        return "Online";
      case "OFFLINE":
        return "Offline";
      case "HYBRID":
        return "Hybrid";
      default:
        return mode;
    }
  };

  const getCityLabel = (code: string | null) => {
    if (!code) return "Other";
    switch (code.toUpperCase()) {
      case "HANOI":
        return "Hanoi";
      case "HCMC":
        return "Ho Chi Minh City";
      case "DANANG":
        return "Da Nang";
      default:
        return code;
    }
  };

  const isOrganizer =
    user && event.organizerId.toString() === user.id.toString();

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      {/* Back button */}
      <Link
        to="/events"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-red-700 mb-6 transition"
      >
        <FiChevronLeft className="h-4.5 w-4.5" /> Back to Events List
      </Link>

      {/* Main Details Wrapper */}
      <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
        {/* Left Column: Cover & Main Description */}
        <div className="space-y-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {/* Cover Image */}
            <div className="relative h-64 bg-slate-100">
              <img
                src={
                  event.coverImageUrl ||
                  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000"
                }
                alt={event.title}
                className="h-full w-full object-cover"
              />
              <span className="absolute left-6 top-6 rounded-xl bg-slate-900/85 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-md">
                {getEventTypeLabel(event.type)}
              </span>
            </div>

            {/* Event Title Info */}
            <div className="p-6 md:p-8">
              <h1 className="text-3xl font-extrabold text-slate-900 leading-snug">
                {event.title}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {event.status === "DRAFT" && (
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                    Draft
                  </span>
                )}
                {event.status === "CANCELLED" && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                    Cancelled
                  </span>
                )}
                {event.status === "ENDED" && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                    Ended
                  </span>
                )}
                {event.hostCompanyName && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">
                      Hosted by:
                    </span>
                    <Link
                      to={`/companies/${event.hostCompanySlug || ""}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 hover:underline"
                    >
                      {event.hostCompanyName}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 border-l-4 border-red-700 pl-3 mb-4">
              Event Details
            </h2>
            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {event.description}
            </p>

            {/* Tags */}
            {event.tags.length > 0 && (
              <div className="mt-8 pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase">
                  Tags:
                </span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-600 font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Time, Venue, RSVP, Admin Controls */}
        <div className="space-y-6">
          {/* Quick Specs & RSVP */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">
              Information & RSVP
            </h3>

            <div className="space-y-4 text-sm text-slate-700">
              <div className="flex gap-3">
                <FiCalendar className="text-slate-400 mt-1 shrink-0 h-4.5 w-4.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Start Time
                  </p>
                  <p className="font-semibold">
                    {new Date(event.startAt).toLocaleString("en-US")}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <FiClock className="text-slate-400 mt-1 shrink-0 h-4.5 w-4.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    End Time
                  </p>
                  <p className="font-semibold">
                    {new Date(event.endAt).toLocaleString("en-US")}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <FiMapPin className="text-slate-400 mt-1 shrink-0 h-4.5 w-4.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Venue ({getEventModeLabel(event.mode)})
                  </p>
                  {event.mode === "ONLINE" ? (
                    event.onlineLink ? (
                      <a
                        href={event.onlineLink}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-red-700 hover:underline flex items-center gap-1"
                      >
                        Online Link <FiLink />
                      </a>
                    ) : (
                      <p className="font-semibold text-slate-500">
                        Link will be provided later
                      </p>
                    )
                  ) : (
                    <p className="font-semibold">
                      {event.venue}, {getCityLabel(event.cityCode)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <FiUsers className="text-slate-400 mt-1 shrink-0 h-4.5 w-4.5" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    Capacity
                  </p>
                  <p className="font-semibold">
                    {event.capacity ? `${event.capacity} people` : "No limit"}
                  </p>
                </div>
              </div>
            </div>

            {/* RSVP Counts */}
            <div className="grid grid-cols-2 gap-2 text-center bg-slate-50 rounded-2xl p-3 border border-slate-100 text-xs">
              <div>
                <p className="font-bold text-slate-800 text-sm">
                  {event.goingCount}
                </p>
                <p className="text-slate-400 font-medium">Going</p>
              </div>
              <div className="border-l border-slate-200">
                <p className="font-bold text-slate-800 text-sm">
                  {event.interestedCount}
                </p>
                <p className="text-slate-400 font-medium">Interested</p>
              </div>
            </div>

            {/* RSVP Action Buttons */}
            {event.status === "PUBLISHED" && (
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase text-center block">
                  Update Your RSVP Status
                </span>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleRsvp("GOING")}
                    disabled={updatingRsvp || rsvpStatus === "GOING"}
                    className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition border ${
                      rsvpStatus === "GOING"
                        ? "bg-green-600 text-white border-green-600 shadow-sm cursor-not-allowed opacity-90"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Going
                  </button>
                  <button
                    onClick={() => handleRsvp("INTERESTED")}
                    disabled={updatingRsvp || rsvpStatus === "INTERESTED"}
                    className={`flex-1 rounded-xl py-2 px-3 text-xs font-bold transition border ${
                      rsvpStatus === "INTERESTED"
                        ? "bg-amber-600 text-white border-amber-600 shadow-sm cursor-not-allowed opacity-90"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Interested
                  </button>
                </div>

                {rsvpStatus !== "NONE" && (
                  <button
                    onClick={() => handleRsvp("NONE")}
                    disabled={updatingRsvp}
                    className="w-full text-center text-xs text-slate-400 font-semibold hover:text-red-700 py-1 transition disabled:cursor-not-allowed"
                  >
                    Cancel RSVP
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Organizer Actions */}
          {isOrganizer && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">
                Event Administration
              </h3>

              {event.status === "DRAFT" && (
                <Button
                  type="button"
                  className="my-0 mb-3 w-full bg-green-600 hover:bg-green-700 text-white text-xs flex items-center justify-center gap-1.5 font-bold"
                  onClick={handlePublishEvent}
                >
                  Publish Event
                </Button>
              )}

              {event.status === "PUBLISHED" && (
                <Button
                  type="button"
                  outline
                  className="my-0 mb-3 w-full text-amber-600 border-amber-200 hover:bg-amber-50 text-xs flex items-center justify-center gap-1.5 font-bold"
                  onClick={handleCancelEventClick}
                >
                  <FiSlash /> Cancel Event
                </Button>
              )}

              <Link to={`/events/${event.id}/edit`} className="block w-full">
                <Button
                  type="button"
                  outline
                  className="my-0 w-full text-slate-700 border-slate-200 hover:bg-slate-50 text-xs flex items-center justify-center gap-1.5 font-bold"
                >
                  <FiEdit /> Edit Event
                </Button>
              </Link>

              <Button
                type="button"
                className="my-0 w-full bg-red-600 hover:bg-red-700 text-white text-xs flex items-center justify-center gap-1.5 font-bold"
                onClick={handleDeleteEventClick}
              >
                <FiTrash2 /> Delete Event
              </Button>
            </div>
          )}

          {/* Event Host Details */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">
              Posted By
            </h3>
            <p className="text-sm font-bold text-slate-800">
              {event.organizerName}
            </p>
            <p className="text-xs text-slate-400 font-medium">Event Host</p>
          </div>
        </div>
      </div>

      {showConfirmModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900">
              {showConfirmModal.action === "cancel"
                ? "Cancel Event"
                : "Delete Event"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {showConfirmModal.action === "cancel"
                ? "Are you sure you want to cancel this event? Participants will be notified."
                : "Are you sure you want to permanently delete this event? This action cannot be undone."}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                type="button"
                outline
                className="my-0 px-4 py-2 border-slate-200 text-slate-700 hover:bg-slate-50 w-auto"
                onClick={() =>
                  setShowConfirmModal({ show: false, action: null })
                }
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="my-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white w-auto font-bold"
                onClick={async () => {
                  if (showConfirmModal.action === "cancel") {
                    await confirmCancelEvent();
                  } else if (showConfirmModal.action === "delete") {
                    await confirmDeleteEvent();
                  }
                }}
              >
                {showConfirmModal.action === "cancel"
                  ? "Confirm Cancel"
                  : "Confirm Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
