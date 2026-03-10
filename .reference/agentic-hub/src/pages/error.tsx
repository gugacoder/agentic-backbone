import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { AlertTriangle } from "lucide-react";

export function ErrorPage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <AlertTriangle className="h-16 w-16 text-destructive" />
      <PageHeader
        title="Something went wrong"
        description="An unexpected error occurred while loading this page."
      />
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => router.history.back()}>
          Go Back
        </Button>
        <Button asChild>
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
