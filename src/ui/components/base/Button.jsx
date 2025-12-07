import styles from "./Button.module.css";

export function Button({
  children,
  onClick,
  variant = "primary", // 'primary', 'secondary', 'contrast'
  outline = false,
  disabled = false,
  className = "",
  ...props
}) {
  // Map variants to global PicoCSS classes
  let globalClasses = [];
  if (variant === "secondary") globalClasses.push("secondary");
  if (variant === "contrast") globalClasses.push("contrast");
  if (outline) globalClasses.push("outline");
  if (className) globalClasses.push(className);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${styles.button} ${globalClasses.join(" ")}`}
      {...props}
    >
      {children}
    </button>
  );
}
