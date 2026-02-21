"use client";

import { useState, useCallback, useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { importLeads } from "@/lib/actions/leads";
import type { Campaign } from "@/lib/types";

type ImportStep = "upload" | "mapping" | "review" | "done";

interface ParsedRow {
  [key: string]: string;
}

const REQUIRED_FIELDS = ["email"] as const;
const OPTIONAL_FIELDS = [
  "first_name",
  "last_name",
  "company",
  "title",
] as const;

const FIELD_LABELS: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  email: "Email",
  company: "Company",
  title: "Title",
};

function guessMapping(header: string): string | null {
  const h = header.toLowerCase().trim();
  if (h === "email" || h === "email address" || h === "e-mail") return "email";
  if (h === "first name" || h === "firstname" || h === "first" || h === "given name")
    return "first_name";
  if (h === "last name" || h === "lastname" || h === "last" || h === "surname" || h === "family name")
    return "last_name";
  if (h === "company" || h === "organization" || h === "org" || h === "company name")
    return "company";
  if (h === "title" || h === "job title" || h === "role" || h === "position")
    return "title";
  if (h === "name" || h === "contact name" || h === "full name")
    return "first_name";
  return null;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface ImportClientProps {
  campaigns: Campaign[];
}

export default function ImportClient({ campaigns }: ImportClientProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [rawData, setRawData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [campaignId, setCampaignId] = useState<string>("");
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<number>(0);
  const [importedCount, setImportedCount] = useState(0);
  const [isPending, startTransition] = useTransition();

  const handleFile = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as ParsedRow[];
        const cols = results.meta.fields || [];
        setRawData(data);
        setHeaders(cols);
        const autoMap: Record<string, string> = {};
        cols.forEach((col) => {
          const guess = guessMapping(col);
          if (guess && !Object.values(autoMap).includes(guess)) {
            autoMap[col] = guess;
          }
        });
        setMapping(autoMap);
        setStep("mapping");
      },
      error: () => {
        toast.error("Failed to parse CSV file");
      },
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith(".csv") || file.name.endsWith(".xlsx"))) {
        handleFile(file);
      } else {
        toast.error("Please upload a CSV file");
      }
    },
    [handleFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const processMapping = () => {
    if (!campaignId) {
      toast.error("Please select a campaign");
      return;
    }
    const emailField = Object.entries(mapping).find(([, v]) => v === "email")?.[0];
    if (!emailField) {
      toast.error("Email column mapping is required");
      return;
    }
    const errs: string[] = [];
    const valid: ParsedRow[] = [];
    const seenEmails = new Set<string>();
    let dupeCount = 0;

    rawData.forEach((row, i) => {
      const email = row[emailField]?.trim().toLowerCase();
      if (!email || !validateEmail(email)) {
        errs.push("Row " + (i + 2) + ": Invalid email \"" + (row[emailField] || "(empty)") + "\"");
        return;
      }
      if (seenEmails.has(email)) {
        dupeCount++;
        return;
      }
      seenEmails.add(email);
      valid.push(row);
    });
    setValidRows(valid);
    setErrors(errs);
    setDuplicates(dupeCount);
    setStep("review");
  };

  const handleImport = () => {
    const rows = validRows.map((row) => ({
      email: getMappedValue(row, "email"),
      first_name: getMappedValue(row, "first_name") || undefined,
      last_name: getMappedValue(row, "last_name") || undefined,
      company: getMappedValue(row, "company") || undefined,
      title: getMappedValue(row, "title") || undefined,
    }));

    startTransition(async () => {
      const result = await importLeads(rows, campaignId);
      setImportedCount(result.imported);
      if (result.duplicates > 0) {
        setDuplicates((prev) => prev + result.duplicates);
      }
      toast.success(result.imported + " leads imported");
      setStep("done");
    });
  };

  const getMappedValue = (row: ParsedRow, field: string) => {
    const sourceCol = Object.entries(mapping).find(([, v]) => v === field)?.[0];
    return sourceCol ? row[sourceCol]?.trim() || "" : "";
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-lg">
          <Link href="/dashboard/leads">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold font-heading tracking-[-0.02em]">
            Import Leads
          </h1>
          <p className="text-[14px] text-muted-foreground mt-0.5">
            Upload a CSV file to add leads in bulk
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {["Upload", "Map Columns", "Review", "Done"].map((label, i) => {
          const stepNames: ImportStep[] = ["upload", "mapping", "review", "done"];
          const isCurrent = stepNames.indexOf(step) === i;
          const isPast = stepNames.indexOf(step) > i;
          return (
            <div key={label} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium",
                  isCurrent
                    ? "bg-foreground text-white"
                    : isPast
                      ? "bg-muted text-foreground"
                      : "bg-muted text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                    isCurrent
                      ? "bg-white/20 text-white"
                      : isPast
                        ? "bg-foreground/10 text-foreground"
                        : "bg-muted-foreground/15 text-muted-foreground"
                  )}
                >
                  {isPast ? "\u2713" : i + 1}
                </span>
                {label}
              </div>
              {i < 3 && <ArrowRight className="h-3 w-3 text-muted-foreground/30" />}
            </div>
          );
        })}
      </div>

      {step === "upload" && (
        <Card
          className="border-2 border-dashed border-border hover:border-amber/40 transition-colors cursor-pointer rounded-2xl"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <CardContent className="p-10 sm:p-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[17px] font-semibold font-heading">
                  Drop your CSV file here
                </p>
                <p className="text-[14px] text-muted-foreground mt-1">
                  or click to browse
                </p>
              </div>
              <input type="file" accept=".csv,.xlsx" className="hidden" id="csv-upload" onChange={handleFileInput} />
              <Button
                variant="outline"
                className="h-9 text-[13px] rounded-lg font-medium"
                onClick={() => document.getElementById("csv-upload")?.click()}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Browse Files
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "mapping" && (
        <div className="space-y-5">
          <Card className="bg-card rounded-2xl border border-border">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-[15px] font-semibold font-heading mb-2">
                  Assign to Campaign
                </h2>
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger className="h-9 w-72 text-[13px] rounded-lg">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <h2 className="text-[15px] font-semibold font-heading mb-1">
                  Map Columns
                </h2>
                <p className="text-[13px] text-muted-foreground mb-4">
                  We auto-detected some mappings. Adjust if needed.
                </p>
                <div className="space-y-3">
                  {headers.map((header) => (
                    <div key={header} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
                      <span className="text-[12px] w-full sm:w-44 truncate font-mono bg-muted px-3 py-1.5 rounded-lg text-muted-foreground">
                        {header}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                      <Select
                        value={mapping[header] || "skip"}
                        onValueChange={(v) => setMapping({ ...mapping, [header]: v === "skip" ? "" : v })}
                      >
                        <SelectTrigger className="h-8 w-40 text-[12px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip</SelectItem>
                          {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((f) => (
                            <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {mapping[header] === "email" && (
                        <Badge className="bg-amber/15 text-amber-foreground text-[11px]">Required</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex items-center justify-between">
            <Button variant="ghost" className="h-9 text-[13px] rounded-lg" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button
              onClick={processMapping}
              className="bg-amber text-amber-foreground hover:bg-amber/90 h-9 text-[13px] font-semibold rounded-lg"
            >
              Review Import
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span className="text-[13px] font-semibold text-emerald-700">
                {validRows.length} valid leads
              </span>
            </div>
            {duplicates > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-amber/10 border border-amber/20 px-4 py-2">
                <AlertCircle className="h-4 w-4 text-amber" />
                <span className="text-[13px] font-semibold text-amber-foreground">
                  {duplicates} duplicates skipped
                </span>
              </div>
            )}
            {errors.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-100 px-4 py-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-[13px] font-semibold text-red-700">
                  {errors.length} errors
                </span>
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <Card className="border border-red-100 bg-red-50/50 rounded-2xl">
              <CardContent className="p-5">
                <p className="text-[12px] font-semibold text-red-700 mb-1.5">
                  Errors (these rows will be skipped):
                </p>
                {errors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-[12px] text-red-600">{err}</p>
                ))}
                {errors.length > 5 && (
                  <p className="text-[12px] text-red-500 mt-1">...and {errors.length - 5} more</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground">Email</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground">First Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground">Last Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground">Company</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground">Title</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validRows.slice(0, 10).map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/40">
                    <TableCell className="text-[13px] py-3 font-mono">{getMappedValue(row, "email")}</TableCell>
                    <TableCell className="text-[13px] py-3">{getMappedValue(row, "first_name") || "--"}</TableCell>
                    <TableCell className="text-[13px] py-3">{getMappedValue(row, "last_name") || "--"}</TableCell>
                    <TableCell className="text-[13px] py-3">{getMappedValue(row, "company") || "--"}</TableCell>
                    <TableCell className="text-[13px] py-3">{getMappedValue(row, "title") || "--"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            {validRows.length > 10 && (
              <div className="px-6 py-3 border-t border-border text-[12px] text-muted-foreground">
                Showing 10 of {validRows.length} rows
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between">
            <Button variant="ghost" className="h-9 text-[13px] rounded-lg" onClick={() => setStep("mapping")}>
              Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={validRows.length === 0 || isPending}
              className="bg-amber text-amber-foreground hover:bg-amber/90 h-9 text-[13px] font-semibold rounded-lg"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : null}
              Import {validRows.length} Leads
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card className="bg-card rounded-2xl border border-border">
          <CardContent className="p-10 sm:p-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
                <Check className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <p className="text-[17px] font-semibold font-heading">
                  Import complete
                </p>
                <p className="text-[14px] text-muted-foreground mt-1">
                  {importedCount} leads have been added and assigned to sender inboxes
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Button variant="outline" asChild className="h-9 text-[13px] rounded-lg font-medium">
                  <Link href="/dashboard/leads">View Leads</Link>
                </Button>
                <Button
                  className="bg-amber text-amber-foreground hover:bg-amber/90 h-9 text-[13px] font-semibold rounded-lg"
                  onClick={() => {
                    setStep("upload");
                    setRawData([]);
                    setHeaders([]);
                    setMapping({});
                    setCampaignId("");
                    setValidRows([]);
                    setErrors([]);
                    setDuplicates(0);
                    setImportedCount(0);
                  }}
                >
                  Import More
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
