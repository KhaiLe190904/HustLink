import { Outlet } from 'react-router-dom';

export function AuthenticationLayout() {
    return(
        <div className="grid grid-rows-[auto_1fr_auto] min-h-screen [&_a]:text-[var(--primary-color)] [&_a]:font-bold [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4"> {/* .root styles with nested selectors */}
            <header className="max-w-[90rem] w-full mx-auto p-2 py-4 w-max-content mx-auto"> {/* header .container styles */}
                <a href="/" className="flex w-max"> {/* header a styles */}
                    <img src="/logo.svg" alt="Logo" className="w-48"/> {/* .logo styles */}
                </a>
            </header>
            <main className="grid items-center max-w-[90rem] w-full mx-auto p-2"> {/* main + .container styles */}
                <Outlet />
            </main>
            <footer className="text-xs bg-white border border-gray-300 [&_a]:text-black/60 [&_a]:font-normal [&_img]:w-36 [&_img]:h-auto"> {/* footer styles with nested selectors */}
                <ul className="max-w-[90rem] w-full mx-auto p-2 flex items-center gap-4 mt-8 flex-wrap p-0 [&_li]:flex [&_li]:gap-2 [&_li]:items-center"> {/* footer ul + li styles */}
                    <li>
                        <img src="/logo_dark.svg" alt="Logo"/>
                        <span>© 2025</span>
                    </li>
                    <li>
                        <a href="">Accessiblity</a>
                    </li>
                    <li>
                        <a href="">User Agreement</a>
                    </li>
                    <li>
                        <a href="">Privacy Policy</a>
                    </li>
                    <li>
                        <a href="">Cookie Policy</a>
                    </li>
                    <li>
                        <a href="">Copywright Policy</a>
                    </li>
                    <li>
                        <a href="">Brand Policy</a>
                    </li>
                    <li>
                        <a href="">Guest Controls</a>
                    </li>
                    <li>
                        <a href="">Community Guidelines</a>
                    </li>
                    <li>
                        <a href="">Language</a>
                    </li>
                </ul>
            </footer>
        </div>
    );
}