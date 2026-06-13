import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import { request } from "@/utils/api";
import { FiUpload, FiImage, FiLoader, FiTrash2 } from "react-icons/fi";

export function CompanyEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [formData, setFormData] = useState({
    description: "",
    website: "",
    industry: "",
    size: "",
    headquarters: "",
    logoUrl: "",
    coverUrl: "",
  });

  useEffect(() => {
    // Fetch my company details
    request<any>({
      endpoint: "/api/v1/companies/my",
      onSuccess: (data) => {
        if (!data || data.id.toString() !== id) {
          toast.error("You do not have permission to edit this company");
          navigate("/");
          return;
        }
        setFormData({
          description: data.description || "",
          website: data.website || "",
          industry: data.industry || "",
          size: data.size || "50-200",
          headquarters: data.headquarters || "",
          logoUrl: data.logoUrl || "",
          coverUrl: data.coverUrl || "",
        });
        setLoading(false);
      },
      onFailure: (err) => {
        toast.error(err || "Could not load company details");
        navigate("/");
      },
    });
  }, [id, navigate]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "cover"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image file size must be 10MB or smaller.");
      return;
    }

    const formDataFile = new FormData();
    formDataFile.append("file", file);
    formDataFile.append(
      "scope",
      type === "logo" ? "COMPANY_LOGO" : "COMPANY_COVER"
    );

    if (type === "logo") setUploadingLogo(true);
    else setUploadingCover(true);

    await request<any>({
      endpoint: "/api/v1/storage/upload",
      method: "POST",
      body: formDataFile,
      onSuccess: (data) => {
        const fullUrl = `${import.meta.env.VITE_API_URL}${data.apiPath}`;
        setFormData((prev) => ({
          ...prev,
          [type === "logo" ? "logoUrl" : "coverUrl"]: fullUrl,
        }));
        toast.success(
          `${type === "logo" ? "Logo" : "Cover"} image uploaded successfully!`
        );
      },
      onFailure: (err) => {
        toast.error(`Failed to upload ${type}: ${err}`);
      },
    });

    if (type === "logo") setUploadingLogo(false);
    else setUploadingCover(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await request<any>({
      endpoint: `/api/v1/companies/${id}`,
      method: "PATCH",
      body: JSON.stringify(formData),
      onSuccess: (data) => {
        toast.success("Company details updated successfully!");
        navigate(`/companies/${data.slug}`);
      },
      onFailure: (err) => {
        toast.error(err || "Failed to update. Please try again.");
      },
    });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-700 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="bg-slate-900 p-6 text-white md:p-8">
          <h1 className="text-2xl font-bold">Edit Company Profile</h1>
          <p className="mt-1 text-sm text-slate-400">
            Update your company's logo, cover image, and detailed description.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6 md:p-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Logo Upload */}
            <div>
              <span className="block text-sm font-semibold text-slate-700 mb-2">
                Company Logo
              </span>
              <div className="relative group flex items-center justify-center w-36 h-36 rounded-2xl border-2 border-dashed border-slate-200 hover:border-red-500 bg-slate-50 transition-all overflow-hidden cursor-pointer">
                {formData.logoUrl ? (
                  <>
                    <img
                      src={formData.logoUrl}
                      alt="Logo Preview"
                      className="w-full h-full object-contain p-2"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-xs font-bold transition-all">
                      <FiUpload className="h-5 w-5" />
                      <span>Change Logo</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                    <FiImage className="h-8 w-8 mb-1.5" />
                    <span className="text-xs font-bold">Upload Logo</span>
                  </div>
                )}
                {uploadingLogo && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <FiLoader className="h-6 w-6 text-red-700 animate-spin" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, "logo")}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={uploadingLogo}
                />
              </div>
              {formData.logoUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, logoUrl: "" }))
                  }
                  className="mt-2 text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1.5"
                >
                  <FiTrash2 className="h-3.5 w-3.5" /> Remove Logo
                </button>
              )}
            </div>

            {/* Cover Upload */}
            <div>
              <span className="block text-sm font-semibold text-slate-700 mb-2">
                Cover Image
              </span>
              <div className="relative group flex items-center justify-center w-full h-36 rounded-2xl border-2 border-dashed border-slate-200 hover:border-red-500 bg-slate-50 transition-all overflow-hidden cursor-pointer">
                {formData.coverUrl ? (
                  <>
                    <img
                      src={formData.coverUrl}
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 text-white text-xs font-bold transition-all">
                      <FiUpload className="h-5 w-5" />
                      <span>Change Cover</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                    <FiImage className="h-8 w-8 mb-1.5" />
                    <span className="text-xs font-bold">Upload Cover</span>
                  </div>
                )}
                {uploadingCover && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <FiLoader className="h-6 w-6 text-red-700 animate-spin" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, "cover")}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={uploadingCover}
                />
              </div>
              {formData.coverUrl && (
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({ ...prev, coverUrl: "" }))
                  }
                  className="mt-2 text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1.5"
                >
                  <FiTrash2 className="h-3.5 w-3.5" /> Remove Cover
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                className="block text-sm font-semibold text-slate-700"
                htmlFor="industry"
              >
                Industry
              </label>
              <input
                type="text"
                id="industry"
                name="industry"
                value={formData.industry}
                onChange={handleChange}
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
                className="mt-1 block w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
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
              rows={5}
              value={formData.description}
              onChange={handleChange}
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
              disabled={saving}
              className="my-0 px-8 py-2.5 sm:w-fit bg-red-700 hover:bg-red-800 text-white"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
