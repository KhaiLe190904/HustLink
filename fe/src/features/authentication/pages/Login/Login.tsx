import { Link, useLocation, useNavigate } from "react-router-dom";
import { Box } from "@/features/authentication/components/Box/Box";
import { Button } from "@/features/authentication/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Seperator } from "@/features/authentication/components/Seperator/Seperator";
import { GoogleLoginButton } from "@/features/authentication/components/GoogleLoginButton/GoogleLoginButton";
import { toast } from "react-toastify";
import { FormEvent, useState, useEffect } from "react";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import "react-toastify/dist/ReactToastify.css";
export function Login() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const authentication = useAuthentication();
  const navigate = useNavigate();
  const location = useLocation();

  // Handle Google OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");

    if (code && authentication && authentication.googleLogin) {
      // Clear URL params IMMEDIATELY to prevent re-trigger
      window.history.replaceState({}, "", "/authentication/login");

      setIsLoading(true);
      authentication
        .googleLogin(code, "login")
        .then(() => {
          const destination = location.state?.from?.pathname || "/";
          navigate(destination);
        })
        .catch((error) => {
          toast.error(
            error.message || "Google sign-in failed. Please try again."
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const doLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const email = e.currentTarget.email.value;
    const password = e.currentTarget.password.value;
    try {
      if (authentication && authentication.login) {
        await authentication.login(email, password);
        const destination = location.state?.from?.pathname || "/";
        navigate(destination);
      } else {
        throw new Error("Authentication service is unavailable");
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("An unknown error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="[&_main]:px-16 [&_form]:mt-4">
      {" "}
      {/* .root styles */}
      <Box>
        <h1>Sign in</h1>
        <p>Welcome to HustLink</p>
        <form onSubmit={doLogin}>
          <Input
            type="email"
            id="email"
            name="email"
            label="Email"
            onFocus={() => setErrorMessage("")}
            helperText="Enter your email address"
          />
          <Input
            type="password"
            id="password"
            name="password"
            label="Password"
            loading={isLoading}
            onFocus={() => setErrorMessage("")}
            helperText="Enter your password"
          />
          {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}{" "}
          <div className="text-right mb-4">
            <Link to="/authentication/request-password-reset">
              Forgot password?
            </Link>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
        <Seperator>OR</Seperator>
        <GoogleLoginButton page="login" />
        <div className="text-center">
          {" "}
          {/* .register styles */}
          Don't have a HustLink account?{" "}
          <Link to="/authentication/signup">Join now</Link>
        </div>
      </Box>
    </div>
  );
}
