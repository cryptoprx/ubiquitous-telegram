import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import clsx from 'clsx';

function CryptoView() {
  const [coins, setCoins] = useState([]);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    fetchCoins();
    const iv = setInterval(fetchCoins, 60000);
    return () => clearInterval(iv);
  }, []);

  async function fetchCoins() {
    setPriceLoading(true);
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h');
      if (res.ok) setCoins(await res.json());
    } catch {}
    setPriceLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      <div className="sidebar-section px-0">Market Prices</div>
      {priceLoading && coins.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-white/20"><RefreshCw size={14} className="animate-spin" /></div>
      ) : (
        <div className="space-y-0.5">
          {coins.map((coin, i) => {
            const change = coin.price_change_percentage_24h || 0;
            const isUp = change >= 0;
            return (
              <div key={coin.id} className="group flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-default">
                <span className="text-[8px] text-white/20 w-3 text-right font-mono">{i + 1}</span>
                <img src={coin.image} alt={coin.symbol} className="w-4 h-4 rounded-full" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-white/70 font-medium truncate">{coin.name}</span>
                    <span className="text-[8px] text-white/20 uppercase">{coin.symbol}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-white/70 font-mono">{coin.current_price >= 1 ? '$' + coin.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '$' + coin.current_price.toFixed(6)}</div>
                  <div className={clsx('flex items-center justify-end gap-0.5 text-[8px] font-medium', isUp ? 'text-accent-400' : 'text-red-400')}>
                    {isUp ? <ArrowUpRight size={7} /> : <ArrowDownRight size={7} />}
                    {Math.abs(change).toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="px-2 pt-2 pb-1 text-[8px] text-white/10 text-center">CoinGecko · Refreshes every 60s</div>
    </div>
  );
}

// No preset proxies — user must provide their own server details

export default CryptoView;
