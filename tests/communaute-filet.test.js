// ==========================================================================
// UNE ERREUR DE SCRIPT NE DOIT PLUS ÊTRE MUETTE
// ==========================================================================
//
// Tout ce qu'on a cherché le 4 septembre avait la même forme : une erreur
// JavaScript qui tue un gestionnaire, ne laisse RIEN dans les journaux du
// serveur, et ne vit que dans la console du navigateur. Personne n'ouvre la
// console — donc « ça ne réagit pas », et des heures de recherche.
//
// Le cas exact vu à l'écran : le bouton « Vidéo » s'allumait, et rien ne
// se passait. Normal — la classe est posée AVANT la ligne qui lève. Un
// bouton actif sur une page morte, sans un mot d'explication.
//
// Le filet ne répare rien. Il rend la panne LISIBLE au lieu d'invisible.
// C'est la différence entre une heure de recherche et une capture d'écran.
//
// Ce test installe le vrai script, déclenche l'événement que le navigateur
// enverrait sur une erreur réelle, et vérifie que le message ARRIVE à
// l'écran — pas qu'il soit écrit dans le code.
const fs=require("fs"), vm=require("vm");
const src=fs.readFileSync("/home/user/SAMI-MAX-APP/routes/community.js","utf8").split("\n");
const d=src.findIndex(l=>l.trim()==="<script>"), f=src.findIndex((l,i)=>i>d&&l.trim()==="</script>");
let bloc=src.slice(d+1,f).join("\n");
for(let i=0;i<12;i++) bloc=bloc.replace(/\$\{[^{}]*\}/g,'"x"');

let vu=null; const ecouteurs={};
const faux=(id)=>({addEventListener(){}, classList:{add(){},remove(){},contains:()=>false,toggle(){}},
  style:{}, dataset:{}, value:"", files:[], innerHTML:"", focus(){}, click(){},
  set textContent(v){ if(id==="toast") vu=v; }, get textContent(){return "";},
  querySelectorAll:()=>[], querySelector:()=>null});
const box={
  document:{getElementById:(id)=>faux(id), querySelector:()=>null, querySelectorAll:()=>[],
            addEventListener(){}, createElement:()=>faux("x"), body:faux("b"), documentElement:faux("h")},
  localStorage:{getItem:()=>null,setItem(){}},
  navigator:{serviceWorker:{register:()=>Promise.resolve()},standalone:false,userAgent:"t"},
  console, setTimeout, clearTimeout, setInterval, clearInterval, FormData, Blob, URL,
  fetch: async()=>({json:async()=>({})}),
};
box.window={ addEventListener(ev,fn){ ecouteurs[ev]=fn; }, location:{href:""},
             matchMedia:()=>({matches:false,addEventListener(){}}),
             navigator:box.navigator, localStorage:box.localStorage };
box.globalThis=box;
vm.createContext(box);
vm.runInContext(bloc, box, {timeout:5000});

if(!ecouteurs.error){ console.log("❌ aucun filet global installé"); process.exit(1); }
// On simule ce que le navigateur enverrait sur une vraie erreur de script.
ecouteurs.error({ message:"Cannot read properties of null (reading 'accept')", filename:"/community", lineno:1536 });
console.log("Ce que le membre verrait :");
console.log("   « " + (vu||"(rien)") + " »");
const echecs=[];
if(!vu) echecs.push("aucun message n'atteint l'écran");
else{
    if(!/Cannot read properties of null/.test(vu)) echecs.push("le message réel de l'erreur est perdu");
    if(!/1536/.test(vu)) echecs.push("la ligne fautive n'est pas indiquée");
}
if(echecs.length){
    console.error("\n❌ communauté (filet) : " + echecs.length + " problème(s)");
    for(const e of echecs) console.error("   • " + e);
    process.exit(1);
}
console.log("\n✅ communauté (filet) : 2 vérifications passées");
process.exit(0);
