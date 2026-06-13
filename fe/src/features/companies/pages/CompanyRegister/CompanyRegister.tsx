import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import { request } from "@/utils/api";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiArrowLeft,
  FiLoader,
} from "react-icons/fi";

interface CompanyRegisterProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

interface CompanyDetail {
  id: number;
  name: string;
  slug: string;
  description?: string;
  website?: string;
  industry?: string;
  size?: string;
  headquarters?: string;
  logoUrl?: string | null;
  coverUrl?: string | null;
  status: string;
  createdAt: string;
}

export function CompanyRegister({ onClose, onSuccess }: CompanyRegisterProps) {
  const navigate = useNavigate();
  const auth = useAuthentication();
  const user = auth?.user;

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingCompany, setExistingCompany] = useState<CompanyDetail | null>(
    null
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    website: "",
    industry: "",
    size: "50-200",
    headquarters: "",
  });

  useEffect(() => {
    if (user) {
      request<CompanyDetail>({
        endpoint: "/api/v1/companies/my",
        onSuccess: (data) => {
          if (data && data.slug) {
            setExistingCompany(data);
          } else {
            setExistingCompany(null);
          }
          setChecking(false);
        },
        onFailure: () => {
          setExistingCompany(null);
          setChecking(false);
        },
      });
    } else {
      setChecking(false);
    }
  }, [user]);

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
    if (!formData.name.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    setLoading(true);
    await request({
      endpoint: "/api/v1/companies",
      method: "POST",
      body: JSON.stringify(formData),
      onSuccess: () => {
        toast.success(
          "Company registration requested successfully! Your request is pending Admin approval."
        );
        if (onSuccess) {
          onSuccess();
        } else if (onClose) {
          onClose();
        } else {
          navigate("/");
        }
      },
      onFailure: (err) => {
        toast.error(err || "Could not register company. Please try again.");
      },
    });
    setLoading(false);
  };

  if (checking) {
    const loaderContent = (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500">
        <FiLoader className="h-8 w-8 animate-spin text-red-700 mb-3" />
        <p className="text-sm font-medium">
          Checking company registration status...
        </p>
      </div>
    );
    if (onClose) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl">
            {loaderContent}
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md px-4 py-16 bg-white rounded-3xl shadow-xl mt-8">
        {loaderContent}
      </div>
    );
  }

  if (!user) {
    const loginRequiredContent = (
      <div className="p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700 mb-4">
          <FiAlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Login Required</h2>
        <p className="mt-2 text-sm text-slate-600">
          You need to log in to register a company on HustLink.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {onClose && (
            <Button
              type="button"
              outline
              onClick={onClose}
              className="my-0 px-6"
            >
              Close
            </Button>
          )}
          <Button
            type="button"
            onClick={() => navigate("/login")}
            className="my-0 px-6 bg-red-700 text-white"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
    if (onClose) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl">
            {loginRequiredContent}
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-md px-4 py-8 bg-white rounded-3xl shadow-xl mt-8">
        {loginRequiredContent}
      </div>
    );
  }

  if (existingCompany) {
    const statusText =
      existingCompany.status === "ACTIVE"
        ? "Active"
        : existingCompany.status === "PENDING"
          ? "Pending Approval"
          : "Suspended / Closed";

    const statusColor =
      existingCompany.status === "ACTIVE"
        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
        : existingCompany.status === "PENDING"
          ? "text-amber-700 bg-amber-50 border-amber-200"
          : "text-rose-700 bg-rose-50 border-rose-200";

    const alreadyRegisteredContent = (
      <div className="overflow-hidden rounded-3xl border border-red-100 bg-white shadow-xl">
        <div className="bg-gradient-to-r from-red-700 to-red-900 p-6 text-white md:p-8">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            Notice
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
            Registration Not Available
          </h1>
          <p className="mt-2 text-sm text-red-100/90">
            You are already associated with a company in the system.
          </p>
        </div>
        <div className="p-6 md:p-8 text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-700">
            <FiBriefcase className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {existingCompany.name}
            </h2>
            <div className="mt-2 flex justify-center">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusColor}`}
              >
                {statusText}
              </span>
            </div>
            <p className="mt-4 text-sm text-slate-600 leading-relaxed max-w-md mx-auto">
              {existingCompany.status === "SUSPENDED"
                ? "Your company is currently closed/suspended. You can reopen it from your company management panel."
                : existingCompany.status === "PENDING"
                  ? "Your company registration is pending approval by the Admin. Please wait."
                  : "You currently own or belong to this company. Each user is allowed to own or participate in only one company at a time."}
            </p>
          </div>

          <div className="flex justify-center gap-3 pt-4 border-t border-slate-100">
            {onClose ? (
              <Button
                type="button"
                outline
                onClick={onClose}
                className="my-0 px-6"
              >
                Close
              </Button>
            ) : (
              <Button
                type="button"
                outline
                onClick={() => navigate(-1)}
                className="my-0 px-6 flex items-center gap-1.5"
              >
                <FiArrowLeft /> Back
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                if (onClose) onClose();
                navigate(`/companies/${existingCompany.slug}`);
              }}
              className="my-0 px-6 bg-red-700 hover:bg-red-800 text-white"
            >
              View Company
            </Button>
          </div>
        </div>
      </div>
    );

    if (onClose) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl">{alreadyRegisteredContent}</div>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        {alreadyRegisteredContent}
      </div>
    );
  }

  const formContent = (
    <div
      className={`overflow-hidden rounded-3xl border border-red-100 bg-white ${onClose ? "w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200" : "shadow-xl shadow-slate-100/40"}`}
    >
      <div className="bg-gradient-to-r from-red-700 to-red-900 p-6 text-white md:p-8">
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          Company
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
          Register New Company
        </h1>
        <p className="mt-2 text-sm text-red-100/90">
          Register your company information to start posting jobs and finding
          talent from Hanoi University of Science and Technology.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`space-y-6 p-6 md:p-8 ${onClose ? "max-h-[70vh] overflow-y-auto" : ""}`}
      >
        <div>
          <label
            className="block text-sm font-semibold text-slate-700"
            htmlFor="name"
          >
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Example: VinGroup, FPT Software, ..."
            required
            className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="industry"
            >
              Industry / Field
            </label>
            <input
              type="text"
              id="industry"
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              placeholder="Example: Information Technology, Telecommunications..."
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="size"
            >
              Company Size
            </label>
            <select
              id="size"
              name="size"
              value={formData.size}
              onChange={handleChange}
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            >
              <option value="1-10">1 - 10 employees</option>
              <option value="11-50">11 - 50 employees</option>
              <option value="51-200">51 - 200 employees</option>
              <option value="201-500">201 - 500 employees</option>
              <option value="501-1000">501 - 1000 employees</option>
              <option value="1000+">More than 1000 employees</option>
            </select>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="website"
            >
              Company Website
            </label>
            <input
              type="url"
              id="website"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://example.com"
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>

          <div>
            <label
              className="block text-sm font-semibold text-slate-700"
              htmlFor="headquarters"
            >
              Headquarters
            </label>
            <input
              type="text"
              id="headquarters"
              name="headquarters"
              value={formData.headquarters}
              onChange={handleChange}
              placeholder="Example: Cau Giay, Hanoi..."
              className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </div>
        </div>

        <div>
          <label
            className="block text-sm font-semibold text-slate-700"
            htmlFor="description"
          >
            Detailed Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={4}
            value={formData.description}
            onChange={handleChange}
            placeholder="Introduce your company's vision, mission, core products, etc..."
            className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 placeholder-slate-400 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
          ></textarea>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            outline
            onClick={() => {
              if (onClose) onClose();
              else navigate(-1);
            }}
            className="my-0 px-6 py-2.5 sm:w-fit"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="my-0 px-8 py-2.5 sm:w-fit bg-red-700 hover:bg-red-800 text-white"
          >
            {loading ? "Submitting..." : "Submit Registration Request"}
          </Button>
        </div>
      </form>
    </div>
  );

  if (onClose) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        {formContent}
      </div>
    );
  }

  return <div className="mx-auto max-w-2xl px-4 py-8">{formContent}</div>;
}
