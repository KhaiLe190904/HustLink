import { Link, useNavigate } from "react-router-dom";
import { Box } from "@/features/authentication/components/Box/Box";
import { Button } from "@/features/authentication/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Seperator } from "@/features/authentication/components/Seperator/Seperator";
import { FormEvent, useState } from "react";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export function Signup() {
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const authentication = useAuthentication();
  const navigate = useNavigate();

  const doSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    const email = e.currentTarget.email.value;
    const password = e.currentTarget.password.value;
    const confirmPassword = e.currentTarget.confirmPassword.value;

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
        toast.error(error.message);
      } else {
        setErrorMessage("Đã xảy ra lỗi không xác định");
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
        <form onSubmit={doSignup}>
          <Input
            type="email"
            id="email"
            name="email"
            label="Email"
            helperText="Sử dụng email trường học hoặc email cá nhân"
          />
          <Input
            type="password"
            id="password"
            name="password"
            label="Mật khẩu"
            helperText="Tối thiểu 8 ký tự, bao gồm chữ và số"
          />
          <Input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            label="Xác nhận mật khẩu"
            error={errorMessage}
            helperText={
              !errorMessage ? "Nhập lại mật khẩu để xác nhận" : undefined
            }
          />
          
          <Button type="submit" disabled={isLoading}>
            Đồng ý và tham gia
          </Button>
          <p className="text-xs">
            Khi nhấp vào Đồng ý và tham gia hoặc Tiếp tục, bạn đồng ý với.{" "}
            <a href="">Thỏa thuận người dùng</a>,{" "}
            <a href="">Chính sách riêng tư</a> và{" "}
            <a href="">Chính sách Cookie</a> của HustLink.
          </p>
        </form>
        <Seperator>Hoặc</Seperator>
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
