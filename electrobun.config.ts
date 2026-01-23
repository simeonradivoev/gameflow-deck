export default {
    app: {
        name: "gameflow-deck",
        identifier: "simeonradivoev.gameflow-deck.app",
        version: "0.0.1",
    },
    build: {
        // Vite builds to dist/, we copy from there
        copy: {
            "dist/index.html": "views/mainview/index.html",
            "dist/assets": "views/mainview/assets",
        },
        mac: {
            bundleCEF: false,
        },
        linux: {
            bundleCEF: true,
        },
        win: {
            bundleCEF: false,
        },
    },
};