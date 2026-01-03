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
  // Base classes - giữ nguyên styling từ CSS gốc
  const baseClasses =
    "flex justify-center items-center gap-2 w-full rounded-full my-4 font-bold transition-all duration-300";

  const sizeClasses = {
    large: "px-4 py-4",
    medium: "px-2 py-2 text-sm",
    small: "px-1 py-1 text-xs",
  };

  const variantClasses = outline
    ? "bg-white border border-black/60 text-black font-normal hover:bg-black/10 disabled:hover:bg-white"
    : "bg-[var(--primary-color)] text-white hover:bg-[var(--primary-color-dark)] disabled:hover:bg-red-300";

  const disabledClasses =
    "disabled:text-black disabled:bg-red-300 disabled:cursor-not-allowed";

  return (
    <button
      {...others}
      className={`${baseClasses} ${
        sizeClasses[size]
      } ${variantClasses} ${disabledClasses} ${className || ""}`}
    >
      {children}
    </button>
  );
}
