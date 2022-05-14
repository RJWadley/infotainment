import { useState } from "react";
import logo from "./logo.svg";
import "normalize.css";
import AndroidAuto from "./components/AndroidAuto";
import OBDSerial from "./components/OBDSerial";

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      {/* <AndroidAuto /> */}
      <OBDSerial />
    </div>
  );
}

export default App;
