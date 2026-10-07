import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { SageActor } from "./hooks/sageActor";
import "./app/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SageActor.Provider>
      <App />
    </SageActor.Provider>
  </StrictMode>,
);
