// ======================================================
// VALIDATOR
// ======================================================

class Validator{

    check(plan){

        if(!plan)
            return false;

        if(!plan.steps)
            return false;

        return true;

    }

}

module.exports=new Validator();
