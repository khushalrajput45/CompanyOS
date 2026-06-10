"use client";

import { useProfile } from "@/lib/hooks/useProfile";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { data: profile } = useProfile();

  return (
    <div className="flex h-16 items-center justify-between border-b px-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        {profile && (
          <>
            <Badge variant="outline" className="capitalize">
              {profile.role}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {profile.full_name || profile.email}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
