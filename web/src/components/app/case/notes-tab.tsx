"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { analystById } from "@/data/reference";
import type { AnalystNote } from "@/data/types";
import { formatDateTime } from "@/lib/format";
import { AnalystAvatar } from "../shared/analyst-avatar";

export function NotesTab({
  notes,
  onAdd,
  textareaRef,
  closed,
}: {
  notes: (AnalystNote & { session?: true })[];
  onAdd: (body: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  closed: boolean;
}) {
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="grid gap-4">
      <Panel>
        <PanelHeader title="Investigator notes" description={notes.length ? `${notes.length} notes, oldest first` : "No notes yet"} />
        {notes.length ? (
          <ol className="divide-y divide-border">
            {notes.map((n) => {
              const a = analystById(n.authorId);
              return (
                <li key={n.id} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 px-4 py-3.5">
                  <AnalystAvatar id={n.authorId} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-[13px] font-medium text-fg">{a?.name}</span>
                      <span className="text-[11.5px] text-fg-subtle">{a?.role}</span>
                      <time dateTime={n.at} className="font-mono text-[11px] tabular text-fg-subtle">
                        {formatDateTime(n.at)}
                      </time>
                      {n.session ? <Badge tone="accent">This session · not saved</Badge> : null}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-fg-muted">{n.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="px-4 py-6 text-[13px] text-fg-muted">Nobody has written on this case yet. Notes record reasoning, not just actions.</p>
        )}
      </Panel>

      <Panel>
        <form
          className="grid gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const text = body.trim();
            if (!text) {
              setError("Write something before adding the note.");
              textareaRef.current?.focus();
              return;
            }
            onAdd(text);
            setBody("");
            setError(null);
          }}
        >
          <Label htmlFor="new-note">Add a note</Label>
          <Textarea
            id="new-note"
            ref={textareaRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby="new-note-help"
            placeholder={closed ? "This case is closed. Notes can still be added for the record." : "What did you check, what did you find, what is still open?"}
            className="text-[13px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p id="new-note-help" className={error ? "text-[12px] text-risk-high" : "text-[12px] text-fg-subtle"} role={error ? "alert" : undefined}>
              {error ?? "Notes added in the demo stay in this browser tab and are lost on reload."}
            </p>
            <Button type="submit" size="sm">
              Add note
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
