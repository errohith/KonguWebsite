"use client";

import { createContext, useActionState, useContext, useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";
import { Alert } from "./card";
import { buttonClass } from "./button";
import { cn } from "./cn";

const FormStateContext = createContext<ActionState>(null);
const FormPendingContext = createContext(false);

/**
 * Progressive-enhancement form bound to a server action. Field errors are
 * shared through context so <Field name> can render them inline.
 *
 * Once hydrated, submission goes through a transition instead of the form's
 * `action` attribute: React resets forms after an action submission, which
 * would wipe what the member typed whenever validation fails. The `action`
 * attribute remains as the no-JavaScript fallback.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showSuccess = true,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <FormStateContext value={state}>
      <FormPendingContext value={pending}>
        <form
          ref={ref}
          action={formAction}
          onSubmit={(e) => {
            e.preventDefault();
            const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            const data = new FormData(e.currentTarget, submitter);
            startTransition(() => formAction(data));
          }}
          className={cn("space-y-4", className)}
          noValidate
        >
          {state?.error && <Alert tone="error">{state.error}</Alert>}
          {state?.ok && state.message && showSuccess && <Alert tone="success">{state.message}</Alert>}
          {children}
        </form>
      </FormPendingContext>
    </FormStateContext>
  );
}

export function useFormState() {
  return useContext(FormStateContext);
}

export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  name,
  value,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
  className?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const pending = useContext(FormPendingContext) || status.pending;
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      className={buttonClass(variant, size, className)}
    >
      {pending && (
        <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      )}
      {children}
    </button>
  );
}

const inputBase =
  "block w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink shadow-xs placeholder:text-muted/70 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/40 aria-[invalid=true]:border-danger-600";

export function Field({
  name,
  label,
  hint,
  children,
  className,
}: {
  name: string;
  label: string;
  hint?: string;
  children: (props: {
    id: string;
    name: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
    className: string;
  }) => React.ReactNode;
  className?: string;
}) {
  const state = useFormState();
  const error = state?.fieldErrors?.[name];
  const id = `f-${name}`;
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {label}
      </label>
      {children({ id, name, "aria-invalid": !!error, "aria-describedby": describedBy, className: inputBase })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-muted text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-danger-600 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  className,
  ...input
}: { name: string; label: string; hint?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field name={name} label={label} hint={hint} className={className}>
      {(p) => <input {...input} {...p} />}
    </Field>
  );
}

export function TextArea({
  name,
  label,
  hint,
  className,
  ...input
}: {
  name: string;
  label: string;
  hint?: string;
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field name={name} label={label} hint={hint} className={className}>
      {(p) => <textarea rows={4} {...input} {...p} />}
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  options,
  placeholder,
  className,
  ...select
}: {
  name: string;
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field name={name} label={label} hint={hint} className={className}>
      {(p) => (
        <select {...select} {...p}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function CheckboxField({
  name,
  label,
  defaultChecked,
  value,
}: {
  name: string;
  label: React.ReactNode;
  defaultChecked?: boolean;
  value?: string;
}) {
  const state = useFormState();
  const error = state?.fieldErrors?.[name];
  return (
    <div>
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          name={name}
          value={value ?? "on"}
          defaultChecked={defaultChecked}
          className="accent-maroon-700 mt-0.5 size-4 rounded"
        />
        <span>{label}</span>
      </label>
      {error && <p className="text-danger-600 mt-1 text-xs">{error}</p>}
    </div>
  );
}

export function CheckboxGroup({
  name,
  label,
  options,
  defaultValues = [],
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValues?: readonly string[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={defaultValues.includes(o.value)}
              className="accent-maroon-700 size-4"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
