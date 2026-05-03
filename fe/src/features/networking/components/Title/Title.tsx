import { ReactNode } from "react";

export function Title({ children }: { children: ReactNode }) {
  return <h2 className="mb-4 text-xl font-bold text-slate-900">{children}</h2>;
}
