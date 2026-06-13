export interface EventResponse {
  id: number;
  organizerId: number;
  organizerName: string;
  hostCompanyId: number | null;
  hostCompanyName: string | null;
  hostCompanyLogo: string | null;
  hostCompanySlug: string | null;
  type: "TALK_SHOW" | "WORKSHOP" | "CAREER_FAIR" | "WEBINAR" | "NETWORKING";
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  onlineLink: string | null;
  venue: string | null;
  cityCode: string | null; // e.g. HANOI, HCMC
  capacity: number | null;
  coverImageUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "ENDED";
  tags: string[];
  createdAt: string;
  goingCount: number;
  interestedCount: number;
}
