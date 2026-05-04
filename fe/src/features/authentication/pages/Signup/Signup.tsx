import { Link, useNavigate } from "react-router-dom";
import { Box } from "@/features/authentication/components/Box/Box";
import { Button } from "@/features/authentication/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Seperator } from "@/features/authentication/components/Seperator/Seperator";
import { GoogleLoginButton } from "@/features/authentication/components/GoogleLoginButton/GoogleLoginButton";
import { FormEvent, useState, useEffect } from "react";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function Signup() {
  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastSubmittedEmail, setLastSubmittedEmail] = useState<string>("");
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const authentication = useAuthentication();
  const navigate = useNavigate();

  // Handle Google OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code && authentication && authentication.googleLogin) {
      // Clear URL params IMMEDIATELY to prevent re-trigger
      window.history.replaceState({}, "", "/authentication/signup");

      setIsLoading(true);
      authentication
        .googleLogin(code, "signup")
        .then(() => {
          navigate("/");
        })
        .catch((error) => {
          toast.error(
            error.message || "Google sign-up failed. Please try again."
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Password validation rules
  const passwordRules = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSpecialChar: /[^A-Za-z0-9]/.test(password),
  };

  const isPasswordValid = Object.values(passwordRules).every((rule) => rule);

  const doSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent spam clicking - return if already loading
    if (isLoading) {
      return;
    }

    const email = e.currentTarget.email.value;
    const password = e.currentTarget.password.value;
    const confirmPassword = e.currentTarget.confirmPassword.value;

    // Prevent submitting same email if it has any email error (bounced or already registered)
    if (email === lastSubmittedEmail && emailError) {
      toast.error("Please change your email before trying again.");
      return;
    }

    setIsLoading(true);
    setLastSubmittedEmail(email);

    // Reset errors
    setErrorMessage("");
    setEmailError("");

    // Validate password policy
    if (!isPasswordValid) {
      setErrorMessage(
        "Your password does not meet the requirements. Please review and try again."
      );
      setIsLoading(false);
      return;
    }

    // Validate confirm password
    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      if (authentication && authentication.signup) {
        await authentication.signup(email, password);
        navigate("/");
      } else {
        throw new Error("Authentication service is unavailable");
      }
    } catch (error) {
      if (error instanceof Error) {
        // Normalize common auth errors
        let errorMessage = error.message;
        if (errorMessage.includes("previously bounced")) {
          errorMessage =
            "This email can't receive a verification code (email address doesn't exist). Please use another email.";
          setEmailError(errorMessage);
        } else if (errorMessage.includes("already been registered")) {
          errorMessage = "This email is already registered. Please sign in.";
          setEmailError(errorMessage);
        } else if (errorMessage.includes("uppercase letter")) {
          errorMessage =
            "Password must include at least one uppercase letter (A-Z).";
          setErrorMessage(errorMessage);
        } else if (errorMessage.includes("digit")) {
          errorMessage = "Password must include at least one digit (0-9).";
          setErrorMessage(errorMessage);
        } else if (errorMessage.includes("special character")) {
          errorMessage =
            "Password must include at least one special character (!@#$%^&*...).";
          setErrorMessage(errorMessage);
        } else if (errorMessage.includes("at least 8 characters")) {
          errorMessage = "Password must be at least 8 characters long.";
          setErrorMessage(errorMessage);
        }
        toast.error(errorMessage);
        // If it's not an email-related error, show in confirm password field
        if (!errorMessage.includes("Email")) {
          setErrorMessage(errorMessage);
        }
      } else {
        const defaultError = "An unknown error occurred";
        toast.error(defaultError);
        setErrorMessage(defaultError);
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="[&_.logo]:w-28 [&_main]:px-16 [&_form]:mt-4">
      {" "}
      {/* .root styles */}
      <Box>
        <h1>Sign up</h1>
        <p>Make the most of your professional life</p>
        <form onSubmit={doSignup} noValidate>
          <Input
            type="email"
            id="email"
            name="email"
            label="Email"
            error={emailError}
            disabled={isLoading}
            onChange={(e) => {
              const newEmail = e.target.value;
              setCurrentEmail(newEmail);
              // Reset error when email changes
              if (emailError) {
                setEmailError("");
                setLastSubmittedEmail(""); // Reset last submitted email to allow resubmit
              }
            }}
          />
          <div>
            <Input
              type="password"
              id="password"
              name="password"
              label="Password"
              disabled={isLoading}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage(""); // Clear error when password changes
              }}
            />
            {password && (
              <div className="mt-2 space-y-1 mb-4">
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
          <Input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm password"
            error={errorMessage}
            disabled={isLoading}
            helperText={
              !errorMessage ? "Re-enter your password to confirm" : undefined
            }
          />

          <Button
            type="submit"
            disabled={
              isLoading || (!!emailError && currentEmail === lastSubmittedEmail)
            }
          >
            {isLoading ? "Processing..." : "Agree and join"}
          </Button>
          <p className="text-xs">
            By clicking Agree and join or Continue, you agree to HustLink's{" "}
            <a href="">User Agreement</a>, <a href="">Privacy Policy</a>, and{" "}
            <a href="">Cookie Policy</a>.
          </p>
        </form>
        <Seperator>Or</Seperator>
        <GoogleLoginButton page="signup" />
        <div className="text-center">
          {" "}
          {/* .register styles */}
          Already on HustLink? <Link to="/authentication/login">Sign in</Link>
        </div>
      </Box>
    </div>
  );
}
