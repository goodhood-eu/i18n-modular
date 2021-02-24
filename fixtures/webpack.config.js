const path = require('path');

const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const I18nModular = require('../lib/plugin');

const emitFile = Boolean(process.env.PREVIEW_EMIT_FILE);

module.exports = {
  entry: './app/app.js',
  context: __dirname,
  mode: 'development',
  devServer: {
    // Simulates a case where we have to watch the dictionary we're actively rebuilding
    writeToDisk: emitFile,
  },
  output: {
    publicPath: '/',
    path: path.resolve(`${__dirname}/assets`),
    filename: '[name]-[contenthash:8].js',
    chunkFilename: '[name]-[chunkhash:8].js',
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new I18nModular({ emitFile }),
    new WebpackManifestPlugin(),
    new CompressionPlugin({
      test: /\.(js|css|html|svg)$/,
    }),
    new HtmlWebpackPlugin(),
  ],
};
