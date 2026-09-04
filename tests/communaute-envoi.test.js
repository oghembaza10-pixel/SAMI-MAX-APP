// ==========================================================================
// L'ENVOI D'UN FICHIER DOIT DIRE POURQUOI IL A ÉCHOUÉ
// ==========================================================================
//
// Le fichier ne passe JAMAIS par notre serveur : le navigateur l'envoie
// directement à Cloudinary, et le serveur ne reçoit que l'URL, à la fin.
// Quand un envoi échoue, il n'y a donc RIEN dans les journaux de Render.
//
// Or le code affichait « Échec de l'envoi. » et jetait le message de
// Cloudinary — qui explique pourtant toujours pourquoi il refuse. La panne
// était donc invisible des deux côtés : le membre ne savait pas quoi
// corriger, et nous n'avions rien à lire.
//
// Vérifié le 4 septembre depuis le serveur : le compte et le préréglage
// acceptent bien image ET vidéo. Ce qui échouait n'était pas la
// configuration — et sans ce message, impossible de savoir quoi.
//
// Ce test CAPTURE le vrai gestionnaire du fichier livré et le DÉCLENCHE
// avec un refus de Cloudinary. Lire le code aurait dit que le message est
// écrit, pas qu'il arrive à l'écran.
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync("/home/user/SAMI-MAX-APP/routes/community.js","utf8").split("\n");
const d = src.findIndex(l=>l.trim()==="<script>"), f = src.findIndex((l,i)=>i>d && l.trim()==="</script>");
let bloc = src.slice(d+1,f).join("\n");
for(let i=0;i<12;i++) bloc = bloc.replace(/\$\{[^{}]*\}/g,'"x"');

const ecran = {};                      // ce que le membre voit
let handler = null;
const faux = (id) => ({
    addEventListener(ev,fn){ if(id==="fileInput"&&ev==="change") handler=fn; },
    classList:{add(){},remove(){},contains:()=>false,toggle(){}},
    style:{}, dataset:{}, value:"", files:[],
    set textContent(v){ ecran[id]=v; }, get textContent(){ return ecran[id]||""; },
    innerHTML:"", querySelectorAll:()=>[], querySelector:()=>null, focus(){}, click(){},
});
const box = {
    document:{ getElementById:(id)=>faux(id), querySelector:()=>null, querySelectorAll:()=>[],
               addEventListener(){}, createElement:()=>faux("x"), body:faux("b"), documentElement:faux("h") },
    localStorage:{getItem:()=>null,setItem(){}},
    navigator:{serviceWorker:{register:()=>Promise.resolve()},standalone:false,userAgent:"t"},
    console, setTimeout, clearTimeout, setInterval, clearInterval, FormData, Blob, URL,
    fetch: async () => ({ json: async () => ({ error: { message: "File size too large. Got 34567890. Maximum is 10485760" } }) }),
};
box.window = { addEventListener(){}, location:{href:""}, matchMedia:()=>({matches:false,addEventListener(){}}), navigator:box.navigator, localStorage:box.localStorage };
box.globalThis = box;
vm.createContext(box);
vm.runInContext(bloc, box, {timeout:5000});

if(!handler){ console.log("❌ gestionnaire d'envoi introuvable"); process.exit(1); }
const fichier = { name:"ma-video.mp4", type:"video/mp4", size: 34567890 };   // 33 Mo
handler.call({ files:[fichier] }).then(()=>{
    console.log("Message affiché au membre :");
    console.log("   « " + (ecran.uploadStatus||"(rien)") + " »");
    const vu = ecran.uploadStatus || "";
    const echecs = [];
    // La raison exacte, mot pour mot, telle que Cloudinary l'a donnée.
    if (!/Maximum is 10485760/.test(vu)) echecs.push("la raison de Cloudinary n'est pas affichée");
    // Le poids du fichier : « trop gros » sans le chiffre ne dit pas quoi faire.
    if (!/Mo/.test(vu)) echecs.push("le poids du fichier n'est pas affiché");
    // Et surtout : plus jamais le message creux d'avant.
    if (/^❌ Échec de l'envoi\.?$/.test(vu)) echecs.push("le message générique est revenu");

    if (echecs.length) {
        console.error("\n❌ communauté (envoi) : " + echecs.length + " problème(s)");
        for (const e of echecs) console.error("   • " + e);
        console.error("   message affiché : « " + vu + " »\n");
        process.exit(1);
    }
    console.log("\n✅ communauté (envoi) : 3 vérifications passées");
    process.exit(0);
});
