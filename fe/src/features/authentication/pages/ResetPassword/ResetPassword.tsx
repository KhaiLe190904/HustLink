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
      toast.error("Đã xảy ra lỗi không xác định, vui lòng thử lại sau");
    }
  };
  const resetPassword = async (
    email: string,
    code: string,
    password: string
  ) => {
    // Validate password policy before calling API
    if (!isPasswordValid) {
      setErrorMessage("Mật khẩu không đáp ứng yêu cầu. Vui lòng kiểm tra lại.");
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
        toast.success("Đổi mật khẩu thành công");
        navigate("/authentication/login");
        return;
      }
      const { message } = await response.json();
      // Translate error messages
      let errorMsg = message;
      if (errorMsg.includes("uppercase letter")) {
        errorMsg = "Mật khẩu phải chứa ít nhất một chữ hoa (A-Z).";
      } else if (errorMsg.includes("digit")) {
        errorMsg = "Mật khẩu phải chứa ít nhất một chữ số (0-9).";
      } else if (errorMsg.includes("special character")) {
        errorMsg =
          "Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*...).";
      } else if (errorMsg.includes("at least 8 characters")) {
        errorMsg = "Mật khẩu phải có ít nhất 8 ký tự.";
      }
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    } catch (e) {
      console.log(e);
      toast.error("Đã xảy ra lỗi không xác định, vui lòng thử lại sau");
    }
  };

  return (
    <div className="px-16">
      {" "}
      {/* .root minimal styles */}
      <Box>
        <h1>Quên mật khẩu</h1>
        {!emailSent ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const email = e.currentTarget.email.value;
              await sendPasswordResetToken(email);
              setEmail(email);
            }}
          >
            <Input type="email" id="email" name="email" label="Email" />
            <p className="text-red-500 mb-4">{errorMessage}</p>
            <p>
              Chúng tôi sẽ gửi mã xác minh tới email hoặc số điện thoại này nếu
              nó khớp với tài khoản HustLink hiện có.
            </p>
            <Button type="submit">Gửi mã xác minh</Button>
            <Button
              type="button"
              outline
              onClick={() => navigate("/authentication/login")}
            >
              Quay lại
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
              Hãy điền mã xác minh chúng tôi vừa gửi tới Email bạn và điền mật
              khẩu mới
            </p>
            <Input type="text" label="Mã xác minh" key="code" name="code" />
            <div>
              <Input
                type="password"
                label="Mật khẩu mới"
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
            <p className="text-red-500 mb-4">{errorMessage}</p>
            <Button type="submit">Xác nhận đổi mật khẩu</Button>
            <Button
              type="button"
              outline
              onClick={() => {
                setErrorMessage("");
                setEmailSent(false);
              }}
            >
              Quay lại
            </Button>
          </form>
        )}
      </Box>
      <ToastContainer />
    </div>
  );
}
