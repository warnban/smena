"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload, Eye, X, FileImage, RotateCcw } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { Icon } from "@/components/icon";
import { useApp } from "@/components/providers/app-data";
import { money, fmtDate } from "@/lib/format";

type RefundRow = {
  id: string;
  guestName: string;
  nights: number;
  amount: number;
  paymentMethod: string;
  note: string;
  documentPath: string;
  documentName: string;
  createdAt: string;
  roomId: string;
};

export default function RefundsPage() {
  const { hotelId, hotels, rooms, pmConfig, loading } = useApp();
  const activeHotelId = hotelId === "all" ? (hotels[0]?.id ?? "") : hotelId;

  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [uploadBusy, setUploadBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<RefundRow | null>(null);

  const load = useCallback(async () => {
    if (!activeHotelId) {
      setRefunds([]);
      setFetching(false);
      return;
    }
    setFetching(true);
    const res = await fetch(`/api/refunds?hotelId=${activeHotelId}`);
    if (res.ok) {
      const data = await res.json();
      setRefunds(data.refunds ?? []);
    }
    setFetching(false);
  }, [activeHotelId]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadDoc(refundId: string, file: File) {
    setUploadBusy(refundId);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/refunds/${refundId}/document`, { method: "POST", body: fd });
    await load();
    setUploadBusy(null);
  }

  if (loading) {
    return (
      <>
        <TopBar title="Возвраты" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Возвраты" subtitle={hotelId === "all" ? "Все отели" : undefined} />
      <div className="flex-1 overflow-auto p-4 md:p-6 min-w-0">
        {hotelId === "all" && (
          <p className="text-[12px] text-muted-foreground mb-4">
            Показаны возвраты первого отеля. Выберите отель в шапке для точной фильтрации.
          </p>
        )}

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-muted/50">
            <RotateCcw size={14} className="text-muted-foreground" />
            <h2 className="text-[13px] font-bold text-foreground">История возвратов</h2>
            <span className="text-[11px] text-muted-foreground ml-auto">{refunds.length} записей</span>
          </div>

          {fetching ? (
            <p className="text-center text-[13px] text-muted-foreground py-12">Загрузка…</p>
          ) : refunds.length === 0 ? (
            <p className="text-center text-[13px] text-muted-foreground py-12">Возвратов пока нет</p>
          ) : (
            <table className="w-full">
              <thead className="bg-muted border-b border-border">
                <tr>
                  {["Дата", "Гость", "Номер", "Ночей", "Сумма", "Способ", "Комментарий", "Документ"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-muted-foreground uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => {
                  const room = rooms.find((rm) => rm.id === r.roomId);
                  const pm = pmConfig[r.paymentMethod];
                  return (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30 text-[12px]">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {fmtDate(new Date(r.createdAt), true)}{" "}
                        {new Date(r.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">{r.guestName}</td>
                      <td className="px-4 py-3">№{room?.number ?? "—"}</td>
                      <td className="px-4 py-3 font-bold">{r.nights}</td>
                      <td className="px-4 py-3 font-black text-destructive">−{money(r.amount)}</td>
                      <td className="px-4 py-3">
                        {pm ? (
                          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: pm.color }}>
                            <Icon name={pm.icon} size={12} /> {pm.label}
                          </span>
                        ) : (
                          r.paymentMethod
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate" title={r.note}>{r.note || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {r.documentPath ? (
                            <button
                              type="button"
                              onClick={() => setPreview(r)}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                            >
                              <Eye size={12} /> {r.documentName || "Документ"}
                            </button>
                          ) : null}
                          <label className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer">
                            <Upload size={12} />
                            {uploadBusy === r.id ? "…" : r.documentPath ? "Заменить" : "Загрузить"}
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              className="hidden"
                              disabled={uploadBusy === r.id}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) uploadDoc(r.id, f);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {preview?.documentPath && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPreview(null)}>
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-foreground">{preview.guestName}</div>
                <div className="text-[11px] text-muted-foreground">{preview.documentName}</div>
              </div>
              <button onClick={() => setPreview(null)} className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/30 min-h-[300px]">
              {/\.(jpg|jpeg|png|webp)$/i.test(preview.documentPath) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.documentPath} alt={preview.documentName} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
              ) : (
                <div className="text-center">
                  <FileImage size={48} className="mx-auto mb-3 text-muted-foreground" />
                  <a href={preview.documentPath} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-primary hover:underline">
                    Открыть файл
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
