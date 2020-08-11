const path = require('path');

const ManifestPlugin = require('webpack-manifest-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const I18nModular = require('../lib/plugin');

const emitFile = Boolean(process.env.PREVIEW_EMIT_FILE);

module.exports = {
  entry: './app/app.js',
  context: __dirname,
  mode: 'development',
  output: {
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
    new ManifestPlugin(),
    new CompressionPlugin({
      filename: '[path].gz[query]',
      test: /\.(js|css|html|svg)$/,
    }),
    new HtmlWebpackPlugin(),
  ],
};
