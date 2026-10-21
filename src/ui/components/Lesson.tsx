import { type CSSProperties, type MutableRefObject, type RefObject, useEffect, useMemo, useRef, useState } from "react";

import { CARD_LIBRARY } from "../../data/cards.ts";
import {
  type LessonAnnotation,
  type LessonCopyPart,
  type LessonDefinition,
  LESSON_GLOSSARY,
  LESSONS,
  LESSONS_BY_ID,
} from "../../data/lessons.ts";
import { readJson, writeJson } from "../storage.ts";
import { CardFace } from "./CardFace.tsx";

type LessonRuntimeState = { lessonId: string; cardIndex: number; furthestViewed: number };
type LeaderLine = { id: string; path: string; startX: number; startY: number };

const SEEN_KEY = "pcg.lessons.seen";
const RECENT_KEY = "pcg.lessons.recent";

const readIds = (storage: "session" | "local", key: string) => {
  const value = readJson<unknown>(storage, key, []);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
};

/** Prefers Lessons not yet seen this session, then the least recently seen. */
function chooseCuratedLesson(currentLessonId?: string): LessonDefinition {
  const candidates = LESSONS.filter((lesson) => lesson.id !== currentLessonId);
  const eligible = candidates.length ? candidates : LESSONS;
  const sessionSeen = new Set(readIds("session", SEEN_KEY));
  const recent = readIds("local", RECENT_KEY);
  const unseen = eligible.filter((lesson) => !sessionSeen.has(lesson.id));
  const pool = unseen.length ? unseen : eligible;
  const score = (id: string) => {
    const index = recent.indexOf(id);
    return index < 0 ? recent.length + 1 : index;
  };
  const weighted = [...pool].sort((a, b) => score(b.id) - score(a.id));
  const leastRecentCount = Math.max(1, Math.ceil(weighted.length / 2));
  return weighted[Math.floor(Math.random() * leastRecentCount)]!;
}

function rememberLesson(lessonId: string) {
  writeJson("session", SEEN_KEY, [...new Set([...readIds("session", SEEN_KEY), lessonId])]);
  writeJson(
    "local",
    RECENT_KEY,
    [lessonId, ...readIds("local", RECENT_KEY).filter((id) => id !== lessonId)].slice(0, 8),
  );
}

function LessonCopy({
  parts,
  onLinkedLesson,
}: {
  parts: LessonCopyPart[];
  onLinkedLesson: (lessonId: string) => void;
}) {
  return (
    <>
      {parts.map((part, index) => {
        const glossary = part.glossaryId ? LESSON_GLOSSARY[part.glossaryId] : null;
        const key = `${part.text}-${index}`;
        if (part.linkedLessonId) {
          return (
            <span className="lesson-term-wrap" key={key}>
              <button className="lesson-linked-term" onClick={() => onLinkedLesson(part.linkedLessonId!)}>
                {part.text}
              </button>
              {glossary && (
                <span className="lesson-term-definition" role="tooltip">
                  {glossary.definition}
                </span>
              )}
            </span>
          );
        }
        if (glossary) {
          return (
            <span
              className="lesson-term-wrap"
              key={key}
              tabIndex={0}
              aria-label={`${glossary.term}: ${glossary.definition}`}
            >
              <strong className="lesson-glossary-term">{part.text}</strong>
              <span className="lesson-term-definition" role="tooltip">
                {glossary.definition}
              </span>
            </span>
          );
        }
        return part.emphasis ? <em key={key}>{part.text}</em> : <span key={key}>{part.text}</span>;
      })}
    </>
  );
}

type LessonProgressProps = {
  lesson: LessonDefinition;
  state: LessonRuntimeState;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
};

function LessonProgress({ lesson, state, onPrevious, onNext, onRestart }: LessonProgressProps) {
  const isFinal = state.cardIndex === lesson.cards.length - 1;
  const visibleStack = lesson.cards.slice(state.cardIndex, state.cardIndex + 3);
  return (
    <section className="lesson-progress" aria-label="Lesson progress">
      <div className="lesson-card-stack" aria-hidden="true">
        {[...visibleStack].reverse().map((cardState, index) => {
          const card = CARD_LIBRARY.get(cardState.cardKey);
          return card ? (
            <div key={`${cardState.cardKey}-${index}`} style={{ "--stack-index": index } as CSSProperties}>
              <CardFace card={card} compact />
            </div>
          ) : null;
        })}
      </div>
      <div className="lesson-progress-copy">
        <strong>
          {state.cardIndex + 1} of {lesson.cards.length}
        </strong>
        <span>Explore more related cards in this lesson.</span>
      </div>
      <div className="lesson-progress-dots" aria-hidden="true">
        {lesson.cards.map((_, index) => (
          <i
            key={index}
            className={index === state.cardIndex ? "current" : index <= state.furthestViewed ? "completed" : "upcoming"}
          />
        ))}
      </div>
      <div className="lesson-progress-actions">
        <button className="lesson-small-button" disabled={state.cardIndex === 0} onClick={onPrevious}>
          Previous Card
        </button>
        <button className="lesson-small-button primary" onClick={isFinal ? onRestart : onNext}>
          {isFinal ? "Restart Lesson" : "Next Card"}
        </button>
      </div>
    </section>
  );
}

type LeaderLinesProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  cardRef: RefObject<HTMLDivElement | null>;
  annotations: LessonAnnotation[];
  annotationRefs: MutableRefObject<Record<string, HTMLElement | null>>;
};

/** Curved callout lines from each annotation box to its target point on the card. */
function LessonLeaderLines({ containerRef, cardRef, annotations, annotationRefs }: LeaderLinesProps) {
  const [geometry, setGeometry] = useState<{ width: number; height: number; lines: LeaderLine[] }>({
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
        const targetX = cardRect.left - containerRect.left + (cardRect.width * annotation.target.xPercent) / 100;
        const targetY = cardRect.top - containerRect.top + (cardRect.height * annotation.target.yPercent) / 100;
        const horizontalDistance = Math.max(24, targetX - startX);
        const firstControlX = startX + horizontalDistance * 0.34;
        const secondControlX = startX + horizontalDistance * 0.68;
        return [
          {
            id: annotation.id,
            path: `M ${startX} ${startY} C ${firstControlX} ${startY}, ${secondControlX} ${targetY}, ${targetX} ${targetY}`,
            startX,
            startY,
          },
        ];
      });
      setGeometry({ width: Math.max(1, containerRect.width), height: Math.max(1, containerRect.height), lines });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(card);
    for (const annotation of annotations) {
      const box = annotationRefs.current[annotation.id];
      if (box) observer.observe(box);
    }
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

export function LessonExperience({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<LessonRuntimeState>(() => ({
    lessonId: chooseCuratedLesson().id,
    cardIndex: 0,
    furthestViewed: 0,
  }));
  const [previousState, setPreviousState] = useState<LessonRuntimeState | null>(null);
  const [showAllSources, setShowAllSources] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lessonBodyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const annotationRefs = useRef<Record<string, HTMLElement | null>>({});

  const lesson = LESSONS_BY_ID.get(state.lessonId) ?? LESSONS[0]!;
  const cardState = lesson.cards[state.cardIndex]!;
  const card = CARD_LIBRARY.get(cardState.cardKey);
  const orderedAnnotations = useMemo(
    () => [...cardState.annotations].sort((left, right) => left.target.yPercent - right.target.yPercent),
    [cardState.annotations],
  );
  const hasAnotherLesson = LESSONS.some((candidate) => candidate.id !== lesson.id);

  useEffect(() => rememberLesson(lesson.id), [lesson.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
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
      const focusable = [
        ...rootRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'),
      ].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
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
  const copy = (parts: LessonCopyPart[]) => <LessonCopy parts={parts} onLinkedLesson={setPendingLessonId} />;

  return (
    <div className="lesson-overlay" role="dialog" aria-modal="true" aria-labelledby="lesson-title" ref={rootRef}>
      <section className="lesson-frame">
        <header className="lesson-header">
          <div className="lesson-back-slot">
            {previousState && (
              <button className="lesson-back-button" onClick={restorePreviousLesson}>
                ← Back to Previous Lesson
              </button>
            )}
          </div>
          <div className="lesson-heading">
            <span>Learn Something</span>
            <h1 id="lesson-title">{lesson.title}</h1>
            <p>{lesson.hook}</p>
          </div>
          <button className="lesson-close" ref={closeButtonRef} onClick={onClose} aria-label="Close Lesson">
            ×
          </button>
        </header>

        <div className="lesson-body" ref={lessonBodyRef}>
          <section className="lesson-left-region" aria-label="Card annotations">
            {lesson.cards.length > 1 && (
              <LessonProgress
                lesson={lesson}
                state={state}
                onPrevious={() => setState((current) => ({ ...current, cardIndex: current.cardIndex - 1 }))}
                onNext={() =>
                  setState((current) => ({
                    ...current,
                    cardIndex: current.cardIndex + 1,
                    furthestViewed: Math.max(current.furthestViewed, current.cardIndex + 1),
                  }))
                }
                onRestart={() => setState((current) => ({ ...current, cardIndex: 0, furthestViewed: 0 }))}
              />
            )}
            <div className="lesson-annotation-list">
              {orderedAnnotations.map((annotation) => (
                <article
                  className="lesson-info-box lesson-annotation-box"
                  key={annotation.id}
                  ref={(node) => {
                    annotationRefs.current[annotation.id] = node;
                  }}
                >
                  <span>{annotation.kicker}</span>
                  <h2>{annotation.title}</h2>
                  <p>{copy(annotation.copy)}</p>
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
            ) : (
              <div className="lesson-card-missing">Canonical card unavailable.</div>
            )}
          </section>

          <section className="lesson-right-region" aria-label="Lesson context and evidence">
            <div className="lesson-auxiliary-grid">
              {cardState.infoBoxes.map((box) => (
                <article className={`lesson-info-box ${box.tone === "uncertainty" ? "uncertainty" : ""}`} key={box.id}>
                  <span>{box.kicker}</span>
                  <h2>{box.title}</h2>
                  <p>{copy(box.copy)}</p>
                </article>
              ))}
            </div>
            <article className="lesson-evidence">
              <header>
                <div>
                  <span>Evidence</span>
                  <h2>{cardState.evidenceTitle}</h2>
                </div>
                <button onClick={() => setShowEvidence(true)}>Inspect Evidence</button>
              </header>
              <p>{copy(cardState.evidenceIntro)}</p>
              <ol>
                {cardState.evidenceItems.map((item) => (
                  <li key={item.id}>
                    <span>{item.status}</span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{copy(item.copy)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </article>
          </section>
          <LessonLeaderLines
            containerRef={lessonBodyRef}
            cardRef={cardRef}
            annotations={orderedAnnotations}
            annotationRefs={annotationRefs}
          />
        </div>

        <footer className="lesson-footer">
          <section className="lesson-sources-summary" aria-label="Sources and further reading">
            <div>
              <span>Sources / Further Reading</span>
              <strong>{featuredSources.map((source) => source.shortTitle).join(" · ")}</strong>
            </div>
            <button onClick={() => setShowAllSources(true)}>View All Sources</button>
          </section>
          <p className="lesson-footer-thought">
            Science changes as evidence improves.
            <br />
            <em>Keep questioning the reconstruction.</em>
          </p>
          <button
            className="lesson-show-another"
            disabled={!hasAnotherLesson}
            title={hasAnotherLesson ? "Open another Lesson" : "More Lessons are being prepared"}
            onClick={() => transitionToLesson(chooseCuratedLesson(lesson.id).id)}
          >
            Show Another
          </button>
        </footer>
      </section>

      <section className="lesson-size-warning" aria-label="Lesson size warning">
        <button onClick={onClose} aria-label="Close Lesson">
          ×
        </button>
        <span>Learn Something</span>
        <h2>This Lesson needs a little more room.</h2>
        <p>
          Enlarge the browser window or rotate to a wider screen so the card, annotations, and Evidence can remain
          readable together.
        </p>
      </section>

      {showEvidence && (
        <div className="lesson-secondary-scrim">
          <section
            className="lesson-secondary-overlay evidence-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="evidence-detail-title"
          >
            <header>
              <div>
                <span>Evidence</span>
                <h2 id="evidence-detail-title">{cardState.evidenceTitle}</h2>
              </div>
              <button onClick={() => setShowEvidence(false)} aria-label="Close Evidence">
                ×
              </button>
            </header>
            <p>{copy(cardState.evidenceIntro)}</p>
            <ol>
              {cardState.evidenceItems.map((item) => (
                <li key={item.id}>
                  <span>{item.status}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{copy(item.copy)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <blockquote>{copy(cardState.evidenceConclusion)}</blockquote>
            <button className="lesson-secondary-done" onClick={() => setShowEvidence(false)}>
              Return to Lesson
            </button>
          </section>
        </div>
      )}

      {showAllSources && (
        <div className="lesson-secondary-scrim">
          <section
            className="lesson-secondary-overlay sources-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sources-detail-title"
          >
            <header>
              <div>
                <span>Sources / Further Reading</span>
                <h2 id="sources-detail-title">Sources for {lesson.title}</h2>
              </div>
              <button onClick={() => setShowAllSources(false)} aria-label="Close Sources">
                ×
              </button>
            </header>
            <ol>
              {lesson.sources.map((source) => (
                <li key={source.id}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.shortTitle} ↗
                  </a>
                  <p>{source.citation}</p>
                </li>
              ))}
            </ol>
            <p className="lesson-source-note">
              External links open separately so this Lesson remains exactly where you left it.
            </p>
            <button className="lesson-secondary-done" onClick={() => setShowAllSources(false)}>
              Return to Lesson
            </button>
          </section>
        </div>
      )}

      {pendingLesson && (
        <div className="lesson-secondary-scrim">
          <section
            className="lesson-link-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="linked-lesson-title"
          >
            <span>Continue learning?</span>
            <h2 id="linked-lesson-title">Go to {pendingLesson.title}?</h2>
            <p>Your current card and progress will be preserved as the previous Lesson.</p>
            <div>
              <button onClick={() => setPendingLessonId(null)}>Cancel</button>
              <button className="primary" onClick={() => transitionToLesson(pendingLesson.id)}>
                Go to Lesson
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
