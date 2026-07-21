export interface JobResponse {
  id: number;
  companyId: number;
  companyName: string;
  companyLogo: string | null;
  companySlug: string;
  title: string;
  description: string;
  requirements: string | null;
  responsibilities: string | null;
  location: string;
  jobType: "FULL_TIME" | "PART_TIME" | "INTERNSHIP" | "CONTRACT";
  workMode: "ON_SITE" | "REMOTE" | "HYBRID";
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  experienceLevel: string; // INTERN, JUNIOR, MIDDLE, SENIOR, LEAD
  skills: string[];
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  createdAt: string;
  publishedAt: string | null;
  applicationDeadline: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  sourcePlatform?: string | null;
  assignedRecruiterId?: number | null;
}

export interface JobApplicationResponse {
  id: number;
  jobId: number;
  jobTitle: string;
  companyName: string;
  applicantId: number;
  applicantName: string;
  applicantEmail: string;
  cvId: number;
  cvFileName: string;
  coverLetter: string;
  matchScore: number;
  matchBreakdown: string; // JSON String
  matchReasoning: string;
  status: "APPLIED" | "VIEWED" | "SHORTLISTED" | "REJECTED" | "HIRED";
  appliedAt: string;
}
