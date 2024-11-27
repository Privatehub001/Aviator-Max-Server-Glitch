const database = require('../database');
const storeData = async (req, res) => {
    const {userId, gameId, stakeAmount, multiplier, result, coin} = req.body;
    const rsp = await database.insertUserBet(userId, gameId, stakeAmount, multiplier, result, coin);
    res.json(rsp);
};

const getData =  async (req, res) => {
    const userId =req.query.userId;
    const rsp  = await database.getUserBets(userId);
    res.json(rsp);
};
module.exports ={storeData,getData};