"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ChevronDown, Send, X } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import type { AssistantChatResponse, AssistantConfirmation } from "@/lib/assistant/types";
import { OTA_PAYMENT_CODE } from "@/lib/finance";

type ChatItem = { role: "user" | "assistant"; content: string };

export function AssistantPanel() {
  const { hotelId, hotels, channels, canWriteHotelOps, refreshSilent } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<AssistantConfirmation | null>(null);
  const [selectedPm, setSelectedPm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeHotelId = hotelId !== "all" ? hotelId : hotels[0]?.id ?? "";
  const activeHotelName = hotels.find((h) => h.id === activeHotelId)?.name;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, confirmation, open]);

  useEffect(() => {
    if (confirmation?.paymentMethods?.length && !selectedPm) {
      setSelectedPm(confirmation.paymentMethods[0]!.code);
    }
  }, [confirmation, selectedPm]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (!activeHotelId) {
      setError("Выберите отель в шапке");
      return;
    }

    setInput("");
    setError("");
    setBusy(true);
    setConfirmation(null);
    setMessages((m) => [...m, { role: "user", content: text }]);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          hotelId: activeHotelId,
        }),
      });
      const data = (await res.json()) as AssistantChatResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (data.confirmation) {
        setConfirmation(data.confirmation);
        setSelectedPm("");
        setSelectedChannel("");
      }
    } catch {
      setError("Не удалось отправить сообщение");
    } finally {
      setBusy(false);
    }
  }, [input, busy, activeHotelId, conversationId]);

  async function confirmAction(confirmed: boolean) {
    if (!conversationId || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/assistant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          confirmed,
          paymentMethod: selectedPm || undefined,
          channelId: selectedPm === OTA_PAYMENT_CODE ? selectedChannel || undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return;
      }
      setConfirmation(null);
      setSelectedPm("");
      setSelectedChannel("");
      if (data.reply) {
        setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      }
      if (confirmed) {
        await refreshSilent();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!canWriteHotelOps) return null;

  const hotelChannels = channels.filter((c) => c.hotelId === activeHotelId);

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed z-40 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 md:right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg,#6366F1,#3B82F6)" }}
          aria-label="AI-помощник"
        >
          <Bot size={24} />
        </button>
      )}

      {open && (
        <div className="fixed z-50 inset-x-0 bottom-0 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:max-h-[min(640px,calc(100dvh-3rem))] flex flex-col bg-card border border-border md:rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/40 flex-shrink-0">
            <Bot size={18} className="text-primary" />
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-foreground">AI-помощник</div>
              <div className="text-[10px] text-muted-foreground truncate">
                {activeHotelName ?? "Выберите отель"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
            >
              <ChevronDown size={16} className="md:hidden" />
              <X size={16} className="hidden md:block" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-[240px] max-h-[50dvh] md:max-h-none custom-scrollbar">
            {!messages.length && !busy && (
              <div className="text-[12px] text-muted-foreground bg-muted/50 rounded-xl p-3 leading-relaxed">
                Привет! Подскажу по FAQ, оплатам, броням и срокам проживания. Опишите задачу своими словами —
                проведение платежей и изменений в базе только после вашего подтверждения.
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-[13px] leading-relaxed rounded-xl px-3 py-2 max-w-[92%] whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "mr-auto bg-muted text-foreground"
                }`}
              >
                {m.content}
              </div>
            ))}

            {busy && (
              <div className="mr-auto flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
                <span className="text-[12px] text-muted-foreground">Думаю</span>
                <span className="flex items-center gap-1" aria-hidden>
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
              </div>
            )}

            {confirmation && (
              <div className="border border-[#FDE68A] bg-[#FFFBEB] rounded-xl p-3 space-y-2">
                <p className="text-[11px] font-bold text-[#92400E]">Подтвердите операцию</p>
                <pre className="text-[12px] text-foreground whitespace-pre-wrap font-sans">
                  {confirmation.pendingAction.preview}
                </pre>

                {confirmation.needsPaymentMethod && confirmation.paymentMethods && (
                  <div className="flex flex-wrap gap-1.5">
                    {confirmation.paymentMethods.map((pm) => (
                      <button
                        key={pm.code}
                        type="button"
                        onClick={() => setSelectedPm(pm.code)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                          selectedPm === pm.code
                            ? "border-primary bg-accent text-primary"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {pm.label}
                      </button>
                    ))}
                  </div>
                )}

                {selectedPm === OTA_PAYMENT_CODE && hotelChannels.length > 0 && (
                  <select
                    value={selectedChannel}
                    onChange={(e) => setSelectedChannel(e.target.value)}
                    className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-border bg-card"
                  >
                    <option value="">Канал OTA…</option>
                    {hotelChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void confirmAction(true)}
                    className="flex-1 py-2 text-[12px] font-bold text-white rounded-lg disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#16A34A,#15803D)" }}
                  >
                    Подтвердить
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void confirmAction(false)}
                    className="px-3 py-2 text-[12px] font-bold rounded-lg border border-border text-muted-foreground"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {error && <p className="px-3 text-[11px] text-destructive font-semibold">{error}</p>}

          <div className="p-3 border-t border-border flex gap-2 flex-shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Сообщение…"
              disabled={busy}
              className="flex-1 min-w-0 px-3 py-2 text-[13px] rounded-xl border border-border bg-background outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !input.trim()}
              className="p-2.5 rounded-xl text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)" }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
