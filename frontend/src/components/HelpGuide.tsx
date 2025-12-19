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
    <Modal isOpen={isOpen} onClose={onClose} title="How to Use" maxWidth="lg">
      <div className="p-6 space-y-5 text-sm font-sans">
        <section>
          <h3 className="font-semibold text-primary mb-2">Navigation</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">Scroll/Pinch</span> — Zoom in/out on timeline</li>
            <li><span className="font-mono bg-gray-100 px-1">Click + Drag</span> — Pan the timeline</li>
            <li><span className="font-mono bg-gray-100 px-1">Esc</span> — Close panel or cancel action</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Adding Items</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">{modKey}Click</span> on timeline — Add thinker at position</li>
            <li><span className="font-mono bg-gray-100 px-1">{modKey}T</span> — Open Add Thinker modal</li>
            <li><span className="font-mono bg-gray-100 px-1">{modKey}E</span> — Add Event to timeline</li>
            <li><span className="font-mono bg-gray-100 px-1">{modKey}N</span> — Create New Timeline</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Creating Connections</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">Shift+Click</span> first thinker, then <span className="font-mono bg-gray-100 px-1">Shift+Click</span> second — Quick connect</li>
            <li><span className="font-mono bg-gray-100 px-1">{modKey}K</span> — Open Connection modal with dropdowns</li>
            <li>Click on a connection line to edit/delete it</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Viewing Details</h3>
          <ul className="space-y-1 text-gray-700">
            <li><span className="font-mono bg-gray-100 px-1">Click</span> on thinker — Open detail panel</li>
            <li><span className="font-mono bg-gray-100 px-1">Click outside</span> panel — Close it</li>
            <li>From detail panel: add publications, quotes, and tags</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Timelines</h3>
          <ul className="space-y-1 text-gray-700">
            <li>Click tabs to switch between timelines</li>
            <li>"All Thinkers" shows everyone across all timelines</li>
            <li>"Combined View" overlays multiple timelines with shared date axis</li>
            <li>Use negative years for BCE (e.g., -500 = 500 BCE)</li>
          </ul>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Connection Types</h3>
          <div className="grid grid-cols-2 gap-2 text-gray-700">
            <div>• <strong>Influenced</strong> — intellectual influence</div>
            <div>• <strong>Critiqued</strong> — critical response</div>
            <div>• <strong>Built Upon</strong> — extended work</div>
            <div>• <strong>Synthesized</strong> — combined ideas</div>
          </div>
        </section>

        <section>
          <h3 className="font-semibold text-primary mb-2">Event Symbols</h3>
          <div className="grid grid-cols-2 gap-2 text-gray-700">
            <div>△ Council</div>
            <div>▢ Publication</div>
            <div>◇ War</div>
            <div>★ Invention</div>
            <div>● Cultural/Political</div>
          </div>
        </section>

        <div className="pt-3 border-t border-timeline text-xs text-gray-500">
          Tip: Zoom in deeply to see quarter-year granularity on the timeline.
        </div>
      </div>
    </Modal>
  )
}
