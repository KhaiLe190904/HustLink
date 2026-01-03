import { InputHTMLAttributes, ReactNode, useState, useId } from "react";

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  size?: "small" | "medium" | "large";
  width?: number;
  error?: string;
  helperText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  variant?: "outlined" | "filled" | "standard";
  wrapperClassName?: string;
};

export function Input({
  label,
  size = "medium",
  width,
  error,
  helperText,
  leftIcon,
  rightIcon,
  loading = false,
  variant = "outlined",
  className = "",
  wrapperClassName = "",
  ...otherProps
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [hasValue, setHasValue] = useState(
    !!otherProps.value || !!otherProps.defaultValue
  );
  const inputId = useId();

  const sizeClasses = {
    small: {
      input: "px-3 py-2 text-sm",
      label: "text-xs",
      icon: "w-4 h-4",
    },
    medium: {
      input: "px-4 py-3 text-base",
      label: "text-sm",
      icon: "w-5 h-5",
    },
    large: {
      input: "px-5 py-4 text-lg",
      label: "text-base",
      icon: "w-6 h-6",
    },
  };

  const variantClasses = {
    outlined: {
      container: "border-2 rounded-lg bg-white",
      normal: "border-gray-300 hover:border-gray-400",
      focused:
        "border-[var(--primary-color)] shadow-lg shadow-[var(--primary-color)]/10",
      error: "border-red-500 hover:border-red-600",
    },
    filled: {
      container:
        "rounded-t-lg bg-gray-50 border-b-2 border-t-0 border-l-0 border-r-0",
      normal: "border-gray-300 hover:bg-gray-100",
      focused:
        "border-[var(--primary-color)] bg-white shadow-lg shadow-[var(--primary-color)]/10",
      error: "border-red-500 bg-red-50",
    },
    standard: {
      container:
        "border-b-2 border-t-0 border-l-0 border-r-0 bg-transparent rounded-none",
      normal: "border-gray-300",
      focused: "border-[var(--primary-color)]",
      error: "border-red-500",
    },
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    otherProps.onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    otherProps.onBlur?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(e.target.value.length > 0);
    otherProps.onChange?.(e);
  };

  const containerClasses = [
    "relative transition-all duration-200 ease-in-out",
    variantClasses[variant].container,
    error
      ? variantClasses[variant].error
      : isFocused
        ? variantClasses[variant].focused
        : variantClasses[variant].normal,
  ].join(" ");

  const inputClasses = [
    "w-full bg-transparent outline-none transition-all duration-200",
    sizeClasses[size].input,
    leftIcon ? "pl-10" : "",
    rightIcon || loading ? "pr-10" : "",
    className,
  ].join(" ");

  const labelClasses = [
    "absolute left-4 transition-all duration-200 ease-in-out pointer-events-none",
    sizeClasses[size].label,
    isFocused || hasValue
      ? variant === "standard"
        ? "-top-6 text-xs"
        : "-top-2 bg-white px-1 text-xs"
      : variant === "standard"
        ? "top-3"
        : "top-1/2 -translate-y-1/2",
    error
      ? "text-red-500"
      : isFocused
        ? "text-[var(--primary-color)]"
        : "text-gray-500",
  ].join(" ");

  return (
    <div
      className={wrapperClassName || "mb-4"}
      style={{ width: width ? `${width}px` : "100%" }}
    >
      <div className={containerClasses}>
        {/* Left Icon */}
        {leftIcon && (
          <div
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 ${sizeClasses[size].icon}`}
          >
            {leftIcon}
          </div>
        )}

        {/* Input */}
        <input
          {...otherProps}
          id={inputId}
          className={inputClasses}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
        />

        {/* Floating Label */}
        {label && (
          <label htmlFor={inputId} className={labelClasses}>
            {label}
          </label>
        )}

        {/* Right Icon or Loading */}
        {(rightIcon || loading) && (
          <div
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${sizeClasses[size].icon}`}
          >
            {loading ? (
              <div className="animate-spin rounded-full border-2 border-gray-300 border-t-[var(--primary-color)] w-full h-full"></div>
            ) : (
              <div className="text-gray-400">{rightIcon}</div>
            )}
          </div>
        )}
      </div>

      {/* Helper Text or Error */}
      {(error || helperText) && (
        <div
          className={`mt-1 text-xs ${error ? "text-red-500" : "text-gray-500"}`}
        >
          {error || helperText}
        </div>
      )}
    </div>
  );
}
