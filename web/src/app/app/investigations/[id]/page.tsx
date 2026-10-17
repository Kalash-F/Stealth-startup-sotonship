import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseView } from "@/components/app/case/case-view";
import { investigationById, investigations } from "@/data/investigations";

export function generateStaticParams() {
  return investigations.map((i) => ({ id: i.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const inv = investigationById(id);
  return { title: inv ? `${inv.id} · ${inv.title}` : "Case not found" };
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!investigationById(id)) notFound();
  return <CaseView id={id} />;
}
