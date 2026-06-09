const express = require('express')
const Database = require('better-sqlite3')
const fs = require('fs')
const multer = require('multer')
const path = require('path')
const { randomUUID } = require('crypto')

const PORT = 5296
const ROOT_DIR = path.resolve(__dirname, '..')
const DATA_DIR = path.join(ROOT_DIR, 'data')
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads')
const DIST_DIR = path.join(ROOT_DIR, 'dist')
const DATABASE_PATH = path.join(DATA_DIR, 'markitdown.db')

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const db = new Database(DATABASE_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    filename TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pin_id INTEGER NOT NULL,
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pin_id) REFERENCES pins(id) ON DELETE CASCADE
  );
`)

const app = express()
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, UPLOADS_DIR),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase() || '.jpg'
      const normalizedExtension = extension === '.jpeg' ? '.jpg' : extension
      callback(null, `${randomUUID()}${normalizedExtension}`)
    },
  }),
  fileFilter: (_req, file, callback) => {
    if (['image/png', 'image/jpeg'].includes(file.mimetype)) {
      callback(null, true)
      return
    }

    callback(new Error('Only PNG and JPG screenshots are supported.'))
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
})

const selectProject = db.prepare('SELECT id, name, created_at FROM projects WHERE id = ?')
const selectPage = db.prepare('SELECT id, project_id, name, filename, created_at FROM pages WHERE id = ?')
const selectPin = db.prepare('SELECT id, page_id, x, y, resolved, created_at FROM pins WHERE id = ?')
const selectComment = db.prepare('SELECT id, pin_id, author, body, created_at FROM comments WHERE id = ?')

const listProjects = db.prepare('SELECT id, name, created_at FROM projects ORDER BY created_at ASC, id ASC')
const listPages = db.prepare('SELECT id, project_id, name, filename, created_at FROM pages WHERE project_id = ? ORDER BY created_at ASC, id ASC')
const listPins = db.prepare('SELECT id, page_id, x, y, resolved, created_at FROM pins WHERE page_id = ? ORDER BY created_at ASC, id ASC')
const listComments = db.prepare('SELECT id, pin_id, author, body, created_at FROM comments WHERE pin_id = ? ORDER BY created_at ASC, id ASC')

const insertProject = db.prepare('INSERT INTO projects (name) VALUES (?)')
const updateProject = db.prepare('UPDATE projects SET name = ? WHERE id = ?')
const deleteProjectStatement = db.prepare('DELETE FROM projects WHERE id = ?')

const insertPage = db.prepare('INSERT INTO pages (project_id, name, filename) VALUES (?, ?, ?)')
const deletePageStatement = db.prepare('DELETE FROM pages WHERE id = ?')
const selectProjectPages = db.prepare('SELECT filename FROM pages WHERE project_id = ?')

const insertPin = db.prepare('INSERT INTO pins (page_id, x, y) VALUES (?, ?, ?)')
const togglePin = db.prepare('UPDATE pins SET resolved = CASE resolved WHEN 1 THEN 0 ELSE 1 END WHERE id = ?')
const deletePinStatement = db.prepare('DELETE FROM pins WHERE id = ?')

const insertComment = db.prepare('INSERT INTO comments (pin_id, author, body) VALUES (?, ?, ?)')
const deleteCommentStatement = db.prepare('DELETE FROM comments WHERE id = ?')

function cleanName(value, label) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) {
    const error = new Error(`${label} is required.`)
    error.status = 400
    throw error
  }

  return trimmed
}

function cleanCoordinate(value, label) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    const error = new Error(`${label} must be a number between 0 and 100.`)
    error.status = 400
    throw error
  }

  return Number(numeric.toFixed(4))
}

function serializePin(pin) {
  return {
    ...pin,
    resolved: Boolean(pin.resolved),
  }
}

function parseId(value, label) {
  const numeric = Number.parseInt(value, 10)
  if (!Number.isInteger(numeric) || numeric <= 0) {
    const error = new Error(`Invalid ${label}.`)
    error.status = 400
    throw error
  }

  return numeric
}

function requireProject(projectId) {
  const project = selectProject.get(projectId)
  if (!project) {
    const error = new Error('Project not found.')
    error.status = 404
    throw error
  }

  return project
}

function requirePage(pageId) {
  const page = selectPage.get(pageId)
  if (!page) {
    const error = new Error('Page not found.')
    error.status = 404
    throw error
  }

  return page
}

function requirePin(pinId) {
  const pin = selectPin.get(pinId)
  if (!pin) {
    const error = new Error('Pin not found.')
    error.status = 404
    throw error
  }

  return serializePin(pin)
}

function requireComment(commentId) {
  const comment = selectComment.get(commentId)
  if (!comment) {
    const error = new Error('Comment not found.')
    error.status = 404
    throw error
  }

  return comment
}

function removeFile(filename) {
  if (!filename) {
    return
  }

  const safeFilename = path.basename(filename)
  if (safeFilename !== filename) {
    return
  }

  const filePath = path.join(UPLOADS_DIR, safeFilename)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

app.get('/api/projects', (_req, res) => {
  res.json(listProjects.all())
})

app.post('/api/projects', (req, res) => {
  const name = cleanName(req.body?.name, 'Project name')
  const { lastInsertRowid } = insertProject.run(name)
  res.status(201).json(selectProject.get(lastInsertRowid))
})

app.patch('/api/projects/:id', (req, res) => {
  const projectId = parseId(req.params.id, 'project id')
  requireProject(projectId)
  const name = cleanName(req.body?.name, 'Project name')
  updateProject.run(name, projectId)
  res.json(selectProject.get(projectId))
})

app.delete('/api/projects/:id', (req, res) => {
  const projectId = parseId(req.params.id, 'project id')
  requireProject(projectId)
  const filenames = selectProjectPages.all(projectId).map((page) => page.filename)
  deleteProjectStatement.run(projectId)
  filenames.forEach(removeFile)
  res.status(204).end()
})

app.get('/api/projects/:id/pages', (req, res) => {
  const projectId = parseId(req.params.id, 'project id')
  requireProject(projectId)
  res.json(listPages.all(projectId))
})

app.post('/api/projects/:id/pages', upload.single('image'), (req, res) => {
  const projectId = parseId(req.params.id, 'project id')

  try {
    requireProject(projectId)
    const name = cleanName(req.body?.name, 'Page name')
    if (!req.file) {
      const error = new Error('Screenshot image is required.')
      error.status = 400
      throw error
    }

    const { lastInsertRowid } = insertPage.run(projectId, name, req.file.filename)
    res.status(201).json(selectPage.get(lastInsertRowid))
  } catch (error) {
    if (req.file) {
      removeFile(req.file.filename)
    }
    throw error
  }
})

app.delete('/api/pages/:id', (req, res) => {
  const pageId = parseId(req.params.id, 'page id')
  const page = requirePage(pageId)
  deletePageStatement.run(pageId)
  removeFile(page.filename)
  res.status(204).end()
})

app.get('/api/pages/:id/pins', (req, res) => {
  const pageId = parseId(req.params.id, 'page id')
  requirePage(pageId)
  res.json(listPins.all(pageId).map(serializePin))
})

app.post('/api/pages/:id/pins', (req, res) => {
  const pageId = parseId(req.params.id, 'page id')
  requirePage(pageId)
  const x = cleanCoordinate(req.body?.x, 'x')
  const y = cleanCoordinate(req.body?.y, 'y')
  const { lastInsertRowid } = insertPin.run(pageId, x, y)
  res.status(201).json(serializePin(selectPin.get(lastInsertRowid)))
})

app.patch('/api/pins/:id/resolve', (req, res) => {
  const pinId = parseId(req.params.id, 'pin id')
  requirePin(pinId)
  togglePin.run(pinId)
  res.json(serializePin(selectPin.get(pinId)))
})

app.delete('/api/pins/:id', (req, res) => {
  const pinId = parseId(req.params.id, 'pin id')
  requirePin(pinId)
  deletePinStatement.run(pinId)
  res.status(204).end()
})

app.get('/api/pins/:id/comments', (req, res) => {
  const pinId = parseId(req.params.id, 'pin id')
  requirePin(pinId)
  res.json(listComments.all(pinId))
})

app.post('/api/pins/:id/comments', (req, res) => {
  const pinId = parseId(req.params.id, 'pin id')
  requirePin(pinId)
  const author = cleanName(req.body?.author, 'Author')
  const body = cleanName(req.body?.body, 'Comment')
  const { lastInsertRowid } = insertComment.run(pinId, author, body)
  res.status(201).json(selectComment.get(lastInsertRowid))
})

app.delete('/api/comments/:id', (req, res) => {
  const commentId = parseId(req.params.id, 'comment id')
  requireComment(commentId)
  deleteCommentStatement.run(commentId)
  res.status(204).end()
})

if (fs.existsSync(DIST_DIR)) {
  const indexHtml = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8')
  app.use(express.static(DIST_DIR))

  app.use((req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      path.extname(req.path)
    ) {
      next()
      return
    }

    res.type('html').send(indexHtml)
  })
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found.' })
})

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'Screenshot images must be 20MB or smaller.' })
    return
  }

  const status = error.status || 500
  const message = status >= 500 ? 'Internal server error.' : error.message
  if (status >= 500) {
    console.error(error)
  }

  res.status(status).json({ error: message })
})

app.listen(PORT, () => {
  console.log(`Mark It Down listening on http://localhost:${PORT}`)
})
