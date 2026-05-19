import React from 'react';

export interface ItemMetaProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Optional className for width/spacing overrides (e.g., 'w-[147px]') */
  className?: string;
  /** Text size variant: 'sm' for default, 'xs' for compact (coverage modals) */
  size?: 'sm' | 'xs';
}

export function ItemMeta({ icon, label, value, className = '', size = 'sm' }: ItemMetaProps) {
  const labelSize = size === 'xs' ? 'text-xs' : 'text-sm';
  const valueClass = size === 'xs' ? 'text-sm font-medium' : 'text-sm';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className={labelSize}>{label}</span>
      </div>
      <span className={`${valueClass} text-foreground`}>{value}</span>
    </div>
  );
}
