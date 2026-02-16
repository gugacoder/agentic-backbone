import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { FileQuestion } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <FileQuestion className="h-16 w-16 text-muted-foreground" />
      <PageHeader
        title="Page not found"
        description="The page you're looking for doesn't exist or has been moved."
      />
      <Button asChild>
        <Link to="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
