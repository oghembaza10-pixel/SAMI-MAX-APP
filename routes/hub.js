/* =======================================================
   OG HUB V2
   FREEZE FINAL
======================================================= */

document.addEventListener("DOMContentLoaded", () => {

    // -----------------------------
    // Lucide Icons
    // -----------------------------

    if (window.lucide) {
        lucide.createIcons();
    }

    // -----------------------------
    // Recherche métiers
    // -----------------------------

    const search = document.getElementById("search");

    if (search) {

        search.addEventListener("input", function () {

            const value = this.value.toLowerCase();

            document.querySelectorAll(".card").forEach(card => {

                const title = card.querySelector("h3").textContent.toLowerCase();

                if (title.includes(value)) {

                    card.style.display = "flex";

                } else {

                    card.style.display = "none";

                }

            });

        });

    }

    // -----------------------------
    // Ouverture QG
    // -----------------------------

    document.querySelectorAll(".card").forEach(card => {

        card.addEventListener("click", () => {

            const qg = card.querySelector("h3").textContent;

            console.log("Ouverture :", qg);

            /*
            Plus tard :

            window.location.href =
            "/qg/" + qg.toLowerCase().replace(/\s+/g,"-");

            */

        });

    });

    // -----------------------------
    // SAMII
    // -----------------------------

    const samii = document.querySelector(".samii-card");

    if (samii) {

        samii.addEventListener("click", () => {

            console.log("SAMII");

            // futur :
            // window.location.href="/samii";

        });

    }

});
