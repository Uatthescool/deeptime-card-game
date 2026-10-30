import { useEffect, useState } from "react";

import { artworkPath, cardFacePath, type CardDefinition } from "../../data/cards.ts";
import { useArtCredit } from "../artCredits.ts";
import { assetUrl } from "../assets.ts";
import { typeLabel } from "../inspection.ts";
import { Dialog } from "./Dialog.tsx";

/** A finished card face shown as large as the screen allows; a click anywhere or Escape closes it. */
export function CardLightbox({ card, onClose }: { card: CardDefinition; onClose: () => void }) {
  const face = cardFacePath(card);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);
  if (!face) return null;

  return (
    <Dialog label={`${card.name} card`} className="card-lightbox">
      <div className="card-lightbox-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="card-lightbox-frame">
        <img className="card-lightbox-face" src={assetUrl(face)} alt={`${card.name} card`} onClick={onClose} />
        <FaceArtCredit card={card} />
      </div>
      <button className="quiet-button card-lightbox-close" onClick={onClose}>
        Close
      </button>
    </Dialog>
  );
}

/**
 * Who made the art on a finished card face, laid over the art's lower right corner. Its parent must be
 * positioned and exactly the size of the face. Too small a face to read it on hides it.
 */
export function FaceArtCredit({ card }: { card: CardDefinition }) {
  const credit = useArtCredit(card, "face");
  return credit ? (
    <span className="face-art-credit-layer">
      <small className="art-credit">{credit}</small>
    </span>
  ) : null;
}

export function CardArtwork({ card }: { card: CardDefinition }) {
  const [failed, setFailed] = useState(false);
  const credit = useArtCredit(card, "artwork");
  const creature = card.kind === "creature" ? card : null;
  const artwork = artworkPath(card);
  return (
    <div className="card-art-window">
      {failed || !artwork ? (
        <div className="artwork-pending" aria-label="Final artwork pending">
          <span>{creature ? creature.period : typeLabel(card)}</span>
          <b>{creature ? creature.gameplayTaxon : "Support"}</b>
          <small>Artwork coming soon</small>
        </div>
      ) : (
        <img
          className="card-art-image"
          src={assetUrl(artwork)}
          alt={`Artwork for ${card.name}`}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
      {credit && !failed && artwork && <small className="art-credit">{credit}</small>}
    </div>
  );
}

type CardFaceProps = { card: CardDefinition; compact?: boolean; selected?: boolean };

export function CardFace({ card, compact = false, selected = false }: CardFaceProps) {
  const creature = card.kind === "creature" ? card : null;
  const className = [
    "game-card",
    `period-${creature?.period.toLowerCase() ?? "support"}`,
    compact && "compact",
    selected && "selected",
  ]
    .filter(Boolean)
    .join(" ");

  if (creature?.cardFace) {
    return (
      <article className={`${className} canonical-card-face`} aria-label={`${card.name}, ${typeLabel(card)}`}>
        <img src={assetUrl(creature.cardFace)} alt="" aria-hidden="true" draggable={false} decoding="async" />
        <FaceArtCredit card={card} />
        <span className="card-accessible-copy">
          {card.name}. Scientific name: {creature.scientificName}. Level {creature.printedLevel}. {creature.period}.{" "}
          {creature.diet}. Taxa: {creature.taxa.join(", ")}. Tags: {creature.tags.join(", ")}. {creature.role}{" "}
          {creature.flavorText}
        </span>
      </article>
    );
  }

  const hasLongTitleWord = card.name.split(/\s+/).some((word) => word.length >= 16);
  return (
    <article className={className} aria-label={`${card.name}, ${typeLabel(card)}`}>
      <div className="card-topline">
        <span>{typeLabel(card)}</span>
        {creature ? <b className="level-orb">{creature.printedLevel}</b> : <span className="support-glyph">◆</span>}
      </div>
      <h3 className={hasLongTitleWord ? "long-word-title" : undefined}>{card.name}</h3>
      {creature?.scientificName && (
        <p className="scientific-name">
          <i>{creature.scientificName}</i>
        </p>
      )}
      {creature ? (
        <>
          {!compact && <CardArtwork card={card} />}
          <p className="card-meta">
            {creature.period} · {creature.diet}
          </p>
          <div className="tag-row">
            {creature.tags.map((tag, index) => (
              <span key={`${tag}-${index}`}>{tag}</span>
            ))}
          </div>
          {!compact && <p className="card-rules">{creature.role}</p>}
          {!compact && (
            <p className="card-flavor">
              <i>{creature.flavorText}</i>
            </p>
          )}
        </>
      ) : (
        !compact &&
        card.kind !== "creature" && (
          <>
            <CardArtwork card={card} />
            <p className="card-rules">{card.rules}</p>
            {card.note && <p className="card-note">{card.note}</p>}
          </>
        )
      )}
    </article>
  );
}

export function CardBack() {
  return (
    <div className="card-back" aria-label="Hidden card">
      <i />
    </div>
  );
}
