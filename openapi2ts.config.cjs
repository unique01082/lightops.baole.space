module.exports = {
  schemaPath: require.resolve('./apps/api/openapi/lightops-v1.json'),
  serversPath: './src/generated/lightops-api',
  requestLibPath: "import request from '../../../lib/sync-request'",
  namespace: 'LightOpsSyncAPI',
};
