/**
 * OG • Wallet Engine
 */

class WalletEngine {

    constructor() {
        this.wallets = [];
        this.transactions = [];
    }

    create(wallet) {
        this.wallets.push(wallet);
        return wallet;
    }

    transaction(data) {
        this.transactions.push(data);
        return data;
    }

    getWallets() {
        return this.wallets;
    }

    getTransactions() {
        return this.transactions;
    }

}

module.exports = new WalletEngine();
