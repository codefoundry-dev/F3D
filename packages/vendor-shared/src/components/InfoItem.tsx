interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}

export function InfoItem({ icon, label, value }: InfoItemProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
      <div className="flex items-center gap-2 text-sm text-foreground min-w-0">
        <span className="text-foreground shrink-0">{icon}</span>
        <span className="truncate" title={value ?? undefined}>
          {value ?? '—'}
        </span>
      </div>
    </div>
  );
}
