import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import LoadingScreen from "./components/LoadingScreen";

const rootElement = document.getElementById("preload")!;

if (!rootElement.innerHTML)
{
    const root = createRoot(rootElement);
    root.render(
        <StrictMode>
            <div className="in-data-[loaded=true]:hidden absolute w-screen h-screen">
                <LoadingScreen >
                    <span className="loading loading-spinner loading-xl"></span> Loading Gameflow
                </LoadingScreen>
            </div>
        </StrictMode>
    );
}
