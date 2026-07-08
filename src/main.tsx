import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/app.css";
// <model-viewer> is loaded via a self-hosted script in index.html (public/model-viewer.min.js)
// rather than a bundled import, matching the prebuilt distribution that renders correctly.

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
