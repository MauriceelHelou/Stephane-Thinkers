# Claude Code Skills for Stephane-Thinkers

This directory contains specialized skills that enhance Claude Code's effectiveness when working on this project. Each skill provides context-specific expertise and follows project conventions.

## Available Skills

### Testing Skills

#### 1. **unit-test.md** - Backend Unit Test Generator
Generate pytest-based unit tests for FastAPI endpoints and business logic.

**When to use:**
- Creating tests for new API endpoints
- Testing CRUD operations
- Validating error handling and edge cases

**Example usage:**
```
"Generate unit tests for the thinkers API endpoint"
"Create pytest fixtures for database testing"
"Add tests for the connection validation logic"
```

#### 2. **integration-test.md** - Backend Integration Test Generator
Create integration tests for multi-step workflows and component interactions.

**When to use:**
- Testing complete user workflows
- Verifying relationship cascades
- Testing data consistency across resources

**Example usage:**
```
"Create integration tests for the full thinker creation workflow"
"Test cascade deletes for thinker with publications"
"Generate tests for timeline management workflow"
```

#### 3. **e2e-test.md** - E2E Test Generator with Playwright
Build end-to-end tests for frontend user interactions.

**When to use:**
- Testing UI workflows
- Verifying canvas interactions
- Testing forms and modals

**Example usage:**
```
"Create E2E tests for creating a thinker through the UI"
"Add Playwright tests for canvas pan and zoom"
"Test the connection creation modal workflow"
```

#### 4. **test-runner.md** - Test Runner Agent
Execute tests, analyze failures, and provide detailed reports.

**When to use:**
- Running test suites after code changes
- Debugging test failures
- Generating coverage reports

**Example usage:**
```
"Run all backend tests and show me the results"
"Execute E2E tests for the thinker management feature"
"Generate a coverage report for the API routes"
```

### Development Skills

#### 5. **api-generator.md** - API Endpoint Generator
Generate complete, production-ready API endpoints following project conventions.

**When to use:**
- Adding new resource endpoints
- Creating CRUD operations
- Scaffolding full-stack features

**Example usage:**
```
"Generate a complete API endpoint for tags"
"Create backend and frontend code for a notes resource"
"Scaffold a new research papers resource with relationships"
```

#### 6. **migration-helper.md** - Database Migration Helper
Safely manage database schema changes with Alembic migrations.

**When to use:**
- Adding new models or columns
- Modifying existing schema
- Handling data migrations

**Example usage:**
```
"Generate a migration for adding the institution field to thinkers"
"Create a data migration to convert birth years to strings"
"Help me rollback the last migration safely"
```

#### 7. **code-review.md** - Code Review Agent
Provide comprehensive code reviews focusing on quality, security, and best practices.

**When to use:**
- Before committing significant changes
- Reviewing pull requests
- Ensuring code quality standards

**Example usage:**
```
"Review the code I just wrote for the connections feature"
"Check this API endpoint for security issues"
"Review my React component for best practices"
```

## How to Use Skills

### Method 1: Explicit Invocation
Mention the skill name in your request:

```
"Use the unit-test skill to create tests for the publications API"
```

### Method 2: Contextual Triggering
Claude Code will automatically use relevant skills when appropriate:

```
"I need tests for the new timeline feature"
→ Claude recognizes this needs testing skills
```

### Method 3: Skill Chaining
Combine multiple skills for complex workflows:

```
"Generate a new comments API endpoint, create tests for it, and run them"
→ Uses: api-generator → unit-test → test-runner
```

## Skill Workflow Patterns

### Pattern 1: TDD (Test-Driven Development)
```
1. Use api-generator to scaffold endpoint structure
2. Use unit-test to create test cases
3. Implement the actual functionality
4. Use test-runner to verify tests pass
5. Use code-review to ensure quality
```

### Pattern 2: Feature Development
```
1. Use api-generator for backend + frontend code
2. Use migration-helper for database changes
3. Use e2e-test for user workflow tests
4. Use test-runner to verify everything works
5. Use code-review before committing
```

### Pattern 3: Bug Fix Workflow
```
1. Use test-runner to reproduce the bug with tests
2. Fix the code
3. Use unit-test to add regression tests
4. Use test-runner to verify fix
5. Use code-review to ensure no side effects
```

### Pattern 4: Refactoring
```
1. Use test-runner to establish baseline (all tests pass)
2. Refactor code
3. Use test-runner to ensure no regressions
4. Use code-review to verify improvements
5. Use migration-helper if schema changes needed
```

## Skill Configuration

All skills are configured to follow project conventions defined in `/CLAUDE.md`:

- **Backend**: FastAPI + SQLAlchemy + Pydantic
- **Frontend**: Next.js 14 + React 18 + TypeScript
- **Database**: UUID primary keys, timestamps
- **API Pattern**: RESTful with standard CRUD
- **Testing**: pytest (backend), Playwright (frontend)

## Custom Skills

You can create additional skills for project-specific needs:

### Creating a New Skill

1. Create a markdown file in `.claude/skills/`
2. Define the skill's purpose and context
3. Provide examples and patterns
4. Include usage instructions

**Template:**
```markdown
# Skill Name

You are a [role] specialist for [context]. Your role is to [primary responsibility].

## Project Context
- Key information about the project

## Your Responsibilities
1. Primary task
2. Secondary task

## Patterns and Examples
[Provide code examples and best practices]

## Workflow
[Step-by-step process]

## Quality Standards
[Checklist of requirements]
```

## Skill Maintenance

Skills should be updated when:
- Project conventions change
- New patterns emerge
- Dependencies are upgraded
- Best practices evolve

## Quick Reference

| Need | Use This Skill |
|------|----------------|
| Backend unit tests | `unit-test.md` |
| Multi-step workflow tests | `integration-test.md` |
| UI interaction tests | `e2e-test.md` |
| Run and debug tests | `test-runner.md` |
| New API endpoint | `api-generator.md` |
| Database changes | `migration-helper.md` |
| Code quality check | `code-review.md` |

## Tips for Effective Skill Usage

1. **Be specific**: "Use unit-test to create tests for GET /api/thinkers/{id}"
2. **Provide context**: "The thinkers endpoint returns WithRelations schema"
3. **Chain skills**: "Generate endpoint, then create tests, then run them"
4. **Review output**: Always review generated code before applying
5. **Iterate**: Refine results by providing feedback

## Troubleshooting

**Q: Skill not being used?**
- A: Be explicit: "Use the [skill-name] skill to..."

**Q: Generated code doesn't follow patterns?**
- A: Check that CLAUDE.md is up to date with current conventions

**Q: Need a new skill?**
- A: Create a markdown file in `.claude/skills/` following the template

## Resources

- Project conventions: `/CLAUDE.md`
- Container setup: `/.devcontainer/README.md`
- Claude Code docs: https://code.claude.com/docs

---

**Remember**: Skills are your specialized assistants. Use them to maintain consistency, quality, and productivity throughout the development process.
