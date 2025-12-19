import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-serif text-[#8B4513] mb-4">404</h1>
        <h2 className="text-2xl font-serif text-[#1A1A1A] mb-4">Page Not Found</h2>
        <p className="text-gray-600 mb-8">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-[#8B4513] text-white rounded-lg hover:bg-[#6B3410] transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}
