"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Users, Tag, FolderOpen, Building2 } from "lucide-react";

export default function SettingsPage() {
  const { data: profile } = useQuery({
    queryKey: ["profile-with-org"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
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
      const { data } = await supabase.from("locations").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("vendors").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("brands").select("*").order("name");
      return data ?? [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.from("categories").select("*").order("name");
      return data ?? [];
    },
  });

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  return (
    <div className="flex flex-col h-full">
      <Header title="Settings" subtitle="Organization and account settings" />

      <div className="flex-1 p-6">
        <Tabs defaultValue="general">
          <TabsList className="bg-muted/60 mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="locations">Locations</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
            <TabsTrigger value="brands">Brands</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
          </TabsList>

          {/* General */}
          <TabsContent value="general" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    My Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-white font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{profile?.full_name ?? "—"}</p>
                      <Badge variant="outline" className="capitalize text-xs mt-0.5">
                        {profile?.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <span className="text-muted-foreground w-28 shrink-0">Email</span>
                      <span className="text-foreground">{profile?.email ?? "—"}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-muted-foreground w-28 shrink-0">Role</span>
                      <span className="capitalize">{profile?.role ?? "—"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Organization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex gap-3">
                      <span className="text-muted-foreground w-28 shrink-0">Name</span>
                      <span className="font-medium">{(profile?.organization as { name?: string })?.name ?? "—"}</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-muted-foreground w-28 shrink-0">Products</span>
                      <span>Managed via Products page</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="text-muted-foreground w-28 shrink-0">Locations</span>
                      <span>{locations.length} active</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Locations */}
          <TabsContent value="locations">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Locations ({locations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {locations.map((l: { id: string; name: string; type: string; is_active: boolean; address?: string }) => (
                    <div key={l.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{l.name}</p>
                        {l.address && <p className="text-xs text-muted-foreground">{l.address}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-xs">{l.type}</Badge>
                        {!l.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </div>
                    </div>
                  ))}
                  {locations.length === 0 && <p className="text-sm text-muted-foreground">No locations configured</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendors */}
          <TabsContent value="vendors">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Vendors ({vendors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {vendors.map((v: { id: string; name: string; is_active: boolean; contact_name?: string; email?: string }) => (
                    <div key={v.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{v.name}</p>
                        {v.contact_name && <p className="text-xs text-muted-foreground">{v.contact_name}</p>}
                        {v.email && <p className="text-xs text-muted-foreground">{v.email}</p>}
                      </div>
                      {!v.is_active && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                    </div>
                  ))}
                  {vendors.length === 0 && <p className="text-sm text-muted-foreground">No vendors configured</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Brands */}
          <TabsContent value="brands">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  Brands ({brands.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {brands.map((b: { id: string; name: string }) => (
                    <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/30 text-sm">
                      {b.name}
                    </div>
                  ))}
                  {brands.length === 0 && <p className="text-sm text-muted-foreground">No brands configured</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories */}
          <TabsContent value="categories">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  Categories ({categories.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c: { id: string; name: string; description?: string }) => (
                    <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/30 text-sm">
                      {c.name}
                    </div>
                  ))}
                  {categories.length === 0 && <p className="text-sm text-muted-foreground">No categories configured</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
