import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter'
import * as fs from 'fs'
import * as path from 'path'

interface TestMetrics {
  totalTests: number
  passed: number
  failed: number
  skipped: number
  flaky: number
  duration: number
  slowestTests: Array<{
    title: string
    duration: number
    file: string
  }>
  failedTests: Array<{
    title: string
    error: string
    file: string
  }>
  categories: Record<string, CategoryMetrics>
}

interface CategoryMetrics {
  total: number
  passed: number
  failed: number
  duration: number
}

/**
 * Custom Playwright reporter for detailed test metrics and analysis
 */
class CustomReporter implements Reporter {
  private metrics: TestMetrics = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    flaky: 0,
    duration: 0,
    slowestTests: [],
    failedTests: [],
    categories: {},
  }

  private startTime: number = 0
  private outputDir: string = './test-metrics'

  onBegin(config: FullConfig, suite: Suite): void {
    this.startTime = Date.now()
    this.outputDir = path.join(config.rootDir, '..', 'test-metrics')

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }

    console.log('\n📊 Custom Reporter initialized')
    console.log(`   Output directory: ${this.outputDir}`)
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.metrics.totalTests++
    const duration = result.duration

    // Track test result
    if (result.status === 'passed') {
      this.metrics.passed++
    } else if (result.status === 'failed') {
      this.metrics.failed++
      this.metrics.failedTests.push({
        title: test.title,
        error: result.error?.message || 'Unknown error',
        file: test.location.file,
      })
    } else if (result.status === 'skipped') {
      this.metrics.skipped++
    }

    // Track flaky tests
    if (result.status === 'passed' && result.retry > 0) {
      this.metrics.flaky++
    }

    // Track category metrics
    const category = this.getCategory(test.location.file)
    if (!this.metrics.categories[category]) {
      this.metrics.categories[category] = {
        total: 0,
        passed: 0,
        failed: 0,
        duration: 0,
      }
    }
    this.metrics.categories[category].total++
    this.metrics.categories[category].duration += duration
    if (result.status === 'passed') {
      this.metrics.categories[category].passed++
    } else if (result.status === 'failed') {
      this.metrics.categories[category].failed++
    }

    // Track slowest tests
    this.metrics.slowestTests.push({
      title: test.title,
      duration,
      file: test.location.file,
    })
  }

  onEnd(result: FullResult): void {
    this.metrics.duration = Date.now() - this.startTime

    // Sort and limit slowest tests
    this.metrics.slowestTests.sort((a, b) => b.duration - a.duration)
    this.metrics.slowestTests = this.metrics.slowestTests.slice(0, 10)

    // Generate reports
    this.generateMetricsReport()
    this.generateMarkdownSummary()
    this.generateCategoryReport()

    // Print summary to console
    this.printSummary()
  }

  private getCategory(filePath: string): string {
    if (filePath.includes('/visual/')) return 'visual'
    if (filePath.includes('/journeys/network/')) return 'network'
    if (filePath.includes('/journeys/canvas/')) return 'canvas'
    if (filePath.includes('/journeys/ai/')) return 'ai'
    if (filePath.includes('/journeys/quiz/')) return 'quiz'
    if (filePath.includes('/journeys/keyboard/')) return 'keyboard'
    if (filePath.includes('/journeys/modals/')) return 'modals'
    if (filePath.includes('/journeys/validation/')) return 'validation'
    return 'other'
  }

  private generateMetricsReport(): void {
    const reportPath = path.join(this.outputDir, 'metrics.json')
    fs.writeFileSync(reportPath, JSON.stringify(this.metrics, null, 2))
    console.log(`   ✓ Metrics JSON: ${reportPath}`)
  }

  private generateMarkdownSummary(): void {
    const passRate = ((this.metrics.passed / this.metrics.totalTests) * 100).toFixed(1)
    const durationMinutes = (this.metrics.duration / 60000).toFixed(2)

    const markdown = `# E2E Test Report

## Summary

| Metric | Value |
|--------|-------|
| **Total Tests** | ${this.metrics.totalTests} |
| **Passed** | ${this.metrics.passed} |
| **Failed** | ${this.metrics.failed} |
| **Skipped** | ${this.metrics.skipped} |
| **Flaky** | ${this.metrics.flaky} |
| **Pass Rate** | ${passRate}% |
| **Duration** | ${durationMinutes} min |

## Category Breakdown

| Category | Total | Passed | Failed | Duration |
|----------|-------|--------|--------|----------|
${Object.entries(this.metrics.categories)
  .map(([cat, data]) => {
    const catDuration = (data.duration / 1000).toFixed(1)
    return `| ${cat} | ${data.total} | ${data.passed} | ${data.failed} | ${catDuration}s |`
  })
  .join('\n')}

## Slowest Tests

| Test | Duration | File |
|------|----------|------|
${this.metrics.slowestTests
  .map(t => `| ${t.title} | ${(t.duration / 1000).toFixed(2)}s | ${path.basename(t.file)} |`)
  .join('\n')}

${
  this.metrics.failedTests.length > 0
    ? `## Failed Tests

| Test | Error | File |
|------|-------|------|
${this.metrics.failedTests.map(t => `| ${t.title} | ${t.error.substring(0, 50)}... | ${path.basename(t.file)} |`).join('\n')}`
    : ''
}

---
Generated: ${new Date().toISOString()}
`

    const reportPath = path.join(this.outputDir, 'REPORT.md')
    fs.writeFileSync(reportPath, markdown)
    console.log(`   ✓ Markdown report: ${reportPath}`)
  }

  private generateCategoryReport(): void {
    const report = {
      generatedAt: new Date().toISOString(),
      categories: this.metrics.categories,
      recommendations: this.generateRecommendations(),
    }

    const reportPath = path.join(this.outputDir, 'category-report.json')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`   ✓ Category report: ${reportPath}`)
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    // Check for high failure rates in categories
    Object.entries(this.metrics.categories).forEach(([category, data]) => {
      const failRate = (data.failed / data.total) * 100
      if (failRate > 20) {
        recommendations.push(`High failure rate (${failRate.toFixed(0)}%) in ${category} tests - investigate stability`)
      }
    })

    // Check for slow tests
    const slowThreshold = 30000 // 30 seconds
    const slowCount = this.metrics.slowestTests.filter(t => t.duration > slowThreshold).length
    if (slowCount > 3) {
      recommendations.push(`${slowCount} tests exceed ${slowThreshold / 1000}s - consider optimization`)
    }

    // Check for flaky tests
    const flakyRate = (this.metrics.flaky / this.metrics.totalTests) * 100
    if (flakyRate > 5) {
      recommendations.push(`High flaky test rate (${flakyRate.toFixed(1)}%) - investigate test isolation`)
    }

    if (recommendations.length === 0) {
      recommendations.push('Test suite is healthy!')
    }

    return recommendations
  }

  private printSummary(): void {
    const passRate = ((this.metrics.passed / this.metrics.totalTests) * 100).toFixed(1)
    const durationMinutes = (this.metrics.duration / 60000).toFixed(2)

    console.log('\n' + '═'.repeat(50))
    console.log('📊 TEST SUMMARY')
    console.log('═'.repeat(50))
    console.log(`   Total:    ${this.metrics.totalTests}`)
    console.log(`   Passed:   ${this.metrics.passed} ✅`)
    console.log(`   Failed:   ${this.metrics.failed} ❌`)
    console.log(`   Skipped:  ${this.metrics.skipped} ⏭️`)
    console.log(`   Flaky:    ${this.metrics.flaky} 🔄`)
    console.log(`   Pass Rate: ${passRate}%`)
    console.log(`   Duration: ${durationMinutes} min`)
    console.log('═'.repeat(50) + '\n')
  }
}

export default CustomReporter
