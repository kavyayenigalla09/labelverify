"use client";

import { ChangeEvent, DragEvent, useRef, useState } from "react";

type ApplicationData = {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  producer: string;
  countryOfOrigin: string;
};

type CheckStatus = "match" | "mismatch" | "review";

type VerificationResult = {
  overallStatus: "pass" | "review" | "fail";
  processingTimeMs: number;
  imageQuality: "good" | "acceptable" | "poor";
  imageQualityNotes: string;
  checks: Array<{
    id: string;
    label: string;
    expected: string;
    detected: string | null;
    status: CheckStatus;
    reason: string;
  }>;
  fieldOfVision: {
    status: CheckStatus;
    reason: string;
  };
  warning: {
    present: boolean;
    exactWording: boolean;
    headingUppercase: boolean;
    headingAppearsBold: boolean;
    notes: string;
    checks: Array<{
      label: string;
      status: CheckStatus;
    }>;
  };
  extracted: {
    brandName: string | null;
    classType: string | null;
    alcoholContent: string | null;
    netContents: string | null;
    producer: string | null;
    countryOfOrigin: string | null;
    governmentWarningText: string | null;
  };
  notes: string[];
};

type CsvRecord = ApplicationData & {
  filename: string;
};

type BatchItem = {
  id: string;
  file: File;
  application: CsvRecord;
  status: "queued" | "processing" | "complete" | "error";
  result?: VerificationResult;
  error?: string;
};

const initialForm: ApplicationData = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45%",
  netContents: "750 mL",
  producer: "Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "United States",
};

export default function Home() {
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [form, setForm] = useState<ApplicationData>(initialForm);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function updateField(field: keyof ApplicationData, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setResult(null);
  }

  function chooseFile(selected?: File) {
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Please select a PNG, JPG, JPEG, or WEBP image.");
      return;
    }

    if (selected.size > 12 * 1024 * 1024) {
      setError("Please choose an image smaller than 12 MB.");
      return;
    }

    if (preview) URL.revokeObjectURL(preview);

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError(null);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  function clearFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);

    if (inputRef.current) inputRef.current.value = "";
  }

  async function verifyLabel() {
    if (!file) return;

    setAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const payload = new FormData();
      payload.append("image", file);
      payload.append("application", JSON.stringify(form));

      const response = await fetch("/api/verify", {
        method: "POST",
        body: payload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      setResult(data);
      setTimeout(() => {
        document
          .getElementById("verification-results")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong while analyzing the label."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function resetReview() {
    clearFile();
    setForm(initialForm);
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const canVerify =
    !!file &&
    !!form.brandName.trim() &&
    !!form.classType.trim() &&
    !!form.alcoholContent.trim() &&
    !!form.netContents.trim() &&
    !!form.producer.trim() &&
    !analyzing;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef5fb_0,_#f8fafc_34rem)] text-slate-900">
      <Header />

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6">
          <nav className="flex gap-8">
            <Tab active={mode === "single"} onClick={() => setMode("single")}>
              Single Review
            </Tab>
            <Tab active={mode === "batch"} onClick={() => setMode("batch")}>
              Batch Review
            </Tab>
          </nav>
        </div>
      </div>

      {mode === "batch" ? (
        <BatchReview />
      ) : (
        <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
          <div className="mb-8">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#315f91]">
              New Review
            </p>
            <h2 className="text-3xl font-bold tracking-[-0.025em] text-slate-950 sm:text-4xl">
              Verify an alcohol beverage label
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Enter the information from the label application and upload the
              corresponding label artwork. LabelVerify compares visible label
              information and surfaces discrepancies for agent review.
            </p>
          </div>

          <div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr]">
            <Panel
              number="1"
              title="Application Information"
              subtitle="Enter the values submitted by the applicant."
            >
              <div className="space-y-5">
                <Field
                  label="Brand Name"
                  required
                  value={form.brandName}
                  onChange={(v) => updateField("brandName", v)}
                />
                <Field
                  label="Class / Type"
                  required
                  value={form.classType}
                  onChange={(v) => updateField("classType", v)}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Alcohol Content"
                    required
                    value={form.alcoholContent}
                    onChange={(v) => updateField("alcoholContent", v)}
                  />
                  <Field
                    label="Net Contents"
                    required
                    value={form.netContents}
                    onChange={(v) => updateField("netContents", v)}
                  />
                </div>
                <Field
                  label="Bottler / Producer Name & Address"
                  required
                  value={form.producer}
                  onChange={(v) => updateField("producer", v)}
                />
                <Field
                  label="Country of Origin (Imports)"
                  hint="Leave blank when country-of-origin verification is not applicable."
                  value={form.countryOfOrigin}
                  onChange={(v) => updateField("countryOfOrigin", v)}
                />
                <p className="pt-1 text-xs leading-5 text-slate-500">
                  <span className="font-semibold text-slate-700">*</span>{" "}
                  Required for this prototype review.
                </p>
              </div>
            </Panel>

            <Panel
              number="2"
              title="Label Artwork"
              subtitle="Upload an image of the label to verify."
            >
              {!preview ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={`flex min-h-[355px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 text-center transition ${
                    dragging
                      ? "border-[#315f91] bg-blue-50"
                      : "border-slate-300 bg-slate-50 hover:border-[#315f91] hover:bg-blue-50/40"
                  }`}
                >
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl shadow-sm">
                    ↑
                  </div>
                  <h4 className="text-lg font-bold">Upload label artwork</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Drag and drop an image here, or{" "}
                    <span className="font-semibold text-[#315f91]">
                      browse files
                    </span>
                  </p>
                  <p className="mt-5 text-xs text-slate-400">
                    PNG, JPG, JPEG or WEBP • Maximum 12 MB
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex min-h-[355px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Uploaded alcohol label preview"
                      className="max-h-[420px] max-w-full rounded object-contain"
                    />
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {file?.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {file
                          ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={clearFile}
                      disabled={analyzing}
                      className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileInput}
                className="hidden"
              />

              <div className="mt-6 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4">
                <p className="text-sm font-semibold text-[#17365d]">
                  Image quality
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Unreadable or ambiguous content is flagged for manual review
                  rather than assumed.
                </p>
              </div>
            </Panel>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-7 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
            >
              <strong>Unable to complete review.</strong> {error}
            </div>
          )}

          <div className="mt-7 flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white px-7 py-6 shadow-sm sm:flex-row sm:items-center">
            <div>
              <p className="font-bold">
                {analyzing ? "Analyzing label…" : "Ready to verify?"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {analyzing
                  ? "Reading the artwork and checking application values."
                  : "The label will be checked against the application information above."}
              </p>
            </div>

            <button
              disabled={!canVerify}
              onClick={verifyLabel}
              className="min-w-[190px] rounded-xl bg-[#17365d] px-6 py-3.5 text-base font-bold text-white shadow-[0_7px_18px_rgba(23,54,93,0.18)] transition hover:-translate-y-0.5 hover:bg-[#244d7b] hover:shadow-[0_10px_24px_rgba(23,54,93,0.22)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {analyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Analyzing…
                </span>
              ) : (
                "Verify Label →"
              )}
            </button>
          </div>

          {result && (
            <Results
              result={result}
              preview={preview}
              onReset={resetReview}
            />
          )}

          {!result && (
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <InfoCard
                title="Routine checks automated"
                text="Compare application values with information detected on the label."
              />
              <InfoCard
                title="Exceptions surfaced"
                text="Ambiguous or non-compliant items are flagged for human review."
              />
              <InfoCard
                title="Agent remains in control"
                text="LabelVerify assists review; it does not make final approval decisions."
              />
            </div>
          )}
        </section>
      )}

      <Footer />
    </main>
  );
}

function Results({
  result,
  preview,
  onReset,
}: {
  result: VerificationResult;
  preview: string | null;
  onReset: () => void;
}) {
  const statusConfig = {
    pass: {
      title: "No discrepancies detected",
      subtitle:
        "The automated checks completed without identifying a discrepancy.",
      badge: "PASS",
      box: "border-emerald-200 bg-emerald-50",
      badgeStyle: "bg-emerald-700 text-white",
    },
    review: {
      title: "Manual review recommended",
      subtitle:
        "One or more items could not be verified confidently from the artwork.",
      badge: "REVIEW",
      box: "border-amber-200 bg-amber-50",
      badgeStyle: "bg-amber-600 text-white",
    },
    fail: {
      title: "Discrepancies detected",
      subtitle:
        "One or more label values differ from the application or warning requirements.",
      badge: "ISSUES FOUND",
      box: "border-red-200 bg-red-50",
      badgeStyle: "bg-red-700 text-white",
    },
  } as const;

  const config = statusConfig[result.overallStatus];
  const [disposition, setDisposition] = useState<
    "accept" | "follow-up" | "reject" | null
  >(null);
  const [agentNote, setAgentNote] = useState("");

  return (
    <section id="verification-results" className="scroll-mt-6 pt-10">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#315f91]">
            Verification Results
          </p>
          <h2 className="text-3xl font-bold">Label review</h2>
        </div>
        <p className="text-sm font-medium text-slate-500">
          Completed in {(result.processingTimeMs / 1000).toFixed(2)} seconds
        </p>
      </div>

      <div className={`rounded-xl border p-6 ${config.box}`}>
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <span
              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold tracking-wide ${config.badgeStyle}`}
            >
              {config.badge}
            </span>
            <h3 className="mt-3 text-xl font-bold">{config.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {config.subtitle}
            </p>
          </div>

          <button
            onClick={onReset}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            New Review
          </button>
        </div>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_0.42fr]">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="font-bold">Application vs. Label</h3>
            <p className="mt-1 text-sm text-slate-500">
              Values detected from the artwork are compared with the submitted application.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4">Requirement</th>
                  <th className="px-6 py-4">Application</th>
                  <th className="px-6 py-4">Label detected</th>
                  <th className="px-6 py-4">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.checks.map((check) => (
                  <tr key={check.id}>
                    <td className="px-6 py-4 font-semibold">{check.label}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {check.expected}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {check.detected || (
                        <span className="italic text-slate-400">
                          Not confidently detected
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={check.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold">Uploaded Label</h3>
          {preview && (
            <div className="mt-4 flex min-h-[250px] items-center justify-center rounded-lg bg-slate-100 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Reviewed label"
                className="max-h-[340px] rounded object-contain"
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-7 rounded-2xl border border-slate-200/80 bg-white px-6 py-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold">Required Field of Vision</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Brand name, class/type, and alcohol content should appear together in the same field of vision.
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {result.fieldOfVision.reason}
            </p>
          </div>
          <StatusBadge status={result.fieldOfVision.status} />
        </div>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="font-bold">Government Health Warning</h3>
            <p className="mt-1 text-sm text-slate-500">
              Automated checks of visible warning content and heading treatment.
            </p>
          </div>

          <div className="p-6">
            <div className="space-y-3">
              {result.warning.checks.map((check) => (
                <div
                  key={check.label}
                  className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium">{check.label}</span>
                  <StatusBadge status={check.status} />
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-600">
              {result.warning.notes}
            </p>

            {result.extracted.governmentWarningText && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Detected warning
                </p>
                <p className="text-sm leading-6 text-slate-700">
                  {result.extracted.governmentWarningText}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-6 py-5">
            <h3 className="font-bold">Image Quality & Review Notes</h3>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium">Image readability</span>
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                {result.imageQuality}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              {result.imageQualityNotes}
            </p>

            {result.notes.length > 0 && (
              <ul className="mt-5 space-y-2 border-t border-slate-100 pt-5">
                {result.notes.map((note, index) => (
                  <li
                    key={index}
                    className="flex gap-3 text-sm leading-6 text-slate-600"
                  >
                    <span className="font-bold text-[#315f91]">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-100 bg-slate-50/60 px-6 py-5">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#315f91]">
                Human decision
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-950">Agent disposition</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Record the reviewer&apos;s decision after considering the automated findings.
              </p>
            </div>
            <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500 sm:inline-flex">
              Not persisted in prototype
            </span>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["accept", "Accept", "No further action"],
              ["follow-up", "Needs Follow-up", "Clarification required"],
              ["reject", "Reject", "Issues require correction"],
            ].map(([value, label, helper]) => {
              const active = disposition === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setDisposition(value as "accept" | "follow-up" | "reject")
                  }
                  aria-pressed={active}
                  className={`rounded-xl border px-4 py-4 text-left transition ${
                    active
                      ? "border-[#315f91] bg-blue-50 ring-2 ring-blue-100"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className={`block text-sm font-bold ${active ? "text-[#17365d]" : "text-slate-800"}`}>
                    {active ? "✓ " : ""}{label}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{helper}</span>
                </button>
              );
            })}
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Reviewer note <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              value={agentNote}
              onChange={(event) => setAgentNote(event.target.value)}
              rows={3}
              placeholder="Add rationale or follow-up instructions…"
              className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition hover:border-slate-400 focus:border-[#315f91] focus:ring-4 focus:ring-blue-100/70"
            />
          </label>

          {disposition && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#17365d] text-xs font-bold text-white">✓</span>
              Disposition recorded for this review session.
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/80 px-5 py-4">
        <p className="text-sm font-semibold text-[#17365d]">
          Decision support, not automated approval
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          LabelVerify surfaces evidence and discrepancies to assist a compliance
          agent. Final regulatory decisions remain with the reviewing agent.
        </p>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: CheckStatus }) {
  const styles = {
    match: "bg-emerald-100 text-emerald-800",
    mismatch: "bg-red-100 text-red-800",
    review: "bg-amber-100 text-amber-800",
  };

  const labels = {
    match: "✓ Match",
    mismatch: "✕ Mismatch",
    review: "! Review",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function Header() {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-[#17365d] shadow-[0_6px_18px_rgba(23,54,93,0.22)]">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 3.75h8.5L18 7.25v13H6z" />
              <path d="M14.5 3.75v3.5H18M8.8 12.2l2 2 4.5-4.5" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#17365d]">
              LabelVerify
            </h1>
            <p className="text-sm text-slate-500">
              Alcohol Label Compliance Assistant
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 sm:flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Prototype
        </div>
      </div>
    </header>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 px-1 py-4 text-sm font-semibold transition ${
        active
          ? "border-[#17365d] text-[#17365d]"
          : "border-transparent text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function Panel({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
      <div className="border-b border-slate-100 bg-slate-50/60 px-7 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#17365d] text-sm font-bold text-white">
            {number}
          </span>
          <div>
            <h3 className="font-bold">{title}</h3>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-7">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[15px] shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[#315f91] focus:ring-4 focus:ring-blue-100/70"
      />
      {hint && (
        <span className="mt-1.5 block text-xs leading-5 text-slate-500">
          {hint}
        </span>
      )}
    </label>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white px-5 py-5 shadow-[0_4px_18px_rgba(15,23,42,0.04)]">
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
    </div>
  );
}

function BatchReview() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [records, setRecords] = useState<CsvRecord[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BatchItem | null>(null);

  function parseCsvLine(line: string) {
    const values: string[] = [];
    let current = "";
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (char === "," && !quoted) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  async function loadCsv(file: File) {
    setBatchError(null);

    try {
      const text = await file.text();
      const lines = text
        .replace(/\r/g, "")
        .split("\n")
        .filter((line) => line.trim());

      if (lines.length < 2) {
        throw new Error("CSV must contain a header and at least one application.");
      }

      const headers = parseCsvLine(lines[0]).map((h) => h.trim());

      const required = [
        "filename",
        "brandName",
        "classType",
        "alcoholContent",
        "netContents",
        "producer",
      ];

      const missing = required.filter((header) => !headers.includes(header));

      if (missing.length) {
        throw new Error(
          `CSV is missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`
        );
      }

      const parsed = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
          row[header] = values[index] ?? "";
        });

        return {
          filename: row.filename ?? "",
          brandName: row.brandName ?? "",
          classType: row.classType ?? "",
          alcoholContent: row.alcoholContent ?? "",
          netContents: row.netContents ?? "",
          producer: row.producer ?? "",
          countryOfOrigin: row.countryOfOrigin ?? "",
        };
      });

      if (parsed.some((row) => !row.filename)) {
        throw new Error("Every CSV row must include a filename.");
      }

      setCsvFile(file);
      setRecords(parsed);
      setItems([]);
      setSelected(null);
    } catch (error) {
      setCsvFile(null);
      setRecords([]);
      setItems([]);
      setBatchError(
        error instanceof Error ? error.message : "Could not read CSV."
      );
    }
  }

  function loadImages(fileList: FileList | null) {
    if (!fileList) return;

    const selectedFiles = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/")
    );

    setImages(selectedFiles);
    setItems([]);
    setSelected(null);
    setBatchError(null);
  }

  function downloadTemplate() {
    const content = [
      "filename,brandName,classType,alcoholContent,netContents,producer,countryOfOrigin",
      'label-001.jpg,ABC,Rye Whisky,45%,750 mL,ABC Distillery,United States',
      '"label-002.jpg","OLD TOM DISTILLERY","Kentucky Straight Bourbon Whiskey","45%","750 mL","Old Tom Distillery, Louisville, KY","United States"',
    ].join("\n");

    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "labelverify-batch-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function prepareBatch() {
    const imageMap = new Map(
      images.map((file) => [file.name.toLowerCase(), file])
    );

    const missingImages: string[] = [];
    const matched: BatchItem[] = [];

    records.forEach((application, index) => {
      const file = imageMap.get(application.filename.toLowerCase());

      if (!file) {
        missingImages.push(application.filename);
        return;
      }

      matched.push({
        id: `${application.filename}-${index}`,
        file,
        application,
        status: "queued",
      });
    });

    if (missingImages.length) {
      setBatchError(
        `Missing image${missingImages.length > 1 ? "s" : ""} for: ${missingImages.join(", ")}`
      );
      return null;
    }

    if (!matched.length) {
      setBatchError("No CSV rows could be matched to uploaded images.");
      return null;
    }

    setBatchError(null);
    setItems(matched);
    return matched;
  }

  async function verifyOne(item: BatchItem) {
    const application: ApplicationData = {
      brandName: item.application.brandName,
      classType: item.application.classType,
      alcoholContent: item.application.alcoholContent,
      netContents: item.application.netContents,
      producer: item.application.producer,
      countryOfOrigin: item.application.countryOfOrigin,
    };

    const payload = new FormData();
    payload.append("image", item.file);
    payload.append("application", JSON.stringify(application));

    const response = await fetch("/api/verify", {
      method: "POST",
      body: payload,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Verification failed.");
    }

    return data as VerificationResult;
  }

  async function runBatch() {
    const batch = prepareBatch();
    if (!batch) return;

    setRunning(true);
    setSelected(null);

    const queue = [...batch];
    const concurrency = Math.min(4, queue.length);

    async function worker() {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;

        setItems((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, status: "processing" } : row
          )
        );

        try {
          const result = await verifyOne(item);

          setItems((current) =>
            current.map((row) =>
              row.id === item.id
                ? { ...row, status: "complete", result }
                : row
            )
          );
        } catch (error) {
          setItems((current) =>
            current.map((row) =>
              row.id === item.id
                ? {
                    ...row,
                    status: "error",
                    error:
                      error instanceof Error
                        ? error.message
                        : "Verification failed.",
                  }
                : row
            )
          );
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    setRunning(false);
  }

  const complete = items.filter((item) => item.status === "complete");
  const passed = complete.filter(
    (item) => item.result?.overallStatus === "pass"
  ).length;
  const review = complete.filter(
    (item) => item.result?.overallStatus === "review"
  ).length;
  const failed = complete.filter(
    (item) => item.result?.overallStatus === "fail"
  ).length;
  const errors = items.filter((item) => item.status === "error").length;
  const finished = complete.length + errors;
  const progress = items.length
    ? Math.round((finished / items.length) * 100)
    : 0;

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#315f91]">
            Batch Processing
          </p>
          <h2 className="text-3xl font-bold tracking-tight">
            Review multiple labels
          </h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Upload application data as a CSV and the corresponding label
            images. LabelVerify matches each application to its artwork by
            filename and processes the batch with controlled concurrency.
          </p>
        </div>

        <button
          onClick={downloadTemplate}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ↓ Download CSV Template
        </button>
      </div>

      <div className="grid gap-7 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 bg-slate-50/60 px-7 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#17365d] text-sm font-bold text-white">
                1
              </span>
              <div>
                <h3 className="font-bold">Application Data</h3>
                <p className="text-sm text-slate-500">
                  Upload one row per label application.
                </p>
              </div>
            </div>
          </div>

          <div className="p-7">
            <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-8 text-center hover:border-[#315f91] hover:bg-blue-50/40">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                ≡
              </div>
              <p className="font-bold">
                {csvFile ? csvFile.name : "Upload application CSV"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {records.length
                  ? `${records.length} application${records.length === 1 ? "" : "s"} loaded`
                  : "Click to select a .csv file"}
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={running}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) loadCsv(file);
                }}
              />
            </label>

            <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
              Required columns: filename, brandName, classType,
              alcoholContent, netContents, producer. countryOfOrigin is optional
              and applies to imports.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-100 bg-slate-50/60 px-7 py-5">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#17365d] text-sm font-bold text-white">
                2
              </span>
              <div>
                <h3 className="font-bold">Label Artwork</h3>
                <p className="text-sm text-slate-500">
                  Select the images referenced in the CSV.
                </p>
              </div>
            </div>
          </div>

          <div className="p-7">
            <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-8 text-center hover:border-[#315f91] hover:bg-blue-50/40">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                ↑
              </div>
              <p className="font-bold">Upload label images</p>
              <p className="mt-2 text-sm text-slate-500">
                {images.length
                  ? `${images.length} image${images.length === 1 ? "" : "s"} selected`
                  : "Select multiple PNG, JPG, JPEG or WEBP files"}
              </p>
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={running}
                onChange={(e) => loadImages(e.target.files)}
              />
            </label>

            {images.length > 0 && (
              <div className="mt-4 max-h-28 overflow-auto rounded-lg bg-slate-50 px-4 py-3">
                {images.map((file) => (
                  <p
                    key={`${file.name}-${file.size}`}
                    className="truncate py-1 text-xs text-slate-600"
                  >
                    {file.name}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {batchError && (
        <div
          role="alert"
          className="mt-7 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800"
        >
          <strong>Batch cannot start.</strong> {batchError}
        </div>
      )}

      <div className="mt-7 rounded-xl border border-slate-200 bg-white px-7 py-6 shadow-sm">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-bold">
              {running ? "Batch review in progress…" : "Ready to process batch?"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {records.length} application{records.length === 1 ? "" : "s"} •{" "}
              {images.length} image{images.length === 1 ? "" : "s"}
            </p>
          </div>

          <button
            onClick={runBatch}
            disabled={
              running || records.length === 0 || images.length === 0
            }
            className="min-w-[200px] rounded-xl bg-[#17365d] px-6 py-3.5 text-base font-bold text-white shadow-[0_7px_18px_rgba(23,54,93,0.18)] transition hover:-translate-y-0.5 hover:bg-[#244d7b] disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {running ? "Processing…" : "Run Batch Review →"}
          </button>
        </div>

        {items.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-xs font-semibold text-slate-500">
              <span>
                {finished} of {items.length} completed
              </span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-[#315f91] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-8">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[#315f91]">
                Batch Results
              </p>
              <h3 className="text-2xl font-bold">Review queue</h3>
            </div>

            {!running && finished > 0 && (
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">
                  {passed} Pass
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">
                  {review} Review
                </span>
                <span className="rounded-full bg-red-100 px-3 py-1.5 text-red-800">
                  {failed} Issues
                </span>
                {errors > 0 && (
                  <span className="rounded-full bg-slate-200 px-3 py-1.5 text-slate-700">
                    {errors} Error
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Label</th>
                    <th className="px-6 py-4">Brand</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Items requiring attention</th>
                    <th className="px-6 py-4">Analysis time</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const attention = item.result
                      ? item.result.checks.filter(
                          (check) => check.status !== "match"
                        ).length +
                        item.result.warning.checks.filter(
                          (check) => check.status !== "match"
                        ).length +
                        (item.result.fieldOfVision.status !== "match" ? 1 : 0)
                      : 0;

                    return (
                      <tr key={item.id}>
                        <td className="px-6 py-4 font-semibold">
                          {item.file.name}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {item.application.brandName}
                        </td>
                        <td className="px-6 py-4">
                          {item.status === "queued" && (
                            <span className="text-xs font-bold text-slate-500">
                              QUEUED
                            </span>
                          )}
                          {item.status === "processing" && (
                            <span className="text-xs font-bold text-blue-700">
                              ANALYZING…
                            </span>
                          )}
                          {item.status === "error" && (
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                              ERROR
                            </span>
                          )}
                          {item.status === "complete" && item.result && (
                            <BatchStatus status={item.result.overallStatus} />
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {item.status === "complete" ? attention : "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {item.result
                            ? `${(item.result.processingTimeMs / 1000).toFixed(2)}s`
                            : "—"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {item.result && (
                            <button
                              onClick={() => setSelected(item)}
                              className="font-bold text-[#315f91] hover:underline"
                            >
                              View details
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {selected?.result && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
            <div>
              <h3 className="font-bold">
                Review details — {selected.file.name}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {selected.application.brandName}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="grid gap-7 p-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-4 font-bold">Application vs. Label</h4>
              <div className="space-y-3">
                {selected.result.checks.map((check) => (
                  <div
                    key={check.id}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-semibold">{check.label}</p>
                      <StatusBadge status={check.status} />
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <p>
                        <strong>Application:</strong> {check.expected}
                      </p>
                      <p>
                        <strong>Detected:</strong>{" "}
                        {check.detected || "Not detected"}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {check.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-4 font-bold">Field of Vision & Government Warning</h4>
              <div className="mb-5 rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-semibold">Required Field of Vision</p>
                  <StatusBadge status={selected.result.fieldOfVision.status} />
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {selected.result.fieldOfVision.reason}
                </p>
              </div>
              <h4 className="mb-4 font-bold">Government Warning</h4>
              <div className="space-y-3">
                {selected.result.warning.checks.map((check) => (
                  <div
                    key={check.label}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
                  >
                    <span className="text-sm font-medium">{check.label}</span>
                    <StatusBadge status={check.status} />
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-lg bg-blue-50 p-4">
                <p className="text-sm font-bold text-[#17365d]">
                  Image quality:{" "}
                  <span className="uppercase">
                    {selected.result.imageQuality}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selected.result.imageQualityNotes}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-7 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
        <p className="text-sm font-semibold text-[#17365d]">
          Prototype batch architecture
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          This prototype processes up to four labels concurrently. A production
          implementation could use a durable job queue for very large importer
          submissions while retaining the same verification workflow.
        </p>
      </div>
    </section>
  );
}

function BatchStatus({
  status,
}: {
  status: "pass" | "review" | "fail";
}) {
  const styles = {
    pass: "bg-emerald-100 text-emerald-800",
    review: "bg-amber-100 text-amber-800",
    fail: "bg-red-100 text-red-800",
  };

  const labels = {
    pass: "✓ PASS",
    review: "! REVIEW",
    fail: "✕ ISSUES",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row">
        <p>LabelVerify • Proof-of-Concept</p>
        <p>AI-assisted review • Human decision-making retained</p>
      </div>
    </footer>
  );
}
