"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BIOMES, biomeByKey, type BiomeKey } from "./biomes";
import {
  artworkPath,
  DECK_2,
  DECK_2_DECK,
  DECK_2_SUPPORTS,
  DECK_3,
  DECK_3_DECK,
  DECK_3_SUPPORTS,
  DECK_LABELS,
  expandedTagNames,
  GENERAL_POOL,
  IMPLEMENTATION_REGISTER,
  TAG_RULES,
  TEST_DECK,
  type CardDefinition,
  type DeckKey,
  type Period,
} from "./game-data";
import {
  LESSONS,
  LESSONS_BY_ID,
  LESSON_GLOSSARY,
  type LessonAnnotation,
  type LessonCopyPart,
  type LessonDefinition,
} from "./lessons";
import {
  acknowledgeHandoff,
  activateCarnianPluvialEpisode,
  advanceToBattleOrEndTurn,
  battleCoinPlan,
  canPlayConcept,
  canPlayEvent,
  canActivateCarnianPluvialEpisode,
  canUseAquaticOverride,
  canUseTemperateReroll,
  cancelBattlePreview,
  cardVictoryLevel,
  chooseConceptOption,
  chooseBiodiversityTop,
  chooseEngulf,
  chooseFilterFeederTop,
  chooseHerd,
  chooseNesting,
  chooseGeologicalBoundaryPeriod,
  chooseCarnianPluvialOption,
  chooseConvergentCategory,
  chooseCranialDisplayTarget,
  commitBattle,
  concedeByExtinction,
  conceptAllowance,
  createGame,
  endTurn,
  getConceptChoiceOptions,
  getHerdOptions,
  getNestingOptions,
  getCarnianPluvialOptions,
  geologicalBoundaryOptions,
  hasLegalHunts,
  handCardByUid,
  legalAdaptationTargets,
  legalAquaticOverrideLanes,
  legalAttackTargets,
  legalConnectedWaterwayDestinations,
  legalConnectedWaterwaySources,
  legalCreatureLanes,
  legalDroughtTargets,
  legalFacultativeDestinations,
  legalFacultativeSources,
  legalWildfireLanes,
  nicheIsLocked,
  playAdaptation,
  playAquaticOverride,
  playConcept,
  playCreature,
  playDrought,
  playEvent,
  playWildfire,
  previewBattle,
  repositionConnectedWaterway,
  moveFacultativeQuadrupedality,
  spendTemperateReroll,
  performFullHandMulligan,
  victoryTotals,
  type CardInstance,
  type BattleCoinResults,
  type CreatureInPlay,
  type DrawEvent,
  type GameState,
  type PlayerId,
} from "./game-engine";

const LANES = [0, 1, 2, 3, 4];
const LESSON_CARD_LIBRARY = new Map(
  [...TEST_DECK, ...DECK_2_DECK, ...DECK_3_DECK, ...GENERAL_POOL].map((card) => [card.key, card]),
);
const otherPlayer = (player: PlayerId): PlayerId => (player === 0 ? 1 : 0);
const BIOME_BACKGROUNDS: Record<BiomeKey, string> = {
  tropical: "/biomes/tropical.webp",
  temperate: "/biomes/temperate.webp",
  cold: "/biomes/cold.webp",
  arid: "/biomes/arid.webp",
  aquatic: "/biomes/aquatic.webp",
};

function biomeBoardStyle(key: BiomeKey | null): CSSProperties {
  return key
    ? ({ "--biome-background": `url(\"${BIOME_BACKGROUNDS[key]}\")` } as CSSProperties)
    : {};
}

type InspectionTarget = {
  definition: CardDefinition;
  context?: string[];
  attachment?: string;
};

type CoinState = {
  stage: "flipping" | "result";
  results: BattleCoinResults;
  rerolling?: { group: "offensive" | "defensive"; index: number } | null;
} | null;

type SidewallTab = "card" | "tags" | "state" | "log" | "history";
type MobileView = "board" | "hand" | "inspect";

type PregameState = {
  players: [string, string];
  decks: [DeckKey, DeckKey];
  chooser: PlayerId;
  choices: [BiomeKey | null, BiomeKey | null];
  selected: BiomeKey | null;
  stage: "select" | "handoff" | "reveal";
};

type AquaticAction =
  | { kind: "source" }
  | { kind: "destination"; sourceLane: number }
  | { kind: "override" }
  | null;

type FacultativeAction =
  | { kind: "source" }
  | { kind: "destination"; sourceLane: number }
  | null;

function typeLabel(card: CardDefinition) {
  if (card.kind === "creature") return card.gameplayTaxon;
  if (card.kind === "event") return `${card.eventType === "continuous" ? "Continuous" : "Instantaneous"} Event`;
  return card.kind[0].toUpperCase() + card.kind.slice(1);
}

function CardArtwork({ card }: { card: CardDefinition }) {
  const creature = card.kind === "creature" ? card : null;
  const artwork = artworkPath(card);
  return (
    <div className="card-art-window">
      {artwork ? (
        <div className="card-art-image" role="img" aria-label={`Artwork for ${card.name}`} style={{ backgroundImage: `url(${artwork})` }} />
      ) : (
        <div className="artwork-pending" aria-label="Final artwork pending">
          <span>{creature ? creature.period : typeLabel(card)}</span>
          <b>{creature ? creature.gameplayTaxon : "Support"}</b>
          <small>Artwork slot ready</small>
        </div>
      )}
    </div>
  );
}

function CardFace({ card, compact = false, selected = false }: { card: CardDefinition; compact?: boolean; selected?: boolean }) {
  const creature = card.kind === "creature" ? card : null;
  const cardClassName = `game-card period-${creature?.period.toLowerCase() ?? "support"} ${compact ? "compact" : ""} ${selected ? "selected" : ""}`;

  if (creature?.cardFace) {
    return (
      <article
        className={`${cardClassName} canonical-card-face`}
        aria-label={`${card.name}, ${typeLabel(card)}`}
      >
        <img src={creature.cardFace} alt="" aria-hidden="true" draggable={false} />
        <span className="card-accessible-copy">
          {card.name}. Scientific name: {creature.scientificName}. Level {creature.printedLevel}. {creature.period}. {creature.diet}.
          Taxa: {creature.taxa.join(", ")}. Tags: {creature.tags.join(", ")}. {creature.role} {creature.flavorText}
        </span>
      </article>
    );
  }

  const hasLongTitleWord = card.name.split(/\s+/).some((word) => word.length >= 16);
  return (
    <article
      className={cardClassName}
      aria-label={`${card.name}, ${typeLabel(card)}`}
    >
      <div className="card-topline">
        <span>{typeLabel(card)}</span>
        {creature ? <b className="level-orb">{creature.printedLevel}</b> : <span className="support-glyph">◆</span>}
      </div>
      <h3 className={hasLongTitleWord ? "long-word-title" : undefined}>{card.name}</h3>
      {creature?.scientificName && <p className="scientific-name"><i>{creature.scientificName}</i></p>}
      {creature ? (
        <>
          {!compact && <CardArtwork card={card} />}
          <p className="card-meta">{creature.period} · {creature.diet}</p>
          <div className="tag-row">
            {creature.tags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
          {!compact && <p className="card-rules">{creature.role}</p>}
          {!compact && <p className="card-flavor"><i>{creature.flavorText}</i></p>}
        </>
      ) : card.kind !== "creature" ? (
        !compact && <><CardArtwork card={card} /><p className="card-rules">{card.rules}</p>{card.note && <p className="card-note">{card.note}</p>}</>
      ) : null}
    </article>
  );
}

type LessonRuntimeState = {
  lessonId: string;
  cardIndex: number;
  furthestViewed: number;
};

type LessonLeaderLine = {
  id: string;
  path: string;
  startX: number;
  startY: number;
};

function readStoredIds(storage: Storage | undefined, key: string): string[] {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function chooseCuratedLesson(currentLessonId?: string): LessonDefinition {
  if (typeof window === "undefined") return LESSONS[0];
  const candidates = LESSONS.filter((lesson) => lesson.id !== currentLessonId);
  const eligible = candidates.length ? candidates : LESSONS;
  const sessionSeen = new Set(readStoredIds(window.sessionStorage, "prehistoric-lessons-seen"));
  const recent = readStoredIds(window.localStorage, "prehistoric-lessons-recent");
  const unseen = eligible.filter((lesson) => !sessionSeen.has(lesson.id));
  const pool = unseen.length ? unseen : eligible;
  const weighted = [...pool].sort((a, b) => {
    const aRecent = recent.indexOf(a.id);
    const bRecent = recent.indexOf(b.id);
    const aScore = aRecent < 0 ? recent.length + 1 : aRecent;
    const bScore = bRecent < 0 ? recent.length + 1 : bRecent;
    return bScore - aScore;
  });
  const leastRecentCount = Math.max(1, Math.ceil(weighted.length / 2));
  return weighted[Math.floor(Math.random() * leastRecentCount)];
}

function rememberLesson(lessonId: string) {
  if (typeof window === "undefined") return;
  const sessionIds = readStoredIds(window.sessionStorage, "prehistoric-lessons-seen");
  window.sessionStorage.setItem("prehistoric-lessons-seen", JSON.stringify([...new Set([...sessionIds, lessonId])]));
  const recentIds = readStoredIds(window.localStorage, "prehistoric-lessons-recent").filter((id) => id !== lessonId);
  window.localStorage.setItem("prehistoric-lessons-recent", JSON.stringify([lessonId, ...recentIds].slice(0, 8)));
}

function LessonCopy({ parts, onLinkedLesson }: { parts: LessonCopyPart[]; onLinkedLesson: (lessonId: string) => void }) {
  return (
    <>
      {parts.map((part, index) => {
        const glossary = part.glossaryId ? LESSON_GLOSSARY[part.glossaryId] : null;
        const key = `${part.text}-${index}`;
        if (part.linkedLessonId) {
          return (
            <span className="lesson-term-wrap" key={key}>
              <button className="lesson-linked-term" onClick={() => onLinkedLesson(part.linkedLessonId!)}>{part.text}</button>
              {glossary && <span className="lesson-term-definition" role="tooltip">{glossary.definition}</span>}
            </span>
          );
        }
        if (glossary) {
          return (
            <span className="lesson-term-wrap" key={key} tabIndex={0} aria-label={`${glossary.term}: ${glossary.definition}`}>
              <strong className="lesson-glossary-term">{part.text}</strong>
              <span className="lesson-term-definition" role="tooltip">{glossary.definition}</span>
            </span>
          );
        }
        return part.emphasis ? <em key={key}>{part.text}</em> : <span key={key}>{part.text}</span>;
      })}
    </>
  );
}

function LessonProgress({
  lesson,
  state,
  onPrevious,
  onNext,
  onRestart,
}: {
  lesson: LessonDefinition;
  state: LessonRuntimeState;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
}) {
  const isFinal = state.cardIndex === lesson.cards.length - 1;
  const visibleStack = lesson.cards.slice(state.cardIndex, state.cardIndex + 3);
  return (
    <section className="lesson-progress" aria-label="Lesson progress">
      <div className="lesson-card-stack" aria-hidden="true">
        {[...visibleStack].reverse().map((cardState, index) => {
          const card = LESSON_CARD_LIBRARY.get(cardState.cardKey);
          return card ? <div key={`${cardState.cardKey}-${index}`} style={{ "--stack-index": index } as CSSProperties}><CardFace card={card} compact /></div> : null;
        })}
      </div>
      <div className="lesson-progress-copy">
        <strong>{state.cardIndex + 1} of {lesson.cards.length}</strong>
        <span>Explore more related cards in this lesson.</span>
      </div>
      <div className="lesson-progress-dots" aria-hidden="true">
        {lesson.cards.map((_, index) => <i key={index} className={index === state.cardIndex ? "current" : index <= state.furthestViewed ? "completed" : "upcoming"} />)}
      </div>
      <div className="lesson-progress-actions">
        <button className="lesson-small-button" disabled={state.cardIndex === 0} onClick={onPrevious}>Previous Card</button>
        <button className="lesson-small-button primary" onClick={isFinal ? onRestart : onNext}>{isFinal ? "Restart Lesson" : "Next Card"}</button>
      </div>
    </section>
  );
}

function LessonLeaderLines({
  containerRef,
  cardRef,
  annotations,
  annotationRefs,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  cardRef: React.RefObject<HTMLDivElement | null>;
  annotations: LessonAnnotation[];
  annotationRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
}) {
  const [geometry, setGeometry] = useState<{ width: number; height: number; lines: LessonLeaderLine[] }>({
    width: 1,
    height: 1,
    lines: [],
  });

  useEffect(() => {
    const container = containerRef.current;
    const card = cardRef.current;
    if (!container || !card) return;

    const update = () => {
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const lines = annotations.flatMap((annotation) => {
        const box = annotationRefs.current[annotation.id];
        if (!box) return [];
        const boxRect = box.getBoundingClientRect();
        const startX = boxRect.right - containerRect.left;
        const startY = boxRect.top + boxRect.height / 2 - containerRect.top;
        const targetX = cardRect.left - containerRect.left + cardRect.width * annotation.target.xPercent / 100;
        const targetY = cardRect.top - containerRect.top + cardRect.height * annotation.target.yPercent / 100;
        const horizontalDistance = Math.max(24, targetX - startX);
        const firstControlX = startX + horizontalDistance * .34;
        const secondControlX = startX + horizontalDistance * .68;
        return [{
          id: annotation.id,
          path: `M ${startX} ${startY} C ${firstControlX} ${startY}, ${secondControlX} ${targetY}, ${targetX} ${targetY}`,
          startX,
          startY,
        }];
      });
      setGeometry({ width: Math.max(1, containerRect.width), height: Math.max(1, containerRect.height), lines });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(card);
    annotations.forEach((annotation) => {
      const box = annotationRefs.current[annotation.id];
      if (box) observer.observe(box);
    });
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [annotationRefs, annotations, cardRef, containerRef]);

  return (
    <svg
      className="lesson-leader-lines"
      aria-hidden="true"
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      preserveAspectRatio="none"
    >
      {geometry.lines.map((line) => (
        <g key={line.id}>
          <path className="lesson-leader-line-halo" d={line.path} />
          <path className="lesson-leader-line" d={line.path} />
          <circle className="lesson-leader-origin" cx={line.startX} cy={line.startY} r="3" />
        </g>
      ))}
    </svg>
  );
}

function LessonExperience({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<LessonRuntimeState>(() => {
    const lesson = chooseCuratedLesson();
    return { lessonId: lesson.id, cardIndex: 0, furthestViewed: 0 };
  });
  const [previousState, setPreviousState] = useState<LessonRuntimeState | null>(null);
  const [showAllSources, setShowAllSources] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lessonBodyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const annotationRefs = useRef<Record<string, HTMLElement | null>>({});

  const lesson = LESSONS_BY_ID.get(state.lessonId) ?? LESSONS[0];
  const cardState = lesson.cards[state.cardIndex];
  const card = LESSON_CARD_LIBRARY.get(cardState.cardKey);
  const orderedAnnotations = useMemo(
    () => [...cardState.annotations].sort((left, right) => left.target.yPercent - right.target.yPercent),
    [cardState.annotations],
  );
  const hasAnotherLesson = LESSONS.some((candidate) => candidate.id !== lesson.id);

  useEffect(() => {
    rememberLesson(lesson.id);
  }, [lesson.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showAllSources) setShowAllSources(false);
        else if (showEvidence) setShowEvidence(false);
        else if (pendingLessonId) setPendingLessonId(null);
        else onClose();
        return;
      }
      if (event.key !== "Tab" || !rootRef.current) return;
      const focusable = [...rootRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, pendingLessonId, showAllSources, showEvidence]);

  const transitionToLesson = (lessonId: string) => {
    if (!LESSONS_BY_ID.has(lessonId) || lessonId === state.lessonId) return;
    setPreviousState(state);
    setState({ lessonId, cardIndex: 0, furthestViewed: 0 });
    setShowAllSources(false);
    setShowEvidence(false);
    setPendingLessonId(null);
  };

  const restorePreviousLesson = () => {
    if (!previousState) return;
    setState(previousState);
    setPreviousState(null);
    setShowAllSources(false);
    setShowEvidence(false);
  };

  const pendingLesson = pendingLessonId ? LESSONS_BY_ID.get(pendingLessonId) : null;
  const featuredSources = lesson.sources.filter((source) => source.featured).slice(0, 2);

  return (
    <div className="lesson-overlay" role="dialog" aria-modal="true" aria-labelledby="lesson-title" ref={rootRef}>
      <section className="lesson-frame">
        <header className="lesson-header">
          <div className="lesson-back-slot">
            {previousState && <button className="lesson-back-button" onClick={restorePreviousLesson}>← Back to Previous Lesson</button>}
          </div>
          <div className="lesson-heading">
            <span>Learn Something</span>
            <h1 id="lesson-title">{lesson.title}</h1>
            <p>{lesson.hook}</p>
          </div>
          <button className="lesson-close" ref={closeButtonRef} onClick={onClose} aria-label="Close Lesson">×</button>
        </header>

        <div className="lesson-body" ref={lessonBodyRef}>
          <section className="lesson-left-region" aria-label="Card annotations">
            {lesson.cards.length > 1 && <LessonProgress
              lesson={lesson}
              state={state}
              onPrevious={() => setState((current) => ({ ...current, cardIndex: current.cardIndex - 1 }))}
              onNext={() => setState((current) => ({ ...current, cardIndex: current.cardIndex + 1, furthestViewed: Math.max(current.furthestViewed, current.cardIndex + 1) }))}
              onRestart={() => setState((current) => ({ ...current, cardIndex: 0, furthestViewed: 0 }))}
            />}
            <div className="lesson-annotation-list">
              {orderedAnnotations.map((annotation) => (
                <article className="lesson-info-box lesson-annotation-box" key={annotation.id} ref={(node) => { annotationRefs.current[annotation.id] = node; }}>
                  <span>{annotation.kicker}</span>
                  <h2>{annotation.title}</h2>
                  <p><LessonCopy parts={annotation.copy} onLinkedLesson={setPendingLessonId} /></p>
                </article>
              ))}
            </div>
          </section>

          <section className="lesson-card-region" aria-label={`Canonical ${card?.name ?? "Lesson"} card`}>
            {card ? (
              <div className="lesson-card-shell" ref={cardRef}>
                <CardFace card={card} />
                {orderedAnnotations.map((annotation) => (
                  <i
                    className="lesson-card-target"
                    key={annotation.id}
                    aria-label={annotation.target.label}
                    style={{ left: `${annotation.target.xPercent}%`, top: `${annotation.target.yPercent}%` }}
                  />
                ))}
              </div>
            ) : <div className="lesson-card-missing">Canonical card unavailable.</div>}
          </section>

          <section className="lesson-right-region" aria-label="Lesson context and evidence">
            <div className="lesson-auxiliary-grid">
              {cardState.infoBoxes.map((box) => (
                <article className={`lesson-info-box ${box.tone === "uncertainty" ? "uncertainty" : ""}`} key={box.id}>
                  <span>{box.kicker}</span>
                  <h2>{box.title}</h2>
                  <p><LessonCopy parts={box.copy} onLinkedLesson={setPendingLessonId} /></p>
                </article>
              ))}
            </div>
            <article className="lesson-evidence">
              <header>
                <div><span>Evidence</span><h2>{cardState.evidenceTitle}</h2></div>
                <button onClick={() => setShowEvidence(true)}>Inspect Evidence</button>
              </header>
              <p><LessonCopy parts={cardState.evidenceIntro} onLinkedLesson={setPendingLessonId} /></p>
              <ol>
                {cardState.evidenceItems.map((item) => (
                  <li key={item.id}>
                    <span>{item.status}</span>
                    <div><h3>{item.title}</h3><p><LessonCopy parts={item.copy} onLinkedLesson={setPendingLessonId} /></p></div>
                  </li>
                ))}
              </ol>
            </article>
          </section>
          <LessonLeaderLines containerRef={lessonBodyRef} cardRef={cardRef} annotations={orderedAnnotations} annotationRefs={annotationRefs} />
        </div>

        <footer className="lesson-footer">
          <section className="lesson-sources-summary" aria-label="Sources and further reading">
            <div><span>Sources / Further Reading</span><strong>{featuredSources.map((source) => source.shortTitle).join(" · ")}</strong></div>
            <button onClick={() => setShowAllSources(true)}>View All Sources</button>
          </section>
          <p className="lesson-footer-thought">Science changes as evidence improves.<br /><em>Keep questioning the reconstruction.</em></p>
          <button
            className="lesson-show-another"
            disabled={!hasAnotherLesson}
            title={hasAnotherLesson ? "Open another Lesson" : "More Lessons are being prepared"}
            onClick={() => transitionToLesson(chooseCuratedLesson(lesson.id).id)}
          >Show Another</button>
        </footer>
      </section>

      <section className="lesson-size-warning" aria-label="Lesson size warning">
        <button onClick={onClose} aria-label="Close Lesson">×</button>
        <span>Learn Something</span>
        <h2>This Lesson needs a little more room.</h2>
        <p>Enlarge the browser window or rotate to a wider screen so the card, annotations, and Evidence can remain readable together.</p>
      </section>

      {showEvidence && (
        <div className="lesson-secondary-scrim">
          <section className="lesson-secondary-overlay evidence-detail" role="dialog" aria-modal="true" aria-labelledby="evidence-detail-title">
            <header><div><span>Evidence</span><h2 id="evidence-detail-title">{cardState.evidenceTitle}</h2></div><button onClick={() => setShowEvidence(false)} aria-label="Close Evidence">×</button></header>
            <p><LessonCopy parts={cardState.evidenceIntro} onLinkedLesson={setPendingLessonId} /></p>
            <ol>{cardState.evidenceItems.map((item) => <li key={item.id}><span>{item.status}</span><div><h3>{item.title}</h3><p><LessonCopy parts={item.copy} onLinkedLesson={setPendingLessonId} /></p></div></li>)}</ol>
            <blockquote><LessonCopy parts={cardState.evidenceConclusion} onLinkedLesson={setPendingLessonId} /></blockquote>
            <button className="lesson-secondary-done" onClick={() => setShowEvidence(false)}>Return to Lesson</button>
          </section>
        </div>
      )}

      {showAllSources && (
        <div className="lesson-secondary-scrim">
          <section className="lesson-secondary-overlay sources-detail" role="dialog" aria-modal="true" aria-labelledby="sources-detail-title">
            <header><div><span>Sources / Further Reading</span><h2 id="sources-detail-title">Sources for {lesson.title}</h2></div><button onClick={() => setShowAllSources(false)} aria-label="Close Sources">×</button></header>
            <ol>{lesson.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.shortTitle} ↗</a><p>{source.citation}</p></li>)}</ol>
            <p className="lesson-source-note">External links open separately so this Lesson remains exactly where you left it.</p>
            <button className="lesson-secondary-done" onClick={() => setShowAllSources(false)}>Return to Lesson</button>
          </section>
        </div>
      )}

      {pendingLesson && (
        <div className="lesson-secondary-scrim">
          <section className="lesson-link-confirm" role="alertdialog" aria-modal="true" aria-labelledby="linked-lesson-title">
            <span>Continue learning?</span>
            <h2 id="linked-lesson-title">Go to {pendingLesson.title}?</h2>
            <p>Your current card and progress will be preserved as the previous Lesson.</p>
            <div><button onClick={() => setPendingLessonId(null)}>Cancel</button><button className="primary" onClick={() => transitionToLesson(pendingLesson.id)}>Go to Lesson</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function CardBack() {
  return <div className="card-back" aria-label="Hidden card"><i /></div>;
}

function inspectionHandlers(
  target: InspectionTarget,
  onPreview: (target: InspectionTarget | null) => void,
  onPin?: (target: InspectionTarget, openInspector?: boolean) => void,
) {
  return {
    "data-inspection-card": true,
    onMouseEnter: () => onPreview(target),
    onMouseLeave: () => onPreview(null),
    onFocus: () => onPreview(target),
    onBlur: () => onPreview(null),
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType !== "mouse") onPin?.(target, true);
    },
  };
}

function CardTagRules({ card }: { card: Extract<CardDefinition, { kind: "creature" }> }) {
  const tags = expandedTagNames(card);
  if (!tags.length) return <p className="empty-tab-copy">This card has no printed Tags.</p>;
  return (
    <div className="keyword-list">
      {tags.map((tag) => {
        const inherited = !card.tags.includes(tag);
        return (
          <article key={tag} className={inherited ? "inherited-keyword" : ""}>
            <h3>{tag}{inherited && <small>from Sovereign</small>}</h3>
            <p>{TAG_RULES[tag] ?? "No inherent effect is currently assigned."}</p>
          </article>
        );
      })}
    </div>
  );
}

function SidewallInspection({
  target,
  activeTab,
  onTabChange,
  onClose,
  game,
  historyViewer,
  onHistoryViewer,
  onPin,
  onPreview,
  pinned = false,
}: {
  target: InspectionTarget | null;
  activeTab: SidewallTab;
  onTabChange: (tab: SidewallTab) => void;
  onClose: () => void;
  game?: GameState;
  historyViewer?: PlayerId | null;
  onHistoryViewer?: (player: PlayerId) => void;
  onPin?: (target: InspectionTarget, openInspector?: boolean) => void;
  onPreview?: (target: InspectionTarget | null) => void;
  pinned?: boolean;
}) {
  const card = target?.definition ?? null;
  const availableTabs: { id: SidewallTab; label: string }[] = [
    { id: "card", label: "Card" },
    { id: "tags", label: "Tags" },
    { id: "state", label: "State" },
    ...(game ? [{ id: "log" as const, label: "Log" }, { id: "history" as const, label: "History" }] : []),
  ];
  const selectedHistory = game && historyViewer !== null && historyViewer !== undefined ? game.players[historyViewer] : null;

  return (
    <section className="sidewall-inspection" aria-label={card ? `Inspect ${card.name}` : "Game inspector"}>
      <header>
        <div><small>{card ? (pinned ? "Pinned card" : "Card preview") : "Game record"}</small><h2>{card?.name ?? "No card selected"}</h2></div>
        <button onClick={onClose} aria-label="Close inspector">×</button>
      </header>

      {card ? (
        <div className="sidewall-identity">
          <CardArtwork card={card} />
          <div className="sidewall-meta">
            <strong>{typeLabel(card)}</strong>
            <span>{card.kind === "creature"
              ? `${card.period} · ${card.diet} · Level ${card.printedLevel}`
              : card.kind === "event"
                ? (card.eventType === "continuous" ? "Event Zone" : "Resolves outside Event Zone")
                : "Support card"}</span>
          </div>
          {card.status !== "Locked" && <div className="sidewall-pool-status">{card.status}</div>}
        </div>
      ) : (
        <div className="sidewall-empty-art"><span>Hover or focus to preview a card. Click or tap a card to pin it here.</span></div>
      )}

      <nav className="sidewall-tabs" aria-label="Inspector sections">
        {availableTabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? "active" : ""}
            disabled={!card && (tab.id === "card" || tab.id === "tags" || tab.id === "state")}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="sidewall-tab-content">
        {activeTab === "card" && card && (
          card.kind === "creature" ? (
            <>
              <section className="primary-tag-section" aria-label="Complete card Tag rules"><h3>Tags</h3><CardTagRules card={card} /></section>
              <article className="flavor-inspection"><h3>Flavor text</h3><p><i>{card.flavorText}</i></p></article>
              <dl className="inspection-facts">
                <div><dt>Taxonomy</dt><dd>{card.taxa.join(" · ")}</dd></div>
              </dl>
            </>
          ) : (
            <article className="support-inspection"><h3>Rules</h3><p>{card.rules}</p>{card.note && <><h3>Ruling</h3><p>{card.note}</p></>}</article>
          )
        )}

        {activeTab === "tags" && card && (
          card.kind === "creature" ? <CardTagRules card={card} /> : <p className="empty-tab-copy">This card has no printed Tags.</p>
        )}

        {activeTab === "state" && card && (
          <>
            {target?.context?.length ? <div className="inspection-context"><h3>Current state</h3><ul>{target.context.map((line) => <li key={line}>{line}</li>)}</ul></div> : <p className="empty-tab-copy">This card is not currently reporting live board modifiers.</p>}
            {target?.attachment && <div className="inspection-attachment"><h3>Attached Adaptation</h3><p>{target.attachment}</p></div>}
            {card.status !== "Locked" && <div className="inspection-context"><h3>Pool status</h3><p>{card.status}</p></div>}
          </>
        )}

        {activeTab === "log" && game && (
          <ol className="sidewall-log">{[...game.log].reverse().slice(0, 40).map((entry, index) => <li key={`${game.log.length - index}-${entry}`}><time>{String(game.log.length - index).padStart(2, "0")}</time><span>{entry}</span></li>)}</ol>
        )}

        {activeTab === "history" && game && (
          <div className="sidewall-history">
            <div className="history-player-tabs">
              {game.players.map((player, index) => <button key={player.name} className={historyViewer === index ? "active" : ""} onClick={() => onHistoryViewer?.(index as PlayerId)}>{player.name} · {player.history.length}</button>)}
            </div>
            {selectedHistory ? (
              selectedHistory.history.length ? <ol>{[...selectedHistory.history].reverse().map((historyCard) => { const historyTarget = { definition: historyCard.definition }; return <li key={historyCard.uid} onClick={() => onPin?.(historyTarget)} {...(onPreview ? inspectionHandlers(historyTarget, onPreview, onPin) : {})}><strong>{historyCard.definition.name}</strong><span>{typeLabel(historyCard.definition)}</span></li>; })}</ol> : <p className="empty-tab-copy">No cards in {selectedHistory.name}’s History Pile.</p>
            ) : <p className="empty-tab-copy">Choose a player to inspect their public History Pile.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function BoardCreature({
  creature,
  lane,
  victory,
  selected,
  highlighted,
  onClick,
  turnNumber,
  attachment,
  onPin,
  onPreview,
}: {
  creature: CreatureInPlay;
  lane: number;
  victory: number;
  selected: boolean;
  highlighted: boolean;
  onClick: () => void;
  turnNumber: number;
  attachment?: string;
  onPin: (target: InspectionTarget, openInspector?: boolean) => void;
  onPreview: (target: InspectionTarget | null) => void;
}) {
  const card = creature.card.definition;
  const markers: string[] = [];
  if (
    creature.enteredTurn === turnNumber &&
    !card.tags.includes("Ambush") &&
    !card.tags.includes("Charge")
  ) markers.push("Entered this turn");
  if (creature.lastAttackTurn === turnNumber) markers.push("Hunt spent");
  if (creature.cannotAttackOnTurn === turnNumber) markers.push("Hunt locked");
  if (creature.cannotOverrideOnTurn === turnNumber) markers.push("Override locked");
  if (creature.burrowedUntilTurn && creature.burrowedUntilTurn > turnNumber) markers.push("Burrowed");
  if (creature.mobFeederBonusTurn === turnNumber) markers.push("Mob Feeder +1 ready");
  if (card.tags.includes("Visual") && creature.visualUsed) markers.push("Visual spent");
  if (creature.deimaticProtectedThroughTurn !== null && creature.deimaticProtectedThroughTurn >= turnNumber) markers.push(`Deimatic through Turn ${creature.deimaticProtectedThroughTurn}`);
  if (creature.bastionDefendedTurn === turnNumber) markers.push("Bastion defense spent");
  if (creature.facultativeMovedTurn === turnNumber) markers.push("Facultative move spent");
  const target: InspectionTarget = {
    definition: card,
    context: [`Niche ${lane}`, `Victory contribution: ${victory}`, ...markers],
    attachment,
  };

  return (
    <button
      className={`board-creature period-${card.period.toLowerCase()} ${selected ? "selected" : ""} ${highlighted ? "legal-target" : ""}`}
      onClick={() => { onPin(target); onClick(); }}
      aria-label={`${card.name} in Niche ${lane}`}
      {...inspectionHandlers(target, onPreview, onPin)}
    >
      <span className="board-card-stripe" />
      <span className="board-card-top"><small>{card.gameplayTaxon}</small><b>{card.printedLevel}</b></span>
      <strong>{card.name}</strong>
      <span className="board-card-meta">{card.diet} · {card.period}</span>
      <span className="board-tags">{card.tags.join(" · ")}</span>
      <span className="board-values"><i>Victory {victory}</i><i>Level {card.printedLevel}</i></span>
      {markers.length > 0 && <span className="state-markers">{markers.join(" · ")}</span>}
    </button>
  );
}

function NicheLane({
  game,
  playerId,
  laneIndex,
  opponentRow,
  selectedAttackerUid,
  highlighted,
  onLaneClick,
  onPin,
  onPreview,
}: {
  game: GameState;
  playerId: PlayerId;
  laneIndex: number;
  opponentRow: boolean;
  selectedAttackerUid: string | null;
  highlighted: boolean;
  onLaneClick: () => void;
  onPin: (target: InspectionTarget, openInspector?: boolean) => void;
  onPreview: (target: InspectionTarget | null) => void;
}) {
  const lane = game.players[playerId].lanes[laneIndex];
  const locked = nicheIsLocked(game, playerId, laneIndex);
  const wildfireTarget = lane.wildfire ? {
    definition: lane.wildfire.card.definition,
    context: [
      `Niche ${laneIndex + 1}`,
      "Both sides of this lane are locked.",
      `Expires after Turn ${lane.wildfire.expiresOnTurn}`,
    ],
  } : null;
  const droughtTarget = lane.drought ? {
    definition: lane.drought.card.definition,
    context: [
      `${game.players[playerId].name}'s Niche ${laneIndex + 1}`,
      "Only this Niche is locked.",
      "The directly opposing Niche receives -1 Battle Level and -1 Victory Level.",
      `Expires after Turn ${lane.drought.expiresOnTurn}`,
    ],
  } : null;
  const content = lane.wildfire ? (
    <button
      className="wildfire-marker"
      onClick={() => { if (wildfireTarget) onPin(wildfireTarget); }}
      {...(wildfireTarget ? inspectionHandlers(wildfireTarget, onPreview, onPin) : {})}
    >
      <span>Instantaneous Event</span>
      <strong>Wildfire</strong>
      <small>Lane locked through Turn {lane.wildfire.expiresOnTurn}</small>
    </button>
  ) : lane.drought ? (
    <button
      className="drought-marker"
      onClick={() => { if (droughtTarget) onPin(droughtTarget); }}
      {...(droughtTarget ? inspectionHandlers(droughtTarget, onPreview, onPin) : {})}
    >
      <span>Instantaneous Event</span>
      <strong>Drought</strong>
      <small>Niche locked through Turn {lane.drought.expiresOnTurn}</small>
    </button>
  ) : lane.creature ? (
    <BoardCreature
      creature={lane.creature}
      lane={laneIndex + 1}
      victory={cardVictoryLevel(game, lane.creature)}
      selected={selectedAttackerUid === lane.creature.card.uid}
      highlighted={highlighted}
      onClick={onLaneClick}
      turnNumber={game.turnNumber}
      attachment={lane.attachment
        ? `${lane.attachment.definition.name}: ${lane.attachment.definition.rules}`
        : lane.engulfed
          ? `Engulfed ${lane.engulfed.definition.name}: contributes no Victory Levels and has no active effects while inside this slot.`
          : undefined}
      onPin={onPin}
      onPreview={onPreview}
    />
  ) : (
    <button
      className={`empty-niche ${highlighted ? "legal-target" : ""} ${locked ? "lane-locked" : ""}`}
      onClick={onLaneClick}
      aria-label={`${opponentRow ? "Opponent" : "Your"} Niche ${laneIndex + 1}`}
    >
      <span>{locked ? (lane.drought ? "Drought" : "Wildfire") : `Niche ${laneIndex + 1}`}</span><small>{locked ? (lane.drought ? "Niche locked" : "Lane locked") : "Empty"}</small>
    </button>
  );

  const attachmentTarget = lane.attachment
    ? { definition: lane.attachment.definition }
    : lane.engulfed
      ? { definition: lane.engulfed.definition, context: ["Engulfed in this Creature's Adaptation Slot.", "Its printed effects and Victory Levels are inactive."] }
      : null;
  const slotOccupied = Boolean(lane.attachment || lane.engulfed);
  const attachment = (
    <div
      className={`adaptation-slot ${slotOccupied ? "occupied" : ""} ${lane.engulfed ? "engulfed" : ""} ${locked ? "lane-locked" : ""}`}
      {...(attachmentTarget ? inspectionHandlers(attachmentTarget, onPreview, onPin) : {})}
      onClick={() => attachmentTarget && onPin(attachmentTarget)}
    >
      {lane.attachment ? lane.attachment.definition.name : lane.engulfed ? `Engulfed · ${lane.engulfed.definition.name}` : locked ? (lane.drought ? "Niche locked" : "Lane locked") : "Adaptation"}
    </div>
  );
  return <div className="niche-lane">{content}{attachment}</div>;
}

function EventZone({ game, playerId, onPin, onPreview }: { game: GameState; playerId: PlayerId; onPin: (target: InspectionTarget, openInspector?: boolean) => void; onPreview: (target: InspectionTarget | null) => void }) {
  const event = game.players[playerId].event;
  const target = event ? { definition: event.definition } : null;
  return (
    <div
      className={`event-slot ${event ? "occupied" : ""}`}
      {...(target ? inspectionHandlers(target, onPreview, onPin) : {})}
      onClick={() => target && onPin(target)}
    >
      {event ? <><span>{event.definition.name}</span><small>Continuous Event</small></> : <><span>Event Zone</span><small>Empty</small></>}
    </div>
  );
}

function BiomePanel({ biomeKey, selected, onSelect }: { biomeKey: BiomeKey; selected: boolean; onSelect?: () => void }) {
  const biome = biomeByKey(biomeKey);
  return (
    <article className={`biome-panel biome-${biome.key} ${selected ? "selected" : ""}`}>
      <header><small>Biome</small><h2>{biome.name}</h2></header>
      <section className="biome-subtypes">
        <h3>Represented environments</h3>
        <ul>{biome.subBiomes.map((entry) => <li key={entry}>{entry}</li>)}</ul>
      </section>
      <section className="biome-ability-copy">
        <h3>{biome.abilityName}</h3>
        <p>{biome.rules}</p>
      </section>
      <p className="biome-flavor"><i>{biome.flavor}</i></p>
      {onSelect && <button className={selected ? "primary-button" : "quiet-button"} onClick={onSelect}>{selected ? "Selected" : `Choose ${biome.name}`}</button>}
    </article>
  );
}

function BiomePregame({ state, onSelect, onConfirm, onContinue, onDeal }: {
  state: PregameState;
  onSelect: (biome: BiomeKey) => void;
  onConfirm: () => void;
  onContinue: () => void;
  onDeal: () => void;
}) {
  if (state.stage === "handoff") {
    return (
      <main className="biome-pregame biome-handoff-screen">
        <section className="biome-handoff-card">
          <div className="eyebrow">Biome choice sealed</div>
          <h1>Pass to {state.players[1]}</h1>
          <p>{state.players[0]}’s selection will remain hidden until both players have chosen.</p>
          <button className="primary-button" onClick={onContinue}>I am {state.players[1]} — choose my Biome</button>
        </section>
      </main>
    );
  }

  if (state.stage === "reveal") {
    return (
      <main className="biome-pregame biome-reveal-screen">
        <header className="biome-selection-header">
          <div><div className="eyebrow">Selections revealed</div><h1>The ecosystems are set.</h1></div>
          <p>Opening hands will now be dealt one card at a time.</p>
        </header>
        <section className="biome-reveal-grid">
          {state.choices.map((choice, playerId) => choice && (
            <article key={playerId} className={`biome-reveal-choice biome-${choice}`}>
              <small>{state.players[playerId as PlayerId]}</small>
              <h2>{biomeByKey(choice).name}</h2>
              <span className="revealed-deck">{DECK_LABELS[state.decks[playerId as PlayerId]]}</span>
              <strong>{biomeByKey(choice).abilityName}</strong>
              <p>{biomeByKey(choice).shortRules}</p>
            </article>
          ))}
        </section>
        <button className="primary-button biome-deal-button" onClick={onDeal}>Draw opening hands</button>
      </main>
    );
  }

  return (
    <main className="biome-pregame biome-selection-screen">
      <header className="biome-selection-header">
        <div><div className="eyebrow">Pregame · private selection</div><h1>{state.players[state.chooser]}, choose a Biome.</h1></div>
        <p>Your Biome changes the rules for your side of the ecosystem. Both selections are revealed before either opening hand is drawn.</p>
      </header>
      <section className="biome-panel-grid">
        {BIOMES.map((biome) => <BiomePanel key={biome.key} biomeKey={biome.key} selected={state.selected === biome.key} onSelect={() => onSelect(biome.key)} />)}
      </section>
      <footer className="biome-selection-footer">
        <span>{state.selected ? `${biomeByKey(state.selected).name} · ${biomeByKey(state.selected).abilityName}` : "Choose one of the five Biomes."}</span>
        <button className="primary-button" disabled={!state.selected} onClick={onConfirm}>Confirm selection</button>
      </footer>
    </main>
  );
}

function OpeningDealOverlay({ players, decks, choices, dealt }: { players: [string, string]; decks: [DeckKey, DeckKey]; choices: [BiomeKey, BiomeKey]; dealt: number }) {
  const counts: [number, number] = [Math.min(5, Math.ceil(dealt / 2)), Math.min(5, Math.floor(dealt / 2))];
  return (
    <div className="screen-overlay opening-deal-overlay" role="dialog" aria-modal="true" aria-label="Drawing opening hands">
      <section className="opening-deal-card">
        <div className="eyebrow">Opening draw</div>
        <h2>Dealing one card at a time</h2>
        <div className="opening-deal-players">
          {([0, 1] as PlayerId[]).map((playerId) => (
            <article key={playerId}>
              <small>{players[playerId]} · {DECK_LABELS[decks[playerId]]} · {biomeByKey(choices[playerId]).name}</small>
              <div className="opening-card-stack" aria-label={`${counts[playerId]} of 5 cards dealt`}>
                {Array.from({ length: counts[playerId] }, (_, index) => <CardBack key={index} />)}
              </div>
              <strong>{counts[playerId]} / 5</strong>
            </article>
          ))}
        </div>
        <p>Both hands remain private until the first-player handoff.</p>
      </section>
    </div>
  );
}

function BiodiversityModal({ game, onChoose }: { game: GameState; onChoose: (uid: string) => void }) {
  const pending = game.pendingBiodiversity!;
  const player = game.players[pending.playerId];
  const cards = pending.cardUids
    .map((uid) => player.deck.find((card) => card.uid === uid))
    .filter((card): card is CardInstance => Boolean(card));
  return (
    <div className="screen-overlay biodiversity-overlay" role="dialog" aria-modal="true" aria-label="Biodiversity draw ordering">
      <section className="biodiversity-modal">
        <div className="eyebrow">Tropical · Biodiversity</div>
        <h2>Choose which card will be drawn first.</h2>
        <p>The other card remains on top of your deck beneath it. Any additional Start Phase draw may draw that second card immediately afterward.</p>
        <div className="biodiversity-choices">
          {cards.map((card) => (
            <button key={card.uid} onClick={() => onChoose(card.uid)}>
              <CardFace card={card.definition} compact />
              <span>Place first</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function FilterFeederModal({ game, onChoose }: { game: GameState; onChoose: (uid: string) => void }) {
  const pending = game.pendingFilterFeeder!;
  const player = game.players[pending.playerId];
  const cards = pending.cardUids
    .map((uid) => player.deck.find((card) => card.uid === uid))
    .filter((card): card is CardInstance => Boolean(card));
  const source = game.players[pending.playerId].lanes
    .map((lane) => lane.creature)
    .find((creature) => creature?.card.uid === pending.sourceUid);
  return (
    <div className="screen-overlay biodiversity-overlay" role="dialog" aria-modal="true" aria-label="Filter Feeder deck ordering">
      <section className="biodiversity-modal">
        <div className="eyebrow">{source?.card.definition.name ?? "Filter Feeder"} · Filter Feeder</div>
        <h2>Choose which card remains on top.</h2>
        <p>The other card remains directly beneath it. Neither card is drawn by this effect.</p>
        <div className="biodiversity-choices">
          {cards.map((card) => (
            <button key={card.uid} onClick={() => onChoose(card.uid)}>
              <CardFace card={card.definition} compact />
              <span>Place on top</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function GeologicalBoundaryModal({ game, onChoose }: { game: GameState; onChoose: (period: Period) => void }) {
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true" aria-label="Declare a Geological Boundary">
      <section className="geological-boundary-modal">
        <div className="eyebrow">Geological Boundary · Instantaneous Event</div>
        <h2>Declare a Time Period.</h2>
        <p>All Creatures from that Period will enter History. The immediately succeeding Period receives +1 Battle Level until the start of your next turn.</p>
        <div className="period-choice-grid">
          {geologicalBoundaryOptions(game).map((period) => <button key={period} onClick={() => onChoose(period)}>{period}</button>)}
        </div>
      </section>
    </div>
  );
}

function EngulfModal({ game, onChoose }: { game: GameState; onChoose: (accept: boolean) => void }) {
  const pending = game.pendingEngulf!;
  const holder = game.players[pending.holderPlayer].lanes[pending.holderLane].creature;
  const defeated = game.players[pending.defeatedOwner].history.find((card) => card.uid === pending.defeatedUid);
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true" aria-label="Resolve Engulf">
      <section className="engulf-modal">
        <div className="eyebrow">Engulf · Optional</div>
        <h2>Engulf {defeated?.definition.name ?? "the defeated Creature"}?</h2>
        <p>{holder?.card.definition.name ?? "This Creature"} will place it in the Adaptation Slot, gain Engulf’s Victory bonus, and become unable to initiate Hunts until that slot is cleared.</p>
        <div className="modal-actions"><button className="quiet-button" onClick={() => onChoose(false)}>Send it to History</button><button className="primary-button" onClick={() => onChoose(true)}>Engulf Creature</button></div>
      </section>
    </div>
  );
}

function findDrawnCard(game: GameState, event: DrawEvent) {
  const player = game.players[event.playerId];
  return [
    ...player.hand,
    ...player.history,
    ...player.deck,
    ...(player.event ? [player.event] : []),
    ...player.lanes.flatMap((lane): CardInstance[] => {
      const cards: CardInstance[] = [];
      if (lane.creature) cards.push(lane.creature.card);
      if (lane.attachment) cards.push(lane.attachment);
      if (lane.engulfed) cards.push(lane.engulfed);
      if (lane.drought) cards.push(lane.drought.card);
      if (lane.wildfire) cards.push(lane.wildfire.card);
      return cards;
    }),
  ].find((card) => card.uid === event.cardUid) ?? null;
}

function DrawPresentation({ game, event }: { game: GameState; event: DrawEvent }) {
  const card = findDrawnCard(game, event);
  const privateToCurrentViewer = event.playerId === game.activePlayer && !game.handoff;
  return (
    <div className="draw-presentation" role="status" aria-live="polite">
      <section className="drawn-card-stage">
        <small>{game.players[event.playerId].name} draws · {event.reason}</small>
        <div className="drawn-card-motion">
          {card && privateToCurrentViewer ? <CardFace card={card.definition} /> : <CardBack />}
        </div>
      </section>
    </div>
  );
}

function ActiveBiomeControl({ game, action, onReposition, onOverride, onCancel }: {
  game: GameState;
  action: AquaticAction;
  onReposition: () => void;
  onOverride: () => void;
  onCancel: () => void;
}) {
  const player = game.players[game.activePlayer];
  if (!player.biome.key) return <section className="biome-control"><small>No Biome</small><strong>Standard rules</strong></section>;
  const biome = biomeByKey(player.biome.key);
  let status = biome.shortRules;
  if (player.biome.key === "temperate") status = `${player.biome.seasonCounters} of 4 Season counters remain`;
  if (player.biome.key === "aquatic") status = player.biome.waterwaysConnected
    ? player.biome.waterwayRepositionTurn === game.turnNumber
      ? "Connected · reposition used this turn"
      : "Connected · reposition available"
    : "Disconnected · free override spent";
  return (
    <section className={`biome-control biome-${player.biome.key}`}>
      <small>{biome.name} · {biome.abilityName}</small>
      <strong>{status}</strong>
      {player.biome.key === "aquatic" && player.biome.waterwaysConnected && game.phase === "development" && (
        <div className="biome-control-actions">
          <button className="quiet-button" disabled={!action && legalConnectedWaterwaySources(game).length === 0} onClick={action ? onCancel : onReposition}>{action ? "Cancel" : "Reposition"}</button>
          <button className="quiet-button" disabled={Boolean(action) || !canUseAquaticOverride(game)} onClick={onOverride}>Free override</button>
        </div>
      )}
    </section>
  );
}

function HandoffOverlay({ game, revealAll, onContinue }: { game: GameState; revealAll: boolean; onContinue: () => void }) {
  const handoff = game.handoff!;
  const player = game.players[handoff.to];
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true" aria-label="Private handoff">
      <div className="handoff-card">
        <div className="handoff-icon"><span /><span /><span /></div>
        <div className="eyebrow">Private handoff</div>
        <h2>{handoff.title}</h2>
        <p>{handoff.detail}</p>
        <div className="handoff-player"><small>Next viewer</small><strong>{player.name}</strong></div>
        {revealAll && <p className="debug-warning">Reveal-all debug mode is on; both hands will remain visible after this screen.</p>}
        <button className="primary-button full" onClick={onContinue}>I am ready — begin my turn</button>
      </div>
    </div>
  );
}

function BattleModal({ game, coin, onCancel, onCommit, onResolve, onReroll }: {
  game: GameState;
  coin: CoinState;
  onCancel: () => void;
  onCommit: () => void;
  onResolve: () => void;
  onReroll: (group: "offensive" | "defensive", index: number, playerId: PlayerId) => void;
}) {
  const battle = game.pendingBattle!;
  const attacker = game.players[battle.attackerPlayer].lanes[battle.attackerLane].creature!;
  const defender = game.players[battle.defenderPlayer].lanes[battle.defenderLane].creature!;
  const isStampedeHunt = battle.origin === "stampede";
  const coinCount = battle.coinPlan.offensiveCount + battle.coinPlan.defensiveCount;
  const coinGroups = coin ? [
    { id: "offensive" as const, owner: battle.attackerPlayer, label: battle.coinPlan.offensiveReason, results: coin.results.offensive ?? [], outcome: `${(coin.results.offensive ?? []).filter(Boolean).length} Battle Level gained` },
    { id: "defensive" as const, owner: battle.defenderPlayer, label: battle.coinPlan.defensiveReason, results: coin.results.defensive ?? [], outcome: (coin.results.defensive ?? []).some(Boolean) ? "Hunt forced to a tie" : "Hunt resolves normally" },
  ].filter((group) => group.label && group.results.length) : [];
  return (
    <div className="screen-overlay battle-overlay" role="dialog" aria-modal="true" aria-label="Hunt preview">
      <div className="battle-modal">
        <div className="eyebrow">{isStampedeHunt ? "Stampede Hunt" : "Hunt preview"}</div>
        <h2>Review projected Battle Levels.</h2>
        <p>{isStampedeHunt
          ? "This Hunt is the next mandatory step of Stampede. Resolve it to continue the counter-clockwise sequence."
          : "No Hunt has been committed. Canceling will consume no attack and change no game state."}</p>
        <div className="battle-versus">
          <div><small>Attacker</small><strong>{attacker.card.definition.name}</strong><b>{battle.attackerLevelMax > battle.attackerLevel ? `${battle.attackerLevel}–${battle.attackerLevelMax}` : battle.attackerLevel}</b><ul>{battle.attackerNotes.length ? battle.attackerNotes.map((note) => <li key={note}>{note}</li>) : <li>No known modifiers</li>}</ul></div>
          <span>vs.</span>
          <div><small>Defender</small><strong>{defender.card.definition.name}</strong><b>{battle.defenderLevel}</b><ul>{battle.defenderNotes.length ? battle.defenderNotes.map((note) => <li key={note}>{note}</li>) : <li>No known modifiers</li>}</ul></div>
        </div>
        {coinCount > 0 && !coin && <p className="prototype-callout">Final outcome unresolved: Commit Hunt will flip {coinCount} Battle {coinCount === 1 ? "Coin" : "Coins"}. Red Rex means success for the Creature whose effect caused that flip.</p>}
        {coin && (
          <div className="coin-stage" aria-live="polite">
            {coinGroups.map((group) => (
              <section className="coin-group" key={group.label}>
                <small>{group.label}</small>
                <div className="coin-row">
                  {group.results.map((success, index) => (
                    <div className="coin-result-cell" key={`${group.label}-${index}`}>
                      <div className={`elusive-coin ${coin.stage === "flipping" && (!coin.rerolling || (coin.rerolling.group === group.id && coin.rerolling.index === index)) ? "flipping" : "result"} ${success ? "rex-success" : "black-failure"}`}>
                        <div className="coin-face rex-face"><span className="rex-mark">REX</span><small>SUCCESS</small></div>
                        <div className="coin-face black-face"><span>FOSSIL</span><small>REVERSE</small></div>
                      </div>
                      {coin.stage === "result" && canUseTemperateReroll(game, group.owner) && (
                        <button className="coin-reroll-button" onClick={() => onReroll(group.id, index, group.owner)}>Reroll · {game.players[group.owner].name}</button>
                      )}
                    </div>
                  ))}
                </div>
                <strong>{coin.stage === "flipping" && (!coin.rerolling || coin.rerolling.group === group.id) ? (coin.rerolling ? "Rerolling…" : "Flipping…") : group.outcome}</strong>
              </section>
            ))}
          </div>
        )}
        <div className="modal-actions">
          {!coin && !isStampedeHunt && <button className="quiet-button" onClick={onCancel}>Cancel</button>}
          {!coin && <button className="primary-button" onClick={onCommit}>{isStampedeHunt ? "Resolve Hunt" : "Commit Hunt"}</button>}
          {coin && <button className="primary-button" disabled={coin.stage === "flipping"} onClick={onResolve}>{coin.stage === "flipping" ? "Flipping…" : "Use these results"}</button>}
        </div>
      </div>
    </div>
  );
}

const CHOICE_PROMPTS: Record<string, { title: string; copy: string }> = {
  "evolutionary-radiation-card": { title: "Choose one effect—or both", copy: "Select a Level 0 or Level 1 Creature for a prerequisite you met when this Concept began resolving. After the first play, you may finish or resolve the other effect and skip Battle." },
  "evolutionary-radiation-lane": { title: "Choose an empty Niche", copy: "If you resolve both effects, the Creatures must use different Niches. Neither play uses your normal Creature play." },
  "whale-fall": { title: "Choose the fallen Creature", copy: "Send a Level 2 or Level 3 Creature from hand to History." },
  "natural-selection-cost": { title: "Pay Natural Selection’s cost", copy: "Send one Creature from your hand to History." },
  "natural-selection-search": { title: "Search for a Creature", copy: "Choose one Creature from your deck, reveal it, and add it to your hand." },
  "genetic-drift-discard": { title: "Complete Genetic Drift", copy: "Choose one of the five cards just drawn and send it to History." },
  "dig-site": { title: "Excavate a card", copy: "Choose a card from your History Pile to return to your hand." },
  "semelparity-cost": { title: "Pay Semelparity’s cost", copy: "Choose a Level 0 Creature from hand or your side of the board." },
  "semelparity-replacement-card": { title: "Optional Level 0 replacement", copy: "Because the Creature you sent to History was in play, you may play a Level 0 Creature from hand without using your normal Creature play. Doing so makes you skip this turn’s Battle Phase." },
  "semelparity-replacement-lane": { title: "Choose an empty Niche", copy: "Place the Level 0 Creature into an empty, unlocked Niche, or go back and decline the replacement." },
  "obligate-migration-source": { title: "Choose a migrating Creature", copy: "Select one Creature on either side that has an empty destination on the same side." },
  "obligate-migration-destination": { title: "Choose its destination", copy: "Select one empty Niche on that Creature’s current side. This move creates no entry trigger." },
  "abiogenesis-mode": { title: "Choose one effect", copy: "Search your deck for a Level 0 Creature, or place one from your hand and skip this turn’s Battle Phase." },
  "abiogenesis-search": { title: "Search for a Level 0 Creature", copy: "Choose one Level 0 Creature from your deck, add it to your hand, then shuffle." },
  "abiogenesis-placement-card": { title: "Choose a Level 0 Creature from your hand", copy: "This placement does not use your normal Creature play and does not end your Development Phase." },
  "abiogenesis-placement-lane": { title: "Choose an empty Niche", copy: "Place the selected Creature into an empty, unlocked Niche. You must skip your Battle Phase this turn." },
};

function ConceptChoiceModal({ game, onChoose }: { game: GameState; onChoose: (id: string) => void }) {
  const pending = game.pendingConceptChoice!;
  const prompt = CHOICE_PROMPTS[pending.kind];
  const options = getConceptChoiceOptions(game);
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true" aria-label={`${pending.card.definition.name} choice`}>
      <div className="choice-modal">
        <div className="eyebrow">{pending.card.definition.name}</div>
        <h2>{prompt.title}</h2><p>{prompt.copy}</p>
        <div className="choice-options">{options.map((option) => <button key={option.id} onClick={() => onChoose(option.id)}><strong>{option.label}</strong><span>{option.detail}</span></button>)}</div>
      </div>
    </div>
  );
}

function EntryChoiceModal({ game, onChoose }: { game: GameState; onChoose: (id: string) => void }) {
  const herd = game.pendingHerd;
  const nesting = game.pendingNesting;
  const options = herd ? getHerdOptions(game) : getNestingOptions(game);
  const title = herd
    ? "Choose another Herd Creature"
    : nesting?.stage === "card"
      ? "Choose a Level 0 Creature"
      : "Choose an adjacent Niche";
  const copy = herd
    ? "You may reveal an eligible Herd Creature from your deck and add it to your hand, or decline the search."
    : nesting?.stage === "card"
      ? "You may place one Level 0 Creature from your hand with Nesting, or decline and continue your turn."
      : "Place the selected Level 0 in an empty adjacent friendly Niche. Your turn ends after all of its entry effects resolve.";
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true" aria-label={herd ? "Herd choice" : "Nesting choice"}>
      <div className="choice-modal">
        <div className="eyebrow">{herd ? "Herd" : "Nesting"}</div>
        <h2>{title}</h2><p>{copy}</p>
        <div className="choice-options">{options.map((option) => <button key={option.id} onClick={() => onChoose(option.id)}><strong>{option.label}</strong><span>{option.detail}</span></button>)}</div>
      </div>
    </div>
  );
}

function CarnianPluvialChoiceModal({ game, onChoose }: { game: GameState; onChoose: (id: string) => void }) {
  const pending = game.pendingCarnianPluvial!;
  const options = getCarnianPluvialOptions(game);
  const prompt = pending.kind === "cost"
    ? {
        title: "Choose the displaced non-Dinosaur",
        copy: "Send one highlighted non-Dinosaur Creature you control to its owner’s History Pile.",
      }
    : {
        title: "Choose a Dinosaur from the deck",
        copy: "Find one Dinosaur with Printed Level 2 or lower, reveal it, add it to your hand, then shuffle.",
      };
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true" aria-label="Carnian Pluvial Episode choice">
      <div className="choice-modal">
        <div className="eyebrow">Carnian Pluvial Episode</div>
        <h2>{prompt.title}</h2><p>{prompt.copy}</p>
        <div className="choice-options">{options.map((option) => <button key={option.id} onClick={() => onChoose(option.id)}><strong>{option.label}</strong><span>{option.detail}</span></button>)}</div>
      </div>
    </div>
  );
}

function ConvergentChoiceModal({ game, onChoose }: { game: GameState; onChoose: (category: "diet" | "period" | "taxon") => void }) {
  const pending = game.pendingConvergentChoice!;
  const labels = {
    diet: ["Diet", "Treat the two Diets as matching."],
    period: ["Time Period", "Treat the two Time Periods as matching."],
    taxon: ["Primary Taxon", "Treat the two Primary Taxa as matching."],
  } as const;
  return (
    <div className="screen-overlay" role="dialog" aria-modal="true" aria-label="Convergent Evolution category choice">
      <div className="choice-modal">
        <div className="eyebrow">Convergent Evolution</div>
        <h2>Choose the supplied third match.</h2>
        <p>The shared eligible Tag and one natural non-Tag match are already established. Select one missing category for this override.</p>
        <div className="choice-options">
          {pending.categories.map((category) => <button key={category} onClick={() => onChoose(category)}><strong>{labels[category][0]}</strong><span>{labels[category][1]}</span></button>)}
        </div>
      </div>
    </div>
  );
}

function WinnerOverlay({ game, onRestart }: { game: GameState; onRestart: () => void }) {
  const winner = game.winner === null ? null : game.players[game.winner];
  if (!winner) return null;
  const totals = victoryTotals(game);
  return (
    <div className="screen-overlay winner-overlay" role="dialog" aria-modal="true" aria-label="Game over">
      <div className="winner-card"><div className="eyebrow">Ecosystem established</div><div className="winner-score">{totals[game.winner!]}</div><h2>{winner.name} wins</h2><p>{game.winReason}</p><button className="primary-button full" onClick={onRestart}>Start another game</button></div>
    </div>
  );
}

function DeckBrowser({ onClose }: { onClose: () => void }) {
  const defaultTarget: InspectionTarget = { definition: TEST_DECK[0] };
  const [pinnedTarget, setPinnedTarget] = useState<InspectionTarget | null>(null);
  const [hoverTarget, setHoverTarget] = useState<InspectionTarget | null>(null);
  const [tab, setTab] = useState<SidewallTab>("card");
  const target = pinnedTarget ?? hoverTarget ?? defaultTarget;
  const creatures = TEST_DECK.filter((card) => card.kind === "creature");
  const supports = TEST_DECK.filter((card) => card.kind !== "creature");
  const group = (title: string, cards: CardDefinition[]) => (
    <section className="deck-browser-group">
      <header><h2>{title}</h2><span>{cards.length} cards</span></header>
      <div className="deck-browser-grid">
        {cards.map((card) => {
          const inspection = { definition: card };
          return (
            <button
              className={`deck-browser-card ${pinnedTarget?.definition.key === card.key ? "selected" : ""}`}
              key={card.key}
              aria-pressed={pinnedTarget?.definition.key === card.key}
              onClick={() => { setPinnedTarget(inspection); setHoverTarget(null); setTab("card"); }}
              {...inspectionHandlers(
                inspection,
                (nextTarget) => { setHoverTarget(nextTarget); if (!pinnedTarget) setTab("card"); },
                (nextTarget) => { setPinnedTarget(nextTarget); setHoverTarget(null); setTab("card"); },
              )}
            >
              <CardFace card={card} compact />
            </button>
          );
        })}
      </div>
    </section>
  );
  return (
    <div className="deck-browser-overlay" role="dialog" aria-modal="true" aria-label="Inspect Deck">
      <div className="deck-browser-shell">
        <section className="deck-browser-list">
          <header className="deck-browser-header">
            <div><div className="eyebrow">Read-only card register</div><h1>Inspect Cards</h1></div>
            <button className="quiet-button" onClick={onClose}>Return to setup</button>
          </header>
          <section className="pool-section playable-pool">
            <header className="pool-section-header">
              <div><small>Playable</small><h2>Deck 1: Theropod Predators</h2><p>The complete 40-card singleton Theropod Predator deck. Either player may select it during setup.</p></div>
              <span>40 cards</span>
            </header>
            {group("Creatures", creatures)}
            {group("Supports", supports)}
          </section>
          <section className="pool-section deck-two-pool">
            <header className="pool-section-header">
              <div>
                <small>Playable</small>
                <h2>Deck 2: Herbivore Development</h2>
                <p>The complete 40-card singleton Herbivore and board-development deck. Either player may select it during setup.</p>
              </div>
              <span>{DECK_2_DECK.length} cards</span>
            </header>
            {group("Deck 2 Creatures", DECK_2)}
            {group("Deck 2 Supports", DECK_2_SUPPORTS)}
          </section>
          <section className="pool-section deck-three-pool">
            <header className="pool-section-header">
              <div>
                <small>Playable</small>
                <h2>Deck 3: Aquatic Carnivores</h2>
                <p>The complete 40-card singleton Aquatic Carnivore deck. Either player may select it during setup.</p>
              </div>
              <span>{DECK_3_DECK.length} cards</span>
            </header>
            {group("Deck 3 Creatures", DECK_3)}
            {group("Deck 3 Supports", DECK_3_SUPPORTS)}
          </section>
          <section className="pool-section general-pool">
            <header className="pool-section-header">
              <div><small>Not playable · Work in progress</small><h2>General Pool</h2><p>Candidate cards outside the three playable decks. They are available for inspection but never enter either player’s deck.</p></div>
              <span>{GENERAL_POOL.length} cards</span>
            </header>
            {group("Candidate cards outside playable decks", GENERAL_POOL)}
          </section>
        </section>
        <aside className="deck-browser-sidewall"><SidewallInspection target={target} activeTab={tab} onTabChange={setTab} onClose={onClose} pinned={Boolean(pinnedTarget)} /></aside>
      </div>
    </div>
  );
}

export default function Home() {
  const [game, setGame] = useState<GameState | null>(null);
  const [pregame, setPregame] = useState<PregameState | null>(null);
  const [openingDeal, setOpeningDeal] = useState<{ players: [string, string]; decks: [DeckKey, DeckKey]; choices: [BiomeKey, BiomeKey]; dealt: number } | null>(null);
  const [drawQueue, setDrawQueue] = useState<DrawEvent[]>([]);
  const [deferredDraws, setDeferredDraws] = useState<DrawEvent[]>([]);
  const [aquaticAction, setAquaticAction] = useState<AquaticAction>(null);
  const [facultativeAction, setFacultativeAction] = useState<FacultativeAction>(null);
  const [playerOne, setPlayerOne] = useState("Player One");
  const [playerTwo, setPlayerTwo] = useState("Player Two");
  const [playerOneDeck, setPlayerOneDeck] = useState<DeckKey>("deck-1");
  const [playerTwoDeck, setPlayerTwoDeck] = useState<DeckKey>("deck-1");
  const [revealAll, setRevealAll] = useState(false);
  const [selectedCardUid, setSelectedCardUid] = useState<string | null>(null);
  const [selectedAttackerUid, setSelectedAttackerUid] = useState<string | null>(null);
  const [historyViewer, setHistoryViewer] = useState<PlayerId | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [pinnedInspection, setPinnedInspection] = useState<InspectionTarget | null>(null);
  const [hoverInspection, setHoverInspection] = useState<InspectionTarget | null>(null);
  const [sidewallTab, setSidewallTab] = useState<SidewallTab>("log");
  const [sidewallOpen, setSidewallOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("board");
  const [showDeckBrowser, setShowDeckBrowser] = useState(false);
  const [showLesson, setShowLesson] = useState(false);
  const [coin, setCoin] = useState<CoinState>(null);

  useEffect(() => {
    if (!openingDeal) return;
    const timer = window.setTimeout(() => {
      if (openingDeal.dealt < 10) {
        setOpeningDeal({ ...openingDeal, dealt: openingDeal.dealt + 1 });
      } else {
        setOpeningDeal(null);
      }
    }, openingDeal.dealt < 10 ? 170 : 500);
    return () => window.clearTimeout(timer);
  }, [openingDeal]);

  useEffect(() => {
    if (!drawQueue.length) return;
    const timer = window.setTimeout(() => setDrawQueue((queue) => queue.slice(1)), 680);
    return () => window.clearTimeout(timer);
  }, [drawQueue]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPinnedInspection(null);
        setHoverInspection(null);
        setSidewallOpen(false);
        setShowDeckBrowser(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const activeInspection = pinnedInspection ?? hoverInspection;
  const pinInspection = (target: InspectionTarget, openInspector = false) => {
    setPinnedInspection(target);
    setHoverInspection(null);
    setSidewallTab("card");
    if (openInspector) {
      setSidewallOpen(true);
      setMobileView("inspect");
    }
  };

  const previewInspection = (target: InspectionTarget | null) => {
    setHoverInspection(target);
    if (!pinnedInspection && target) setSidewallTab("card");
  };

  const openHistory = (player: PlayerId) => {
    setHistoryViewer(player);
    setSidewallTab("history");
    setSidewallOpen(true);
    setMobileView("inspect");
  };

  const startGame = () => {
    const players: [string, string] = [playerOne.trim() || "Player One", playerTwo.trim() || "Player Two"];
    setPregame({ players, decks: [playerOneDeck, playerTwoDeck], chooser: 0, choices: [null, null], selected: null, stage: "select" });
    setSelectedCardUid(null);
    setSelectedAttackerUid(null);
    setHistoryViewer(null);
    setPinnedInspection(null);
    setHoverInspection(null);
    setSidewallTab("log");
    setSidewallOpen(false);
    setMobileView("board");
    setShowDeckBrowser(false);
    setAquaticAction(null);
    setFacultativeAction(null);
    setDrawQueue([]);
    setDeferredDraws([]);
  };

  const confirmBiome = () => {
    if (!pregame?.selected) return;
    const choices: [BiomeKey | null, BiomeKey | null] = [...pregame.choices];
    choices[pregame.chooser] = pregame.selected;
    if (pregame.chooser === 0) {
      setPregame({ ...pregame, choices, selected: null, stage: "handoff" });
    } else {
      setPregame({ ...pregame, choices, selected: null, stage: "reveal" });
    }
  };

  const dealOpeningHands = () => {
    if (!pregame || !pregame.choices[0] || !pregame.choices[1]) return;
    const choices: [BiomeKey, BiomeKey] = [pregame.choices[0], pregame.choices[1]];
    setGame(createGame(pregame.players[0], pregame.players[1], choices, pregame.decks));
    setOpeningDeal({ players: pregame.players, decks: pregame.decks, choices, dealt: 0 });
    setPregame(null);
  };

  if (!game) {
    if (pregame) {
      return <BiomePregame
        state={pregame}
        onSelect={(biome) => setPregame({ ...pregame, selected: biome })}
        onConfirm={confirmBiome}
        onContinue={() => setPregame({ ...pregame, chooser: 1, selected: null, stage: "select" })}
        onDeal={dealOpeningHands}
      />;
    }
    return (
      <main className="setup-page">
        <section className="setup-shell">
          <div className="eyebrow">Three-deck playable prototype · Revision 2.0</div>
          <h1>Prehistoric<br /><span>Card Game</span></h1>
          <p className="setup-copy">Build an ecosystem across five Niches, replace its occupants through shared traits, and reach 12 Victory Levels before your rival.</p>
          <div className="setup-grid">
            <label><span>Player one</span><input value={playerOne} onChange={(event) => setPlayerOne(event.target.value)} maxLength={24} /><select aria-label="Player one deck" value={playerOneDeck} onChange={(event) => setPlayerOneDeck(event.target.value as DeckKey)}>{(Object.keys(DECK_LABELS) as DeckKey[]).map((key) => <option key={key} value={key}>{DECK_LABELS[key]}</option>)}</select></label>
            <label><span>Player two</span><input value={playerTwo} onChange={(event) => setPlayerTwo(event.target.value)} maxLength={24} /><select aria-label="Player two deck" value={playerTwoDeck} onChange={(event) => setPlayerTwoDeck(event.target.value as DeckKey)}>{(Object.keys(DECK_LABELS) as DeckKey[]).map((key) => <option key={key} value={key}>{DECK_LABELS[key]}</option>)}</select></label>
          </div>
          <div className="setup-actions">
            <button className="primary-button" onClick={startGame}>Continue to Biomes</button>
            <button className="quiet-button" onClick={() => setShowDeckBrowser(true)}>Inspect Cards</button>
            <button className="learn-something-button" onClick={() => setShowLesson(true)}><span>Learn Something</span><small>Open a random Lesson</small></button>
          </div>
          <div className="setup-foot"><span>2 players · local hotseat</span><span>Choose any 40-card deck independently</span><span>Hands hidden on handoff</span><a href="/artwork/attribution-manifest.json" target="_blank" rel="noreferrer">Placeholder artwork credits</a></div>
        </section>
        <aside className="sample-card-wrap" aria-hidden="true"><CardFace card={TEST_DECK.find((card) => card.key === "tyrannosaurus-rex")!} /></aside>
        {showDeckBrowser && <DeckBrowser onClose={() => setShowDeckBrowser(false)} />}
        {showLesson && <LessonExperience onClose={() => setShowLesson(false)} />}
      </main>
    );
  }

  const viewPlayer = game.activePlayer;
  const opponent = otherPlayer(viewPlayer);
  const viewer = game.players[viewPlayer];
  const opponentState = game.players[opponent];
  const active = game.players[game.activePlayer];
  const totals = victoryTotals(game);
  const selectedCard = handCardByUid(game, game.activePlayer, selectedCardUid);
  const boardActionActive = Boolean(aquaticAction || facultativeAction);
  const creatureLanes = selectedCard?.definition.kind === "creature"
    ? facultativeAction
      ? []
      : aquaticAction?.kind === "override"
      ? legalAquaticOverrideLanes(game, selectedCard)
      : legalCreatureLanes(game, game.activePlayer, selectedCard)
    : [];
  const adaptationTargets = !boardActionActive && selectedCard?.definition.kind === "adaptation" ? legalAdaptationTargets(game, selectedCard) : [];
  const adaptationLanes = adaptationTargets.map((position) => position.laneIndex);
  const wildfireLanes = !boardActionActive && selectedCard?.definition.key === "wildfire" ? legalWildfireLanes(game, selectedCard) : [];
  const droughtTargets = !boardActionActive && selectedCard?.definition.key === "drought" ? legalDroughtTargets(game, selectedCard) : [];
  const legalSelectedLanes = selectedCard?.definition.kind === "creature"
    ? creatureLanes
    : selectedCard?.definition.kind === "adaptation"
      ? adaptationLanes
      : selectedCard?.definition.key === "drought"
        ? droughtTargets.map((position) => position.laneIndex)
        : wildfireLanes;
  const isLegalSelectedPosition = (playerId: PlayerId, laneIndex: number) => {
    if (!selectedCard) return false;
    if (selectedCard.definition.kind === "creature" || selectedCard.definition.key === "wildfire") {
      return playerId === game.activePlayer && legalSelectedLanes.includes(laneIndex);
    }
    if (selectedCard.definition.kind === "adaptation") {
      return adaptationTargets.some((position) => position.playerId === playerId && position.laneIndex === laneIndex);
    }
    if (selectedCard.definition.key === "drought") {
      return droughtTargets.some((position) => position.playerId === playerId && position.laneIndex === laneIndex);
    }
    return false;
  };
  const attackTargets = selectedAttackerUid ? legalAttackTargets(game, selectedAttackerUid) : [];
  const conceptLimit = conceptAllowance(game, game.activePlayer);
  const legalHuntsAvailable = hasLegalHunts(game, game.activePlayer);
  const carnianPluvialActive = active.event?.definition.key === "carnian-pluvial-episode";
  const facultativeSources = legalFacultativeSources(game);

  const commit = (next: GameState, clearCard = true, clearAttacker = true) => {
    const latestDrawId = game.drawEvents.at(-1)?.id ?? 0;
    const newDraws = next.drawEvents.filter((event) => event.id > latestDrawId);
    const completedDeferredChoice =
      game.pendingConceptChoice?.kind === "genetic-drift-discard" &&
      next.pendingConceptChoice?.kind !== "genetic-drift-discard";
    if (newDraws.length) {
      if (next.pendingConceptChoice?.kind === "genetic-drift-discard") {
        setDeferredDraws((queue) => [...queue, ...newDraws]);
      } else {
        setDrawQueue((queue) => [...queue, ...newDraws]);
      }
    }
    if (completedDeferredChoice && deferredDraws.length) {
      setDrawQueue((queue) => [...queue, ...deferredDraws]);
      setDeferredDraws([]);
    }
    setGame(next);
    if (next.handoff || next.activePlayer !== game.activePlayer) {
      setPinnedInspection(null);
      setHoverInspection(null);
      setSidewallTab("log");
      setAquaticAction(null);
      setFacultativeAction(null);
    }
    if (clearCard) setSelectedCardUid(null);
    if (clearAttacker) setSelectedAttackerUid(null);
  };

  const handleLaneClick = (playerId: PlayerId, laneIndex: number) => {
    const lane = game.players[playerId].lanes[laneIndex];
    if (facultativeAction?.kind === "source" && playerId === game.activePlayer && legalFacultativeSources(game).includes(laneIndex)) {
      setFacultativeAction({ kind: "destination", sourceLane: laneIndex });
      setSelectedCardUid(null);
      return;
    }
    if (
      facultativeAction?.kind === "destination" &&
      playerId === game.activePlayer &&
      legalFacultativeDestinations(game, facultativeAction.sourceLane).includes(laneIndex)
    ) {
      commit(moveFacultativeQuadrupedality(game, facultativeAction.sourceLane, laneIndex), false, false);
      setFacultativeAction(null);
      return;
    }
    if (aquaticAction?.kind === "source" && playerId === game.activePlayer && legalConnectedWaterwaySources(game).includes(laneIndex)) {
      setAquaticAction({ kind: "destination", sourceLane: laneIndex });
      setSelectedCardUid(null);
      return;
    }
    if (aquaticAction?.kind === "destination" && playerId === game.activePlayer && legalConnectedWaterwayDestinations(game, aquaticAction.sourceLane).includes(laneIndex)) {
      commit(repositionConnectedWaterway(game, aquaticAction.sourceLane, laneIndex), false, false);
      setAquaticAction(null);
      return;
    }
    if (aquaticAction?.kind === "override" && selectedCard?.definition.kind === "creature" && playerId === game.activePlayer && creatureLanes.includes(laneIndex)) {
      commit(playAquaticOverride(game, selectedCard.uid, laneIndex));
      setAquaticAction(null);
      return;
    }
    if (game.pendingCranialDisplay && lane.creature && game.pendingCranialDisplay.eligibleTargetUids.includes(lane.creature.card.uid)) {
      commit(chooseCranialDisplayTarget(game, lane.creature.card.uid));
      return;
    }
    if (selectedCard && isLegalSelectedPosition(playerId, laneIndex)) {
      if (selectedCard.definition.kind === "creature") commit(playCreature(game, playerId, selectedCard.uid, laneIndex));
      if (selectedCard.definition.kind === "adaptation") commit(playAdaptation(game, selectedCard.uid, laneIndex, playerId));
      if (selectedCard.definition.key === "wildfire") commit(playWildfire(game, selectedCard.uid, laneIndex));
      if (selectedCard.definition.key === "drought") commit(playDrought(game, selectedCard.uid, playerId, laneIndex));
      return;
    }
    if (game.phase === "battle" && lane.creature) {
      if (playerId === game.activePlayer) {
        const uid = lane.creature.card.uid;
        setSelectedAttackerUid(selectedAttackerUid === uid ? null : uid);
        setSelectedCardUid(null);
        return;
      }
      if (selectedAttackerUid && attackTargets.includes(lane.creature.card.uid)) {
        commit(previewBattle(game, selectedAttackerUid, lane.creature.card.uid), false, false);
      }
    }
  };

  const laneHighlighted = (playerId: PlayerId, laneIndex: number) => {
    const lane = game.players[playerId].lanes[laneIndex];
    if (facultativeAction?.kind === "source" && playerId === game.activePlayer) return legalFacultativeSources(game).includes(laneIndex);
    if (facultativeAction?.kind === "destination" && playerId === game.activePlayer) return legalFacultativeDestinations(game, facultativeAction.sourceLane).includes(laneIndex);
    if (aquaticAction?.kind === "source" && playerId === game.activePlayer) return legalConnectedWaterwaySources(game).includes(laneIndex);
    if (aquaticAction?.kind === "destination" && playerId === game.activePlayer) return legalConnectedWaterwayDestinations(game, aquaticAction.sourceLane).includes(laneIndex);
    if (game.pendingCranialDisplay && lane.creature) return game.pendingCranialDisplay.eligibleTargetUids.includes(lane.creature.card.uid);
    if (selectedCard) return isLegalSelectedPosition(playerId, laneIndex);
    if (selectedAttackerUid && lane.creature && playerId !== game.activePlayer) return attackTargets.includes(lane.creature.card.uid);
    if (game.phase === "battle" && playerId === game.activePlayer && lane.creature) return legalAttackTargets(game, lane.creature.card.uid).length > 0;
    return false;
  };

  const handleCommitBattle = () => {
    const plan = battleCoinPlan(game);
    if (plan.offensiveCount + plan.defensiveCount === 0) {
      commit(commitBattle(game));
      return;
    }
    const results: BattleCoinResults = {
      offensive: Array.from({ length: plan.offensiveCount }, () => Math.random() < 0.5),
      defensive: Array.from({ length: plan.defensiveCount }, () => Math.random() < 0.5),
    };
    setCoin({ stage: "flipping", results, rerolling: null });
    window.setTimeout(() => setCoin({ stage: "result", results, rerolling: null }), 850);
  };

  const handleRerollCoin = (group: "offensive" | "defensive", index: number, playerId: PlayerId) => {
    if (!coin || coin.stage !== "result" || !canUseTemperateReroll(game, playerId)) return;
    const results: BattleCoinResults = {
      offensive: [...(coin.results.offensive ?? [])],
      defensive: [...(coin.results.defensive ?? [])],
    };
    const groupResults = results[group];
    if (!groupResults || index < 0 || index >= groupResults.length) return;
    groupResults[index] = Math.random() < 0.5;
    setGame(spendTemperateReroll(game, playerId));
    setCoin({ stage: "flipping", results, rerolling: { group, index } });
    window.setTimeout(() => setCoin({ stage: "result", results, rerolling: null }), 850);
  };

  const resolveCoinBattle = () => {
    if (!coin || coin.stage !== "result") return;
    commit(commitBattle(game, coin.results));
    setCoin(null);
  };

  const privateHandHidden = Boolean(game.handoff);
  const phaseName = game.phase === "start" ? "Start Phase" : game.phase === "development" ? "Development Phase" : game.phase === "battle" ? "Battle Phase" : "Handoff";

  return (
    <main className={`game-page mobile-${mobileView}`}>
      <header className="game-header">
        <div><div className="eyebrow">Prehistoric Card Game</div><h1>Local playtest</h1></div>
        <div className="turn-summary"><span>Turn {game.turnNumber}</span><strong>{active.name}’s {phaseName}</strong></div>
        <div className="header-controls">
          <label className="debug-toggle"><input type="checkbox" checked={revealAll} onChange={(event) => setRevealAll(event.target.checked)} /><span>Reveal-all debug</span></label>
          <button className="quiet-button inspector-drawer-toggle" onClick={() => setSidewallOpen(!sidewallOpen)}>{sidewallOpen ? "Close inspector" : "Inspector"}</button>
          <button className="quiet-button" onClick={() => setShowRules(!showRules)}>{showRules ? "Close rules" : "Rules"}</button>
          <button className="quiet-button" onClick={() => { setGame(null); setPregame(null); setOpeningDeal(null); setDrawQueue([]); setDeferredDraws([]); setAquaticAction(null); setFacultativeAction(null); setPinnedInspection(null); setHoverInspection(null); }}>New game</button>
        </div>
      </header>

      <nav className="mobile-view-switcher" aria-label="Game views">
        <button className={mobileView === "board" ? "active" : ""} onClick={() => setMobileView("board")}>Board</button>
        <button className={mobileView === "hand" ? "active" : ""} onClick={() => setMobileView("hand")}>Hand</button>
        <button className={mobileView === "inspect" ? "active" : ""} onClick={() => setMobileView("inspect")}>Inspect</button>
      </nav>

      <div className="game-layout">
        <section className="board" aria-label="Game board">
          <section className="table-board-region">
            <div
              className={`biome-board-half opponent-biome-half biome-${opponentState.biome.key ?? "none"}`}
              style={biomeBoardStyle(opponentState.biome.key)}
              aria-label={`${opponentState.name} ${opponentState.biome.key ? biomeByKey(opponentState.biome.key).name : "unselected"} Biome battlefield`}
            >
              <div className="player-ribbon opponent-ribbon">
                <div className="player-identity"><small>Opponent</small><strong>{opponentState.name}</strong>{opponentState.biome.key && <span className="biome-ribbon-badge">{biomeByKey(opponentState.biome.key).name}</span>}</div>
                <div className="ribbon-event"><EventZone game={game} playerId={opponent} onPin={pinInspection} onPreview={previewInspection} /></div>
                <div className="score-pill"><span>Victory</span><b>{totals[opponent]} / 12</b></div>
                <div className="pile-counts"><span>Deck {opponentState.deck.length}</span><span className="hand-counter">Hand {opponentState.hand.length}</span><button onClick={() => openHistory(opponent)}>History {opponentState.history.length}</button></div>
              </div>

              <div className="lanes opponent-lanes">
                {LANES.map((laneIndex) => <NicheLane key={laneIndex} game={game} playerId={opponent} laneIndex={laneIndex} opponentRow selectedAttackerUid={selectedAttackerUid} highlighted={laneHighlighted(opponent, laneIndex)} onLaneClick={() => handleLaneClick(opponent, laneIndex)} onPin={pinInspection} onPreview={previewInspection} />)}
              </div>
            </div>

            <div className="centerline"><span>{game.periodAuras.length
              ? game.periodAuras.map((aura) => `Geological Boundary · ${aura.period} +1 Battle Level`).join(" · ")
              : "Directly opposing Niches"}</span></div>

            <div
              className={`biome-board-half player-biome-half biome-${viewer.biome.key ?? "none"}`}
              style={biomeBoardStyle(viewer.biome.key)}
              aria-label={`${viewer.name} ${viewer.biome.key ? biomeByKey(viewer.biome.key).name : "unselected"} Biome battlefield`}
            >
              <div className="lanes player-lanes">
                {LANES.map((laneIndex) => <NicheLane key={laneIndex} game={game} playerId={viewPlayer} laneIndex={laneIndex} opponentRow={false} selectedAttackerUid={selectedAttackerUid} highlighted={laneHighlighted(viewPlayer, laneIndex)} onLaneClick={() => handleLaneClick(viewPlayer, laneIndex)} onPin={pinInspection} onPreview={previewInspection} />)}
              </div>

              <div className="player-ribbon active-ribbon">
                <div className="player-identity"><small>Active player</small><strong>{viewer.name}</strong>{viewer.biome.key && <span className="biome-ribbon-badge">{biomeByKey(viewer.biome.key).name}</span>}</div>
                <div className="ribbon-event"><EventZone game={game} playerId={viewPlayer} onPin={pinInspection} onPreview={previewInspection} /></div>
                <div className="score-pill"><span>Victory</span><b>{totals[viewPlayer]} / 12</b></div>
                <div className="pile-counts"><span>Deck {viewer.deck.length}</span><span>Hand {viewer.hand.length}</span><button onClick={() => openHistory(viewPlayer)}>History {viewer.history.length}</button></div>
              </div>
            </div>
          </section>

          <section className="hand-workspace">
            <section className="action-bar" aria-label="Turn controls and selected-card actions">
              <div className="phase-actions">
                {game.phase === "development" && <button className="primary-button" disabled={active.allowances.rapidSpeciation || boardActionActive} onClick={() => commit(advanceToBattleOrEndTurn(game), false)}>{active.allowances.skipBattlePhase ? "End Turn · Battle skipped" : legalHuntsAvailable ? "Enter Battle Phase" : "End Turn"}</button>}
                {game.phase === "battle" && <p>{selectedAttackerUid ? (attackTargets.length ? "Choose a highlighted target." : "No legal target.") : "Choose a ready hunter."}</p>}
                {carnianPluvialActive && <button className="quiet-button" disabled={!canActivateCarnianPluvialEpisode(game)} onClick={() => commit(activateCarnianPluvialEpisode(game), false, false)}>{active.allowances.carnianPluvialUsed ? "Carnian used" : "Use Carnian Pluvial"}</button>}
                {game.phase === "development" && facultativeSources.length > 0 && <button className="quiet-button" disabled={Boolean(aquaticAction)} onClick={() => { setFacultativeAction(facultativeAction ? null : { kind: "source" }); setSelectedCardUid(null); setSelectedAttackerUid(null); }}>{facultativeAction ? "Cancel movement" : "Use Facultative Movement"}</button>}
                {active.hand.length === 10 && !active.fullHandMulliganUsed && active.allowances.developmentActions === 0 && game.phase === "development" && <button className="quiet-button" onClick={() => commit(performFullHandMulligan(game))}>Mulligan</button>}
              </div>

              {selectedCard ? (
                <CardInspector
                  game={game}
                  card={selectedCard}
                  legalLanes={legalSelectedLanes}
                  aquaticOverride={aquaticAction?.kind === "override"}
                  onClose={() => setSelectedCardUid(null)}
                  onPlayEvent={() => commit(playEvent(game, selectedCard.uid))}
                  onPlayConcept={() => commit(playConcept(game, selectedCard.uid))}
                />
              ) : <div className="selected-action-empty"><small>Selected card</small><span>{facultativeAction?.kind === "source" ? "Choose the Creature with Facultative Quadrupedality." : facultativeAction?.kind === "destination" ? "Choose an empty adjacent destination." : aquaticAction?.kind === "source" ? "Choose a Creature to reposition." : aquaticAction?.kind === "destination" ? "Choose its empty destination Niche." : aquaticAction?.kind === "override" ? "Choose a Creature card for the free override." : "None"}</span></div>}

              <ActiveBiomeControl
                game={game}
                action={aquaticAction}
                onReposition={() => { setFacultativeAction(null); setAquaticAction({ kind: "source" }); setSelectedCardUid(null); setSelectedAttackerUid(null); }}
                onOverride={() => { setFacultativeAction(null); setAquaticAction({ kind: "override" }); setSelectedCardUid(null); setSelectedAttackerUid(null); }}
                onCancel={() => { setAquaticAction(null); setSelectedCardUid(null); }}
              />

              <div className="turn-end-actions">
                <button className="quiet-button" disabled={boardActionActive} onClick={() => commit(endTurn(game))}>End turn</button>
                <button className="quiet-button" disabled={!selectedCardUid && !selectedAttackerUid} onClick={() => { setSelectedCardUid(null); setSelectedAttackerUid(null); }}>Cancel</button>
                <button className="text-button" onClick={() => commit(concedeByExtinction(game))}>Concede</button>
              </div>
              {game.pendingCranialDisplay && <div className="mandatory-control-prompt" role="alert"><strong>Cranial Display</strong><span>Choose a highlighted opposing Creature.</span></div>}
            </section>

            <section className="hand-zone">
              <div className="section-heading">
                <div><small>{privateHandHidden ? "Hand covered" : "Private hand"}</small><h2>{privateHandHidden ? "Private hand sealed for handoff" : selectedCard ? selectedCard.definition.name : "Choose a card to play; hover to inspect"}</h2></div>
                <div className="hand-turn-status">
                  <span className="turn-phase-label">Turn {game.turnNumber} · {game.phase === "start" ? "Start" : game.phase === "development" ? "Development" : game.phase === "battle" ? "Battle" : "Handoff"}</span>
                  <div className="allowances">
                    <span className={active.allowances.creaturePlayed ? "used" : ""}>Creature {active.allowances.creaturePlayed ? "used" : "1"}</span>
                    <span className={active.allowances.adaptationPlayed ? "used" : ""}>Adaptation {active.allowances.adaptationPlayed ? "used" : "1"}</span>
                    <span className={active.allowances.eventPlayed ? "used" : ""}>Event {active.allowances.eventPlayed ? "used" : "1"}</span>
                    <span className={active.allowances.conceptsPlayed >= conceptLimit ? "used" : ""}>Concept {active.allowances.conceptsPlayed}/{conceptLimit}</span>
                    {active.allowances.skipBattlePhase && <span className="used">Battle skipped</span>}
                  </div>
                </div>
              </div>
              {privateHandHidden ? <div className="covered-hand"><CardBack /><CardBack /><CardBack /><p>The next player’s cards stay out of the page until they confirm the handoff.</p></div> : (
                <div className="hand-scroll">
                  {active.hand.map((card) => {
                    const target = { definition: card.definition };
                    return <button className="hand-card-button" key={card.uid} onClick={() => { pinInspection(target); setSelectedCardUid(selectedCardUid === card.uid ? null : card.uid); setSelectedAttackerUid(null); setFacultativeAction(null); if (aquaticAction?.kind !== "override") setAquaticAction(null); }} {...inspectionHandlers(target, previewInspection, pinInspection)}><CardFace card={card.definition} compact selected={selectedCardUid === card.uid} /></button>;
                  })}
                </div>
              )}
            </section>
          </section>
        </section>

        <aside className={`side-rail ${sidewallOpen ? "open" : ""}`}>
          <SidewallInspection
            target={activeInspection}
            activeTab={sidewallTab}
            onTabChange={setSidewallTab}
            onClose={() => {
              if (activeInspection) {
                setPinnedInspection(null);
                setHoverInspection(null);
                setSidewallTab("log");
              } else {
                setSidewallOpen(false);
                setMobileView("board");
              }
            }}
            game={game}
            historyViewer={historyViewer}
            onHistoryViewer={setHistoryViewer}
            onPin={pinInspection}
            onPreview={previewInspection}
            pinned={Boolean(pinnedInspection)}
          />
        </aside>
        {sidewallOpen && <button className="sidewall-scrim" aria-label="Close inspector" onClick={() => setSidewallOpen(false)} />}
      </div>

      {showRules && <RulesDrawer onClose={() => setShowRules(false)} />}
      {game.handoff && <HandoffOverlay game={game} revealAll={revealAll} onContinue={() => commit(acknowledgeHandoff(game), false, false)} />}
      {game.pendingBiodiversity && <BiodiversityModal game={game} onChoose={(uid) => commit(chooseBiodiversityTop(game, uid), false, false)} />}
      {game.pendingFilterFeeder && <FilterFeederModal game={game} onChoose={(uid) => commit(chooseFilterFeederTop(game, uid), false, false)} />}
      {game.pendingGeologicalBoundary && <GeologicalBoundaryModal game={game} onChoose={(period) => commit(chooseGeologicalBoundaryPeriod(game, period), false, false)} />}
      {game.pendingEngulf && <EngulfModal game={game} onChoose={(accept) => commit(chooseEngulf(game, accept), false, false)} />}
      {game.pendingConvergentChoice && <ConvergentChoiceModal game={game} onChoose={(category) => commit(chooseConvergentCategory(game, category), false, false)} />}
      {(game.pendingHerd || game.pendingNesting) && <EntryChoiceModal game={game} onChoose={(id) => commit(game.pendingHerd ? chooseHerd(game, id) : chooseNesting(game, id), false, false)} />}
      {game.pendingConceptChoice && <ConceptChoiceModal game={game} onChoose={(id) => commit(chooseConceptOption(game, id), false, false)} />}
      {game.pendingCarnianPluvial && <CarnianPluvialChoiceModal game={game} onChoose={(id) => commit(chooseCarnianPluvialOption(game, id), false, false)} />}
      {game.pendingBattle && <BattleModal game={game} coin={coin} onCancel={() => commit(cancelBattlePreview(game), false, false)} onCommit={handleCommitBattle} onResolve={resolveCoinBattle} onReroll={handleRerollCoin} />}
      {game.winner !== null && <WinnerOverlay game={game} onRestart={() => { setGame(null); setPregame(null); setOpeningDeal(null); setDrawQueue([]); setDeferredDraws([]); setAquaticAction(null); setFacultativeAction(null); }} />}
      {openingDeal && <OpeningDealOverlay players={openingDeal.players} decks={openingDeal.decks} choices={openingDeal.choices} dealt={openingDeal.dealt} />}
      {drawQueue[0] && <DrawPresentation game={game} event={drawQueue[0]} />}
    </main>
  );
}

function CardInspector({ game, card, legalLanes, aquaticOverride = false, onClose, onPlayEvent, onPlayConcept }: { game: GameState; card: CardInstance; legalLanes: number[]; aquaticOverride?: boolean; onClose: () => void; onPlayEvent: () => void; onPlayConcept: () => void }) {
  const definition = card.definition;
  const active = game.players[game.activePlayer];
  const instruction = definition.kind === "creature"
    ? aquaticOverride
      ? legalLanes.length
        ? `Choose one of ${legalLanes.length} highlighted Niches for the free override.`
        : "This Creature has no legal free override."
      : active.allowances.rapidSpeciation
      ? "Choose a highlighted occupied Niche exactly two Levels lower."
      : legalLanes.length
        ? `Choose one of ${legalLanes.length} highlighted legal Niches.`
        : "No legal Niche."
    : definition.kind === "adaptation"
      ? legalLanes.length
        ? `Choose one of ${legalLanes.length} highlighted eligible Niches.`
        : "No eligible Adaptation position."
      : definition.key === "drought"
        ? legalLanes.length
          ? `Choose one of ${legalLanes.length} highlighted Niches on either side.`
          : "No legal Niche for Drought."
      : definition.key === "wildfire"
        ? legalLanes.length
          ? `Choose one of ${legalLanes.length} highlighted unlocked Niches on your side.`
          : "No legal lane for Wildfire."
      : null;
  return (
    <section className="card-inspector">
      <div className="selected-card-summary"><small>Selected card</small><strong>{definition.name}</strong>{instruction && <span>{instruction}</span>}</div>
      <div className="selected-card-actions">
        {definition.kind === "event" && !["wildfire", "drought"].includes(definition.key) && <button className="primary-button" disabled={aquaticOverride || !canPlayEvent(game, card)} onClick={onPlayEvent}>Play Event</button>}
        {definition.kind === "concept" && <button className="primary-button" disabled={aquaticOverride || !canPlayConcept(game, card)} onClick={onPlayConcept}>Play Concept</button>}
        {(definition.kind === "creature" || definition.kind === "adaptation" || definition.key === "wildfire" || definition.key === "drought") && <span className={legalLanes.length ? "legal" : "blocked"}>{legalLanes.length ? "Board selection ready" : "Currently blocked"}</span>}
      </div>
      <button className="clear-selected" onClick={onClose} aria-label="Clear selected card">×</button>
    </section>
  );
}

function RulesDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="rules-drawer" role="dialog" aria-label="Quick rules reference">
      <header><div><div className="eyebrow">Three-deck implementation</div><h2>Quick rules reference</h2></div><button onClick={onClose}>×</button></header>
      <section><h3>Turn</h3><ol><li>Draw, return marked Living Fossils, and resolve start effects.</li><li>Interleave one Creature, one Adaptation, one Event, and normally one Concept play.</li><li>Resourceful raises the Concept allowance to two, but every Concept must fully resolve independently.</li><li>Each ready Creature may initiate one legal Hunt.</li><li>Resolve end effects and pass the device.</li></ol></section>
      <section><h3>Biomes</h3><p>Each player privately chooses a Biome before opening hands are dealt. Both choices are then revealed and remain active for the entire game.</p><dl className="tag-glossary">{BIOMES.map((biome) => <div key={biome.key}><dt>{biome.name} · {biome.abilityName}</dt><dd>{biome.shortRules}</dd></div>)}</dl></section>
      <section><h3>Override</h3><p>Match at least three of Diet, Time Period, Primary Taxon, and Tag, then obey Level progression. Equal-Level overrides are legal. A printed Aquatic Creature may interact only with a Creature that counts as Aquatic; Semi-Aquatic satisfies that gate without becoming restricted against other Creatures. When the occupied Creature has Aquatic, the pair gets a Primary Taxon match—or a Tag match instead if their Primary Taxa already match. When the occupied Creature has Semi-Aquatic, an Aquatic or Semi-Aquatic incoming Creature gets only a Tag match.</p></section>
      <section><h3>Hunt</h3><p>Selecting a target opens a projected Battle Level preview, including any Battle Coin range. Canceling consumes nothing. Lower Battle Level is destroyed after Commit Hunt; a tie normally destroys neither Creature unless an effect says otherwise.</p></section>
      <section><h3>Implementation rulings</h3><ul>{IMPLEMENTATION_REGISTER.rulesChanges.slice(1).map((entry) => <li key={entry.title}><strong>{entry.title}:</strong> {entry.rule}</li>)}</ul></section>
      <section><h3>Tag glossary</h3><dl className="tag-glossary">{Object.entries(TAG_RULES).map(([tag, rule]) => <div key={tag}><dt>{tag}</dt><dd>{rule}</dd></div>)}</dl></section>
    </div>
  );
}
