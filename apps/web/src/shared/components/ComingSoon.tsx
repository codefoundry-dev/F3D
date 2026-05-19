interface ComingSoonProps {
  page: string;
}

/**
 * Placeholder rendered for routes whose feature pages have not yet been
 * migrated from the per-role apps. Tracked in apps/web/MIGRATION.md.
 */
export function ComingSoon({ page }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <h1 className="text-2xl font-semibold">{page}</h1>
      <p className="text-muted-foreground text-sm">Migration pending — see apps/web/MIGRATION.md.</p>
    </div>
  );
}
