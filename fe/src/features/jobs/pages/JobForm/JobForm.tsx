import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { request } from "@/utils/api";
import { Button } from "@/features/authentication/components/Button/Button";
import { JobResponse } from "../../types/jobs";
import { FiChevronLeft } from "react-icons/fi";

export function JobForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    requirements: "",
    responsibilities: "",
    location: "",
    jobType: "FULL_TIME",
    workMode: "ON_SITE",
    salaryMin: "",
    salaryMax: "",
    salaryCurrency: "VND",
    experienceLevel: "JUNIOR",
    skillsText: "", // Comma-separated list for easy user entry
    applicationDeadline: "",
  });

  useEffect(() => {
    if (isEdit) {
      const fetchJob = async () => {
        setFetching(true);
        await request<JobResponse>({
          endpoint: `/api/v1/jobs/${id}`,
          onSuccess: (data) => {
            setFormData({
              title: data.title,
              description: data.description,
              requirements: data.requirements || "",
              responsibilities: data.responsibilities || "",
              location: data.location || "",
              jobType: data.jobType,
              workMode: data.workMode,
              salaryMin:
                data.salaryMin !== null ? data.salaryMin.toString() : "",
              salaryMax:
                data.salaryMax !== null ? data.salaryMax.toString() : "",
              salaryCurrency: data.salaryCurrency || "VND",
              experienceLevel: data.experienceLevel || "JUNIOR",
              skillsText: data.skills.join(", "),
              applicationDeadline: data.applicationDeadline
                ? data.applicationDeadline.split("T")[0]
                : "",
            });
            setFetching(false);
          },
          onFailure: (err) => {
            toast.error("Could not load job details: " + err);
            setFetching(false);
            navigate("/jobs");
          },
        });
      };
      fetchJob();
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
      toast.error("Please enter a job title");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Please enter a job description");
      return;
    }

    if (formData.applicationDeadline) {
      const deadlineDate = new Date(formData.applicationDeadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (deadlineDate < today) {
        toast.error("Application deadline cannot be in the past");
        return;
      }
    }

    const skills = formData.skillsText
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const body = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      requirements: formData.requirements.trim() || null,
      responsibilities: formData.responsibilities.trim() || null,
      location: formData.location.trim() || null,
      jobType: formData.jobType,
      workMode: formData.workMode,
      salaryMin: formData.salaryMin ? Number(formData.salaryMin) : null,
      salaryMax: formData.salaryMax ? Number(formData.salaryMax) : null,
      salaryCurrency: formData.salaryCurrency,
      experienceLevel: formData.experienceLevel,
      skills: skills,
      applicationDeadline: formData.applicationDeadline
        ? `${formData.applicationDeadline}T23:59:59`
        : null,
    };

    setLoading(true);
    await request({
      endpoint: isEdit ? `/api/v1/jobs/${id}` : "/api/v1/jobs",
      method: isEdit ? "PATCH" : "POST",
      body: JSON.stringify(body),
      onSuccess: () => {
        toast.success(
          isEdit
            ? "Job posting updated successfully!"
            : "Job posting created successfully!"
        );
        navigate("/jobs/recruiter");
      },
      onFailure: (err) => {
        toast.error(err || "Error processing job posting");
      },
    });
    setLoading(false);
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
        <div className="bg-gradient-to-r from-red-700 to-red-900 p-6 text-white md:p-8">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            Recruiter
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            {isEdit ? "Edit Job Posting" : "Post New Job"}
          </h1>
          <p className="mt-2 text-sm text-red-100/90">
            Provide detailed job descriptions, skill requirements, and salary
            range to allow HUSTLink's AI matching to connect you with the best
            candidates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 md:p-8">
          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="title"
            >
              Job Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Example: Senior Backend Engineer (Java), Frontend React Intern..."
              required
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="jobType"
              >
                Job Type
              </label>
              <select
                id="jobType"
                name="jobType"
                value={formData.jobType}
                onChange={handleChange}
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="CONTRACT">Contract</option>
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="workMode"
              >
                Work Mode
              </label>
              <select
                id="workMode"
                name="workMode"
                value={formData.workMode}
                onChange={handleChange}
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="ON_SITE">On-site</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="experienceLevel"
              >
                Experience Level
              </label>
              <select
                id="experienceLevel"
                name="experienceLevel"
                value={formData.experienceLevel}
                onChange={handleChange}
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="INTERN">Intern</option>
                <option value="JUNIOR">Junior (1-2 years)</option>
                <option value="MIDDLE">Middle (2-5 years)</option>
                <option value="SENIOR">Senior (5+ years)</option>
                <option value="LEAD">Lead / Manager</option>
              </select>
            </div>

            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="location"
              >
                Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Example: Hai Ba Trung, Hanoi..."
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="applicationDeadline"
              >
                Application Deadline
              </label>
              <input
                type="date"
                id="applicationDeadline"
                name="applicationDeadline"
                value={formData.applicationDeadline}
                onChange={handleChange}
                min={new Date().toISOString().split("T")[0]}
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="salaryMin"
              >
                Min Salary (VND)
              </label>
              <input
                type="number"
                id="salaryMin"
                name="salaryMin"
                value={formData.salaryMin}
                onChange={handleChange}
                placeholder="Example: 10000000"
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="salaryMax"
              >
                Max Salary (VND)
              </label>
              <input
                type="number"
                id="salaryMax"
                name="salaryMax"
                value={formData.salaryMax}
                onChange={handleChange}
                placeholder="Example: 25000000"
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </div>

            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="salaryCurrency"
              >
                Currency
              </label>
              <select
                id="salaryCurrency"
                name="salaryCurrency"
                value={formData.salaryCurrency}
                onChange={handleChange}
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              >
                <option value="VND">VND</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="skillsText"
            >
              Required Skills{" "}
              <span className="text-slate-400">(comma-separated)</span>
            </label>
            <input
              type="text"
              id="skillsText"
              name="skillsText"
              value={formData.skillsText}
              onChange={handleChange}
              placeholder="Example: Java, Spring Boot, SQL, Git, Docker"
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="description"
            >
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe daily tasks, projects, etc..."
              required
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            ></textarea>
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="requirements"
            >
              Requirements
            </label>
            <textarea
              id="requirements"
              name="requirements"
              rows={4}
              value={formData.requirements}
              onChange={handleChange}
              placeholder="Specify education, language, technical skills..."
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            ></textarea>
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="responsibilities"
            >
              Benefits & Responsibilities
            </label>
            <textarea
              id="responsibilities"
              name="responsibilities"
              rows={4}
              value={formData.responsibilities}
              onChange={handleChange}
              placeholder="Specify working environment, insurance, career path..."
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            ></textarea>
          </div>

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
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Post Job"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
