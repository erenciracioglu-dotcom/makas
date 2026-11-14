// Sayfaya masaustu surumunde calistigini bildirir (simdilik yalniz bilgi amacli).
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('makasMasaustu', { surum: process.versions.electron, platform: process.platform });
