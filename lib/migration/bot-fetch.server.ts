import "server-only";

import type { BotMigrationExportV1, BotNetworkListItem } from "@/lib/migration/bot-types";

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function authHeaders(secret: string): HeadersInit {
  return { Authorization: `Bearer ${secret}` };
}

export async function fetchBotNetworks(
  baseUrl: string,
  secret: string
): Promise<BotNetworkListItem[]> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/migration/export?mode=networks`;
  const res = await fetch(url, {
    headers: authHeaders(secret),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Ошибка ${res.status} при загрузке сетей`);
  }
  return data.networks ?? [];
}

export async function fetchBotExport(
  baseUrl: string,
  secret: string,
  networkId: string,
  fromDate: string
): Promise<BotMigrationExportV1> {
  const params = new URLSearchParams({ networkId, from: fromDate.slice(0, 10) });
  const url = `${normalizeBaseUrl(baseUrl)}/api/migration/export?${params}`;
  const res = await fetch(url, {
    headers: authHeaders(secret),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Ошибка ${res.status} при экспорте`);
  }
  if (data.version !== 1) {
    throw new Error("Неподдерживаемая версия пакета миграции");
  }
  return data as BotMigrationExportV1;
}
