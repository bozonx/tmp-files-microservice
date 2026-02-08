/**
 * Temporary Files Microservice UI Logic
 * Version: 1.2.0
 */

// DOM Elements - Upload
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

// DOM Elements - Stats
const statsContainer = document.getElementById('statsContainer');
const statTotalFiles = document.getElementById('statTotalFiles');
const statTotalSize = document.getElementById('statTotalSize');
const statStorageUsed = document.getElementById('statStorageUsed');

// DOM Elements - Management
const refreshBtn = document.getElementById('refreshBtn');
const cleanupBtn = document.getElementById('cleanupBtn');
const filesList = document.getElementById('filesList');
const filesLoader = document.getElementById('filesLoader');
const noFiles = document.getElementById('noFiles');
const filesTable = document.getElementById('filesTable');

// DOM Elements - Filters & Pagination
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const toggleFiltersBtn = document.getElementById('toggleFilters');
const filtersPanel = document.getElementById('filtersPanel');
const applyFiltersBtn = document.getElementById('applyFilters');
const resetFiltersBtn = document.getElementById('resetFilters');
const filterMime = document.getElementById('filterMime');
const filterExpired = document.getElementById('filterExpired');
const filterAfter = document.getElementById('filterAfter');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreLoader = document.getElementById('loadMoreLoader');

// State
let currentOffset = 0;
const LIMIT = 20;
let isLastPage = false;
let currentFilters = {};

// API Config
const pathname = window.location.pathname;
const uiDirPath = pathname.endsWith('/')
    ? pathname
    : (pathname.split('/').pop() || '').includes('.')
        ? pathname.replace(/\/[^/]*$/, '/')
        : `${pathname}/`;
const uiBasePath = uiDirPath === '/' ? '' : uiDirPath.replace(/\/+$/, '');
const apiBasePath = uiBasePath;
const API_BASE_URL = `${window.location.origin}${apiBasePath}/api/v1`;

function normalizeApiActionUrl(value) {
    if (!value || typeof value !== 'string') return '';
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

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    fetchStats();
    fetchFiles();
});

// Stats
async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/files/stats`);
        const data = await response.json();
        if (response.ok && data.stats) {
            statTotalFiles.textContent = data.stats.totalFiles || 0;
            statTotalSize.textContent = formatBytes(data.stats.totalSize || 0);
            statStorageUsed.textContent = formatBytes(data.stats.totalSize || 0);
            statsContainer.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Failed to fetch stats', err);
    }
}

// Cleanup
cleanupBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to run manual cleanup now? This will remove all expired files from storage.')) return;

    cleanupBtn.disabled = true;
    try {
        const response = await fetch(`${API_BASE_URL}/maintenance/run`, { method: 'POST' });
        const data = await response.json();
        if (response.ok) {
            showToast(data.message || 'Maintenance completed');
            refreshAll();
        } else {
            throw new Error(data.message || 'Cleanup failed');
        }
    } catch (err) {
        showError(err.message);
    } finally {
        cleanupBtn.disabled = false;
    }
});

// Filters Toggle
toggleFiltersBtn.addEventListener('click', () => {
    filtersPanel.classList.toggle('hidden');
});

// Search & Filters Logic
function getFilterParams() {
    const params = new URLSearchParams();
    params.append('limit', LIMIT);
    params.append('offset', currentOffset);

    const search = searchInput.value.trim();
    if (search) {
        // The API doesn't have a direct "search" param in the spec I saw, 
        // but it has filters. We'll use filters if provided.
    }

    if (filterMime.value.trim()) params.append('mimeType', filterMime.value.trim());
    if (filterExpired.value) params.append('expiredOnly', filterExpired.value);
    if (filterAfter.value) params.append('uploadedAfter', new Date(filterAfter.value).toISOString());

    return params.toString();
}

async function fetchFiles(append = false) {
    if (!append) {
        currentOffset = 0;
        setFilesLoading(true);
    } else {
        setLoadMoreLoading(true);
    }

    try {
        const query = getFilterParams();
        const response = await fetch(`${API_BASE_URL}/files?${query}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'Failed to fetch files');

        isLastPage = data.files.length < LIMIT;
        renderFiles(data.files, append);

        if (isLastPage) {
            loadMoreContainer.classList.add('hidden');
        } else {
            loadMoreContainer.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error fetching files:', error);
        if (!append) {
            filesList.innerHTML = '';
            showNoFiles(true);
        }
    } finally {
        setFilesLoading(false);
        setLoadMoreLoading(false);
    }
}

searchBtn.addEventListener('click', () => refreshAll());
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') refreshAll(); });
applyFiltersBtn.addEventListener('click', () => refreshAll());
resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    filterMime.value = '';
    filterExpired.value = '';
    filterAfter.value = '';
    refreshAll();
});

loadMoreBtn.addEventListener('click', () => {
    currentOffset += LIMIT;
    fetchFiles(true);
});

refreshBtn.addEventListener('click', () => refreshAll());

function refreshAll() {
    fetchStats();
    fetchFiles(false);
}

// Rendering
function renderFiles(files, append) {
    if (!append && (!files || files.length === 0)) {
        showNoFiles(true);
        return;
    }

    showNoFiles(false);
    const rows = files.map(file => {
        const expiresAt = new Date(file.expiresAt);
        const isNearExpiry = (expiresAt - new Date()) < 1000 * 60 * 60;
        const downloadUrl = normalizeApiActionUrl(`${API_BASE_URL}/download/${file.id}`);

        return `
      <tr class="clickable-row" onclick="toggleMetadata('${file.id}')">
        <td>
          <div class="file-info">
            <span class="file-name-cell" title="${file.originalName}">${truncateString(file.originalName, 40)}</span>
            <span class="file-id-sub">${file.id}</span>
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
          <div class="actions-cell" onclick="event.stopPropagation()">
            <a href="${downloadUrl}" class="action-btn download" title="Download" target="_blank">
               <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
            <button class="action-btn" title="Copy Download Link" onclick="copyToClipboard('${downloadUrl}')">
              <svg class="icon icon-copy" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-3 8.5V11m0 5.5v-1.5m-3-1h6" />
              </svg>
            </button>
            <button class="action-btn delete" title="Delete" onclick="deleteFileAction(event, '${file.id}')">
              <svg class="icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
      <tr id="meta-${file.id}" class="metadata-row hidden" onclick="event.stopPropagation()">
        <td colspan="5">
            <div class="metadata-content">
<strong>Full Info:</strong>
ID:   ${file.id}
Hash: ${file.hash}
Meta: ${JSON.stringify(file.metadata, null, 2)}
URL:  ${downloadUrl}
            </div>
        </td>
      </tr>
    `;
    }).join('');

    if (append) {
        filesList.insertAdjacentHTML('beforeend', rows);
    } else {
        filesList.innerHTML = rows;
    }
}

window.toggleMetadata = function (id) {
    const el = document.getElementById(`meta-${id}`);
    if (el) el.classList.toggle('hidden');
};

window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Link copied to clipboard!');
    });
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Upload Handling
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const files = fileInput.files;
    const url = fileUrlInput.value.trim();

    if (files.length === 0 && !url) {
        showError('Select at least one file or provide a URL');
        return;
    }

    setLoading(true);
    hideResult();

    try {
        if (files.length > 0) {
            // Upload Multiple Local Files
            let results = [];
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                if (ttlMinsInput.value) formData.append('ttlMins', ttlMinsInput.value);
                if (metadataInput.value) formData.append('metadata', metadataInput.value);
                formData.append('file', files[i]);

                const response = await fetch(`${API_BASE_URL}/files`, {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.message || `File ${files[i].name} failed`);
                results.push(data);
            }
            showMultipleSuccess(results, `${files.length} file(s) uploaded successfully`);
        } else if (url) {
            // Upload from URL
            const payload = { url };
            if (ttlMinsInput.value) payload.ttlMins = parseInt(ttlMinsInput.value);
            if (metadataInput.value) payload.metadata = metadataInput.value;

            const response = await fetch(`${API_BASE_URL}/files/url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'URL upload failed');
            showSuccess(data);
        }

        uploadForm.reset();
        fileName.textContent = '';
        refreshAll();
    } catch (err) {
        showError(err.message);
    } finally {
        setLoading(false);
    }
});

// Drag & Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => uploadArea.addEventListener(evt, (e) => {
    e.preventDefault();
    e.stopPropagation();
}));

['dragenter', 'dragover'].forEach(evt => uploadArea.addEventListener(evt, () => uploadArea.classList.add('drag-over')));
['dragleave', 'drop'].forEach(evt => uploadArea.addEventListener(evt, () => uploadArea.classList.remove('drag-over')));

uploadArea.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        updateFileName(files);
    }
});

fileInput.addEventListener('change', () => updateFileName(fileInput.files));

function updateFileName(files) {
    if (files.length === 0) fileName.textContent = '';
    else if (files.length === 1) fileName.textContent = `Selected: ${files[0].name}`;
    else fileName.textContent = `Selected: ${files.length} files`;
}


// Helpers
// Helpers
window.deleteFileAction = async function (event, fileId) {
    console.log('deleteFileAction called for:', fileId);
    event.stopPropagation();
    // No confirmation needed per user request


    try {
        const response = await fetch(`${API_BASE_URL}/files/${fileId}`, { method: 'DELETE' });
        if (response.ok) {
            showToast('File deleted');
            refreshAll();
        } else {
            const data = await response.json();
            throw new Error(data.message || 'Deletion failed');
        }
    } catch (err) {
        console.error('Delete error:', err);
        showError(err.message);
    }
}

function setFilesLoading(loading) {
    loading ? filesLoader.classList.remove('hidden') : filesLoader.classList.add('hidden');
}

function setLoadMoreLoading(loading) {
    if (loading) {
        loadMoreBtn.classList.add('hidden');
        loadMoreLoader.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.remove('hidden');
        loadMoreLoader.classList.add('hidden');
    }
}

function showNoFiles(show) {
    if (show) {
        noFiles.classList.remove('hidden');
        filesTable.classList.add('hidden');
        loadMoreContainer.classList.add('hidden');
    } else {
        noFiles.classList.add('hidden');
        filesTable.classList.remove('hidden');
    }
}

function setLoading(loading) {
    submitBtn.disabled = loading;
    loading ? (btnText.classList.add('hidden'), btnLoader.classList.remove('hidden'))
        : (btnText.classList.remove('hidden'), btnLoader.classList.add('hidden'));
}

function hideResult() {
    resultDiv.classList.add('hidden');
}

function showSuccess(data, customMessage) {
    const { file, downloadUrl } = data;
    const normUrl = normalizeApiActionUrl(downloadUrl);
    resultDiv.innerHTML = `
        <div class="result-title">✓ ${customMessage || 'Uploaded successfully'}</div>
        <div class="result-item">
            <div class="result-file-name"><strong>File:</strong> ${file.originalName}</div>
            <div class="result-file-id"><strong>ID:</strong> ${file.id}</div>
            <div class="result-links">
                <a href="${normUrl}" target="_blank" class="result-link">Download</a>
                <button class="btn-text-link" onclick="copyToClipboard('${normUrl}')">Copy Link</button>
            </div>
        </div>
    `;
    resultDiv.className = 'result success';
    resultDiv.classList.remove('hidden');
}

function showMultipleSuccess(results, customMessage) {
    let itemsHtml = results.map(data => {
        const { file, downloadUrl } = data;
        const normUrl = normalizeApiActionUrl(downloadUrl);
        return `
            <div class="result-item multi">
                <div class="result-file-name"><strong>File:</strong> ${file.originalName}</div>
                <div class="result-links">
                    <a href="${normUrl}" target="_blank" class="result-link">Download</a>
                    <button class="btn-text-link" onclick="copyToClipboard('${normUrl}')">Copy Link</button>
                </div>
            </div>
        `;
    }).join('');

    resultDiv.innerHTML = `
        <div class="result-title">✓ ${customMessage}</div>
        <div class="results-container">
            ${itemsHtml}
        </div>
    `;
    resultDiv.className = 'result success';
    resultDiv.classList.remove('hidden');
}

function showError(msg) {
    resultDiv.innerHTML = `<div class="result-title">✗ Error</div><div>${msg}</div>`;
    resultDiv.className = 'result error';
    resultDiv.classList.remove('hidden');
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatRelativeTime(date) {
    const diff = date - new Date();
    const mins = Math.round(diff / 60000);
    if (mins < 0) return 'Expired';
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `in ${hours}h`;
    return `in ${Math.round(hours / 24)}d`;
}

function truncateString(str, num) {
    if (str.length <= num) return str;
    return str.slice(0, num) + '...';
}
