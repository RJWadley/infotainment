export class WebglScreen {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    this._init();
  }

  _init() {
    let gl = this.gl;
    if (!gl) {
      console.log("gl not support ");
      return;
    }

    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    //GLSL
    let vertexShaderSource = `
            attribute lowp vec4 a_vertexPosition;
            attribute vec2 a_texturePosition;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = a_vertexPosition;
                v_texCoord = a_texturePosition;
            }
        `;

    let fragmentShaderSource = `
            precision lowp float;
            uniform sampler2D samplerY;
            uniform sampler2D samplerU;
           
            varying vec2 v_texCoord;
            void main() {
                float r,g,b,y,u,v;
                y = texture2D(samplerY, v_texCoord).r;
                u = texture2D(samplerU, v_texCoord).a - 0.5;
                v = texture2D(samplerU, v_texCoord).r - 0.5;
                r = y + 1.13983*v;
                g = y - 0.39465*u - 0.58060*v;
                b = y + 2.03211*u;
                gl_FragColor = vec4(r, g, b, 1.0);
            }
        `;

    let vertexShader = this._compileShader(
      vertexShaderSource,
      gl.VERTEX_SHADER
    );
    let fragmentShader = this._compileShader(
      fragmentShaderSource,
      gl.FRAGMENT_SHADER
    );

    let program = this._createProgram(vertexShader, fragmentShader);

    this._initVertexBuffers(program);

    gl.activeTexture(gl.TEXTURE0);
    gl.y = this._createTexture();
    gl.uniform1i(gl.getUniformLocation(program, "samplerY"), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.u = this._createTexture();
    gl.uniform1i(gl.getUniformLocation(program, "samplerU"), 1);
  }
  /**
   *   buffer
   * @param {glProgram} program
   */

  _initVertexBuffers(program) {
    let gl = this.gl;
    let vertexBuffer = gl.createBuffer();
    let vertexRectangle = new Float32Array([
      1.0, 1.0, 0.0, -1.0, 1.0, 0.0, 1.0, -1.0, 0.0, -1.0, -1.0, 0.0,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, vertexRectangle, gl.STATIC_DRAW);

    let vertexPositionAttribute = gl.getAttribLocation(
      program,
      "a_vertexPosition"
    );

    gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
    // vertexPosition
    gl.enableVertexAttribArray(vertexPositionAttribute);

    let textureRectangle = new Float32Array([
      1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0,
    ]);
    let textureBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, textureRectangle, gl.STATIC_DRAW);
    let textureCoord = gl.getAttribLocation(program, "a_texturePosition");
    gl.vertexAttribPointer(textureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(textureCoord);
  }

  /**
   *
   * @param {string} shaderSource GLSL
   * @param {number} shaderType  , VERTEX_SHADER   FRAGMENT_SHADER
   * @return {glShader}
   */
  _compileShader(shaderSource, shaderType) {
    let shader = this.gl.createShader(shaderType);

    this.gl.shaderSource(shader, shaderSource);

    this.gl.compileShader(shader);
    const success = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
    if (!success) {
      let err = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      console.error("could not compile shader", err);
      return;
    }

    return shader;
  }

  /**
   *   2
   * @param {glShader} vertexShader
   * @param {glShader} fragmentShader
   * @return {glProgram}
   */
  _createProgram(vertexShader, fragmentShader) {
    const gl = this.gl;
    let program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);
    //  WebGLProgram
    gl.useProgram(program);
    const success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);

    if (!success) {
      console.err("program fail to link" + this.gl.getShaderInfoLog(program));
      return;
    }

    return program;
  }

  /**
   *
   */
  _createTexture(filter = this.gl.LINEAR) {
    let gl = this.gl;
    let t = gl.createTexture();
    //  glTexture
    gl.bindTexture(gl.TEXTURE_2D, t);
    //   https://github.com/fem-d/webGL/blob/master/blog/WebGL Lesson%207 .md -> Texture wrapping
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    return t;
  }

  /**
   *
   * @param {number} width
   * @param {number} height
   */
  renderImg(width, height, data) {
    let gl = this.gl;
    // x y
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0, 0, 0, 0);

    gl.clear(gl.COLOR_BUFFER_BIT);

    let uOffset = width * height;
    let vOffset = (width >> 1) * (height >> 1);

    gl.bindTexture(gl.TEXTURE_2D, gl.y);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE,
      width,
      height,
      0,
      gl.LUMINANCE,
      gl.UNSIGNED_BYTE,
      data.subarray(0, uOffset)
    );

    gl.bindTexture(gl.TEXTURE_2D, gl.u);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.LUMINANCE_ALPHA,
      width / 2,
      height / 2,
      0,
      gl.LUMINANCE_ALPHA,
      gl.UNSIGNED_BYTE,
      data.subarray(uOffset, data.length)
    );

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   *   canvas
   * @param {number} width
   * @param {number} height
   * @param {number} maxWidth
   */
  setSize(width, height, maxWidth) {
    let canvasWidth = Math.min(maxWidth, width);
    this.canvas.width = canvasWidth;
    this.canvas.height = (canvasWidth * height) / width;
  }

  destroy() {
    const { gl } = this;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  }
}
