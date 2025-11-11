# StorageModule — File Storage Module

## Overview

StorageModule implements a simple, file-system–backed storage used by the service. It supports saving, reading, deleting files, SHA-256–based deduplication, and time-based directory organization.

## Components

### StorageService

Primary service that encapsulates storage operations.

#### Capabilities

1. **Save file** (`saveFile`)
   - Validates file size against configured limit
   - Safe MIME detection via `file-type` with graceful fallback
   - Optional MIME allowlist validation
   - SHA-256 hash–based deduplication
   - Date-based directory layout (YYYY-MM)
   - Safe filename generation

2. **Get file info** (`getFileInfo`)
   - Returns file metadata by ID
   - Validates expiration (TTL)

3. **Read file** (`readFile`)
   - Reads file content by ID
   - Returns a Buffer

4. **Delete file** (`deleteFile`)
   - Removes file from disk
   - Updates metadata atomically

5. **Search files** (`searchFiles`)
   - Filters by MIME type, size range, date range
   - Supports expired-only search
   - Pagination via `limit` and `offset`

6. **Statistics** (`getFileStats`)
   - Total files and size
   - Grouping by MIME types and upload date

7. **Storage health** (`getStorageHealth`)
   - Availability check
   - Disk usage info (placeholder implementation)
   - File count

#### Configuration

- `STORAGE_DIR` — base path to storage (required)
- `MAX_FILE_SIZE_MB` — max upload size in megabytes (default: 100)
- `ALLOWED_MIME_TYPES` — comma-separated allowlist (e.g., `image/jpeg,image/png`). Empty = allow all
- `ENABLE_DEDUPLICATION` — enables deduplication (default: `true`)
- `MAX_TTL_MIN` — maximum TTL in minutes (default: 44640 = 31 days; used by FilesService validation)

## Storage layout

```
storage/
├── data.json          # Metadata for all files
└── 2024-01/           # Files uploaded in January 2024
    ├── uuid1_file1.jpg
    └── uuid2_file2.pdf
└── 2024-02/
    └── uuid3_file3.txt
```

## Metadata (data.json)

```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "totalFiles": 3,
  "totalSize": 1024000,
  "files": {
    "uuid1": {
      "id": "uuid1",
      "originalName": "file1.jpg",
      "storedName": "uuid1_file1_abc123.jpg",
      "mimeType": "image/jpeg",
      "size": 512000,
      "hash": "sha256hash...",
      "uploadedAt": "2024-01-15T10:00:00.000Z",
      "ttl": 3600,
      "expiresAt": "2024-01-15T11:00:00.000Z",
      "filePath": "/storage/2024-01/uuid1_file1_abc123.jpg",
      "metadata": {}
    }
  }
}
```

## Security considerations

1. Optional MIME allowlist validation
2. File size limits
3. Safe filename generation
4. SHA-256 hashing for deduplication
5. MIME detection via `file-type` with fallback

## Deduplication

When enabled:

- Files with identical SHA-256 hashes are stored only once
- Re-uploads of the same content return the existing record
- Expiration time may be refreshed upon re-upload

## Testing

Unit tests cover initialization, stats, search, and error handling basics.

## Configuration examples

### Allow all types (default)

```
ALLOWED_MIME_TYPES=
```

### Only images

```
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,image/webp
```

### Only documents

```
ALLOWED_MIME_TYPES=application/pdf,text/plain,application/json,text/csv
```
