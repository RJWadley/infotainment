export default class OBDInterface {
  connected = false;
  port?: SerialPort;
  bufferLog = "";

  constructor() {}

  /**
   * connects to the serial device if it can,
   * otherwise requests a new serial device from the user
   */
  async connect() {
    console.log("connecting");
    if ("serial" in navigator) {
      //check if we've already got a port allocated
      const allPorts = await navigator.serial.getPorts();
      if (allPorts[0] != undefined) {
        // if we do then use it
        this.port = allPorts[0];
      } else {
        //otherwise get a new one
        this.port = await navigator.serial.requestPort();
      }

      // Wait for the serial port to open.
      await this.port.open({ baudRate: 9600 }).catch((e) => {
        switch (e.name) {
          case "NetworkError":
            throw new Error("Network Error: " + e.message);
          default:
            throw new Error(e);
        }
      });

      //reset
      await this.write("ATZ");
      //Turns off echo
      await this.write("ATE0");
    } else {
      throw new Error("No serial support");
    }
  }

  /**
   * disconnects from the serial device
   */
  async disconnect() {
    console.log("closing port");
    await this.port?.close();
    this.connected = false;
    console.log("port closed");
  }

  /**
   * sends a command to the ELM
   * @param command the command to send
   * @returns Promise that resolves if successful
   */
  write(command: string) {
    return new Promise<void>(async (resolve, reject) => {
      console.log("writing", command);
      if (this.port == undefined) throw new Error("No serial port available");

      //convert the string to data to send
      const dataToWrite = Uint8Array.from(
        Array.from(command).map((letter) => {
          return letter.charCodeAt(0);
        })
      );

      let writer = this.port.writable?.getWriter();
      writer
        ?.write(dataToWrite)
        .then(() => {
          console.log("success");
          if (writer) writer.releaseLock();
          resolve();
        })
        .catch(async (e) => {
          if (e.message === "The device has been lost.") {
            //if we're not connected then try to reconnect and write again
            console.log("disconnected, trying to reconnect");
            if (writer) writer.releaseLock();
            await this.disconnect();
            await this.connect();
            this.write(command).then(resolve).catch(reject);
          } else {
            if (writer) writer.releaseLock();
            console.log("WRITE ERROR!", e);
            reject();
          }
        });
    });
  }

  /**
   * reads the serial buffer to a string
   * @returns Promise that resolves to the content of the buffer
   */
  read(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      console.log("reading");
      if (this.port == undefined) throw new Error("No serial port available");

      const reader = this.port.readable?.getReader();
      let result = "";

      if (reader) {
        console.log("reading");
        //read incoming data

        await reader.read().then(
          ({ value, done }) => {
            console.log("success");
            //if get a value we have to convert it from raw data to a string
            if (value) {
              let stringResult = String.fromCharCode(
                //ELM recommends we filter out any NULL characters (00)
                ...Array.from(value).filter((charCode) => charCode > 0)
              );
              result += stringResult;
            }

            //we're done when we get "done" or ">" back
            //or if there's nothing to read
            if (value?.includes(62) || done || value == undefined) {
              // Allow the serial port to be closed later.
              reader.releaseLock();
              console.log("read:", result);
              this.bufferLog += result;
              resolve(result);
              return;
            }
          },
          async (e) => {
            if (e.message === "The device has been lost.") {
              //if we're not connected then try to reconnect and read again
              console.log("disconnected, trying to reconnect");
              reader.releaseLock();
              await this.disconnect();
              await this.connect();
              await this.read().then(resolve, reject);
            } else {
              console.log("READ ERROR!", e);
              reject();
              throw new Error("Couldn't read");
            }
          }
        );
      }

      reject(new Error("No reader defined!"));
    });
  }
}
