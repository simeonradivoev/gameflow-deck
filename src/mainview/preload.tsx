import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const rootElement = document.getElementById("preload")!;

if (!rootElement.innerHTML)
{
    const root = createRoot(rootElement);
    root.render(
        <StrictMode>
            <div className="in-data-[loaded=true]:hidden absolute flex items-center gap-2 justify-center bg-base-300 w-screen h-screen z-100 font-semibold text-2xl text-shadow-lg">
                <span className="loading loading-spinner loading-xl"></span>
                <div className="absolute w-screen h-screen bg-radial from-base-100 to-base-300 -z-2"></div>
                <div className="bg-noise"></div>
                <div className="bg-dots"></div>
                Loading Gameflow
            </div>
        </StrictMode>,
    );
}
