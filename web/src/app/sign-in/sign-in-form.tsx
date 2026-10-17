"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/**
 * The demo has no accounts. This form never reads, stores, logs or sends
 * what is typed; it only clears the password and explains why.
 */
export function SignInForm() {
  const [message, setMessage] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = event.currentTarget.elements.namedItem("password");
    if (password instanceof HTMLInputElement) password.value = "";
    setMessage("Accounts are not available in this demo. Use the demo workspace below to explore sample data.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" aria-describedby="sign-in-note">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Work email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required placeholder="name@example.com" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="off" required />
      </div>
      <Button type="submit" size="lg" className="w-full">
        Sign in
      </Button>
      <p id="sign-in-note" role="status" className="min-h-5 text-[13px] text-fg-muted">
        {message}
      </p>
    </form>
  );
}
