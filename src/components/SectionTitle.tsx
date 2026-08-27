export default function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-end mb-4 gap-3 flex-wrap">
      <div>
        {eyebrow && (
          <div className="text-xs font-bold tracking-widest text-blue uppercase mb-1">{eyebrow}</div>
        )}
        <h2 className="text-[22px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}
