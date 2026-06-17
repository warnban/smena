"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { renderAsync } from "docx-preview";
import {
  GUEST_FORM_TEMPLATES,
  parseGuestFormIds,
  parseStayAmendmentFromSearchParams,
  type GuestFormId,
} from "@/lib/guest-print-forms";

const RENDER_OPTS = {
  className: "docx-guest-form",
  inWrapper: true,
  hideWrapperOnPrint: false,
  ignoreWidth: false,
  ignoreHeight: false,
  ignoreFonts: false,
  breakPages: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
};

function resolveFormIds(sp: URLSearchParams): GuestFormId[] {
  const fromList = parseGuestFormIds(sp.get("formIds"));
  if (fromList.length) return fromList;
  const single = sp.get("formId");
  if (single && single in GUEST_FORM_TEMPLATES) return [single as GuestFormId];
  return [];
}

function FormPrintContent() {
  const sp = useSearchParams();
  const guestId = sp.get("guestId") ?? "";
  const formIds = resolveFormIds(sp);
  const bookingId = sp.get("bookingId") ?? "";
  const autoPrint = sp.get("print") !== "0";
  const amendment = parseStayAmendmentFromSearchParams(sp);
  const amendmentKey = amendment
    ? `${amendment.checkOut}-${amendment.amount}-${amendment.nights}`
    : "";

  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  useEffect(() => {
    if (!guestId || !formIds.length) {
      setStatus("error");
      setError("Некорректные параметры печати");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (!bodyRef.current) return;
        bodyRef.current.innerHTML = "";
        if (styleRef.current) styleRef.current.innerHTML = "";

        for (let i = 0; i < formIds.length; i++) {
          const formId = formIds[i];
          if (cancelled) return;

          setProgress(`Документ ${i + 1} из ${formIds.length}…`);

          const q = new URLSearchParams({ format: "docx" });
          if (bookingId) q.set("bookingId", bookingId);
          if (amendment) {
            q.set("prevCheckOut", new Date(amendment.checkOut).toISOString().slice(0, 10));
            q.set("prevAmount", String(amendment.amount));
            q.set("prevNights", String(amendment.nights));
          }
          const url = `/api/guests/${guestId}/forms/${formId}?${q.toString()}`;

          const res = await fetch(url);
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(
              data.error ??
                `Не удалось сформировать «${GUEST_FORM_TEMPLATES[formId].label}»`
            );
          }

          const blob = await res.blob();
          if (cancelled || !bodyRef.current) return;

          const section = document.createElement("div");
          section.className = "guest-form-print-section";
          if (formIds.length > 1) {
            section.dataset.formId = formId;
          }
          bodyRef.current.appendChild(section);

          await renderAsync(blob, section, styleRef.current ?? undefined, RENDER_OPTS);
        }

        if (cancelled) return;
        setProgress("");
        setStatus("ready");

        if (autoPrint) {
          window.setTimeout(() => window.print(), 500);
        }
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guestId, bookingId, autoPrint, formIds.join(","), amendmentKey]);

  const title =
    formIds.length === 1
      ? (GUEST_FORM_TEMPLATES[formIds[0]]?.label ?? "Бланк")
      : `Печать документов (${formIds.length})`;

  return (
    <>
      <div ref={styleRef} aria-hidden className="docx-styles-host" />
      <div className="guest-form-print-toolbar no-print">
        <span className="guest-form-print-title">{title}</span>
        <div className="guest-form-print-actions">
          {status === "ready" && (
            <button type="button" onClick={() => window.print()} className="guest-form-print-btn primary">
              Печать
            </button>
          )}
          <button type="button" onClick={() => window.close()} className="guest-form-print-btn">
            Закрыть
          </button>
        </div>
      </div>

      {status === "loading" && (
        <p className="guest-form-print-message no-print">{progress || "Формирование документов…"}</p>
      )}
      {status === "error" && (
        <p className="guest-form-print-message error no-print">{error}</p>
      )}

      <div ref={bodyRef} className="guest-form-print-body" />
    </>
  );
}

export default function GuestFormPrintPage() {
  return (
    <Suspense fallback={<p className="guest-form-print-message no-print">Загрузка…</p>}>
      <FormPrintContent />
    </Suspense>
  );
}
