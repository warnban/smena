"use client";

import { useState } from "react";
import { formatPhoneInput, phoneValidationMessage } from "@/lib/validation/phone";

type PhoneInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  onBlurValidate?: (error: string | null) => void;
};

export function PhoneInput({
  value,
  onChange,
  placeholder = "+7 999 123-45-67",
  className = "",
  onBlurValidate,
}: PhoneInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  function handleChange(raw: string) {
    onChange(formatPhoneInput(raw));
    if (touched) {
      const msg = phoneValidationMessage(formatPhoneInput(raw));
      setError(msg);
      onBlurValidate?.(msg);
    }
  }

  function handleBlur() {
    setTouched(true);
    const msg = phoneValidationMessage(value);
    setError(msg);
    onBlurValidate?.(msg);
  }

  return (
    <div className={className}>
      <input
        type="tel"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full px-2.5 py-1.5 text-[12px] rounded-lg border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring ${
          error ? "border-destructive focus:ring-destructive" : "border-border"
        }`}
      />
      {error && (
        <p className="mt-0.5 text-[10px] text-destructive font-medium">{error}</p>
      )}
    </div>
  );
}

export function getPhoneError(value: string): string | null {
  return phoneValidationMessage(value);
}
