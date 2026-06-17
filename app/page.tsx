"use client";

import Link from "next/link";
import { ArrowRight, Building2, Shield, BarChart3 } from "lucide-react";
import { crmAppUrl, platformUrl } from "@/lib/host-routing";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center font-black text-sm">С</div>
          <span className="font-black text-lg">Смена</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={crmAppUrl("/login")} className="text-sm font-semibold text-slate-300 hover:text-white">
            Войти в CRM
          </Link>
          <Link
            href={crmAppUrl("/register")}
            className="text-sm font-bold px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600"
          >
            Подключить отель
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="max-w-2xl">
          <p className="text-blue-400 text-sm font-bold uppercase tracking-wider mb-4">CRM для гостиниц</p>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6">
            Управляйте бронированиями, гостями и финансами в одном месте
          </h1>
          <p className="text-lg text-slate-400 mb-10">
            Шахматка, заселение, миграционный учёт, отчёты и печать документов — всё для вашей гостиницы или сети отелей.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={crmAppUrl("/register")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 font-bold text-sm"
            >
              Начать бесплатно <ArrowRight size={16} />
            </Link>
            <Link
              href={crmAppUrl("/login")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-600 hover:bg-slate-800 font-semibold text-sm"
            >
              Войти
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-20">
          {[
            { icon: Building2, title: "Мультитенантность", text: "Одна сеть — несколько отелей, общая база гостей" },
            { icon: BarChart3, title: "Финансы и отчёты", text: "Выручка, касса, зарплаты и аналитика по дням" },
            { icon: Shield, title: "Соответствие РФ", text: "Форма №5, миграционный учёт, бланки для печати" },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
              <Icon size={22} className="text-blue-400 mb-3" />
              <h3 className="font-bold mb-2">{title}</h3>
              <p className="text-sm text-slate-400">{text}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-slate-800 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Смена ·{" "}
        <Link href={platformUrl("/platform/login")} className="hover:text-slate-400">
          Панель разработчика
        </Link>
      </footer>
    </div>
  );
}
