import "server-only";

import { aitunnelChatCompletion, aitunnelAssistantModel } from "@/lib/aitunnel.server";
import type { LinenOverview } from "@/lib/linen-control.server";
import { HK_CATEGORY_LABELS } from "@/lib/housekeeping";
import type { HkTaskCategory } from "@/lib/types";

export async function analyzeLinenControl(overview: LinenOverview): Promise<string> {
  const byCat = Object.entries(overview.usage.byCategory)
    .map(([k, v]) => `${HK_CATEGORY_LABELS[k as HkTaskCategory] ?? k}: ${v}`)
    .join(", ");

  const prompt = `Ты аудитор гостиницы. Проанализируй контроль постельного белья за ${overview.periodDays} дней.

Данные:
- Смен белья (уборок): ${overview.usage.changesCount} (${byCat || "нет"})
- Расход (расчётный): наволочки ${overview.usage.pillowcases}, простыни ${overview.usage.sheets}, пододеяльники ${overview.usage.duvetCovers}
- Доставок от прачечной: ${overview.delivered.count}
- Привезено: наволочки ${overview.delivered.pillowcases}, простыни ${overview.delivered.sheets}, пододеяльники ${overview.delivered.duvetCovers}, стирка ${overview.delivered.washCost} ₽
- Разница (поставки − расход): наволочки ${overview.variance.pillowcases}, простыни ${overview.variance.sheets}, пододеяльники ${overview.variance.duvetCovers}
- Статус системы: ${overview.variance.status}
- Примерный остаток комплектов: ${overview.estimatedStockEnd ?? "не задан"}

Напиши на русском 3–5 коротких пунктов:
1) есть ли риск «левых» уборок без заселения;
2) что проверить в первую очередь;
3) практические рекомендации.
Без вводных фраз, только список.`;

  const completion = await aitunnelChatCompletion({
    model: aitunnelAssistantModel(),
    max_tokens: 1024,
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: "Ты опытный управляющий отеля. Отвечай кратко и по делу.",
      },
      { role: "user", content: prompt },
    ],
  });

  return completion.content?.trim() || "Не удалось получить комментарий.";
}
