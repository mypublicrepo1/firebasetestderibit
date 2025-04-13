"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeOrder = exports.saveStrategy = exports.getOptions = exports.login = void 0;
// functions/src/index.ts
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
admin.initializeApp();
const db = admin.firestore();
const DERIBIT_API = 'https://test.deribit.com/api/v2';
const DERIBIT_CLIENT_ID = process.env.DERIBIT_CLIENT_ID;
const DERIBIT_CLIENT_SECRET = process.env.DERIBIT_CLIENT_SECRET;
const APP_PASSWORD = process.env.APP_PASSWORD;
async function getDeribitToken() {
    const { data } = await axios_1.default.get(`${DERIBIT_API}/public/auth`, {
        params: {
            client_id: DERIBIT_CLIENT_ID,
            client_secret: DERIBIT_CLIENT_SECRET,
            grant_type: 'client_credentials',
        },
    });
    return data.result.access_token;
}
exports.login = functions.https.onRequest(async (req, res) => {
    try {
        const { password } = JSON.parse(req.body);
        if (password === APP_PASSWORD) {
            res.json({ success: true, token: 'authenticated' });
        }
        else {
            res.status(401).json({ error: 'Invalid password' });
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Failed to login' });
    }
});
exports.getOptions = functions.https.onRequest(async (req, res) => {
    const filters = req.query.filters
        ? JSON.parse(req.query.filters)
        : { baseAsset: 'BTC', optionType: 'both' };
    const cacheKey = JSON.stringify(filters);
    try {
        const cacheDoc = await db.collection('cache').doc(cacheKey).get();
        if (cacheDoc.exists && Date.now() - cacheDoc.data().timestamp < 30000) {
            res.json(cacheDoc.data().options);
            return;
        }
        const { data: instrumentsData } = await axios_1.default.get(`${DERIBIT_API}/public/get_instruments?currency=${filters.baseAsset}&kind=option`);
        const instruments = instrumentsData.result.filter((item) => item.instrument_name.match(/-C$|-P$/));
        const tickers = await Promise.all(instruments.map((item) => axios_1.default.get(`${DERIBIT_API}/public/ticker?instrument_name=${item.instrument_name}`)));
        const options = instruments.map((item, i) => {
            const ticker = tickers[i].data.result;
            const bidAskSpread = ticker.best_ask_price && ticker.best_bid_price
                ? ((ticker.best_ask_price - ticker.best_bid_price) / ticker.best_bid_price) * 100
                : 0;
            return {
                instrument_name: item.instrument_name,
                strike: item.strike,
                expiry: new Date(item.expiration_timestamp).toISOString().split('T')[0],
                option_type: item.instrument_name.endsWith('-C') ? 'call' : 'put',
                bid_price: ticker.best_bid_price || 0,
                ask_price: ticker.best_ask_price || 0,
                mark_price: ticker.mark_price,
                implied_volatility: ticker.mark_iv || 0,
                bid_ask_spread: bidAskSpread,
                time_to_expiry: (new Date(item.expiration_timestamp).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            };
        });
        const filtered = options
            .filter((option) => {
            var _a;
            const matchesAsset = option.instrument_name.startsWith(filters.baseAsset);
            const matchesType = filters.optionType === 'both' || option.option_type === filters.optionType;
            const matchesIV = !filters.minIV ||
                !filters.maxIV ||
                (option.implied_volatility >= filters.minIV && option.implied_volatility <= filters.maxIV);
            const matchesStrike = !filters.minStrike ||
                !filters.maxStrike ||
                (option.strike >= filters.minStrike && option.strike <= filters.maxStrike);
            const matchesExpiry = !((_a = filters.expiryDates) === null || _a === void 0 ? void 0 : _a.length) || filters.expiryDates.includes(option.expiry);
            return matchesAsset && matchesType && matchesIV && matchesStrike && matchesExpiry;
        })
            .slice(0, 20);
        await db.collection('cache').doc(cacheKey).set({
            options: filtered,
            timestamp: Date.now(),
        });
        res.json(filtered);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch options' });
    }
});
exports.saveStrategy = functions.https.onRequest(async (req, res) => {
    try {
        const { instrument_name } = JSON.parse(req.body);
        await db.collection('strategies').add({ instrument_name, timestamp: Date.now() });
        res.json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to save strategy' });
    }
});
exports.placeOrder = functions.https.onRequest(async (req, res) => {
    try {
        const { instrument_name, amount, price } = JSON.parse(req.body);
        const token = await getDeribitToken();
        const { data } = await axios_1.default.post(`${DERIBIT_API}/private/sell`, {
            instrument_name,
            amount,
            price,
            type: 'limit',
        }, {
            headers: { Authorization: `Bearer ${token}` },
        });
        await db.collection('orders').add({
            instrument_name,
            amount,
            price,
            order_id: data.result.order.order_id,
            timestamp: Date.now(),
        });
        res.json({ success: true, order_id: data.result.order.order_id });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});
//# sourceMappingURL=index.js.map