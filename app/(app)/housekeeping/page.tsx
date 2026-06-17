"use client";

import { useMemo, useRef } from "react";
import { Printer } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { KpiCard } from "@/components/ui/kpi-card";
import { useApp } from "@/components/providers/app-data";
import { HK_CATEGORY_LABELS } from "@/lib/housekeeping";
import type { HkTask, HkTaskCategory, HkTaskStatus } from "@/lib/types";
import { fmtDate } from "@/lib/format";

const HK_COLS: [HkTaskStatus, string, string, string][] = [
  ["pending", "Ожидает", "#64748B", "#F8FAFC"],
  ["in_progress", "В работе", "#D97706", "#FFFBEB"],
  ["done", "Готово", "#059669", "#F0FDF4"],
];

const CATEGORY_STYLE: Record<HkTaskCategory, { bg: string; text: string; border: string }> = {
  checkout: { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  relocation: { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
  scheduled: { bg: "#F0FDF4", text: "#059669", border: "#A7F3D0" },
};

const PRINT_ORDER: HkTaskCategory[] = ["checkout", "relocation", "scheduled"];

function printTaskList(active: HkTask[], hotelName: string) {
  const today = fmtDate(new Date());
  const sections = PRINT_ORDER.map((cat) => {
    const items = active.filter((t) => (t.category ?? "checkout") === cat);
    if (!items.length) return "";
    const rows = items
      .map((t) => `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:700">№${t.roomNumber}</td><td style="padding:6px 10px;border:1px solid #ddd">${t.type}</td></tr>`)
      .join("");
    return `<h3 style="margin:16px 0 8px;font-size:14px">${HK_CATEGORY_LABELS[cat]} (${items.length})</h3><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#f1f5f9"><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Номер</th><th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Тип</th></tr></thead><tbody>${rows}</tbody></table>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Список уборки ${today}</title></head><body style="font-family:system-ui,sans-serif;padding:24px"><h1 style="font-size:18px;margin:0 0 4px">Уборка номеров</h1><p style="margin:0 0 16px;color:#64748b;font-size:13px">${hotelName} · ${today}</p>${sections || "<p>Нет активных задач</p>"}<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export default function HousekeepingPage() {
  const { hkTasks, hotelId, hotels, loading, refresh } = useApp();
  const printRef = useRef<HTMLDivElement>(null);

  const tasks = useMemo(
    () => (hotelId === "all" ? hkTasks : hkTasks.filter((t) => t.hotelId === hotelId)),
    [hkTasks, hotelId]
  );

  const active = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const hotelName = hotelId === "all" ? "Все отели" : hotels.find((h) => h.id === hotelId)?.name ?? "";

  async function advance(id: string, current: HkTaskStatus) {
    const next: HkTaskStatus = current === "pending" ? "in_progress" : "done";
    await fetch(`/api/housekeeping/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await refresh();
  }

  if (loading) {
    return (
      <>
        <TopBar title="Уборка номеров" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Уборка номеров" subtitle="Канбан · задачи остаются до отметки «Готово»" />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 min-w-0" ref={printRef}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 text-[11px]">
            {PRINT_ORDER.map((cat) => {
              const c = CATEGORY_STYLE[cat];
              const n = active.filter((t) => (t.category ?? "checkout") === cat).length;
              return (
                <span key={cat} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                  {HK_CATEGORY_LABELS[cat]}: {n}
                </span>
              );
            })}
          </div>
          <button
            onClick={() => printTaskList(active, hotelName)}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold rounded-xl border border-border hover:bg-muted text-foreground"
          >
            <Printer size={14} /> Печать списка
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Активных задач" value={String(active.length)} sub="ожидает + в работе" />
          <KpiCard label="В работе" value={String(tasks.filter((t) => t.status === "in_progress").length)} sub="сейчас" accent="#D97706" />
          <KpiCard label="Завершено" value={String(tasks.filter((t) => t.status === "done").length)} sub={`из ${tasks.length}`} accent="#059669" />
          <KpiCard label="Горничных" value={String(new Set(tasks.map((t) => t.assignee).filter((a) => a && a !== "—")).size)} sub="назначено" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {HK_COLS.map(([st, label, color, bg]) => (
            <div key={st} className="rounded-xl overflow-hidden border border-border">
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: bg, borderBottom: `2px solid ${color}40` }}>
                <span className="text-[13px] font-bold" style={{ color }}>{label}</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-card" style={{ color }}>{tasks.filter((t) => t.status === st).length}</span>
              </div>
              <div className="p-3 space-y-2 bg-card min-h-[200px]">
                {tasks.filter((t) => t.status === st).map((t) => {
                  const cat = (t.category ?? "checkout") as HkTaskCategory;
                  const cs = CATEGORY_STYLE[cat];
                  return (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl border border-border hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => st !== "done" && advance(t.id, t.status)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[14px] font-black text-foreground">№{t.roomNumber}</span>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: cs.bg, color: cs.text, border: `1px solid ${cs.border}` }}>
                            {HK_CATEGORY_LABELS[cat]}
                          </span>
                          {t.priority === "high" && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">СРОЧНО</span>}
                        </div>
                      </div>
                      <div className="text-[12px] text-foreground/80 mb-2">{t.type}</div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{t.assignee}</span>
                        <span>{t.time} · {t.est}</span>
                      </div>
                      {st !== "done" && (
                        <div className="mt-2 text-[9px] text-muted-foreground text-center">Нажмите для перевода →</div>
                      )}
                    </div>
                  );
                })}
                {tasks.filter((t) => t.status === st).length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center py-6">Пусто</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground">
          Номера попадают в уборку при выезде, переселении и каждые 7 дней длительного проживания.
          Задача остаётся в канбане до перевода в «Готово» — после этого номер освобождается (или остаётся занятым при плановой уборке).
        </p>
      </div>
    </>
  );
}
