class OllamaService {

    async generate(prompt){

        return{
            success:true,
            provider:"Ollama",
            prompt,
            response:null
        };

    }

}

module.exports = new OllamaService();
