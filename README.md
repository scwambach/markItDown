# MarkItDown

A self-hosted web application for annotating full-page website screenshots with a pin-and-comment system.

## Features

- **Projects**: Organize your screenshots into projects
- **Pages**: Upload full-page screenshots (PNG/JPG) to each project
- **Pins**: Click anywhere on a screenshot to create a numbered pin
- **Comments**: Add threaded comments to each pin with author names and timestamps
- **Resolve/Reopen**: Mark pins as resolved or reopen them
- **Dark UI**: Clean, minimal dark theme interface
- **Self-hosted**: Run on your own infrastructure with Docker

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Storage**: Local filesystem
- **Deployment**: Docker + Docker Compose

## Quick Start

### Using Docker (Recommended)

1. Clone the repository:

```bash
git clone <your-repo-url>
cd markItDown
```

2. Start the application:

```bash
docker-compose up -d
```

3. Open your browser to [http://localhost:5296](http://localhost:5296)

The application will be running with persistent data stored in Docker volumes.

### Development Mode

**Quick Start Script:**

```bash
./dev.sh
```

This will install dependencies and start both the backend and frontend servers.

**Manual Setup:**

#### Backend

```bash
cd server
npm install
npm run dev
```

The API server will run on port 5296.

#### Frontend

```bash
cd client
npm install
npm run dev
```

The development server will run on port 3000 with API proxy configured.

## Project Structure

```
markItDown/
├── client/              # React + Vite frontend
│   ├── src/
│   │   ├── App.jsx     # Main application component
│   │   ├── main.jsx    # Entry point
│   │   └── index.css   # Global styles
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/              # Express backend
│   ├── index.js        # Express server & API routes
│   ├── db.js           # SQLite database setup
│   └── package.json
├── data/                # SQLite database (volume)
├── uploads/             # Uploaded images (volume)
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Projects

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create a new project
- `DELETE /api/projects/:id` - Delete a project

### Pages

- `GET /api/projects/:id/pages` - List pages in a project
- `POST /api/projects/:id/pages` - Upload a new page (multipart/form-data)
- `DELETE /api/pages/:id` - Delete a page

### Pins

- `GET /api/pages/:id/pins` - List pins on a page
- `POST /api/pages/:id/pins` - Create a new pin
- `PATCH /api/pins/:id/resolve` - Toggle pin resolved status
- `DELETE /api/pins/:id` - Delete a pin

### Comments

- `GET /api/pins/:id/comments` - List comments on a pin
- `POST /api/pins/:id/comments` - Add a comment
- `DELETE /api/comments/:id` - Delete a comment

### Static Files

- `/uploads/:filename` - Serve uploaded images

## Database Schema

```sql
projects:  id, name, created_at
pages:     id, project_id, name, filename, created_at
pins:      id, page_id, x, y, resolved, created_at
comments:  id, pin_id, author, body, created_at
```

## Usage Guide

1. **Create a Project**: Click "New Project" in the sidebar and enter a name
2. **Upload a Page**: Select a project, then click "New Page" and upload a screenshot
3. **Add Pins**: Click anywhere on the screenshot to create a pin
4. **Comment**: Click a pin to open the comment panel, then add your name and comment
5. **Resolve**: Mark pins as resolved when issues are addressed
6. **Hide Resolved**: Toggle the checkbox to hide resolved pins from view

## Docker Volumes

The application uses two named volumes:

- `markitdown-data`: SQLite database file
- `markitdown-uploads`: Uploaded screenshot images

To back up your data:

```bash
docker-compose down
docker run --rm -v markitdown-data:/data -v $(pwd):/backup alpine tar czf /backup/data-backup.tar.gz /data
docker run --rm -v markitdown-uploads:/uploads -v $(pwd):/backup alpine tar czf /backup/uploads-backup.tar.gz /uploads
```

## Configuration

The application runs on port 5296 by default. To change this, edit the port mapping in [docker-compose.yml](docker-compose.yml):

```yaml
ports:
  - "YOUR_PORT:5296"
```

## License

MIT
