import { useEffect, useState } from "react";

import { artCreditLine, type ArtworkCredit, type CardDefinition } from "../data/cards.ts";
import { assetUrl } from "./assets.ts";

export type ArtworkManifest = { notice: string; assets: ArtworkCredit[] };

let request: Promise<ArtworkManifest> | null = null;
let loaded: ArtworkManifest | null = null;

/** The attribution manifest, fetched once and shared by everything that credits artwork. */
export function loadArtworkManifest(): Promise<ArtworkManifest> {
  request ??= fetch(assetUrl("/artwork/attribution-manifest.json"))
    .then((response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<ArtworkManifest>;
    })
    .then((manifest) => (loaded = manifest))
    .catch((error: unknown) => {
      request = null;
      throw error;
    });
  return request;
}

/** The credit line for a card's artwork or finished face; licensed credits appear once the manifest loads. */
export function useArtCredit(card: CardDefinition, on: "artwork" | "face"): string | null {
  const [manifest, setManifest] = useState(loaded);
  useEffect(() => {
    if (manifest) return;
    let cancelled = false;
    loadArtworkManifest()
      .then((value) => !cancelled && setManifest(value))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [manifest]);
  return artCreditLine(card.key, manifest?.assets ?? null, on);
}
