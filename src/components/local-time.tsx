"use client";

export function LocalTime({
  date,
  className,
  options,
}: {
  date: string;
  className?: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const formatted = new Date(date).toLocaleString(
    "en-US",
    options ?? {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }
  );

  return <span className={className}>{formatted}</span>;
}
