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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
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
