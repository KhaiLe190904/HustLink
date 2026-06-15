import { useState, useEffect } from "react";
import { request } from "@/utils/api";
import { FiX, FiAlertTriangle } from "react-icons/fi";
import { toast } from "react-toastify";
import { Button } from "@/features/authentication/components/Button/Button";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";

interface ReportContentModalProps {
  showModal: boolean;
  setShowModal: (show: boolean) => void;
  targetType: "POST" | "COMMENT" | "USER";
  targetId: number;
}

export function ReportContentModal({
  showModal,
  setShowModal,
  targetType,
  targetId,
}: ReportContentModalProps) {
  const { user } = useAuthentication();
  const [reason, setReason] = useState<
    "SPAM" | "TOXICITY" | "HARASSMENT" | "SCAM" | "INAPPROPRIATE" | "OTHER"
  >("SPAM");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (showModal && user?.id) {
      const key = `reported_${user.id}_${targetType}_${targetId}`;
      if (localStorage.getItem(key)) {
        toast.info(
          `You have already reported this ${targetType.toLowerCase()}.`
        );
        setShowModal(false);
      }
    }
  }, [showModal, targetType, targetId, setShowModal, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    await request({
      endpoint: "/api/v1/reports",
      method: "POST",
      body: JSON.stringify({
        targetType,
        targetId,
        reason,
        details,
      }),
      onSuccess: () => {
        toast.success(
          "Thank you. The report has been submitted to the administrators."
        );
        if (user?.id) {
          localStorage.setItem(
            `reported_${user.id}_${targetType}_${targetId}`,
            "true"
          );
        }
        setShowModal(false);
        setDetails("");
        setReason("SPAM");
        setSubmitting(false);
      },
      onFailure: (err) => {
        toast.error(err || "Failed to submit report. Please try again.");
        setSubmitting(false);
      },
    });
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FiAlertTriangle className="text-amber-500" />
            <span>
              Report{" "}
              {targetType === "USER"
                ? "Profile"
                : targetType === "POST"
                  ? "Post"
                  : "Comment"}
            </span>
          </h3>
          <button
            onClick={() => setShowModal(false)}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-xl transition cursor-pointer"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reason Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Reason for Report
            </label>
            <select
              value={reason}
              onChange={(e) =>
                setReason(
                  e.target.value as
                    | "SPAM"
                    | "TOXICITY"
                    | "HARASSMENT"
                    | "SCAM"
                    | "INAPPROPRIATE"
                    | "OTHER"
                )
              }
              className="w-full rounded-2xl border border-slate-200 py-2.5 px-3 text-sm text-slate-800 outline-none transition focus:border-red-500 bg-white"
            >
              <option value="SPAM">Spam</option>
              <option value="TOXICITY">Toxicity</option>
              <option value="HARASSMENT">Harassment</option>
              <option value="SCAM">Scam / Fraud</option>
              <option value="INAPPROPRIATE">Inappropriate Content</option>
              <option value="OTHER">Other Reason</option>
            </select>
          </div>

          {/* Details Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Report Details
            </label>
            <textarea
              rows={4}
              placeholder="Describe the issue in detail..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 p-3 text-sm text-slate-800 outline-none transition focus:border-red-500"
            />
          </div>

          <p className="text-[10px] text-slate-400 leading-relaxed">
            Your report will be reviewed manually by site moderators. Abuse of
            reporting options may lead to account actions.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-50 pt-4">
            <Button
              type="button"
              outline
              className="my-0 px-4 py-2 border-slate-200 text-slate-700 hover:bg-slate-50 w-auto text-xs"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="my-0 px-5 py-2 bg-red-650 hover:bg-red-700 text-white w-auto text-xs font-bold"
            >
              Submit Report
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
