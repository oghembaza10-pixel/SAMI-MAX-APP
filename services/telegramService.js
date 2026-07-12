const orchestrator=require("../brain/orchestrator");

async function message(msg){

    await orchestrator.process({

        type:"telegram.message",

        payload:msg

    });

}

module.exports={
    message
};
