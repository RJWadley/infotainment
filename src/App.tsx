import { useState } from "react";
import logo from "./logo.svg";
import "normalize.css";
import AndroidAuto from "./components/AndroidAuto";
import { useRef } from "react";

function App() {
  const [isFullscreen, setFullscreen] = useState(false);
  const fullscreenButton = useRef<HTMLButtonElement>(null);

  //on button click
  const enterFullscreen = () => {
    document.body.requestFullscreen();
  };

  window.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) {
      setFullscreen(true);
    } else {
      setFullscreen(false);
    }
  });

  return (
    <div>
      {!isFullscreen && (
        <>
          <button ref={fullscreenButton} onClick={enterFullscreen}>
            Enter Fullscreen
          </button>
          <button
            ref={fullscreenButton}
            onClick={() => {
              setFullscreen(true);
            }}
          >
            Skip Fullscreen
          </button>
        </>
      )}
      {isFullscreen && <AndroidAuto />}
    </div>
  );
}

export default App;
