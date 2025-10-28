import * as fs from 'fs';
import * as path from 'path';

/**
 * Reads the application version from package.json
 * Tries multiple candidate paths to handle different execution contexts
 * @returns Version string or '0.0.0' if not found
 */
export function readPackageVersion(): string {
  const candidates = [
    path.resolve(process.cwd(), 'package.json'),
    path.resolve(__dirname, '..', '..', 'package.json'),
    path.resolve(__dirname, '..', '..', '..', 'package.json'),
  ];

  for (const pkgPath of candidates) {
    try {
      const raw = fs.readFileSync(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw) as { version?: string };
      if (typeof pkg.version === 'string' && pkg.version.length > 0) {
        return pkg.version;
      }
    } catch (_err) {
      // Continue to next candidate
      continue;
    }
  }

  return '0.0.0';
}
