"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full bg-card rounded-xl border border-border">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 mx-auto">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold font-heading">
              Something went wrong
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1.5">
              {error.message || "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <Button
            onClick={reset}
            variant="outline"
            className="h-9 text-[13px] rounded-lg font-medium gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
