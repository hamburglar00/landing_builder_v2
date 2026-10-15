// Only non-secret release guards; never dump process.env or credential values.
const enabled = key => process.env[key] === 'true';
console.log(JSON.stringify({
  api2Enabled: enabled('TEMPLATE7_API2_PLAYER_CREATION_ENABLED'),
  demoEnabled: enabled('TEMPLATE7_DEMO_ENABLED'),
  multiDemo: enabled('TEMPLATE7_DEMO_MULTI_SKIN_ENABLED'),
  asesDemo: enabled('TEMPLATE7_DEMO_ASES_DEL_NORTE_ENABLED'),
  ganamosNetDemo: enabled('TEMPLATE7_DEMO_GANAMOS_NET_ENABLED'),
  reyCredentialsConfigured: Boolean(process.env.TEMPLATE7_DEMO_REY_USERNAME && process.env.TEMPLATE7_DEMO_REY_PASSWORD),
  landingAllowlistCount: (process.env.TEMPLATE7_DEMO_LANDING_IDS || '').split(',').filter(Boolean).length,
}));
