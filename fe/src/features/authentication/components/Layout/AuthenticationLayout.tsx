import { Outlet } from "react-router-dom";

export function AuthenticationLayout() {
  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr_auto] bg-slate-50 text-slate-900 [&_a]:font-semibold [&_a]:text-[var(--primary-color)] [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold">
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[90rem] items-center px-4 py-4">
          <a
            href="/"
            className="flex w-max transition-opacity hover:opacity-85"
          >
            <img src="/logo.svg" alt="HustLink" className="w-44 md:w-48" />
          </a>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[90rem] items-center px-4 py-10 md:py-14">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>

      <footer className="border-t border-slate-200/80 bg-white text-xs text-slate-500">
        <ul className="mx-auto flex w-full max-w-[90rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <li className="mr-2 flex items-center gap-2 text-slate-600">
            <img src="/logo_dark.svg" alt="HustLink" className="h-auto w-28" />
            <span>© 2026</span>
          </li>
          <li>
            <a
              className="font-medium text-slate-500 hover:text-slate-700"
              href="#"
            >
              Accessibility
            </a>
          </li>
          <li>
            <a
              className="font-medium text-slate-500 hover:text-slate-700"
              href="#"
            >
              User Agreement
            </a>
          </li>
          <li>
            <a
              className="font-medium text-slate-500 hover:text-slate-700"
              href="#"
            >
              Privacy Policy
            </a>
          </li>
          <li>
            <a
              className="font-medium text-slate-500 hover:text-slate-700"
              href="#"
            >
              Cookie Policy
            </a>
          </li>
          <li>
            <a
              className="font-medium text-slate-500 hover:text-slate-700"
              href="#"
            >
              Copyright Policy
            </a>
          </li>
          <li>
            <a
              className="font-medium text-slate-500 hover:text-slate-700"
              href="#"
            >
              Brand Policy
            </a>
          </li>
          <li>
            <a
              className="font-medium text-slate-500 hover:text-slate-700"
              href="#"
            >
              Guest Controls
            </a>
          </li>
          <li>
            <a
              className="font-medium text-slate-500 hover:text-slate-700"
              href="#"
            >
              Community Guidelines
            </a>
          </li>
          <li>
            <a
              className="font-medium text-slate-500 hover:text-slate-700"
              href="#"
            >
              Language
            </a>
          </li>
        </ul>
      </footer>
    </div>
  );
}
