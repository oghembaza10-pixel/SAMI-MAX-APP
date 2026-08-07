"use strict";


/*
    SAMII OS
    Application Core
*/


const SAMII_APP = {


    version: "1.0.0",



    init() {


        console.log(
            "🤖 SAMII OS START"
        );


        this.startBootSequence();


    },





    startBootSequence() {



        const status =
        document.querySelector(".samii-status");



        const steps = [


            "Chargement du noyau SAMII...",


            "Activation Intelligence...",


            "Synchronisation des modules...",


            "Système prêt."

        ];



        let index = 0;




        const boot = setInterval(() => {



            if(index < steps.length) {



                if(status) {

                    status.textContent =
                    steps[index];

                }


                index++;



            } else {



                clearInterval(boot);


                this.openHome();


            }



        },1000);



    },






    openHome() {



        console.log(
            "🚀 SAMII ONLINE"
        );



        if(window.SAMII_HOME) {


            window.SAMII_HOME.render();


        } else {


            console.error(
                "SAMII HOME NOT FOUND"
            );


        }



    }



};





window.addEventListener(
    "DOMContentLoaded",
    () => {


        SAMII_APP.init();


    }
);
