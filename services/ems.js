class EMSService {

    async createShipment(order){

        return {
            success:true,
            order
        };

    }

}

module.exports = new EMSService();
