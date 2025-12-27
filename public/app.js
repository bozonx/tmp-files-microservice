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

// Form submission
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
            formData.append('file', file);

            if (ttlValue) {
                formData.append('ttlMins', ttlValue);
            }

            if (metadataValue) {
                formData.append('metadata', metadataValue);
            }

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
      <a href="${normalizedDeleteUrl}" data-method="DELETE" onclick="handleDelete(event, '${file.id}')">Delete</a>
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

// Delete handler
async function handleDelete(event, fileId) {
    event.preventDefault();

    if (!confirm('Are you sure you want to delete this file?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
            method: 'DELETE',
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        showSuccess({
            file: { id: fileId, originalName: '', size: 0, mimeType: '', uploadedAt: '', expiresAt: '', ttlMins: 0 },
            message: data.message || 'File deleted successfully',
            downloadUrl: '',
            infoUrl: '',
            deleteUrl: '',
        });

        // Show simplified success message for deletion
        resultDiv.innerHTML = `
      <div class="result-title">✓ ${data.message || 'File deleted successfully'}</div>
      <div class="result-info"><strong>File ID:</strong> ${fileId}</div>
      <div class="result-info"><strong>Deleted at:</strong> ${new Date(data.deletedAt).toLocaleString()}</div>
    `;
        resultDiv.classList.remove('hidden', 'error');
        resultDiv.classList.add('success');
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
