"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle, KeyRound, RefreshCw } from "lucide-react";

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  roleLabel: string;
  seatName: string | null;
  isBlocked: boolean;
  blockedAt: string | null;
  devPasswordPlain: string | null;
  createdAt: string;
  staffName: string | null;
  staffPosition: string | null;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PlatformUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/platform/users");
    const body = await res.json();
    if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Не удалось загрузить пользователей");
    const rows = body.users;
    if (!Array.isArray(rows)) throw new Error("Неверный формат ответа");
    setUsers(rows);
  }, []);

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, [load]);

  async function toggleBlock(user: UserRow) {
    setBusyId(user.id);
    setError("");
    try {
      const res = await fetch(`/api/platform/users/${user.id}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked: !user.isBlocked }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка блокировки");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  async function setPassword(userId: string) {
    const password = passwordDraft[userId]?.trim();
    if (!password || password.length < 6) {
      setError("Пароль минимум 6 символов");
      return;
    }
    setBusyId(userId);
    setError("");
    try {
      const res = await fetch(`/api/platform/users/${userId}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Ошибка смены пароля");
      }
      setPasswordDraft((d) => ({ ...d, [userId]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Пользователи</h1>
          <p className="text-sm text-slate-500 mt-1">
            Логины, роли, пароли (видны после регистрации или сброса) и блокировка
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load().catch((e: Error) => setError(e.message))}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-slate-700 text-slate-400 hover:text-white"
        >
          <RefreshCw size={14} /> Обновить
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-800">
              <th className="px-4 py-3 font-bold">Email / имя</th>
              <th className="px-3 py-3 font-bold">Роль</th>
              <th className="px-3 py-3 font-bold">Сеть</th>
              <th className="px-3 py-3 font-bold">Пароль</th>
              <th className="px-3 py-3 font-bold">Регистрация</th>
              <th className="px-4 py-3 font-bold text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-slate-800/50 ${u.isBlocked ? "opacity-60" : ""}`}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-200">{u.email}</p>
                  <p className="text-xs text-slate-500">{u.name}</p>
                  {u.isBlocked && (
                    <p className="text-[11px] text-red-400 mt-0.5">
                      Заблокирован {u.blockedAt ? fmtDate(u.blockedAt) : ""}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">{u.roleLabel}</span>
                  {u.staffPosition && <p className="text-[11px] text-slate-500 mt-1">{u.staffPosition}</p>}
                </td>
                <td className="px-3 py-3 text-slate-400">{u.seatName ?? "—"}</td>
                <td className="px-3 py-3">
                  {u.devPasswordPlain ? (
                    <code className="text-xs bg-slate-950 px-2 py-1 rounded text-amber-300">{u.devPasswordPlain}</code>
                  ) : (
                    <span className="text-xs text-slate-600">не сохранён</span>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <input
                      type="text"
                      placeholder="Новый пароль"
                      value={passwordDraft[u.id] ?? ""}
                      onChange={(e) => setPasswordDraft((d) => ({ ...d, [u.id]: e.target.value }))}
                      className="w-28 px-2 py-1 text-[11px] rounded border border-slate-700 bg-slate-950 text-white"
                    />
                    <button
                      type="button"
                      disabled={busyId === u.id}
                      onClick={() => void setPassword(u.id)}
                      className="p-1 rounded text-slate-400 hover:text-amber-400 disabled:opacity-50"
                      title="Задать пароль"
                    >
                      <KeyRound size={14} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={busyId === u.id}
                    onClick={() => void toggleBlock(u)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-50 ${
                      u.isBlocked
                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                        : "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    }`}
                  >
                    {u.isBlocked ? (
                      <>
                        <CheckCircle size={14} /> Разблокировать
                      </>
                    ) : (
                      <>
                        <Ban size={14} /> Заблокировать
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {!users.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {error ? "" : "Загрузка…"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
