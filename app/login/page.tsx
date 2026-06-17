"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка входа");
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
        <h1 className="text-xl font-black text-foreground mb-1">Смена</h1>
        <p className="text-sm text-muted-foreground mb-6">Вход в CRM</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Пароль</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}>
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Нет аккаунта? <Link href="/register" className="text-primary font-semibold hover:underline">Регистрация владельца</Link>
        </p>
      </div>
    </div>
  );
}
