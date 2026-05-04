import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader } from "@/components/Loader/Loader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { request } from "@/utils/api";
import {
  IUser,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";
import { RightSidebar } from "@/features/feed/components/RightSidebar/RightSidebar";
import { About } from "@/features/profile/components/About/About";
import { Activity } from "@/features/profile/components/Activity/Activity";
import { Header } from "@/features/profile/components/Header/Header";

interface ExperienceItem {
  role: string;
  company: string;
  employmentType: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  isPresent?: boolean;
  period?: string;
  description: string;
}

interface EducationItem {
  degree: string;
  school: string;
  startYear?: number;
  startMonth?: number;
  endYear?: number;
  endMonth?: number;
  period?: string;
}

const EMPTY_EXPERIENCE: ExperienceItem = {
  role: "",
  company: "",
  employmentType: "",
  startYear: undefined,
  startMonth: undefined,
  endYear: undefined,
  endMonth: undefined,
  isPresent: false,
  description: "",
};

const EMPTY_EDUCATION: EducationItem = {
  degree: "",
  school: "",
  startYear: undefined,
  startMonth: undefined,
  endYear: undefined,
  endMonth: undefined,
};

function parseArrayJson<T>(value: string | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from(
  { length: 60 },
  (_, index) => CURRENT_YEAR - index
);
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

function formatMonthYear(year?: number, month?: number) {
  if (!year) return "";
  if (!month) return `${year}`;
  return `${String(month).padStart(2, "0")}/${year}`;
}

function formatExperiencePeriod(item: ExperienceItem) {
  if (item.startYear || item.startMonth) {
    if (item.isPresent) {
      return `${formatMonthYear(item.startYear, item.startMonth)} - Present`;
    }
    if (item.endYear || item.endMonth) {
      return `${formatMonthYear(item.startYear, item.startMonth)} - ${formatMonthYear(item.endYear, item.endMonth)}`;
    }
    return `${formatMonthYear(item.startYear, item.startMonth)}`;
  }
  return item.period || "";
}

function formatEducationPeriod(item: EducationItem) {
  if (item.startYear || item.startMonth) {
    if (item.endYear || item.endMonth) {
      return `${formatMonthYear(item.startYear, item.startMonth)} - ${formatMonthYear(item.endYear, item.endMonth)}`;
    }
    return `${formatMonthYear(item.startYear, item.startMonth)}`;
  }
  return item.period || "";
}

function hasMonthWithoutYear(year?: number, month?: number) {
  return !year && !!month;
}

export function Profile() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const { user: authUser, setUser: setAuthUser } = useAuthentication();
  const [user, setUser] = useState<IUser | null>(null);
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [educations, setEducations] = useState<EducationItem[]>([]);
  const [experienceDraft, setExperienceDraft] =
    useState<ExperienceItem>(EMPTY_EXPERIENCE);
  const [educationDraft, setEducationDraft] =
    useState<EducationItem>(EMPTY_EDUCATION);
  const [editingExperience, setEditingExperience] = useState(false);
  const [editingEducation, setEditingEducation] = useState(false);
  const [editingExperienceIndex, setEditingExperienceIndex] = useState<
    number | null
  >(null);
  const [editingEducationIndex, setEditingEducationIndex] = useState<
    number | null
  >(null);
  const [experienceDateError, setExperienceDateError] = useState("");
  const [educationDateError, setEducationDateError] = useState("");
  const [experienceFormError, setExperienceFormError] = useState("");
  const [educationFormError, setEducationFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<
    | null
    | { type: "experience"; index: number }
    | { type: "education"; index: number }
  >(null);

  const toComparableDate = (year?: number, month?: number) => {
    if (!year) return null;
    return year * 100 + (month ?? 1);
  };

  usePageTitle(user?.firstName + " " + user?.lastName);

  useEffect(() => {
    setLoading(true);
    if (id == authUser?.id) {
      setUser(authUser);
      setLoading(false);
    } else {
      request<IUser>({
        endpoint: `/api/v1/authentication/users/${id}`,
        onSuccess: (data) => {
          setUser(data);
          setLoading(false);
        },
        onFailure: (error) => console.log(error),
      });
    }
  }, [authUser, id]);

  const handleUpdate = (updatedUser: IUser) => {
    setUser(updatedUser);
    // Nếu đang xem profile của chính mình, cập nhật cả authUser trong context
    if (id == authUser?.id) {
      setAuthUser(updatedUser);
    }
  };

  useEffect(() => {
    setExperiences(parseArrayJson<ExperienceItem>(user?.experience));
    setEducations(parseArrayJson<EducationItem>(user?.education));
  }, [user?.education, user?.experience]);

  const canEditSections = id == authUser?.id;

  const saveProfileSections = async (
    nextExperiences: ExperienceItem[],
    nextEducations: EducationItem[]
  ) => {
    if (!user?.id) return;
    await request<IUser>({
      endpoint: `/api/v1/authentication/profile/${user.id}`,
      method: "PUT",
      body: JSON.stringify({
        experience: JSON.stringify(nextExperiences),
        education: JSON.stringify(nextEducations),
      }),
      onSuccess: (data) => handleUpdate(data),
      onFailure: (error) => {
        throw new Error(error);
      },
    });
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <section className="grid gap-6">
          <Header user={user} authUser={authUser} onUpdate={handleUpdate} />
          <About user={user} authUser={authUser} onUpdate={handleUpdate} />
          <Activity authUser={authUser} user={user} id={id} />

          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Experience</h2>
              {canEditSections ? (
                <button
                  onClick={() => {
                    setExperienceDraft(EMPTY_EXPERIENCE);
                    setEditingExperienceIndex(null);
                    setExperienceDateError("");
                    setExperienceFormError("");
                    setEditingExperience((prev) => !prev);
                  }}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  {editingExperience ? "Close" : "+ Add"}
                </button>
              ) : null}
            </div>
            {editingExperience ? (
              <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  value={experienceDraft.role}
                  onChange={(event) =>
                    setExperienceDraft((prev) => ({
                      ...prev,
                      role: event.target.value,
                    }))
                  }
                  placeholder="Role"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={experienceDraft.company}
                    onChange={(event) =>
                      setExperienceDraft((prev) => ({
                        ...prev,
                        company: event.target.value,
                      }))
                    }
                    placeholder="Company"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={experienceDraft.employmentType}
                    onChange={(event) =>
                      setExperienceDraft((prev) => ({
                        ...prev,
                        employmentType: event.target.value,
                      }))
                    }
                    placeholder="Employment type (e.g. Full-time)"
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <input className="hidden" readOnly value="" />
                <div className="grid gap-3 md:grid-cols-4">
                  <select
                    value={experienceDraft.startYear ?? ""}
                    onChange={(event) =>
                      setExperienceDraft((prev) => ({
                        ...prev,
                        startYear: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Start year</option>
                    {YEAR_OPTIONS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <select
                    value={experienceDraft.startMonth ?? ""}
                    onChange={(event) =>
                      setExperienceDraft((prev) => ({
                        ...prev,
                        startMonth: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Start month</option>
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <select
                    value={
                      experienceDraft.isPresent
                        ? "present"
                        : (experienceDraft.endYear ?? "")
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "present") {
                        setExperienceDraft((prev) => ({
                          ...prev,
                          isPresent: true,
                          endYear: undefined,
                          endMonth: undefined,
                        }));
                        return;
                      }
                      setExperienceDraft((prev) => ({
                        ...prev,
                        isPresent: false,
                        endYear: value ? Number(value) : undefined,
                      }));
                    }}
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">End year</option>
                    <option value="present">Present</option>
                    {YEAR_OPTIONS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  {!experienceDraft.isPresent ? (
                    <select
                      value={experienceDraft.endMonth ?? ""}
                      onChange={(event) =>
                        setExperienceDraft((prev) => ({
                          ...prev,
                          endMonth: event.target.value
                            ? Number(event.target.value)
                            : undefined,
                        }))
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">End month</option>
                      {MONTH_OPTIONS.map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500">
                      End month hidden (Present)
                    </div>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={!!experienceDraft.isPresent}
                      onChange={(event) =>
                        setExperienceDraft((prev) => ({
                          ...prev,
                          isPresent: event.target.checked,
                          endYear: event.target.checked
                            ? undefined
                            : prev.endYear,
                          endMonth: event.target.checked
                            ? undefined
                            : prev.endMonth,
                        }))
                      }
                    />
                    I currently work here
                  </label>
                </div>
                {experienceDateError ? (
                  <p className="text-sm text-red-600">{experienceDateError}</p>
                ) : null}
                {experienceFormError ? (
                  <p className="text-sm text-red-600">{experienceFormError}</p>
                ) : null}
                <textarea
                  value={experienceDraft.description}
                  onChange={(event) =>
                    setExperienceDraft((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Description"
                  className="h-24 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  className="justify-self-start rounded-full bg-[var(--primary-color)] px-4 py-2 text-sm font-semibold text-white"
                  onClick={async () => {
                    if (
                      !experienceDraft.role.trim() ||
                      !experienceDraft.company.trim()
                    ) {
                      setExperienceFormError(
                        "Role and Company are required for experience."
                      );
                      return;
                    }
                    setExperienceFormError("");
                    const start = toComparableDate(
                      experienceDraft.startYear,
                      experienceDraft.startMonth
                    );
                    const end = toComparableDate(
                      experienceDraft.endYear,
                      experienceDraft.endMonth
                    );
                    if (
                      hasMonthWithoutYear(
                        experienceDraft.startYear,
                        experienceDraft.startMonth
                      ) ||
                      hasMonthWithoutYear(
                        experienceDraft.endYear,
                        experienceDraft.endMonth
                      )
                    ) {
                      setExperienceDateError(
                        "Month requires year. Please select year and month together."
                      );
                      return;
                    }
                    if (
                      !experienceDraft.isPresent &&
                      start &&
                      end &&
                      end < start
                    ) {
                      setExperienceDateError(
                        "End month/year must be after start month/year."
                      );
                      return;
                    }
                    setExperienceDateError("");
                    const next =
                      editingExperienceIndex === null
                        ? [experienceDraft, ...experiences]
                        : experiences.map((item, index) =>
                            index === editingExperienceIndex
                              ? experienceDraft
                              : item
                          );
                    try {
                      await saveProfileSections(next, educations);
                      setExperiences(next);
                      setExperienceDraft(EMPTY_EXPERIENCE);
                      setEditingExperienceIndex(null);
                      setEditingExperience(false);
                    } catch (error) {
                      setExperienceFormError(
                        error instanceof Error
                          ? error.message
                          : "Failed to save experience."
                      );
                    }
                  }}
                >
                  {editingExperienceIndex === null
                    ? "Save experience"
                    : "Update experience"}
                </button>
              </div>
            ) : null}
            {experiences.length > 0 ? (
              <div className="grid gap-4">
                {experiences.map((item, index) => (
                  <div
                    key={`${item.role}-${item.company}-${index}`}
                    className="relative rounded-2xl border border-slate-200 p-4"
                  >
                    {canEditSections ? (
                      <div className="absolute right-3 top-3 flex gap-2">
                        <button
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          onClick={() => {
                            setExperienceDraft(item);
                            setEditingExperienceIndex(index);
                            setEditingExperience(true);
                            setExperienceDateError("");
                            setExperienceFormError("");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          onClick={() =>
                            setConfirmDelete({ type: "experience", index })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                    <div className="text-2xl font-semibold text-slate-900">
                      {(item.role || "").trim() || "Untitled role"}
                    </div>
                    {((item.company || "").trim() ||
                      (item.employmentType || "").trim()) && (
                      <div className="mt-1 text-lg text-slate-700">
                        {(item.company || "").trim()}
                        {(item.employmentType || "").trim()
                          ? `${(item.company || "").trim() ? " - " : ""}${(item.employmentType || "").trim()}`
                          : ""}
                      </div>
                    )}
                    {formatExperiencePeriod(item) ? (
                      <div className="mt-1 text-sm text-slate-500">
                        {formatExperiencePeriod(item)}
                      </div>
                    ) : null}
                    {item.description ? (
                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No experience added yet.</p>
            )}
          </div>
          <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-[0_14px_30px_rgba(15,23,42,0.04)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Education</h2>
              {canEditSections ? (
                <button
                  onClick={() => {
                    setEducationDraft(EMPTY_EDUCATION);
                    setEditingEducationIndex(null);
                    setEducationDateError("");
                    setEducationFormError("");
                    setEditingEducation((prev) => !prev);
                  }}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  {editingEducation ? "Close" : "+ Add"}
                </button>
              ) : null}
            </div>
            {editingEducation ? (
              <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  value={educationDraft.degree}
                  onChange={(event) =>
                    setEducationDraft((prev) => ({
                      ...prev,
                      degree: event.target.value,
                    }))
                  }
                  placeholder="Degree / Program"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={educationDraft.school}
                  onChange={(event) =>
                    setEducationDraft((prev) => ({
                      ...prev,
                      school: event.target.value,
                    }))
                  }
                  placeholder="School"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
                <input className="hidden" readOnly value="" />
                <div className="grid gap-3 md:grid-cols-4">
                  <select
                    value={educationDraft.startYear ?? ""}
                    onChange={(event) =>
                      setEducationDraft((prev) => ({
                        ...prev,
                        startYear: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Start year</option>
                    {YEAR_OPTIONS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <select
                    value={educationDraft.startMonth ?? ""}
                    onChange={(event) =>
                      setEducationDraft((prev) => ({
                        ...prev,
                        startMonth: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Start month</option>
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <select
                    value={educationDraft.endYear ?? ""}
                    onChange={(event) =>
                      setEducationDraft((prev) => ({
                        ...prev,
                        endYear: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">End year</option>
                    {YEAR_OPTIONS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <select
                    value={educationDraft.endMonth ?? ""}
                    onChange={(event) =>
                      setEducationDraft((prev) => ({
                        ...prev,
                        endMonth: event.target.value
                          ? Number(event.target.value)
                          : undefined,
                      }))
                    }
                    className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">End month</option>
                    {MONTH_OPTIONS.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
                {educationDateError ? (
                  <p className="text-sm text-red-600">{educationDateError}</p>
                ) : null}
                {educationFormError ? (
                  <p className="text-sm text-red-600">{educationFormError}</p>
                ) : null}
                <button
                  className="justify-self-start rounded-full bg-[var(--primary-color)] px-4 py-2 text-sm font-semibold text-white"
                  onClick={async () => {
                    if (
                      !educationDraft.degree.trim() ||
                      !educationDraft.school.trim()
                    ) {
                      setEducationFormError(
                        "Degree and School are required for education."
                      );
                      return;
                    }
                    setEducationFormError("");
                    const start = toComparableDate(
                      educationDraft.startYear,
                      educationDraft.startMonth
                    );
                    const end = toComparableDate(
                      educationDraft.endYear,
                      educationDraft.endMonth
                    );
                    if (
                      hasMonthWithoutYear(
                        educationDraft.startYear,
                        educationDraft.startMonth
                      ) ||
                      hasMonthWithoutYear(
                        educationDraft.endYear,
                        educationDraft.endMonth
                      )
                    ) {
                      setEducationDateError(
                        "Month requires year. Please select year and month together."
                      );
                      return;
                    }
                    if (start && end && end < start) {
                      setEducationDateError(
                        "End month/year must be after start month/year."
                      );
                      return;
                    }
                    setEducationDateError("");
                    const next =
                      editingEducationIndex === null
                        ? [educationDraft, ...educations]
                        : educations.map((item, index) =>
                            index === editingEducationIndex
                              ? educationDraft
                              : item
                          );
                    try {
                      await saveProfileSections(experiences, next);
                      setEducations(next);
                      setEducationDraft(EMPTY_EDUCATION);
                      setEditingEducationIndex(null);
                      setEditingEducation(false);
                    } catch (error) {
                      setEducationFormError(
                        error instanceof Error
                          ? error.message
                          : "Failed to save education."
                      );
                    }
                  }}
                >
                  {editingEducationIndex === null
                    ? "Save education"
                    : "Update education"}
                </button>
              </div>
            ) : null}
            {educations.length > 0 ? (
              <div className="grid gap-4">
                {educations.map((item, index) => (
                  <div
                    key={`${item.degree}-${item.school}-${index}`}
                    className="relative rounded-2xl border border-slate-200 p-4"
                  >
                    {canEditSections ? (
                      <div className="absolute right-3 top-3 flex gap-2">
                        <button
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          onClick={() => {
                            setEducationDraft(item);
                            setEditingEducationIndex(index);
                            setEditingEducation(true);
                            setEducationDateError("");
                            setEducationFormError("");
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                          onClick={() =>
                            setConfirmDelete({ type: "education", index })
                          }
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                    <div className="text-2xl font-semibold text-slate-900">
                      {(item.degree || "").trim() || "Untitled degree"}
                    </div>
                    {(item.school || "").trim() ? (
                      <div className="mt-1 text-lg text-slate-700">
                        {(item.school || "").trim()}
                      </div>
                    ) : null}
                    {formatEducationPeriod(item) ? (
                      <div className="mt-1 text-sm text-slate-500">
                        {formatEducationPeriod(item)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No education added yet.</p>
            )}
          </div>
        </section>
        <div className="hidden xl:block">
          <RightSidebar />
        </div>
      </div>
      {confirmDelete ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Confirm delete</h3>
            <p className="mt-2 text-sm text-slate-600">
              {confirmDelete.type === "experience"
                ? "Delete this experience item?"
                : "Delete this education item?"}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={async () => {
                  if (confirmDelete.type === "experience") {
                    const next = experiences.filter(
                      (_, i) => i !== confirmDelete.index
                    );
                    try {
                      await saveProfileSections(next, educations);
                      setExperiences(next);
                      if (editingExperienceIndex === confirmDelete.index) {
                        setExperienceDraft(EMPTY_EXPERIENCE);
                        setEditingExperienceIndex(null);
                        setEditingExperience(false);
                      } else if (
                        editingExperienceIndex !== null &&
                        editingExperienceIndex > confirmDelete.index
                      ) {
                        setEditingExperienceIndex((prev) =>
                          prev === null ? null : prev - 1
                        );
                      }
                    } catch (error) {
                      setExperienceFormError(
                        error instanceof Error
                          ? error.message
                          : "Failed to delete experience."
                      );
                      return;
                    }
                  } else {
                    const next = educations.filter(
                      (_, i) => i !== confirmDelete.index
                    );
                    try {
                      await saveProfileSections(experiences, next);
                      setEducations(next);
                      if (editingEducationIndex === confirmDelete.index) {
                        setEducationDraft(EMPTY_EDUCATION);
                        setEditingEducationIndex(null);
                        setEditingEducation(false);
                      } else if (
                        editingEducationIndex !== null &&
                        editingEducationIndex > confirmDelete.index
                      ) {
                        setEditingEducationIndex((prev) =>
                          prev === null ? null : prev - 1
                        );
                      }
                    } catch (error) {
                      setEducationFormError(
                        error instanceof Error
                          ? error.message
                          : "Failed to delete education."
                      );
                      return;
                    }
                  }
                  setConfirmDelete(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
