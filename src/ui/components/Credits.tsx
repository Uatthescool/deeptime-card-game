import { useEffect, useState } from "react";

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

/** Attribution for reused artwork, loaded from the manifest that ships beside the images. */
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
            <h2>Image sources and licenses</h2>
          </div>
          <button className="quiet-button" onClick={onClose}>
            Close
          </button>
        </header>
        {state.status === "loading" && <p>Loading credits…</p>}
        {state.status === "error" && <p>The credits could not be loaded. Check your connection and try again.</p>}
        {state.status === "ready" && (
          <>
            <p className="credits-notice">{state.manifest.notice}</p>
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
    </Dialog>
  );
}
