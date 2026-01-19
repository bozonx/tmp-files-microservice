// Get DOM elements
const uploadForm = document.getElementById('uploadForm');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const fileUrlInput = document.getElementById('fileUrl');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const resultDiv = document.getElementById('result');
const ttlMinsInput = document.getElementById('ttlMins');
const metadataInput = document.getElementById('metadata');

// Get API base URL from current location and injected config
const pathname = window.location.pathname;
const uiDirPath = pathname.endsWith('/')
    ? pathname
    : (pathname.split('/').pop() || '').includes('.')
        ? pathname.replace(/\/[^/]*$/, '/')
        : `${pathname}/`;
const uiBasePath = uiDirPath === '/' ? '' : uiDirPath.replace(/\/+$/, '');
const apiBasePath = uiBasePath.replace(/\/ui$/, '');
const API_BASE_URL = `${window.location.origin}${apiBasePath}/api/v1`;

function normalizeApiActionUrl(value) {
    if (!value || typeof value !== 'string') {
        return '';
    }

    let url;
    try {
        url = new URL(value);
    } catch {
        url = new URL(value, window.location.origin);
    }

    let pathname = url.pathname || '';
    if (pathname.startsWith('/api/v1/')) {
        pathname = `${apiBasePath}${pathname}`;
    }
    pathname = pathname.replace(/\/{2,}/g, '/');

    return `${window.location.origin}${pathname}${url.search || ''}${url.hash || ''}`;
}

// Drag and drop handlers
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add('drag-over');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove('drag-over');
    }, false);
});

uploadArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        fileInput.files = files;
        updateFileName(files[0].name);
    }
}

// File input change handler
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        updateFileName(e.target.files[0].name);
    }
});

function updateFileName(name) {
    fileName.textContent = `Selected: ${name}`;
}

// Refresh button and list elements
const refreshBtn = document.getElementById('refreshBtn');
const filesList = document.getElementById('filesList');
const filesLoader = document.getElementById('filesLoader');
const noFiles = document.getElementById('noFiles');
const filesTable = document.getElementById('filesTable');

// Refresh handler
refreshBtn.addEventListener('click', fetchFiles);

// Fetch files from API
async function fetchFiles() {
    setFilesLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/files?limit=20`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch files');
        }

        renderFiles(data.files);
    } catch (error) {
        console.error('Error fetching files:', error);
        filesList.innerHTML = '';
        showNoFiles(true);
    } finally {
        setFilesLoading(false);
    }
}

function setFilesLoading(loading) {
    if (loading) {
        filesLoader.classList.remove('hidden');
    } else {
        filesLoader.classList.add('hidden');
    }
}

function renderFiles(files) {
    if (!files || files.length === 0) {
        showNoFiles(true);
        return;
    }

    showNoFiles(false);
    filesList.innerHTML = files.map(file => {
        const expiresAt = new Date(file.expiresAt);
        const isNearExpiry = (expiresAt - new Date()) < 1000 * 60 * 60; // Less than 1 hour

        const downloadUrl = normalizeApiActionUrl(`${API_BASE_URL}/download/${file.id}`);

        return `
      <tr>
        <td>
          <div class="file-info">
            <a href="${downloadUrl}" target="_blank" class="file-name-cell" title="${file.originalName}">
               ${truncateString(file.originalName, 30)}
            </a>
            <span class="file-id-sub">${file.id}</span>
            ${file.metadata && Object.keys(file.metadata).length > 0 ? `<div class="file-meta-sub" title='${JSON.stringify(file.metadata)}'>Meta: ${JSON.stringify(file.metadata)}</div>` : ''}
          </div>
        </td>
        <td><span class="mime-type">${file.mimeType}</span></td>
        <td><span class="size">${formatBytes(file.size)}</span></td>
        <td>
          <span class="expiry ${isNearExpiry ? 'near' : ''}" title="${expiresAt.toLocaleString()}">
            ${formatRelativeTime(expiresAt)}
          </span>
        </td>
        <td>
          <div class="actions-cell">
            <a href="${downloadUrl}" class="action-btn download" title="Download" target="_blank">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
            <button class="action-btn delete" title="Delete" onclick="handleDelete(event, '${file.id}')">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
    }).join('');
}

function showNoFiles(show) {
    if (show) {
        noFiles.classList.remove('hidden');
        filesTable.classList.add('hidden');
    } else {
        noFiles.classList.add('hidden');
        filesTable.classList.remove('hidden');
    }
}

function truncateString(str, num) {
    if (str.length <= num) return str;
    return str.slice(0, num) + '...';
}

function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = date - now;
    const diffMins = Math.round(diffMs / (1000 * 60));

    if (diffMins < 0) return 'Expired';
    if (diffMins < 60) return `in ${diffMins}m`;

    const diffHours = Math.round(diffMins / 60);
    if (diffHours < 24) return `in ${diffHours}h`;

    const diffDays = Math.round(diffHours / 24);
    return `in ${diffDays}d`;
}

// Initial fetch
fetchFiles();

// Form submission Update: fetch files after success
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const file = fileInput.files[0];
    const fileUrl = fileUrlInput.value.trim();

    // Validate: at least one source must be provided
    if (!file && !fileUrl) {
        showError('Please select a file or provide a URL');
        return;
    }

    // Validate metadata if provided
    const metadataValue = metadataInput.value.trim();
    if (metadataValue) {
        try {
            JSON.parse(metadataValue);
        } catch (err) {
            showError('Invalid JSON in metadata field');
            return;
        }
    }

    const ttlValue = ttlMinsInput.value.trim();

    // Show loading state
    setLoading(true);
    hideResult();

    try {
        let response;

        // Priority: local file over URL
        if (file) {
            // Upload local file using multipart/form-data
            const formData = new FormData();
            if (ttlValue) {
                formData.append('ttlMins', ttlValue);
            }

            if (metadataValue) {
                formData.append('metadata', metadataValue);
            }

            formData.append('file', file);

            response = await fetch(`${API_BASE_URL}/files`, {
                method: 'POST',
                body: formData,
            });
        } else {
            // Upload from URL using JSON
            const payload = {
                url: fileUrl,
            };

            if (ttlValue) {
                payload.ttlMins = parseInt(ttlValue, 10);
            }

            if (metadataValue) {
                payload.metadata = metadataValue;
            }

            response = await fetch(`${API_BASE_URL}/files/url`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        showSuccess(data);
        uploadForm.reset();
        fileName.textContent = '';
        fetchFiles(); // Refresh list after upload
    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(false);
    }
});

function setLoading(loading) {
    submitBtn.disabled = loading;
    if (loading) {
        btnText.classList.add('hidden');
        btnLoader.classList.remove('hidden');
    } else {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
}

function hideResult() {
    resultDiv.classList.add('hidden');
    resultDiv.classList.remove('success', 'error');
}

function showSuccess(data) {
    const { file, downloadUrl, infoUrl, deleteUrl, message } = data;

    const normalizedDownloadUrl = normalizeApiActionUrl(downloadUrl);
    const normalizedInfoUrl = normalizeApiActionUrl(infoUrl);
    const normalizedDeleteUrl = normalizeApiActionUrl(deleteUrl);

    if (!file.id) return; // For deletions handled differently

    const expiresAt = new Date(file.expiresAt).toLocaleString();
    const uploadedAt = new Date(file.uploadedAt).toLocaleString();

    resultDiv.innerHTML = `
    <div class="result-title">✓ ${message || 'File uploaded successfully'}</div>
    <div class="result-info"><strong>File ID:</strong> ${file.id}</div>
    <div class="result-info"><strong>Name:</strong> ${file.originalName}</div>
    <div class="result-info"><strong>Size:</strong> ${formatBytes(file.size)}</div>
    <div class="result-info"><strong>Type:</strong> ${file.mimeType}</div>
    <div class="result-info"><strong>Uploaded:</strong> ${uploadedAt}</div>
    <div class="result-info"><strong>Expires:</strong> ${expiresAt}</div>
    <div class="result-info"><strong>TTL:</strong> ${file.ttlMins} minutes</div>
    <div class="result-links">
      <a href="${normalizedDownloadUrl}" target="_blank">Download</a>
      <a href="${normalizedInfoUrl}" target="_blank">Info</a>
      <a href="#" onclick="handleDelete(event, '${file.id}')">Delete</a>
    </div>
  `;

    resultDiv.classList.remove('hidden', 'error');
    resultDiv.classList.add('success');
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(message) {
    resultDiv.innerHTML = `
    <div class="result-title">✗ Error</div>
    <div>${message}</div>
  `;

    resultDiv.classList.remove('hidden', 'success');
    resultDiv.classList.add('error');
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Delete handler Update: fetch files after success
async function handleDelete(event, fileId) {
    event.preventDefault();

    try {
        const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        // Show simplified success message for deletion
        resultDiv.innerHTML = `
      <div class="result-title">✓ ${data.message || 'File deleted successfully'}</div>
      <div class="result-info"><strong>File ID:</strong> ${fileId}</div>
      <div class="result-info"><strong>Deleted at:</strong> ${new Date(data.deletedAt).toLocaleString()}</div>
    `;
        resultDiv.classList.remove('hidden', 'error');
        resultDiv.classList.add('success');
        fetchFiles(); // Refresh list after deletion
    } catch (error) {
        showError(error.message);
    }
}

// Helper function to format bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
