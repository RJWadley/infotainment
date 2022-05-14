import { useEffect } from "react";
import OBDInterface from "../util/obd";

declare global {
  interface Window {
    serial?: OBDInterface;
  }
}

async function runSerial() {
  let serial = new OBDInterface();
  window.serial = serial;
  await serial.connect();
  // await serial.disconnect();
  console.log("all done");
}

export default function OBDSerial() {
  return (
    <div>
      <button onClick={runSerial}>OBD Serial</button>
    </div>
  );
}
