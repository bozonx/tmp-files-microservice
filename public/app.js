/**
 * Temporary Files Microservice UI Logic
 * Version: 1.3.0
 */

// API Configuration
const getApiConfig = () => {
    const { pathname, origin } = window.location;
    const uiDirPath = pathname.endsWith('/')
        ? pathname
        : (pathname.split('/').pop() || '').includes('.')
            ? pathname.replace(/\/[^/]*$/, '/')
            : `${pathname}/`;

    const uiBasePath = uiDirPath === '/' ? '' : uiDirPath.replace(/\/+$/, '');
    const apiBasePath = uiBasePath;
    return {
        API_BASE_URL: `${origin}${apiBasePath}/api/v1`,
        UI_BASE_PATH: uiBasePath,
        ORIGIN: origin
    };
};

const CONFIG = getApiConfig();

// Constants
const PAGINATION_LIMIT = 20;

// State Management
const STATE = {
    offset: 0,
    isLastPage: false,
    isLoading: false,
    filters: {
        mimeType: '',
        expiredOnly: '',
        uploadedAfter: ''
    }
};

// DOM Elements
const elements = {
    uploadForm: document.getElementById('uploadForm'),
    uploadArea: document.getElementById('uploadArea'),
    fileInput: document.getElementById('fileInput'),
    fileName: document.getElementById('fileName'),
    fileUrlInput: document.getElementById('fileUrl'),
    submitBtn: document.getElementById('submitBtn'),
    btnText: document.getElementById('btnText'),
    btnLoader: document.getElementById('btnLoader'),
    resultDiv: document.getElementById('result'),
    ttlMinsInput: document.getElementById('ttlMins'),
    metadataInput: document.getElementById('metadata'),
    statsContainer: document.getElementById('statsContainer'),
    statTotalFiles: document.getElementById('statTotalFiles'),
    statTotalSize: document.getElementById('statTotalSize'),
    statStorageUsed: document.getElementById('statStorageUsed'),
    refreshBtn: document.getElementById('refreshBtn'),
    cleanupBtn: document.getElementById('cleanupBtn'),
    filesList: document.getElementById('filesList'),
    filesLoader: document.getElementById('filesLoader'),
    noFiles: document.getElementById('noFiles'),
    filesTable: document.getElementById('filesTable'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    toggleFiltersBtn: document.getElementById('toggleFilters'),
    filtersPanel: document.getElementById('filtersPanel'),
    applyFiltersBtn: document.getElementById('applyFilters'),
    resetFiltersBtn: document.getElementById('resetFilters'),
    filterMime: document.getElementById('filterMime'),
    filterExpired: document.getElementById('filterExpired'),
    filterAfter: document.getElementById('filterAfter'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    loadMoreContainer: document.getElementById('loadMoreContainer'),
    loadMoreLoader: document.getElementById('loadMoreLoader'),
    toast: document.getElementById('toast')
};

// Utility Functions
const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const formatRelativeTime = (date) => {
    const diff = date - new Date();
    const mins = Math.round(diff / 60000);
    if (mins < 0) return 'Expired';
    if (mins < 60) return `in ${mins}m`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `in ${hours}h`;
    const days = Math.round(hours / 24);
    return `in ${days}d`;
};

const truncateString = (str, num = 40) => {
    if (!str) return '';
    return str.length <= num ? str : str.slice(0, num) + '...';
};

const normalizeUrl = (value) => {
    if (!value) return '';
    try {
        const url = value.startsWith('http') ? new URL(value) : new URL(value, window.location.origin);
        let pathname = url.pathname;
        if (pathname.startsWith('/api/v1/')) {
            pathname = `${CONFIG.UI_BASE_PATH}${pathname}`;
        }
        return `${window.location.origin}${pathname.replace(/\/{2,}/g, '/')}${url.search}${url.hash}`;
    } catch {
        return value;
    }
};

const showToast = (message) => {
    elements.toast.textContent = message;
    elements.toast.classList.remove('hidden');
    setTimeout(() => elements.toast.classList.add('hidden'), 3000);
};

// API Services
const api = {
    async fetchStats() {
        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}/files/stats`);
            const data = await response.json();
            if (response.ok && data.stats) {
                elements.statTotalFiles.textContent = data.stats.totalFiles || 0;
                elements.statTotalSize.textContent = formatBytes(data.stats.totalSize || 0);
                elements.statStorageUsed.textContent = formatBytes(data.stats.totalSize || 0); // Simulated quota
                elements.statsContainer.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Stats fetch failed', err);
        }
    },

    async fetchFiles(append = false) {
        if (!append) {
            STATE.offset = 0;
            elements.filesLoader.classList.remove('hidden');
            elements.noFiles.classList.add('hidden');
        } else {
            elements.loadMoreBtn.classList.add('hidden');
            elements.loadMoreLoader.classList.remove('hidden');
        }

        try {
            const params = new URLSearchParams({
                limit: PAGINATION_LIMIT,
                offset: STATE.offset,
                ...STATE.filters
            });

            const search = elements.searchInput.value.trim();
            // Search implementation is backend-dependent, if not supported it will just be ignored

            const response = await fetch(`${CONFIG.API_BASE_URL}/files?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) throw new Error(data.message || 'Registry fetch failed');

            STATE.isLastPage = data.files.length < PAGINATION_LIMIT;
            renderFiles(data.files, append);

            elements.loadMoreContainer.classList.toggle('hidden', STATE.isLastPage);
        } catch (err) {
            console.error('Files fetch failed', err);
            if (!append) elements.filesList.innerHTML = '';
        } finally {
            elements.filesLoader.classList.add('hidden');
            elements.loadMoreLoader.classList.add('hidden');
            if (!STATE.isLastPage) elements.loadMoreBtn.classList.remove('hidden');
        }
    },

    async uploadFiles(files, ttlMins, metadata) {
        const results = [];
        for (const file of files) {
            const headers = {
                'x-file-name': file.name || 'unknown',
                'content-type': file.type || 'application/octet-stream'
            };
            if (ttlMins) headers['x-ttl-mins'] = String(ttlMins);
            if (metadata) headers['x-metadata'] = String(metadata);

            const response = await fetch(`${CONFIG.API_BASE_URL}/files`, {
                method: 'POST',
                headers,
                body: file
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || `Resource ${file.name} initiation failed`);
            results.push(data);
        }
        return results;
    },

    async uploadFromUrl(url, ttlMins, metadata) {
        const payload = { url };
        if (ttlMins) payload.ttlMins = parseInt(ttlMins);
        if (metadata) payload.metadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;

        const response = await fetch(`${CONFIG.API_BASE_URL}/files/url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Remote fetch initiation failed');
        return data;
    },

    async deleteFile(id) {
        const response = await fetch(`${CONFIG.API_BASE_URL}/files/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Excision failed');
        }
    },

    async runMaintenance() {
        const response = await fetch(`${CONFIG.API_BASE_URL}/maintenance/run`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Maintenance cycle failed');
        return data;
    }
};

// UI Rendering Logic
const renderFiles = (files, append) => {
    if (!append && (!files || files.length === 0)) {
        elements.noFiles.classList.remove('hidden');
        elements.filesTable.classList.add('hidden');
        return;
    }

    elements.noFiles.classList.add('hidden');
    elements.filesTable.classList.remove('hidden');

    const rowsHtml = files.map(file => {
        const expiresAt = new Date(file.expiresAt);
        const isNearExpiry = (expiresAt - new Date()) < 1000 * 60 * 60; // 1 hour
        const downloadUrl = normalizeUrl(`${CONFIG.API_BASE_URL}/download/${file.id}`);

        return `
            <tr class="clickable-row" onclick="window.ui.toggleMetadata('${file.id}')">
                <td>
                    <div class="file-info">
                        <span class="file-name-cell" title="${file.originalName}">${truncateString(file.originalName, 35)}</span>
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
                    <div class="actions-cell" onclick="event.stopPropagation()" style="justify-content: flex-end;">
                        <a href="${downloadUrl}" class="action-btn download" title="Retrieve Resource" target="_blank">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </a>
                        <button class="action-btn" title="Copy Registry Link" onclick="window.ui.copyLink('${downloadUrl}')">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </button>
                        <button class="action-btn delete" title="Excise Resource" onclick="window.ui.handleDelete(event, '${file.id}')">
                            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
            <tr id="meta-${file.id}" class="metadata-row hidden" onclick="event.stopPropagation()">
                <td colspan="5">
                    <div class="metadata-content">
                        <strong>RESOURCE IDENTITY:</strong> ${file.id}
                        <strong>STORAGE HASH:</strong> ${file.hash || 'N/A'}
                        <strong>METADATA SCHEMA:</strong> ${JSON.stringify(file.metadata || {}, null, 2)}
                        <strong>REGISTRY ACCESS:</strong> ${downloadUrl}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    if (append) {
        elements.filesList.insertAdjacentHTML('beforeend', rowsHtml);
    } else {
        elements.filesList.innerHTML = rowsHtml;
    }
};

// Global UI Actions (attached to window for HTML event handlers)
window.ui = {
    toggleMetadata(id) {
        const el = document.getElementById(`meta-${id}`);
        if (el) el.classList.toggle('hidden');
    },

    copyLink(url) {
        navigator.clipboard.writeText(url).then(() => showToast('Registry link copied'));
    },

    async handleDelete(event, id) {
        event.stopPropagation();
        if (!confirm('Are you certain you wish to excise this resource from storage?')) return;

        try {
            await api.deleteFile(id);
            showToast('Resource excised successfully');
            window.ui.refreshAll();
        } catch (err) {
            console.error('Delete failed', err);
            showToast('Excision protocol failed');
        }
    },

    refreshAll() {
        api.fetchStats();
        api.fetchFiles(false);
    }
};

// Event Listeners
elements.uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const files = elements.fileInput.files;
    const url = elements.fileUrlInput.value.trim();
    const ttlMins = elements.ttlMinsInput.value;
    const metadata = elements.metadataInput.value;

    if (files.length === 0 && !url) {
        showToast('Specify at least one resource payload');
        return;
    }

    elements.submitBtn.disabled = true;
    elements.btnText.classList.add('hidden');
    elements.btnLoader.classList.remove('hidden');
    elements.resultDiv.classList.add('hidden');

    try {
        let result;
        if (files.length > 0) {
            result = await api.uploadFiles(files, ttlMins, metadata);
            elements.resultDiv.innerHTML = `
                <div class="result-title">✓ Lifecycle Initialized</div>
                <div class="results-container">
                    ${result.map(r => `
                        <div class="result-item">
                            <div style="margin-bottom: 0.5rem"><strong>${r.file.originalName}</strong></div>
                            <div class="result-links">
                                <a href="${normalizeUrl(r.downloadUrl)}" target="_blank" class="result-link">Retrieve</a>
                                <button class="btn-text-link" onclick="window.ui.copyLink('${normalizeUrl(r.downloadUrl)}')">Copy Link</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            result = await api.uploadFromUrl(url, ttlMins, metadata);
            elements.resultDiv.innerHTML = `
                <div class="result-title">✓ Remote Fetch Initialized</div>
                <div class="result-item">
                    <div style="margin-bottom: 0.5rem"><strong>${result.file.originalName}</strong></div>
                    <div class="result-links">
                        <a href="${normalizeUrl(result.downloadUrl)}" target="_blank" class="result-link">Retrieve</a>
                        <button class="btn-text-link" onclick="window.ui.copyLink('${normalizeUrl(result.downloadUrl)}')">Copy Link</button>
                    </div>
                </div>
            `;
        }

        elements.resultDiv.className = 'result success';
        elements.resultDiv.classList.remove('hidden');
        elements.uploadForm.reset();
        elements.fileName.textContent = '';
        window.ui.refreshAll();
    } catch (err) {
        elements.resultDiv.innerHTML = `<div class="result-title">✗ Protocol Error</div><div>${err.message}</div>`;
        elements.resultDiv.className = 'result error';
        elements.resultDiv.classList.remove('hidden');
    } finally {
        elements.submitBtn.disabled = false;
        elements.btnText.classList.remove('hidden');
        elements.btnLoader.classList.add('hidden');
    }
});

elements.fileInput.addEventListener('change', () => {
    const files = elements.fileInput.files;
    if (files.length === 1) elements.fileName.textContent = `Payload: ${files[0].name}`;
    else if (files.length > 1) elements.fileName.textContent = `Payload: ${files.length} resources`;
    else elements.fileName.textContent = '';
});

// Drag and Drop
['dragenter', 'dragover'].forEach(e => elements.uploadArea.addEventListener(e, () => elements.uploadArea.classList.add('drag-over')));
['dragleave', 'drop'].forEach(e => elements.uploadArea.addEventListener(e, () => elements.uploadArea.classList.remove('drag-over')));

elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        elements.fileInput.files = files;
        elements.fileInput.dispatchEvent(new Event('change'));
    }
});

elements.toggleFiltersBtn.addEventListener('click', () => elements.filtersPanel.classList.toggle('hidden'));

elements.applyFiltersBtn.addEventListener('click', () => {
    STATE.filters = {
        mimeType: elements.filterMime.value.trim(),
        expiredOnly: elements.filterExpired.value,
        uploadedAfter: elements.filterAfter.value ? new Date(elements.filterAfter.value).toISOString() : ''
    };
    window.ui.refreshAll();
});

elements.resetFiltersBtn.addEventListener('click', () => {
    elements.filterMime.value = '';
    elements.filterExpired.value = '';
    elements.filterAfter.value = '';
    STATE.filters = { mimeType: '', expiredOnly: '', uploadedAfter: '' };
    window.ui.refreshAll();
});

elements.loadMoreBtn.addEventListener('click', () => {
    STATE.offset += PAGINATION_LIMIT;
    api.fetchFiles(true);
});

elements.refreshBtn.addEventListener('click', () => window.ui.refreshAll());

elements.cleanupBtn.addEventListener('click', async () => {
    try {
        const res = await api.runMaintenance();
        console.log('Maintenance result:', res);
        showToast(res.message || 'Maintenance cycle complete');
        window.ui.refreshAll();
    } catch (err) {
        console.error('Maintenance execution failed:', err);
        showToast(`Maintenance failure: ${err.message || 'Check console logs'}`);
    }
});

elements.searchBtn.addEventListener('click', () => window.ui.refreshAll());
elements.searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && window.ui.refreshAll());

// Initialization
document.addEventListener('DOMContentLoaded', () => window.ui.refreshAll());
