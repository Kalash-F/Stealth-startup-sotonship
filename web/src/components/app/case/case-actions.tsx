"use client";

import * as React from "react";
import { ArrowUpRight, Check, MailQuestion, NotebookPen, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/sheet";
import { analystById, analysts, demoUserId, rules } from "@/data/reference";
import { sortFlags } from "@/components/domain/flag-list";
import type { CaseStatus, Investigation } from "@/data/types";
import { formatDate } from "@/lib/format";
import { DEMO_NOW } from "@/data/workspace";

function rfiDraft(inv: Investigation) {
  const me = analystById(demoUserId)!;
  const questions = sortFlags(inv.flags).map((f, i) => `${i + 1}. ${rules[f.rule].question}${f.line_id ? ` (line ${f.line_id})` : ""}`);
  return [
    `Dear ${inv.invoice.buyer.name},`,
    "",
    `We are reviewing invoice ${inv.invoice.invoice_id} dated ${formatDate(inv.invoice.invoice_date)} from ${inv.invoice.seller.name}. To complete our review, please provide the following:`,
    "",
    ...questions,
    "",
    "Supporting documents such as the purchase contract, product specification and transport documents would help.",
    "",
    "This is a routine request and does not imply any wrongdoing.",
    "",
    `${me.name}`,
    `${me.role}, Trade Finance Investigations`,
  ].join("\n");
}

export function CaseActions({
  inv,
  status,
  assigneeId,
  onAddNote,
  onEscalate,
  onAssign,
  onRequestInfo,
}: {
  inv: Investigation;
  status: CaseStatus;
  assigneeId: string;
  onAddNote: () => void;
  onEscalate: (rationale: string) => void;
  onAssign: (analystId: string) => void;
  onRequestInfo: (to: string, subject: string) => void;
}) {
  const [rfiOpen, setRfiOpen] = React.useState(false);
  const [escOpen, setEscOpen] = React.useState(false);
  const [rfi, setRfi] = React.useState(() => rfiDraft(inv));
  const [subject, setSubject] = React.useState(`Request for information: invoice ${inv.invoice.invoice_id}`);
  const [rationale, setRationale] = React.useState("");
  const closed = status === "closed_nfa";
  const escalated = status === "escalated";
  const due = new Date(new Date(DEMO_NOW).getTime() + 10 * 86_400_000).toISOString();

  return (
    <>
      <Button variant="secondary" size="sm" onClick={onAddNote}>
        <NotebookPen aria-hidden /> Add note
      </Button>

      <Dialog open={rfiOpen} onOpenChange={setRfiOpen}>
        <DialogTrigger asChild>
          <Button variant="secondary" size="sm" disabled={closed}>
            <MailQuestion aria-hidden /> Request information
          </Button>
        </DialogTrigger>
        <DialogContent
          title="Request information"
          description="A draft built from the flags on this case. In the demo, sending only logs the draft on the case timeline."
          className="max-w-2xl"
        >
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              onRequestInfo(inv.invoice.buyer.name, subject);
              setRfiOpen(false);
            }}
          >
            <div className="grid gap-1 sm:grid-cols-[80px_1fr] sm:items-center">
              <Label htmlFor="rfi-to" className="text-fg-muted">To</Label>
              <Input id="rfi-to" value={`${inv.invoice.buyer.name} (fictional)`} readOnly className="text-[13px] text-fg-muted" />
            </div>
            <div className="grid gap-1 sm:grid-cols-[80px_1fr] sm:items-center">
              <Label htmlFor="rfi-subject" className="text-fg-muted">Subject</Label>
              <Input id="rfi-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="text-[13px]" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="rfi-body" className="text-fg-muted">Message</Label>
              <Textarea id="rfi-body" value={rfi} onChange={(e) => setRfi(e.target.value)} className="min-h-64 font-mono text-[12px] leading-relaxed" />
            </div>
            <p className="text-[12px] text-fg-subtle">Response would be due {formatDate(due)}. Nothing leaves your browser in this demo.</p>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm">Cancel</Button>
              </DialogClose>
              <Button type="submit" variant="primary" size="sm">Send request</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm">
            <UserRoundPlus aria-hidden /> Assign
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Assign {inv.id} to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {analysts.map((a) => (
            <DropdownMenuItem key={a.id} onSelect={() => onAssign(a.id)}>
              <span className="flex size-5 items-center justify-center rounded-full bg-surface-3 font-mono text-[9px] text-fg">{a.initials}</span>
              <span className="flex-1">
                <span className="block">{a.name}</span>
                <span className="block text-[11px] text-fg-subtle">{a.role}</span>
              </span>
              {a.id === assigneeId ? <Check className="!text-accent" aria-label="Current assignee" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={escOpen} onOpenChange={setEscOpen}>
        <DialogTrigger asChild>
          <Button variant="accent" size="sm" disabled={closed || escalated} title={escalated ? "Already escalated" : undefined}>
            <ArrowUpRight aria-hidden /> {escalated ? "Escalated" : "Escalate to MLRO"}
          </Button>
        </DialogTrigger>
        <DialogContent
          title={`Escalate ${inv.id} to the MLRO?`}
          description="Escalation hands the case to the money laundering reporting officer for a reporting decision. A priority score alone is not grounds for a report: record the evidence you are relying on."
        >
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              onEscalate(rationale.trim());
              setEscOpen(false);
            }}
          >
            <div className="grid gap-1">
              <Label htmlFor="esc-rationale">Rationale</Label>
              <Textarea
                id="esc-rationale"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Summarise the indicators and findings that support escalation"
                className="text-[13px]"
              />
            </div>
            <p className="text-[12px] text-fg-subtle">Simulated: the status changes in this browser only and nobody is notified.</p>
            <div className="flex justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="sm">Cancel</Button>
              </DialogClose>
              <Button type="submit" variant="accent" size="sm">Confirm escalation</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
