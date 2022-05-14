import { useEffect, useRef, useState } from "react";
import { render } from "react-dom";
import styled, { keyframes } from "styled-components";
import { useInterval, useTimeout } from "usehooks-ts";
import { WebglScreen } from "./webgl";

export default function AndroidAuto() {
  window.addEventListener("DOMContentLoaded", () => {
    let que = new Uint8Array();
    var logger = document.getElementById("log");
    var vidElement = document.querySelector("video");
    var canvas = document.querySelector("canvas");
    let ctx, webgl;
    vidElement.style.display = "none";
    canvas.style.display = "none";
    const ipAddress = "192.168.3.4";
    let latestVersion = 2;
    let controller;
    let lastrun = 0;
    let socket;
    let zoom = Math.max(1, window.innerHeight / 1080);

    function sourceOpen(e) {
      var mime = 'video/mp4; codecs="avc1.428028"';
      sourceBuffer = e.currentTarget.addSourceBuffer(mime);
      // sourceBuffer.addEventListener('update', updatetime);
      sourceBuffer.addEventListener("error", socketClose);

      vidElement.play();
      vidElement.playbackRate = 1;
    }

    // const vidElement = document.querySelector('video');
    const renderObject = document.querySelector("body");
    var width, height;
    let appversion = 0;
    //const ctx = canvas.getContext('2d');
    // let webgl=new WebglScreen(canvas);
    // webgl._init();

    //const urlToFetch = `http://${ipAddress}:8080/getsocketport?w=${window.innerWidth}&h=${window.innerHeight}`;
    let urlToFetch;

    if (location.protocol === "https:")
      urlToFetch = `https://teslaa.androidwheels.com:8081/getsocketport?w=${window.innerWidth}&h=${window.innerHeight}`;
    else
      urlToFetch = `http://teslaa.androidwheels.com:8080/getsocketport?w=${window.innerWidth}&h=${window.innerHeight}`;

    var backlog = 0;

    function videoData(event) {
      new Response(event.data).arrayBuffer().then((d) => {
        var bytes = new Uint8Array(d);
        if (
          vidElement.buffered.length > 0 &&
          vidElement.buffered.end(0) * 30 >
            vidElement.getVideoPlaybackQuality().totalVideoFrames + 10
        ) {
          vidElement.playbackRate = 1.4;
        } else vidElement.playbackRate = 1;

        que = appendByteArray(que, bytes);
        if (sourceBuffer != null && !sourceBuffer.updating) {
          sourceBuffer.appendBuffer(que);
          que = new Uint8Array();
        }
      });
    }

    function oldCanvas(event) {
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
      let imageDecoder = new ImageDecoder({
        data: event.data.stream(),
        type: "image/jpeg",
      });

      renderAsync(imageDecoder, backlog);
    }

    let lastimagetimer;

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

      controller = new AbortController();
      const signal = controller.signal;

      const wait = setTimeout(() => {
        abortFetching();
      }, 5000);

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
            if (json.resolution === 2) {
              width = 1920;
              height = 1080;
              zoom = Math.max(1, window.innerHeight / 1080);
            } else if (json.resolution === 1) {
              width = 1280;
              height = 720;
              zoom = Math.max(1, window.innerHeight / 720);
              document.querySelector("video").style.height = "max(100vh,720px)";
              document.querySelector("canvas").style.height =
                "max(100vh,720px)";
            } else {
              width = 800;
              height = 480;
              zoom = Math.max(1, window.innerHeight / 480);
              document.querySelector("video").style.height = "max(100vh,480px)";
              document.querySelector("canvas").style.height =
                "max(100vh,480px)";
            }

            if (json.hasOwnProperty("buildversion")) {
              appversion = parseInt(json.buildversion);
              if (latestVersion > parseInt(json.buildversion)) {
                if (
                  parseInt(localStorage.getItem("showupdate")) !== latestVersion
                ) {
                  alert(
                    "There is a new version in playsotre, please update your app."
                  );
                  localStorage.setItem("showupdate", latestVersion);
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
              canvas.width = width;
              canvas.height = height;
            }

            if (appversion >= 12) {
              ctx = canvas.getContext("2d");
            } else if (appversion >= 8) {
              webgl = new WebglScreen(canvas);
              webgl._init();
            }
          } else {
            port = data;
          }

          if (location.protocol === "https:")
            socket = new WebSocket(`wss://teslaa.androidwheels.com:${port}`);
          else socket = new WebSocket(`ws://teslaa.androidwheels.com:${port}`);

          //socket= new WebSocket(`ws://${ipAddress}:${port}`);
          socket.addEventListener("open", (event) => {
            socket.send(JSON.stringify({ action: "START" }));
            lastrun = Date.now();

            if (appversion < 8) {
              vidElement.style.display = "block";
              var mediaSource = new MediaSource();
              timerId = setTimeout(function () {
                keepAlive(socket);
              }, 2000);
              vidElement.src = URL.createObjectURL(mediaSource);
              mediaSource.addEventListener("sourceopen", sourceOpen);
              mediaSource.addEventListener("sourceended", () => {
                console.log("mediaSource ended");
                socketClose();
              });

              mediaSource.addEventListener("sourceclose", () => {
                console.log("mediaSource closed");
                socketClose();
              });

              mediaSource.addEventListener("error", () => {
                console.error("mediaSource error");
                socketClose();
              });
            } else canvas.style.display = "block";
            //
            this.removeEventListener("open", arguments.callee);
            document.getElementById("info").style.display = "none";

            if (
              window.matchMedia &&
              window.matchMedia("(prefers-color-scheme: dark)").matches
            ) {
              socket.send(JSON.stringify({ action: "NIGHT", value: true }));
            } else
              socket.send(JSON.stringify({ action: "NIGHT", value: false }));

            window
              .matchMedia("(prefers-color-scheme: dark)")
              .addEventListener("change", (event) => {
                socket.send(
                  JSON.stringify({ action: "NIGHT", value: event.matches })
                );
              });
            timeoutid = setTimeout(getLocation, 200);
          });
          socket.addEventListener("close", socketClose);

          socket.addEventListener("error", socketClose);

          if (appversion < 8) socket.addEventListener("message", videoData);
          else if (appversion < 12)
            socket.addEventListener("message", oldCanvas);
          else socket.addEventListener("message", canvasData);
        })
        .catch((error) => {
          console.log(error);
          clearTimeout(wait);
          setTimeout(function () {
            checkphone();
          }, 2000);
        });
    }

    let timeoutid;
    let options = {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 150,
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

    function socketClose(event) {
      setTimeout(function () {
        location.reload();
      }, 2000);
    }
    function appendByteArray(buffer1, buffer2) {
      var tmp = new Uint8Array(
        (buffer1.byteLength | 0) + (buffer2.byteLength | 0)
      );
      tmp.set(buffer1, 0);
      tmp.set(buffer2, buffer1.byteLength | 0);
      return tmp;
    }

    function isJson(item) {
      item = typeof item !== "string" ? JSON.stringify(item) : item;

      try {
        item = JSON.parse(item);
      } catch (e) {
        return false;
      }
      return typeof item === "object" && item !== null;
    }

    renderObject.addEventListener("touchstart", (event) => {
      // vidElement.playbackRate = 1.4;
      socket.send(
        JSON.stringify({
          action: "DOWN",
          X: Math.floor(event.touches[0].clientX / zoom),
          Y: Math.floor(event.touches[0].clientY / zoom),
        })
      );
    });
    renderObject.addEventListener("touchend", (event) => {
      socket.send(
        JSON.stringify({
          action: "UP",
          X: Math.floor(event.changedTouches[0].clientX / zoom),
          Y: Math.floor(event.changedTouches[0].clientY / zoom),
        })
      );
    });
    renderObject.addEventListener("touchcancel", (event) => {
      socket.send(
        JSON.stringify({
          action: "UP",
          X: Math.floor(event.touches[0].clientX / zoom),
          Y: Math.floor(event.touches[0].clientY / zoom),
        })
      );
    });
    renderObject.addEventListener("touchmove", (event) => {
      // vidElement.playbackRate = 1.4;
      socket.send(
        JSON.stringify({
          action: "DRAG",
          X: Math.floor(event.touches[0].clientX / zoom),
          Y: Math.floor(event.touches[0].clientY / zoom),
        })
      );
    });

    var timerId = null;

    function keepAlive(webSocket) {
      if (Date.now() > lastrun + 3000) {
        location.reload();
      }

      lastrun = Date.now();
      if (webSocket.readyState == webSocket.OPEN) {
        webSocket.send("");
        timerId = setTimeout(function () {
          keepAlive(webSocket);
        }, 2000);
      }
    }

    function cancelKeepAlive() {
      if (timerId != null) {
        clearTimeout(timerId);
      }
    }

    checkphone();
  });

  return (
    <Container>
      <script></script>
      <VideoPlayer muted />
      <div id="info" />
      <canvas></canvas>
      {/* <Info ref={info}>
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
      </Info> */}
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
