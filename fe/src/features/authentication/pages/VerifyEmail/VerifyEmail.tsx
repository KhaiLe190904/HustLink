import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@/features/authentication/components/Box/Box";
import { Input } from "@/components/Input/Input";
import { Button } from "@/features/authentication/components/Button/Button";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";

export function VerifyEmail() {
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showBouncedModal, setShowBouncedModal] = useState(false);
  const [isEmailDelivered, setIsEmailDelivered] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const { user, setUser, logout } = useAuthentication();
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/authentication/email-status`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );
        if (response.ok) {
          const status = await response.text();
          if (status === "bounced" && !showBouncedModal) {
            setShowBouncedModal(true);
            setCountdown(5);

            // Countdown timer
            const countdownInterval = setInterval(() => {
              setCountdown((prev) => {
                if (prev <= 1) {
                  clearInterval(countdownInterval);
                  return 0;
                }
                return prev - 1;
              });
            }, 1000);

            // Logout và redirect về login sau 5 giây
            setTimeout(() => {
              clearInterval(countdownInterval);
              logout();
              navigate("/authentication/login");
              toast.error(
                "Email không hợp lệ. Vui lòng đăng ký bằng email khác."
              );
            }, 5000);
          } else if (status === "delivered") {
            setIsEmailDelivered(true);
          }
        }
      } catch (e) {
        console.log(e);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [logout, navigate, showBouncedModal]);

  const validateEmail = async (code: string) => {
    setMessage("");
    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/api/v1/authentication/validate-email-verification-token?tokenOTP=${code}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.ok) {
        setErrorMessage("");

        // Fetch updated user data after successful verification
        const userResponse = await fetch(
          `${import.meta.env.VITE_API_URL}/api/v1/authentication/users/me`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);
          // Let the context provider handle the redirect based on updated user data
        }
      } else {
        const { message } = await response.json();
        toast.error(message);
      }
    } catch (error) {
      console.log(error);
      toast.error("Đã xảy ra lỗi không xác định, vui lòng thử lại sau");
    } finally {
      setIsLoading(false);
    }
  };

  const sendEmailVerificationToken = async () => {
    setMessage("");
    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/api/v1/authentication/send-email-verification-token`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.ok) {
        setErrorMessage("");
        setMessage("Đã gửi mã mới thành công. Hãy check email của bạn");
        return;
      }
      const { message } = await response.json();
      toast.error(message);
    } catch (e) {
      console.log(e);
      toast.error("Đã xảy ra lỗi không xác định, vui lòng thử lại sau");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="px-16">
      {" "}
      {/* .root minimal styles */}
      <Box>
        <h1>Xác thực email</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsLoading(true);
            const code = e.currentTarget.code.value;
            await validateEmail(code);
            setIsLoading(false);
          }}
        >
          <p>Chúng tôi đã gửi một email xác thực đến địa chỉ email của bạn.</p>
          <p>
            Nếu bạn không nhận được email, hãy kiểm tra thư mục spam hoặc thử
            lại.
          </p>
          <Input type="text" label="Mã xác thực" key="code" name="code" />
          {message && <p className="text-green-500">{message}</p>}
          {errorMessage && <p className="text-red-500">{errorMessage}</p>}
          <Button type="submit" disabled={isLoading}>
            Xác thực Email
          </Button>
          <Button
            type="button"
            outline
            disabled={isLoading}
            onClick={() => {
              sendEmailVerificationToken();
            }}
          >
            Gửi lại mã
          </Button>
          {isEmailDelivered && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 mb-3">
                Nếu bạn không thấy email gửi tới, hãy kiểm tra lại có chính xác
                là email của bạn không và thử lại!
                <p>
                  Có phải email của bạn là:{" "}
                  <span className="font-semibold">{user?.email}</span>?
                </p>
              </p>

              <Button
                type="button"
                outline
                onClick={() => {
                  logout();
                  navigate("/authentication/signup");
                }}
              >
                Không phải email của tôi
              </Button>
            </div>
          )}
        </form>
      </Box>
      <ToastContainer />
      {/* Modal hiển thị khi email bị bounced */}
      {showBouncedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-center mb-4 text-gray-900">
              Email không hợp lệ
            </h2>
            <p className="text-center text-gray-700 mb-6">
              Email của bạn không thể nhận được mã xác thực (Email không tồn
              tại). Vui lòng đăng ký bằng email khác.
            </p>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                Tự động chuyển về trang đăng nhập sau{" "}
                <span className="font-bold text-red-600">{countdown}</span>{" "}
                giây...
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowBouncedModal(false);
                    logout();
                    navigate("/authentication/login");
                    toast.error(
                      "Email không hợp lệ. Vui lòng đăng ký bằng email khác."
                    );
                  }}
                >
                  Đồng ý
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
