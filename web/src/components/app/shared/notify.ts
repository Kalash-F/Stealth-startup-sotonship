import { toast } from "sonner";

/** Toasts for simulated actions. Description uses an ink token so it stays legible on the dark surface. */
export function notify(title: string, description: string, kind: "success" | "info" = "info") {
  const opts = { description, descriptionClassName: "!text-fg-muted !text-small" };
  return kind === "success" ? toast.success(title, opts) : toast(title, opts);
}
