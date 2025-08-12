import { ButtonHTMLAttributes } from 'react';
import classes from './Button.module.css';
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    outline?: boolean;
    size?: "small" | "medium" | "large";
};
export function Button({outline, size = "large", className, children, ...others}: ButtonProps) {
    return(
        <button {...others} className={`${classes.button} ${outline ? classes.outline : ""} ${classes[size]} ${className}`}>
            {children}
        </button>
        );
}
