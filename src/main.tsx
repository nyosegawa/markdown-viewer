import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

if (typeof navigator !== "undefined" && /Mac OS X|Macintosh/.test(navigator.userAgent)) {
  document.documentElement.dataset.platform = "mac";
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("#root not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
