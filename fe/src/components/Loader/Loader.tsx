export function Loader() {
  return (
    <div className="flex flex-col items-center">
      {" "}
      {/* display: flex, flex-direction: column, align-items: center */}
      <img
        src="/logo.svg"
        alt="Loading..."
        className="w-40 mx-auto h-auto mt-48" /* width: 10rem, margin: 0 auto, height: auto, margin-top: 12rem */
      />
      <div className="h-0.5 w-32 rounded-full mt-4 bg-white relative overflow-hidden">
        <div
          className="h-0.5 w-16 bg-[var(--primary-color)] rounded-full absolute"
          style={{
            animation: "slide 1s infinite alternate",
          }}
        ></div>
      </div>
      <style>{`
        @keyframes slide {
          0% { transform: translateX(0); }
          100% { transform: translateX(4rem); }
        }
      `}</style>
    </div>
  );
}
