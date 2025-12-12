# Web UI Usage Guide

The Temporary Files Microservice includes a simple web interface for uploading files.

## Accessing the UI

After starting the service, open your browser and navigate to:

```
http://localhost:8080/
```

(Adjust the host and port based on your configuration)

## Features

### Upload Files

1. **Select a file**:
   - Click on the upload area, or
   - Drag and drop a file onto the upload area

2. **Configure TTL (optional)**:
   - Enter the time-to-live in minutes (default: 1440 = 1 day)
   - The file will be automatically deleted after this period

3. **Add metadata (optional)**:
   - Enter custom metadata in JSON format
   - Example: `{"source": "manual-upload", "user": "admin"}`

4. **Upload**:
   - Click the "Upload File" button
   - Wait for the upload to complete

### View Results

After a successful upload, you'll see:

- **File ID**: Unique identifier for the file
- **File Name**: Original filename
- **Size**: File size in human-readable format
- **Type**: MIME type
- **Upload Time**: When the file was uploaded
- **Expiration Time**: When the file will be deleted
- **TTL**: Time to live in minutes

### Quick Actions

The result panel provides links to:

- **Download**: Download the uploaded file
- **Info**: View detailed file information (JSON)
- **Delete**: Delete the file immediately

## Security

⚠️ **Important**: The UI has no built-in authentication.

In production environments:
- Protect the UI using your reverse proxy (e.g., Nginx, Caddy, Traefik)
- Use Basic Auth, IP whitelisting, or OAuth
- See the main README for reverse proxy configuration examples

## Technical Details

- The UI uses vanilla HTML/CSS/JavaScript (no external dependencies)
- All requests are made to the REST API at `/api/v1/files`
- Static files are served from the `public/` directory
- The UI works in all modern browsers

## Troubleshooting

### File upload fails with 413 error

The file exceeds the maximum allowed size. Check the `MAX_FILE_SIZE_MB` environment variable.

### Invalid JSON in metadata field

Ensure your metadata is valid JSON. Use double quotes for keys and string values.

Example of valid JSON:
```json
{"key": "value", "number": 123, "boolean": true}
```

### UI not loading

1. Ensure the service is running
2. Check that the `public/` directory exists and contains `index.html`, `styles.css`, and `app.js`
3. Verify there are no errors in the browser console
