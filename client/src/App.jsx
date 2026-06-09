import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const emptyList = []

function pickActiveId(items, preferredId, currentId) {
  if (preferredId && items.some((item) => item.id === preferredId)) {
    return preferredId
  }

  if (currentId && items.some((item) => item.id === currentId)) {
    return currentId
  }

  return items[0]?.id ?? null
}

function formatTimestamp(value) {
  return new Date(value).toLocaleString()
}

async function apiFetch(url, options = {}) {
  const { body, headers, ...rest } = options
  const requestHeaders = new Headers(headers ?? {})
  const requestOptions = {
    ...rest,
    headers: requestHeaders,
  }

  if (body instanceof FormData) {
    requestOptions.body = body
  } else if (body !== undefined) {
    requestHeaders.set('Content-Type', 'application/json')
    requestOptions.body = JSON.stringify(body)
  }

  const response = await fetch(url, requestOptions)
  if (response.status === 204) {
    return null
  }

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed.')
  }

  return payload
}

function App() {
  const [projects, setProjects] = useState(emptyList)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [pages, setPages] = useState(emptyList)
  const [selectedPageId, setSelectedPageId] = useState(null)
  const [pins, setPins] = useState(emptyList)
  const [selectedPinId, setSelectedPinId] = useState(null)
  const [comments, setComments] = useState(emptyList)
  const [projectName, setProjectName] = useState('')
  const [pageName, setPageName] = useState('')
  const [pageImage, setPageImage] = useState(null)
  const [author, setAuthor] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [showResolved, setShowResolved] = useState(true)
  const [error, setError] = useState('')

  const handleError = useCallback((requestError) => {
    setError(requestError.message)
  }, [])

  const refreshProjects = useCallback(async (preferredId) => {
    const data = await apiFetch('/api/projects')
    setProjects(data)
    setSelectedProjectId((currentId) => pickActiveId(data, preferredId, currentId))
  }, [])

  const refreshPages = useCallback(async (projectId, preferredId) => {
    if (!projectId) {
      setPages(emptyList)
      setSelectedPageId(null)
      return
    }

    const data = await apiFetch(`/api/projects/${projectId}/pages`)
    setPages(data)
    setSelectedPageId((currentId) => pickActiveId(data, preferredId, currentId))
  }, [])

  const refreshPins = useCallback(async (pageId, preferredId) => {
    if (!pageId) {
      setPins(emptyList)
      setSelectedPinId(null)
      return
    }

    const data = await apiFetch(`/api/pages/${pageId}/pins`)
    setPins(data)
    setSelectedPinId((currentId) => pickActiveId(data, preferredId, currentId))
  }, [])

  const refreshComments = useCallback(async (pinId) => {
    if (!pinId) {
      setComments(emptyList)
      return
    }

    const data = await apiFetch(`/api/pins/${pinId}/comments`)
    setComments(data)
  }, [])

  const runAction = useCallback(async (action) => {
    try {
      setError('')
      await action()
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProjects().then(() => setError('')).catch(handleError)
  }, [handleError, refreshProjects])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPages(selectedProjectId).then(() => setError('')).catch(handleError)
  }, [handleError, refreshPages, selectedProjectId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshPins(selectedPageId).then(() => setError('')).catch(handleError)
  }, [handleError, refreshPins, selectedPageId])

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null
  const selectedPage = pages.find((page) => page.id === selectedPageId) ?? null
  const visiblePins = useMemo(
    () => pins.filter((pin) => showResolved || !pin.resolved),
    [pins, showResolved],
  )
  const activePinId = useMemo(() => {
    const selectedPinIsVisible = pins.some(
      (pin) => pin.id === selectedPinId && (showResolved || !pin.resolved),
    )

    if (selectedPinIsVisible) {
      return selectedPinId
    }

    return visiblePins[0]?.id ?? null
  }, [pins, selectedPinId, showResolved, visiblePins])
  const selectedPin = pins.find((pin) => pin.id === activePinId) ?? null
  const pinNumbers = useMemo(
    () => new Map(pins.map((pin, index) => [pin.id, index + 1])),
    [pins],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshComments(activePinId).then(() => setError('')).catch(handleError)
  }, [activePinId, handleError, refreshComments])

  const handleCreateProject = async (event) => {
    event.preventDefault()
    await runAction(async () => {
      const project = await apiFetch('/api/projects', {
        method: 'POST',
        body: { name: projectName },
      })
      setProjectName('')
      await refreshProjects(project.id)
    })
  }

  const handleRenameProject = async (project) => {
    const nextName = window.prompt('Rename project', project.name)
    if (nextName === null) {
      return
    }

    await runAction(async () => {
      await apiFetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        body: { name: nextName },
      })
      await refreshProjects(project.id)
    })
  }

  const handleDeleteProject = async (project) => {
    if (!window.confirm(`Delete project “${project.name}”?`)) {
      return
    }

    await runAction(async () => {
      await apiFetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      await refreshProjects()
    })
  }

  const handleUploadPage = async (event) => {
    event.preventDefault()
    if (!selectedProjectId || !pageImage) {
      setError('Choose a project and screenshot image first.')
      return
    }

    const formData = new FormData()
    formData.append('name', pageName)
    formData.append('image', pageImage)

    await runAction(async () => {
      const page = await apiFetch(`/api/projects/${selectedProjectId}/pages`, {
        method: 'POST',
        body: formData,
      })
      setPageName('')
      setPageImage(null)
      event.currentTarget.reset()
      await refreshPages(selectedProjectId, page.id)
    })
  }

  const handleDeletePage = async (page) => {
    if (!window.confirm(`Delete page “${page.name}”?`)) {
      return
    }

    await runAction(async () => {
      await apiFetch(`/api/pages/${page.id}`, { method: 'DELETE' })
      await refreshPages(selectedProjectId)
    })
  }

  const handleCanvasClick = async (event) => {
    if (!selectedPage) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) {
      return
    }

    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100

    await runAction(async () => {
      const pin = await apiFetch(`/api/pages/${selectedPage.id}/pins`, {
        method: 'POST',
        body: { x, y },
      })
      await refreshPins(selectedPage.id, pin.id)
    })
  }

  const handleToggleResolved = async () => {
    if (!selectedPin) {
      return
    }

    await runAction(async () => {
      const pin = await apiFetch(`/api/pins/${selectedPin.id}/resolve`, {
        method: 'PATCH',
      })
      await refreshPins(selectedPageId, pin.id)
    })
  }

  const handleDeletePin = async () => {
    if (!selectedPin) {
      return
    }

    if (!window.confirm('Delete this pin and its comment thread?')) {
      return
    }

    await runAction(async () => {
      await apiFetch(`/api/pins/${selectedPin.id}`, { method: 'DELETE' })
      await refreshPins(selectedPageId)
    })
  }

  const handleAddComment = async (event) => {
    event.preventDefault()
    if (!selectedPin) {
      return
    }

    await runAction(async () => {
      await apiFetch(`/api/pins/${selectedPin.id}/comments`, {
        method: 'POST',
        body: {
          author,
          body: commentBody,
        },
      })
      setCommentBody('')
      await refreshComments(selectedPin.id)
    })
  }

  const handleDeleteComment = async (commentId) => {
    await runAction(async () => {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      await refreshComments(activePinId)
    })
  }

  return (
    <div className="app-shell">
      <aside className="sidebar left-sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Mark It Down</p>
            <h1>Projects</h1>
          </div>
        </div>

        <form className="panel-form" onSubmit={handleCreateProject}>
          <input
            type="text"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="New project name"
          />
          <button type="submit">Create</button>
        </form>

        <div className="panel-list project-list">
          {projects.length === 0 ? <p className="empty-text">Create a project to get started.</p> : null}
          {projects.map((project) => (
            <div key={project.id} className={`list-card ${project.id === selectedProjectId ? 'active' : ''}`}>
              <button
                type="button"
                className="list-button"
                onClick={() => setSelectedProjectId(project.id)}
              >
                <span>{project.name}</span>
                <small>{new Date(project.created_at).toLocaleDateString()}</small>
              </button>
              <div className="card-actions">
                <button type="button" className="ghost-button" onClick={() => handleRenameProject(project)}>
                  Rename
                </button>
                <button type="button" className="ghost-button danger" onClick={() => handleDeleteProject(project)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-section">
          <div className="section-heading">
            <h2>Pages</h2>
            {selectedProject ? <span>{selectedProject.name}</span> : null}
          </div>

          <form className="panel-form" onSubmit={handleUploadPage}>
            <input
              type="text"
              value={pageName}
              onChange={(event) => setPageName(event.target.value)}
              placeholder="Screenshot name"
              disabled={!selectedProjectId}
            />
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => setPageImage(event.target.files?.[0] ?? null)}
              disabled={!selectedProjectId}
            />
            <button type="submit" disabled={!selectedProjectId}>
              Upload
            </button>
          </form>

          <div className="panel-list page-list">
            {selectedProjectId && pages.length === 0 ? (
              <p className="empty-text">Upload a screenshot to start annotating.</p>
            ) : null}
            {pages.map((page) => (
              <div key={page.id} className={`list-card ${page.id === selectedPageId ? 'active' : ''}`}>
                <button
                  type="button"
                  className="list-button"
                  onClick={() => setSelectedPageId(page.id)}
                >
                  <span>{page.name}</span>
                  <small>{page.filename}</small>
                </button>
                <div className="card-actions single-action">
                  <button type="button" className="ghost-button danger" onClick={() => handleDeletePage(page)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="workspace">
        <div className="workspace-toolbar">
          <div>
            <p className="eyebrow">Screenshot canvas</p>
            <h2>{selectedPage?.name ?? 'Select a page'}</h2>
          </div>
          <label className="toggle">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(event) => setShowResolved(event.target.checked)}
            />
            <span>Show resolved pins</span>
          </label>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {selectedPage ? (
          <div className="canvas-panel">
            <p className="canvas-help">Click anywhere on the screenshot to drop a new pin.</p>
            <div className="canvas-scroll">
              <div className="canvas" onClick={handleCanvasClick} role="presentation">
                <img src={`/uploads/${selectedPage.filename}`} alt={selectedPage.name} />
                {visiblePins.map((pin) => (
                  <button
                    key={pin.id}
                    type="button"
                    className={`pin ${pin.id === activePinId ? 'selected' : ''} ${pin.resolved ? 'resolved' : ''}`}
                    style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedPinId(pin.id)
                    }}
                  >
                    {pinNumbers.get(pin.id)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h3>No page selected</h3>
            <p>Create a project and upload a screenshot to begin annotating.</p>
          </div>
        )}
      </main>

      <aside className="sidebar right-sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Thread</p>
            <h2>{selectedPin ? `Pin #${pinNumbers.get(selectedPin.id)}` : 'Choose a pin'}</h2>
          </div>
          {selectedPin ? (
            <div className="card-actions">
              <button type="button" className="ghost-button" onClick={handleToggleResolved}>
                {selectedPin.resolved ? 'Reopen' : 'Resolve'}
              </button>
              <button type="button" className="ghost-button danger" onClick={handleDeletePin}>
                Delete
              </button>
            </div>
          ) : null}
        </div>

        {selectedPin ? (
          <>
            <div className="pin-summary">
              <div>
                <span>Status</span>
                <strong>{selectedPin.resolved ? 'Resolved' : 'Open'}</strong>
              </div>
              <div>
                <span>Position</span>
                <strong>
                  {selectedPin.x.toFixed(1)}%, {selectedPin.y.toFixed(1)}%
                </strong>
              </div>
            </div>

            <div className="comment-list">
              {comments.length === 0 ? <p className="empty-text">No comments yet.</p> : null}
              {comments.map((comment) => (
                <article key={comment.id} className="comment-card">
                  <div className="comment-header">
                    <div>
                      <strong>{comment.author}</strong>
                      <small>{formatTimestamp(comment.created_at)}</small>
                    </div>
                    <button
                      type="button"
                      className="ghost-button danger"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      Delete
                    </button>
                  </div>
                  <p>{comment.body}</p>
                </article>
              ))}
            </div>

            <form className="panel-form comment-form" onSubmit={handleAddComment}>
              <input
                type="text"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="Your name"
              />
              <textarea
                value={commentBody}
                onChange={(event) => setCommentBody(event.target.value)}
                placeholder="Add a comment"
                rows="5"
              />
              <button type="submit">Post comment</button>
            </form>
          </>
        ) : (
          <div className="empty-state right-empty-state">
            <h3>No pin selected</h3>
            <p>Select an existing pin or click the screenshot to create a new one.</p>
          </div>
        )}
      </aside>
    </div>
  )
}

export default App
