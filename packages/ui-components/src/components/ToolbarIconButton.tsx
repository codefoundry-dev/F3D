export interface ToolbarIconButtonProps {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
}

export function ToolbarIconButton({ children, title, onClick }: ToolbarIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center w-12 h-12 border border-foreground/20 rounded-xl text-foreground hover:bg-accent transition-colors"
      title={title}
    >
      {children}
    </button>
  );
}
