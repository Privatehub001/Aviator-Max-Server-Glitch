const WebSocket = require('ws');
const database = require('./database');
const express = require('express');
const http = require('http');
const cors = require('cors');

const app = express();
const port = 8080;
const bodyParser = require('body-parser');


app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(require('./routes'))

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

let randomNumber = 1;
let animationState = {
    background: {
        tilePosition0: { x: 0 },
        tilePosition1: { x: 0 },
        tilePosition2: { x: 0 },
        tilePosition3: { x: 0 },
        tilePosition4: { x: 0 },
    },
    character: {
        position: { x: 0, y: 650 },
        prePosition: { x: 0, y: 650 },
    },
    count: 1,
    userCount: 0,
    wait: true,
    land: false,
    jump: false,
    run: true,
    progress: 0,
    roundId: uuidv4(),
};
let bets = [];
let betNextRound = [];
let currentNumber = 1;
let roundEnded = false;
let roundStarted = false;
let roundInterval;
let elapsedTime = 0;
let startTime;
let amount = 1;
let amountnext = 0;
let waitfor1 = 0;
let gamesPlayed = 0;
let specialGameNumber = 1.5;
const roundWaitDuration = 5000;

wss.on('connection', async socket => {
    animationState.userCount++;
    socket.send(JSON.stringify(animationState));
    broadcastState();
    const betHistory = await database.getBetHistory();
    const topMultipliers = await database.getTopMultipliers();
    const topWins = await database.getTopWins();
    socket.send(JSON.stringify({
        type: 'historyandtopmulti',
        history: betHistory,
        topmulti: topMultipliers,
        topwins: topWins,
    }));
    socket.on('message', async message => {
        const data = JSON.parse(message);
        if (data.type === 'bet') {
            await handleBet(data, socket);
        }
        else if (data.type === 'betNextRound') {
            handleNextBet(data, socket);
        }
        else if (data.type === 'handleBalance') {
            handleBalance(data, socket);
        }
        else if (data.type === 'getUser') {
            getUser(data, socket);
        }
        else if (data.type === 'cancelBet') {
            handleCancelBet(data, socket);
        }
        else if (data.type === 'cashout') {
            handleCashout(data, socket);
        }
        else if (data.type === 'changepassword') {
            handlePasswordChange(data, socket);
        }
        else if (data.type === 'cancelBetNext') {
            handleCancelNextBet(data, socket);
        }
        else if (data.type === 'signup') {
            await handleSignUp(data, socket);
        }
        else if (data.type === 'login') {
            await handleLogin(data, socket);
        }
        else if (data.type === 'checkData') {
            await checkData(data, socket);
        }
    });

    socket.on('close', () => {
        animationState.userCount--;
        broadcastState();
    });
    socket.on('error', console.error)
});

const handleCancelBet = (data, socket) => {
    const { user } = data;
    let bet = bets.filter(b => b.user === user);
    amount -= bet.bet;
    bets = bets.filter(b => b.user !== user);
    broadcastBets();
};

const handleCancelNextBet = (data, socket) => {
    const { user } = data;
    let bet = betNextRound.filter(b => b.user === user);
    amountnext -= bet.bet;
    betNextRound = betNextRound.filter(b => b.user !== user);
};

const handleNextBet = (data, socket) => {
    const { user, bet, multi, win } = data;
    if (betNextRound.length > 0) {
        const existingBet = betNextRound.find(b => b.user === user);
        amountnext += bet;
        if (existingBet) {
            existingBet.bet = bet;
            existingBet.multi = multi;
            existingBet.win = win;
        } else {
            betNextRound.push({ user, bet, multi, win });
        }
    }
    else {
        betNextRound.push({ user, bet, multi, win });
        amountnext += bet;
    }
};

const handleBet = async (data, socket) => {
    const { user, bet, multi, win, isSignedIn } = data;
    if (bets.length > 0) {
        const existingBet = bets.find(b => b.user === user);
        if (existingBet) {
            existingBet.bet = bet;
            existingBet.multi = multi;
            existingBet.win = win;
        } else {
            amount += bet;
            bets.push({ user, bet, multi, win });
        }
        if (win > 0 && isSignedIn) {
            await database.updateTopWins(user, win, multi, bet);
        }
    }
    else {
        amount += bet;
        bets.push({ user, bet, multi, win });
    }
    broadcastBets();
};

const reset = async () => {
    await database.insertBetHistory(animationState.count, animationState.roundId);
    await database.updateTopMultipliers(animationState.count, animationState.roundId);
    broadcstHistoryAndTopMulti(await database.getBetHistory(), await database.getTopMultipliers(), await database.getTopWins());
    animationState.background.tilePosition0.x = 0;
    animationState.background.tilePosition1.x = 0;
    animationState.background.tilePosition2.x = 0;
    animationState.background.tilePosition3.x = 0;
    animationState.background.tilePosition4.x = 0;
    animationState.character.position.x = 0;
    animationState.character.position.y = 650;
    animationState.count = 1;
    animationState.wait = true;
    animationState.jump = false;
    animationState.land = false;
    animationState.run = true;
    animationState.progress = 0;
    animationState.roundId = uuidv4();
    bets = betNextRound;
    betNextRound = [];
    dt = 0;
    amount = amountnext;
    amountnext = 0
    currentNumber = 1;
    randomNumber = 1;
    moveUpStarted = false;
    run = false;
    loop = false;
    roundEnded = false;
    roundStarted = false;
    elapsedTime = 0;
    startTime = 0;
    waitfor1 = 0;
}
const broadcastState = () => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(animationState));
        }
    });
};
const broadcastBets = () => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'betsUpdate',
                bets: bets
            }));
        }
    });
};
const broadcstHistoryAndTopMulti = (history, topmulti, topwins) => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'historyandtopmulti',
                history: history,
                topmulti: topmulti,
                topwins: topwins,
            }));
        }
    });
};

const broadcastNewRound = () => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'newRoundstarted'
            }));
        }
    });
};
const broadBetEnded = () => {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'betEnded'
            }));
        }
    });
};

const getRandomGameInterval = () => {
    return Math.floor((Math.random() * 100)/4);
};

const getRandomNumber = () => {
    if(gamesPlayed===0){
       randomNumber= Math.round((Math.random() * (1.05 - 1.00) + 1.00) * 100) / 100;
       console.log(randomNumber)
    }
    else if (amount > 0) {
        const baseMin = 1;
        const baseMax = 10;
        let p = Math.random();
        let amountFactor = Math.pow(amount / 10000, 0.1);
        let adjustedThreshold1 = 0.6;
        let adjustedThreshold2 = 0.8;
        let largeNumberThreshold = 0.9; 
        if (p < adjustedThreshold1) {
            p = Math.random();
            randomNumber = p < 0.9 ? 1 + Math.random() * 1.5 : 2 + Math.random() * 0.5;
        } else if (p < adjustedThreshold2) {
            p = Math.random();
            randomNumber = p < 0.5 ? 2 + Math.random() : 3 + Math.random();
        } else if (p > largeNumberThreshold) {
            p = Math.random();
            randomNumber = p < 0.5 ? 7 + Math.random() * 5 : 4 + Math.random() * 3; 
        } else {
            p = Math.random();
            randomNumber = p < 0.8 ? 1 + Math.random() * 1.5 : 4 + Math.random();
        }
    
        randomNumber = Math.max(Math.min(randomNumber * amountFactor, baseMax), baseMin);
    }    
    
    else {
        randomNumber = (Math.random() * 10) + 1
    }
};

const characterMovement = () => {
    broadcastState();
    elapsedTime = new Date() - startTime;
    if (elapsedTime <= 550) {
        animationState.character.position.x += 10;
    }
    else {
        if (elapsedTime < roundWaitDuration) {
            animationState.progress += 0.0025;
        }
        animationState.background.tilePosition0.x -= 0.2;
        animationState.background.tilePosition1.x -= 0.3;
        animationState.background.tilePosition2.x -= 0.6;
        animationState.background.tilePosition3.x -= 1.2;
        animationState.background.tilePosition4.x -= 6;
        if (elapsedTime > roundWaitDuration) {
            if (!roundStarted) {
                roundStarted = true;
                getRandomNumber();
            }
            animationState.wait = false;
            animationState.jump = true;
            animationState.land = false;
            animationState.run = false;
            if (randomNumber === 1) {
                waitfor1 += 1;
                if (waitfor1 >= 20) {
                    animationState.land = true;
                    animationState.jump = false;
                    if (!roundEnded) {
                        broadBetEnded();
                        roundEnded = true;
                        animationState.jump = false;
                        animationState.land = true;
                        animationState.run = false;
                        delayRoundStart();
                        return;
                    }
                }
            }
            let timeSinceStart = (elapsedTime - roundWaitDuration) / 1000;
            if (timeSinceStart <= 8) {
                animationState.count = 1 + ((timeSinceStart / 8) * (2 - 1));
            }
            else if (timeSinceStart > 8 && timeSinceStart <= 16) {
                animationState.count = 2 + (((timeSinceStart - 8) / 8) * (4 - 2));
            }
            else if (timeSinceStart > 16) {
                let extraTime = timeSinceStart - 16;
                animationState.count = 4 + (extraTime / 2);
            }
            if (animationState.count >= randomNumber) {
                animationState.count = randomNumber;
                animationState.jump = false;
                animationState.land = true;
                animationState.run = false;

                if (!roundEnded) {
                    broadBetEnded();
                    roundEnded = true;
                    delayRoundStart();
                    return;
                }
            }
        }
    }
};


const delayRoundStart = () => {
    clearInterval(roundInterval);
    const t = setInterval(() => {
        animationState.background.tilePosition0.x -= 0.2;
        animationState.background.tilePosition1.x -= 0.3;
        animationState.background.tilePosition2.x -= 0.6;
        animationState.background.tilePosition3.x -= 1.2;
        animationState.background.tilePosition4.x -= 6;
        broadcastState();
    }, 10);
    setTimeout(async () => {
        clearInterval(t);
        await reset();
        startRound();
    }, 500);
};

const startRound = () => {
    startTime = new Date();
    gamesPlayed++;
    if (gamesPlayed*1.5 >= specialGameNumber) {
        gamesPlayed = 0;
        specialGameNumber = getRandomGameInterval();
        console.log(specialGameNumber)
    }
    broadcastNewRound();
    broadcastBets();
    roundInterval = setInterval(characterMovement, 10);
};

const handlePasswordChange = async (data, socket) => {
    const { Phone, password } = data.data;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await database.updatePassword(Phone, hashedPassword);
        socket.send(JSON.stringify(user));
    } catch (error) {
        console.error('Sign-Up Error:', error);
        socket.send(JSON.stringify({ success: false, message: 'Failed to change password.' }));
    }
};

const handleSignUp = async (data, socket) => {
    const { userId, name, email, Phone, password, referrer, dob, gender, refid } = data.data;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await database.addUser(userId, name, email, Phone, hashedPassword, referrer, dob, gender, refid);
        socket.send(JSON.stringify(user));
    } catch (error) {
        console.error('Sign-Up Error:', error);
        socket.send(JSON.stringify({ success: false, message: 'Failed to register user' }));
    }
};
const checkData = async (data, socket) => {
    const { phone, email } = data.data;
    try {
        const user = await database.verifyCredentials(phone, email);
        socket.send(JSON.stringify(user));

    } catch (error) {
        console.error('Error:', error);
        socket.send(JSON.stringify({ success: false, message: 'An error has occured' }));
    }
};
const handleLogin = async (data, socket) => {
    const { phone, password } = data.data;
    try {
        const user = await database.verifyUserCredentials(phone, password);
        socket.send(JSON.stringify(user));

    } catch (error) {
        console.error('Login Error:', error);
        socket.send(JSON.stringify({ success: false, message: 'Login failed' }));
    }
};

const handleBalance = async (data, socket) => {
    const { userId, amount, add } = data.data;
    try {
        let user;
        if (add) {
            user = await database.updateUserBalanceAdd(userId, amount);
        }
        else {
            user = await database.updateUserBalanceSub(userId, amount);
        }
        socket.send(JSON.stringify(user));
    } catch (error) {
        console.error('Error:', error);
        socket.send(JSON.stringify({ success: false, message: 'Error Occured' }));
    }
};
const handleCashout = async (data, socket) => {
    const { userId, amount } = data.data;
    try {
        const user = await database.updateUserBalanceAdd(userId, amount);
        socket.send(JSON.stringify(user));
    } catch (error) {
        console.error('Error:', error);
        socket.send(JSON.stringify({ success: false, message: 'Error Occured' }));
    }
};

const getUser = async (data, socket) => {
    const { userId } = data.data;
    try {
        const user = await database.getUser(userId);
        socket.send(JSON.stringify(user));
    } catch (error) {
        console.error('Error:', error);
        socket.send(JSON.stringify({ success: false, message: 'Error Occured' }));
    }
};

startRound();

server.listen(port, () => {
    console.log(`Server is listening on ${port}`);
});

function triggerSpecialAnimation() {
    console.log(true)
}
