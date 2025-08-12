import { useNavigate } from "react-router-dom";
import { Box } from "@/features/authentication/components/Box/Box";
import { Button } from "@/features/authentication/components/Button/Button";
import { Input } from "@/components/Input/Input";
import classes from "./ResetPassword.module.css";
import { useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function ResetPassword() {
  const navigate = useNavigate();
  const [emailSent, setEmailSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
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
    } finally {
      setIsLoading(false);
    }
  };
  const resetPassword = async (
    email: string,
    code: string,
    password: string
  ) => {
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
      toast.error(message);
    } catch (e) {
      console.log(e);
      toast.error("Đã xảy ra lỗi không xác định, vui lòng thử lại sau");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={classes.root}>
      <Box>
        <h1>Quên mật khẩu</h1>
        {!emailSent ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setIsLoading(true);
              const email = e.currentTarget.email.value;
              await sendPasswordResetToken(email);
              setEmail(email);
              setIsLoading(false);
            }}
          >
            <Input type="email" id="email" label="Email" />
            <p style={{ color: "red" }}>{errorMessage}</p>
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
              setIsLoading(true);
              const code = e.currentTarget.code.value;
              const password = e.currentTarget.password.value;
              await resetPassword(email, code, password);
              setIsLoading(false);
            }}
          >
            <p>
              Hãy điền mã xác minh chúng tôi vừa gửi tới Email bạn và điền mật
              khẩu mới
            </p>
            <Input type="text" label="Mã xác minh" key="code" name="code" />
            <Input
              type="password"
              label="Mật khẩu mới"
              key="password"
              name="password"
              id="password"
            />
            <p style={{ color: "red" }}>{errorMessage}</p>
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
