const path = require('path');

const ManifestPlugin = require('webpack-manifest-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const I18nModular = require('../lib/plugin');

module.exports = {
  entry: path.resolve(`${__dirname}/app/app.js`),
  context: __dirname,
  mode: 'development',
  output: {
    path: path.resolve(`${__dirname}/assets`),
    filename: '[name]-[contenthash:8].js',
    chunkFilename: '[name]-[chunkhash:8].js',
  },
  plugins: [
    new CleanWebpackPlugin(),
    new I18nModular({
      keysRoot: './app',
      dictionaryPattern: './dictionaries/[locale_code].json',
      emitFile: false,
    }),
    new ManifestPlugin(),
    new CompressionPlugin({
      filename: '[path].gz[query]',
      test: /\.(js|css|html|svg)$/,
    }),
    new HtmlWebpackPlugin(),
  ],
};
