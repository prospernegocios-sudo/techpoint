// Configuração dinâmica: lê o app.json e acrescenta o arquivo do Firebase (avisos no celular).
// No build do EAS o arquivo vem da variável secreta GOOGLE_SERVICES_JSON; localmente, de ./google-services.json
// (que não vai para o repositório).
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
  plugins: [
    ...(config.plugins ?? []),
    ['expo-notifications', { color: '#0B3D91', defaultChannel: 'avisos' }],
  ],
});
