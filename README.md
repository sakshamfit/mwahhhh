# mwah. — lipstick that winks back

An interactive landing page for a Gen Z lipstick drop.

- **Hero** — a cut-out video of the model over a split cream / wine backdrop. Her left-eye wink keeps the classic colours, her right-eye wink flips them with a circle wipe from that eye; tap either side to wink back. A 3D lipstick and its cap float behind her, and her kiss sprays lip prints.
- **Shade lab** — scroll (or tap a lipstick) to morph the lips through five shades; the backdrop follows the colour sampled from every video frame.
- **The bullet** — a procedural 3D lipstick that uncaps and twists up on scroll. Drag to spin, tap a swatch to recolour.
- **Kiss wall**, draggable reviews, FAQ, the Wink Kit, a bag drawer and a variable-font footer.

Plain HTML/CSS/JS — no build step. GSAP 3.13, Lenis 1.1.20 and three.js 0.160 are vendored in `vendor/`.

## Run locally

```bash
python serve.py
```

Then open http://localhost:5173. (Opening `index.html` directly won't work — ES modules need a server.)

## Structure

```
index.html        page markup
css/style.css     all styles
js/main.js        boot: preloader, smooth scroll, cursor, sections, bag
js/hero.js        hero video shader, wink flip, kiss burst, 3D lipstick
js/shades.js      scroll-scrubbed shade video
js/bullet.js      3D product section
js/lipstick.js    procedural lipstick model
js/data.js        per-frame eye/lip tracking + shade colours from the videos
js/store.js       shades, bag, sound
assets/           videos, posters, audio
```

## Source

Imported into `sakshamfit/mwahhhh` from [gireeshkumarreddy/mwah-lipstick](https://github.com/gireeshkumarreddy/mwah-lipstick) at commit `dfc600a` ("mwah. lipstick landing page").

## Deploy

Static site, no build step. `vercel.json` sets long-lived cache headers for `assets/` + `vendor/` and revalidating headers for `css/` + `js/`. Deployed on Vercel as project `mwahhhh`.
