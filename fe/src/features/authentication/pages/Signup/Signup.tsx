import { Link, useNavigate } from "react-router-dom";
import { Box } from "@/features/authentication/components/Box/Box";
import { Button } from "@/features/authentication/components/Button/Button";
import { Input } from "@/components/Input/Input";
import { Seperator } from "@/features/authentication/components/Seperator/Seperator";
import classes from "./Signup.module.css";
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
    <div className={classes.root}>
      <Box>
        <h1>Đăng ký</h1>
        <p>Tận dụng tối đa cuộc sống nghề nghiệp của bạn</p>
        <form onSubmit={doSignup}>
          <Input type="email" id="email" label="Email" />
          <Input type="password" id="password" label="Mật khẩu" />
          <Input
            type="password"
            id="confirmPassword"
            label="Xác nhận mật khẩu"
          />
          {errorMessage && <p className={classes.error}>{errorMessage}</p>}
          <p className={classes.disclaimer}>
            Khi nhấp vào Đồng ý và tham gia hoặc Tiếp tục, bạn đồng ý với.{" "}
            <a href="">Thỏa thuận người dùng</a>,{" "}
            <a href="">Chính sách riêng tư</a> và{" "}
            <a href="">Chính sách Cookie</a> của HustLink.
          </p>
          <Button type="submit" disabled={isLoading}>
            Đồng ý và tham gia
          </Button>
        </form>
        <Seperator>Hoặc</Seperator>
        <div className={classes.register}>
          Đã có tài khoản trên HustLink?{" "}
          <Link to="/authentication/login">Đăng nhập</Link>
        </div>
      </Box>
    </div>
  );
}
