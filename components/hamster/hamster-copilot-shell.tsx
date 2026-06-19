"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { useHamsterMode } from "@/components/providers/hamster-mode";
import { HamsterModeToggle } from "@/components/hamster/hamster-mode-toggle";
import type {
  AssistantConfirmation,
  HamsterChatResponse,
  HamsterFileRequest,
  HamsterQuickAction,
} from "@/lib/assistant/types";
import { OTA_PAYMENT_CODE } from "@/lib/finance";

type ChatItem = {
  role: "user" | "assistant";
  content: string;
  printLinks?: Array<{ label: string; url: string }>;
};

export function HamsterCopilotShell() {
  const { hotels, hotelId, channels, refreshSilent } = useApp();
  const { setEnabled } = useHamsterMode();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<AssistantConfirmation | null>(null);
  const [quickActions, setQuickActions] = useState<HamsterQuickAction[]>([]);
  const [fileRequest, setFileRequest] = useState<HamsterFileRequest | null>(null);
  const [selectedPm, setSelectedPm] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [initialized, setInitialized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeHotelId = hotelId !== "all" ? hotelId : hotels[0]?.id ?? "";
  const activeHotelName = hotels.find((h) => h.id === activeHotelId)?.name;
  const hotelChannels = channels.filter((c) => c.hotelId === activeHotelId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, confirmation, fileRequest, busy]);

  useEffect(() => {
    if (confirmation?.paymentMethods?.length && !selectedPm) {
      setSelectedPm(confirmation.paymentMethods[0]!.code);
    }
  }, [confirmation, selectedPm]);

  const applyResponse = useCallback((data: HamsterChatResponse) => {
    setConversationId(data.conversationId);
    if (data.reply) {
      setMessages((m) => [...m, { role: "assistant", content: data.reply, printLinks: data.printLinks }]);
    }
    if (data.quickActions?.length) setQuickActions(data.quickActions);
    if (data.confirmation) {
      setConfirmation(data.confirmation);
      setSelectedPm("");
      setSelectedChannel("");
    } else {
      setConfirmation(null);
    }
    setFileRequest(data.fileRequest ?? null);
  }, []);

  const callChat = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!activeHotelId) {
        setError("Выбери отель в шапке, хомячок!");
        return null;
      }
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "hamster", hotelId: activeHotelId, ...payload }),
      });
      const data = (await res.json()) as HamsterChatResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Ошибка");
        return null;
      }
      setError("");
      return data;
    },
    [activeHotelId]
  );

  useEffect(() => {
    if (initialized || !activeHotelId) return;
    setInitialized(true);
    setBusy(true);
    void (async () => {
      const data = await callChat({});
      if (data) applyResponse(data);
      setBusy(false);
    })();
  }, [activeHotelId, initialized, callChat, applyResponse]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      setInput("");
      setConfirmation(null);
      setFileRequest(null);
      setBusy(true);
      setMessages((m) => [...m, { role: "user", content: text.trim() }]);
      try {
        const data = await callChat({ message: text.trim(), conversationId });
        if (data) applyResponse(data);
      } finally {
        setBusy(false);
      }
    },
    [busy, callChat, conversationId, applyResponse]
  );

  const fireIntent = useCallback(
    async (intent: string) => {
      if (busy) return;
      setConfirmation(null);
      setFileRequest(null);
      setBusy(true);
      setMessages((m) => [...m, { role: "user", content: `[${intent}]` }]);
      try {
        const data = await callChat({ intent, conversationId });
        if (data) applyResponse(data);
      } finally {
        setBusy(false);
      }
    },
    [busy, callChat, conversationId, applyResponse]
  );

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
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.reply, printLinks: data.printLinks },
        ]);
      }
      if (confirmed) {
        await refreshSilent();
        if (data.printLinks?.length) {
          for (const link of data.printLinks as Array<{ label: string; url: string }>) {
            window.open(link.url, "_blank", "noopener,noreferrer");
          }
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(file: File) {
    if (!fileRequest?.guestId || !conversationId || busy) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("guestId", fileRequest.guestId);
      fd.append("conversationId", conversationId);
      fd.append("hotelId", activeHotelId);
      if (fileRequest.bookingId) fd.append("bookingId", fileRequest.bookingId);
      fd.append("type", fileRequest.docType || "passport");

      setMessages((m) => [...m, { role: "user", content: "📷 Отправил фото паспорта" }]);

      const res = await fetch("/api/assistant/upload", { method: "POST", body: fd });
      const data = (await res.json()) as HamsterChatResponse & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Не удалось распознать");
        return;
      }
      setFileRequest(null);
      applyResponse(data);
      await refreshSilent();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-0px)] md:h-screen bg-gradient-to-b from-amber-50/30 to-background dark:from-amber-950/10">
      <header className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-border bg-card flex-shrink-0">
        <div className="text-2xl" aria-hidden>
          🐹
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-bold text-foreground">Режим хомячка</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {activeHotelName ?? "Выбери отель"} · AI copilot
          </div>
        </div>
        <div className="hidden md:block w-[200px] text-[11px] truncate text-muted-foreground">
          {activeHotelName ?? "Отель"}
        </div>
        <HamsterModeToggle />
        <button
          type="button"
          onClick={() => setEnabled(false)}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted"
          title="Выйти из режима хомячка"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-3 custom-scrollbar max-w-3xl mx-auto w-full">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`text-[14px] leading-relaxed rounded-2xl px-4 py-3 max-w-[90%] whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-card border border-border text-foreground shadow-sm"
            }`}
          >
            {m.content}
            {m.printLinks?.length ? (
              <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-border/50">
                {m.printLinks.map((l) => (
                  <button
                    key={l.url}
                    type="button"
                    onClick={() => window.open(l.url, "_blank", "noopener,noreferrer")}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100"
                  >
                    🖨️ {l.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {busy && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl bg-card border border-border px-4 py-3">
            <span className="text-[13px] text-muted-foreground">Думаю</span>
            <span className="flex gap-1" aria-hidden>
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="h-2 w-2 rounded-full bg-amber-500 animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        {confirmation && (
          <div className="border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-2xl p-4 space-y-3 mr-auto max-w-[95%]">
            <p className="text-[12px] font-bold text-amber-900 dark:text-amber-200">
              Хомячок, всё верно? 🐹
            </p>
            <pre className="text-[13px] text-foreground whitespace-pre-wrap font-sans">
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
                        : "border-border bg-card"
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
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmAction(true)}
                className="flex-1 py-2.5 text-[13px] font-bold text-white rounded-xl disabled:opacity-60 bg-gradient-to-r from-green-600 to-green-700"
              >
                Да, делай! ✅
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmAction(false)}
                className="px-4 py-2.5 text-[13px] font-bold rounded-xl border border-border"
              >
                Стоп
              </button>
            </div>
          </div>
        )}

        {fileRequest && (
          <div className="mr-auto max-w-[95%] border border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl p-4">
            <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-100 mb-2">
              {fileRequest.hint}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-[13px] font-bold"
            >
              <Paperclip size={16} />
              Выбрать файл
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {quickActions.length > 0 && (
        <div className="px-4 md:px-8 pb-2 flex-shrink-0 max-w-3xl mx-auto w-full">
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((a) => (
              <button
                key={a.id}
                type="button"
                disabled={busy}
                onClick={() => void fireIntent(a.intent)}
                className="px-2.5 py-1.5 text-[11px] font-semibold rounded-full border border-border bg-card hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-50"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="px-4 text-[12px] text-destructive font-semibold max-w-3xl mx-auto w-full">{error}</p>
      )}

      <div className="p-4 border-t border-border bg-card flex-shrink-0 max-w-3xl mx-auto w-full">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            placeholder="Напиши хомячку…"
            disabled={busy}
            className="flex-1 px-4 py-3 text-[14px] rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-amber-400/50"
          />
          <button
            type="button"
            onClick={() => void sendMessage(input)}
            disabled={busy || !input.trim()}
            className="p-3 rounded-xl text-white disabled:opacity-50 bg-gradient-to-r from-amber-500 to-orange-500"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
