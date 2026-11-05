import React from 'react';
import { navigate, useRoute, type Route } from './ui/router';
import { HomePage } from './ui/pages/HomePage';
import { StudioPage } from './ui/pages/StudioPage';
import { LibraryPage } from './ui/pages/LibraryPage';
import { ReviewPage } from './ui/pages/ReviewPage';
import { useStudio } from './core/store';

const NAV: Array<{ to: Route; label: string }> = [
  { to: '/', label: 'Início' },
  { to: '/studio', label: 'Estúdio' },
  { to: '/biblioteca', label: 'Biblioteca' },
];

const Logo: React.FC = () => (
  <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-display text-[15px] font-bold text-white">E</span>
    <span className="hidden font-display text-[17px] font-bold tracking-tight text-fg sm:inline">
      Essence <span className="font-medium text-muted">Studio</span>
    </span>
  </button>
);

const ReviewOnly: React.FC = () => (
  <div className="min-h-full">
    <header className="border-b border-line bg-bg">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center px-4 md:px-8">
        <Logo />
      </div>
    </header>
    <main>
      <ReviewPage />
    </main>
  </div>
);

export default function App() {
  const route = useRoute();
  // Inside a private Claude artifact the app is only the review window.
  if (import.meta.env.VITE_ARTIFACT === '1') return <ReviewOnly />;
  const setStep = useStudio((s) => s.setStep);
  const hasVideo = useStudio((s) => !!s.project.video);

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 md:px-8">
          <Logo />
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <button
                key={n.to}
                onClick={() => navigate(n.to)}
                className={`shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold transition ${route === n.to ? 'bg-brand-soft text-brand' : 'text-fg-2 hover:bg-subtle'}`}
              >
                {n.label}
              </button>
            ))}
          </nav>
          <button
            onClick={() => {
              if (!hasVideo) setStep('upload');
              navigate('/studio');
            }}
            className="hidden h-9 shrink-0 items-center rounded-xl bg-brand px-4 text-[13px] font-semibold text-white transition hover:bg-brand-600 md:inline-flex"
          >
            {hasVideo ? 'Continuar edição' : 'Começar agora'}
          </button>
        </div>
      </header>
      <main>{route === '/revisao' ? <ReviewPage /> : route === '/studio' ? <StudioPage /> : route === '/biblioteca' ? <LibraryPage /> : <HomePage />}</main>
    </div>
  );
}
