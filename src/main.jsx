import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

function OpeningSplash() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const leaveTimer = window.setTimeout(() => setLeaving(true), reducedMotion ? 650 : 1850);
    const removeTimer = window.setTimeout(() => setVisible(false), reducedMotion ? 850 : 2350);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`opening-splash${leaving ? " opening-splash--leaving" : ""}`} aria-label="Stoic Discipline" role="status">
      <div className="opening-splash__emblem-frame" aria-hidden="true">
        <img className="opening-splash__artwork" src="./stoic-intro.webp" alt="" />
      </div>
      <div className="opening-splash__wordmark">STOIC DISCIPLINE</div>
      <div className="opening-splash__rule" aria-hidden="true" />
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <>
      <OpeningSplash />
      <App />
    </>
  </React.StrictMode>
);
