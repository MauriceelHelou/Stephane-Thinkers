'use client'

import { Modal } from '@/components/Modal'

interface HelpGuideProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpGuide({ isOpen, onClose }: HelpGuideProps) {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const modKey = isMac ? '⌘' : 'Ctrl+'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Help & Keyboard Shortcuts" maxWidth="lg">
      <div className="p-6 space-y-5 text-sm font-sans max-h-[70vh] overflow-y-auto">

        <section>
          <h3 className="font-semibold text-primary mb-2">Navigation & Zoom</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">Scroll</span> — Zoom in/out on timeline</li>
            <li><span className="font-mono bg-gray-100 px-1">{modKey}Scroll</span> — Pan left/right on timeline</li>
            <li><span className="font-mono bg-gray-100 px-1">Pinch</span> — Zoom in/out (trackpad)</li>
            <li><span className="font-mono bg-gray-100 px-1">Click + Drag</span> — Pan the timeline</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Keyboard Shortcuts</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
            <div><span className="font-mono bg-gray-100 px-1">{modKey}T</span> — Add Thinker</div>
            <div><span className="font-mono bg-gray-100 px-1">{modKey}K</span> — Add Connection</div>
            <div><span className="font-mono bg-gray-100 px-1">{modKey}E</span> — Add Event</div>
            <div><span className="font-mono bg-gray-100 px-1">{modKey}N</span> — New Timeline</div>
            <div><span className="font-mono bg-gray-100 px-1">?</span> — Open this help</div>
            <div><span className="font-mono bg-gray-100 px-1">Esc</span> — Close panel/cancel</div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Adding Thinkers</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">{modKey}Click</span> on timeline — Add thinker at that year</li>
            <li><span className="font-mono bg-gray-100 px-1">{modKey}T</span> — Open Add Thinker modal</li>
            <li>Birth/death years position the thinker on the timeline</li>
            <li>Drag thinkers to reposition them vertically</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Creating Connections</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">Shift+Click</span> first thinker → <span className="font-mono bg-gray-100 px-1">Shift+Click</span> second — Quick connect</li>
            <li><span className="font-mono bg-gray-100 px-1">{modKey}K</span> — Open Connection modal with dropdowns</li>
            <li>Click on a connection line to edit or delete it</li>
            <li>Connections show influence direction with arrows</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Detail Panel</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">Click</span> on thinker — Open detail panel</li>
            <li>Add/edit publications, quotes, and tags from the panel</li>
            <li>View all connections for the selected thinker</li>
            <li><span className="font-mono bg-gray-100 px-1">Esc</span> or click outside — Close panel</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Timelines</h3>
          <ul className="space-y-1 text-gray-700">
            <li>Click tabs at top to switch between timelines</li>
            <li><strong>"All Thinkers"</strong> — Shows everyone across all timelines</li>
            <li><strong>"Combined View"</strong> — Overlay multiple timelines</li>
            <li>Use negative years for BCE (e.g., -500 = 500 BCE)</li>
            <li>Edit timeline settings via the gear icon</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Connection Types</h3>
          <div className="grid grid-cols-2 gap-2 text-gray-700">
            <div className="flex items-center gap-2">
              <span className="w-8 h-0.5 bg-blue-500"></span>
              <span><strong>Influenced</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-0.5 bg-red-500"></span>
              <span><strong>Critiqued</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-0.5 bg-green-500"></span>
              <span><strong>Built Upon</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-0.5 bg-purple-500"></span>
              <span><strong>Synthesized</strong></span>
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Event Symbols</h3>
          <div className="grid grid-cols-3 gap-2 text-gray-700">
            <div>△ Council</div>
            <div>▢ Publication</div>
            <div>◇ War/Conflict</div>
            <div>★ Invention</div>
            <div>● Cultural</div>
            <div>⬟ Political</div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">AI Features</h3>
          <ul className="space-y-1 text-gray-700">
            <li>AI Suggestions panel — Get connection recommendations</li>
            <li>AI Chat — Ask questions about your research</li>
            <li>Quiz — Test your knowledge of the timeline</li>
            <li><em className="text-gray-500">Requires API keys configured in backend</em></li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Tips</h3>
          <ul className="space-y-1 text-gray-700">
            <li>Zoom in deeply to see quarter-year granularity</li>
            <li>Use tags to categorize thinkers by school/period</li>
            <li>Add anchor years to thinkers for precise positioning</li>
            <li>Export your timeline data via the Export button</li>
          </ul>
        </section>

        <div className="pt-3 border-t border-timeline text-xs text-gray-500 text-center">
          Press <span className="font-mono bg-gray-100 px-1">?</span> anytime to open this help
        </div>
      </div>
    </Modal>
  )
}
