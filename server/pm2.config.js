module.exports = {
  apps: [
    {
      name: 'bookclub-api',
      script: 'dist/server.js',
      cwd: '.',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
    },
  ],
};
