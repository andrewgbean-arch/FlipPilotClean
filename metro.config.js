const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// Operation Nightglass ships inside the app as a single HTML page (assets/games).
config.resolver.assetExts.push("html");

module.exports = config;
