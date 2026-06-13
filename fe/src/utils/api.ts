import { toast } from "react-toastify";

const BASE_URL = import.meta.env.VITE_API_URL;

interface RequestParams<T> {
  endpoint: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: BodyInit;
  onSuccess: (data: T) => void;
  onFailure: (error: string) => void;
}

export const request = async <T>({
  endpoint,
  method = "GET",
  body,
  onSuccess,
  onFailure,
}: RequestParams<T>): Promise<void> => {
  try {
    const isPublicEndpoint =
      endpoint.startsWith("/api/v1/authentication/login") ||
      endpoint.startsWith("/api/v1/authentication/register") ||
      endpoint.startsWith("/api/v1/authentication/oauth") ||
      endpoint.startsWith("/api/v1/authentication/send-password-reset-token") ||
      endpoint.startsWith("/api/v1/authentication/reset-password");

    const token = localStorage.getItem("token");
    if (
      !isPublicEndpoint &&
      (!token || token === "null" || token === "undefined")
    ) {
      onFailure("Your login session has expired. Please sign in again.");
      return;
    }

    const headers: Record<string, string> = {};
    if (token && token !== "null" && token !== "undefined") {
      headers.Authorization = `Bearer ${token}`;
    }

    if (!(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      let message = "An error occurred.";
      try {
        const bodyData = await response.json();
        message = bodyData?.message || message;
      } catch {
        // ignore
      }

      if (
        response.status === 403 &&
        (message.toLowerCase().includes("ban") ||
          message.toLowerCase().includes("suspend"))
      ) {
        const activeToken = localStorage.getItem("token");
        if (
          activeToken &&
          activeToken !== "null" &&
          activeToken !== "undefined"
        ) {
          toast.error(message, {
            toastId: "auth-ban-toast",
          });
          localStorage.removeItem("token");
          setTimeout(() => {
            window.location.href = "/authentication/login";
          }, 3000);
        }
      }

      throw new Error(message);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      onSuccess({} as T);
      return;
    }

    const text = await response.text();
    const data: T = text ? JSON.parse(text) : ({} as T);
    onSuccess(data);
  } catch (error) {
    if (error instanceof Error) {
      onFailure(error.message);
    } else {
      onFailure("An error occurred. Please try again later.");
    }
  }
};
