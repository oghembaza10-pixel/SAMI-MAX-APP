class MistralService {

    async generate(prompt){

        return{
            success:true,
            provider:"Mistral",
            prompt,
            response:null
        };

    }

}

module.exports = new MistralService();
