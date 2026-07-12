const orchestrator=require("../brain/orchestrator");

async function instagram(msg){

    await orchestrator.process({

        type:"instagram.message",

        payload:msg

    });

}

async function messenger(msg){

    await orchestrator.process({

        type:"messenger.message",

        payload:msg

    });

}

module.exports={
    instagram,
    messenger
};
