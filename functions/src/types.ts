// functions/src/types.ts
export interface OptionData {
    instrument_name: string;
    strike: number;
    expiry: string;
    option_type: 'call' | 'put';
    bid_price: number;
    ask_price: number;
    mark_price: number;
    implied_volatility: number;
    bid_ask_spread: number;
    time_to_expiry: number;
  }
  
  export interface FilterCriteria {
    baseAsset: string;
    optionType: 'call' | 'put' | 'both';
    minDelta?: number;
    maxDelta?: number;
    minIV?: number;
    maxIV?: number;
    expiryDates?: string[];
    minStrike?: number;
    maxStrike?: number;
  }
  
  export interface OrderRequest {
    instrument_name: string;
    amount: number;
    price: number;
  }