"use client";

import { TrendingUp, TrendingDown } from "lucide-react";

export function KpiCard({
  label,
  value,
  sub,
  trend,
  trendDir,
  accent,
  spark,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: string;
  trendDir?: "up" | "down";
  accent?: string;
  spark?: number[];
}) {
  const mx = spark ? Math.max(...spark, 1) : 1;
  return (
    <div className="bg-card rounded-xl p-4 hover:shadow-md transition-shadow border border-border">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        {trend && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
              trendDir === "up" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            }`}
          >
            {trendDir === "up" ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {trend}
          </span>
        )}
      </div>
      <div className="text-[26px] font-black leading-none mb-1" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      {spark && (
        <div className="flex items-end gap-px mt-3 h-7">
          {spark.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${Math.round((v / mx) * 100)}%`,
                background: accent ?? "hsl(var(--primary))",
                opacity: i === spark.length - 1 ? 1 : 0.3,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
