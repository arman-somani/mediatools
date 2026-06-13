const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    background: './src/background.js',
    popup: './src/popup.js',
    offscreen: './src/offscreen.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  resolve: {
    fallback: {
      "vm": require.resolve("vm-browserify"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "stream": require.resolve("stream-browserify"),
      "url": require.resolve("url/"),
      "querystring": require.resolve("querystring-es3"),
      "timers": require.resolve("timers-browserify"),
      "crypto": false,
      "fs": false,
      "path": false,
      "zlib": false,
      "os": false,
      "child_process": false
    }
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src/manifest.json", to: "manifest.json" },
        { from: "src/popup.html", to: "popup.html" },
        { from: "src/offscreen.html", to: "offscreen.html" },
        { from: "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js", to: "ffmpeg-core.js" },
        { from: "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm", to: "ffmpeg-core.wasm" }
      ],
    }),
  ]
};
