# Mark It Down

Mark It Down is a self-hosted screenshot annotation app for collecting pin-based feedback on full-page website screenshots.

## Stack

- React + Vite frontend in `/client`
- Node.js + Express backend in `/server`
- SQLite database stored in `/data`
- Uploaded images stored in `/uploads`

## Local development

```bash
cd /tmp/workspace/scwambach/markItDown/server && npm install
cd /tmp/workspace/scwambach/markItDown/client && npm install
cd /tmp/workspace/scwambach/markItDown/server && npm start
cd /tmp/workspace/scwambach/markItDown/client && npm run dev
```

The Vite dev server proxies `/api` and `/uploads` to the Express server on port `5296`.

To generate the production bundle that Express serves from `/dist`:

```bash
cd /tmp/workspace/scwambach/markItDown/client && npm run build
cd /tmp/workspace/scwambach/markItDown/server && npm start
```

## Docker

```bash
docker compose up --build
```

The app is exposed on `http://localhost:5296`, with named volumes for SQLite data and uploads.
