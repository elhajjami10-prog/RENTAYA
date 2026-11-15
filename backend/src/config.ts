import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  publicApiUrl: (process.env.PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, ''),
  publicAppUrl: (process.env.PUBLIC_APP_URL || 'http://localhost:8081').replace(/\/$/, ''),
  cmi: {
    clientId: process.env.CMI_CLIENT_ID || '',
    storeKey: process.env.CMI_STORE_KEY || '',
    gatewayUrl: process.env.CMI_GATEWAY_URL || 'https://testpayment.cmi.co.ma/fim/est3Dgate',
  },
  sms: { provider: process.env.SMS_PROVIDER || '', apiKey: process.env.SMS_API_KEY || '' },
  isProd: process.env.NODE_ENV === 'production',
};

if (config.isProd && config.jwtSecret === 'dev-secret') {
  throw new Error('JWT_SECRET doit être défini en production');
}
