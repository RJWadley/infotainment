import { useEffect, useRef, useState } from "react";
import { render } from "react-dom";
import styled, { keyframes } from "styled-components";
import { useInterval, useTimeout } from "usehooks-ts";

/**
 * determines if the api response is json or string
 * @param item item to distinguish
 * @returns true if json
 */
function isJson(item: JSON | string) {
  item = typeof item !== "string" ? JSON.stringify(item) : item;

  try {
    item = JSON.parse(item);
  } catch (e) {
    return false;
  }

  if (typeof item === "object" && item !== null) {
    return true;
  }

  return false;
}

/**
 * keeps a socket alive by sending empty string
 * @param webSocket socket to keep alive
 */
function keepAlive(webSocket: WebSocket) {
  console.log("Keeping the socket alive...");

  if (webSocket.readyState == webSocket.OPEN) {
    webSocket.send("");
  }
}

function appendByteArray(buffer1: Uint8Array, buffer2: Uint8Array) {
  var tmp = new Uint8Array((buffer1.byteLength | 0) + (buffer2.byteLength | 0));
  tmp.set(buffer1, 0);
  tmp.set(buffer2, buffer1.byteLength | 0);
  return tmp;
}

export default function AndroidAuto() {
  const info = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLVideoElement>(null);
  const ipList = ["192.168.43.207", "10.1.47.5"];
  const [socket, setSocket] = useState<WebSocket>();
  const [zoom, setZoom] = useState(1);
  const [socketURL, setSocketURL] = useState<string>();
  const [resolution, setResolution] = useState(2);
  let sourceBuffer: SourceBuffer;
  let mediaSource: MediaSource;
  let queue = new Uint8Array();

  /**
   * runs every two seconds to either keep the socket alive or create a new one
   */
  async function heartbeat() {
    if (typeof socket !== "undefined" && socket.readyState === socket.OPEN) {
      keepAlive(socket);
    } else {
      if (player.current) player.current.style.opacity = "0";
      if (info.current) info.current.style.opacity = "1";
      checkForPhone(ipList)
        .then((address) => {
          setSocket(new WebSocket(address));
          setSocketURL(address);
        })
        .catch((error) => {
          console.log("no connections found");
        });
    }
  }
  useInterval(heartbeat, 2000);

  useEffect(() => {
    function updateResolution() {
      if (player.current)
        if (resolution == 2) {
          setZoom(player.current.offsetHeight / 1080);
        } else if (resolution == 1) {
          setZoom(player.current.offsetHeight / 720);
        } else {
          setZoom(player.current.offsetHeight / 480);
        }
    }

    updateResolution();
    window.addEventListener("resize", updateResolution);

    return () => {
      window.removeEventListener("resize", updateResolution);
    };
  }, [resolution]);

  /**
   * defines socket event listeners when the socket changes
   */
  useEffect(() => {
    console.log("socket updated");

    if (socket == undefined) {
      console.log("socket is not defined");
      return;
    }

    socket.addEventListener("open", handleSocketOpen);
    socket.addEventListener("close", handleSocketClose);
    socket.addEventListener("error", handleSocketClose);
    socket.addEventListener("message", handleSocketData);

    return () => {
      socket.removeEventListener("open", handleSocketOpen);
      socket.removeEventListener("close", handleSocketClose);
      socket.removeEventListener("error", handleSocketClose);
      socket.removeEventListener("message", handleSocketData);
    };
  }, [socket]);

  /**
   * defines video events
   */
  useEffect(() => {
    console.log("player updated");

    if (player.current == undefined) return;

    function handleError(e: ErrorEvent) {
      console.error(e, e.message);
    }

    // player.current.addEventListener("error", handleError);

    // player.current.addEventListener("pause", function (e) {
    //   // window.location.reload();
    // });

    return;
  }, [player]);

  /**
   * handles touch events on the rendered surface
   */
  useEffect(() => {
    console.log("render object changed");

    if (container.current == undefined) return;

    const handleTouchStart = (event: TouchEvent) => {
      console.log("touchstart");
      if (player.current == undefined || socket == undefined) return;
      player.current.playbackRate = 1.4;
      socket.send(
        JSON.stringify({
          action: "DOWN",
          X: Math.floor(event.touches[0].clientX / zoom),
          Y: Math.floor(event.touches[0].clientY / zoom),
        })
      );
    };

    const handleTouchEnd = (event: TouchEvent) => {
      console.log("touchend");
      if (socket == undefined) return;
      socket.send(
        JSON.stringify({
          action: "UP",
          X: Math.floor(event.changedTouches[0].clientX / zoom),
          Y: Math.floor(event.changedTouches[0].clientY / zoom),
        })
      );
    };

    const handleTouchCancel = (event: TouchEvent) => {
      console.log("touchcancel");
      if (socket == undefined) return;
      socket.send(
        JSON.stringify({
          action: "UP",
          X: Math.floor(event.touches[0].clientX / zoom),
          Y: Math.floor(event.touches[0].clientY / zoom),
        })
      );
    };

    const handleTouchMove = (event: TouchEvent) => {
      console.log("touchmove");
      if (socket == undefined) return;
      if (player.current == undefined) return;
      player.current.playbackRate = 1.4;
      socket.send(
        JSON.stringify({
          action: "DRAG",
          X: Math.floor(event.touches[0].clientX / zoom),
          Y: Math.floor(event.touches[0].clientY / zoom),
        })
      );
    };

    container.current.addEventListener("touchstart", handleTouchStart);
    container.current.addEventListener("touchend", handleTouchEnd);
    container.current.addEventListener("touchcancel", handleTouchCancel);
    container.current.addEventListener("touchmove", handleTouchMove);

    return () => {
      if (container.current == undefined) return;
      container.current.removeEventListener("touchstart", handleTouchStart);
      container.current.removeEventListener("touchend", handleTouchEnd);
      container.current.removeEventListener("touchcancel", handleTouchCancel);
      container.current.removeEventListener("touchmove", handleTouchMove);
    };
  });

  /**
   * links media source up to video element
   * @param e source open event
   */
  function handleSourceOpen(e: Event) {
    console.log("handling source open");
    if (player.current == undefined || e.currentTarget == undefined) return;

    let mime = 'video/mp4; codecs="avc1.428028"';
    sourceBuffer = (e.currentTarget as MediaSource).addSourceBuffer(mime);
    sourceBuffer.addEventListener("error", handleSocketClose);

    console.log(sourceBuffer);

    player.current.play();
    player.current.playbackRate = 1;
  }

  function updateMedia() {
    if (player.current == undefined) return;

    console.log("updating media");
    mediaSource = new MediaSource();
    player.current.src = URL.createObjectURL(mediaSource);

    mediaSource.addEventListener("sourceopen", handleSourceOpen);

    mediaSource.addEventListener("sourceended", () => {
      console.log("mediaSource ended");
      handleSocketClose();
    });

    mediaSource.addEventListener("sourceclose", () => {
      console.log("mediaSource closed");
      handleSocketClose();
    });

    mediaSource.addEventListener("error", () => {
      console.error("mediaSource error");
      handleSocketClose();
    });
  }

  /**
   * setup when socket opens
   */
  function handleSocketOpen() {
    if (player.current == undefined) {
      throw new Error("No player to stream to!");
    }
    if (socket == undefined) {
      throw new Error("No socket!");
    }

    setTimeout(() => {
      if (player.current) player.current.style.opacity = "1";
    }, 3000);
    setTimeout(() => {
      if (info.current) info.current.style.opacity = "0";
    }, 2000);

    updateMedia();

    socket.send(JSON.stringify({ action: "START" }));
    socket.removeEventListener("open", handleSocketOpen);
  }

  /**
   * handles incoming socket data
   * @param event socket data event
   */
  function handleSocketData(event: MessageEvent) {
    new Response(event.data).arrayBuffer().then((d) => {
      let bytes = new Uint8Array(d);
      if (
        player.current != undefined &&
        player.current.buffered.length > 0 &&
        player.current.buffered.end(0) * 30 >
          player.current.getVideoPlaybackQuality().totalVideoFrames + 10
      ) {
        player.current.playbackRate = 1.4;
      } else if (player.current != undefined) {
        player.current.playbackRate = 1;
      }

      queue = appendByteArray(queue, bytes);
      if (sourceBuffer != null && !sourceBuffer.updating) {
        sourceBuffer.appendBuffer(queue);
        queue = new Uint8Array();
      } else {
        console.log("no source?", sourceBuffer);
        if (sourceBuffer == undefined) {
          socket?.close();
          if (socketURL) setSocket(new WebSocket(socketURL));
        }
      }
    });
  }

  /**
   * takes care of when the socket closes
   */
  function handleSocketClose() {}

  /**
   * polls all the given ips to check for active ones
   * @param ips list of ips to check
   * @returns the ws address to hook into
   */
  function checkForPhone(ips: string[]) {
    let controller = new AbortController();
    let signal = controller.signal;
    let promises: Promise<string>[] = [];

    ips.forEach((ip) => {
      promises.push(
        new Promise<string>((resolve, reject) => {
          setTimeout(() => {
            controller.abort();
            reject();
          }, 1500);

          let urlToFetch = "http://" + ip + ":8080/getsocketport";
          console.log("polling ip", ip);
          fetch(urlToFetch, {
            method: "get",
            signal: signal,
          })
            .then((response) => response.text())
            .then((data) => {
              if (document.hidden) {
                reject();
                return;
              }

              let port;
              if (isJson(data)) {
                let json = JSON.parse(data);
                port = json.port;
                setResolution(json.resolution);
              } else port = data;

              resolve("ws://" + ip + ":" + port);
            })
            .catch((error) => {
              reject(error);
            });
        })
      );
    });

    return Promise.any(promises);
  }

  return (
    <Container ref={container}>
      <VideoPlayer muted ref={player} />
      <Info ref={info}>
        <Spinner reverse={true} size="400" color="#CC3F0C">
          <Spinner reverse={false} size="350" color="#FFA630">
            <Spinner reverse={true} size="300" color="#C9DCB3">
              <Spinner reverse={false} size="250" color="#33673B">
                <Spinner reverse={true} size="200" color="#004E89">
                  <Spinner reverse={false} size="150" color="#3943B7"></Spinner>
                </Spinner>
              </Spinner>
            </Spinner>
          </Spinner>
        </Spinner>
      </Info>
    </Container>
  );
}

const Container = styled.div`
  width: 100vw;
  height: 72.857vw;
  background-color: black;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
`;

const VideoPlayer = styled.video`
  display: block;
  transition: opacity 1s;
  opacity: 0;
  height: 105.88%;
`;

const Info = styled.div`
  position: absolute;
  transition: opacity 1s;
  font-size: 50px;
  color: white;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: grid;
  place-items: center;
`;

let spin = keyframes`
    0% {
        transform: translate(-50%, -50%) rotate(0deg);
    }
    100% {
        transform: translate(-50%, -50%) rotate(360deg);
    }
`;

const Spinner = styled.div<{ size: string; color: string; reverse: boolean }>`
  animation: ${spin} ${(props) => (props.reverse ? "10s" : "5s")} ease-in-out
    infinite;
  animation-direction: ${(props) => (props.reverse ? "normal" : "reverse")};
  width: ${(props) => props.size}px;
  height: ${(props) => props.size}px;
  border: 10px solid ${(props) => props.color};
  background: black;
  border-radius: 20px;
  position: absolute;
  top: 50%;
  left: 50%;
`;
