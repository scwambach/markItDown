import express from "express";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync, mkdirSync } from "fs";
import db from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 5296;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = join(__dirname, "..", "uploads");
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}

// Serve static files
app.use("/uploads", express.static(uploadsDir));

// Multer config for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "image/png" || file.mimetype === "image/jpeg") {
      cb(null, true);
    } else {
      cb(new Error("Only PNG and JPG images are allowed"));
    }
  },
});

// ========== PROJECTS ==========

app.get("/api/projects", (req, res) => {
  try {
    const projects = db
      .prepare("SELECT * FROM projects ORDER BY created_at DESC")
      .all();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/projects", (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Project name is required" });
    }
    const result = db
      .prepare("INSERT INTO projects (name) VALUES (?)")
      .run(name);
    const project = db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/projects/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PAGES ==========

app.get("/api/projects/:id/pages", (req, res) => {
  try {
    const { id } = req.params;
    const pages = db
      .prepare(
        "SELECT * FROM pages WHERE project_id = ? ORDER BY created_at DESC",
      )
      .all(id);
    res.json(pages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/projects/:id/pages", upload.single("image"), (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Page name is required" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const result = db
      .prepare(
        "INSERT INTO pages (project_id, name, filename) VALUES (?, ?, ?)",
      )
      .run(id, name, req.file.filename);

    const page = db
      .prepare("SELECT * FROM pages WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(page);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/pages/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM pages WHERE id = ?").run(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PINS ==========

app.get("/api/pages/:id/pins", (req, res) => {
  try {
    const { id } = req.params;
    const pins = db
      .prepare("SELECT * FROM pins WHERE page_id = ? ORDER BY created_at ASC")
      .all(id);
    res.json(pins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pages/:id/pins", (req, res) => {
  try {
    const { id } = req.params;
    const { x, y } = req.body;

    if (x === undefined || y === undefined) {
      return res
        .status(400)
        .json({ error: "x and y coordinates are required" });
    }

    const result = db
      .prepare("INSERT INTO pins (page_id, x, y) VALUES (?, ?, ?)")
      .run(id, x, y);
    const pin = db
      .prepare("SELECT * FROM pins WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(pin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/pins/:id/resolve", (req, res) => {
  try {
    const { id } = req.params;
    const pin = db.prepare("SELECT * FROM pins WHERE id = ?").get(id);

    if (!pin) {
      return res.status(404).json({ error: "Pin not found" });
    }

    const newResolved = pin.resolved ? 0 : 1;
    db.prepare("UPDATE pins SET resolved = ? WHERE id = ?").run(
      newResolved,
      id,
    );
    const updatedPin = db.prepare("SELECT * FROM pins WHERE id = ?").get(id);
    res.json(updatedPin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/pins/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM pins WHERE id = ?").run(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== COMMENTS ==========

app.get("/api/pins/:id/comments", (req, res) => {
  try {
    const { id } = req.params;
    const comments = db
      .prepare(
        "SELECT * FROM comments WHERE pin_id = ? ORDER BY created_at ASC",
      )
      .all(id);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/pins/:id/comments", (req, res) => {
  try {
    const { id } = req.params;
    const { author, body } = req.body;

    if (!author || !body) {
      return res.status(400).json({ error: "Author and body are required" });
    }

    const result = db
      .prepare("INSERT INTO comments (pin_id, author, body) VALUES (?, ?, ?)")
      .run(id, author, body);
    const comment = db
      .prepare("SELECT * FROM comments WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/comments/:id", (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM comments WHERE id = ?").run(id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve React app (for production)
const distPath = join(__dirname, "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("/{*splat}", (req, res) => {
    res.sendFile(join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`MarkItDown server running on port ${PORT}`);
});
