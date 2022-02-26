import { useState } from "react";
import logo from "./logo.svg";
import "normalize.css";
import AndroidAuto from "./components/AndroidAuto";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <AndroidAuto />
      test
    </div>
  );
}

export default App;
