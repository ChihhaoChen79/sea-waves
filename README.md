# Sea Waves

A one-page, full-screen ocean scene made for iPhone Safari.

- Realistic rolling sea (Three.js water with Gerstner swell, reflections and whitecaps)
- A floating camera that rides the waves — drag to look around
- Choose the **time** (sunrise, morning, noon, sunset, night) and **weather** (clear, cloudy, rain, storm, fog)
- Sea life: a humpback whale that now and then breaches, blows or dives tail-up, seagulls flying past, and islands of seven different kinds (never two alike in one scene) on the horizon (each can be switched off)
- A real sky: the Sun, the Moon (with its true phase) and the stars sit where they really are for your region and date, worked out from your time zone (no location permission needed). "Star signs" draws and names about 20 famous constellations; the faint background stars are decorative
- Generative peaceful music plus ocean, rain and thunder sounds (Web Audio, no audio files)

## Run it

It's a static site — no build step. Serve the folder with any static server:

```sh
python3 -m http.server 8000
```

then open `http://<your-computer-ip>:8000` on your iPhone (same Wi-Fi), or publish it with GitHub Pages
(Settings → Pages → deploy from branch, root folder).

Tip: in Safari use Share → **Add to Home Screen** for a full-screen, app-like experience.

Requires iOS 16.4+ (import maps). Sound starts after tapping **Set sail**; on iOS 17+ it plays even with the silent switch on.

Pinch with two fingers to zoom (up to 6×) and double-tap to reset; the mouse wheel zooms on a computer.

The corner buttons fade out after a few seconds without touching the screen; tap anywhere to bring them back.

Three.js r160 (MIT) is vendored in `lib/`.
