import sharp from "sharp";

function iconSvg(size, radius, fontSize, dy) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563EB"/>
      <stop offset="100%" stop-color="#6366F1"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="white" font-family="Arial,sans-serif" dy="${dy}">&#1057;</text>
</svg>`);
}

await sharp(iconSvg(512, 96, 280, 20)).png().toFile("app/icon.png");
await sharp(iconSvg(180, 36, 100, 8)).png().toFile("app/apple-icon.png");
console.log("Created app/icon.png and app/apple-icon.png");
