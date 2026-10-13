# OzEye

Live public data for Australia on a 3D globe. Civilian information only.

OzEye is based on [God's Eye View](https://github.com/bilawalsidhu/gods-eye-view)
by Bilawal Sidhu (MIT). The original project's README is kept at
[docs/UPSTREAM-README.md](docs/UPSTREAM-README.md), and most of the documents
under `docs/` still describe the original.

## What is different from the original

- **Civilian only.** Military aircraft and naval vessels are removed on the
  server before any record reaches the browser. Aircraft are recognised by the
  address blocks countries reserve for military use and by the public list of
  military airframes; vessels by their AIS ship type or a navy-style name. AIS
  is self-reported, so a vessel that broadcasts neither is not recognised.
- **No military sites.** Military flights and mapped military installations
  cannot be switched on and are being removed. Civilian infrastructure, such
  as datacenters, dams and submarine cables, stays.
- **Opens over Australia.** The rest of the globe is still there to explore.

## Status

Work in progress. Still to come: removing the remaining military code,
limiting live data to Australia, and replacing the US-only weather, cyclone
and fire feeds with Australian sources.

## Running it

Use Node.js 24.x (24.14.0 or later) or 26.x.

```bash
git clone https://github.com/NeddZeplin/OzEye.git
cd OzEye
npm ci
npm run dev
```

Open `http://localhost:4173`. The app starts without an account or API keys.
Optional keys (for example a Cesium ion token for photorealistic 3D, or an
AISStream key for ships) go in `.env`; `.env.example` lists them.

## Licence and data

The source code is MIT licensed; see [LICENSE](LICENSE). Data shown in the app
belongs to its providers and stays under their terms; see
[DATA_SOURCES.md](DATA_SOURCES.md).
