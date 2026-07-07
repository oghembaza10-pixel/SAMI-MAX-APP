class ZRService {

    async createShipment(order){

        return {
            success:true,
            order
        };

    }

}

module.exports = new ZRService();
