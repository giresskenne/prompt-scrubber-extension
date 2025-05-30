// webpack.config.js
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

export default {
  mode: 'production',
  entry: {
    contentScript: [
      './src/redactor.js', // imports redactor.js
      './src/contentScript.js'
    ],
    bg:            './src/bg.js'             // MV3 service-worker
  },
  output: {
    path:    path.resolve(__dirname, 'dist'),
    filename:'src/[name].js',                // keeps folder structure
    iife:    true                            // produce classic scripts
  },
  devtool: false,
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: { loader: 'babel-loader', options: { presets: [] } }
      }
    ]
  }
};
