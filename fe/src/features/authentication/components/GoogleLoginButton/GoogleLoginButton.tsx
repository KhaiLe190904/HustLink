import { FcGoogle } from "react-icons/fc";

export function GoogleLoginButton({ page }: { page: "login" | "signup" }) {
  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const baseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
    const redirectUri = `${baseUrl}/authentication/${page}`;
    const scope = "openid email profile";
    const responseType = "code";
    const accessType = "offline";
    const prompt = "consent";

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=${responseType}&scope=${encodeURIComponent(
      scope
    )}&access_type=${accessType}&prompt=${prompt}`;

    window.location.href = googleAuthUrl;
  };

  return (
    <button
      type="button"
      onClick={handleGoogleLogin}
      className="flex justify-center items-center gap-3 w-full rounded-full my-4 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm"
    >
      <FcGoogle size={20} />
      <span>Continue with Google</span>
    </button>
  );
}
