import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 animate-fade-in", className)}>
      <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-teal-500" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground text-center max-w-sm">{description}</p>}
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
}
