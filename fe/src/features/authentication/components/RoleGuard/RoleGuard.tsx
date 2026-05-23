import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import {
  UserRole,
  useAuthentication,
} from "@/features/authentication/context/AuthenticationContextProvider";

interface RoleGuardProps {
  allow: UserRole[];
  children: ReactNode;
}

export function RoleGuard({ allow, children }: RoleGuardProps) {
  const { user } = useAuthentication();

  if (!user || !allow.includes(user.role ?? "USER")) {
    return <Navigate to="/" replace />;
  }

  return children;
}
