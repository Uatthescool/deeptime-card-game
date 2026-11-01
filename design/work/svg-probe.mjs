import sharp from "sharp";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="120">
  <rect width="700" height="120" fill="#f5efdc"/>
  <text x="10" y="50" font-family="DejaVu Serif" font-weight="bold" font-size="40" fill="#1c1e12">Nautilus</text>
  <text x="200" y="50" font-family="DejaVu Serif" font-style="italic" font-size="24" fill="#1c1e12">Nautilus praepompilius</text>
  <text x="10" y="100" font-family="DejaVu Sans" font-weight="bold" font-size="18" letter-spacing="3" fill="#1c1e12">LEVEL <tspan font-family="DejaVu Serif" font-weight="normal" text-decoration="underline">Mollusk</tspan></text>
</svg>`;
await sharp(Buffer.from(svg)).png().toFile("design/work/svg-probe.png");
console.log("rendered");
