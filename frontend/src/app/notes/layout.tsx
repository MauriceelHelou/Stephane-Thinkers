import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Research Notes - Intellectual Genealogy Mapper',
  description: 'PhD research note-taking with rich text editing and folder organization',
}

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col h-screen bg-background overflow-hidden">{children}</div>
}
