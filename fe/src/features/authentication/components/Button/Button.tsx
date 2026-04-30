import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  outline?: boolean;
  size?: "small" | "medium" | "large";
};

export function Button({
  outline,
  size = "large",
  className,
  children,
  ...others
}: ButtonProps) {
  const baseClasses =
    "inline-flex w-full items-center justify-center gap-2 rounded-2xl font-semibold tracking-tight transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:shadow-none";

  const sizeClasses = {
    large: "min-h-12 px-5 py-3 text-sm sm:text-base",
    medium: "min-h-10 px-4 py-2.5 text-sm",
    small: "min-h-8 px-3 py-1.5 text-xs",
  };

  const variantClasses = outline
    ? "border border-gray-300 bg-white text-gray-800 shadow-sm hover:border-gray-400 hover:bg-gray-50"
    : "border border-transparent bg-[var(--primary-color)] text-white shadow-sm hover:-translate-y-[1px] hover:bg-[var(--primary-color-dark)] hover:shadow-md";

  const disabledClasses = outline
    ? "disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
    : "disabled:border-transparent disabled:bg-red-300 disabled:text-white/80";

  return (
    <button
      {...others}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses} ${disabledClasses} ${className || ""}`}
    >
      {children}
    </button>
  );
}
