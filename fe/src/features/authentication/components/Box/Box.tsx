export function Box({ children }: {children: React.ReactNode}) {
    return(
        <div className="md:p-6 md:w-[30rem] md:mx-auto md:bg-white md:border md:border-gray-300 md:rounded-lg md:shadow-lg"> {/* responsive .root styles */}
            {children}
        </div>
    );
}