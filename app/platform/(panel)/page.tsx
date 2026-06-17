"use client";

import { useEffect, useState } from "react";
import { Building2, Users, Hotel, Ban, TrendingUp, CalendarCheck, type LucideIcon } from "lucide-react";
import { money } from "@/lib/format";

type Overview = {
  seatsCount: number;
  hotelsCount: number;
  usersCount: number;
  blockedCount: number;
  guestsCount: number;
  bookingsCount: number;
  totalRevenue: number;
};

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: string;
}) {
  return (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</p>
        <Icon size={18} className={accent} />
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  );
}

export default function PlatformOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/platform/overview")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Не удалось загрузить обзор");
        if (!body.overview) throw new Error("Неверный формат ответа");
        return body.overview as Overview;
      })
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Обзор платформы</h1>
        <p className="text-sm text-slate-500 mt-1">Все сети, отели и пользователи CRM</p>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {!data ? (
        <p className="text-slate-500 text-sm">Загрузка…</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <StatCard label="Сети (Seat)" value={data.seatsCount} icon={Building2} accent="text-violet-400" />
          <StatCard label="Отели" value={data.hotelsCount} icon={Hotel} accent="text-blue-400" />
          <StatCard label="Пользователи" value={data.usersCount} icon={Users} accent="text-emerald-400" />
          <StatCard label="Заблокировано" value={data.blockedCount} icon={Ban} accent="text-red-400" />
          <StatCard label="Гости" value={data.guestsCount} icon={Users} accent="text-amber-400" />
          <StatCard label="Активные брони" value={data.bookingsCount} icon={CalendarCheck} accent="text-cyan-400" />
          <StatCard label="Выручка (всего)" value={money(data.totalRevenue)} icon={TrendingUp} accent="text-green-400" />
        </div>
      )}
    </div>
  );
}
