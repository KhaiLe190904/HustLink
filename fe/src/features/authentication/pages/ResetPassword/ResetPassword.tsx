import { useNavigate } from "react-router-dom";
import { Box } from "@/features/authentication/components/Box/Box";
import { Button } from "@/features/authentication/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function ResetPassword() {
  const navigate = useNavigate();
  const [emailSent, setEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState<string>("");

  // Password validation rules
  const passwordRules = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
  };

  const isPasswordValid = Object.values(passwordRules).every((rule) => rule);
  const sendPasswordResetToken = async (email: string) => {
    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/api/v1/authentication/send-password-reset-token?email=${email}`,
        {
          method: "PUT",
        }
      );
      if (response.ok) {
        setErrorMessage("");
        setEmailSent(true);
        return;
      }
      const { message } = await response.json();
      toast.error(message);
    } catch (e) {
      console.log(e);
      toast.error("An unknown error occurred. Please try again later.");
    }
  };
  const resetPassword = async (
    email: string,
    code: string,
    password: string
  ) => {
    // Validate password policy before calling API
    if (!isPasswordValid) {
      setErrorMessage(
        "Your password does not meet the requirements. Please review and try again."
      );
      return;
    }

    try {
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL
        }/api/v1/authentication/reset-password?email=${email}&token=${code}&newPassword=${password}`,
        {
          method: "PUT",
        }
      );
      if (response.ok) {
        setErrorMessage("");
        toast.success("Password updated successfully");
        navigate("/authentication/login");
        return;
      }
      const { message } = await response.json();
      // Normalize common password-policy errors
      let errorMsg = message;
      if (errorMsg.includes("uppercase letter")) {
        errorMsg = "Password must include at least one uppercase letter (A-Z).";
      } else if (errorMsg.includes("digit")) {
        errorMsg = "Password must include at least one digit (0-9).";
      } else if (errorMsg.includes("special character")) {
        errorMsg =
          "Password must include at least one special character (!@#$%^&*...).";
      } else if (errorMsg.includes("at least 8 characters")) {
        errorMsg = "Password must be at least 8 characters long.";
      }
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } catch (e) {
      console.log(e);
      toast.error("An unknown error occurred. Please try again later.");
    }
  };

  return (
    <div className="px-16">
      {" "}
      {/* .root minimal styles */}
      <Box>
        <h1>Forgot password</h1>
        {!emailSent ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const email = e.currentTarget.email.value;
              await sendPasswordResetToken(email);
              setEmail(email);
            }}
          >
            <p className="mb-2">
              We'll send a verification code to this email if it matches an
              existing HustLink account.
            </p>
            <Input type="email" id="email" name="email" label="Email" />
            <p className="text-red-500 mb-4">{errorMessage}</p>
            <Button type="submit" className="mt-2 mb-2">
              Send verification code
            </Button>
            <Button
              type="button"
              outline
              onClick={() => navigate("/authentication/login")}
            >
              Back
            </Button>
          </form>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const code = e.currentTarget.code.value;
              const password = e.currentTarget.password.value;
              await resetPassword(email, code, password);
            }}
          >
            <p>
              Enter the verification code we sent and set your new password.
            </p>
            <Input
              type="text"
              label="Verification code"
              key="code"
              name="code"
            />
            <div>
              <Input
                type="password"
                label="New password"
                key="password"
                name="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(""); // Clear error when password changes
                }}
              />
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center text-xs">
                    <span
                      className={`mr-2 ${
                        passwordRules.minLength
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      {passwordRules.minLength ? "✓" : "○"}
                    </span>
                    <span
                      className={
                        passwordRules.minLength
                          ? "text-green-600"
                          : "text-gray-500"
                      }
                    >
                      At least 8 characters
                    </span>
                  </div>
                  <div className="flex items-center text-xs">
                    <span
                      className={`mr-2 ${
                        passwordRules.hasUppercase
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      {passwordRules.hasUppercase ? "✓" : "○"}
                    </span>
                    <span
                      className={
                        passwordRules.hasUppercase
                          ? "text-green-600"
                          : "text-gray-500"
                      }
                    >
                      Includes an uppercase letter (A-Z)
                    </span>
                  </div>
                  <div className="flex items-center text-xs">
                    <span
                      className={`mr-2 ${
                        passwordRules.hasDigit
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      {passwordRules.hasDigit ? "✓" : "○"}
                    </span>
                    <span
                      className={
                        passwordRules.hasDigit
                          ? "text-green-600"
                          : "text-gray-500"
                      }
                    >
                      Includes a digit (0-9)
                    </span>
                  </div>
                  <div className="flex items-center text-xs">
                    <span
                      className={`mr-2 ${
                        passwordRules.hasSpecialChar
                          ? "text-green-600"
                          : "text-gray-400"
                      }`}
                    >
                      {passwordRules.hasSpecialChar ? "✓" : "○"}
                    </span>
                    <span
                      className={
                        passwordRules.hasSpecialChar
                          ? "text-green-600"
                          : "text-gray-500"
                      }
                    >
                      Includes a special character (!@#$%^&*...)
                    </span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-red-500 mb-4">{errorMessage}</p>
            <Button type="submit">Confirm password reset</Button>
            <Button
              type="button"
              outline
              onClick={() => {
                setErrorMessage("");
                setEmailSent(false);
              }}
            >
              Back
            </Button>
          </form>
        )}
      </Box>
      <ToastContainer />
    </div>
  );
}
