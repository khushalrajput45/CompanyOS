"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileUp, CheckCircle, XCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";

interface ImportRow {
  sku: string;
  name: string;
  unit: string;
  selling_price: number;
  cost_price?: number;
  mrp?: number;
  brand?: string;
  category?: string;
  reorder_point?: number;
  reorder_qty?: number;
  warranty_months?: number;
  hsn_code?: string;
  [key: string]: unknown;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

type RowStatus = "valid" | "error" | "imported";

interface PreviewRow extends ImportRow {
  _row: number;
  _status: RowStatus;
  _errors: ValidationError[];
}

const REQUIRED_COLS = ["sku", "name", "unit", "selling_price"];

function validateRow(row: ImportRow, index: number, seenSkus: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const col of REQUIRED_COLS) {
    if (!row[col] && row[col] !== 0) {
      errors.push({ row: index + 2, field: col, message: `${col} is required` });
    }
  }
  if (row.selling_price !== undefined && (isNaN(Number(row.selling_price)) || Number(row.selling_price) < 0)) {
    errors.push({ row: index + 2, field: "selling_price", message: "Must be a valid non-negative number" });
  }
  if (row.sku) {
    const skuKey = String(row.sku).toLowerCase().trim();
    if (seenSkus.has(skuKey)) {
      errors.push({ row: index + 2, field: "sku", message: `Duplicate SKU "${row.sku}" in this file` });
    } else {
      seenSkus.add(skuKey);
    }
  }
  return errors;
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importStats, setImportStats] = useState<{ success: number; errors: number } | null>(null);
  const [fileName, setFileName] = useState("");

  const { data: importHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ["import-logs"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("import_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  function handleFile(file: File) {
    setFileName(file.name);
    setImportDone(false);
    setImportStats(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result;
      const wb = XLSX.read(data, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<ImportRow>(ws, { raw: false, defval: "" });

      const normalized = rows.map((r) => {
        const out: ImportRow = {} as ImportRow;
        for (const [k, v] of Object.entries(r)) {
          out[k.toLowerCase().trim().replace(/\s+/g, "_")] = v;
        }
        return out;
      });

      const seenSkus = new Set<string>();
      const previewRows: PreviewRow[] = normalized.map((row, i) => {
        const errors = validateRow(row, i, seenSkus);
        return { ...row, _row: i + 2, _status: errors.length > 0 ? "error" : "valid", _errors: errors };
      });

      const supabase = createClient();
      const validSkus = previewRows.filter((r) => r._status === "valid" && r.sku).map((r) => String(r.sku));
      if (validSkus.length > 0) {
        const { data: existing } = await supabase
          .from("products")
          .select("sku")
          .in("sku", validSkus)
          .is("deleted_at", null);
        const existingSet = new Set((existing ?? []).map((p) => p.sku.toLowerCase().trim()));
        for (const row of previewRows) {
          if (row._status === "valid" && row.sku && existingSet.has(String(row.sku).toLowerCase().trim())) {
            row._errors = [...row._errors, { row: row._row, field: "sku", message: `SKU "${row.sku}" already exists — will be updated` }];
          }
        }
      }
      setPreview(previewRows);
    };
    reader.readAsBinaryString(file);
  }

  async function handleImport() {
    const validRows = preview.filter((r) => r._status === "valid");
    if (validRows.length === 0) return;

    setImporting(true);
    const supabase = createClient();
    let success = 0;
    let errors = 0;

    const { data: { user } } = await supabase.auth.getUser();

    for (const row of validRows) {
      const payload = {
        sku: String(row.sku),
        name: String(row.name),
        unit: String(row.unit),
        selling_price: Number(row.selling_price),
        cost_price: row.cost_price ? Number(row.cost_price) : null,
        mrp: row.mrp ? Number(row.mrp) : null,
        reorder_point: row.reorder_point ? Number(row.reorder_point) : 0,
        reorder_qty: row.reorder_qty ? Number(row.reorder_qty) : 0,
        warranty_months: row.warranty_months ? Number(row.warranty_months) : null,
        hsn_code: row.hsn_code ? String(row.hsn_code) : null,
        tax_rate: row.tax_rate != null && [0, 5, 12, 18, 28].includes(Number(row.tax_rate)) ? Number(row.tax_rate) : null,
        is_active: true,
      };

      const { error } = await supabase
        .from("products")
        .upsert(payload, { onConflict: "organization_id,sku" });

      if (error) errors++;
      else success++;
    }

    await supabase.from("import_logs").insert({
      file_name: fileName,
      import_type: "products",
      total_rows: preview.length,
      success_rows: success,
      error_rows: errors + preview.filter((r) => r._status === "error").length,
      errors: preview.filter((r) => r._errors.length > 0).map((r) => r._errors).flat(),
      created_by: user?.id ?? null,
    });

    setImportStats({ success, errors });
    setImportDone(true);
    setImporting(false);
    setPreview((prev) => prev.map((r) => r._status === "valid" ? { ...r, _status: "imported" } : r));
    refetchHistory();
  }

  const validCount = preview.filter((r) => r._status === "valid").length;
  const errorCount = preview.filter((r) => r._status === "error").length;
  const warnCount = preview.filter((r) => r._status === "valid" && r._errors.some((e) => e.message.includes("already exists"))).length;

  const previewColumns = ["sku", "name", "unit", "selling_price", "cost_price", "mrp", "tax_rate", "hsn_code", "reorder_point", "warranty_months"];

  return (
    <div className="flex flex-col h-full">
      <Header title="Excel Import" subtitle="Import products from spreadsheet" />

      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* Left: Upload panel */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Upload Excel File</CardTitle>
                <CardDescription className="text-xs">
                  Required columns: <code className="bg-muted px-1 rounded text-xs">sku</code>{" "}
                  <code className="bg-muted px-1 rounded text-xs">name</code>{" "}
                  <code className="bg-muted px-1 rounded text-xs">unit</code>{" "}
                  <code className="bg-muted px-1 rounded text-xs">selling_price</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 p-10 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }}
                >
                  <FileUp className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Click or drag & drop</p>
                  <p className="text-xs text-muted-foreground mt-1">.xlsx files only</p>
                  {fileName && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-primary font-medium bg-primary/5 px-3 py-1.5 rounded-full">
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      {fileName}
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
              </CardContent>
            </Card>

            {/* Preview */}
            {preview.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">Preview ({preview.length} rows)</CardTitle>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="h-3.5 w-3.5" /> {validCount}
                      </span>
                      {warnCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-yellow-600">
                          <AlertCircle className="h-3.5 w-3.5" /> {warnCount} updates
                        </span>
                      )}
                      {errorCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                          <XCircle className="h-3.5 w-3.5" /> {errorCount}
                        </span>
                      )}
                      {importDone && importStats && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="h-3.5 w-3.5" /> Imported {importStats.success}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted/80">
                        <TableRow>
                          <TableHead className="text-xs">Row</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          {previewColumns.slice(0, 6).map((col) => (
                            <TableHead key={col} className="text-xs capitalize">{col.replace("_", " ")}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.map((row) => (
                          <TableRow key={row._row} className={row._status === "error" ? "bg-destructive/5" : row._status === "imported" ? "bg-green-50" : ""}>
                            <TableCell className="text-muted-foreground text-xs">{row._row}</TableCell>
                            <TableCell>
                              {row._status === "error" ? (
                                <Badge variant="destructive" className="text-xs">Error</Badge>
                              ) : row._status === "imported" ? (
                                <Badge className="bg-green-600 text-xs">Imported</Badge>
                              ) : row._errors.length > 0 ? (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">Update</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">New</Badge>
                              )}
                            </TableCell>
                            {previewColumns.slice(0, 6).map((col) => (
                              <TableCell key={col} className="text-xs max-w-[120px] truncate">
                                {String(row[col] ?? "")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {!importDone && (
                    <div className="p-4 border-t">
                      <Button onClick={handleImport} disabled={importing || validCount === 0} className="w-full">
                        <Upload className="h-4 w-4 mr-2" />
                        {importing ? "Importing..." : `Import ${validCount} rows`}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Error/warning messages */}
            {preview.length > 0 && (() => {
              const allMsgs = preview.flatMap((r) => r._errors);
              const warnings = allMsgs.filter((e) => e.message.includes("already exists"));
              const hardErrors = allMsgs.filter((e) => !e.message.includes("already exists"));
              return (
                <>
                  {hardErrors.length > 0 && (
                    <Card className="border-destructive/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs flex items-center gap-2 text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {hardErrors.length} error{hardErrors.length !== 1 ? "s" : ""} — these rows will be skipped
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-xs">
                          {hardErrors.map((e, i) => (
                            <li key={i} className="text-destructive">Row {e.row} · {e.field}: {e.message}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                  {warnings.length > 0 && (
                    <Card className="border-yellow-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs flex items-center gap-2 text-yellow-700">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {warnings.length} update{warnings.length !== 1 ? "s" : ""} — these rows will update existing products
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-xs">
                          {warnings.map((e, i) => (
                            <li key={i} className="text-yellow-700">Row {e.row}: {e.message}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </div>

          {/* Right: Import history */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Import History</CardTitle>
                <CardDescription className="text-xs">Recent import sessions</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {importHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No imports yet</p>
                ) : (
                  <div className="divide-y">
                    {importHistory.map((log: {
                      id: string;
                      file_name: string;
                      created_at: string;
                      success_rows: number;
                      error_rows: number;
                      total_rows: number;
                    }) => (
                      <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                          <FileSpreadsheet className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{log.file_name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {log.created_at ? format(new Date(log.created_at), "dd MMM yyyy HH:mm") : ""}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-green-600">{log.success_rows} imported</span>
                            {log.error_rows > 0 && (
                              <span className="text-[10px] text-destructive">{log.error_rows} errors</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{log.total_rows} rows</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
