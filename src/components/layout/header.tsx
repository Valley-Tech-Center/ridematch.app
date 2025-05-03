import Link from 'next/link';
import { Car } from 'lucide-react'; // Using Car icon as a simple logo
import { AuthButton } from '@/components/auth/auth-button';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <Car className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">RideSync</span>
        </Link>
        <nav className="flex items-center space-x-4">
           <Link href="/conferences" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Conferences
          </Link>
          {/* Add other nav links here if needed */}
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
