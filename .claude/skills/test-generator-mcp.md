# Test Generator MCP Skill

## Description
Advanced test generation skill that leverages MCP (Model Context Protocol) to automatically generate comprehensive Playwright E2E tests based on application state and user interactions.

## Usage
```text
"Generate tests for the thinker creation flow"
"Create visual regression tests for the AI panel"
"Build journey tests for the quiz feature"
```

## Capabilities

### 1. Automatic Test Discovery
- Analyzes existing page objects and helpers
- Identifies untested features and edge cases
- Suggests test coverage improvements

### 2. Test Generation Patterns

#### Journey Tests
```typescript
// Generated pattern for feature journeys
test.describe('Feature Journey: {FeatureName}', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({ timelines: 1, thinkers: 5, connections: 3 })
  })

  test('{test_description}', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()
    // Generated test steps
  })
})
```

#### Visual Regression Tests
```typescript
// Generated pattern for visual tests
test.describe('Visual Regression: {ComponentName}', () => {
  test('{state_description}', async ({ page }) => {
    // Setup state
    await expect(page).toHaveScreenshot('{screenshot_name}.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
```

### 3. Test Data Generation
- Creates appropriate seed data based on test requirements
- Generates edge case data (empty, max length, special characters)
- Builds relationship graphs for connection testing

## Configuration

### Test Categories
```yaml
categories:
  - name: journey
    pattern: "tests/journeys/**/*.spec.ts"
    description: "User flow and feature journey tests"

  - name: visual
    pattern: "tests/visual/**/*.spec.ts"
    description: "Visual regression and screenshot tests"

  - name: api
    pattern: "tests/api/**/*.spec.ts"
    description: "API integration tests"

  - name: performance
    pattern: "tests/performance/**/*.spec.ts"
    description: "Performance and load tests"
```

### Generation Rules
```yaml
rules:
  # Always include these in generated tests
  required:
    - database_reset
    - page_object_usage
    - proper_waits
    - assertions

  # Test naming conventions
  naming:
    journey: "{action}-{entity}-{context}"
    visual: "{component}-{state}"
    api: "{method}-{endpoint}-{scenario}"

  # Coverage targets
  coverage:
    statements: 80
    branches: 75
    functions: 80
    lines: 80
```

## Templates

### Journey Test Template
```typescript
import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Feature Journey: {{FEATURE_NAME}}', () => {
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: {{TIMELINES_COUNT}},
      thinkers: {{THINKERS_COUNT}},
      connections: {{CONNECTIONS_COUNT}},
    })
  })

  {{#each TESTS}}
  test('{{description}}', async ({ page }) => {
    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    {{#each steps}}
    // {{comment}}
    {{code}}
    {{/each}}

    {{#each assertions}}
    await expect({{target}}).{{matcher}}({{expected}})
    {{/each}}
  })
  {{/each}}
})
```

### Visual Test Template
```typescript
import { test, expect } from '@playwright/test'
import { createMainPage } from '../page-objects/main-page.po'
import { createAPIHelpers } from '../helpers/api-helpers'
import { TIMEOUTS } from '../config/test-constants'

test.describe('Visual Regression: {{COMPONENT_NAME}}', () => {
  {{#if NEEDS_SEED}}
  test.beforeEach(async ({ page, request }) => {
    const api = createAPIHelpers(request)
    await api.resetDatabase()
    await api.seedDatabase({
      timelines: {{TIMELINES_COUNT}},
      thinkers: {{THINKERS_COUNT}},
      connections: {{CONNECTIONS_COUNT}},
    })
  })
  {{/if}}

  {{#each STATES}}
  test('{{name}}', async ({ page{{#if needsRequest}}, request{{/if}} }) => {
    {{#if setup}}
    {{setup}}
    {{/if}}

    const mainPage = createMainPage(page)
    await mainPage.goto()
    await mainPage.waitForPageLoad()

    {{#if actions}}
    {{#each actions}}
    {{this}}
    {{/each}}
    {{/if}}

    await expect({{target}}).toHaveScreenshot('{{screenshot}}.png', {
      maxDiffPixelRatio: {{diffRatio}},
    })
  })
  {{/each}}
})
```

## MCP Integration

### Available Tools
- `generate_test`: Create a new test file from template
- `analyze_coverage`: Identify untested code paths
- `suggest_tests`: Recommend tests based on code changes
- `validate_tests`: Check test quality and patterns

### Example MCP Call
```json
{
  "tool": "generate_test",
  "params": {
    "category": "journey",
    "feature": "quiz",
    "scenarios": [
      "complete quiz successfully",
      "answer incorrectly",
      "timeout handling"
    ]
  }
}
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Reset database in beforeEach
- Avoid test interdependencies

### 2. Reliable Selectors
- Prefer data-testid attributes
- Use role-based selectors for accessibility
- Avoid fragile CSS selectors

### 3. Proper Waits
- Use waitForPageLoad() for initial load
- Use TIMEOUTS.animation after UI changes
- Avoid arbitrary setTimeout calls

### 4. Meaningful Assertions
- Assert on user-visible outcomes
- Check both positive and negative cases
- Verify data persistence where appropriate

### 5. Visual Testing
- Use consistent viewport sizes
- Allow reasonable diff tolerance (0.02)
- Group related screenshots in same file

## Workflow Integration

### Pre-commit Hook
```bash
#!/bin/bash
# .husky/pre-commit

# Run affected tests based on changed files
npx playwright test --grep "$(git diff --name-only HEAD | xargs -I {} echo {} | sed 's/\.ts$//')"
```

### CI Integration
Tests generated by this skill are automatically included in the CI pipeline via GitHub Actions workflow.

### Coverage Reporting
Generated tests contribute to overall coverage metrics tracked in the test dashboard.
