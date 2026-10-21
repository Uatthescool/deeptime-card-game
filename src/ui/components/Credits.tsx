import { useEffect, useState } from "react";

import { AI_PLACEHOLDER_ARTWORK_KEYS, CARD_LIBRARY, PENDING_ARTWORK_KEYS } from "../../data/cards.ts";
import { assetUrl } from "../assets.ts";
import { Dialog } from "./Dialog.tsx";

type AttributionAsset = {
  cardKey: string;
  cardName: string;
  creator: string | null;
  credit: string | null;
  license: string;
  licenseUrl: string | null;
  sourcePage: string;
  modifications: string | null;
};

type Manifest = { notice: string; assets: AttributionAsset[] };

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; manifest: Manifest };

const cardNames = (keys: ReadonlySet<string>) =>
  [...keys].map((key) => CARD_LIBRARY.get(key)?.name ?? key).sort((a, b) => a.localeCompare(b));

/** Where every piece of artwork came from, including the reused images loaded from the attribution manifest. */
export function Credits({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(assetUrl("/artwork/attribution-manifest.json"))
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<Manifest>;
      })
      .then((manifest) => !cancelled && setState({ status: "ready", manifest }))
      .catch(() => !cancelled && setState({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <Dialog label="Artwork credits" className="credits-overlay">
      <section className="credits-panel">
        <header>
          <div>
            <div className="eyebrow">Artwork credits</div>
            <h2>Art and design</h2>
          </div>
          <button className="quiet-button" onClick={onClose}>
            Close
          </button>
        </header>

        <p className="credits-notice">
          All artwork in this version of Deep Time is temporary. Final card illustrations and Biome art will be
          commissioned from artists and selected from fan submissions, and credited here.
        </p>

        <section className="credits-section">
          <h3>Game and card design</h3>
          <p>
            Deep Time was created by Merrick McMorris, who designed the game, its rules and cards, the card layout,
            frame design, and colors, and the Biome concepts.
          </p>
        </section>

        <section className="credits-section">
          <h3>AI-generated placeholder art</h3>
          <p>
            The five Biome backgrounds, the Nautilus card face, and the artwork for the cards below were generated with
            ChatGPT’s image generator from Merrick McMorris’s designs and direction. They are stand-ins until
            commissioned art replaces them.
          </p>
          <p className="credits-names">{cardNames(AI_PLACEHOLDER_ARTWORK_KEYS).join(" · ")}</p>
        </section>

        <section className="credits-section">
          <h3>Artwork coming soon</h3>
          <p>These cards show a placeholder frame until their new artwork is ready.</p>
          <p className="credits-names">{cardNames(PENDING_ARTWORK_KEYS).join(" · ")}</p>
        </section>

        <section className="credits-section">
          <h3>Openly licensed images</h3>
          {state.status === "loading" && <p>Loading credits…</p>}
          {state.status === "error" && <p>The credits could not be loaded. Check your connection and try again.</p>}
          {state.status === "ready" && (
            <>
              <p>
                These images are reused under the license shown for each. Cropping, padding, background extension,
                color-space conversion, resizing, and WebP conversion were performed where needed.
              </p>
              <ol className="credits-list">
                {[...state.manifest.assets]
                  .sort((a, b) => a.cardName.localeCompare(b.cardName))
                  .map((asset) => (
                    <li key={asset.cardKey}>
                      <strong>{asset.cardName}</strong>
                      <span>
                        {asset.credit ? `“${asset.credit}”` : "Untitled"}
                        {asset.creator ? ` by ${asset.creator}` : ""} ·{" "}
                        {asset.licenseUrl ? (
                          <a href={asset.licenseUrl} target="_blank" rel="noreferrer">
                            {asset.license}
                          </a>
                        ) : (
                          asset.license
                        )}{" "}
                        ·{" "}
                        <a href={asset.sourcePage} target="_blank" rel="noreferrer">
                          Source
                        </a>
                      </span>
                      {asset.modifications && <small>{asset.modifications}</small>}
                    </li>
                  ))}
              </ol>
            </>
          )}
        </section>
      </section>
    </Dialog>
  );
}
