import Link from 'next/link';
import Image from 'next/image';

/**
 * Auth route group layout — 50/50 split on tablet and desktop.
 * Mobile (< 768px): image banner on top, form card below.
 * Tablet (md+): image on the left half, form card on the right half.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-canvas text-ink md:flex-row">
      {/* Left half — splash image */}
      <div className="relative h-64 w-full overflow-hidden bg-surface-dark md:h-auto md:w-1/2 lg:w-1/2">
        <Image
          src="/images/books.jpg"
          alt="Student graduating atop a wall of books"
          fill
          priority
          className="object-cover"
          sizes="(max-width: 767px) 100vw, 50vw"
        />
      </div>

      {/* Right half — form */}
      <div className="flex w-full flex-col md:w-1/2 lg:w-1/2">
        <header className="flex h-16 items-center px-base md:px-lg">
          <Link
            href="/"
            className="flex items-center gap-sm text-ink"
            aria-label="Resultiq home"
          >
            <Image
              src="/images/logo.png"
              alt="Resultiq logo"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
            />
            <span className="font-display text-title-sm text-ink">Resultiq</span>
          </Link>
        </header>
        <div className="flex flex-1 items-center justify-center px-base py-lg md:px-lg">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </main>
  );
}
