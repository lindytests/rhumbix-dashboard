"use client";

import { useState, useCallback, useTransition, Fragment } from "react";
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
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Papa from "papaparse";
import { toast } from "sonner";
import { importLeads } from "@/lib/actions/leads";

type ImportStep = "upload" | "mapping" | "review" | "done";

interface ParsedRow {
  [key: string]: string;
}

/* ── Mappable fields ────────────────────────── */

const LEAD_FIELDS = ["email", "first_name", "last_name", "company", "title"] as const;

const EMAIL_CONTENT_FIELDS = [
  "email_1_subject", "email_1_body",
  "email_2_subject", "email_2_body",
  "email_3_subject", "email_3_body",
  "email_4_subject", "email_4_body",
  "email_5_subject", "email_5_body",
] as const;

const WAIT_FIELDS = [
  "wait_after_email_1",
  "wait_after_email_2",
  "wait_after_email_3",
  "wait_after_email_4",
] as const;

type MappableField = typeof LEAD_FIELDS[number] | typeof EMAIL_CONTENT_FIELDS[number] | typeof WAIT_FIELDS[number];

const ALL_FIELDS: MappableField[] = [
  ...LEAD_FIELDS,
  ...EMAIL_CONTENT_FIELDS,
  ...WAIT_FIELDS,
];

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  first_name: "First Name",
  last_name: "Last Name",
  company: "Company",
  title: "Title",
  email_1_subject: "Email 1 Subject",
  email_1_body: "Email 1 Body",
  email_2_subject: "Email 2 Subject",
  email_2_body: "Email 2 Body",
  email_3_subject: "Email 3 Subject",
  email_3_body: "Email 3 Body",
  email_4_subject: "Email 4 Subject",
  email_4_body: "Email 4 Body",
  email_5_subject: "Email 5 Subject",
  email_5_body: "Email 5 Body",
  wait_after_email_1: "Wait After Email 1",
  wait_after_email_2: "Wait After Email 2",
  wait_after_email_3: "Wait After Email 3",
  wait_after_email_4: "Wait After Email 4",
};

const FIELD_SECTIONS: { label: string; fields: MappableField[] }[] = [
  {
    label: "Lead Information",
    fields: ["email", "first_name", "last_name", "company", "title"],
  },
  {
    label: "Email 1",
    fields: ["email_1_subject", "email_1_body"],
  },
  {
    label: "Email 2",
    fields: ["email_2_subject", "email_2_body"],
  },
  {
    label: "Email 3",
    fields: ["email_3_subject", "email_3_body"],
  },
  {
    label: "Email 4",
    fields: ["email_4_subject", "email_4_body"],
  },
  {
    label: "Email 5",
    fields: ["email_5_subject", "email_5_body"],
  },
  {
    label: "Wait Times (optional, defaults to 1 day)",
    fields: ["wait_after_email_1", "wait_after_email_2", "wait_after_email_3", "wait_after_email_4"],
  },
];

/* ── Auto-detect column mapping ─────────────── */

function guessMapping(header: string): MappableField | null {
  const h = header.toLowerCase().trim();

  // Lead info
  if (h === "email" || h === "email address" || h === "e-mail") return "email";
  if (h === "first name" || h === "firstname" || h === "first" || h === "given name") return "first_name";
  if (h === "last name" || h === "lastname" || h === "last" || h === "surname" || h === "family name") return "last_name";
  if (h === "company" || h === "organization" || h === "org" || h === "company name") return "company";
  if (h === "title" || h === "job title" || h === "role" || h === "position") return "title";
  if (h === "name" || h === "contact name" || h === "full name") return "first_name";

  // Email subjects
  for (let n = 1; n <= 5; n++) {
    const subjectPatterns = [
      `email ${n} subject`, `email_${n}_subject`, `subject ${n}`,
      `email${n}_subject`, `email${n}subject`, `subj ${n}`, `subj_${n}`,
    ];
    if (subjectPatterns.includes(h)) return `email_${n}_subject` as MappableField;
  }

  // Email bodies
  for (let n = 1; n <= 5; n++) {
    const bodyPatterns = [
      `email ${n} body`, `email_${n}_body`, `body ${n}`,
      `email${n}_body`, `email${n}body`, `email ${n}`, `email${n}`,
    ];
    if (bodyPatterns.includes(h)) return `email_${n}_body` as MappableField;
  }

  // Wait times
  for (let n = 1; n <= 4; n++) {
    const waitPatterns = [
      `wait ${n}`, `wait_${n}`, `wait after email ${n}`,
      `wait_after_email_${n}`, `wait${n}`, `delay ${n}`, `delay_${n}`,
    ];
    if (waitPatterns.includes(h)) return `wait_after_email_${n}` as MappableField;
  }

  return null;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ── Component ──────────────────────────────── */

export default function ImportClient() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [rawData, setRawData] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [duplicates, setDuplicates] = useState<number>(0);
  const [importedCount, setImportedCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const handleFile = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawCols = results.meta.fields || [];
        const cleanCols = rawCols.map((c) => c.replace(/^\uFEFF/, "").trim());
        const data = (results.data as ParsedRow[]).map((row) => {
          const clean: ParsedRow = {};
          rawCols.forEach((raw, i) => {
            clean[cleanCols[i]] = row[raw];
          });
          return clean;
        });
        setRawData(data);
        setHeaders(cleanCols);
        const autoMap: Record<string, string> = {};
        cleanCols.forEach((col) => {
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
      e.target.value = "";
    },
    [handleFile]
  );

  const getMappedValue = (row: ParsedRow, field: string) => {
    const sourceCol = Object.entries(mapping).find(([, v]) => v === field)?.[0];
    return sourceCol ? row[sourceCol]?.trim() || "" : "";
  };

  // Count how many email steps a row has
  const countEmails = (row: ParsedRow): number => {
    let count = 0;
    for (let n = 1; n <= 5; n++) {
      const subj = getMappedValue(row, `email_${n}_subject`);
      const body = getMappedValue(row, `email_${n}_body`);
      if (subj || body) count = n;
      else break;
    }
    return count;
  };

  // Check which email fields are mapped
  const mappedValues = new Set(Object.values(mapping).filter(Boolean));
  const hasEmail1Subject = mappedValues.has("email_1_subject");
  const hasEmail1Body = mappedValues.has("email_1_body");

  const processMapping = () => {
    const emailField = Object.entries(mapping).find(([, v]) => v === "email")?.[0];
    if (!emailField) {
      toast.error("Email column mapping is required");
      return;
    }
    if (!hasEmail1Subject || !hasEmail1Body) {
      toast.error("Email 1 Subject and Body mappings are required");
      return;
    }

    // Validate subject/body pairing
    for (let n = 2; n <= 5; n++) {
      const hasSubj = mappedValues.has(`email_${n}_subject`);
      const hasBody = mappedValues.has(`email_${n}_body`);
      if (hasSubj !== hasBody) {
        toast.error(`Email ${n}: both Subject and Body must be mapped (or neither)`);
        return;
      }
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
    const rows = validRows.map((row) => {
      const result: Record<string, string | number | undefined> = {
        email: getMappedValue(row, "email"),
        first_name: getMappedValue(row, "first_name") || undefined,
        last_name: getMappedValue(row, "last_name") || undefined,
        company: getMappedValue(row, "company") || undefined,
        title: getMappedValue(row, "title") || undefined,
      };

      for (let n = 1; n <= 5; n++) {
        const subj = getMappedValue(row, `email_${n}_subject`);
        const body = getMappedValue(row, `email_${n}_body`);
        if (subj) result[`email_${n}_subject`] = subj;
        if (body) result[`email_${n}_body`] = body;
      }

      for (let n = 1; n <= 4; n++) {
        const wait = getMappedValue(row, `wait_after_email_${n}`);
        if (wait) result[`wait_after_email_${n}`] = parseInt(wait) || 1;
      }

      return result;
    });

    startTransition(async () => {
      const result = await importLeads(rows as Parameters<typeof importLeads>[0]);
      setImportedCount(result.imported);
      if (result.duplicates > 0) {
        setDuplicates((prev) => prev + result.duplicates);
      }
      toast.success(result.imported + " leads imported");
      setStep("done");
    });
  };

  // Reverse-lookup: which CSV header is mapped to a given field?
  const getHeaderForField = (field: string) => {
    return Object.entries(mapping).find(([, v]) => v === field)?.[0] || null;
  };

  // Update mapping for a field — ensure no duplicate mappings
  const setFieldMapping = (csvHeader: string, field: string) => {
    const newMapping = { ...mapping };
    if (field === "skip" || field === "") {
      delete newMapping[csvHeader];
    } else {
      // Remove previous mapping to this field from another header
      for (const [key, val] of Object.entries(newMapping)) {
        if (val === field && key !== csvHeader) {
          delete newMapping[key];
        }
      }
      newMapping[csvHeader] = field;
    }
    setMapping(newMapping);
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
            Upload a CSV file with leads and their email sequences
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
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200",
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

      {/* ─── Upload step ─── */}
      {step === "upload" && (
        <Card
          className="border-2 border-dashed border-border hover:border-amber/40 transition-colors cursor-pointer rounded-xl animate-scale-in"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <CardContent className="p-10 sm:p-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
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

      {/* ─── Mapping step ─── */}
      {step === "mapping" && (
        <div className="space-y-5 animate-blur-fade-in">
          <Card className="bg-card rounded-xl border border-border">
            <CardContent className="p-6 space-y-6">
              <div>
                <h2 className="text-[15px] font-semibold font-heading mb-1">
                  Map Columns
                </h2>
                <p className="text-[13px] text-muted-foreground mb-1">
                  Match your CSV columns to lead and email fields. We auto-detected some mappings.
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {headers.length} columns detected in your CSV
                </p>
              </div>

              <div className="space-y-3">
                {headers.map((header) => {
                  const currentField = mapping[header] || "";
                  const isMapped = !!currentField;
                  return (
                    <div key={header} className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
                      <span
                        className="text-[12px] shrink-0 w-full sm:w-56 truncate font-mono bg-muted px-3 py-1.5 rounded-lg text-muted-foreground"
                        title={header}
                      >
                        {header}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                      <Select
                        value={currentField || "skip"}
                        onValueChange={(v) => setFieldMapping(header, v === "skip" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 w-48 text-[12px] rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="skip">Skip</SelectItem>
                          {FIELD_SECTIONS.map((section) => (
                            <div key={section.label}>
                              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                                {section.label}
                              </div>
                              {section.fields.map((f) => (
                                <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      {isMapped ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[11px]">
                          Mapped
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground text-[11px]">
                          Skipped
                        </Badge>
                      )}
                      {currentField === "email" && (
                        <Badge className="bg-amber/15 text-amber text-[11px]">Required</Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mapping summary */}
              <div className="border-t border-border pt-4">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Mapping Summary
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_FIELDS.filter((f) => mappedValues.has(f)).map((f) => (
                    <Badge key={f} className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[11px]">
                      {FIELD_LABELS[f]}
                    </Badge>
                  ))}
                  {!hasEmail1Subject && (
                    <Badge className="bg-red-50 text-red-700 border-red-100 text-[11px]">
                      Missing: Email 1 Subject
                    </Badge>
                  )}
                  {!hasEmail1Body && (
                    <Badge className="bg-red-50 text-red-700 border-red-100 text-[11px]">
                      Missing: Email 1 Body
                    </Badge>
                  )}
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
              className="bg-amber text-white shadow-[0_1px_4px_-2px_rgba(0,0,0,0.025),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none h-9 text-[13px] font-semibold"
            >
              Review Import
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Review step ─── */}
      {step === "review" && (
        <div className="space-y-5 animate-blur-fade-in">
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
            <Card className="border border-red-100 bg-red-50/50 rounded-xl">
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

          <Card className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border">
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground">Email</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground">Name</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground">Company</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground">Emails</TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wider h-11 text-muted-foreground w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validRows.slice(0, 10).map((row, i) => {
                    const emailCount = countEmails(row);
                    const isExpanded = expandedRow === i;
                    return (
                      <Fragment key={i}>
                        <TableRow
                          className="hover:bg-muted/40 cursor-pointer"
                          onClick={() => setExpandedRow(isExpanded ? null : i)}
                        >
                          <TableCell className="text-[13px] py-3 font-mono">
                            {getMappedValue(row, "email")}
                          </TableCell>
                          <TableCell className="text-[13px] py-3">
                            {[getMappedValue(row, "first_name"), getMappedValue(row, "last_name")]
                              .filter(Boolean)
                              .join(" ") || "--"}
                          </TableCell>
                          <TableCell className="text-[13px] py-3">
                            {getMappedValue(row, "company") || "--"}
                          </TableCell>
                          <TableCell className="py-3">
                            <Badge className="bg-amber/10 text-amber text-[11px] font-medium">
                              {emailCount} email{emailCount !== 1 ? "s" : ""}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={5} className="py-0">
                              <div className="py-3 px-2 space-y-3 border-l-2 border-amber ml-2 mb-2">
                                {Array.from({ length: emailCount }, (_, n) => {
                                  const subj = getMappedValue(row, `email_${n + 1}_subject`);
                                  const body = getMappedValue(row, `email_${n + 1}_body`);
                                  return (
                                    <div key={n} className="pl-3">
                                      <p className="text-[12px] font-semibold text-foreground">
                                        Email {n + 1}
                                      </p>
                                      <p className="text-[12px] text-muted-foreground mt-0.5">
                                        <span className="font-medium">Subject:</span> {subj || "(empty)"}
                                      </p>
                                      <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-2">
                                        <span className="font-medium">Body:</span> {body ? body.slice(0, 120) + (body.length > 120 ? "..." : "") : "(empty)"}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
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
              className="bg-amber text-white shadow-[0_1px_4px_-2px_rgba(0,0,0,0.025),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none h-9 text-[13px] font-semibold"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : null}
              Import {validRows.length} Leads
            </Button>
          </div>
        </div>
      )}

      {/* ─── Done step ─── */}
      {step === "done" && (
        <Card className="bg-card rounded-xl border border-border animate-scale-in">
          <CardContent className="p-10 sm:p-20 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-50">
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
                  className="bg-amber text-white shadow-[0_1px_4px_-2px_rgba(0,0,0,0.025),inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:bg-amber/85 active:bg-amber/80 active:shadow-none h-9 text-[13px] font-semibold"
                  onClick={() => {
                    setStep("upload");
                    setRawData([]);
                    setHeaders([]);
                    setMapping({});
                    setValidRows([]);
                    setErrors([]);
                    setDuplicates(0);
                    setImportedCount(0);
                    setExpandedRow(null);
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
