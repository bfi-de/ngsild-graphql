import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";
import pkg from "resolve-typescript-plugin"; // required for importing .ts files as .js files with webpack https://www.npmjs.com/package/resolve-typescript-plugin 
const ResolveTypeScriptPlugin = pkg.default;
import CopyPlugin from "copy-webpack-plugin";

export default {
    entry: "./src/index.ts",
    // TODO new config for production without this one
    devtool: "inline-source-map",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.css$/i,
          use: ["style-loader", "css-loader"]
        },
      ],
    },
    resolve: {
      extensions: [".ts", ".js", ".css" ],
      plugins: [new ResolveTypeScriptPlugin()]
    },
    output: {
      filename: "bundle.js",
      path: path.resolve("./dist"),
      clean: true
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                //{ from: "./styles.css", to: "./dist/styles.css" }
                { from: "./assets", to: "./assets" }
            ]
        }),
        new HtmlWebpackPlugin({
            title: "NGSI visualisation",
            template: "index.html",
            inject: "body",
            scriptLoading: "module"
        }),
    ],
    devServer: {
        static: [
            { directory: path.resolve("./dist") },
        ],
        compress: false,
        port: 8080,
    },
}
