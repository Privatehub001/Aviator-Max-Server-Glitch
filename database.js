const { Pool } = require('pg');
const postgres = require('postgres');
const bcrypt = require('bcrypt');
require('dotenv').config();

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD, ENDPOINT_ID, DBPORT} = process.env;
PGPASSWORD = decodeURIComponent(PGPASSWORD);
const sql = postgres({
    host: PGHOST,
    database: PGDATABASE,
    username: PGUSER,
    password: PGPASSWORD,
    port: DBPORT,
    ssl: 'require',
    
});

createTable();

async function createTable() {
    await sql`CREATE TABLE IF NOT EXISTS bet_history (
        id SERIAL PRIMARY KEY,
        round_id TEXT,
        multiplier REAL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`;

    await sql`CREATE TABLE IF NOT EXISTS top_multipliers (
        id SERIAL PRIMARY KEY,
        multiplier REAL,
        round_id TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`;

    await sql`CREATE TABLE IF NOT EXISTS top_wins (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        win REAL,
        multiplier REAL,
        bet REAL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`;

    await sql`CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE NOT NULL,
        phone TEXT UNIQUE,
        password TEXT NOT NULL,
        referrer TEXT,
        referral_id TEXT UNIQUE,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        balance REAL DEFAULT 0.0,
        withdrawal_balance REAL DEFAULT 0,
        hold_amount REAL DEFAULT 0,
        referral_balance REAL DEFAULT 0,
        wallet_balance REAL DEFAULT 0,
        level1_referrals INTEGER DEFAULT 0,
        level2_referrals INTEGER DEFAULT 0,
        level3_referrals INTEGER DEFAULT 0,
        level1_earnings REAL DEFAULT 0.0,
        level2_earnings REAL DEFAULT 0.0,
        level3_earnings REAL DEFAULT 0.0,
        dob TEXT,
        gender TEXT,
        txid TEXT
    )`;

    await sql`CREATE TABLE IF NOT EXISTS user_bets (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        game_id TEXT NOT NULL,
        stake_amount REAL NOT NULL,
        multiplier REAL NOT NULL,
        result TEXT,
        coin TEXT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`;

    await sql`CREATE TABLE IF NOT EXISTS user_transactions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        transaction_Id TEXT NOT NULL,
        deposit TEXT,
        withdraw TEXT,
        account TEXT,
        ifsc_code TEXT,
        status TEXT,
        balance REAL NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`;

    await sql`CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id TEXT,
        referred_id TEXT,
        level INTEGER,
        earned_amount REAL DEFAULT 0.0,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`;
}

const storeTransaction = async (transactionData) => {
    const { user_id, transaction_Id, deposit, withdraw, balance,ifsc_code,account,status } = transactionData;

    try {
        const result = await sql
            `INSERT INTO user_transactions (user_id, transaction_Id, deposit, withdraw, balance,ifsc_code,account,status)
        VALUES (${user_id}, ${transaction_Id}, ${deposit}, ${withdraw}, ${balance},${ifsc_code},${account},${status}) RETURNING *`;
        return { success: true, transaction: result };
    } catch (error) {
        console.error('Error storing transaction:', error);
        return { success: false, message: 'Failed to store transaction' };
    }
};

const getTransactions = async (userId) => {
    try {
        const result = await sql
            `SELECT * FROM user_transactions WHERE user_id =${userId} ORDER BY timestamp DESC`;
        return { success: true, transactions: result };
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return { success: false, message: 'Failed to fetch transactions' };
    }
};

const addUser = async (userId, name, email, phone, hashedPassword, referrer, dob, gender,referralId) => {
    try {
        const result = await sql`
            INSERT INTO users (userId, name, email, phone, password, referrer, referral_id, dob, gender)
            VALUES (${userId}, ${name}, ${email}, ${phone}, ${hashedPassword}, ${referrer}, ${referralId}, ${dob}, ${gender})
            RETURNING userId`;

        if (referrer) {
            await trackReferral(referrer, userId, 1); // Track level 1
            const referrerUser = await getUserByReferralId(referrer);
            if (referrerUser.success && referrerUser.user.referrer) {
                await trackReferral(referrerUser.user.referrer, userId, 2); // Track level 2
                const referrerUser2 = await getUserByReferralId(referrerUser.user.referrer);
                if (referrerUser2.success && referrerUser2.user.referrer) {
                    await trackReferral(referrerUser2.user.referrer, userId, 3); // Track level 3
                }
            }
        }

        return { success: true, userId: result[0].userid, message: "User added successfully." };
    } catch (error) {
        console.log(error)
        if (error.message.includes('duplicate key value violates unique constraint')) {
            return { success: false, message: "Email or phone already exists." };
        }
        console.error("Error adding user:", error);
        return { success: false, message: "An error occurred while adding the user." };
    }
};



const verifyUserCredentials = async (phone, password) => {
    try {
        const result = await sql`
            SELECT * FROM users WHERE phone = ${phone} or email = ${phone}`;
        if (result.length > 0) {
            const user = result[0];
            const isValid = await bcrypt.compare(password, user.password);
            if (isValid) {
                const { password, ...userData } = user;
                return { success: true, user: userData };
            } else {
                return { success: false, message: "Incorrect password" };
            }
        } else {
            return { success: false, message: "User not found" };
        }
    } catch (error) {
        console.error("Error verifying user credentials:", error);
        throw error;
    }
};

const getUser = async (userId) => {
    try {
        const result = await sql`
            SELECT * FROM users WHERE userId = ${userId}`;
        if (result.length > 0) {
            const user = result[0];
            return { success: true, user: user };
        } else {
            return { success: false, message: "User not found" };
        }
    } catch (error) {
        console.error("Error:", error);
        throw error;
    }
};

const verifyCredentials = async (phone, email) => {
    try {
        const result = await sql`
            SELECT * FROM users WHERE phone = ${phone} or email = ${email}`;
        if (result.length > 0) {
            const user = result[0];
            return { success: false, message: "Phone or Email already registered." };
        } else {
            return { success: true, message: "Continue" };
        }
    } catch (error) {
        console.error("Error", error);
        throw error;
    }
};

const insertBetHistory = async (multi, roundId) => {
    await sql`INSERT INTO bet_history (round_id, multiplier) VALUES (${roundId}, ${multi})`;
    await sql`DELETE FROM bet_history WHERE id NOT IN (SELECT id FROM bet_history ORDER BY timestamp DESC LIMIT 30)`;
};

const updateTopWins = async (user, win, multi, bet) => {
    await sql`INSERT INTO top_wins (user_id, win, multiplier, bet) VALUES (${user}, ${win}, ${multi}, ${bet})`;
    await sql`DELETE FROM top_wins WHERE id NOT IN (SELECT id FROM top_wins ORDER BY win DESC LIMIT 15)`;

};

const updateTopMultipliers = async (multi, roundId) => {
    await sql`INSERT INTO top_multipliers (multiplier, round_id) VALUES (${multi}, ${roundId})`;
    await sql`DELETE FROM top_multipliers WHERE id NOT IN (SELECT id FROM top_multipliers ORDER BY multiplier DESC LIMIT 25)`;

};

const updateUserBalanceAdd = async (userId, amount) => {
    try {
        const result = await sql`
            UPDATE users
            SET balance = balance + ${amount},withdrawal_balance =withdrawal_balance+${amount}
            WHERE userId = ${userId}
            RETURNING balance;`;
        return { success: true, newBalance: result[0].balance };
    } catch (error) {
        console.error("Error updating user balance:", error);
        return { success: false, message: "Failed to update balance" };
    }
};

const updatebalance = async (userId, txid, amount) => {
    try {
        const result = await sql`
            UPDATE users
            SET txid = ${txid}, balance = balance + ${amount} ,wallet_balance =wallet_balance+${amount} ,withdrawal_balance =withdrawal_balance+${amount}
            WHERE userId LIKE ${userId + '%'} AND (txid IS NULL OR txid < ${txid})
            RETURNING balance,userId;`;
        return { success: true, newBalance: result[0].balance,userId:result[0].userid};
    } catch (error) {
        console.error("Error updating user balance:", error);
        return { success: false, message: "Failed to update balance" };
    }
};



const updatePassword = async (phone, password) => {
    try {
        const result = await sql`
            UPDATE users
            SET password = ${password}
            WHERE phone = ${phone} RETURNING userId`;
        return { success: true, userId: result[0].userid, message: 'Password Chnaged.' };
    } catch (error) {
        console.error("Error updating user balance:", error);
        return { success: false, message: "Failed to update password" };
    }
};

const updateUserBalanceSub = async (userId, amount) => {
    amount = parseFloat(amount);
    try {
        const result = await sql`
            UPDATE users
            SET balance = balance - ${amount},withdrawal_balance =withdrawal_balance-${amount}
            WHERE userId = ${userId} AND balance >= ${amount}
            RETURNING balance;`;
        return { success: true, newBalance: result[0].balance };
    } catch (error) {
        console.error("Error updating user balance:", error);
        return { success: false, message: "Failed to update balance" };
    }
};

const withdrawBalanceSub = async (userId, amount) => {
    amount = parseFloat(amount);
    try {
        const result = await sql`
            UPDATE users
            SET balance = balance - ${amount},withdrawal_balance =withdrawal_balance-${amount}
            WHERE userId LIKE ${userId + '%'} AND withdrawal_balance >= ${amount}
            RETURNING balance;`;
        return { success: true, newBalance: result[0].balance };
    } catch (error) {
        console.error("Error updating user balance:", error);
        return { success: false, message: "Failed to update balance" };
    }
};
const withdrawBalanceAdd = async (userId, amount) => {
    amount = parseFloat(amount);
    try {
        const result = await sql`
            UPDATE users
            SET balance = balance + ${amount},withdrawal_balance =withdrawal_balance+${amount}
            WHERE userId LIKE ${userId + '%'} 
            RETURNING balance;`;
        return { success: true, newBalance: result[0].balance };
    } catch (error) {
        console.error("Error updating user balance:", error);
        return { success: false, message: "Failed to update balance" };
    }
};
const holdBalanceSub = async (userId, amount) => {
    amount = parseFloat(amount);
    try {
        const result = await sql`
            UPDATE users
            SET hold_amount = hold_amount - ${amount}
            WHERE userId LIKE ${userId + '%'} AND hold_amount >= ${amount}
            RETURNING balance;`;
        return { success: true, newBalance: result[0].balance };
    } catch (error) {
        console.error("Error updating user balance:", error);
        return { success: false, message: "Failed to update balance" };
    }
};
const holdBalanceAdd = async (userId, amount) => {
    amount = parseFloat(amount);
    try {
        const result = await sql`
            UPDATE users
            SET hold_amount = hold_amount + ${amount}
            WHERE userId LIKE ${userId + '%'} 
            RETURNING balance;`;
        return { success: true, newBalance: result[0].balance };
    } catch (error) {
        console.error("Error updating user balance:", error);
        return { success: false, message: "Failed to update balance" };
    }
};
const transferCommission = async (userId, depositAmount) => {
    try {
        const user = await getUser(userId);
        if (user.success && user.user.referrer) {
            const referrerId = user.user.referrer;
            const referrerCommission0 = depositAmount * 0.5;
            const referrerCommission1 = depositAmount * 0.10;
            const referrerReferrerCommission2 = depositAmount * 0.04;

            // Level 1
            await updateReferralEarnings(referrerId, userId, 1, referrerCommission0);

            const referrerUser = await getUserByReferralId(referrerId);
            if (referrerUser.success && referrerUser.user.referrer) {
                const referrersReferrerId = referrerUser.user.referrer;

                // Level 2
                await updateReferralEarnings(referrersReferrerId, userId, 2, referrerCommission1);

                const referrersReferrer = await getUserByReferralId(referrersReferrerId);
                if (referrersReferrer.success && referrersReferrer.user.referrer) {
                    const referrersReferrerreferrerId = referrersReferrer.user.referrer;

                    // Level 3
                    await updateReferralEarnings(referrersReferrerreferrerId, userId, 3, referrerReferrerCommission2);
                }
            }
        }

        const user_ = await getUser(userId);
        return { success: true, message: "Successful Deposit", newBalance: user_.user.balance };
    } catch (error) {
        console.error("Error during:", error);
        return { success: false, message: "Failed to process" };
    }
};


const getUserByReferralId = async (referralId) => {
    try {
        const result = await sql`
            SELECT * FROM users WHERE referral_id = ${referralId}`;
        if (result.length > 0) {
            const user = result[0];
            return { success: true, user: user };
        } else {
            return { success: false, message: "User not found" };
        }
    } catch (error) {
        console.error("Error:", error);
        throw error;
    }
};

const updateReferralEarnings = async (referrerId, referredId, level, earnedAmount) => {
    await sql`
        UPDATE referrals
        SET earned_amount = earned_amount + ${earnedAmount}
        WHERE referrer_id = ${referrerId} AND referred_id = ${referredId} AND level = ${level}`;

    const levelField = level === 1 ? 'level1_earnings' : level === 2 ? 'level2_earnings' : 'level3_earnings';
    await sql`
        UPDATE users
        SET ${sql(levelField)} = ${sql(levelField)} + ${earnedAmount},withdrawal_balance =withdrawal_balance+${earnedAmount},
        balance =balance+${earnedAmount},
        referral_balance =referral_balance+${earnedAmount}
        WHERE referral_id = ${referrerId}`;
};

const trackReferral = async (referrerId, referredId, level) => {
    await sql`
        INSERT INTO referrals (referrer_id, referred_id, level)
        VALUES (${referrerId}, ${referredId}, ${level})`;

    const levelField = level === 1 ? 'level1_referrals' : level === 2 ? 'level2_referrals' : 'level3_referrals';
    await sql`
        UPDATE users
        SET ${sql(levelField)} = ${sql(levelField)} + 1
        WHERE referral_id = ${referrerId}`;
};



const getBetHistory = async () => {
    return await sql`SELECT * FROM bet_history ORDER BY id DESC LIMIT 15`;
};

const getTopMultipliers = async () => {
    return await sql`SELECT * FROM top_multipliers ORDER BY multiplier DESC`;
};

const getTopWins = async () => {
    return await sql`SELECT * FROM top_wins ORDER BY win DESC LIMIT 15`;
};

const insertUserBet = async (userId, gameId, stakeAmount, multiplier, result, coin) => {
    try {
        await sql`
            INSERT INTO user_bets (user_id, game_id, stake_amount, multiplier, result, coin)
            VALUES (${userId}, ${gameId}, ${stakeAmount}, ${multiplier}, ${result}, ${coin})`;
        return { success: true, message: "Bet recorded successfully." };
    } catch (error) {
        console.error("Error inserting user bet:", error);
        return { success: false, message: "Failed to record bet." };
    }
};
const getUserBets = async (userId) => {
    try {
        const result = await sql`
                SELECT * FROM user_bets
                WHERE user_id = ${userId} AND timestamp > NOW() - INTERVAL '30 days'
                ORDER BY timestamp DESC`;
        return { success: true, bets: result };
    } catch (error) {
        console.error("Error retrieving user bets:", error);
        return { success: false, message: "Failed to retrieve bets." };
    }
};
const getReferralsData = async (req, res) => {
    try {
        const userId = req.query.userId;
        const refId = req.query.refId;

        const userResult = await sql`
            SELECT balance, withdrawal_balance, referral_balance, level1_referrals, level2_referrals, level3_referrals,
                   level1_earnings, level2_earnings, level3_earnings
            FROM users
            WHERE userId = ${userId}
        `;

        if (userResult.length === 0) {
            return res.json({ success: false, message: "User not found" });
        }

        const user = userResult[0];

        const referralsResult = await sql`
            SELECT r.timestamp AS timestamp, u.name AS userName, u.dob, u.gender, r.earned_amount AS bonus
            FROM referrals r
            JOIN users u ON r.referred_id = u.userId
            WHERE r.referrer_id = ${refId} AND r.level = 1
            ORDER BY r.timestamp DESC
            LIMIT 30
        `;

        res.json({
            totalBonus:  user.referral_balance,
            level1Bonus: user.level1_earnings,
            level2Bonus: user.level2_earnings,
            level3Bonus: user.level3_earnings,
            totalReferrals: user.level1_referrals + user.level2_referrals + user.level3_referrals,
            level1Referrals: user.level1_referrals,
            level2Referrals: user.level2_referrals,
            level3Referrals: user.level3_referrals,
            referrals: referralsResult
        });
    } catch (error) {
        console.error('Error fetching referral data:', error);
        res.json({ success: false, message: 'Server Error' });
    }
}

const getPendingTransactions = async (req, res) => {
    const { userId } = req.body; 
  
    try {
      const adminUsers = ['lagasani.ramanaiah1@gmail.com'];
      
      const result = await sql`
        SELECT email FROM users WHERE userId = ${userId}`;
      
      if (!result.length || !adminUsers.includes(result[0].email)) {
        return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
      }
      const transactions = await sql`
        SELECT * FROM user_transactions
        WHERE status = 'pending'`;
      
      return res.json({ success: true, transactions });
    } catch (error) {
      console.error('Error fetching pending transactions:', error);
      return res.json({ success: false, message: 'Failed to fetch pending transactions' });
    }
  };
  
  const updateTransactionWithStatusCheck = async (req,res) => {
    const { userId, transactionId, status, amount } = req.body;
    console.log(userId, transactionId, status, amount)
    try {
        if (status !== 'success' && status !== 'failed') {
            return { success: false, message: "Invalid status. Status must be 'success' or 'failed'." };
        }
  
        await sql.begin(async sql => {
            await sql`
                UPDATE user_transactions
                SET status = ${status}
                WHERE user_id = ${userId} AND transaction_Id = ${transactionId}`;
  
            if (status === 'success') {
                const result = await sql`
                    UPDATE users
                    SET hold_amount = hold_amount - ${amount}
                    WHERE userId = ${userId} AND hold_amount >= ${amount}
                    RETURNING hold_amount`;
  
                if (result.length > 0) {
                    res.json( { success: true, newHoldAmount: result[0].hold_amount, message: 'Transaction marked as success, hold balance updated.' });
                } else {
                    res.json( { success: false, message: 'Insufficient hold balance.' });
                }
  
            } else if (status === 'failed') {
                const result = await sql`
                    UPDATE users
                    SET balance = balance + ${amount},
                        withdrawal_balance = withdrawal_balance + ${amount},
                        hold_amount = hold_amount - ${amount}
                    WHERE userId = ${userId} AND hold_amount >= ${amount}
                    RETURNING balance, withdrawal_balance, hold_amount`;
  
                if (result.length > 0) {
                    res.json( {
                        success: true,
                        newBalance: result[0].balance,
                        newWithdrawalBalance: result[0].withdrawal_balance,
                        newHoldAmount: result[0].hold_amount,
                        message: 'Transaction marked as failed, amount refunded, and hold balance updated.'
                    });
                } else {
                    res.json( { success: false, message: 'Insufficient hold balance for refund.' });
                }
            }
        });
    } catch (error) {
        console.error("Error updating transaction and balances:", error);
        res.json( { success: false, message: "Failed to update transaction or balance." });
    }
  };

  const cleanupOldData = async () => {
    try {
        await sql`
            DELETE FROM user_transactions 
            WHERE timestamp < NOW() - INTERVAL '30 days'`;
        await sql`
            DELETE FROM user_bets 
            WHERE timestamp < NOW() - INTERVAL '30 days'`;

        console.log("Old data cleanup completed successfully.");
    } catch (error) {
        console.error("Error cleaning up old data:", error);
    }
};

setInterval(cleanupOldData, 86400000);

  
module.exports = {
    getBetHistory,
    getReferralsData,
    insertUserBet,
    getUserBets,
    updateTopMultipliers,
    updateTopWins,
    insertBetHistory,
    getTopMultipliers,
    getTopWins,
    addUser,
    getUser,
    verifyUserCredentials,
    verifyCredentials,
    withdrawBalanceSub,
    updateUserBalanceAdd,
    updateUserBalanceSub,
    transferCommission,
    updatePassword,
    updatebalance,
    storeTransaction,
    getTransactions,
    trackReferral,
    updateReferralEarnings,
    holdBalanceAdd,
    withdrawBalanceAdd,
    holdBalanceSub,
    updateTransactionWithStatusCheck,
    getPendingTransactions,
};


