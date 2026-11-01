import { creamRegions, load, namePanels } from "./geometry.mjs";
for (const [name, file] of [["nautilus", "design/templates/nautilus-reference.webp"], ["trex", "design/prototype-cards/Tyrannosaurus_rex_Prototype_001.png"], ["template", "design/templates/Prehistoric_Card_Master_Template_Geometry_v2.png"]]) {
  const d = await load(file);
  const { regions } = creamRegions(d);
  const named = namePanels(regions);
  console.log(`\n${name}: ${regions.length} cream regions`);
  for (const [k, r] of Object.entries(named)) console.log(`  ${k.padEnd(6)} x ${r.x0}-${r.x1} (w ${r.x1 - r.x0})  y ${r.y0}-${r.y1} (h ${r.y1 - r.y0})  px ${r.n}`);
}
