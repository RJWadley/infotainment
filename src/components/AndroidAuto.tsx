import { useEffect, useRef, useState } from "react";
import { render } from "react-dom";
import styled, { keyframes } from "styled-components";
import { useInterval, useTimeout } from "usehooks-ts";
import { WebglScreen } from "./webgl";

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

export default function AndroidAuto() {
  var canvas = useRef<HTMLCanvasElement>(null);
  const info = useRef<HTMLDivElement>(null);
  var width, height;
  let appversion = 0;
  let ctx, webgl;
  let latestVersion = 2;
  let controller;
  let socket;
  let zoom = 0;
  var backlog = 0;
  let lastimagetimer;
  let timeoutid;
  let lastrun;
  let resolution;
  const ipList = [
    "3.3.3.3",
    "teslaa.androidwheels.com",
    "10.1.47.73",
    "192.168.43.202",
  ];

  /**
   * runs every two seconds to either keep the socket alive or create a new one
   */
  async function heartbeat() {
    if (typeof socket !== "undefined" && socket.readyState === socket.OPEN) {
      keepAlive(socket);
    } else if (typeof socket !== "undefined") {
      checkphone();
    }
  }
  useInterval(heartbeat, 2000);

  function oldCanvas(event) {
    console.log("OLD CANVAS");
    // @ts-ignore
    const ds = new DecompressionStream("gzip");
    const decompressedStream = event.data.stream().pipeThrough(ds);
    new Response(decompressedStream).arrayBuffer().then((d) => {
      webgl.renderImg(width, height, new Uint8Array(d));
    });

    socket.send("");
  }

  function canvasData(event) {
    clearTimeout(lastimagetimer);
    if (backlog > 1) return;

    backlog++;
    // @ts-ignore
    let imageDecoder = new ImageDecoder({
      data: event.data.stream(),
      type: "image/jpeg",
    });

    renderAsync(imageDecoder, backlog);
  }

  function renderAsync(imageDecoder, poss) {
    imageDecoder.decode().then((result) => {
      if (backlog <= poss) ctx.drawImage(result.image, 0, 0);
      backlog--;

      if (backlog == 0) lastimagetimer = setTimeout(reDownloadLastFrame, 400);
    });
  }

  function reDownloadLastFrame() {
    socket.send("");
  }

  function abortFetching() {
    console.log("Now aborting");
    controller.abort();
  }

  function checkphone() {
    console.log("Now fetching");
    if (info.current) info.current.style.opacity = "1";
    if (canvas.current) canvas.current.style.opacity = "0";

    controller = new AbortController();
    const signal = controller.signal;

    const wait = setTimeout(() => {
      abortFetching();
    }, 5000);

    ipList.forEach((ip) => {
      let urlToFetch =
        location.protocol === "https:"
          ? `https://${ip}:8081/getsocketport?w=1258&h=922`
          : `http://${ip}:8080/getsocketport?w=1258&h=922`;

      fetch(urlToFetch, { method: "get", signal: signal })
        .then((response) => response.text())
        .then((data) => {
          clearTimeout(wait);
          if (document.hidden) {
            setTimeout(() => {
              checkphone();
            }, 2000);
            return;
          }

          let port;

          if (isJson(data)) {
            const json = JSON.parse(data);
            if (json.hasOwnProperty("wrongresolution")) {
              alert(
                "Browser resolution doesn't match app resolution. Updating values and restarting app."
              );
              location.reload();
            }

            port = json.port;

            resolution = json.resolution;
            updateZoom();

            if (json.hasOwnProperty("buildversion")) {
              appversion = parseInt(json.buildversion);
              if (latestVersion > parseInt(json.buildversion)) {
                if (
                  parseInt(localStorage.getItem("showupdate") ?? "0") !==
                  latestVersion
                ) {
                  alert(
                    "There is a new version in playsotre, please update your app."
                  );
                  localStorage.setItem("showupdate", latestVersion.toString());
                }
              }
            }

            if (json.hasOwnProperty("width") && appversion > 11) {
              width = json.width;
              height = json.height;
            }

            if (location.protocol !== "https:" && appversion >= 11)
              document.location.href =
                "https://www.androidwheels.com" + window.location.pathname;

            if (appversion >= 8) {
              if (canvas.current) {
                canvas.current.width = width;
                canvas.current.height = height;
              }
            }

            if (appversion >= 12) {
              if (canvas.current) ctx = canvas.current.getContext("2d");
            } else if (appversion >= 8) {
              webgl = new WebglScreen(canvas.current);
              webgl._init();
            }
          } else {
            port = data;
          }

          if (location.protocol === "https:")
            socket = new WebSocket(`wss://${ip}:${port}`);
          else socket = new WebSocket(`ws://${ip}:${port}`);

          socket.addEventListener("open", handleSocketOpen);
          socket.addEventListener("close", socketClose);
          socket.addEventListener("error", socketClose);

          console.log("appversion", appversion);

          if (appversion < 12) socket.addEventListener("message", oldCanvas);
          else socket.addEventListener("message", canvasData);
        })
        .catch((error) => {
          console.log(error);
          if (typeof socket === "undefined") {
            clearTimeout(wait);
            setTimeout(function () {
              checkphone();
            }, 2000);
          }
        });
    });
  }

  function updateZoom() {
    if (!canvas.current) {
      return;
    }

    if (resolution === 2) {
      width = 1920;
      height = 1080;
      zoom = canvas.current.offsetHeight / 940;
    } else if (resolution === 1) {
      width = 1280;
      height = 720;
      zoom = canvas.current.offsetHeight / 720;
    } else {
      width = 800;
      height = 480;
      zoom = canvas.current.offsetHeight / 480;
    }
  }

  window.addEventListener("resize", updateZoom);

  let options = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 150,
  };

  const handleSocketOpen = () => {
    if (info.current) info.current.style.opacity = "0";
    if (canvas.current) canvas.current.style.opacity = "1";

    socket.send(JSON.stringify({ action: "START" }));
    lastrun = Date.now();

    if (canvas.current) canvas.current.style.display = "block";

    socket.removeEventListener("open", handleSocketOpen);

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      socket.send(JSON.stringify({ action: "NIGHT", value: true }));
    } else socket.send(JSON.stringify({ action: "NIGHT", value: false }));

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => {
        socket.send(JSON.stringify({ action: "NIGHT", value: event.matches }));
      });
    timeoutid = setTimeout(getLocation, 200);
  };

  function getLocation() {
    navigator.geolocation.getCurrentPosition(getPosition);
  }

  function getPosition(pos) {
    clearTimeout(timeoutid);
    socket.send(
      JSON.stringify({
        action: "GPS",
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        altitude: pos.coords.altitude,
        accuracy: pos.coords.accuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
      })
    );
    timeoutid = setTimeout(getLocation, 500);
  }

  function socketClose() {
    // setTimeout(function () {
    //   location.reload();
    // }, 2000);
  }

  useEffect(() => {
    if (canvas.current) {
      canvas.current.addEventListener("touchstart", (event) => {
        // vidElement.playbackRate = 1.4;
        if (socket && socket.readyState === socket.OPEN)
          socket.send(
            JSON.stringify({
              action: "DOWN",
              X: Math.floor(event.touches[0].clientX / zoom),
              Y: Math.floor(event.touches[0].clientY / zoom),
            })
          );
      });
      canvas.current.addEventListener("touchend", (event) => {
        if (socket && socket.readyState === socket.OPEN)
          socket.send(
            JSON.stringify({
              action: "UP",
              X: Math.floor(event.changedTouches[0].clientX / zoom),
              Y: Math.floor(event.changedTouches[0].clientY / zoom),
            })
          );
      });
      canvas.current.addEventListener("touchcancel", (event) => {
        if (socket && socket.readyState === socket.OPEN)
          socket.send(
            JSON.stringify({
              action: "UP",
              X: Math.floor(event.touches[0].clientX / zoom),
              Y: Math.floor(event.touches[0].clientY / zoom),
            })
          );
      });
      canvas.current.addEventListener("touchmove", (event) => {
        // vidElement.playbackRate = 1.4;
        if (socket && socket.readyState === socket.OPEN)
          socket.send(
            JSON.stringify({
              action: "DRAG",
              X: Math.floor(event.touches[0].clientX / zoom),
              Y: Math.floor(event.touches[0].clientY / zoom),
            })
          );
      });

      checkphone();
    }
  }, [canvas]);

  return (
    <Container>
      <Canvas ref={canvas}></Canvas>
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
  height: min(100vh, 72.857vw);
  aspect-ratio: 100000/72857;
  background-color: black;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
`;

const Canvas = styled.canvas`
  display: block;
  transition: opacity 1s;
  opacity: 1;
  height: 100.88%;
  min-width: 100%;
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
  pointer-events: none;
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
