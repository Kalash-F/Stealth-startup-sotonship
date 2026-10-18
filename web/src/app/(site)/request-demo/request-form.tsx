"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const roleOptions = [
  "AML / financial crime investigation",
  "Trade finance operations",
  "Compliance leadership",
  "FIU or customs intelligence",
  "Other",
] as const;

export const teamSizeOptions = ["1 to 5 people", "6 to 20 people", "21 to 100 people", "More than 100 people"] as const;

type Values = {
  name: string;
  email: string;
  organisation: string;
  role: string;
  teamSize: string;
  message: string;
};
type Field = keyof Values;
type Errors = Partial<Record<Field, string>>;

const emptyValues: Values = { name: "", email: "", organisation: "", role: "", teamSize: "", message: "" };
const fieldOrder: Field[] = ["name", "email", "organisation", "role", "teamSize"];

function validate(v: Values): Errors {
  const errors: Errors = {};
  if (!v.name.trim()) errors.name = "Enter your full name.";
  if (!v.email.trim()) errors.email = "Enter your work email address.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) errors.email = "Enter an email address, such as name@example.com.";
  if (!v.organisation.trim()) errors.organisation = "Enter your organisation.";
  if (!v.role) errors.role = "Choose your role.";
  if (!v.teamSize) errors.teamSize = "Choose your team size.";
  return errors;
}

const selectClass =
  "h-9 w-full rounded-sm border border-border-strong bg-surface px-3 text-sm text-fg focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25";

/**
 * No submission backend exists yet. Valid input is shown back in memory only:
 * nothing is stored, logged or sent, and the result says so.
 */
export function RequestForm() {
  const id = useId();
  const [values, setValues] = useState<Values>(emptyValues);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState<Values | null>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (submitted) resultRef.current?.focus();
  }, [submitted]);

  function update(field: Field) {
    return (
      event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => setValues((prev) => ({ ...prev, [field]: event.target.value }));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validate(values);
    setErrors(found);
    const firstInvalid = fieldOrder.find((field) => found[field]);
    if (firstInvalid) {
      document.getElementById(`${id}-${firstInvalid}`)?.focus();
      return;
    }
    setSubmitted({ ...values });
  }

  if (submitted) {
    const rows: [string, string][] = [
      ["Full name", submitted.name],
      ["Work email", submitted.email],
      ["Organisation", submitted.organisation],
      ["Role", submitted.role],
      ["Team size", submitted.teamSize],
    ];
    if (submitted.message.trim()) rows.push(["Message", submitted.message]);

    return (
      <section aria-labelledby={`${id}-result`} className="flex flex-col gap-6">
        <div>
          <h2 id={`${id}-result`} ref={resultRef} tabIndex={-1} className="text-lg font-semibold tracking-tight focus:outline-none">
            Your request has not been sent.
          </h2>
          <p className="mt-2 text-sm text-fg-muted">
            This prototype has no submission system yet. Nothing you entered has been stored or sent.
          </p>
        </div>

        <div>
          <p className="eyebrow">What you entered</p>
          <dl className="mt-3 divide-y divide-border rounded-sm border border-border text-[13px]">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-fg-muted">{label}</dt>
                <dd className="min-w-0 break-words whitespace-pre-line text-fg">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/app" className={buttonVariants({ variant: "accent", size: "md" })}>
            Explore the workspace
          </Link>
          <Button variant="secondary" size="md" onClick={() => setSubmitted(null)}>
            Edit request
          </Button>
        </div>
      </section>
    );
  }

  const describe = (field: Field) => (errors[field] ? `${id}-${field}-error` : undefined);
  const invalid = (field: Field) => (errors[field] ? true : undefined);
  const error = (field: Field) =>
    errors[field] ? (
      <p id={`${id}-${field}-error`} className="text-[13px] text-risk-high">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <p className="text-[13px] text-fg-muted">All fields except the message are required.</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Full name</Label>
        <Input
          id={`${id}-name`}
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={update("name")}
          aria-invalid={invalid("name")}
          aria-describedby={describe("name")}
        />
        {error("name")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-email`}>Work email</Label>
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update("email")}
          aria-invalid={invalid("email")}
          aria-describedby={describe("email")}
        />
        {error("email")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-organisation`}>Organisation</Label>
        <Input
          id={`${id}-organisation`}
          name="organisation"
          autoComplete="organization"
          value={values.organisation}
          onChange={update("organisation")}
          aria-invalid={invalid("organisation")}
          aria-describedby={describe("organisation")}
        />
        {error("organisation")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-role`}>Role</Label>
        <select
          id={`${id}-role`}
          name="role"
          value={values.role}
          onChange={update("role")}
          aria-invalid={invalid("role")}
          aria-describedby={describe("role")}
          className={cn(selectClass, errors.role && "border-risk-high")}
        >
          <option value="">Choose a role</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        {error("role")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-teamSize`}>Team size</Label>
        <select
          id={`${id}-teamSize`}
          name="teamSize"
          value={values.teamSize}
          onChange={update("teamSize")}
          aria-invalid={invalid("teamSize")}
          aria-describedby={describe("teamSize")}
          className={cn(selectClass, errors.teamSize && "border-risk-high")}
        >
          <option value="">Choose a team size</option>
          {teamSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        {error("teamSize")}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-message`}>Message (optional)</Label>
        <Textarea
          id={`${id}-message`}
          name="message"
          value={values.message}
          onChange={update("message")}
          placeholder="What would you like the demo to cover?"
        />
      </div>

      <Button type="submit" size="lg" className="w-full sm:w-auto">
        Request a demo
      </Button>
    </form>
  );
}
