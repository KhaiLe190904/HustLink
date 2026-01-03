import { Link, useLocation, useNavigate } from "react-router-dom";
import { Box } from "@/features/authentication/components/Box/Box";
import { Button } from "@/features/authentication/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Seperator } from "@/features/authentication/components/Seperator/Seperator";
import { toast } from "react-toastify";
import { FormEvent, useState } from "react";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import "react-toastify/dist/ReactToastify.css";
export function Login() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const authentication = useAuthentication();
  const navigate = useNavigate();
  const location = useLocation();
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
        throw new Error("Dịch vụ xác thực không khả dụng");
      }
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Đã xảy ra lỗi không xác định");
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
        <h1>Đăng nhập</h1>
        <p>Chào mừng bạn đến với HustLink</p>
        <form onSubmit={doLogin}>
          <Input
            type="email"
            id="email"
            name="email"
            label="Email"
            onFocus={() => setErrorMessage("")}
            helperText="Nhập địa chỉ email của bạn"
          />
          <Input
            type="password"
            id="password"
            name="password"
            label="Password"
            loading={isLoading}
            onFocus={() => setErrorMessage("")}
            helperText="Nhập mật khẩu của bạn"
          />
          {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}{" "}
          <div className="text-right mb-4">
            <Link to="/authentication/request-password-reset">
              Quên mật khẩu?
            </Link>
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
        <Seperator>Hoặc</Seperator>
        <div className="text-center">
          {" "}
          {/* .register styles */}
          Chưa có tài khoản trên HustLink?{" "}
          <Link to="/authentication/signup">Tham gia ngay</Link>
        </div>
      </Box>
    </div>
  );
}
