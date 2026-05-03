import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, "..", "public");
const svgPath = resolve(publicDir, "favicon.svg");

const svg = await readFile(svgPath);

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
];

for (const { name, size } of targets) {
  const out = resolve(publicDir, name);
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 10, g: 10, b: 20, alpha: 1 } })
    .png()
    .toFile(out);
  console.log(`wrote ${name} (${size}x${size})`);
}

const icoSizes = [16, 32, 48, 64];
const icoBuffers = await Promise.all(
  icoSizes.map((s) =>
    sharp(svg, { density: 384 })
      .resize(s, s, { fit: "contain", background: { r: 10, g: 10, b: 20, alpha: 1 } })
      .png()
      .toBuffer(),
  ),
);
const icoBuf = await pngToIco(icoBuffers);
await writeFile(resolve(publicDir, "favicon.ico"), icoBuf);
console.log(`wrote favicon.ico (${icoSizes.join(",")})`);
