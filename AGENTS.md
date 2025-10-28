## Agent Rules (alwaysApply)

- Microservice with REST API
- Stack: TypeScript, NestJS, Docker

### Structure and Practices

- Node.js: version 22
- Package manager: `pnpm`
- Imports: prefer path aliases
- Tests:
  - Unit tests: `test/unit/`
  - E2E tests: `test/e2e/`
  - setup of unit tests: `test/setup/unit.setup.ts`
  - setup of e2e tests: `test/setup/e2e.setup.ts`
- Documentation:
  - Guides: `docs/`
  - Development stage docs: `dev_docs/`
  - Update `docs/CHANGELOG.md` for significant changes
  - Keep `README.md` up to date
- Environment variables: `.env.production.example` is the source of truth for expected variables

### TypeScript Standards

- Prefer interfaces over types for object shapes
- Use object parameters for functions with 3+ arguments
- Use named exports over default exports

### Agent Expectations

- Follow the above standards across all projects in the repository
- Prefer targeted code edits over full rewrites if you not asked to refactor
- When adding or changing functionality:
  - Update tests and documentation in their respective directories also update README.md if necessary
  - Record significant changes in the project's `CHANGELOG.md`
