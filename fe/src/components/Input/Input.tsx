import { InputHTMLAttributes, ReactNode, useId, useState } from "react";

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
      icon: "h-4 w-4",
    },
    medium: {
      input: "px-4 py-3 text-base",
      label: "text-sm",
      icon: "h-5 w-5",
    },
    large: {
      input: "px-5 py-4 text-lg",
      label: "text-base",
      icon: "h-6 w-6",
    },
  };

  const variantClasses = {
    outlined: {
      container: "rounded-xl border bg-white",
      normal: "border-slate-300 hover:border-slate-400",
      focused: "border-red-300 ring-2 ring-red-100",
      error: "border-red-400 ring-2 ring-red-100",
    },
    filled: {
      container: "rounded-xl border bg-slate-50",
      normal: "border-slate-200 hover:bg-slate-100",
      focused: "border-red-300 bg-white ring-2 ring-red-100",
      error: "border-red-400 bg-red-50 ring-2 ring-red-100",
    },
    standard: {
      container: "rounded-none border-0 border-b bg-transparent",
      normal: "border-slate-300",
      focused: "border-red-300",
      error: "border-red-400",
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
    "relative transition-all duration-150 ease-in-out",
    variantClasses[variant].container,
    error
      ? variantClasses[variant].error
      : isFocused
        ? variantClasses[variant].focused
        : variantClasses[variant].normal,
  ].join(" ");

  const inputClasses = [
    "w-full bg-transparent text-slate-800 placeholder:text-slate-400 outline-none transition-all duration-150",
    sizeClasses[size].input,
    leftIcon ? "pl-10" : "",
    rightIcon || loading ? "pr-10" : "",
    otherProps.disabled ? "cursor-not-allowed opacity-60" : "",
    className,
  ].join(" ");

  const labelClasses = [
    "pointer-events-none absolute left-4 transition-all duration-150 ease-in-out",
    sizeClasses[size].label,
    isFocused || hasValue
      ? variant === "standard"
        ? "-top-6 text-xs"
        : "-top-2 bg-white px-1 text-xs"
      : variant === "standard"
        ? "top-3"
        : "top-1/2 -translate-y-1/2",
    error ? "text-red-500" : isFocused ? "text-red-500" : "text-slate-500",
  ].join(" ");

  return (
    <div
      className={wrapperClassName || "mb-4"}
      style={{ width: width ? `${width}px` : "100%" }}
    >
      <div className={containerClasses}>
        {leftIcon ? (
          <div
            className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 ${sizeClasses[size].icon}`}
          >
            {leftIcon}
          </div>
        ) : null}

        <input
          {...otherProps}
          id={inputId}
          aria-invalid={!!error}
          className={inputClasses}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
        />

        {label ? (
          <label htmlFor={inputId} className={labelClasses}>
            {label}
          </label>
        ) : null}

        {rightIcon || loading ? (
          <div
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${sizeClasses[size].icon}`}
          >
            {loading ? (
              <div className="h-full w-full animate-spin rounded-full border-2 border-slate-300 border-t-red-500" />
            ) : (
              <div className="text-slate-400">{rightIcon}</div>
            )}
          </div>
        ) : null}
      </div>

      {error || helperText ? (
        <div
          className={`mt-1 text-xs ${error ? "text-red-500" : "text-slate-500"}`}
        >
          {error || helperText}
        </div>
      ) : null}
    </div>
  );
}
