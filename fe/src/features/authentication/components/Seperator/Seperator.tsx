import { ReactNode } from "react";

export function Seperator({ children }: { children?: ReactNode }) {
    return (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 my-4 before:content-[''] before:block before:h-px before:bg-black/15 before:my-4 after:content-[''] after:block after:h-px after:bg-black/15 after:my-4"> {/* .separator with pseudo-elements */}
            {children}
        </div>
    );
}