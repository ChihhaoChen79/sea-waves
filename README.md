# Sea Waves

A one-page, full-screen ocean scene made for iPhone Safari.

- Realistic rolling sea (Three.js water with Gerstner swell, reflections and whitecaps)
- A floating camera that rides the waves — drag to look around
- Choose the **time** (sunrise, morning, noon, sunset, night) and **weather** (clear, cloudy, rain, storm, fog)
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

Three.js r160 (MIT) is vendored in `lib/`.
