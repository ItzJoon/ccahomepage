const COLOR_CLASS: Record<string, string> = {
  navy: "badge-navy",
  teal: "badge-teal",
  red: "badge-red",
  gold: "badge-gold",
};

export default function Badge({
  color = "navy",
  children,
}: {
  color?: string;
  children: React.ReactNode;
}) {
  return <span className={`badge ${COLOR_CLASS[color] || "badge-navy"}`}>{children}</span>;
}

export function Pin() {
  return <span className="pin">고정</span>;
}
