import { useState, useEffect, useRef } from "react";

const API_BASE = "/api";

function App() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pins, setPins] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [comments, setComments] = useState([]);
  const [showModal, setShowModal] = useState(null);
  const [hideResolved, setHideResolved] = useState(false);

  const imageRef = useRef(null);

  // Load projects
  useEffect(() => {
    fetchProjects();
  }, []);

  // Load pages when project changes
  useEffect(() => {
    if (selectedProject) {
      fetchPages(selectedProject.id);
    } else {
      setPages([]);
      setSelectedPage(null);
    }
  }, [selectedProject]);

  // Load pins when page changes
  useEffect(() => {
    if (selectedPage) {
      fetchPins(selectedPage.id);
    } else {
      setPins([]);
      setSelectedPin(null);
    }
  }, [selectedPage]);

  // Load comments when pin changes
  useEffect(() => {
    if (selectedPin) {
      fetchComments(selectedPin.id);
    } else {
      setComments([]);
    }
  }, [selectedPin]);

  const fetchProjects = async () => {
    const res = await fetch(`${API_BASE}/projects`);
    const data = await res.json();
    setProjects(data);
  };

  const fetchPages = async (projectId) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/pages`);
    const data = await res.json();
    setPages(data);
  };

  const fetchPins = async (pageId) => {
    const res = await fetch(`${API_BASE}/pages/${pageId}/pins`);
    const data = await res.json();
    setPins(data);
  };

  const fetchComments = async (pinId) => {
    const res = await fetch(`${API_BASE}/pins/${pinId}/comments`);
    const data = await res.json();
    setComments(data);
  };

  const createProject = async (name) => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const project = await res.json();
    setProjects([project, ...projects]);
    setShowModal(null);
  };

  const deleteProject = async (id) => {
    if (!confirm("Delete this project and all its pages?")) return;
    await fetch(`${API_BASE}/projects/${id}`, { method: "DELETE" });
    setProjects(projects.filter((p) => p.id !== id));
    if (selectedProject?.id === id) {
      setSelectedProject(null);
    }
  };

  const createPage = async (name, file) => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("image", file);

    const res = await fetch(
      `${API_BASE}/projects/${selectedProject.id}/pages`,
      {
        method: "POST",
        body: formData,
      },
    );
    const page = await res.json();
    setPages([page, ...pages]);
    setShowModal(null);
  };

  const deletePage = async (id) => {
    if (!confirm("Delete this page and all its pins?")) return;
    await fetch(`${API_BASE}/pages/${id}`, { method: "DELETE" });
    setPages(pages.filter((p) => p.id !== id));
    if (selectedPage?.id === id) {
      setSelectedPage(null);
    }
  };

  const handleImageClick = async (e) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const res = await fetch(`${API_BASE}/pages/${selectedPage.id}/pins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x, y }),
    });
    const pin = await res.json();
    setPins([...pins, pin]);
    setSelectedPin(pin);
  };

  const togglePinResolved = async (pin) => {
    const res = await fetch(`${API_BASE}/pins/${pin.id}/resolve`, {
      method: "PATCH",
    });
    const updatedPin = await res.json();
    setPins(pins.map((p) => (p.id === pin.id ? updatedPin : p)));
    if (selectedPin?.id === pin.id) {
      setSelectedPin(updatedPin);
    }
  };

  const deletePin = async (id) => {
    if (!confirm("Delete this pin and all its comments?")) return;
    await fetch(`${API_BASE}/pins/${id}`, { method: "DELETE" });
    setPins(pins.filter((p) => p.id !== id));
    if (selectedPin?.id === id) {
      setSelectedPin(null);
    }
  };

  const addComment = async (author, body) => {
    const res = await fetch(`${API_BASE}/pins/${selectedPin.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author, body }),
    });
    const comment = await res.json();
    setComments([...comments, comment]);
  };

  const visiblePins = hideResolved ? pins.filter((p) => !p.resolved) : pins;

  return (
    <div className="app">
      <Sidebar
        projects={projects}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        pages={pages}
        selectedPage={selectedPage}
        setSelectedPage={setSelectedPage}
        onCreateProject={() => setShowModal("project")}
        onDeleteProject={deleteProject}
        onCreatePage={() => setShowModal("page")}
        onDeletePage={deletePage}
      />

      <MainArea
        selectedPage={selectedPage}
        pins={visiblePins}
        selectedPin={selectedPin}
        setSelectedPin={setSelectedPin}
        onImageClick={handleImageClick}
        imageRef={imageRef}
        hideResolved={hideResolved}
        setHideResolved={setHideResolved}
      />

      {selectedPin && (
        <RightPanel
          pin={selectedPin}
          comments={comments}
          onToggleResolved={() => togglePinResolved(selectedPin)}
          onDeletePin={() => deletePin(selectedPin.id)}
          onAddComment={addComment}
          onClose={() => setSelectedPin(null)}
        />
      )}

      {showModal === "project" && (
        <ProjectModal
          onSave={createProject}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "page" && (
        <PageModal onSave={createPage} onClose={() => setShowModal(null)} />
      )}
    </div>
  );
}

function Sidebar({
  projects,
  selectedProject,
  setSelectedProject,
  pages,
  selectedPage,
  setSelectedPage,
  onCreateProject,
  onDeleteProject,
  onCreatePage,
  onDeletePage,
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>MarkItDown</h1>
        <button className="btn btn-primary" onClick={onCreateProject}>
          + New Project
        </button>
      </div>

      <div className="projects-list">
        <div className="section-title">Projects</div>
        {projects.map((project) => (
          <div
            key={project.id}
            className={`project-item ${selectedProject?.id === project.id ? "active" : ""}`}
            onClick={() => setSelectedProject(project)}
          >
            <span className="item-name">{project.name}</span>
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteProject(project.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {selectedProject && (
        <div className="pages-list">
          <div className="section-title">Pages</div>
          <button
            className="btn"
            style={{ margin: "0 0 12px 0" }}
            onClick={onCreatePage}
          >
            + New Page
          </button>
          {pages.map((page) => (
            <div
              key={page.id}
              className={`page-item ${selectedPage?.id === page.id ? "active" : ""}`}
              onClick={() => setSelectedPage(page)}
            >
              <span className="item-name">{page.name}</span>
              <button
                className="icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePage(page.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MainArea({
  selectedPage,
  pins,
  selectedPin,
  setSelectedPin,
  onImageClick,
  imageRef,
  hideResolved,
  setHideResolved,
}) {
  if (!selectedPage) {
    return (
      <div className="main-area">
        <div className="empty-state">
          Select a page or create a new project to get started
        </div>
      </div>
    );
  }

  return (
    <div className="main-area">
      <div className="main-header">
        <h2>{selectedPage.name}</h2>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={hideResolved}
            onChange={(e) => setHideResolved(e.target.checked)}
          />
          Hide resolved
        </label>
      </div>
      <div className="main-content">
        <div className="page-canvas">
          <img
            ref={imageRef}
            src={`/uploads/${selectedPage.filename}`}
            alt={selectedPage.name}
            className="page-image"
            onClick={onImageClick}
          />
          {pins.map((pin, index) => (
            <div
              key={pin.id}
              className={`pin ${pin.resolved ? "resolved" : ""} ${selectedPin?.id === pin.id ? "active" : ""}`}
              style={{
                left: `${pin.x}%`,
                top: `${pin.y}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPin(pin);
              }}
            >
              {index + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RightPanel({
  pin,
  comments,
  onToggleResolved,
  onDeletePin,
  onAddComment,
  onClose,
}) {
  const [author, setAuthor] = useState(() => {
    return localStorage.getItem("markitdown-author") || "";
  });
  const [body, setBody] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!author.trim() || !body.trim()) return;
    localStorage.setItem("markitdown-author", author);
    onAddComment(author, body);
    setBody("");
  };

  return (
    <div className="right-panel">
      <div className="panel-header">
        <h3>Pin #{pin.id}</h3>
        <button className="icon-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="panel-content">
        <div style={{ marginBottom: "16px" }}>
          <button
            className={`btn ${pin.resolved ? "" : "btn-primary"}`}
            onClick={onToggleResolved}
            style={{ marginRight: "8px" }}
          >
            {pin.resolved ? "Reopen" : "Resolve"}
          </button>
          <button className="btn btn-danger" onClick={onDeletePin}>
            Delete Pin
          </button>
        </div>

        <div className="section-title">Comments</div>
        {comments.map((comment) => (
          <div key={comment.id} className="comment">
            <div className="comment-author">{comment.author}</div>
            <div className="comment-body">{comment.body}</div>
            <div className="comment-time">
              {new Date(comment.created_at).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      <form className="comment-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Your name</label>
          <input
            type="text"
            className="form-input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Enter your name"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Comment</label>
          <textarea
            className="form-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment..."
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Add Comment
        </button>
      </form>
    </div>
  );
}

function ProjectModal({ onSave, onClose }) {
  const [name, setName] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Create Project</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Project name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PageModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !file) return;
    onSave(name, file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Create Page</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Page name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Homepage"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Screenshot (PNG or JPG)</label>
            <input
              type="file"
              className="file-input"
              accept="image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files[0])}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
