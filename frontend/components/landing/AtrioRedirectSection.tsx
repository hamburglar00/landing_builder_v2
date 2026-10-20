"use client";
import type { Dispatch, SetStateAction } from "react";
import type { AtrioClient, LandingAtrioAssignment } from "@/lib/atrio/atrioDb";
import type { Landing } from "@/lib/landing/types";
import { CollapsibleSection } from "./LandingEditorForm";
import { AtrioManagerDistribution, type ManagerDestinationDraft } from "./AtrioManagerDistribution";
export function AtrioRedirectSection({ landing, atrioClients, setAssignments, onDraftChange }: {
  landing: Landing; setLanding: Dispatch<SetStateAction<Landing | null>>; atrioClients: AtrioClient[];
  assignments: LandingAtrioAssignment[]; setAssignments: Dispatch<SetStateAction<LandingAtrioAssignment[]>>;
  createAtrioHref: string; onDraftChange: (draft: ManagerDestinationDraft) => void;
}) {
  return <CollapsibleSection title="Redirección" keepMounted><AtrioManagerDistribution landingId={landing.id}
    provider={landing.config.targetProvider || "rey_de_ases"} clients={atrioClients} setAssignments={setAssignments} onDraftChange={onDraftChange} /></CollapsibleSection>;
}
