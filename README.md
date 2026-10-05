# Young Mobile Mechanic · Deep N Dirty Co.

Single-page site for a licensed mobile mechanic based in Napanee, Ontario.

**Run it:** it's a static site with no build step. Serve the folder (`python3 -m http.server`) or drop it on any static host (GitHub Pages, Netlify, Cloudflare Pages). Open it through a server rather than as a local file.

## Look
"Chrome & grime", taken from the Young Mobile Mechanic logo: pitch black, electric-blue spray paint, chrome lettering, the gauge and the wrench. One variable typeface (Archivo, width 62–125) does everything from the condensed service list to the expanded chrome headline. JetBrains Mono handles the spec labels.

## Page, top to bottom
1. **Ignition loader**: a gauge needle sweeps like a dash on start-up, then a blue paint stroke wipes the screen.
2. **Hero**: the mechanic artwork with chrome "YOUNG / MOBILE / MECHANIC" lettering. The chrome catches a highlight that follows the cursor, blue spray dust drifts and sprays off the pointer, and a click splats dripping paint.
3. **The deal**: a dirty windshield. Scrolling sweeps a wiper across it to reveal "I'll come to you!"
4. **Service ticker**: speed and direction follow the scroll.
5. **What I fix**: all ten services. A sticky "parts plate" redraws a technical drawing for the service you're on.
6. **Off-road & yard**: ATVs, side-by-sides and lawnmowers on a pinned horizontal track. On phones it's a swipe carousel.
7. **How it works**: a gauge needle moves through Call → Roll up → Fixed while an odometer counts the km down to you.
8. **Coverage**: a radar with real town positions (approximate straight-line km from Napanee).
9. **Promise**: a brush stroke opens to full screen and "Honest work. Fair prices. Reliable service." stretches wide.
10. **Book**: pick the vehicle, the problem and the town, and the site writes a text message ready to send or copy.
11. **Footer**: revealed from under the page; the letters swell toward the cursor.

Phones get re-composed layouts: a sticky plate over the service list, a swipe carousel, and a call/text bar. `prefers-reduced-motion` turns off smooth scrolling, pins, the loader and the canvas, and everything still reads. The page also works with JavaScript off.

## Structure
```
index.html            markup, all copy, the inline technical drawings
assets/css/main.css   tokens, layout, responsive + reduced-motion rules
assets/js/main.js     interactions and scroll choreography (each feature isolated)
assets/js/vendor/     GSAP 3.15 + ScrollTrigger, Lenis 1.3 (self-hosted, no CDN)
assets/fonts/         Archivo variable (normal + italic), JetBrains Mono (OFL)
assets/img/           logo crops (ymm-*.webp) and menu preview drawings
```

## Editing
- **Phone number:** search `6134494659` / `(613) 449-4659` in `index.html` (also `PHONE` in `main.js`).
- **Social links:** the Facebook/Instagram URLs assume the handle `deepndirtyco` on both. Confirm them.
- **Logo artwork:** `ymm-mechanic.webp` and `ymm-logo.webp` were cropped from a screenshot of the logo. Swapping in the original high-resolution file will make them sharper.
- **Services:** the list lives in the `.parts` list in `index.html`. Each row pairs with the drawing at the same position in `.plate__figs`.
