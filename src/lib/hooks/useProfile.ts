"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function useProfile() {
  const query = useQuery<Profile | null>({
    queryKey: ["profile"],
    queryFn: async () => {
      const supabase = createClient();

      // Try server-verified user first; fall back to local session if unreachable
      let userId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        const { data: { session } } = await supabase.auth.getSession();
        userId = session?.user?.id ?? null;
      }

      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      return data;
    },
  });

  // Sign out immediately if this account has been disabled by an admin
  useEffect(() => {
    if (query.data?.is_disabled) {
      const supabase = createClient();
      supabase.auth.signOut().then(() => {
        window.location.href = "/login?error=Your+account+has+been+disabled.";
      });
    }
  }, [query.data?.is_disabled]);

  return query;
}
