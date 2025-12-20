'use client'

import { Modal } from '@/components/Modal'

interface HelpGuideProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpGuide({ isOpen, onClose }: HelpGuideProps) {
  // Always use Ctrl+ for shortcuts (consistent across platforms)
  const modKey = 'Ctrl+'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Help & Keyboard Shortcuts" maxWidth="lg">
      <div className="p-6 space-y-5 text-sm font-sans max-h-[70vh] overflow-y-auto">

        <section>
          <h3 className="font-semibold text-primary mb-2">Quick Reference</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700 text-xs">
            <div><span className="font-mono bg-gray-100 px-1">{modKey}T</span> — Add Thinker</div>
            <div><span className="font-mono bg-gray-100 px-1">{modKey}K</span> — Add Connection</div>
            <div><span className="font-mono bg-gray-100 px-1">{modKey}E</span> — Add Event</div>
            <div><span className="font-mono bg-gray-100 px-1">{modKey}N</span> — New Timeline</div>
            <div><span className="font-mono bg-gray-100 px-1">{modKey}S</span> — Sticky Note Mode</div>
            <div><span className="font-mono bg-gray-100 px-1">{modKey}Click</span> — Quick Add at position</div>
            <div><span className="font-mono bg-gray-100 px-1">Shift+Alt+Click</span> — Quick Connect</div>
            <div><span className="font-mono bg-gray-100 px-1">?</span> — This help</div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Navigation & Zoom</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">Scroll</span> — Zoom in/out on timeline</li>
            <li><span className="font-mono bg-gray-100 px-1">Click + Drag</span> — Pan the timeline</li>
            <li><span className="font-mono bg-gray-100 px-1">Pinch</span> — Zoom (trackpad)</li>
            <li>Use +/- buttons in bottom right to zoom</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Search</h3>
          <ul className="space-y-1 text-gray-700">
            <li>Type in the search box to find thinkers by name</li>
            <li>Click on a search result to open the thinker's detail panel</li>
            <li>Search filters the timeline view in real-time</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Adding Thinkers</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">{modKey}T</span> — Open Add Thinker modal</li>
            <li><span className="font-mono bg-gray-100 px-1">{modKey}Click</span> on timeline — Quick add at that year</li>
            <li>Thinkers are positioned at midpoint of birth/death years</li>
            <li><strong>Drag</strong> thinkers to reposition them on the canvas</li>
            <li>Thinkers are added to the currently selected timeline</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Creating Connections</h3>
          <ul className="space-y-1 text-gray-700">
            <li className="font-medium text-accent">Quick Connect (recommended):</li>
            <li className="ml-4">Hold <span className="font-mono bg-gray-100 px-1">Shift+Alt</span> and click first thinker</li>
            <li className="ml-4">Keep holding and click second thinker</li>
            <li className="ml-4">Connection modal opens with both pre-selected</li>
            <li><span className="font-mono bg-gray-100 px-1">{modKey}K</span> — Open Connection modal with dropdowns</li>
            <li><strong>Click</strong> on a connection line to edit or delete it</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Sticky Notes</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">{modKey}S</span> — Enter sticky note mode (cursor changes)</li>
            <li><strong>Click</strong> anywhere on canvas to place a note</li>
            <li><strong>Click</strong> existing note to edit or delete it</li>
            <li>Notes show title only (compact view) - click to see full content</li>
            <li>4 colors: yellow, pink, blue, green</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Detail Panel</h3>
          <ul className="space-y-1 text-gray-700">
            <li><strong>Click</strong> on a thinker to open their detail panel</li>
            <li>Add/edit publications, quotes, and tags</li>
            <li>View and manage all connections</li>
            <li>Open <strong>Connection Map</strong> to visualize the full network</li>
            <li><span className="font-mono bg-gray-100 px-1">Esc</span> — Close panel</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Connection Map</h3>
          <ul className="space-y-1 text-gray-700">
            <li>Open from a thinker's detail panel</li>
            <li>Shows the <strong>full network</strong> of connected thinkers</li>
            <li>Thinkers arranged in rings by connection distance</li>
            <li>Arrows show influence direction</li>
            <li>Hover over nodes to highlight their connections</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Timelines</h3>
          <ul className="space-y-1 text-gray-700">
            <li>Click tabs at top to switch between timelines</li>
            <li><strong>"All Thinkers"</strong> — Shows everyone across all timelines</li>
            <li><strong>"Combined View"</strong> — Overlay multiple timelines</li>
            <li>Use negative years for BCE (e.g., -500 = 500 BCE)</li>
            <li>Click gear icon to edit timeline settings</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Connection Types</h3>
          <div className="grid grid-cols-2 gap-2 text-gray-700">
            <div className="flex items-center gap-2">
              <span className="w-6 h-0.5 bg-blue-500"></span>
              <span><strong>Influenced</strong> — Shaped ideas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-0.5 bg-red-500"></span>
              <span><strong>Critiqued</strong> — Challenged</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-0.5 bg-green-500"></span>
              <span><strong>Built Upon</strong> — Extended</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-0.5 bg-purple-500"></span>
              <span><strong>Synthesized</strong> — Combined</span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">AI Features</h3>
          <ul className="space-y-1 text-gray-700">
            <li><strong>Natural Language Add</strong> — Type "Add Kant, born 1724, philosopher"</li>
            <li><strong>AI Suggestions</strong> — Get connection recommendations</li>
            <li><strong>AI Chat</strong> — Ask questions about your research</li>
            <li><strong>Quiz</strong> — Test your knowledge of the timeline</li>
            <li className="text-gray-500 text-xs">Use "Refresh Questions" after updates for fresh quizzes</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Event Symbols</h3>
          <div className="grid grid-cols-3 gap-2 text-gray-700 text-xs">
            <div>△ Council</div>
            <div>▢ Publication</div>
            <div>◇ War/Conflict</div>
            <div>★ Invention</div>
            <div>● Cultural</div>
            <div>⬟ Political</div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Tips</h3>
          <ul className="space-y-1 text-gray-700 text-xs">
            <li>Zoom in deeply to see quarter-year granularity</li>
            <li>Use tags to categorize thinkers by school/period</li>
            <li>Filter by field, tags, or year range using the toolbar</li>
            <li>Export your timeline data via the Export button</li>
            <li>Connection legend (bottom left) can filter visible connection types</li>
          </ul>
        </section>

        <div className="pt-3 border-t border-timeline text-xs text-gray-500 text-center">
          Press <span className="font-mono bg-gray-100 px-1">?</span> anytime to open this help
        </div>
      </div>
    </Modal>
  )
}
