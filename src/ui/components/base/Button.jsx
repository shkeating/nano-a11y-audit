export function Button({
  children,
  onClick,
  variant = "primary", // 'primary', 'secondary', 'contrast'
  outline = false,
  disabled = false,
  className = "",
  ...props
}) {
  // Map variants to Pico classes
  let classNames = [];
  if (variant === "secondary") classNames.push("secondary");
  if (variant === "contrast") classNames.push("contrast");
  if (outline) classNames.push("outline");
  if (className) classNames.push(className);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={classNames.join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}
