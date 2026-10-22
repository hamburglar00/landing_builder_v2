"use client";
import type { Dispatch, SetStateAction } from "react";
import type { AtrioClient, LandingAtrioAssignment } from "@/lib/atrio/atrioDb";
import type { Landing } from "@/lib/landing/types";
import { CollapsibleSection } from "./LandingEditorForm";
import { AtrioManagerDistribution, type ManagerDestinationDraft } from "./AtrioManagerDistribution";
import { normalizeTemplate8Cover } from "@/lib/landing/template8";
export function AtrioRedirectSection({ landing, atrioClients, setAssignments, onDraftChange, onPageDraftChange }: {
  landing: Landing; setLanding: Dispatch<SetStateAction<Landing | null>>; atrioClients: AtrioClient[];
  assignments: LandingAtrioAssignment[]; setAssignments: Dispatch<SetStateAction<LandingAtrioAssignment[]>>;
  createAtrioHref: string; onDraftChange: (draft: ManagerDestinationDraft) => void;
  onPageDraftChange?: (draft: ManagerDestinationDraft) => void;
}) {
  if (landing.config.template === "template8") {
    const cover = normalizeTemplate8Cover(landing.config.template8Cover);
    const providers = [...new Set(cover.cards.slice(0, cover.cardCount).map(card => card.targetProvider))];
    return <CollapsibleSection title="Redirección" keepMounted><AtrioManagerDistribution landingId={landing.id} providers={providers} clients={atrioClients} setAssignments={setAssignments} onDraftChange={onPageDraftChange || onDraftChange} /></CollapsibleSection>;
  }
  return <CollapsibleSection title="Redirección" keepMounted><AtrioManagerDistribution landingId={landing.id}
    provider={landing.config.targetProvider || "rey_de_ases"} clients={atrioClients} setAssignments={setAssignments} onDraftChange={onDraftChange} /></CollapsibleSection>;
}
