import { BIOMES } from "../../data/biomes.ts";
import { IMPLEMENTATION_REGISTER, TAG_RULES } from "../../data/cards.ts";

export function RulesDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="rules-drawer" role="dialog" aria-label="Quick rules reference">
      <header>
        <div>
          <div className="eyebrow">Rules revision {IMPLEMENTATION_REGISTER.version}</div>
          <h2>Quick rules reference</h2>
        </div>
        <button onClick={onClose} aria-label="Close rules" autoFocus>
          ×
        </button>
      </header>
      <section>
        <h3>Goal</h3>
        <p>
          Build an ecosystem across your five Niches. The first player whose Creatures total 12 or more Victory Levels
          wins; if both reach 12 at once, the higher total wins.
        </p>
      </section>
      <section>
        <h3>Turn</h3>
        <ol>
          <li>Draw, return marked Living Fossils, and resolve start effects.</li>
          <li>Interleave one Creature, one Adaptation, one Event, and normally one Concept play.</li>
          <li>Resourceful raises the Concept allowance to two, but every Concept must fully resolve independently.</li>
          <li>Each ready Creature may initiate one legal Hunt.</li>
          <li>Resolve end effects and pass the device.</li>
        </ol>
      </section>
      <section>
        <h3>Biomes</h3>
        <p>
          Each player privately chooses a Biome before opening hands are dealt. Both choices are then revealed and
          remain active for the entire game.
        </p>
        <dl className="tag-glossary">
          {BIOMES.map((biome) => (
            <div key={biome.key}>
              <dt>
                {biome.name} · {biome.abilityName}
              </dt>
              <dd>{biome.shortRules}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h3>Override</h3>
        <p>
          Match at least three of Diet, Time Period, Primary Taxon, and Tag, then obey Level progression. Equal-Level
          overrides are legal. A printed Aquatic Creature may interact only with a Creature that counts as Aquatic;
          Semi-Aquatic satisfies that gate without becoming restricted against other Creatures. When the occupied
          Creature has Aquatic, the pair gets a Primary Taxon match—or a Tag match instead if their Primary Taxa already
          match. When the occupied Creature has Semi-Aquatic, an Aquatic or Semi-Aquatic incoming Creature gets only a
          Tag match.
        </p>
      </section>
      <section>
        <h3>Hunt</h3>
        <p>
          Selecting a target opens a projected Battle Level preview, including any Battle Coin range. Canceling consumes
          nothing. Lower Battle Level is destroyed after Commit Hunt; a tie normally destroys neither Creature unless an
          effect says otherwise.
        </p>
      </section>
      <section>
        <h3>Implementation rulings</h3>
        <ul>
          {IMPLEMENTATION_REGISTER.rulesChanges.slice(1).map((entry) => (
            <li key={entry.title}>
              <strong>{entry.title}:</strong> {entry.rule}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3>Tag glossary</h3>
        <dl className="tag-glossary">
          {Object.entries(TAG_RULES).map(([tag, rule]) => (
            <div key={tag}>
              <dt>{tag}</dt>
              <dd>{rule}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
