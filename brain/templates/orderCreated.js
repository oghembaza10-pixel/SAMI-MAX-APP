client: (d) => {
    const prenom = d.customer?.first_name || d.billing_address?.first_name || "";
    const total  = d.total_price || "0";
    const langue = getLangue(d);

    if (langue === "ar") return (
        `السلام عليكم ${prenom} 👋\n\n` +
        `شكراً على طلبك ! 🙏\n\n` +
        `💰 *المبلغ الإجمالي :* ${total} دج\n\n` +
        `هل تؤكد طلبك ؟\n\n` +
        `اكتب *نعم* للتأكيد ✅\n` +
        `اكتب *لا* للإلغاء ❌`
    );

    return (
        `Bonjour ${prenom} 👋\n\n` +
        `Merci pour votre commande ! 🙏\n\n` +
        `💰 *Total :* ${total} DZD\n\n` +
        `Répondez *OUI* pour confirmer ✅\n` +
        `Répondez *NON* pour annuler ❌`
    );
},

