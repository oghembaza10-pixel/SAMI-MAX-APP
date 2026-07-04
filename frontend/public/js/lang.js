const translations = {
    fr: { headline: "Tout le monde a son QG.", "btn-create": "Créer mon QG", "sub-text": "Le jeu commence ici." },
    en: { headline: "Everyone has their HQ.", "btn-create": "Create my HQ", "sub-text": "The game starts here." },
    ar: { headline: "الجميع لديهم مقرهم الخاص.", "btn-create": "إنشاء مقري", "sub-text": "تبدأ اللعبة من هنا." },
    zh: { headline: "每个人都有自己的总部。", "btn-create": "创建我的总部", "sub-text": "游戏从这里开始。" }
};

function autoSetLanguage() {
    const navLang = navigator.language || navigator.userLanguage;
    const langCode = navLang.split('-')[0];
    const finalLang = translations[langCode] ? langCode : 'en';

    document.documentElement.lang = finalLang;
    if(finalLang === 'ar') document.body.classList.add('rtl');
    else document.body.classList.remove('rtl');
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = translations[finalLang][key];
    });
}

window.onload = autoSetLanguage;
