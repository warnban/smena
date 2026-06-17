"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [seatName, setSeatName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, seatName: seatName || undefined }),
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-8">
        <h1 className="text-xl font-black text-foreground mb-1">Регистрация владельца</h1>
        <p className="text-sm text-muted-foreground mb-6">Создаётся ваша сеть отелей — отдельное окружение в аккаунте</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Ваше имя</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Название сети</label>
            <input value={seatName} onChange={(e) => setSeatName(e.target.value)} placeholder="Grand Hotels" className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Пароль (мин. 6)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
            {loading ? "Создание…" : "Создать сеть и войти"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Уже есть аккаунт? <Link href="/login" className="text-primary font-semibold hover:underline">Войти</Link>
        </p>
      </div>
    </div>
  );
}
