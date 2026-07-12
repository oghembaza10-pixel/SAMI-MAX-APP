const airtable=require("../airtable");

async function newOrder(event){

    const order=event.payload;

    console.log("Nouvelle commande :",order.id);

    await airtable.createCommande({

        id:order.id,

        client:order.customer?.first_name,

        total:order.total_price,

        statut:order.financial_status,

        boutique:order.shop_domain

    });

}

module.exports={
    newOrder
};
