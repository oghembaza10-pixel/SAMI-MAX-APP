/* ==========================================================
   OG HUB V2
========================================================== */

let currentLang = localStorage.getItem("og-language") || "fr";

const METIERS = [

{
    mod:"particulier",
    icon:"user",
    title:{
        fr:"Particulier",
        en:"Personal",
        ar:"فرد"
    }
},

{
    mod:"entreprise",
    icon:"briefcase-business",
    title:{
        fr:"Entreprise",
        en:"Business",
        ar:"شركة"
    }
},

{
    mod:"ecommerce",
    icon:"shopping-cart",
    title:{
        fr:"E-commerce",
        en:"E-commerce",
        ar:"التجارة الإلكترونية"
    }
},

{
    mod:"restaurant",
    icon:"utensils-crossed",
    title:{
        fr:"Restaurant",
        en:"Restaurant",
        ar:"مطعم"
    }
},

{
    mod:"livreur",
    icon:"bike",
    title:{
        fr:"Livreur",
        en:"Delivery",
        ar:"توصيل"
    }
},

{
    mod:"voyage",
    icon:"plane",
    title:{
        fr:"Agence de voyage",
        en:"Travel Agency",
        ar:"وكالة سفر"
    }
},

{
    mod:"grossiste",
    icon:"package-open",
    title:{
        fr:"Grossiste",
        en:"Wholesale",
        ar:"تاجر جملة"
    }
},

{
    mod:"administration",
    icon:"landmark",
    title:{
        fr:"Administration",
        en:"Administration",
        ar:"إدارة"
    }
},

{
    mod:"garage",
    icon:"car-front",
    title:{
        fr:"Garage",
        en:"Garage",
        ar:"كراج"
    }
},

{
    mod:"immobilier",
    icon:"building-2",
    title:{
        fr:"Immobilier",
        en:"Real Estate",
        ar:"عقارات"
    }
},

{
    mod:"hotel",
    icon:"hotel",
    title:{
        fr:"Hôtel",
        en:"Hotel",
        ar:"فندق"
    }
},

{
    mod:"location",
    icon:"key-round",
    title:{
        fr:"Location",
        en:"Rental",
        ar:"تأجير"
    }
},

{
    mod:"marketing",
    icon:"megaphone",
    title:{
        fr:"Marketing",
        en:"Marketing",
        ar:"تسويق"
    }
},

{
    mod:"comptable",
    icon:"calculator",
    title:{
        fr:"Comptable",
        en:"Accounting",
        ar:"محاسبة"
    }
},

{
    mod:"avocat",
    icon:"scale",
    title:{
        fr:"Avocat",
        en:"Lawyer",
        ar:"محام"
    }
},

{
    mod:"sport",
    icon:"dumbbell",
    title:{
        fr:"Salle de sport",
        en:"Gym",
        ar:"نادي رياضي"
    }
},

{
    mod:"transport",
    icon:"truck",
    title:{
        fr:"Transport",
        en:"Transport",
        ar:"نقل"
    }
},

{
    mod:"ferme",
    icon:"tractor",
    title:{
        fr:"Ferme",
        en:"Farm",
        ar:"مزرعة"
    }
},

{
    mod:"formation",
    icon:"graduation-cap",
    title:{
        fr:"Formation",
        en:"Training",
        ar:"تكوين"
    }
},

{
    mod:"pharmacie",
    icon:"pill",
    title:{
        fr:"Pharmacie",
        en:"Pharmacy",
        ar:"صيدلية"
    }
},

{
    mod:"clinique",
    icon:"stethoscope",
    title:{
        fr:"Clinique",
        en:"Clinic",
        ar:"عيادة"
    }
},

{
    mod:"studio",
    icon:"palette",
    title:{
        fr:"Studio",
        en:"Studio",
        ar:"استوديو"
    }
},

{
    mod:"import-export",
    icon:"ship",
    title:{
        fr:"Import / Export",
        en:"Import / Export",
        ar:"استيراد وتصدير"
    }
},

{
    mod:"lavage",
    icon:"sparkles",
    title:{
        fr:"Lavage",
        en:"Car Wash",
        ar:"غسيل"
    }
};

const translations={

fr:{
title:"Bienvenue au Centre Commercial des QG",
subtitle:"Choisissez votre activité et lancez votre quartier général."
},

en:{
title:"Welcome to the HQ Mall",
subtitle:"Choose your activity and launch your headquarters."
},

ar:{
title:"مرحبًا بك في مركز المقرات",
subtitle:"اختر نشاطك وابدأ مقرّك الرئيسي."
}

};
function renderGrid(filter=""){

    const grid=document.getElementById("hub-grid");

    if(!grid) return;

    const recherche=filter.toLowerCase();

    const liste=METIERS.filter(m=>
        m.title[currentLang]
        .toLowerCase()
        .includes(recherche)
    );

    grid.innerHTML=liste.map(m=>`

        <article
            class="card"
            onclick="window.location.href='/qg/${m.mod}'">

            <div class="card-icon">

                <i data-lucide="${m.icon}"></i>

            </div>

            <h3>${m.title[currentLang]}</h3>

        </article>

    `).join("");

    if(window.lucide){

        lucide.createIcons({
            attrs:{
                "stroke-width":"1.8"
            }
        });

    }

    document.querySelectorAll(".card").forEach((card,index)=>{

        card.style.opacity="0";
        card.style.transform="translateY(25px)";

        setTimeout(()=>{

            card.style.transition=".35s ease";
            card.style.opacity="1";
            card.style.transform="translateY(0)";

        },index*35);

    });

}

document.addEventListener("DOMContentLoaded",()=>{

    const title=document.querySelector(".hero h1");
    const subtitle=document.querySelector(".hero p");

    function updateLanguage(lang){

        currentLang=lang;

        title.textContent=translations[lang].title;
        subtitle.textContent=translations[lang].subtitle;

        document.querySelectorAll(".language-switcher button")
        .forEach(b=>b.classList.remove("active"));

        document.querySelector(
            `.language-switcher button[data-lang="${lang}"]`
        )?.classList.add("active");

        localStorage.setItem("og-language",lang);

        renderGrid();

    }

    document
    .querySelectorAll(".language-switcher button")
    .forEach(button=>{

        button.addEventListener("click",()=>{

            updateLanguage(button.dataset.lang);

        });

    });

    const search=document.getElementById("search");

    if(search){

        search.addEventListener("input",e=>{

            renderGrid(e.target.value);

        });

    }

    updateLanguage(currentLang);

});
