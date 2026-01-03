import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/Input/Input";
import { Box } from "@/features/authentication/components/Box/Box";
import { useAuthentication } from "@/features/authentication/context/AuthenticationContextProvider";

import { Button } from "@/features/authentication/components/Button/Button";
export function Profile() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { user, setUser } = useAuthentication();
  const [error, setError] = useState("");
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    company: "",
    position: "",
    location: "",
  });
  const onSubmit = async () => {
    if (!data.firstName || !data.lastName) {
      setError("Please fill in your first and last name.");
      return;
    }
    if (!data.company || !data.position) {
      setError("Please fill in your latest company and position.");
      return;
    }
    if (!data.location) {
      setError("Please fill in your location.");
      return;
    }
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/v1/authentication/profile/${user?.id}?firstName=${
          data.firstName
        }&lastName=${data.lastName}&company=${data.company}&position=${data.position}&location=${
          data.location
        }`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (res.ok) {
        const updatedUser = await res.json();
        setUser(updatedUser);
      } else {
        const { message } = await res.json();
        throw new Error(message);
      }
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("An unknown error occurred.");
      }
    } finally {
      navigate("/");
    }
  };
  return (
    <div className="">
      <Box>
        <h1>Only one last step</h1>
        <p>Tell us a bit about yourself so we can personalize your experience.</p>
        {step === 0 && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              onFocus={() => setError("")}
              required
              label="First Name"
              name="firstName"
              placeholder="Ten"
              onChange={(e) => setData((prev) => ({ ...prev, firstName: e.target.value }))}
            ></Input>
            <Input
              onFocus={() => setError("")}
              required
              label="Last Name"
              name="lastName"
              placeholder="Ho"
              onChange={(e) => setData((prev) => ({ ...prev, lastName: e.target.value }))}
            ></Input>
          </div>
        )}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-4">
            <Input
              onFocus={() => setError("")}
              label="Latest company"
              name="company"
              placeholder="Tên công ty"
              onChange={(e) => setData((prev) => ({ ...prev, company: e.target.value }))}
            ></Input>
            <Input
              onFocus={() => setError("")}
              onChange={(e) => setData((prev) => ({ ...prev, position: e.target.value }))}
              label="Latest position"
              name="position"
              placeholder="Vị trí"
            ></Input>
          </div>
        )}
        {step == 2 && (
          <Input
            onFocus={() => setError("")}
            label="Location"
            name="location"
            placeholder="Vị trí"
            onChange={(e) => setData((prev) => ({ ...prev, location: e.target.value }))}
          ></Input>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-4 justify-end">
          {step > 0 && (
            <Button outline onClick={() => setStep((prev) => prev - 1)}>
              Back
            </Button>
          )}
          {step < 2 && (
            <Button
              disabled={
                (step === 0 && (!data.firstName || !data.lastName)) ||
                (step === 1 && (!data.company || !data.position))
              }
              onClick={() => setStep((prev) => prev + 1)}
            >
              Next
            </Button>
          )}
          {step === 2 && (
            <Button disabled={!data.location} onClick={onSubmit}>
              Submit
            </Button>
          )}
        </div>
      </Box>
    </div>
  );
}
