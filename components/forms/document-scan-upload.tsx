"use client";

import { useRef, useState } from "react";
import { ScanLine, Upload, Check, AlertTriangle, Loader2 } from "lucide-react";
import { applyDocumentScanToForm } from "@/lib/document-scan-apply";
import { PRIMARY_DOC_LABELS } from "@/lib/document-types";
import type { GuestFormData } from "@/lib/guest-form";
import type { DocumentScanApiResponse, DocumentScanExtract } from "@/lib/document-scan-types";

type Props = {
  guestId: string;
  guestIsForeigner: boolean;
  form: GuestFormData;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onApplied: (payload: {
    form: GuestFormData;
    extract: DocumentScanExtract;
    suggestedIsForeigner: boolean;
    isForeignerMismatch: boolean;
  }) => void | Promise<void>;
};

export function DocumentScanUpload({
  guestId,
  guestIsForeigner,
  form,
  disabled,
  onBusyChange,
  onApplied,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "warn" | "error">("idle");
  const [message, setMessage] = useState("");
  const [filled, setFilled] = useState<string[]>([]);

  function setScanBusy(v: boolean) {
    setBusy(v);
    onBusyChange?.(v);
  }

  async function onPick(file: File) {
    setScanBusy(true);
    setStatus("idle");
    setMessage("");
    setFilled([]);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", "passport");

      const res = await fetch(`/api/guests/${guestId}/document-scan`, {
        method: "POST",
        body: fd,
      });

      const data = (await res.json()) as DocumentScanApiResponse & {
        error?: string;
        partial?: boolean;
      };

      if (!res.ok) {
        setStatus(data.partial ? "warn" : "error");
        setMessage(
          data.partial
            ? `${data.error ?? "Распознавание не удалось"}. Скан прикреплён к профилю.`
            : data.error ?? "Ошибка"
        );
        return;
      }

      const nextForm = applyDocumentScanToForm(form, data.extract);
      await onApplied({
        form: nextForm,
        extract: data.extract,
        suggestedIsForeigner: data.suggestedIsForeigner,
        isForeignerMismatch: data.isForeignerMismatch,
      });

      setFilled(data.filledFields);
      const pct = Math.round(data.extract.confidence * 100);
      const docLabel = PRIMARY_DOC_LABELS[data.extract.docType] ?? data.extract.docType;

      if (data.isForeignerMismatch) {
        setStatus("warn");
        setMessage(
          `${docLabel}, ${data.extract.country || data.extract.nationality}. ` +
            `В карточке: ${guestIsForeigner ? "иностранец" : "гражданин РФ"} — проверьте статус.`
        );
      } else if (data.extract.warnings.length) {
        setStatus("warn");
        setMessage(`${docLabel} (${pct}%): ${data.extract.warnings.join("; ")}`);
      } else {
        setStatus("ok");
        setMessage(`${docLabel} · ${data.extract.country || "—"} — поля заполнены (${pct}%)`);
      }
    } catch {
      setStatus("error");
      setMessage("Ошибка сети");
    } finally {
      setScanBusy(false);
    }
  }

  return (
    <div
      className="rounded-xl border border-dashed border-primary/40 bg-accent/30 p-3 sm:p-4 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            {busy ? (
              <Loader2 size={18} className="text-primary animate-spin" />
            ) : (
              <ScanLine size={18} className="text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold">Скан документа · AI</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Загрузите фото или PDF — AI определит гражданство, тип документа и заполнит форму №5. Скан сохранится в профиле.
            </p>
          </div>
        </div>
        <label
          className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[12px] font-bold rounded-xl text-white cursor-pointer w-full sm:w-auto ${
            disabled || busy ? "opacity-50 pointer-events-none" : "hover:opacity-90"
          }`}
          style={{ background: "linear-gradient(135deg,#6366F1,#4F46E5)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <Upload size={14} />
          {busy ? "Распознавание…" : "Загрузить скан"}
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            disabled={disabled || busy}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onPick(file);
            }}
          />
        </label>
      </div>

      {status !== "idle" && message && (
        <div
          className={`flex items-start gap-2 text-[11px] rounded-lg px-2.5 py-2 ${
            status === "ok"
              ? "bg-success/10 text-success"
              : status === "warn"
                ? "bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]"
                : "bg-destructive/10 text-destructive"
          }`}
        >
          {status === "ok" ? (
            <Check size={14} className="flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
          )}
          <span>{message}</span>
        </div>
      )}

      {filled.length > 0 && (
        <p className="text-[10px] text-muted-foreground">Подставлено: {filled.join(", ")}</p>
      )}
    </div>
  );
}
