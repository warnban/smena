"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Globe } from "lucide-react";

function StaffRegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [invite, setInvite] = useState<{
    seatName: string;
    roleLabel: string;
    position: string;
    hotels: { id: string; name: string; city: string }[];
    email: string | null;
  } | null>(null);
  const [loadError, setLoadError] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoadError("Ссылка приглашения не указана");
      return;
    }
    fetch(`/api/staff/invites/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Приглашение недействительно");
        setInvite(data);
        if (data.email) setEmail(data.email);
      })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (loadError) {
    return (
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-8 text-center">
        <p className="text-destructive font-semibold mb-4">{loadError}</p>
        <Link href="/login" className="text-primary font-semibold hover:underline">На страницу входа</Link>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-8 text-center text-muted-foreground">
        Загрузка приглашения…
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-8">
      <h1 className="text-xl font-black text-foreground mb-1">Регистрация сотрудника</h1>
      <p className="text-sm text-muted-foreground mb-4">Приглашение в сеть отелей</p>

      <div className="mb-6 p-4 rounded-xl bg-muted border border-border space-y-2">
        <div className="flex items-center gap-2 text-[13px] font-bold text-foreground">
          <Globe size={14} className="text-primary" />
          {invite.seatName}
        </div>
        <div className="text-[12px] text-muted-foreground">
          Роль: <span className="font-semibold text-foreground">{invite.roleLabel}</span>
          {invite.position ? ` · ${invite.position}` : ""}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {invite.hotels.map((h) => (
            <span key={h.id} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-primary">
              <Building2 size={10} />
              {h.name}, {h.city}
            </span>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1">Ваше имя</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required readOnly={Boolean(invite.email)} className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring read-only:opacity-70" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground block mb-1">Пароль (мин. 6)</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-2.5 text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
          {loading ? "Регистрация…" : "Зарегистрироваться и войти"}
        </button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-6">
        Уже есть аккаунт? <Link href="/login" className="text-primary font-semibold hover:underline">Войти</Link>
      </p>
    </div>
  );
}

export default function StaffRegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={<div className="text-muted-foreground text-sm">Загрузка…</div>}>
        <StaffRegisterForm />
      </Suspense>
    </div>
  );
}
