import type { Booking, Channel } from "@/lib/types";
import { fmtDateRu, money, startOfDay } from "@/lib/format";
import { isOtaBooking } from "@/lib/ota";

export type OtaReportLine = {
  entryDate: Date;
  guestName: string;
  stayFrom: Date;
  stayTo: Date;
  amount: number;
};

export type OtaReportSection = {
  channelId: string;
  channelName: string;
  color: string;
  lines: OtaReportLine[];
  total: number;
};

export function buildOtaCheckoutReport(
  bookings: Booking[],
  channels: Channel[],
  hotelId: string,
  dateFrom: Date,
  dateTo: Date
): OtaReportSection[] {
  const from = startOfDay(dateFrom);
  const to = startOfDay(dateTo);
  to.setHours(23, 59, 59, 999);

  const departed = bookings.filter((b) => {
    if (b.hotelId !== hotelId || b.status !== "checkedout") return false;
    if (!isOtaBooking(b.source, b.channelId)) return false;
    const entry = b.checkedOutAt ? new Date(b.checkedOutAt) : new Date(b.checkOut);
    return entry >= from && entry <= to;
  });

  const byChannel = new Map<string, OtaReportLine[]>();

  for (const b of departed) {
    const chId =
      b.channelId ??
      channels.find((c) => c.hotelId === hotelId && c.code === b.source)?.id ??
      "unknown";
    const line: OtaReportLine = {
      entryDate: b.checkedOutAt ? new Date(b.checkedOutAt) : new Date(b.checkOut),
      guestName: b.guestName,
      stayFrom: new Date(b.checkIn),
      stayTo: new Date(b.checkOut),
      amount: b.amount,
    };
    const list = byChannel.get(chId) ?? [];
    list.push(line);
    byChannel.set(chId, list);
  }

  const sections: OtaReportSection[] = [];

  for (const ch of channels.filter((c) => c.hotelId === hotelId)) {
    const lines = (byChannel.get(ch.id) ?? []).sort(
      (a, b) => a.entryDate.getTime() - b.entryDate.getTime() || a.guestName.localeCompare(b.guestName, "ru")
    );
    if (!lines.length) continue;
    sections.push({
      channelId: ch.id,
      channelName: ch.name,
      color: ch.color,
      lines,
      total: lines.reduce((s, l) => s + l.amount, 0),
    });
    byChannel.delete(ch.id);
  }

  const unknown = byChannel.get("unknown");
  if (unknown?.length) {
    sections.push({
      channelId: "unknown",
      channelName: "Прочие OTA",
      color: "#64748B",
      lines: unknown.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime()),
      total: unknown.reduce((s, l) => s + l.amount, 0),
    });
  }

  return sections;
}

export function printOtaReport(
  sections: OtaReportSection[],
  hotelName: string,
  dateFrom: Date,
  dateTo: Date
) {
  const period = `${fmtDateRu(dateFrom)} — ${fmtDateRu(dateTo)}`;
  const grandTotal = sections.reduce((s, sec) => s + sec.total, 0);

  const body = sections.map((sec) => {
    const byDate = new Map<string, OtaReportLine[]>();
    for (const line of sec.lines) {
      const key = fmtDateRu(line.entryDate);
      const arr = byDate.get(key) ?? [];
      arr.push(line);
      byDate.set(key, arr);
    }

    const rows = Array.from(byDate.entries())
      .map(([dateKey, lines]) =>
        lines
          .map((line, idx) => {
            const stay = `${fmtDateRu(line.stayFrom)} — ${fmtDateRu(line.stayTo)}`;
            const dateCell = idx === 0 ? dateKey : "";
            return `<tr>
              <td style="padding:6px 10px;border:1px solid #ddd;vertical-align:top;white-space:nowrap">${dateCell}</td>
              <td style="padding:6px 10px;border:1px solid #ddd">${line.guestName}</td>
              <td style="padding:6px 10px;border:1px solid #ddd;white-space:nowrap">${stay}</td>
              <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;font-weight:600">${money(line.amount)}</td>
            </tr>`;
          })
          .join("")
      )
      .join("");

    return `
      <h3 style="margin:20px 0 8px;font-size:14px;color:${sec.color}">${sec.channelName}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px">
        <thead><tr style="background:#f1f5f9">
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Дата</th>
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left">ФИО</th>
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left">Даты проживания</th>
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:right">Сумма</th>
        </tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#f8fafc">
          <td colspan="3" style="padding:8px 10px;border:1px solid #ddd;text-align:right;font-weight:700">Итого по каналу:</td>
          <td style="padding:8px 10px;border:1px solid #ddd;text-align:right;font-weight:700">${money(sec.total)}</td>
        </tr></tfoot>
      </table>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Отчёт OTA ${period}</title></head>
<body style="font-family:system-ui,sans-serif;padding:24px;max-width:900px;margin:0 auto">
<h1 style="font-size:18px;margin:0 0 4px">Отчёт по каналам OTA — выезды</h1>
<p style="margin:0 0 16px;color:#64748b;font-size:13px">${hotelName} · период ${period}</p>
${body || "<p>Нет выехавших гостей за период</p>"}
<div style="margin-top:24px;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:14px">
<strong>Общая сумма выручки:</strong> ${money(grandTotal)}
</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
