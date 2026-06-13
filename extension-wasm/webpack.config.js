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
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src/manifest.json", to: "manifest.json" },
        { from: "src/content.js", to: "content.js" },
        { from: "src/popup.html", to: "popup.html" },
        { from: "src/offscreen.html", to: "offscreen.html" },
        { from: "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js", to: "ffmpeg-core.js" },
        { from: "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm", to: "ffmpeg-core.wasm" }
      ],
    }),
  ]
};
