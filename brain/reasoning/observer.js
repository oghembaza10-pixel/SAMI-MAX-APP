// ======================================================
// OBSERVER
// ======================================================

class Observer {

    snapshot(context){

        return{

            time:new Date(),

            user:context.user,

            grade:context.grade,

            language:context.language

        };

    }

}

module.exports=new Observer();
