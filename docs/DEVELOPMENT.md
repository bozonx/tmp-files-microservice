# Development Guide

This guide provides information for developers working on the `micro-stt` microservice codebase.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Running Locally](#running-locally)
- [Testing](#testing)
- [Building](#building)
- [Code Style](#code-style)
- [Development Workflow](#development-workflow)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Contributing](#contributing)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 22+ (LTS recommended)
- **pnpm** 10+ (package manager)
- **Git** for version control
- **Docker** (optional, for containerized development)

## Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ivan-k-automation-tools/micro-stt
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Create a development environment file:

```bash
cp env.development.example .env.development
```

Edit `.env.development` with your configuration:

```bash
NODE_ENV=development
LISTEN_HOST=localhost
LISTEN_PORT=3000
LOG_LEVEL=debug

# Authentication (optional in development)
AUTH_ENABLED=false

# STT Configuration
ALLOW_CUSTOM_API_KEY=true
ASSEMBLYAI_API_KEY=your-assemblyai-api-key-here

# STT Settings
STT_DEFAULT_PROVIDER=assemblyai
STT_ALLOWED_PROVIDERS=assemblyai
STT_MAX_FILE_SIZE_MB=100
STT_REQUEST_TIMEOUT_SEC=15
STT_POLL_INTERVAL_MS=1500
STT_MAX_SYNC_WAIT_MIN=3

# API Configuration
API_BASE_PATH=api
API_VERSION=v1

# Timezone
TZ=UTC

```

### 4. Verify Installation

Run the health check:

```bash
pnpm start:dev
# Then in another terminal:
curl http://localhost:3000/api/v1/health
```

## Project Structure

```
micro-stt/
├── src/
│   ├── common/              # Shared components
│   │   ├── constants/       # DI tokens and constants
│   │   ├── dto/             # Data Transfer Objects
│   │   ├── filters/         # Exception filters
│   │   ├── guards/          # Auth guards
│   │   └── interfaces/      # TypeScript interfaces
│   ├── config/              # Configuration modules
│   │   ├── app.config.ts    # Application config
│   │   └── stt.config.ts    # STT provider config
│   ├── modules/             # Feature modules
│   │   ├── health/          # Health check endpoints
│   │   ├── index/           # API index endpoint
│   │   └── transcription/   # Transcription logic
│   ├── providers/           # External provider integrations
│   │   └── assemblyai/      # AssemblyAI provider
│   ├── app.module.ts        # Root application module
│   └── main.ts              # Application entry point
├── test/
│   ├── e2e/                 # End-to-end tests
│   ├── unit/                # Unit tests
│   ├── setup/               # Test setup files
│   │   ├── unit.setup.ts    # Unit test setup
│   │   └── e2e.setup.ts     # E2E test setup
│   └── helpers/             # Test helper utilities
├── docs/                    # Documentation
├── dist/                    # Compiled output (generated)
├── coverage/                # Test coverage reports (generated)
├── jest.config.ts           # Jest configuration
├── nest-cli.json            # NestJS CLI configuration
├── tsconfig.json            # TypeScript configuration
├── tsconfig.build.json      # TypeScript build configuration
├── tsconfig.spec.json       # TypeScript test configuration
└── package.json             # Project dependencies and scripts
```

### Key Directories

- **`src/common/`** - Reusable components used across modules (guards, filters, DTOs)
- **`src/modules/`** - Feature modules (each module is self-contained)
- **`src/providers/`** - External service integrations (STT providers)
- **`test/unit/`** - Unit tests for individual components
- **`test/e2e/`** - End-to-end integration tests

## Running Locally

### Development Mode with Hot Reload

```bash
# Start with development configuration
NODE_ENV=development pnpm start:dev

# Or simply (defaults to development)
pnpm start:dev
```

The service will:

- Start on `http://localhost:3000` (configurable)
- Reload automatically on file changes
- Use pretty-printed logs with full timestamps
- Enable debug-level logging

### Production Mode Locally

```bash
# Build the project
pnpm build

# Run production build
NODE_ENV=production pnpm start:prod
```

### Watch Mode (Without Debug)

```bash
pnpm start
```

## Testing

The project uses **Jest** as the testing framework with separate configurations for unit and e2e tests.

### Running All Tests

```bash
# Run all tests (unit + e2e)
pnpm test
```

### Unit Tests

Unit tests are located in `test/unit/` and test individual components in isolation.

```bash
# Run unit tests
pnpm test:unit

# Run with coverage
pnpm test:cov

# Run in watch mode
pnpm test:watch

# Run specific test file
pnpm test:unit -- auth.guard.spec.ts
```

**Unit test structure:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { MyService } from './my.service';
import { createMockLogger, createMockConfigService } from '@test/helpers/mocks';

describe('MyService', () => {
  let service: MyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: PinoLogger,
          useValue: createMockLogger(),
        },
        {
          provide: ConfigService,
          useValue: createMockConfigService(),
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### E2E Tests

E2E tests are located in `test/e2e/` and test the entire application flow.

```bash
# Run e2e tests
pnpm test:e2e

# Run specific e2e test
pnpm test:e2e -- health.e2e-spec.ts
```

**E2E test structure:**

```typescript
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';

describe('Health (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());

    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', () => {
    return app
      .inject({
        method: 'GET',
        url: '/api/v1/health',
      })
      .then(result => {
        expect(result.statusCode).toBe(200);
      });
  });
});
```

### Test Coverage

```bash
# Generate coverage report
pnpm test:cov

# Coverage report will be in coverage/lcov-report/index.html
```

**Current coverage metrics:**

- Statements: ~87%
- Branches: ~76%
- Functions: ~92%
- Lines: ~87%

### Debug Tests

```bash
# Run all tests in debug mode with open handles detection
pnpm test:debug

# Run only unit tests in debug mode
pnpm test:unit:debug

# Run only e2e tests in debug mode
pnpm test:e2e:debug

# Then attach your debugger to the Node process (usually port 9229)
```

## Building

### Development Build

```bash
# Build for development
pnpm build
```

Output will be in `dist/` directory.

### Production Build

```bash
# Build optimized for production
NODE_ENV=production pnpm build
```

### Clean Build

```bash
# Remove dist directory and rebuild
rm -rf dist
pnpm build
```

## Code Style

The project follows the **NestJS** and **TypeScript** best practices.

### TypeScript Configuration

- **Strict mode enabled:** Ensures type safety
- **Path aliases:** Use `@common`, `@modules`, `@config` for imports (configured in `tsconfig.json`)
- **Named exports:** Prefer named exports over default exports

### Linting

```bash
# Run ESLint
pnpm lint

# Auto-fix issues
pnpm lint --fix
```

### Formatting

```bash
# Format code with Prettier
pnpm format
```

### Code Standards (from repo rules)

- **Interfaces over types:** Use interfaces for object shapes
- **Object parameters:** Functions with 3+ arguments should use object parameters
- **Named exports:** Prefer named exports over default exports
- **Comments:** Only add detailed comments to complex blocks
- **Error handling:** Handle errors gracefully with actionable messages

## Development Workflow

### Adding a New Feature

1. **Create a feature branch:**

   ```bash
   git checkout -b feature/my-feature
   ```

2. **Implement the feature:**
   - Add code in appropriate module under `src/modules/`
   - Follow existing patterns (controller → service → provider)

3. **Write tests:**
   - Add unit tests in `test/unit/`
   - Add e2e tests in `test/e2e/` if needed

4. **Update documentation:**
   - Update relevant docs in `docs/`
   - Update `docs/CHANGELOG.md` with your changes

5. **Run tests and linting:**

   ```bash
   pnpm test
   pnpm lint
   pnpm format
   ```

6. **Commit and push:**
   ```bash
   git add .
   git commit -m "feat: add my feature"
   git push origin feature/my-feature
   ```

### Adding a New STT Provider

To add a new STT provider:

1. **Create provider class** in `src/providers/`:

   ```typescript
   @Injectable()
   export class NewProviderService implements SttProvider {
     async transcribe(options: TranscribeOptions): Promise<TranscriptionResult> {
       // Implement transcription logic
     }
   }
   ```

2. **Register provider** in `src/providers/index.ts`

3. **Add configuration** in `src/config/stt.config.ts`

4. **Update allowed providers** in environment variables

5. **Write tests** for the new provider

6. **Update documentation**

## Debugging

### VSCode Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeArgs": ["-r", "ts-node/register", "-r", "tsconfig-paths/register"],
      "args": ["${workspaceFolder}/src/main.ts"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "outputCapture": "std"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Jest Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debug Logging

Enable debug logs:

```bash
# In .env.development
LOG_LEVEL=debug
```

### Inspecting HTTP Requests

Use the built-in logging:

- All requests are automatically logged by `pino-http`
- Request ID is generated for each request
- Response times are tracked

### Using curl for Testing

```bash
# Test health endpoint
curl http://localhost:3000/api/v1/health | jq

# Test transcription (with auth)
curl -X POST http://localhost:3000/api/v1/transcriptions/file \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer test-token' \
  -d '{"audioUrl": "https://example.com/audio.mp3"}' | jq

```

## Common Tasks

### Update Dependencies

```bash
# Check for outdated packages
pnpm outdated

# Update all dependencies
pnpm update

# Update specific package
pnpm update @nestjs/core
```

### Generate Module/Service/Controller

Using NestJS CLI:

```bash
# Generate a new module
nest generate module my-module

# Generate a service
nest generate service my-service

# Generate a controller
nest generate controller my-controller
```

### Run Type Checking

```bash
# Check TypeScript types without building
pnpm tsc --noEmit
```

### Environment-Specific Testing

```bash
# Test with production-like settings
NODE_ENV=production pnpm start:prod

# Test with different configurations
AUTH_ENABLED=true AUTH_TOKENS=test-token pnpm start:dev
```

## Contributing

### Commit Message Convention

Follow conventional commits:

```
feat: add new feature
fix: fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add or update tests
chore: update dependencies
```

### Code Review Checklist

Before submitting a PR:

- [ ] All tests pass (`pnpm test`)
- [ ] Code is linted (`pnpm lint`)
- [ ] Code is formatted (`pnpm format`)
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] No sensitive data in code
- [ ] Environment variables are documented

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Write/update tests
4. Update documentation
5. Run all checks
6. Create pull request
7. Address review comments
8. Merge when approved

## Troubleshooting Development Issues

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env.development
LISTEN_PORT=3001
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### TypeScript Errors

```bash
# Clear build cache
rm -rf dist tsconfig.build.tsbuildinfo

# Rebuild
pnpm build
```

### Test Failures

```bash
# Clear Jest cache
pnpm test --clearCache

# Run tests with verbose output
pnpm test --verbose
```

### pnpm Issues

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall dependencies
rm -rf node_modules
pnpm install
```

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Fastify Documentation](https://www.fastify.io/)
- [Jest Documentation](https://jestjs.io/)
- [Pino Logger Documentation](https://getpino.io/)
- [AssemblyAI API Documentation](https://www.assemblyai.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## Monorepo Context

This project is part of the `ivan-k-automation-tools` monorepo:

- **Package Manager:** pnpm (workspace-aware)
- **Node Version:** 22
- **Project Prefix:** `micro-*` for microservices
- **Test Structure:** `test/unit/` and `test/e2e/` with setup files in `test/setup/`

### Working in Monorepo

```bash
# Install dependencies for entire monorepo (from root)
cd /mnt/disk2/workspace/ivan-k-automation-tools
pnpm install

# Run commands for specific project
cd micro-stt
pnpm start:dev
```

---

**Happy coding!** If you have questions or need help, refer to the documentation or reach out to the team.
