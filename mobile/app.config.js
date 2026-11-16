// Permet de publier la version web sous un sous-dossier (ex. GitHub Pages : WEB_BASE_URL=/RENTAYA/demo)
module.exports = ({ config }) => ({
  ...config,
  experiments: { ...config.experiments, ...(process.env.WEB_BASE_URL ? { baseUrl: process.env.WEB_BASE_URL } : {}) },
});
