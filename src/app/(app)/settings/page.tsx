"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SettingsPage() {
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*, organization:organizations(name)")
        .eq("id", user.id)
        .single();
      return data;
    },
  });

  const { data: locations = [] } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("locations")
        .select("*")
        .order("name");
      return data ?? [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("vendors")
        .select("*")
        .order("name");
      return data ?? [];
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("brands")
        .select("*")
        .order("name");
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      return data ?? [];
    },
  });

  return (
    <div>
      <Header title="Settings" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-4">
              <span className="text-muted-foreground w-32">Name</span>
              <span>{profile?.full_name ?? "—"}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-muted-foreground w-32">Role</span>
              <Badge variant="outline" className="capitalize">
                {profile?.role}
              </Badge>
            </div>
            <div className="flex gap-4">
              <span className="text-muted-foreground w-32">Organization</span>
              <span>{profile?.organization?.name ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Locations ({locations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {locations.map((l: { id: string; name: string; type: string; is_active: boolean }) => (
                  <li key={l.id} className="flex items-center justify-between text-sm">
                    <span>{l.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize text-xs">
                        {l.type}
                      </Badge>
                      {!l.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Inactive
                        </Badge>
                      )}
                    </div>
                  </li>
                ))}
                {locations.length === 0 && (
                  <li className="text-muted-foreground text-sm">
                    No locations configured
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Vendors ({vendors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {vendors.slice(0, 10).map((v: { id: string; name: string; is_active: boolean }) => (
                  <li key={v.id} className="flex items-center justify-between text-sm">
                    <span>{v.name}</span>
                    {!v.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </li>
                ))}
                {vendors.length === 0 && (
                  <li className="text-muted-foreground text-sm">
                    No vendors configured
                  </li>
                )}
                {vendors.length > 10 && (
                  <li className="text-muted-foreground text-xs">
                    +{vendors.length - 10} more
                  </li>
                )}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Brands ({brands.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {brands.map((b: { id: string; name: string }) => (
                  <Badge key={b.id} variant="outline">
                    {b.name}
                  </Badge>
                ))}
                {brands.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    No brands configured
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Categories ({categories.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {categories.map((c: { id: string; name: string }) => (
                  <Badge key={c.id} variant="outline">
                    {c.name}
                  </Badge>
                ))}
                {categories.length === 0 && (
                  <p className="text-muted-foreground text-sm">
                    No categories configured
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
