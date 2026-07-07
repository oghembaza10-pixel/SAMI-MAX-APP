class NvidiaService {

    async generate(prompt){

        return{
            success:true,
            provider:"NVIDIA",
            prompt,
            response:null
        };

    }

}

module.exports = new NvidiaService();
