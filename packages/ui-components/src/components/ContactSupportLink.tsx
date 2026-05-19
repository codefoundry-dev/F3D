export interface ContactSupportLinkProps {
  label: string;
  href?: string;
  className?: string;
}

export function ContactSupportLink({
  label,
  href = 'mailto:support@forethread.com',
  className,
}: ContactSupportLinkProps) {
  return (
    <div className="text-center">
      <a
        href={href}
        className={
          className ??
          'text-sm text-muted-foreground underline hover:text-foreground transition-colors'
        }
      >
        {label}
      </a>
    </div>
  );
}
