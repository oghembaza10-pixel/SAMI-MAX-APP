"use strict";


const CACHE_NAME = "samii-os-v1";


const APP_FILES = [

    "./",

    "./index.html",

    "./manifest.json",

    "./src/app.js",

    "./src/styles/app.css"

];



/*
    INSTALLATION
*/

self.addEventListener(
    "install",
    event => {


        event.waitUntil(

            caches.open(CACHE_NAME)

            .then(cache => {

                return cache.addAll(APP_FILES);

            })

        );


        self.skipWaiting();


    }
);





/*
    ACTIVATION
*/

self.addEventListener(
    "activate",
    event => {


        event.waitUntil(

            caches.keys()

            .then(keys => {


                return Promise.all(

                    keys.map(key => {


                        if(key !== CACHE_NAME) {


                            return caches.delete(key);


                        }


                    })

                );


            })

        );


        self.clients.claim();


    }
);





/*
    FETCH SYSTEM
*/

self.addEventListener(
    "fetch",
    event => {


        event.respondWith(

            caches.match(event.request)

            .then(response => {


                return response || fetch(event.request);


            })

        );


    }
);
