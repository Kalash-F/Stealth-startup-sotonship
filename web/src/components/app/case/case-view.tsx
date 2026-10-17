"use client";

import * as React from "react";
import { PageHeader } from "@/components/app/page-header";
import { CaseStatusLabel, PriorityBadge, PriorityScore } from "@/components/domain/status";
import { SyntheticBadge } from "@/components/domain/synthetic-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { analystById, demoUserId } from "@/data/reference";
import { investigationById } from "@/data/investigations";
import { transactionsForCase } from "@/data/network";
import type { AnalystNote, CaseStatus, TimelineEvent } from "@/data/types";
import { workspace } from "@/data/workspace";
import { notify } from "../shared/notify";
import { CaseActions } from "./case-actions";
import { CaseFacts } from "./case-facts";
import { CaseRail } from "./case-rail";
import { InvoiceTab } from "./invoice-tab";
import { NetworkTab } from "./network-tab";
import { NotesTab } from "./notes-tab";
import { SummaryTab } from "./summary-tab";
import { TimelineTab } from "./timeline-tab";
import { TransactionsTab } from "./transactions-tab";

export type SessionEvent = TimelineEvent & { session: true };
export type SessionNote = AnalystNote & { session?: true };

const tabs = [
  { value: "summary", label: "Summary" },
  { value: "invoice", label: "Invoice" },
  { value: "timeline", label: "Timeline" },
  { value: "transactions", label: "Transactions & shipment" },
  { value: "network", label: "Network" },
  { value: "notes", label: "Notes" },
] as const;
type TabValue = (typeof tabs)[number]["value"];

let seq = 0;
const nextId = (p: string) => `${p}-session-${++seq}`;

/**
 * The case workspace. Mock actions change local state only: the page says so
 * in every toast, and session-only items are tagged "Not saved".
 */
export function CaseView({ id }: { id: string }) {
  const inv = investigationById(id)!;
  const [tab, setTab] = React.useState<TabValue>("summary");
  const [status, setStatus] = React.useState<CaseStatus>(inv.status);
  const [assigneeId, setAssigneeId] = React.useState(inv.assigneeId);
  const [notes, setNotes] = React.useState<SessionNote[]>(inv.notes);
  const [events, setEvents] = React.useState<SessionEvent[]>([]);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  const log = (kind: TimelineEvent["kind"], title: string, detail: string) =>
    setEvents((e) => [...e, { id: nextId("ev"), at: new Date().toISOString(), kind, title, detail, session: true }]);

  const addNote = (body: string) => {
    setNotes((n) => [...n, { id: nextId("note"), at: new Date().toISOString(), authorId: demoUserId, body, session: true }]);
    log("note", "Note added", body.length > 120 ? `${body.slice(0, 117)}…` : body);
    notify("Note added to this session", "The demo does not save notes. It will be gone when you reload.", "success");
  };

  const goToNoteForm = () => {
    setTab("notes");
    // Wait for the tab panel to mount before moving focus.
    setTimeout(() => noteRef.current?.focus(), 30);
  };

  const escalate = (rationale: string) => {
    setStatus("escalated");
    log("case", "Escalated to MLRO", rationale || "Escalated for a reporting decision.");
    notify(`${inv.id} marked as escalated`, "Simulated. No one was notified and the change is lost on reload.", "success");
  };

  const assign = (analystId: string) => {
    if (analystId === assigneeId) return;
    const a = analystById(analystId)!;
    setAssigneeId(analystId);
    log("case", "Case reassigned", `Assigned to ${a.name}.`);
    notify(`Assigned to ${a.name}`, "Local change only. Nothing was saved or sent.");
  };

  const requestInfo = (to: string, subject: string) => {
    log("request", "Request for information drafted", `${subject}. To ${to}. Not sent: this is a demo.`);
    notify("Nothing was sent", "The demo does not send email. The draft is logged on the timeline for this session.");
  };

  const counts = {
    timeline: inv.timeline.length + events.length,
    transactions: transactionsForCase(inv.id).length,
    notes: notes.length,
  } as Record<string, number>;

  return (
    <div>
      <PageHeader
        crumbs={[
          { label: workspace.name, href: "/app" },
          { label: "Investigations", href: "/app/investigations" },
          { label: inv.id },
        ]}
        title={inv.title}
        meta={
          <>
            <span className="font-mono text-[13px] text-fg">{inv.id}</span>
            <CaseStatusLabel status={status} />
            <PriorityBadge band={inv.priority_band} />
            <SyntheticBadge />
          </>
        }
        actions={
          <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <div>
              <p className="eyebrow">Priority</p>
              <p className="text-[12px] text-fg-muted">{inv.flags.length} flags, see Summary</p>
            </div>
            <PriorityScore band={inv.priority_band} score={inv.priority_score} />
          </div>
        }
      />

      <CaseFacts
        inv={inv}
        status={status}
        assigneeId={assigneeId}
        actions={
          <CaseActions
            inv={inv}
            status={status}
            assigneeId={assigneeId}
            onAddNote={goToNoteForm}
            onEscalate={escalate}
            onAssign={assign}
            onRequestInfo={requestInfo}
          />
        }
      />

      <div className="grid gap-4 p-4 lg:p-6 xl:grid-cols-[minmax(0,1fr)_288px] [&>*]:min-w-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="min-w-0">
          <TabsList aria-label="Case sections" className="mb-4">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {counts[t.value] !== undefined ? (
                  <span className="rounded-xs bg-surface-2 px-1 font-mono text-[10.5px] tabular text-fg-subtle">{counts[t.value]}</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="summary">
            <SummaryTab inv={inv} />
          </TabsContent>
          <TabsContent value="invoice">
            <InvoiceTab inv={inv} />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab inv={inv} sessionEvents={events} />
          </TabsContent>
          <TabsContent value="transactions">
            <TransactionsTab inv={inv} />
          </TabsContent>
          <TabsContent value="network">
            <NetworkTab inv={inv} />
          </TabsContent>
          <TabsContent value="notes">
            <NotesTab notes={notes} onAdd={addNote} textareaRef={noteRef} closed={status === "closed_nfa"} />
          </TabsContent>
        </Tabs>
        <CaseRail inv={inv} />
      </div>
    </div>
  );
}
