import React from 'react';

export function Footer() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            © {new Date().getFullYear()} RideMatch. All rights reserved.
          </p>
        </div>
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <a 
            href="https://github.com/Valley-Tech-Center/ridematch.app/issues" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-center text-sm leading-loose text-muted-foreground hover:text-foreground md:text-left"
          >
            Feedback
          </a>
        </div>
      </div>
    </footer>
  );
}
