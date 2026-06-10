"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileUp, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";

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

function validateRow(
  row: ImportRow,
  index: number,
  seenSkus: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const col of REQUIRED_COLS) {
    if (!row[col] && row[col] !== 0) {
      errors.push({ row: index + 2, field: col, message: `${col} is required` });
    }
  }
  if (
    row.selling_price !== undefined &&
    (isNaN(Number(row.selling_price)) || Number(row.selling_price) < 0)
  ) {
    errors.push({
      row: index + 2,
      field: "selling_price",
      message: "Must be a valid non-negative number",
    });
  }
  // Duplicate SKU within the file
  if (row.sku) {
    const skuKey = String(row.sku).toLowerCase().trim();
    if (seenSkus.has(skuKey)) {
      errors.push({
        row: index + 2,
        field: "sku",
        message: `Duplicate SKU "${row.sku}" in this file`,
      });
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
  const [importStats, setImportStats] = useState<{
    success: number;
    errors: number;
  } | null>(null);
  const [fileName, setFileName] = useState("");

  function handleFile(file: File) {
    setFileName(file.name);
    setImportDone(false);
    setImportStats(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result;
      const wb = XLSX.read(data, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<ImportRow>(ws, {
        raw: false,
        defval: "",
      });

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
        return {
          ...row,
          _row: i + 2,
          _status: errors.length > 0 ? "error" : "valid",
          _errors: errors,
        };
      });

      // Check which SKUs already exist in the DB and mark as warnings (still importable — will upsert)
      const supabase = createClient();
      const validSkus = previewRows
        .filter((r) => r._status === "valid" && r.sku)
        .map((r) => String(r.sku));
      if (validSkus.length > 0) {
        const { data: existing } = await supabase
          .from("products")
          .select("sku")
          .in("sku", validSkus)
          .is("deleted_at", null);
        const existingSet = new Set(
          (existing ?? []).map((p) => p.sku.toLowerCase().trim())
        );
        for (const row of previewRows) {
          if (
            row._status === "valid" &&
            row.sku &&
            existingSet.has(String(row.sku).toLowerCase().trim())
          ) {
            row._errors = [
              ...row._errors,
              {
                row: row._row,
                field: "sku",
                message: `SKU "${row.sku}" already exists — will be updated`,
              },
            ];
            // Keep status "valid" — upsert will update it, not fail
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
        warranty_months: row.warranty_months
          ? Number(row.warranty_months)
          : null,
        hsn_code: row.hsn_code ? String(row.hsn_code) : null,
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
      errors: preview
        .filter((r) => r._errors.length > 0)
        .map((r) => r._errors)
        .flat(),
      created_by: user?.id ?? null,
    });

    setImportStats({ success, errors });
    setImportDone(true);
    setImporting(false);

    setPreview((prev) =>
      prev.map((r) =>
        r._status === "valid" ? { ...r, _status: "imported" } : r
      )
    );
  }

  const validCount = preview.filter((r) => r._status === "valid").length;
  const errorCount = preview.filter((r) => r._status === "error").length;

  const previewColumns = [
    "sku",
    "name",
    "unit",
    "selling_price",
    "cost_price",
    "mrp",
    "brand",
    "category",
    "reorder_point",
    "warranty_months",
  ];

  return (
    <div>
      <Header title="Excel Import" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Import Products from Excel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an .xlsx file with columns: <code>sku</code>, <code>name</code>,{" "}
              <code>unit</code>, <code>selling_price</code> (required). Optional:{" "}
              <code>cost_price</code>, <code>mrp</code>, <code>brand</code>,{" "}
              <code>category</code>, <code>reorder_point</code>, <code>reorder_qty</code>,{" "}
              <code>warranty_months</code>, <code>hsn_code</code>.
            </p>

            <div
              className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <FileUp className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Click or drag & drop Excel file</p>
              <p className="text-xs text-muted-foreground mt-1">.xlsx files only</p>
              {fileName && (
                <p className="text-xs text-primary mt-2 font-medium">{fileName}</p>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </CardContent>
        </Card>

        {preview.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{validCount} valid</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span>{errorCount} errors</span>
                </div>
                {importDone && importStats && (
                  <div className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Imported {importStats.success} rows</span>
                  </div>
                )}
              </div>

              {!importDone && (
                <Button
                  onClick={handleImport}
                  disabled={importing || validCount === 0}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {importing
                    ? `Importing...`
                    : `Import ${validCount} rows`}
                </Button>
              )}
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Status</TableHead>
                    {previewColumns.map((col) => (
                      <TableHead key={col} className="capitalize">
                        {col.replace("_", " ")}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row) => (
                    <TableRow
                      key={row._row}
                      className={
                        row._status === "error"
                          ? "bg-destructive/5"
                          : row._status === "imported"
                          ? "bg-green-50"
                          : ""
                      }
                    >
                      <TableCell className="text-muted-foreground text-xs">
                        {row._row}
                      </TableCell>
                      <TableCell>
                        {row._status === "error" ? (
                          <Badge variant="destructive">Error</Badge>
                        ) : row._status === "imported" ? (
                          <Badge className="bg-green-600">Imported</Badge>
                        ) : row._errors.length > 0 ? (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">Update</Badge>
                        ) : (
                          <Badge variant="secondary">New</Badge>
                        )}
                      </TableCell>
                      {previewColumns.map((col) => (
                        <TableCell key={col} className="text-sm max-w-[150px] truncate">
                          {String(row[col] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {(() => {
              const allMsgs = preview.flatMap((r) => r._errors);
              const warnings = allMsgs.filter((e) => e.message.includes("already exists"));
              const hardErrors = allMsgs.filter((e) => !e.message.includes("already exists"));
              return (
                <>
                  {hardErrors.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive" />
                          Errors ({hardErrors.length} rows will be skipped)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm">
                          {hardErrors.map((e, i) => (
                            <li key={i} className="text-destructive">
                              Row {e.row} — {e.field}: {e.message}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                  {warnings.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                          Warnings ({warnings.length} rows will update existing products)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm">
                          {warnings.map((e, i) => (
                            <li key={i} className="text-yellow-700">
                              Row {e.row}: {e.message}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
