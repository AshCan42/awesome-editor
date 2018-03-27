var server = new Server({
    controllers: "./app/controllers",
    middleware: "./app/middleware",
    autoStart: false,
    debug: console.log,
    cluster: 4
});
server.use(require('cookie-parser'));
server.start();