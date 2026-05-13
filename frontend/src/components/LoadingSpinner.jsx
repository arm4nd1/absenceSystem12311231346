import clsx from "clsx";

export default function LoadingSpinner({ size = "md", className }) {
  const sizes = { sm: "w-4 h-4", md: "w-8 h-8", lg: "w-12 h-12" };
  return (
    <div className={clsx("flex items-center justify-center", className)}>
      <div className={clsx(
        sizes[size],
        "rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin"
      )} />
    </div>
  );
}
