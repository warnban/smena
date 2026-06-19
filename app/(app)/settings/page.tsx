"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Building2, Copy, Check, Link2, X, BedDouble } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { useApp } from "@/components/providers/app-data";
import type { Hotel, StaffMember, UserRole } from "@/lib/types";
import { PM_COLOR_PRESETS, colorToBg } from "@/lib/color-utils";
import { HotelDiscountRulesEditor } from "@/components/settings/hotel-discount-rules-editor";
import { SalarySettingsEditor } from "@/components/settings/salary-settings-editor";
import { NetworkFaqEditor } from "@/components/settings/network-faq-editor";
import { MigrationPanel } from "@/components/settings/migration-panel";
import { Select } from "@/components/ui/select";

const ROLE_LABELS: Record<string, string> = {
  owner: "Владелец",
  manager: "Управляющий",
  admin: "Администратор",
  staff: "Горничная",
};

interface PendingInvite {
  id: string;
  token: string;
  url?: string;
  role: UserRole;
  position: string;
  hotelIds: string[];
  email: string | null;
  expiresAt: string;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <h2 className="text-[15px] font-black text-foreground">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { hotels, staff, session, loading, canManageSettings, refresh, paymentMethods, bookingSources, services, expenses, roomCategories } = useApp();
  const [sTab, setSTab] = useState<"hotel" | "staff" | "finance" | "system">("hotel");
  const [selHotel, setSelHotel] = useState<Hotel | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [copied, setCopied] = useState("");

  const [showAddHotel, setShowAddHotel] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [inviteUrl, setInviteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isOwner = session?.role === "owner";
  const inviteRoles = useMemo(
    () => (isOwner ? (["manager", "admin", "staff"] as UserRole[]) : (["admin", "staff"] as UserRole[])),
    [isOwner]
  );

  const loadInvites = useCallback(async () => {
    if (!canManageSettings) return;
    const res = await fetch("/api/staff/invites");
    if (res.ok) {
      const data = await res.json();
      setInvites(data.invites ?? []);
    }
  }, [canManageSettings]);

  useEffect(() => {
    if (hotels.length && !selHotel) setSelHotel(hotels[0]);
  }, [hotels, selHotel]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  if (loading) {
    return (
      <>
        <TopBar title="Настройки" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Загрузка…</div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Настройки" subtitle={canManageSettings ? "Управление сетью" : "Просмотр"} />
      <div className="bg-card px-4 md:px-6 flex gap-1 border-b border-border overflow-x-auto custom-scrollbar flex-shrink-0">
        {(["hotel", "staff", "finance", "system"] as const).map((t, i) => (
          <button key={t} onClick={() => setSTab(t)} className={`px-4 py-3 text-[13px] font-semibold transition-all whitespace-nowrap flex-shrink-0 ${sTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {["Отели", "Сотрудники", "Финансы", "Система"][i]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6 min-w-0">
        {sTab === "hotel" && (
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="w-full lg:w-56 flex-shrink-0 space-y-2">
              {hotels.map((h) => (
                <button key={h.id} onClick={() => setSelHotel(h)} className={`w-full text-left px-3.5 py-3 rounded-xl transition-all border ${selHotel?.id === h.id ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted"}`}>
                  <div className="text-[13px] font-bold text-foreground">{h.name}</div>
                  <div className="text-[11px] text-muted-foreground">{h.city} · {h.stars}★</div>
                </button>
              ))}
              {canManageSettings && (
                <button onClick={() => setShowAddHotel(true)} className="w-full flex items-center gap-2 px-3.5 py-3 rounded-xl text-[12px] font-bold text-primary border border-dashed border-primary/40 hover:bg-accent">
                  <Plus size={13} />Добавить отель
                </button>
              )}
              {!hotels.length && (
                <p className="text-[12px] text-muted-foreground px-1">Нет отелей. Добавьте первый объект.</p>
              )}
            </div>
            {selHotel ? (
              <div className="flex-1 space-y-5">
                <HotelEditor hotel={selHotel} canEdit={canManageSettings} onSaved={refresh} />
                <HotelDiscountRulesEditor
                  hotelId={selHotel.id}
                  canEdit={canManageSettings}
                  paymentMethods={paymentMethods}
                  onSaved={refresh}
                />
                <RoomCategoriesSettings canEdit={canManageSettings} categories={roomCategories} onRefresh={refresh} />
              </div>
            ) : canManageSettings ? (
              <RoomCategoriesSettings canEdit={canManageSettings} categories={roomCategories} onRefresh={refresh} />
            ) : null}
          </div>
        )}

        {sTab === "staff" && (
          <div className="max-w-4xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-foreground">Сотрудники</h3>
              {canManageSettings && (
                <button onClick={() => { setInviteUrl(""); setShowInvite(true); setError(""); }} className="flex items-center gap-1.5 px-3.5 py-1.5 text-white text-[12px] font-bold rounded-lg" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
                  <Link2 size={13} />Пригласить
                </button>
              )}
            </div>

            {canManageSettings && invites.length > 0 && (
              <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 space-y-2">
                <p className="text-[12px] font-bold text-[#92400E]">Активные приглашения</p>
                {invites.map((inv) => {
                  const url =
                    inv.url ||
                    (typeof window !== "undefined" && !window.location.origin.includes("0.0.0.0")
                      ? `${window.location.origin}/register/staff?token=${inv.token}`
                      : `/register/staff?token=${inv.token}`);
                  return (
                    <div key={inv.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="font-semibold text-foreground">{ROLE_LABELS[inv.role]}</span>
                      <span className="text-muted-foreground">→ {inv.hotelIds.map((id) => hotels.find((h) => h.id === id)?.city).filter(Boolean).join(", ")}</span>
                      <button onClick={() => copyText(url, inv.id)} className="ml-auto flex items-center gap-1 text-primary font-bold hover:underline">
                        {copied === inv.id ? <Check size={12} /> : <Copy size={12} />}
                        {copied === inv.id ? "Скопировано" : "Копировать ссылку"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <table className="w-full">
                <thead className="bg-muted border-b-2 border-border">
                  <tr>{["Сотрудник", "Должность", "Роль", "Отели", "Аккаунт", ""].map((h) => <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-muted-foreground uppercase">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id} className="hover:bg-muted/50 border-b border-border/40">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: "linear-gradient(135deg,#3B82F6,#6366F1)" }}>{s.initials}</div>
                          <span className="text-[13px] font-semibold text-foreground">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-foreground/80">{s.position}</td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${s.role === "owner" ? "bg-[#FEF3C7] text-[#D97706]" : s.role === "manager" ? "bg-success/10 text-success" : "bg-accent text-primary"}`}>
                          {ROLE_LABELS[s.role]}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {s.role === "owner"
                            ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Все отели</span>
                            : s.hotelIds.map((hid) => { const h = hotels.find((x) => x.id === hid); return h ? <span key={hid} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{h.city}</span> : null; })}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[11px]">
                        {s.hasAccount ? <span className="text-success font-bold">✓ Есть</span> : <span className="text-muted-foreground">Нет</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {canManageSettings && s.role !== "owner" && (
                          <button onClick={() => setEditStaff(s)} className="text-[12px] font-bold text-primary hover:underline">Изменить</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sTab === "finance" && (
          <FinanceSettings
            canEdit={canManageSettings}
            hotels={hotels}
            paymentMethods={paymentMethods}
            bookingSources={bookingSources}
            services={services}
            expenses={expenses}
            onRefresh={refresh}
          />
        )}

        {sTab === "system" && (
          <div className="space-y-8">
            <MigrationPanel canEdit={session?.role === "owner"} />
            <div className="border-t border-border pt-6">
              <NetworkFaqEditor canEdit={canManageSettings} />
            </div>
          </div>
        )}
      </div>

      {showAddHotel && (
        <AddHotelModal
          onClose={() => setShowAddHotel(false)}
          onCreated={async (h) => { await refresh(); setSelHotel(h); setShowAddHotel(false); }}
        />
      )}

      {showInvite && (
        <InviteStaffModal
          hotels={hotels}
          roles={inviteRoles}
          inviteUrl={inviteUrl}
          error={error}
          busy={busy}
          onClose={() => setShowInvite(false)}
          onSubmit={async (payload) => {
            setBusy(true);
            setError("");
            try {
              const res = await fetch("/api/staff/invites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const data = await res.json();
              if (!res.ok) { setError(data.error || "Ошибка"); return; }
              setInviteUrl(data.url);
              await loadInvites();
            } finally {
              setBusy(false);
            }
          }}
          onCopy={() => inviteUrl && copyText(inviteUrl, "new-invite")}
          copied={copied === "new-invite"}
        />
      )}

      {editStaff && (
        <EditStaffModal
          member={editStaff}
          hotels={hotels}
          roles={inviteRoles}
          onClose={() => setEditStaff(null)}
          onSaved={async () => { await refresh(); setEditStaff(null); }}
        />
      )}
    </>
  );
}

function RoomCategoriesSettings({
  canEdit,
  categories,
  onRefresh,
}: {
  canEdit: boolean;
  categories: import("@/lib/types").RoomCategoryDef[];
  onRefresh: () => Promise<void>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [newCode, setNewCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addCategory() {
    if (!newLabel.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/room-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim(), code: newCode.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || "Ошибка");
    else {
      setNewLabel("");
      setNewCode("");
      await onRefresh();
    }
    setBusy(false);
  }

  async function removeCategory(id: string) {
    if (!confirm("Удалить категорию?")) return;
    const res = await fetch(`/api/room-categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error || "Не удалось удалить");
    else await onRefresh();
  }

  const active = categories.filter((c) => c.active);

  return (
    <div className="bg-card rounded-xl p-5 border border-border space-y-4">
      <div className="flex items-center gap-2">
        <BedDouble size={16} className="text-primary" />
        <div>
          <h3 className="text-[14px] font-bold text-foreground">Категории номеров</h3>
          <p className="text-[11px] text-muted-foreground">Общие для всей сети · используются в номерном фонде</p>
        </div>
      </div>
      <div className="space-y-2">
        {active.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-muted/40">
            <div>
              <span className="text-[13px] font-semibold text-foreground">{c.label}</span>
              <span className="text-[10px] text-muted-foreground font-mono ml-2">{c.code}</span>
            </div>
            {canEdit && (
              <button onClick={() => removeCategory(c.id)} className="text-[11px] font-bold text-destructive hover:underline">Удалить</button>
            )}
          </div>
        ))}
        {!active.length && <p className="text-[12px] text-muted-foreground">Нет категорий</p>}
      </div>
      {canEdit && (
        <div className="space-y-2 pt-1">
          <div className="flex gap-2">
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Название (напр. Люкс)" className="flex-1 px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none" />
            <input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Код (необяз.)" className="w-32 px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none" />
          </div>
          {error && <p className="text-[11px] text-destructive font-semibold">{error}</p>}
          <button onClick={addCategory} disabled={busy} className="w-full py-2 text-white text-[12px] font-bold rounded-xl bg-primary hover:opacity-90 disabled:opacity-50">Добавить категорию</button>
        </div>
      )}
      {!canEdit && <span className="text-[11px] text-muted-foreground">Только просмотр</span>}
    </div>
  );
}

function FinanceSettings({
  canEdit,
  hotels,
  paymentMethods,
  bookingSources,
  services,
  expenses,
  onRefresh,
}: {
  canEdit: boolean;
  hotels: Hotel[];
  paymentMethods: import("@/lib/types").PaymentMethodDef[];
  bookingSources: import("@/lib/types").BookingSourceDef[];
  services: import("@/lib/types").ServiceItem[];
  expenses: import("@/lib/types").ServiceItem[];
  onRefresh: () => Promise<void>;
}) {
  const [newPmLabel, setNewPmLabel] = useState("");
  const [newPmCode, setNewPmCode] = useState("");
  const [newPmColor, setNewPmColor] = useState(PM_COLOR_PRESETS[0].color);
  const [newSourceLabel, setNewSourceLabel] = useState("");
  const [newSourceCode, setNewSourceCode] = useState("");
  const [newSourceColor, setNewSourceColor] = useState(PM_COLOR_PRESETS[2].color);
  const [editSourceId, setEditSourceId] = useState<string | null>(null);
  const [editSourceLabel, setEditSourceLabel] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemKind, setNewItemKind] = useState<"service" | "expense">("service");
  const [busy, setBusy] = useState(false);

  async function addPaymentMethod() {
    if (!newPmLabel.trim()) return;
    setBusy(true);
    await fetch("/api/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newPmLabel.trim(),
        code: newPmCode.trim() || newPmLabel.trim().toLowerCase().replace(/\s+/g, "_"),
        color: newPmColor,
        bg: colorToBg(newPmColor),
      }),
    });
    setNewPmLabel("");
    setNewPmCode("");
    await onRefresh();
    setBusy(false);
  }

  async function removePaymentMethod(id: string) {
    if (!confirm("Деактивировать способ оплаты?")) return;
    await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  async function addBookingSource() {
    if (!newSourceLabel.trim()) return;
    setBusy(true);
    await fetch("/api/booking-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newSourceLabel.trim(),
        code: newSourceCode.trim() || newSourceLabel.trim().toLowerCase().replace(/\s+/g, "_"),
        color: newSourceColor,
        bg: colorToBg(newSourceColor),
      }),
    });
    setNewSourceLabel("");
    setNewSourceCode("");
    await onRefresh();
    setBusy(false);
  }

  async function removeBookingSource(id: string) {
    if (!confirm("Удалить источник бронирования?")) return;
    await fetch(`/api/booking-sources/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  async function saveBookingSourceEdit(id: string) {
    if (!editSourceLabel.trim()) return;
    setBusy(true);
    await fetch(`/api/booking-sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editSourceLabel.trim() }),
    });
    setEditSourceId(null);
    setEditSourceLabel("");
    await onRefresh();
    setBusy(false);
  }

  async function addCatalogItem() {
    if (!newItemName.trim()) return;
    setBusy(true);
    await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newItemName.trim(), price: Number(newItemPrice) || 0, kind: newItemKind, category: "extra" }),
    });
    setNewItemName("");
    setNewItemPrice("");
    await onRefresh();
    setBusy(false);
  }

  async function removeCatalogItem(id: string) {
    if (!confirm("Удалить позицию?")) return;
    await fetch(`/api/catalog/${id}`, { method: "DELETE" });
    await onRefresh();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <SalarySettingsEditor hotels={hotels} canEdit={canEdit} />

      <div className="bg-card rounded-xl p-5 border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-foreground">Способы оплаты</h3>
          {!canEdit && <span className="text-[11px] text-muted-foreground">Только просмотр</span>}
        </div>
        <div className="space-y-2">
          {paymentMethods.filter((m) => m.active).map((m) => (
            <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: m.color }} />
                <span className="text-[13px] font-semibold text-foreground">{m.label}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{m.code}</span>
              </div>
              {canEdit && (
                <button onClick={() => removePaymentMethod(m.id)} className="text-[11px] font-bold text-destructive hover:underline">Удалить</button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <input value={newPmLabel} onChange={(e) => setNewPmLabel(e.target.value)} placeholder="Название" className="flex-1 px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none" />
              <input value={newPmCode} onChange={(e) => setNewPmCode(e.target.value)} placeholder="Код (необяз.)" className="w-32 px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-1.5">Цвет в аналитике</label>
              <div className="flex flex-wrap gap-2 items-center">
                {PM_COLOR_PRESETS.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    title={p.label}
                    onClick={() => setNewPmColor(p.color)}
                    className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-105"
                    style={{
                      background: p.color,
                      borderColor: newPmColor === p.color ? "#0F172A" : "transparent",
                      boxShadow: newPmColor === p.color ? "0 0 0 2px white inset" : undefined,
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={newPmColor}
                  onChange={(e) => setNewPmColor(e.target.value)}
                  className="w-10 h-8 rounded cursor-pointer border border-border"
                />
                <span className="text-[11px] font-mono text-muted-foreground">{newPmColor}</span>
              </div>
            </div>
            <button onClick={addPaymentMethod} disabled={busy} className="w-full py-2 text-white text-[12px] font-bold rounded-xl bg-primary hover:opacity-90 disabled:opacity-50">Добавить способ оплаты</button>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl p-5 border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-bold text-foreground">Источники бронирования</h3>
            <p className="text-[11px] text-muted-foreground">Используются при создании брони и в аналитике</p>
          </div>
          {!canEdit && <span className="text-[11px] text-muted-foreground">Только просмотр</span>}
        </div>
        <div className="space-y-2">
          {bookingSources.filter((s) => s.active).map((s) => (
            <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-border bg-muted/40 gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {editSourceId === s.id ? (
                  <input
                    value={editSourceLabel}
                    onChange={(e) => setEditSourceLabel(e.target.value)}
                    className="flex-1 px-2 py-1 text-[12px] rounded-lg border border-border bg-card outline-none"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="text-[13px] font-semibold text-foreground truncate">{s.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{s.code}</span>
                  </>
                )}
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editSourceId === s.id ? (
                    <>
                      <button onClick={() => saveBookingSourceEdit(s.id)} disabled={busy} className="text-[11px] font-bold text-primary hover:underline">Сохранить</button>
                      <button onClick={() => { setEditSourceId(null); setEditSourceLabel(""); }} className="text-[11px] font-bold text-muted-foreground hover:underline">Отмена</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditSourceId(s.id); setEditSourceLabel(s.label); }} className="text-[11px] font-bold text-primary hover:underline">Изменить</button>
                      <button onClick={() => removeBookingSource(s.id)} className="text-[11px] font-bold text-destructive hover:underline">Удалить</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <input value={newSourceLabel} onChange={(e) => setNewSourceLabel(e.target.value)} placeholder="Название (напр. Avito)" className="flex-1 px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none" />
              <input value={newSourceCode} onChange={(e) => setNewSourceCode(e.target.value)} placeholder="Код (необяз.)" className="w-32 px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-1.5">Цвет на шахматке</label>
              <div className="flex flex-wrap gap-2 items-center">
                {PM_COLOR_PRESETS.map((p) => (
                  <button
                    key={p.color}
                    type="button"
                    title={p.label}
                    onClick={() => setNewSourceColor(p.color)}
                    className="w-8 h-8 rounded-lg border-2 transition-transform hover:scale-105"
                    style={{
                      background: p.color,
                      borderColor: newSourceColor === p.color ? "#0F172A" : "transparent",
                      boxShadow: newSourceColor === p.color ? "0 0 0 2px white inset" : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
            <button onClick={addBookingSource} disabled={busy} className="w-full py-2 text-white text-[12px] font-bold rounded-xl bg-primary hover:opacity-90 disabled:opacity-50">Добавить источник</button>
          </div>
        )}
      </div>

      <div className="bg-card rounded-xl p-5 border border-border space-y-4">
        <h3 className="text-[14px] font-bold text-foreground">Каталог услуг и расходов</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">Услуги ({services.length})</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded-lg hover:bg-muted">
                  <span>{s.icon} {s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-success">{s.price} ₽</span>
                    {canEdit && <button onClick={() => removeCatalogItem(s.id)} className="text-destructive text-[10px] font-bold">×</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase mb-2">Расходы ({expenses.length})</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {expenses.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-[12px] px-2 py-1.5 rounded-lg hover:bg-muted">
                  <span>{s.icon} {s.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-destructive">{s.price} ₽</span>
                    {canEdit && <button onClick={() => removeCatalogItem(s.id)} className="text-destructive text-[10px] font-bold">×</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Select
              size="sm"
              value={newItemKind}
              onChange={(v) => setNewItemKind(v as "service" | "expense")}
              options={[
                { value: "service", label: "Услуга" },
                { value: "expense", label: "Расход" },
              ]}
              className="w-auto min-w-[120px]"
            />
            <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Название" className="flex-1 min-w-[140px] px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none" />
            <input type="number" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="Сумма" className="w-24 px-3 py-2 text-[12px] rounded-xl border border-border bg-muted outline-none" />
            <button onClick={addCatalogItem} disabled={busy} className="px-4 py-2 text-white text-[12px] font-bold rounded-xl bg-primary hover:opacity-90 disabled:opacity-50">Добавить</button>
          </div>
        )}
      </div>
    </div>
  );
}

function HotelEditor({ hotel, canEdit, onSaved }: { hotel: Hotel; canEdit: boolean; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState(hotel);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { setForm(hotel); }, [hotel]);

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/hotels/${hotel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (res.ok) { setMsg("Сохранено"); await onSaved(); }
    else setMsg("Ошибка сохранения");
  }

  const fields: (keyof Hotel)[] = ["name", "city", "address", "phone", "email", "legalName", "website"];
  const labels: Record<string, string> = {
    name: "Название",
    city: "Город",
    address: "Адрес",
    phone: "Телефон",
    email: "Email",
    legalName: "Юридическое название",
    website: "Сайт",
  };

  return (
    <div className="flex-1 max-w-lg space-y-4">
      <div className="bg-card rounded-xl overflow-hidden border border-border">
        <div className="px-5 py-3.5 flex items-center gap-2.5 bg-muted border-b border-border">
          <Building2 size={14} className="text-muted-foreground" />
          <h3 className="text-[13px] font-bold text-foreground">{form.name}</h3>
        </div>
        <div className="p-5 space-y-3.5">
          {fields.map((key) => (
            <div key={key} className="flex items-center gap-4">
              <label className="text-[12px] font-bold text-muted-foreground w-28 flex-shrink-0">{labels[key]}</label>
              <input
                value={String(form[key] ?? "")}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="flex-1 px-3 py-2 text-[13px] rounded-lg outline-none focus:ring-1 focus:ring-ring text-foreground bg-card border border-border disabled:opacity-60"
              />
            </div>
          ))}
          <div className="flex items-center gap-4">
            <label className="text-[12px] font-bold text-muted-foreground w-28 flex-shrink-0">Звёзды</label>
            <input type="number" min={1} max={5} value={form.stars} disabled={!canEdit} onChange={(e) => setForm({ ...form, stars: Number(e.target.value) || 3 })} className="w-20 px-3 py-2 text-[13px] rounded-lg outline-none focus:ring-1 focus:ring-ring text-foreground bg-card border border-border disabled:opacity-60" />
          </div>
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-3">
          <button disabled={busy} onClick={save} className="px-5 py-2.5 text-white text-[13px] font-bold rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
            {busy ? "Сохранение…" : "Сохранить"}
          </button>
          {msg && <span className="text-[12px] text-success font-semibold">{msg}</span>}
        </div>
      )}
    </div>
  );
}

function AddHotelModal({ onClose, onCreated }: { onClose: () => void; onCreated: (h: Hotel) => void }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [stars, setStars] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, city, address, stars }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Ошибка"); return; }
    onCreated(data.hotel);
  }

  return (
    <Modal title="Новый отель" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {[["Название", name, setName], ["Город", city, setCity], ["Адрес", address, setAddress]].map(([l, v, set]) => (
          <div key={l as string}>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">{l as string}</label>
            <input value={v as string} onChange={(e) => (set as (s: string) => void)(e.target.value)} className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring" />
          </div>
        ))}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Звёзды</label>
          <input type="number" min={1} max={5} value={stars} onChange={(e) => setStars(Number(e.target.value) || 3)} className="w-20 px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring" />
        </div>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="w-full py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
          {busy ? "Создание…" : "Создать отель"}
        </button>
      </form>
    </Modal>
  );
}

function InviteStaffModal({
  hotels, roles, inviteUrl, error, busy, onClose, onSubmit, onCopy, copied,
}: {
  hotels: Hotel[];
  roles: UserRole[];
  inviteUrl: string;
  error: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (p: { role: UserRole; hotelIds: string[]; email?: string }) => Promise<void>;
  onCopy: () => void;
  copied: boolean;
}) {
  const [role, setRole] = useState<UserRole>(roles[roles.length - 1] ?? "staff");
  const [hotelIds, setHotelIds] = useState<string[]>(hotels[0] ? [hotels[0].id] : []);
  const [email, setEmail] = useState("");

  function toggleHotel(id: string) {
    setHotelIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  if (inviteUrl) {
    return (
      <Modal title="Ссылка для сотрудника" onClose={onClose}>
        <p className="text-[12px] text-muted-foreground mb-3">Отправьте эту ссылку сотруднику. Она действует 7 дней.</p>
        <div className="p-3 rounded-xl bg-muted border border-border text-[11px] font-mono break-all text-foreground mb-4">{inviteUrl}</div>
        <button onClick={onCopy} className="w-full flex items-center justify-center gap-2 py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90" style={{ background: "linear-gradient(135deg,#10B981,#059669)" }}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Скопировано" : "Копировать ссылку"}
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Пригласить сотрудника" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ role, hotelIds, email: email || undefined }); }} className="space-y-4">
        <div>
          <Select
            label="Роль"
            value={role}
            onChange={(v) => setRole(v as UserRole)}
            options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Отели</label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {hotels.map((h) => (
              <label key={h.id} className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input type="checkbox" checked={hotelIds.includes(h.id)} onChange={() => toggleHotel(h.id)} />
                {h.name} · {h.city}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Email (необязательно, для привязки)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@hotel.ru" className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring" />
        </div>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <button type="submit" disabled={busy || !hotelIds.length} className="w-full py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
          {busy ? "Создание…" : "Создать ссылку"}
        </button>
      </form>
    </Modal>
  );
}

function EditStaffModal({
  member, hotels, roles, onClose, onSaved,
}: {
  member: StaffMember;
  hotels: Hotel[];
  roles: UserRole[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [role, setRole] = useState<UserRole>(member.role);
  const [position, setPosition] = useState(member.position);
  const [hotelIds, setHotelIds] = useState<string[]>(member.hotelIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggleHotel(id: string) {
    setHotelIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/staff/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, position, hotelIds }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error || "Ошибка"); return; }
    await onSaved();
  }

  return (
    <Modal title={`Изменить: ${member.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Select
            label="Роль"
            value={role}
            onChange={(v) => setRole(v as UserRole)}
            options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
          />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Должность</label>
          <input value={position} onChange={(e) => setPosition(e.target.value)} className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">Отели</label>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {hotels.map((h) => (
              <label key={h.id} className="flex items-center gap-2 text-[12px] cursor-pointer">
                <input type="checkbox" checked={hotelIds.includes(h.id)} onChange={() => toggleHotel(h.id)} />
                {h.name} · {h.city}
              </label>
            ))}
          </div>
        </div>
        {error && <p className="text-[12px] text-destructive">{error}</p>}
        <button type="submit" disabled={busy || !hotelIds.length} className="w-full py-2.5 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
          {busy ? "Сохранение…" : "Сохранить"}
        </button>
      </form>
    </Modal>
  );
}
