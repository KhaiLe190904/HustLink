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
            error.message || "Đăng ký với Google thất bại. Vui lòng thử lại."
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
      toast.error("Vui lòng thay đổi email trước khi thử lại.");
      return;
    }

    setIsLoading(true);
    setLastSubmittedEmail(email);

    // Reset errors
    setErrorMessage("");
    setEmailError("");

    // Kiểm tra password policy
    if (!isPasswordValid) {
      setErrorMessage("Mật khẩu không đáp ứng yêu cầu. Vui lòng kiểm tra lại.");
      setIsLoading(false);
      return;
    }

    // Kiểm tra mật khẩu xác nhận
    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp");
      setIsLoading(false);
      return;
    }

    try {
      if (authentication && authentication.signup) {
        await authentication.signup(email, password);
        navigate("/");
      } else {
        throw new Error("Dịch vụ xác thực không khả dụng");
      }
    } catch (error) {
      if (error instanceof Error) {
        // Translate English error messages to Vietnamese
        let errorMessage = error.message;
        if (errorMessage.includes("previously bounced")) {
          errorMessage =
            "Email này không thể nhận được mã xác thực (Email không tồn tại). Vui lòng sử dụng email khác.";
          setEmailError(errorMessage);
        } else if (errorMessage.includes("already been registered")) {
          errorMessage = "Email này đã được đăng ký. Vui lòng đăng nhập.";
          setEmailError(errorMessage);
        } else if (errorMessage.includes("uppercase letter")) {
          errorMessage = "Mật khẩu phải chứa ít nhất một chữ hoa (A-Z).";
          setErrorMessage(errorMessage);
        } else if (errorMessage.includes("digit")) {
          errorMessage = "Mật khẩu phải chứa ít nhất một chữ số (0-9).";
          setErrorMessage(errorMessage);
        } else if (errorMessage.includes("special character")) {
          errorMessage =
            "Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*...).";
          setErrorMessage(errorMessage);
        } else if (errorMessage.includes("at least 8 characters")) {
          errorMessage = "Mật khẩu phải có ít nhất 8 ký tự.";
          setErrorMessage(errorMessage);
        }
        toast.error(errorMessage);
        // If it's not an email-related error, show in confirm password field
        if (!errorMessage.includes("Email")) {
          setErrorMessage(errorMessage);
        }
      } else {
        const defaultError = "Đã xảy ra lỗi không xác định";
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
        <h1>Đăng ký</h1>
        <p>Tận dụng tối đa cuộc sống nghề nghiệp của bạn</p>
        <form onSubmit={doSignup} noValidate>
          <Input
            type="email"
            id="email"
            name="email"
            label="Email"
            error={emailError}
            disabled={isLoading}
            helperText={
              emailError ? undefined : "Nhập email để nhận mã xác thực"
            }
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
              label="Mật khẩu"
              disabled={isLoading}
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
                    Ít nhất 8 ký tự
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
                    Chứa chữ hoa (A-Z)
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
                    Chứa chữ số (0-9)
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
                    Chứa ký tự đặc biệt (!@#$%^&*...)
                  </span>
                </div>
              </div>
            )}
          </div>
          <Input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            label="Xác nhận mật khẩu"
            error={errorMessage}
            disabled={isLoading}
            helperText={
              !errorMessage ? "Nhập lại mật khẩu để xác nhận" : undefined
            }
          />

          <Button
            type="submit"
            disabled={
              isLoading || (!!emailError && currentEmail === lastSubmittedEmail)
            }
          >
            {isLoading ? "Đang xử lý..." : "Đồng ý và tham gia"}
          </Button>
          <p className="text-xs">
            Khi nhấp vào Đồng ý và tham gia hoặc Tiếp tục, bạn đồng ý với.{" "}
            <a href="">Thỏa thuận người dùng</a>,{" "}
            <a href="">Chính sách riêng tư</a> và{" "}
            <a href="">Chính sách Cookie</a> của HustLink.
          </p>
        </form>
        <Seperator>Hoặc</Seperator>
        <GoogleLoginButton page="signup" />
        <div className="text-center">
          {" "}
          {/* .register styles */}
          Đã có tài khoản trên HustLink?{" "}
          <Link to="/authentication/login">Đăng nhập</Link>
        </div>
      </Box>
    </div>
  );
}
