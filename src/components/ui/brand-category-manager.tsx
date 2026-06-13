"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Check,
  X,
  Loader2,
  Tag,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Row = { id: string; name: string; deleted_at: string | null };

interface Props {
  type: "brand" | "category";
  onCreated?: (id: string, name: string) => void;
}

export function BrandCategoryManager({ type, onCreated }: Props) {
  const label = type === "brand" ? "Brand" : "Category";
  const table = type === "brand" ? "brands" : "categories";
  // root key shared with product-form queries — invalidating this prefix refreshes both
  const rootKey = type === "brand" ? ["brands"] : ["categories"];
  const allKey  = [...rootKey, "all"];

  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const [newName, setNewName]       = useState("");
  const [addError, setAddError]     = useState<string | null>(null);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: items = [], isLoading } = useQuery<Row[]>({
    queryKey: allKey,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(table)
        .select("id, name, deleted_at")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const active   = items.filter((r) => !r.deleted_at);
  const archived = items.filter((r) => !!r.deleted_at);

  // ── Mutations ─────────────────────────────────────────────────────────────

  function refresh() {
    // Invalidates ["brands"] / ["categories"] AND ["brands","all"] etc. — all prefixes
    queryClient.invalidateQueries({ queryKey: rootKey });
  }

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from(table)
        .insert({ name: name.trim() })
        .select("id, name")
        .single();
      if (error) throw error;
      return data as { id: string; name: string };
    },
    onSuccess: (created) => {
      refresh();
      setNewName("");
      setAddError(null);
      onCreated?.(created.id, created.name);
    },
    onError: (e: Error) => setAddError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from(table)
        .update({ name: name.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setEditingId(null);
      setActionError(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from(table)
        .update({ deleted_at: archive ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      setActionError(null);
    },
    onError: (e: Error) => setActionError(e.message),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  function startEdit(item: Row) {
    setEditingId(item.id);
    setEditingName(item.name);
    setActionError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setActionError(null);
  }

  function submitEdit(id: string) {
    if (!editingName.trim() || updateMutation.isPending) return;
    updateMutation.mutate({ id, name: editingName });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || createMutation.isPending) return;
    setAddError(null);
    createMutation.mutate(newName);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          title={`Manage ${label}s`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            Manage {label}s
          </DialogTitle>
        </DialogHeader>

        {/* ── Add new ─────────────────────────────────────────────────── */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input
            placeholder={`New ${label.toLowerCase()} name…`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1"
            autoComplete="off"
          />
          <Button
            type="submit"
            size="sm"
            className="shrink-0"
            disabled={!newName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Add"
            )}
          </Button>
        </form>

        {addError && (
          <p className="text-xs text-destructive -mt-1">{addError}</p>
        )}

        {/* ── List ────────────────────────────────────────────────────── */}
        <div className="space-y-0.5 max-h-72 overflow-y-auto -mx-2 px-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Loading…
            </p>
          )}

          {!isLoading && active.length === 0 && archived.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No {label.toLowerCase()}s yet.
            </p>
          )}

          {/* Active rows */}
          {active.map((item) =>
            editingId === item.id ? (
              // ── Inline edit ─────────────────────────────────────────
              <div key={item.id} className="flex items-center gap-1 rounded-md px-1 py-1">
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="h-7 flex-1 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); submitEdit(item.id); }
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-green-600 hover:text-green-700"
                  onClick={() => submitEdit(item.id)}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={cancelEdit}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              // ── Normal row ──────────────────────────────────────────
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
              >
                <span className="flex-1 text-sm">{item.name}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => startEdit(item)}
                    title="Edit"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 hover:text-destructive"
                    onClick={() =>
                      archiveMutation.mutate({ id: item.id, archive: true })
                    }
                    disabled={archiveMutation.isPending}
                    title="Archive"
                  >
                    <Archive className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )
          )}

          {/* Archived rows */}
          {archived.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-3 pb-1">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold shrink-0">
                  Archived ({archived.length})
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {archived.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
                >
                  <span className="flex-1 text-sm text-muted-foreground line-through">
                    {item.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-green-600 hover:text-green-700"
                    onClick={() =>
                      archiveMutation.mutate({ id: item.id, archive: false })
                    }
                    disabled={archiveMutation.isPending}
                    title="Restore"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </>
          )}

          {actionError && (
            <p className="text-xs text-destructive px-2 pt-1">{actionError}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
