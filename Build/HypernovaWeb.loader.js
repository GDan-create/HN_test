function createUnityInstance(canvas, config, onProgress) {
  onProgress = onProgress || function () {};

  function showBanner(msg, type) {
    if (!showBanner.aborted && config.showBanner) {
      if (type == 'error') showBanner.aborted = true;
      return config.showBanner(msg, type);
    }

    switch(type) {
      case 'error': console.error(msg); break;
      case 'warning': console.warn(msg); break;
      default: console.log(msg); break;
    }
  }

  var Module = {
    canvas: canvas,
    webglContextAttributes: {
      preserveDrawingBuffer: false,
      powerPreference: 2,
    },
    locateFile: function (url) {
      if (url.endsWith(".wasm")) {
        return "Build/HypernovaWeb.wasm.gz";
      } else if (url.endsWith(".data")) {
        return "Build/HypernovaWeb.data.gz";
      } else if (url.endsWith(".framework.js")) {
        return "Build/HypernovaWeb.framework.js.gz";
      }
      return url;
    },
    streamingAssetsUrl: "StreamingAssets",
    downloadProgress: {},
    deinitializers: [],
    preRun: [],
    postRun: [],
    print: function (message) {
      console.log(message);
    },
    printErr: function (message) {
      console.error(message);

      if (typeof message === 'string' && message.indexOf('wasm streaming compile failed') != -1) {
        if (message.toLowerCase().indexOf('mime') != -1) {
          showBanner('HTTP Response Header "Content-Type" configured incorrectly on the server for file ' + Module.codeUrl + ' , should be "application/wasm". Startup time performance will suffer.', 'warning');
        } else {
          showBanner('WebAssembly streaming compilation failed! This can happen for example if "Content-Encoding" HTTP header is incorrectly enabled on the server for file ' + Module.codeUrl + ', but the file is not pre-compressed on disk (or vice versa). Check the Network tab in browser Devtools to debug server header configuration.', 'warning');
        }
      }
    }
  };

  // Add default values if missing
  config.companyName = config.companyName || "Unity";
  config.productName = config.productName || "WebGL Player";
  config.productVersion = config.productVersion || "1.0";

  for (var parameter in config)
    Module[parameter] = config[parameter];

  // Initialize Unity instance
  return new Promise(function (resolve, reject) {
    if (!Module.SystemInfo || !Module.SystemInfo.hasWebGL) {
      reject("Your browser does not support WebGL.");
    } else if (!Module.SystemInfo.hasWebAssembly) {
      reject("Your browser does not support WebAssembly.");
    } else {
      Module.startupErrorHandler = reject;
      onProgress(0);
      Module.postRun.push(function () {
        onProgress(1);
        resolve({
          Module: Module,
          SetFullscreen: Module.SetFullscreen || function () {
            Module.print("Failed to set Fullscreen mode: Player not loaded yet.");
          },
          SendMessage: Module.SendMessage || function () {
            Module.print("Failed to execute SendMessage: Player not loaded yet.");
          },
          Quit: Module.Quit || function () {
            Module.print("Player not loaded yet.");
          }
        });
      });

      // Load WebAssembly and other resources
      var loadPromise = new Promise(function (resolve) {
        var script = document.createElement("script");
        script.src = Module.locateFile("Build/HypernovaWeb.framework.js");
        script.onload = resolve;
        script.onerror = function () {
          reject("Failed to load framework script.");
        };
        document.body.appendChild(script);
      });

      loadPromise.then(function () {
        // Trigger Unity initialization
        Module.postRun.forEach(function (callback) {
          callback();
        });
      });
    }
  });
}
