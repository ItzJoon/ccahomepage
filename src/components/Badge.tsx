const COLOR_CLASS: Record<string, string> = {
  navy: "badge-navy",
  teal: "badge-teal",
  red: "badge-red",
  gold: "badge-gold",
};

export default function Badge({
  color = "navy",
  className = "",
  children,
}: {
  color?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={`badge ${COLOR_CLASS[color] || "badge-navy"} ${className}`}>{children}</span>;
}

export function Pin({ className = "" }: { className?: string } = {}) {
  return <span className={`pin ${className}`}>고정</span>;
}
