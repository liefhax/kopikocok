const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Tambahkan 'wasm' ke dalam daftar ekstensi aset yang dikenali Metro
// Ini diwajibkan agar expo-sqlite dapat berjalan di platform Web
config.resolver.assetExts.push('wasm');

module.exports = config;