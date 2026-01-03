import { ReactNode } from "react";

export function Title({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-bold mb-2 border-b border-gray-300 pb-2">{children}</h2>
  );
}
