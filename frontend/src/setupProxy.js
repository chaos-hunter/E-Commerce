const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    const backendProxy = process.env.BACKEND_PROXY || 'http://localhost:8080';

    app.use('/api', createProxyMiddleware({
        target: backendProxy,
        changeOrigin: true,
        // Keep backend route paths stable across middleware version differences.
        pathRewrite: (_path, req) => req.originalUrl
    }));
};
