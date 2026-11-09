import type { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "accent" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  icon,
  iconRight,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  // A key that is physically pressed: it moves down a pixel into its own shadow, and the pointer
  // never selects its label. Reduced motion keeps the state change and drops the travel.
  const base =
    "inline-flex items-center justify-center gap-2 font-heading font-bold uppercase tracking-label rounded-control no-select transition-all duration-150 active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-y-0";

  // Hover lights the key up in the night presentation and presses it down in the light one, so
  // on-brand text keeps its contrast in both. The dark fill is lime, so brighter is also safer.
  const variants = {
    primary:
      "bg-primary-700 surface-brand hover:bg-primary-800 dark:hover:bg-primary-600 active:bg-primary-900 dark:active:bg-primary-700 text-on-brand shadow-panel hover:shadow-glow",
    accent:
      "bg-accent-400 surface-brand hover:bg-accent-500 active:bg-accent-600 text-navy-900 shadow-panel hover:shadow-raised",
    ghost: "bg-transparent hover:bg-hover text-fg-muted hover:text-fg active:bg-hover",
    outline:
      "bg-transparent border-2 border-line-strong hover:border-primary-500 dark:hover:border-primary-400 text-fg-muted hover:text-positive hover:bg-hover",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-caption",
    md: "px-5 py-2.5 text-body",
    lg: "px-7 py-3.5 text-lead",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="[&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
      {children}
      {iconRight && <span className="[&>svg]:w-4 [&>svg]:h-4">{iconRight}</span>}
    </button>
  );
}
