import { type CSSProperties, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CARD_LIBRARY, cardFacePath } from "../../data/cards.ts";
import {
  TUTORIAL_GROUPS,
  type TutorialDefinition,
  type TutorialGroup,
  type TutorialCopy,
  type TutorialStep,
  TUTORIALS,
} from "../../data/tutorials.ts";
import { assetUrl } from "../assets.ts";
import { readJson, writeJson } from "../storage.ts";
import { Dialog } from "./Dialog.tsx";

const DONE_KEY = "pcg.tutorials.done";

const readDone = () => {
  const value = readJson<unknown>("local", DONE_KEY, []);
  return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []);
};

/** The Tutorials menu: every tutorial by group, with the finished ones marked. Picking one plays it. */
export function TutorialsMenu({ onClose }: { onClose: () => void }) {
  const [playing, setPlaying] = useState<TutorialDefinition | null>(null);
  const [done, setDone] = useState(readDone);

  useEffect(() => {
    if (playing) return;
    const handleKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [playing, onClose]);

  if (playing) {
    return (
      <TutorialPlayer
        tutorial={playing}
        onExit={(finished) => {
          if (finished) {
            const next = new Set([...done, playing.id]);
            writeJson("local", DONE_KEY, [...next]);
            setDone(next);
          }
          setPlaying(null);
        }}
      />
    );
  }

  const groups = Object.keys(TUTORIAL_GROUPS) as TutorialGroup[];
  return (
    <Dialog label="Tutorials" className="tutorials-overlay">
      <section className="tutorials-panel">
        <header>
          <div>
            <div className="eyebrow">Tutorials</div>
            <h2>Learn Deep Time</h2>
          </div>
          <button className="quiet-button" onClick={onClose}>
            Close
          </button>
        </header>
        {groups.map((group) => {
          const tutorials = TUTORIALS.filter((tutorial) => tutorial.group === group);
          return (
            <section key={group} className="tutorials-group">
              <h3>{TUTORIAL_GROUPS[group].title}</h3>
              <p>{TUTORIAL_GROUPS[group].summary}</p>
              {tutorials.length ? (
                <ul>
                  {tutorials.map((tutorial) => (
                    <li key={tutorial.id}>
                      <button className="tutorial-entry" onClick={() => setPlaying(tutorial)}>
                        <b>{tutorial.title}</b>
                        <span>{tutorial.summary}</span>
                        <small>
                          {tutorial.steps.length} steps{done.has(tutorial.id) ? " · ✓ Done" : ""}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="tutorials-soon">Coming soon.</p>
              )}
            </section>
          );
        })}
      </section>
    </Dialog>
  );
}

/** Plays one tutorial over its scene; `onExit(true)` once the last step is finished. */
export function TutorialPlayer({
  tutorial,
  onExit,
}: {
  tutorial: TutorialDefinition;
  onExit: (finished: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const step = tutorial.steps[index]!;
  const last = index === tutorial.steps.length - 1;
  const next = useCallback(() => (last ? onExit(true) : setIndex((i) => i + 1)), [last, onExit]);
  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onExit(false);
      else if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [next, back, onExit]);

  return (
    <Dialog label={`Tutorial: ${tutorial.title}`} className="tutorial-player">
      <div className="tutorial-scene" ref={sceneRef}>
        {tutorial.scene === "card-anatomy" && <CardAnatomyScene />}
      </div>
      <Spotlight
        sceneRef={sceneRef}
        step={step}
        index={index}
        count={tutorial.steps.length}
        onBack={back}
        onNext={next}
        onExit={() => onExit(false)}
      />
    </Dialog>
  );
}

type Rect = { left: number; top: number; width: number; height: number };

const HOLE_PADDING = 8;
const GAP = 24;

/**
 * Where the caption goes, always on the dimmed part: beside the scene's subject (the card) where there is room,
 * level with the lit part so nothing else of the subject is covered; otherwise beside, below or above the lit part.
 */
function captionPlacement(hole: Rect, caption: { width: number; height: number }, subject: Rect | null): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampTop = (top: number) => Math.max(16, Math.min(top, vh - caption.height - 16));
  const clampLeft = (left: number) => Math.max(16, Math.min(left, vw - caption.width - 16));
  const middleTop = clampTop(hole.top + hole.height / 2 - caption.height / 2);
  if (subject) {
    if (vw - (subject.left + subject.width) >= caption.width + GAP * 2) {
      return { left: subject.left + subject.width + GAP, top: middleTop };
    }
    if (subject.left >= caption.width + GAP * 2) return { left: subject.left - GAP - caption.width, top: middleTop };
  }
  const right = vw - (hole.left + hole.width);
  if (right >= caption.width + GAP * 2) return { left: hole.left + hole.width + GAP, top: middleTop };
  if (hole.left >= caption.width + GAP * 2) return { left: hole.left - GAP - caption.width, top: middleTop };
  const centredLeft = clampLeft(hole.left + hole.width / 2 - caption.width / 2);
  const below = vh - (hole.top + hole.height);
  if (below >= caption.height + GAP) return { left: centredLeft, top: hole.top + hole.height + GAP / 2 };
  if (hole.top >= caption.height + GAP) return { left: centredLeft, top: hole.top - GAP / 2 - caption.height };
  // No dimmed space is big enough (a small screen and a large lit area): take the larger side, as clear of the
  // lit part as the screen allows.
  return below >= hole.top
    ? { left: centredLeft, top: clampTop(hole.top + hole.height + GAP / 2) }
    : { left: centredLeft, top: clampTop(hole.top - GAP / 2 - caption.height) };
}

function Spotlight({
  sceneRef,
  step,
  index,
  count,
  onBack,
  onNext,
  onExit,
}: {
  sceneRef: RefObject<HTMLDivElement | null>;
  step: TutorialStep;
  index: number;
  count: number;
  onBack: () => void;
  onNext: () => void;
  onExit: () => void;
}) {
  const captionRef = useRef<HTMLElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [hole, setHole] = useState<Rect | null>(null);
  const [subject, setSubject] = useState<Rect | null>(null);
  const [placement, setPlacement] = useState<CSSProperties>({});

  // Light the step's target, and follow it when the window or scene changes size (or the card image loads).
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const measure = () => {
      const main = scene.querySelector<HTMLElement>("[data-tutorial-subject]")?.getBoundingClientRect();
      setSubject(main ? { left: main.left, top: main.top, width: main.width, height: main.height } : null);
      const target = scene.querySelector<HTMLElement>(`[data-tutorial-target="${step.target}"]`);
      if (!target) return setHole(null);
      const r = target.getBoundingClientRect();
      setHole({
        left: r.left - HOLE_PADDING,
        top: r.top - HOLE_PADDING,
        width: r.width + HOLE_PADDING * 2,
        height: r.height + HOLE_PADDING * 2,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [sceneRef, step.target]);

  useLayoutEffect(() => {
    const caption = captionRef.current;
    if (!caption || !hole) return;
    setPlacement(captionPlacement(hole, { width: caption.offsetWidth, height: caption.offsetHeight }, subject));
  }, [hole, subject, step]);

  useEffect(() => nextRef.current?.focus(), [index]);

  return (
    <>
      {/* Watching only: the lit part is shown, not used, so the whole screen stays covered. */}
      <div className="tutorial-blocker" aria-hidden="true" />
      {hole && <div className="tutorial-hole" style={hole} aria-hidden="true" />}
      <section className="tutorial-caption" ref={captionRef} style={placement} aria-live="polite">
        <small>
          Step {index + 1} of {count}
        </small>
        <h2>{step.title}</h2>
        <TutorialBody copy={step.body} />
        <div className="tutorial-caption-actions">
          <button className="quiet-button" onClick={onExit}>
            Exit
          </button>
          <span>
            <button className="quiet-button" onClick={onBack} disabled={index === 0}>
              Back
            </button>
            <button className="primary-button" ref={nextRef} onClick={onNext} data-autofocus>
              {index === count - 1 ? "Finish" : "Next"}
            </button>
          </span>
        </div>
      </section>
    </>
  );
}

/** Paragraphs as paragraphs; each run of terms as one list. */
function TutorialBody({ copy }: { copy: TutorialCopy[] }) {
  const blocks: Array<string | Array<{ term: string; text: string }>> = [];
  for (const part of copy) {
    if (typeof part === "string") blocks.push(part);
    else if (Array.isArray(blocks.at(-1))) (blocks.at(-1) as Array<{ term: string; text: string }>).push(part);
    else blocks.push([part]);
  }
  return blocks.map((block, i) =>
    typeof block === "string" ? (
      <p key={i}>{block}</p>
    ) : (
      <dl key={i}>
        {block.map(({ term, text }) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    ),
  );
}

/** Parts of a card face, in the face's own 1024 × 1434 pixels (measured from the Nautilus). */
const CARD_PARTS: Record<string, [x0: number, y0: number, x1: number, y1: number]> = {
  card: [0, 0, 1024, 1434],
  "common-name": [80, 84, 255, 142],
  "scientific-name": [256, 84, 545, 142],
  diet: [852, 55, 967, 169],
  art: [69, 189, 954, 682],
  taxa: [73, 720, 951, 880],
  "gameplay-taxon": [356, 816, 524, 862],
  tags: [73, 911, 951, 1010],
  flavor: [90, 1050, 940, 1308],
  level: [83, 1194, 247, 1357],
  period: [700, 1300, 930, 1362],
};

function CardAnatomyScene() {
  const nautilus = CARD_LIBRARY.get("nautilus")!;
  return (
    <div className="tutorial-card" data-tutorial-subject>
      <img src={assetUrl(cardFacePath(nautilus)!)} alt="The Nautilus card" draggable={false} />
      {Object.entries(CARD_PARTS).map(([part, [x0, y0, x1, y1]]) => (
        <span
          key={part}
          className="tutorial-card-part"
          data-tutorial-target={part}
          style={{
            left: `${(x0 / 1024) * 100}%`,
            top: `${(y0 / 1434) * 100}%`,
            width: `${((x1 - x0) / 1024) * 100}%`,
            height: `${((y1 - y0) / 1434) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}
