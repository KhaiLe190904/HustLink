import { usePageTitle } from "@/hooks/usePageTitle";

export function CVUpload() {
  usePageTitle("CV Upload");

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <h1 className="text-2xl font-bold text-gray-700">CV AI Analysis</h1>
      <p className="text-gray-500">This feature is coming soon.</p>
    </div>
  );
}
