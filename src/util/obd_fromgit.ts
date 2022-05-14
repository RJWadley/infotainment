"use strict";

/**
 * obdInfo.js for all PIDS.
 * @type {*}
 */
import PIDS from "./obdInfo";

let activePollers: string[] = [];
let pollerInterval;

/**
 * Constant for defining delay between writes.
 */
let writeDelay = 50;

/**
 * Queue for writing
 * @type {Array}
 */
let queue: string[] = [];

let lastSentCommand = "";

class OBDReader {
  connected: boolean;
  receivedData: string;
  awaitingReply: boolean;
  OPTIONS: SerialOptions;
  serialPort?: SerialPort;

  constructor(options: SerialOptions) {
    this.connected = false;
    this.receivedData = "";
    this.awaitingReply = false;
    this.OPTIONS = options;
  }

  /**
   * Connect/Open the serial port and add events to serial-port.
   * Also starts the .pushWriter that is used to write the queue.
   * @deprecated
   */
  async connect() {
    if ("serial" in navigator) {
      const port = await navigator.serial.requestPort();

      // Wait for the serial port to open.
      await port.open(this.OPTIONS);

      navigator.serial.addEventListener("disconnect", () => {
        console.log("Serial has disconnected");
      });

      navigator.serial.addEventListener("connect", () => {
        this.connected = true;

        //self.write('ATZ');
        //Turns off echo.
        this.write("ATE0");
        //Turns off extra line feed and carriage return
        this.write("ATL0");
        //This disables spaces in in output, which is faster!
        this.write("ATS0");
        //Turns off headers and checksum to be sent.
        this.write("ATH0");
        //Turn adaptive timing to 2. This is an aggressive learn curve for adjusting the timeout. Will make huge difference on slow systems.
        this.write("ATAT2");
        //Set timeout to 10 * 4 = 40msec, allows +20 queries per second. This is the maximum wait-time. ATAT will decide if it should wait shorter or not.
        this.write("ATST0A");
        //Set the protocol to automatic.
        this.write("ATSP0");
      });
    }

    return this;
  }

  async processQueue() {
    if (this.awaitingReply == true) {
      setTimeout(this.processQueue, 100);
    } else {
      if (queue.length > 0 && this.connected) {
        try {
          if (this.serialPort?.writable) {
            this.awaitingReply = true;
            lastSentCommand = queue[0];

            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(
              this.serialPort.writable
            );

            const writer = textEncoder.writable.getWriter();

            await writer.write(queue.shift() + "\r");
            writer.releaseLock();
          }
        } catch (err) {
          console.log("Error while writing: " + err);
          console.log(
            "OBD-II Listeners deactivated, connection is probably lost."
          );
          this.removeAllPollers();
        }
      }
    }
  }

  processData(data) {
    let currentString, arrayOfCommands;
    currentString = this.receivedData + data.toString("utf8"); // making sure it's a utf8 string

    arrayOfCommands = currentString.split(">");

    let forString;
    if (arrayOfCommands.length < 2) {
      this.receivedData = arrayOfCommands[0];
    } else {
      for (
        let commandNumber = 0;
        commandNumber < arrayOfCommands.length;
        commandNumber++
      ) {
        forString = arrayOfCommands[commandNumber];
        if (forString === "") {
          continue;
        }

        let multipleMessages = forString.split("\r");
        for (
          let messageNumber = 0;
          messageNumber < multipleMessages.length;
          messageNumber++
        ) {
          let messageString = multipleMessages[messageNumber];
          if (messageString === "") {
            continue;
          }

          let reply;
          reply = parseOBDCommand(messageString);

          console.log(reply);

          if (this.awaitingReply == true) {
            this.awaitingReply = false;
            this.processQueue();
          }

          this.receivedData = "";
        }
      }
    }
  }

  /**
   * Disconnects/closes the port.
   */
  disconnect() {
    queue.length = 0; //Clears queue
    this.serialPort?.close();
    this.connected = false;
  }

  /**
   * Writes a message to the port. (Queued!) All write functions call this function.
   * @param {string} message The PID or AT Command you want to send. Without \r or \n!
   * @param {number} replies The number of replies that are expected. Default = 0. 0 --> infinite
   * AT Messages --> Zero replies!!
   */
  write(message: string, replies?: number) {
    if (replies === undefined) {
      replies = 0;
    }

    if (this.connected) {
      if (queue.length < 256) {
        if (replies !== 0) {
          queue.push(message + replies);
        } else {
          queue.push(message);
        }

        if (this.awaitingReply == false) {
          this.processQueue();
        }
      } else {
        console.log("Queue-overflow!");
      }
    } else {
      console.log("OBD Serial device is not connected.");
    }
  }

  /**
   * Writes a PID value by entering a pid supported name.
   * @param {string} name Look into obdInfo.js for all PIDS.
   */
  requestValueByName(name) {
    this.write(getPIDByName(name));
  }

  /**
   * Adds a poller to the poller-array.
   * @param {string} name Name of the poller you want to add.
   */
  addPoller(name) {
    let stringToSend = getPIDByName(name);
    activePollers.push(stringToSend);
  }

  /**
   * Removes an poller.
   * @param {string} name Name of the poller you want to remove.
   */
  removePoller(name) {
    let stringToDelete = getPIDByName(name);
    let index = activePollers.indexOf(stringToDelete);
    activePollers.splice(index, 1);
  }

  /**
   * Removes all pollers.
   */
  removeAllPollers() {
    activePollers.length = 0; //This does not delete the array, it just clears every element.
  }

  /**
   * Writes all active pollers.
   */
  writePollers() {
    let i;
    for (i = 0; i < activePollers.length; i++) {
      this.write(activePollers[i], 1);
    }
  }

  /**
   * Starts polling. Lower interval than activePollers * 50 will probably give buffer overflows. See writeDelay.
   * @param {number} interval Frequency how often all variables should be polled. (in ms). If no value is given, then for each activePoller 75ms will be added.
   */
  startPolling(interval) {
    if (interval === undefined) {
      interval = activePollers.length * (writeDelay * 2); //Double the delay, so there's room for manual requests.
    }

    let self = this;
    pollerInterval = setInterval(function () {
      self.writePollers();
    }, interval);
  }

  /**
   * Stops polling.
   */
  stopPolling() {
    clearInterval(pollerInterval);
  }
}

/**
 * Find a PID-value by name.
 * @param name Name of the PID you want the hexadecimal (in ASCII text) value of.
 * @return {string} PID in hexadecimal ASCII
 */
function getPIDByName(name: string) {
  let i;
  for (i = 0; i < PIDS.length; i++) {
    if (PIDS[i].name === name) {
      if (PIDS[i].pid !== undefined) {
        return PIDS[i].mode + PIDS[i].pid;
      }
      //There are modes which don't require a extra parameter ID.
      return PIDS[i].mode;
    }
  }
}

/**
 * Parses a hexadecimal string to a reply object. Uses PIDS. (obdInfo.js)
 * @param {string} hexString Hexadecimal value in string that is received over the serialport.
 * @return {Object} reply - The reply.
 * @return {string} reply.value - The value that is already converted. This can be a PID converted answer or "OK" or "NO DATA".
 * @return {string} reply.name - The name. --! Only if the reply is a PID.
 * @return {string} reply.mode - The mode of the PID. --! Only if the reply is a PID.
 * @return {string} reply.pid - The PID. --! Only if the reply is a PID.
 */
function parseOBDCommand(hexString: string) {
  let byteNumber, valueArray; //New object

  let reply: {
    value: string;
    name?: string;
    mode?: string;
    pid?: string;
  } = {
    value: hexString,
  };

  if (
    hexString === "NO DATA" ||
    hexString === "OK" ||
    hexString === "?" ||
    hexString === "UNABLE TO CONNECT" ||
    hexString === "SEARCHING..."
  ) {
    //No data or OK is the response. Return directly.
    return reply;
  }

  hexString = hexString.replace(/ /g, ""); //Whitespace trimming //Probably not needed anymore?
  valueArray = [];

  for (byteNumber = 0; byteNumber < hexString.length; byteNumber += 2) {
    valueArray.push(hexString.substring(byteNumber, 2));
  }

  if (valueArray[0] === "41") {
    reply.mode = valueArray[0];
    reply.pid = valueArray[1];
    for (let i = 0; i < PIDS.length; i++) {
      if (PIDS[i].pid == reply.pid) {
        let numberOfBytes = PIDS[i].bytes;
        reply.name = PIDS[i].name;
        switch (numberOfBytes) {
          case 1:
            reply.value = PIDS[i].convertToUseful(valueArray[2]);
            break;
          case 2:
            reply.value = PIDS[i].convertToUseful(valueArray[2], valueArray[3]);
            break;
          case 4:
            reply.value = PIDS[i].convertToUseful(
              valueArray[2],
              valueArray[3],
              valueArray[4],
              valueArray[5]
            );
            break;
          case 8:
            reply.value = PIDS[i].convertToUseful(
              valueArray[2],
              valueArray[3],
              valueArray[4],
              valueArray[5],
              valueArray[6],
              valueArray[7],
              valueArray[8],
              valueArray[9]
            );
            break;
        }
        break; //Value is converted, break out the for loop.
      }
    }
  } else if (valueArray[0] === "43") {
    reply.mode = valueArray[0];
    for (let i = 0; i < PIDS.length; i++) {
      if (PIDS[i].mode == "03") {
        reply.name = PIDS[i].name;
        reply.value = PIDS[i].convertToUseful(
          valueArray[1],
          valueArray[2],
          valueArray[3],
          valueArray[4],
          valueArray[5],
          valueArray[6]
        );
      }
    }
  }
  return reply;
}

export default OBDReader;
