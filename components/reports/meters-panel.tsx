"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  FolderUp,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  METER_TYPE_CONFIG,
  METER_TYPE_OPTIONS,
  formatMeterDelta,
  formatMeterValue,
  formatPeriodLabel,
  type UtilityMeterType,
} from "@/lib/meters";
import type { MeterCellDto, MeterRowDto, MetersBoardDto } from "@/lib/meters.server";
import { DatePicker } from "@/components/ui/date-picker";

type Props = {
  hotelId: string;
  hotelName: string;
  canManageZones: boolean;
};

function defaultPeriodDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function MeterTypeBadge({ type }: { type: UtilityMeterType }) {
  const cfg = METER_TYPE_CONFIG[type];
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

type PeriodFilterPreset = "last3" | "last6" | "last12" | "all" | "range";

const PERIOD_FILTER_OPTIONS: { id: PeriodFilterPreset; label: string }[] = [
  { id: "last3", label: "3" },
  { id: "last6", label: "6" },
  { id: "last12", label: "12" },
  { id: "all", label: "Все" },
  { id: "range", label: "Диапазон" },
];

function filterPeriods(
  periods: string[],
  preset: PeriodFilterPreset,
  rangeFrom: string,
  rangeTo: string
): string[] {
  if (!periods.length) return [];
  if (preset === "all") return periods;
  if (preset === "range") {
    if (!rangeFrom && !rangeTo) return periods;
    return periods.filter((p) => {
      if (rangeFrom && p < rangeFrom) return false;
      if (rangeTo && p > rangeTo) return false;
      return true;
    });
  }
  const n = preset === "last3" ? 3 : preset === "last12" ? 12 : 6;
  return periods.slice(-n);
}

export function MetersPanel({ hotelId, hotelName, canManageZones }: Props) {
  const [board, setBoard] = useState<MetersBoardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mobilePeriod, setMobilePeriod] = useState<string>("");
  const [showZones, setShowZones] = useState(false);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriodDate, setNewPeriodDate] = useState(defaultPeriodDate());
  const [detail, setDetail] = useState<{
    meter: MeterRowDto;
    period: string;
    cell: MeterCellDto | null;
  } | null>(null);
  const [zoneForm, setZoneForm] = useState({ zoneName: "", meterType: "gvs" as UtilityMeterType });
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterPreset>("last6");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!hotelId) {
      setBoard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/meters?hotelId=${hotelId}`);
    if (res.ok) {
      const data = await res.json();
      setBoard(data.board ?? null);
    }
    setLoading(false);
  }, [hotelId]);

  useEffect(() => {
    load();
    try {
      const raw = localStorage.getItem(`meters-filter:${hotelId}`);
      if (raw) {
        const saved = JSON.parse(raw) as {
          periodFilter?: PeriodFilterPreset;
          rangeFrom?: string;
          rangeTo?: string;
        };
        if (saved.periodFilter) setPeriodFilter(saved.periodFilter);
        if (saved.rangeFrom) setRangeFrom(saved.rangeFrom);
        if (saved.rangeTo) setRangeTo(saved.rangeTo);
      }
    } catch {
      /* ignore */
    }
  }, [load]);

  useEffect(() => {
    if (!hotelId) return;
    try {
      localStorage.setItem(
        `meters-filter:${hotelId}`,
        JSON.stringify({ periodFilter, rangeFrom, rangeTo })
      );
    } catch {
      /* ignore */
    }
  }, [hotelId, periodFilter, rangeFrom, rangeTo]);

  const allPeriods = board?.periods ?? [];

  const visiblePeriods = useMemo(
    () => filterPeriods(allPeriods, periodFilter, rangeFrom, rangeTo),
    [allPeriods, periodFilter, rangeFrom, rangeTo]
  );

  useEffect(() => {
    if (!visiblePeriods.length) {
      setMobilePeriod("");
      return;
    }
    if (!mobilePeriod || !visiblePeriods.includes(mobilePeriod)) {
      setMobilePeriod(visiblePeriods[visiblePeriods.length - 1]);
    }
  }, [visiblePeriods, mobilePeriod]);

  const mobilePeriodIdx = visiblePeriods.indexOf(mobilePeriod);

  async function saveReading(
    meterId: string,
    period: string,
    value: number,
    transmitted: boolean,
    notes: string
  ) {
    setBusy(true);
    const res = await fetch("/api/meters/readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId, meterId, readingDate: period, value, transmitted, notes }),
    });
    const data = await res.json();
    if (res.ok && data.board) setBoard(data.board);
    setBusy(false);
    return res.ok;
  }

  async function toggleTransmitted(readingId: string, transmitted: boolean) {
    setBusy(true);
    const res = await fetch(`/api/meters/readings/${readingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transmitted }),
    });
    const data = await res.json();
    if (res.ok && data.board) setBoard(data.board);
    setBusy(false);
  }

  async function uploadFiles(readingId: string, files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setBusy(true);
    const fd = new FormData();
    list.forEach((f) => fd.append("file", f));
    const res = await fetch(`/api/meters/readings/${readingId}/attachments`, { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.board) {
      setBoard(data.board);
      if (detail?.cell?.id === readingId) {
        const meter = detail.meter;
        const period = detail.period;
        const cell = data.board.cells[meter.id]?.[period] ?? null;
        setDetail({ meter, period, cell });
      }
    }
    setBusy(false);
  }

  async function deleteAttachment(readingId: string, attachmentId: string) {
    setBusy(true);
    const res = await fetch(`/api/meters/readings/${readingId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (res.ok && data.board) {
      setBoard(data.board);
      if (detail) {
        const cell = data.board.cells[detail.meter.id]?.[detail.period] ?? null;
        setDetail({ ...detail, cell });
      }
    }
    setBusy(false);
  }

  async function addZone() {
    if (!zoneForm.zoneName.trim()) return;
    setBusy(true);
    const res = await fetch("/api/meters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hotelId, zoneName: zoneForm.zoneName.trim(), meterType: zoneForm.meterType }),
    });
    const data = await res.json();
    if (res.ok && data.board) {
      setBoard(data.board);
      setZoneForm({ zoneName: "", meterType: "gvs" });
    }
    setBusy(false);
  }

  async function deleteZone(meterId: string) {
    if (!confirm("Удалить счётчик и все его показания?")) return;
    setBusy(true);
    const res = await fetch(`/api/meters/${meterId}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok && data.board) setBoard(data.board);
    setBusy(false);
  }

  async function addPeriodColumn() {
    if (!newPeriodDate) return;
    setShowAddPeriod(false);
    if (!allPeriods.includes(newPeriodDate)) {
      setMobilePeriod(newPeriodDate);
      setPeriodFilter((f) => (f === "range" ? "last6" : f));
      setBoard((prev) =>
        prev ? { ...prev, periods: [...prev.periods, newPeriodDate].sort() } : prev
      );
    }
  }

  const emptyMeters = !board?.meters.length;

  if (loading) {
    return <p className="text-center text-[13px] text-muted-foreground py-16">Загрузка счётчиков…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-foreground">{hotelName}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Показания ГВС, ХВС и электроэнергии по зонам
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAddPeriod(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-bold hover:bg-muted"
          >
            <Plus size={14} /> Период
          </button>
          {canManageZones && (
            <button
              type="button"
              onClick={() => setShowZones(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-bold hover:bg-muted"
            >
              <Settings2 size={14} /> Зоны
            </button>
          )}
        </div>
      </div>

      {emptyMeters ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-[14px] font-bold text-foreground">Счётчики не настроены</p>
          <p className="text-[12px] text-muted-foreground mt-2 max-w-sm mx-auto">
            {canManageZones
              ? "Добавьте зоны (Душ, Туалет, Электроэнергия) в настройках."
              : "Попросите управляющего настроить зоны счётчиков."}
          </p>
          {canManageZones && (
            <button
              type="button"
              onClick={() => setShowZones(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold"
            >
              Настроить зоны
            </button>
          )}
        </div>
      ) : (
        <>
          {allPeriods.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3 md:p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-foreground shrink-0">
                  <Filter size={14} className="text-muted-foreground" />
                  Периоды
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PERIOD_FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      title={
                        opt.id === "last3"
                          ? "Последние 3 периода"
                          : opt.id === "last6"
                            ? "Последние 6 периодов"
                            : opt.id === "last12"
                              ? "Последние 12 периодов"
                              : opt.id === "all"
                                ? "Показать все периоды"
                                : "Фильтр по датам"
                      }
                      onClick={() => setPeriodFilter(opt.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        periodFilter === opt.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {visiblePeriods.length === allPeriods.length
                    ? `Все ${allPeriods.length}`
                    : `${visiblePeriods.length} из ${allPeriods.length}`}
                </span>
              </div>

              {periodFilter === "range" && (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <label className="flex-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">С</span>
                    <div className="mt-1">
                      <DatePicker
                        mode="iso"
                        value={rangeFrom}
                        onChange={setRangeFrom}
                        placeholder="Дата от"
                        max={rangeTo || undefined}
                        className="w-full [&_button]:px-3 [&_button]:py-2 [&_button]:text-[13px] [&_button]:rounded-xl"
                      />
                    </div>
                  </label>
                  <label className="flex-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">По</span>
                    <div className="mt-1">
                      <DatePicker
                        mode="iso"
                        value={rangeTo}
                        onChange={setRangeTo}
                        placeholder="Дата до"
                        min={rangeFrom || undefined}
                        className="w-full [&_button]:px-3 [&_button]:py-2 [&_button]:text-[13px] [&_button]:rounded-xl"
                      />
                    </div>
                  </label>
                  {(rangeFrom || rangeTo) && (
                    <button
                      type="button"
                      onClick={() => {
                        setRangeFrom("");
                        setRangeTo("");
                      }}
                      className="px-3 py-2 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
              )}

              {periodFilter !== "all" && allPeriods.length > visiblePeriods.length && (
                <p className="text-[11px] text-muted-foreground">
                  В таблице последние периоды. Выберите «Все» или задайте диапазон, чтобы увидеть архив.
                </p>
              )}
            </div>
          )}

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            {visiblePeriods.length > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={mobilePeriodIdx <= 0}
                    onClick={() => setMobilePeriod(visiblePeriods[mobilePeriodIdx - 1])}
                    className="p-2 rounded-lg border border-border disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="flex-1 text-center">
                    <p className="text-[13px] font-bold">{formatPeriodLabel(mobilePeriod)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {mobilePeriodIdx + 1} из {visiblePeriods.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={mobilePeriodIdx >= visiblePeriods.length - 1}
                    onClick={() => setMobilePeriod(visiblePeriods[mobilePeriodIdx + 1])}
                    className="p-2 rounded-lg border border-border disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="space-y-2">
                  {board!.meters.map((meter) => {
                    const cell = board!.cells[meter.id]?.[mobilePeriod] ?? null;
                    return (
                      <button
                        key={meter.id}
                        type="button"
                        onClick={() => setDetail({ meter, period: mobilePeriod, cell })}
                        className="w-full text-left bg-card rounded-xl border border-border p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[14px] font-bold">{meter.zoneName}</p>
                            <div className="mt-1">
                              <MeterTypeBadge type={meter.meterType} />
                            </div>
                          </div>
                          {cell ? (
                            <div className="text-right shrink-0">
                              <p className="text-[16px] font-black tabular-nums">
                                {formatMeterValue(cell.value, meter.meterType)}
                              </p>
                              {cell.delta != null && (
                                <p className="text-[11px] font-semibold text-primary">
                                  {formatMeterDelta(cell.delta)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[12px] text-muted-foreground">Нет данных</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {cell?.transmitted ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success">
                              Передано
                            </span>
                          ) : cell ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700">
                              Не передано
                            </span>
                          ) : null}
                          {cell && cell.attachmentCount > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              📷 {cell.attachmentCount}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : allPeriods.length > 0 ? (
              <p className="text-center text-[12px] text-muted-foreground py-8">
                Нет периодов в выбранном диапазоне. Измените фильтр выше.
              </p>
            ) : (
              <p className="text-center text-[12px] text-muted-foreground py-8">
                Нажмите «Период», чтобы добавить первую дату снятия показаний.
              </p>
            )}
          </div>

          {/* Desktop table */}
          {visiblePeriods.length > 0 ? (
          <div className="hidden md:block rounded-xl border border-border overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="bg-muted/60 border-b border-border">
                    <th className="sticky left-0 z-10 bg-muted/95 px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase min-w-[120px]">
                      Зона
                    </th>
                    <th className="sticky left-[120px] z-10 bg-muted/95 px-3 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase min-w-[72px] border-r border-border">
                      Тип
                    </th>
                    {visiblePeriods.map((p) => (
                      <th
                        key={p}
                        className="px-3 py-3 text-center text-[11px] font-bold text-muted-foreground uppercase min-w-[130px]"
                      >
                        {formatPeriodLabel(p)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {board!.meters.map((meter) => (
                    <tr key={meter.id} className="border-b border-border/70 hover:bg-muted/20">
                      <td className="sticky left-0 z-10 bg-card px-4 py-3 text-[13px] font-bold">
                        {meter.zoneName}
                      </td>
                      <td className="sticky left-[120px] z-10 bg-card px-3 py-3 border-r border-border">
                        <MeterTypeBadge type={meter.meterType} />
                      </td>
                      {visiblePeriods.map((p) => {
                        const cell = board!.cells[meter.id]?.[p] ?? null;
                        return (
                          <td key={p} className="px-2 py-2 align-top">
                            <button
                              type="button"
                              onClick={() => setDetail({ meter, period: p, cell })}
                              className="w-full min-h-[88px] rounded-lg border border-border/80 hover:border-primary/40 hover:bg-muted/30 p-2 text-left transition-colors"
                            >
                              {cell ? (
                                <>
                                  <p className="text-[14px] font-black tabular-nums leading-tight">
                                    {formatMeterValue(cell.value, meter.meterType)}
                                  </p>
                                  {cell.delta != null && (
                                    <p className="text-[11px] font-semibold text-primary mt-0.5">
                                      {formatMeterDelta(cell.delta)}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                        cell.transmitted
                                          ? "bg-success/10 text-success"
                                          : "bg-amber-500/10 text-amber-700"
                                      }`}
                                    >
                                      {cell.transmitted ? "Передано" : "Не передано"}
                                    </span>
                                    {cell.attachmentCount > 0 && (
                                      <span className="text-[9px] text-muted-foreground">
                                        📷{cell.attachmentCount}
                                      </span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">+ внести</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          ) : allPeriods.length > 0 ? (
            <p className="hidden md:block text-center text-[12px] text-muted-foreground py-8">
              Нет периодов в выбранном диапазоне. Измените фильтр.
            </p>
          ) : null}
        </>
      )}

      {/* Detail sheet */}
      {detail && (
        <DetailSheet
          detail={detail}
          busy={busy}
          onClose={() => setDetail(null)}
          onSave={async (value, transmitted, notes) => {
            const ok = await saveReading(detail.meter.id, detail.period, value, transmitted, notes);
            if (ok) {
              const res = await fetch(`/api/meters?hotelId=${hotelId}`);
              if (res.ok) {
                const data = await res.json();
                const b = data.board as MetersBoardDto;
                setBoard(b);
                setDetail({
                  meter: detail.meter,
                  period: detail.period,
                  cell: b.cells[detail.meter.id]?.[detail.period] ?? null,
                });
              }
            }
          }}
          onToggleTransmitted={(id, t) => toggleTransmitted(id, t)}
          onUpload={(files) => detail.cell?.id && uploadFiles(detail.cell.id, files)}
          onDeleteAttachment={(aid) => detail.cell?.id && deleteAttachment(detail.cell.id, aid)}
          fileRef={fileRef}
          folderRef={folderRef}
        />
      )}

      {/* Add period */}
      {showAddPeriod && (
        <Modal title="Новый период" onClose={() => setShowAddPeriod(false)}>
          <label className="block">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Дата снятия показаний</span>
            <div className="mt-1">
              <DatePicker
                mode="iso"
                value={newPeriodDate}
                onChange={setNewPeriodDate}
                placeholder="Выберите дату"
                className="w-full [&_button]:px-3 [&_button]:py-2 [&_button]:text-[13px] [&_button]:rounded-xl"
              />
            </div>
          </label>
          <p className="text-[11px] text-muted-foreground mt-2">
            Добавится колонка/период. Показания вносятся по каждому счётчику отдельно.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={() => setShowAddPeriod(false)} className="px-3 py-2 text-[12px] font-bold text-muted-foreground">
              Отмена
            </button>
            <button type="button" onClick={addPeriodColumn} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold">
              Добавить
            </button>
          </div>
        </Modal>
      )}

      {/* Zones settings */}
      {showZones && canManageZones && (
        <Modal title="Настройка зон" onClose={() => setShowZones(false)} wide>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-end">
              <label className="flex-1 min-w-[140px]">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Зона</span>
                <input
                  value={zoneForm.zoneName}
                  onChange={(e) => setZoneForm((f) => ({ ...f, zoneName: e.target.value }))}
                  placeholder="Душ, Туалет…"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px]"
                />
              </label>
              <label className="min-w-[160px]">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Тип</span>
                <select
                  value={zoneForm.meterType}
                  onChange={(e) => setZoneForm((f) => ({ ...f, meterType: e.target.value as UtilityMeterType }))}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] bg-background"
                >
                  {METER_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={addZone}
                disabled={busy || !zoneForm.zoneName.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-bold disabled:opacity-50"
              >
                Добавить
              </button>
            </div>

            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {(board?.meters ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[13px] font-bold truncate">{m.zoneName}</span>
                    <MeterTypeBadge type={m.meterType} />
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteZone(m.id)}
                    className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div
        className={`bg-card rounded-t-2xl sm:rounded-xl border border-border w-full shadow-xl max-h-[92vh] overflow-auto ${
          wide ? "sm:max-w-lg" : "sm:max-w-md"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <h3 className="text-[14px] font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function DetailSheet({
  detail,
  busy,
  onClose,
  onSave,
  onToggleTransmitted,
  onUpload,
  onDeleteAttachment,
  fileRef,
  folderRef,
}: {
  detail: { meter: MeterRowDto; period: string; cell: MeterCellDto | null };
  busy: boolean;
  onClose: () => void;
  onSave: (value: number, transmitted: boolean, notes: string) => Promise<void>;
  onToggleTransmitted: (id: string, t: boolean) => void;
  onUpload: (files: FileList | File[]) => void;
  onDeleteAttachment: (id: string) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  folderRef: React.RefObject<HTMLInputElement>;
}) {
  const { meter, period, cell } = detail;
  const [value, setValue] = useState(cell ? String(cell.value) : "");
  const [transmitted, setTransmitted] = useState(cell?.transmitted ?? false);
  const [notes, setNotes] = useState(cell?.notes ?? "");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    setValue(cell ? String(cell.value) : "");
    setTransmitted(cell?.transmitted ?? false);
    setNotes(cell?.notes ?? "");
  }, [cell]);

  const cfg = METER_TYPE_CONFIG[meter.meterType];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-card w-full sm:max-w-md sm:rounded-xl border border-border shadow-xl max-h-[94vh] overflow-auto rounded-t-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h3 className="text-[14px] font-bold">{meter.zoneName}</h3>
            <p className="text-[11px] text-muted-foreground">
              {formatPeriodLabel(period)} · {cfg.label}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {cell?.delta != null && (
            <p className="text-[12px] text-primary font-semibold">
              Расход за период: {formatMeterDelta(cell.delta).replace(/[()]/g, "")} {cfg.unit}
            </p>
          )}

          <label className="block">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">
              Показание, {cfg.unit}
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2.5 text-[18px] font-black tabular-nums"
            />
          </label>

          <button
            type="button"
            disabled={busy || !cell?.id}
            onClick={() => {
              if (cell?.id) {
                const next = !transmitted;
                setTransmitted(next);
                onToggleTransmitted(cell.id, next);
              } else {
                setTransmitted((t) => !t);
              }
            }}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border text-[12px] font-bold transition-colors ${
              transmitted
                ? "bg-success/10 text-success border-success/30"
                : "bg-amber-500/10 text-amber-700 border-amber-500/30"
            }`}
          >
            <Check size={14} />
            {transmitted ? "Показания переданы" : "Отметить: передали показания"}
          </button>

          <label className="block">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Комментарий</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-[13px] resize-none"
            />
          </label>

          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Фото накладных</span>
            <div className="flex flex-wrap gap-2 mt-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && onUpload(e.target.files)}
              />
              <input
                ref={folderRef}
                type="file"
                // @ts-expect-error webkitdirectory non-standard
                webkitdirectory=""
                multiple
                className="hidden"
                onChange={(e) => e.target.files && onUpload(e.target.files)}
              />
              <button
                type="button"
                disabled={busy || !cell?.id}
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-bold hover:bg-muted disabled:opacity-50"
              >
                <Camera size={14} /> Фото
              </button>
              <button
                type="button"
                disabled={busy || !cell?.id}
                onClick={() => folderRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-[12px] font-bold hover:bg-muted disabled:opacity-50"
              >
                <FolderUp size={14} /> Папка
              </button>
            </div>
            {!cell?.id && (
              <p className="text-[11px] text-muted-foreground mt-1">Сначала сохраните показание</p>
            )}
            {cell && cell.attachments.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {cell.attachments.map((a) => (
                  <div key={a.id} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-muted">
                    {a.mimeType.startsWith("image/") ? (
                      <button type="button" onClick={() => setPreview(a.filePath)} className="w-full h-full">
                        <img src={a.filePath} alt={a.fileName} className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <a href={a.filePath} target="_blank" rel="noreferrer" className="flex items-center justify-center h-full text-[10px] p-1 text-center font-bold text-primary">
                        {a.fileName}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteAttachment(a.id)}
                      className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={busy || !value.trim()}
            onClick={() => onSave(Number(value), transmitted, notes)}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-bold disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Сохранить"}
          </button>
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <img src={preview} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
