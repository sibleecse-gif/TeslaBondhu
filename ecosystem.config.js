// PM2 (non-Docker VPS):  pm2 start ecosystem.config.js && pm2 save && pm2 startup
module.exports = { apps: [{ name: 'teslabondhu', script: 'server.js', node_args: '--no-warnings', env: { NODE_ENV: 'production' }, max_memory_restart: '300M' }] };
