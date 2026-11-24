# Rivu — personal portfolio

A responsive Next.js portfolio with a scroll-driven Three.js world (a procedural phoenix flying through mountains, valleys and a caldera), resume-based experience and publications, two interactive educational AI experiments, and a digital twin with a local fallback.

## Run locally

Install Node.js 20+ and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000. For production use `npm run build` then `npm start`.

## Customize

- `app/page.jsx`: sections, copy, navigation and contact links.
- `app/globals.css`: colors, responsive layout and typography.
- `components/World.jsx`: mounts the 3D world and flight-path navigation.
- `components/world/stops.js`: one entry per section: camera angle, light, fog and colors.
- `components/world/landscape.js`, `sky.js`, `phoenix.js`, `behaviour.js`, `fire.js`, `index.js`: terrain, sky, the bird, what it does (fly, land, rest actions), flames, camera.
- `public/textures/`: CC0 scanned surfaces from Poly Haven (see CREDITS.txt).
- `components/data.js`: professional history, publications and assistant knowledge.
- `components/Lab.jsx`: educational quantization calculator and synthetic attention visualizer.
- `components/Twin.jsx`: chat UI and local demo responses.
- `app/api/twin/route.js`: optional server-side LLM integration.
- `public/resume.pdf`: original resume. Review personal contact details before publishing.

## Enable live AI (optional)

Copy `.env.example` to `.env.local`, set a valid OpenAI API key and restart the dev server. The API uses resume context, not a vector database or full RAG. Without a key it uses predefined local responses. API usage may incur charges. Before exposing the endpoint publicly, add server-side rate limiting, abuse protection and budget limits; otherwise visitors can incur costs on your account. The demo sends questions to OpenAI only if the server is configured. Add an appropriate privacy notice before public deployment.

## Deploy

Import the project into your hosting service (e.g. Vercel), using the Next.js preset. Set optional server environment variables in the hosting dashboard. Review resume privacy and publication status before going live. The attention experiment uses synthetic values and the compression calculator excludes runtime overhead. Publication links open scholarly searches rather than unverified DOI pages.
