"use client";

import { useRef, useState, type FormEvent } from "react";
import { api, type RecordData } from "./api";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "password" | "textarea" | "select" | "checkbox" | "datetime-local" | "time";
  required?: boolean;
  defaultValue?: string | boolean;
  placeholder?: string;
  help?: string;
  options?: { value: string; label: string }[];
  parse?: "list" | "date";
  wide?: boolean;
};

export function ApiForm({ fields, endpoint, submitLabel, extra = {}, onSaved, secondaryAction, resetAfterSave = false }: {
  fields: FormField[];
  endpoint: string;
  submitLabel: string;
  extra?: RecordData;
  onSaved?: (value: RecordData) => void;
  secondaryAction?: { endpoint: string; label: string };
  resetAfterSave?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const requestKey = useRef<{ payload: string; key: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const target = submitter?.value || endpoint;
    const data = new FormData(form);
    const payload: RecordData = { ...extra };
    for (const field of fields) {
      if (field.type === "checkbox") {
        payload[field.name] = data.has(field.name);
        continue;
      }
      const value = String(data.get(field.name) ?? "").trim();
      if (!value && !field.required) continue;
      if (field.parse === "list") payload[field.name] = value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
      else if (field.parse === "date") payload[field.name] = new Date(value).toISOString();
      else payload[field.name] = value;
    }
    const serialized = JSON.stringify(payload);
    const identity = `${target}:${serialized}`;
    if (requestKey.current?.payload !== identity) requestKey.current = { payload: identity, key: crypto.randomUUID() };
    setBusy(true);
    setMessage("");
    try {
      const result = await api<RecordData>(target, { method: "POST", body: serialized, headers: { "Idempotency-Key": requestKey.current.key } });
      setFailed(false);
      setMessage("Saved successfully.");
      requestKey.current = null;
      if (resetAfterSave) form.reset();
      onSaved?.(result);
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "The request could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="api-form">
    <div className="form-grid">{fields.map((field) => <label key={field.name} className={`${field.wide ? "field-wide" : ""} ${field.type === "checkbox" ? "checkbox-field" : ""}`}>
      {field.type !== "checkbox" && <span>{field.label}{field.required && <span className="required" aria-hidden="true"> *</span>}</span>}
      {field.type === "textarea" ? <textarea name={field.name} rows={3} required={field.required} defaultValue={String(field.defaultValue ?? "")} placeholder={field.placeholder}/> :
        field.type === "select" ? <select name={field.name} required={field.required} defaultValue={String(field.defaultValue ?? "")}><option value="" disabled>Select an option</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> :
          field.type === "checkbox" ? <><input name={field.name} type="checkbox" defaultChecked={Boolean(field.defaultValue)}/><span>{field.label}</span></> :
            <input name={field.name} type={field.type ?? "text"} required={field.required} defaultValue={String(field.defaultValue ?? "")} placeholder={field.placeholder} autoComplete={field.type === "password" ? "new-password" : "off"}/>}
      {field.help && <small>{field.help}</small>}
    </label>)}</div>
    <div className="form-actions"><button type="submit" className="button" value={endpoint} disabled={busy}>{busy ? "Working…" : submitLabel}</button>{secondaryAction && <button type="submit" className="button button-secondary" value={secondaryAction.endpoint} disabled={busy}>{secondaryAction.label}</button>}</div>
    {message && <p className={`form-message ${failed ? "error" : "success"}`} role={failed ? "alert" : "status"}>{message}</p>}
  </form>;
}
