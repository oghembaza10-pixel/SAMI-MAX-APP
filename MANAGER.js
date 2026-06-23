const express = require('express');
const app = express();
const dispatcher = require('./dispatcher');

app.use(express.json());

app.post('/webhook/order', async (req, res) => {
    try {
        await dispatcher.processOrder(req.body);
        res.status(200).send('OK');
    } catch (error) {
        res.status(500).send('Erreur');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('SAMI-OS Live.'));
