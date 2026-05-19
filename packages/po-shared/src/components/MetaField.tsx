import type React from 'react';

interface MetaFieldProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

export function MetaField({ icon, label, value }: MetaFieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
