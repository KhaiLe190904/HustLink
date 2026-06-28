import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import { Button } from "@/features/authentication/components/Button/Button";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { EventResponse } from "../../types/events";
import {
  FiCalendar,
  FiMapPin,
  FiPlus,
  FiChevronRight,
  FiSearch,
  FiSliders,
  FiUsers,
} from "react-icons/fi";

interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
}

export function EventList() {
  const { user } = useAuthentication();
  const [events, setEvents] = useState<EventResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "my">(
    "upcoming"
  );

  // Filters & Pagination
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    let endpoint = "/api/v1/events";

    if (activeTab === "my") {
      endpoint = "/api/v1/events/my/upcoming";
      await request<EventResponse[]>({
        endpoint,
        onSuccess: (data) => {
          setEvents(data);
          setTotalPages(1);
          setLoading(false);
        },
        onFailure: (err) => {
          toast.error("Could not load events list: " + err);
          setLoading(false);
        },
      });
    } else {
      const params = new URLSearchParams();
      if (appliedSearchQuery.trim())
        params.append("q", appliedSearchQuery.trim());
      if (typeFilter) params.append("type", typeFilter);
      if (cityFilter) params.append("city", cityFilter);
      params.append("upcoming", activeTab === "upcoming" ? "true" : "false");
      params.append("page", String(currentPage));
      params.append("size", String(6));
      endpoint = `/api/v1/events?${params.toString()}`;

      await request<PageResponse<EventResponse>>({
        endpoint,
        onSuccess: (data) => {
          setEvents(data.content);
          setTotalPages(data.totalPages);
          setLoading(false);
        },
        onFailure: (err) => {
          toast.error("Could not load events list: " + err);
          setLoading(false);
        },
      });
    }
  }, [activeTab, appliedSearchQuery, typeFilter, cityFilter, currentPage]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearchQuery(searchInput.trim());
    setCurrentPage(0);
  };

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

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      {/* Top Banner */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-r from-red-700 via-red-800 to-indigo-900 p-8 text-white shadow-xl shadow-red-950/10">
        <div className="relative z-10 max-w-2xl">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            HustLink Events
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
            HUST Events & Career Fairs
          </h1>
          <p className="mt-2 text-red-100/90 leading-relaxed">
            Join technology workshops, career orientation talkshows, seminars,
            and connect directly with leading recruiters.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 relative z-10">
          {user?.role === "RECRUITER" && (
            <Link to="/events/new">
              <Button
                type="button"
                className="my-0 hover:bg-slate-100 px-5 flex items-center gap-1.5 font-bold"
                style={{ color: "#b91c1c", backgroundColor: "#ffffff" }}
              >
                <FiPlus className="stroke-[3]" /> Create New Event
              </Button>
            </Link>
          )}
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-white/10 to-transparent pointer-events-none" />
      </div>

      {/* Tabs Selection */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab("upcoming");
              setCurrentPage(0);
            }}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === "upcoming"
                ? "bg-red-700 text-white shadow-md shadow-red-700/10"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Upcoming Events
          </button>
          <button
            onClick={() => {
              setActiveTab("past");
              setCurrentPage(0);
            }}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === "past"
                ? "bg-red-700 text-white shadow-md shadow-red-700/10"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Past Events
          </button>
          <button
            onClick={() => {
              setActiveTab("my");
              setCurrentPage(0);
            }}
            className={`rounded-2xl px-5 py-2.5 text-sm font-semibold transition ${
              activeTab === "my"
                ? "bg-red-700 text-white shadow-md shadow-red-700/10"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            My RSVP Events
          </button>
        </div>
      </div>

      {/* Filter Bar (Only for public lists) */}
      {activeTab !== "my" && (
        <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search events, content..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-24 text-sm text-slate-800 outline-none transition focus:border-red-500"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800 transition"
              >
                Search
              </button>
            </form>

            {/* Event Type Filter */}
            <div className="relative">
              <FiSliders className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-red-500 appearance-none bg-white"
              >
                <option value="">All categories</option>
                <option value="WORKSHOP">Hands-on Workshop</option>
                <option value="TALK_SHOW">Orientation Talkshow</option>
                <option value="CAREER_FAIR">Career Fair</option>
                <option value="WEBINAR">Online Webinar</option>
                <option value="NETWORKING">Networking Event</option>
              </select>
            </div>

            {/* City/Venue Filter */}
            <div className="relative">
              <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setCurrentPage(0);
                }}
                className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition focus:border-red-500 appearance-none bg-white"
              >
                <option value="">All locations</option>
                <option value="HANOI">Hanoi</option>
                <option value="HCMC">Ho Chi Minh City</option>
                <option value="DANANG">Da Nang</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main List */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 rounded-3xl bg-white shadow-sm">
          <p className="text-base font-medium">No events found.</p>
          {activeTab === "my" && (
            <p className="text-sm mt-1">
              Events you mark as "Going" or "Interested" will appear here.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-red-300 hover:shadow-lg hover:shadow-red-50/40"
            >
              <div>
                {/* Cover Photo */}
                <div className="relative h-44 bg-slate-100 overflow-hidden">
                  <img
                    src={
                      event.coverImageUrl ||
                      "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600"
                    }
                    alt={event.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-4 top-4 rounded-xl bg-slate-900/80 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
                    {getEventTypeLabel(event.type)}
                  </span>
                  {event.status === "CANCELLED" && (
                    <span className="absolute right-4 top-4 rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white">
                      Cancelled
                    </span>
                  )}
                  {event.status === "DRAFT" && (
                    <span className="absolute right-4 top-4 rounded-xl bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                      Draft
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-6">
                  {/* Host info */}
                  {event.hostCompanyName && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="h-5 w-5 rounded-md border border-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                        <img
                          src={
                            event.hostCompanyLogo ||
                            "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=50"
                          }
                          alt={event.hostCompanyName}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-500 truncate">
                        {event.hostCompanyName}
                      </span>
                    </div>
                  )}

                  <h3 className="font-bold text-slate-900 leading-snug group-hover:text-red-700 transition line-clamp-2">
                    {event.title}
                  </h3>

                  {/* Dates & Mode Info */}
                  <div className="mt-4 space-y-2 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-2">
                      <FiCalendar className="text-slate-400 shrink-0" />
                      <span>
                        {new Date(event.startAt).toLocaleString("en-US", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FiMapPin className="text-slate-400 shrink-0" />
                      <span className="truncate">
                        {event.mode === "ONLINE"
                          ? getEventModeLabel(event.mode)
                          : `${event.venue || ""}, ${getCityLabel(event.cityCode)}`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 p-6 flex items-center justify-between bg-slate-50/20">
                <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                  <FiUsers className="text-slate-400" />
                  <span>{event.goingCount} participants</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {activeTab !== "my" && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                currentPage === i
                  ? "bg-red-700 text-white shadow-md shadow-red-700/10"
                  : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            onClick={() =>
              setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
            }
            disabled={currentPage === totalPages - 1}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
