"use client";

import { useEffect, useMemo, useState } from "react";
import type { GuestFormData } from "@/lib/guest-form";
import { ARRIVAL_PURPOSE_LABELS } from "@/lib/guest-form";
import {
  ensureValidDocType,
  getDocFieldLabel,
  getDocTypeConfig,
  getDocTypesForGuest,
  normalizeDocType,
  sanitizeDocFieldsOnTypeChange,
  type DocFieldKey,
  type DocTypeId,
} from "@/lib/document-types";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { ruDateValidationMessage } from "@/lib/validation/date";

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-[12px] rounded-lg border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
  kind = "any",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  kind?: "birth" | "past" | "future" | "any";
}) {
  const [error, setError] = useState<string | null>(null);

  function validate(v: string) {
    setError(ruDateValidationMessage(v, kind));
  }

  return (
    <div>
      <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">{label}</label>
      <DatePicker
        value={value}
        onChange={(v) => {
          onChange(v);
          if (v.length === 10) validate(v);
          else if (!v) setError(null);
        }}
        onBlur={() => value && validate(value)}
        mode="ru"
        allowInput
        placeholder="ДД.ММ.ГГГГ"
      />
      {error && <p className="mt-0.5 text-[10px] text-destructive font-medium">{error}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border">
      <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wide bg-muted border-b border-border rounded-t-xl">
        {title}
      </div>
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">{children}</div>
    </div>
  );
}

function DocField({
  field,
  form,
  set,
  config,
}: {
  field: DocFieldKey;
  form: GuestFormData;
  set: (key: keyof GuestFormData, val: string) => void;
  config: ReturnType<typeof getDocTypeConfig>;
}) {
  const label = getDocFieldLabel(config, field);
  const placeholder = config.placeholders?.[field];

  if (field === "issuedDate") {
    return (
      <DateField
        label={label}
        value={form.docIssuedDate}
        onChange={(v) => set("docIssuedDate", v)}
        kind="past"
      />
    );
  }
  if (field === "expiry") {
    return (
      <DateField
        label={label}
        value={form.docExpiry}
        onChange={(v) => set("docExpiry", v)}
        kind="future"
      />
    );
  }

  const keyMap: Record<Exclude<DocFieldKey, "issuedDate" | "expiry">, keyof GuestFormData> = {
    series: "docSeries",
    number: "docNumber",
    issuedBy: "docIssuedBy",
    divisionCode: "docDivisionCode",
  };

  const key = keyMap[field as Exclude<DocFieldKey, "issuedDate" | "expiry">];
  return (
    <Field
      label={label}
      value={form[key] as string}
      onChange={(v) => set(key, v)}
      placeholder={placeholder}
    />
  );
}

export function GuestFormFields({
  form,
  setForm,
  isForeigner,
}: {
  form: GuestFormData;
  setForm: React.Dispatch<React.SetStateAction<GuestFormData>>;
  isForeigner: boolean;
}) {
  const docTypes = useMemo(() => getDocTypesForGuest(isForeigner), [isForeigner]);
  const docConfig = useMemo(
    () => getDocTypeConfig(normalizeDocType(form.docType)),
    [form.docType]
  );

  useEffect(() => {
    setForm((f) => ensureValidDocType(f, isForeigner));
  }, [isForeigner, setForm]);

  const set = (key: keyof GuestFormData, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const setVisa = (key: string, val: string) =>
    setForm((f) => ({ ...f, visa: { ...(f.visa ?? {}), [key]: val } }));

  const setMigCard = (key: string, val: string) =>
    setForm((f) => ({ ...f, migrationCard: { ...(f.migrationCard ?? {}), [key]: val } }));

  function onDocTypeChange(newType: string) {
    setForm((f) => sanitizeDocFieldsOnTypeChange(f, newType as DocTypeId, isForeigner));
  }

  return (
    <div className="space-y-3">
      <Section title="1. Личные данные">
        <Field label="Фамилия" value={form.lastName} onChange={(v) => set("lastName", v)} />
        <Field label="Имя" value={form.firstName} onChange={(v) => set("firstName", v)} />
        <Field label="Отчество" value={form.middleName} onChange={(v) => set("middleName", v)} />
        <div>
          <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Пол</label>
          <Select
            size="sm"
            value={form.gender}
            onChange={(v) => set("gender", v)}
            options={[
              { value: "M", label: "Мужской" },
              { value: "F", label: "Женский" },
            ]}
          />
        </div>
        <DateField label="Дата рождения" value={form.birthDate} onChange={(v) => set("birthDate", v)} kind="birth" />
        <Field label="Место рождения" value={form.birthPlace} onChange={(v) => set("birthPlace", v)} />
        <Field
          label="Гражданство / страна"
          value={form.country}
          onChange={(v) => set("country", v)}
          placeholder={isForeigner ? "Германия" : "Россия"}
        />
        <div>
          <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Телефон</label>
          <PhoneInput value={form.phone} onChange={(v) => set("phone", v)} />
        </div>
        <Field label="Email" value={form.email} onChange={(v) => set("email", v)} />
      </Section>

      <Section title="2. Документ, удостоверяющий личность">
        <div className="sm:col-span-2">
          <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Вид документа</label>
          <Select
            size="sm"
            value={normalizeDocType(form.docType)}
            onChange={onDocTypeChange}
            options={docTypes.map((d) => ({ value: d.id, label: d.label }))}
          />
        </div>
        {docConfig.hint && (
          <div className="sm:col-span-2 text-[10px] text-muted-foreground bg-muted/60 rounded-lg px-2.5 py-2 border border-border/60">
            {docConfig.hint}
          </div>
        )}
        {docConfig.fields.map((field) => (
          <DocField key={field} field={field} form={form} set={set} config={docConfig} />
        ))}
      </Section>

      <Section title={`3. ${docConfig.registrationSectionTitle}`}>
        <div className="sm:col-span-2">
          <Field
            label="Адрес"
            value={form.registrationAddress}
            onChange={(v) => set("registrationAddress", v)}
            placeholder={docConfig.hint?.includes("Отсутствует") ? "Отсутствует" : undefined}
          />
        </div>
        {isForeigner && docConfig.entryInfo && (
          <>
            <DateField label="Дата въезда в РФ" value={form.entryDate} onChange={(v) => set("entryDate", v)} kind="past" />
            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">Цель поездки</label>
              <Select
                size="sm"
                value={form.arrivalPurpose}
                onChange={(v) => set("arrivalPurpose", v)}
                placeholder="Выберите…"
                options={Object.entries(ARRIVAL_PURPOSE_LABELS).map(([k, l]) => ({ value: k, label: l }))}
              />
            </div>
          </>
        )}
      </Section>

      {isForeigner && docConfig.migrationCard && (
        <Section title="Миграционная карта">
          <Field label="Серия" value={form.migrationCard?.series ?? ""} onChange={setMigCard.bind(null, "series")} />
          <Field label="Номер" value={form.migrationCard?.number ?? ""} onChange={setMigCard.bind(null, "number")} />
          <DateField
            label="Дата въезда"
            value={form.migrationCard?.entryDate ?? ""}
            onChange={setMigCard.bind(null, "entryDate")}
            kind="past"
          />
        </Section>
      )}

      {isForeigner && docConfig.visaOption && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasVisa}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  hasVisa: e.target.checked,
                  visa: e.target.checked ? f.visa ?? {} : null,
                }))
              }
            />
            Есть виза (визовый режим въезда)
          </label>
          {form.hasVisa && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <Field label="Номер визы" value={form.visa?.number ?? ""} onChange={setVisa.bind(null, "number")} />
              <Field label="Тип / категория" value={form.visa?.type ?? ""} onChange={setVisa.bind(null, "type")} />
              <Field label="Кем выдана" value={form.visa?.issuedBy ?? ""} onChange={setVisa.bind(null, "issuedBy")} />
              <DateField label="Действительна до" value={form.visa?.expiry ?? ""} onChange={setVisa.bind(null, "expiry")} kind="future" />
            </div>
          )}
        </div>
      )}

      <Section title="Предпочтения">
        <div className="sm:col-span-2">
          <Field label="Примечания" value={form.preferences} onChange={(v) => set("preferences", v)} />
        </div>
      </Section>
    </div>
  );
}
