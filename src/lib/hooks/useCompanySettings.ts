"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { CompanySettings } from "@/lib/types";

export function useCompanySettings() {
  return useQuery<CompanySettings | null>({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 300000,
  });
}
