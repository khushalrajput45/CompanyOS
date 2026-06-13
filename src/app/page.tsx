import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-8 max-w-sm w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">CompanyOS</h1>
            <p className="text-muted-foreground">ERP platform for modern businesses</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button asChild size="lg" className="w-full text-base h-12">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full text-base h-12">
            <Link href="/register">Create Organization</Link>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          By creating an account you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
