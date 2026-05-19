(function () {
  "use strict";

  function report(api, method, extra) {
    try {
      const stack = (new Error()).stack || "";
      window.postMessage({
        __privacyMonitor: true,
        api:    api,
        method: method,
        extra:  extra || null,
        stack:  stack.split("\n").slice(2, 4).join(" | ")
      }, "*");
    } catch (e) {}
  }

  if (window.HTMLCanvasElement) {
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function () {
      report("Canvas", "toDataURL", { width: this.width, height: this.height });
      return origToDataURL.apply(this, arguments);
    };
  }

  if (window.CanvasRenderingContext2D) {
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    CanvasRenderingContext2D.prototype.getImageData = function (x, y, w, h) {
      report("Canvas", "getImageData", { width: w, height: h });
      return origGetImageData.apply(this, arguments);
    };
  }


  function patchWebGL(ctxClass, label) {
    if (!ctxClass) return;
    const orig = ctxClass.prototype.getParameter;
    ctxClass.prototype.getParameter = function (param) {
      const isDebug = (param === 37445 || param === 37446);
      report(label, "getParameter", { param: param, debugRenderer: isDebug });
      return orig.apply(this, arguments);
    };
  }
  patchWebGL(window.WebGLRenderingContext,  "WebGL");
  patchWebGL(window.WebGL2RenderingContext, "WebGL2");

  function patchAudio(ctxClass, label) {
    if (!ctxClass) return;
    const origOsc = ctxClass.prototype.createOscillator;
    if (origOsc) {
      ctxClass.prototype.createOscillator = function () {
        report(label, "createOscillator");
        return origOsc.apply(this, arguments);
      };
    }
    const origComp = ctxClass.prototype.createDynamicsCompressor;
    if (origComp) {
      ctxClass.prototype.createDynamicsCompressor = function () {
        report(label, "createDynamicsCompressor");
        return origComp.apply(this, arguments);
      };
    }
  }
  patchAudio(window.AudioContext,        "AudioContext");
  patchAudio(window.OfflineAudioContext, "OfflineAudioContext");
})();