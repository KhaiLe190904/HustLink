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

            // Logout and redirect to login after 5 seconds
            setTimeout(() => {
              clearInterval(countdownInterval);
              logout();
              navigate("/authentication/login");
              toast.error(
                "Invalid email address. Please sign up with a different email."
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
      toast.error("An unknown error occurred. Please try again later.");
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
        setMessage(
          "A new code was sent successfully. Please check your email."
        );
        return;
      }
      const { message } = await response.json();
      toast.error(message);
    } catch (e) {
      console.log(e);
      toast.error("An unknown error occurred. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="px-16">
      {" "}
      {/* .root minimal styles */}
      <Box>
        <h1>Verify your email</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsLoading(true);
            const code = e.currentTarget.code.value;
            await validateEmail(code);
            setIsLoading(false);
          }}
        >
          <p>We've sent a verification email to your email address.</p>
          <p className="mb-2">
            If you don't receive it, check your spam folder or try again.
          </p>
          <Input type="text" label="Verification code" key="code" name="code" />
          {message && <p className="text-green-500">{message}</p>}
          {errorMessage && <p className="text-red-500">{errorMessage}</p>}
          <Button type="submit" disabled={isLoading} className="mt-2 mb-2">
            Verify email
          </Button>
          <Button
            type="button"
            outline
            disabled={isLoading}
            onClick={() => {
              sendEmailVerificationToken();
            }}
          >
            Resend code
          </Button>
          {isEmailDelivered && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800 mb-3">
                If you still can't find the email, confirm your address is
                correct and try again.
                <p className="mt-1">
                  Is your email:{" "}
                  <span className="font-semibold">{user?.email}</span>?
                </p>
              </div>

              <Button
                type="button"
                outline
                onClick={() => {
                  logout();
                  navigate("/authentication/signup");
                }}
              >
                That's not my email
              </Button>
            </div>
          )}
        </form>
      </Box>
      <ToastContainer />
      {/* Modal shown when email is bounced */}
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
              Invalid email address
            </h2>
            <p className="text-center text-gray-700 mb-6">
              Your email can't receive a verification code (email address
              doesn't exist). Please sign up with a different email.
            </p>
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-4">
                Redirecting to the sign-in page in{" "}
                <span className="font-bold text-red-600">{countdown}</span>{" "}
                seconds...
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowBouncedModal(false);
                    logout();
                    navigate("/authentication/login");
                    toast.error(
                      "Invalid email address. Please sign up with a different email."
                    );
                  }}
                >
                  OK
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
