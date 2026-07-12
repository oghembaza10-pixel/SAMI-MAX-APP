const orchestrator=require("../brain/orchestrator");

async function orderCreated(order){

    await orchestrator.process({

        type:"shopify.order.created",

        payload:order

    });

}

module.exports={
    orderCreated
};
