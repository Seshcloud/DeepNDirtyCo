# Deep N Dirty Co. — Young's Mobile Mechanic

Single-page site for a licensed mobile mechanic based in Napanee, ON.

**Run it:** it's a static site with no build step. Serve the folder (`python3 -m http.server`) or drop it on any static host (GitHub Pages, Netlify, Cloudflare Pages).

## Structure
```
index.html            markup + all copy
assets/css/main.css   design tokens, layout, responsive + reduced-motion rules
assets/js/main.js     interactions and scroll choreography
assets/js/vendor/     GSAP 3.15 + ScrollTrigger, Lenis 1.3 (self-hosted, no CDN)
assets/fonts/         Big Shoulders Display, Instrument Serif, JetBrains Mono, Inter Tight (woff2, OFL)
assets/img/           line-drawing "field manual" illustrations (SVG)
```

## Sections
Preloader → hero (cursor "work light" X-rays the truck; click to splatter mud) → pinned manifesto (words light up) →
velocity marquee → pinned horizontal services (native swipe carousel on mobile) → pinned "call to keys" road →
coverage radar (real town positions, km from Napanee) → hover-preview fix list (tap-to-expand on mobile) →
full-screen expand → contact → interactive footer type.

## Editing
- Phone number: search `6134494659` / `(613) 449-4659` in `index.html`.
- Social links: the Facebook/Instagram URLs in the contact section assume the handle `deepndirtyco` on both — confirm.
- Swap illustrations for real photos by replacing the `src` of the `.panel__media img` and `data-img` on `.fix` items.
- Town distances are approximate straight-line kilometres from Napanee.

Respects `prefers-reduced-motion` (no smooth scroll, pins or intro; all content is static and visible) and works without JavaScript.
