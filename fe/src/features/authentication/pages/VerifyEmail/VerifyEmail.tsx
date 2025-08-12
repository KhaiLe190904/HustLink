import { useState } from "react";
import { Box } from "@/features/authentication/components/Box/Box";
import { Input } from "@/components/Input/Input";
import classes from "./VerifyEmail.module.css";
import { Button } from "@/features/authentication/components/Button/Button";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";

export function VerifyEmail() {
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setUser } = useAuthentication();

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
      toast.error("Đã xảy ra lỗi không xác định, vui lòng thử lại sau");
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
        setMessage("Đã gửi mã mới thành công. Hãy check email của bạn");
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
        <h1>Xác thực email</h1>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsLoading(true);
            const code = e.currentTarget.code.value;
            await validateEmail(code);
            setIsLoading(false);
          }}
        >
          <p>Chúng tôi đã gửi một email xác thực đến địa chỉ email của bạn.</p>
          <p>
            Nếu bạn không nhận được email, hãy kiểm tra thư mục spam hoặc thử
            lại.
          </p>
          <Input type="text" label="Mã xác thực" key="code" name="code" />
          {message && <p style={{ color: "green" }}>{message}</p>}
          {errorMessage && <p style={{ color: "red" }}>{errorMessage}</p>}
          <Button type="submit" disabled={isLoading}>
            Xác thực Email
          </Button>
          <Button
            type="button"
            outline
            disabled={isLoading}
            onClick={() => {
              sendEmailVerificationToken();
            }}
          >
            Gửi lại mã
          </Button>
        </form>
      </Box>
      <ToastContainer />
    </div>
  );
}
