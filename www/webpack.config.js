/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const CopyWebpackPlugin = require("copy-webpack-plugin");
const path = require('path');

module.exports = {
  watchOptions: {
    aggregateTimeout: 500, // delay before starting rebuild once one file changes
    poll: 100, // check every x ms for changes
  },
  entry: "./src/index.ts",
  
  module: {
    rules: [
      {
       test: /\.(js|jsx|tsx|ts)$/,
       exclude: /node_modules/,
       loader: 'babel-loader'
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ]
  },
  resolve: {
    extensions: ['*', '.js', '.jsx', '.tsx', '.ts'],
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
  mode: "development",
  plugins: [
    new CopyWebpackPlugin({
      patterns: ['index.html', 'index.css']
    })
  ],
  experiments: {
    asyncWebAssembly: true
  }
};
