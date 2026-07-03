const METIERS = [

{
title:{fr:"Particulier",en:"Individual",ar:"فرد"},
icon:"user",
mod:"particulier"
},

{
title:{fr:"Entreprise",en:"Business",ar:"شركة"},
icon:"briefcase-business",
mod:"entreprise"
},

{
title:{fr:"E-commerce",en:"E-commerce",ar:"التجارة الإلكترونية"},
icon:"shopping-bag",
mod:"ecommerce"
},

{
title:{fr:"Restaurant",en:"Restaurant",ar:"مطعم"},
icon:"utensils-crossed",
mod:"restaurant"
},

{
title:{fr:"Livreur",en:"Delivery",ar:"توصيل"},
icon:"bike",
mod:"livreur"
},

{
title:{fr:"Agence de voyage",en:"Travel Agency",ar:"وكالة سفر"},
icon:"plane",
mod:"voyage"
},

{
title:{fr:"Grossiste",en:"Wholesaler",ar:"تاجر جملة"},
icon:"warehouse",
mod:"grossiste"
},

{
title:{fr:"Administration",en:"Administration",ar:"إدارة"},
icon:"landmark",
mod:"administration"
},

{
title:{fr:"Garage",en:"Garage",ar:"مرآب"},
icon:"wrench",
mod:"garage"
},

{
title:{fr:"Immobilier",en:"Real Estate",ar:"عقارات"},
icon:"building-2",
mod:"immobilier"
},

{
title:{fr:"Hôtel",en:"Hotel",ar:"فندق"},
icon:"hotel",
mod:"hotel"
},

{
title:{fr:"Location",en:"Rental",ar:"تأجير"},
icon:"car-front",
mod:"location"
},

{
title:{fr:"Marketing",en:"Marketing",ar:"تسويق"},
icon:"megaphone",
mod:"marketing"
},

{
title:{fr:"Comptable",en:"Accounting",ar:"محاسبة"},
icon:"calculator",
mod:"comptable"
},

{
title:{fr:"Avocat",en:"Lawyer",ar:"محامي"},
icon:"scale",
mod:"avocat"
},

{
title:{fr:"Salle de sport",en:"Gym",ar:"قاعة رياضة"},
icon:"dumbbell",
mod:"sport"
},

{
title:{fr:"Transport",en:"Transport",ar:"نقل"},
icon:"truck",
mod:"transport"
},

{
title:{fr:"Ferme",en:"Farm",ar:"مزرعة"},
icon:"sprout",
mod:"ferme"
},

{
title:{fr:"Formation",en:"Training",ar:"تدريب"},
icon:"graduation-cap",
mod:"formation"
},

{
title:{fr:"Pharmacie",en:"Pharmacy",ar:"صيدلية"},
icon:"pill",
mod:"pharmacie"
},

{
title:{fr:"Clinique",en:"Clinic",ar:"عيادة"},
icon:"heart-pulse",
mod:"clinique"
},

{
title:{fr:"Studio",en:"Studio",ar:"استوديو"},
icon:"palette",
mod:"studio"
},

{
title:{fr:"Import / Export",en:"Import / Export",ar:"استيراد وتصدير"},
icon:"ship",
mod:"import-export"
},

{
title:{fr:"Lavage",en:"Car Wash",ar:"غسيل"},
icon:"droplets",
mod:"lavage"
}

];

let currentLang="fr";
function renderGrid(filter = "") {

    const grid = document.getElementById("hub-grid");
    if(!grid) return;

    const recherche = filter.toLowerCase();

    const liste = METIERS.filter(m =>
        m.title[currentLang].toLowerCase().includes(recherche)
    );

    grid.innerHTML = liste.map(m=>`

        <article class="card"
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
                "stroke-width":1.8
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
const translations={

fr:{

title:"Bienvenue au Centre Commercial des QG",
subtitle:"Choisissez votre activité et lancez votre quartier général.",

samiiBadge:"IA OPÉRATIONNELLE",
samiiText:"Votre IA opérationnelle.<br><br>Tous vos outils.<br>Un seul QG.",
go:"GO →",

communityTitle:"Votre métier n'existe pas encore ?",
communityText:"Construisons le plus grand Centre Commercial des QG. Proposez votre métier et il pourra être ajouté dans une prochaine mise à jour de OG.",
communityButton:"Proposer un métier",

hub:"Hub",
profile:"Profil",
academy:"Académie",
marketplace:"Marketplace",
settings:"Paramètres",
contact:"Nous contacter",

logo:"Centre Commercial des QG"

},

en:{

title:"Welcome to the HQ Mall",
subtitle:"Choose your activity and launch your headquarters.",

samiiBadge:"OPERATIONAL AI",
samiiText:"Your operational AI.<br><br>All your tools.<br>One HQ.",
go:"GO →",

communityTitle:"Your profession is missing?",
communityText:"Help us build the world's largest HQ Mall. Suggest your profession for a future OG update.",
communityButton:"Suggest a profession",

hub:"Hub",
profile:"Profile",
academy:"Academy",
marketplace:"Marketplace",
settings:"Settings",
contact:"Contact us",

logo:"HQ Mall"

},

ar:{

title:"مرحبًا بك في مركز المقرات",
subtitle:"اختر نشاطك وابدأ مقرّك الرئيسي.",

samiiBadge:"الذكاء الاصطناعي التشغيلي",
samiiText:"مساعدك الذكي.<br><br>كل أدواتك.<br>في مقر واحد.",
go:"دخول",

communityTitle:"مهنتك غير موجودة؟",
communityText:"ساعدنا في بناء أكبر مركز للمقرات. اقترح مهنتك وسيتم إضافتها في تحديث قادم.",
communityButton:"اقتراح مهنة",

hub:"المركز",
profile:"الملف الشخصي",
academy:"الأكاديمية",
marketplace:"المتجر",
settings:"الإعدادات",
contact:"اتصل بنا",

logo:"مركز المقرات"

}

};
function applyLanguage(lang){

    currentLang = lang;

    const t = translations[lang];

    document.querySelector(".hero h1").textContent = t.title;
    document.querySelector(".hero p").textContent = t.subtitle;

    document.querySelector(".badge").textContent = t.samiiBadge;
    document.querySelector(".samii-text").innerHTML = t.samiiText;
    document.querySelector(".go-button").textContent = t.go;

    document.querySelector(".community-card h3").textContent = t.communityTitle;
    document.querySelector(".community-card p").textContent = t.communityText;
    document.querySelector(".community-card button").innerHTML =
        `<i data-lucide="plus-circle"></i> ${t.communityButton}`;

    document.querySelector(".logo-subtitle").textContent = t.logo;

    document.querySelector(".menu-hub").textContent = t.hub;
    document.querySelector(".menu-profile").textContent = t.profile;
    document.querySelector(".menu-academy").textContent = t.academy;
    document.querySelector(".menu-marketplace").textContent = t.marketplace;
    document.querySelector(".menu-settings").textContent = t.settings;
document.querySelector(".menu-contact").textContent = t.contact;
    renderGrid();

    if(window.lucide){
        lucide.createIcons({
            attrs:{
                "stroke-width":1.8
            }
        });
    }

    localStorage.setItem("og-lang",lang);

}

document.querySelectorAll(".language-switcher button").forEach(button=>{

    button.addEventListener("click",()=>{

        document.querySelectorAll(".language-switcher button")
        .forEach(b=>b.classList.remove("active"));

        button.classList.add("active");

        applyLanguage(button.dataset.lang);

    });

});

document.addEventListener("DOMContentLoaded",()=>{

    const saved = localStorage.getItem("og-lang") || "fr";

    const btn = document.querySelector(
        `.language-switcher button[data-lang="${saved}"]`
    );

    if(btn){
        btn.click();
    }else{
        applyLanguage("fr");
    }

    const search = document.getElementById("search");

    if(search){

        search.addEventListener("input",e=>{

            renderGrid(e.target.value);

        });

    }

});
