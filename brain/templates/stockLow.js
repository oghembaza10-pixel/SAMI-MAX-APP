// brain/templates/stockLow.js
module.exports = {
    marchand: (d) => `⚠️ Stock bas !\n📦 ${d.product}\n🔢 Reste : ${d.quantity}`,
};
