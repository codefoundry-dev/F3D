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
      className="flex items-center justify-center w-9 h-9 border border-foreground/20 rounded-xl text-foreground hover:bg-accent transition-colors [&_svg]:size-5"
      title={title}
    >
      {children}
    </button>
  );
}
