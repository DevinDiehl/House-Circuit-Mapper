# Electricity Mapper

A local web application for mapping household electrical circuits across multiple floor-plan schematics.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Uploaded schematics and map data are stored locally under `.wrangler/state`. Keep that directory if you want to preserve your maps between runs.

## Production-style local preview

```bash
npm run build
npm start
```

No hosting account or cloud deployment is required.
