import { Dispatch, SetStateAction, useState } from "react";
import { Input } from "@/components/Input/Input";
import { Button } from "@/features/authentication/components/Button/Button";
interface PostingMadalProps {
  showModal: boolean;
  content?: string;
  picture?: string;
  setShowModal: Dispatch<SetStateAction<boolean>>;
  onSubmit: (content: string, picture: string) => Promise<void>;
  title: string;
}
export function Madal({
  setShowModal,
  showModal,
  onSubmit,
  content,
  picture,
  title,
}: PostingMadalProps) {
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-start z-[9999]">
      {" "}
      {/* .root styles */}
      <div className="bg-white rounded-lg border border-gray-300 w-full max-w-3xl mx-4 mt-18 p-4">
        {" "}
        {/* .modal styles */}
        <div className="flex justify-between items-center mb-4">
          {" "}
          {/* .header styles */}
          <h3 className="font-bold">{title}</h3> {/* .title styles */}
          <button
            onClick={() => setShowModal(false)}
            className="bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors cursor-pointer" /* header button styles */
          >
            X
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsLoading(true);
            const content = e.currentTarget.content.value;
            const picture = e.currentTarget.picture.value;

            if (!content) {
              setError("");
              setIsLoading(false);
              return;
            }

            try {
              await onSubmit(content, picture);
            } catch (error) {
              if (error instanceof Error) {
                setError(error.message);
              } else {
                setError("An error occurred. Please try again later.");
              }
            } finally {
              setIsLoading(false);
              setShowModal(false);
            }
          }}
        >
          <div>
            {" "}
            {/* .body - minimal wrapper */}
            <textarea
              placeholder="What do you want to talk about?"
              onFocus={() => setError("")}
              onChange={() => setError("")}
              name="content"
              defaultValue={content}
              className="w-full h-80 resize-none border border-gray-300 rounded-lg p-4" /* textarea styles */
            />
            <Input
              label="Image URL (optional)"
              defaultValue={picture}
              name="picture"
              style={{
                marginBlock: 0,
              }}
            />
          </div>
          {error && <div className="text-red-500">{error}</div>}{" "}
          {/* .error styles */}
          <div>
            {" "}
            {/* .footer - minimal wrapper */}
            <Button size="medium" type="submit" disabled={isLoading}>
              Post
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
