import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area } from 'recharts';
import {
    Plus,
    Trash2,
    TrendingUp,
    TrendingDown,
    Activity,
    Target,
    Percent,
    DollarSign,
    Calendar,
    Save,
    X,
    PieChart,
    BarChart3,
    RefreshCw,
    Coins,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Wallet
} from 'lucide-react';

// --- 模拟数据 (初始数据) ---
const MOCK_DATA = [
    { id: 1, date: '2023-10-01', symbol: 'BTCUSDT', direction: 'Long', entryPrice: 26500, exitPrice: 27200, quantity: 0.5, fees: 5, notes: '突破回踩做多', status: 'Closed' },
    { id: 2, date: '2023-10-03', symbol: 'ETHUSDT', direction: 'Short', entryPrice: 1650, exitPrice: 1620, quantity: 5, fees: 8, notes: '弱势震荡，高空', status: 'Closed' },
    { id: 3, date: '2023-10-05', symbol: 'SOLUSDT', direction: 'Long', entryPrice: 23.5, exitPrice: 22.0, quantity: 100, fees: 2, notes: '止损离场', status: 'Closed' },
    { id: 4, date: '2023-10-08', symbol: 'BTCUSDT', direction: 'Long', entryPrice: 27500, exitPrice: 28100, quantity: 0.8, fees: 10, notes: '趋势跟随', status: 'Closed' },
    { id: 5, date: '2023-10-12', symbol: 'BTCUSDT', direction: 'Short', entryPrice: 27800, exitPrice: 28000, quantity: 1, fees: 10, notes: '假突破打损', status: 'Closed' },
    { id: 6, date: '2023-10-15', symbol: 'ETHUSDT', direction: 'Long', entryPrice: 1580, exitPrice: 1650, quantity: 10, fees: 15, notes: '底部背离', status: 'Closed' },
    { id: 7, date: '2023-10-18', symbol: 'XRPUSDT', direction: 'Short', entryPrice: 0.52, exitPrice: 0.48, quantity: 5000, fees: 5, notes: '消息面利空', status: 'Closed' },
    { id: 8, date: '2023-10-22', symbol: 'BTCUSDT', direction: 'Long', entryPrice: 30000, exitPrice: 34000, quantity: 0.5, fees: 20, notes: 'ETF预期暴拉', status: 'Closed' },
    { id: 9, date: '2023-10-25', symbol: 'SOLUSDT', direction: 'Long', entryPrice: 32.0, exitPrice: 31.0, quantity: 50, fees: 2, notes: '回调过深止损', status: 'Closed' },
    { id: 10, date: '2023-10-28', symbol: 'SOLUSDT', direction: 'Long', entryPrice: 31.5, exitPrice: 38.0, quantity: 80, fees: 5, notes: '反包确认', status: 'Closed' },
];

// 返佣比例
const REBATE_RATE = 0.30;
// 本地存储的 Key
const STORAGE_KEY = 'trade_journal_data_v1';

// --- 辅助函数 ---
const calculatePnL = (trade) => {
    if (trade.status !== 'Closed') return 0;
    const rawPnL = trade.direction === 'Long'
        ? (trade.exitPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - trade.exitPrice) * trade.quantity;
    return rawPnL - (trade.fees || 0);
};

// 计算标准差
const calculateStdDev = (data, mean) => {
    if (data.length === 0) return 0;
    const squareDiffs = data.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / data.length;
    return Math.sqrt(avgSquareDiff);
};

const Card = ({ title, value, subValue, icon: Icon, trend, subValueClass }) => (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between h-full">
        <div>
            <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="text-gray-400 text-sm font-medium">{title}</div>
                <div className={`p-2 rounded-lg ${trend === 'up' ? 'bg-emerald-500/10 text-emerald-500' : trend === 'down' ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}>
                    <Icon size={20} />
                </div>
            </div>
            <div className="text-2xl font-bold text-gray-100 relative z-10">{value}</div>
        </div>
        {subValue && (
            <div className={`text-sm mt-2 relative z-10 ${subValueClass ? subValueClass : (trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-gray-500')}`}>
                {subValue}
            </div>
        )}
    </div>
);

export default function App() {
    // --- 初始化状态 (优先从 LocalStorage 读取) ---
    const [trades, setTrades] = useState(() => {
        try {
            const savedData = localStorage.getItem(STORAGE_KEY);
            return savedData ? JSON.parse(savedData) : MOCK_DATA;
        } catch (e) {
            console.error("无法读取本地存储", e);
            return MOCK_DATA;
        }
    });

    const [showForm, setShowForm] = useState(false);
    const [initialBalance, setInitialBalance] = useState(10000);

    // 监听 trades 变化，自动保存到 LocalStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
        } catch (e) {
            console.error("无法保存到本地存储", e);
        }
    }, [trades]);

    // 排序状态
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // 表单状态
    const [quantityType, setQuantityType] = useState('Coin'); // 'Coin' | 'USDT'
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        symbol: '',
        direction: 'Long',
        entryPrice: '',
        exitPrice: '',
        quantity: '',
        fees: '',
        notes: '',
    });

    // --- 自动计算手续费逻辑 ---
    useEffect(() => {
        const entry = parseFloat(formData.entryPrice);
        const exit = parseFloat(formData.exitPrice);
        const qty = parseFloat(formData.quantity);

        if (!isNaN(entry) && !isNaN(exit) && !isNaN(qty) && entry > 0) {
            let coinAmount = qty;
            if (quantityType === 'USDT') {
                coinAmount = qty / entry;
            }
            const feeRate = 0.0004;
            const totalFees = (coinAmount * entry + coinAmount * exit) * feeRate;
            setFormData(prev => ({ ...prev, fees: totalFees.toFixed(4) }));
        }
    }, [formData.entryPrice, formData.exitPrice, formData.quantity, quantityType]);

    // --- 统计核心逻辑 (含夏普比率 & 返佣) ---
    const stats = useMemo(() => {
        let totalWins = 0;
        let totalLosses = 0;
        let winAmount = 0;
        let lossAmount = 0;
        let maxDrawdown = 0;
        let peakBalance = initialBalance;
        let currentBalance = initialBalance;
        let totalFees = 0;

        // 用于计算夏普比率的 PnL 数组
        const pnlList = [];

        const equityCurve = [{ date: 'Start', balance: initialBalance, pnl: 0 }];
        const chronTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));

        chronTrades.forEach(trade => {
            const pnl = calculatePnL(trade);
            pnlList.push(pnl);
            currentBalance += pnl;
            totalFees += (trade.fees || 0);

            equityCurve.push({
                date: trade.date,
                balance: currentBalance,
                pnl: pnl,
                symbol: trade.symbol
            });

            if (pnl > 0) {
                totalWins++;
                winAmount += pnl;
            } else if (pnl < 0) {
                totalLosses++;
                lossAmount += Math.abs(pnl);
            }

            if (currentBalance > peakBalance) {
                peakBalance = currentBalance;
            }
            const drawdown = (peakBalance - currentBalance) / peakBalance * 100;
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown;
            }
        });

        const totalTrades = totalWins + totalLosses;
        const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
        const avgWin = totalWins > 0 ? winAmount / totalWins : 0;
        const avgLoss = totalLosses > 0 ? lossAmount / totalLosses : 0;
        const profitFactor = avgLoss > 0 ? (winAmount / lossAmount) : winAmount > 0 ? 999 : 0;
        const netProfit = winAmount - lossAmount;

        // 返佣计算
        const totalRebates = totalFees * REBATE_RATE;
        const netProfitWithRebate = netProfit + totalRebates;

        // 夏普比率计算
        let sharpeRatio = 0;
        if (pnlList.length > 1) {
            const meanPnl = netProfit / totalTrades;
            const stdDevPnl = calculateStdDev(pnlList, meanPnl);
            if (stdDevPnl !== 0) {
                sharpeRatio = meanPnl / stdDevPnl;
            }
        }

        return {
            netProfit,
            netProfitWithRebate,
            totalFees,
            totalRebates,
            winRate,
            profitFactor,
            maxDrawdown,
            sharpeRatio,
            avgWin,
            avgLoss,
            equityCurve,
            totalTrades,
            currentBalance
        };
    }, [trades, initialBalance]);

    // --- 排序逻辑 ---
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedTrades = useMemo(() => {
        let sortableTrades = [...trades];
        sortableTrades.sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];

            if (sortConfig.key === 'pnl') {
                aValue = calculatePnL(a);
                bValue = calculatePnL(b);
            }
            if (sortConfig.key === 'fees') {
                aValue = a.fees || 0;
                bValue = b.fees || 0;
            }

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        return sortableTrades;
    }, [trades, sortConfig]);

    // --- 处理表单提交 ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        let finalQuantity = parseFloat(formData.quantity);
        const entryPrice = parseFloat(formData.entryPrice);
        if (quantityType === 'USDT') {
            finalQuantity = finalQuantity / entryPrice;
        }
        const newTrade = {
            id: Date.now(),
            ...formData,
            entryPrice: entryPrice,
            exitPrice: parseFloat(formData.exitPrice),
            quantity: finalQuantity,
            fees: parseFloat(formData.fees) || 0,
            status: 'Closed'
        };
        setTrades([...trades, newTrade]);
        setShowForm(false);
        setFormData({ ...formData, symbol: '', entryPrice: '', exitPrice: '', quantity: '', fees: '', notes: '' });
    };

    const deleteTrade = (id) => {
        setTrades(trades.filter(t => t.id !== id));
    };

    // 重置数据功能
    const resetData = () => {
        if (window.confirm('确定要清空所有数据并恢复初始演示数据吗？')) {
            setTrades(MOCK_DATA);
        }
    }

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="ml-1 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="ml-1 text-indigo-400" />
            : <ArrowDown size={14} className="ml-1 text-indigo-400" />;
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans selection:bg-indigo-500 selection:text-white">
            {/* 顶部导航 */}
            <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="bg-indigo-600 p-2 rounded-lg">
                            <Activity className="text-white" size={24} />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">TradeJournal <span className="text-indigo-400">Pro</span></h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="hidden md:flex flex-col items-end mr-4">
                            <span className="text-xs text-gray-400">当前权益</span>
                            <span className={`font-mono font-bold ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                ${stats.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <button
                            onClick={resetData}
                            className="text-gray-500 hover:text-white p-2 mr-2"
                            title="重置数据"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            onClick={() => setShowForm(true)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors"
                        >
                            <Plus size={18} className="mr-1.5" /> 记一笔
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

                {/* 核心指标卡片 - 调整为 3列布局以适应6个卡片 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card
                        title="净利润 (Net Profit)"
                        value={`$${stats.netProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        subValue={`含返佣: $${stats.netProfitWithRebate.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        subValueClass="text-indigo-300 font-medium"
                        icon={DollarSign}
                        trend={stats.netProfit >= 0 ? 'up' : 'down'}
                    />
                    <Card
                        title="胜率 (Win Rate)"
                        value={`${stats.winRate.toFixed(1)}%`}
                        subValue={`${stats.totalTrades} 笔交易`}
                        icon={Target}
                        trend={stats.winRate > 50 ? 'up' : 'down'}
                    />
                    <Card
                        title="盈亏比 (Profit Factor)"
                        value={stats.profitFactor.toFixed(2)}
                        subValue={`平均赢: $${stats.avgWin.toFixed(0)} / 输: $${stats.avgLoss.toFixed(0)}`}
                        icon={Percent}
                        trend={stats.profitFactor > 1.5 ? 'up' : stats.profitFactor < 1 ? 'down' : 'neutral'}
                    />
                    <Card
                        title="夏普比率 (Sharpe)"
                        value={stats.sharpeRatio.toFixed(2)}
                        subValue={stats.sharpeRatio > 1 ? '表现优秀' : '波动较大'}
                        icon={Activity}
                        trend={stats.sharpeRatio > 1 ? 'up' : 'neutral'}
                    />
                    <Card
                        title="最大回撤 (Drawdown)"
                        value={`${stats.maxDrawdown.toFixed(2)}%`}
                        subValue={stats.maxDrawdown > 20 ? '注意风控' : '控制良好'}
                        icon={TrendingDown}
                        trend={stats.maxDrawdown < 10 ? 'up' : 'down'}
                    />
                    <Card
                        title="返佣统计 (Rebates)"
                        value={`$${stats.totalRebates.toFixed(2)}`}
                        subValue={`总手续费: $${stats.totalFees.toFixed(0)}`}
                        subValueClass="text-gray-400"
                        icon={Wallet}
                        trend="neutral"
                    />
                </div>

                {/* 资金曲线图 */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold flex items-center">
                            <TrendingUp className="mr-2 text-indigo-400" size={20} />
                            资金增长曲线
                        </h2>
                        <div className="flex space-x-2 text-sm">
                            <span className="px-3 py-1 bg-gray-700 rounded-md text-gray-300">初始资金: ${initialBalance}</span>
                        </div>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.equityCurve}>
                                <defs>
                                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 12 }}
                                    tickMargin={10}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    tick={{ fontSize: 12 }}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(value) => `$${value}`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6' }}
                                    itemStyle={{ color: '#818cf8' }}
                                    formatter={(value) => [`$${value.toFixed(2)}`, '账户权益']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="balance"
                                    stroke="#6366f1"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorBalance)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 交易日志列表 */}
                <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                        <h2 className="text-lg font-semibold flex items-center">
                            <Calendar className="mr-2 text-indigo-400" size={20} />
                            近期交易记录
                        </h2>
                        <span className="text-sm text-gray-400">共 {stats.totalTrades} 笔历史数据</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-750 text-gray-400 text-sm uppercase tracking-wider border-b border-gray-700">
                                    <th onClick={() => handleSort('date')} className="px-6 py-3 font-medium cursor-pointer hover:text-white group transition-colors select-none">
                                        <div className="flex items-center">日期 <SortIcon columnKey="date" /></div>
                                    </th>
                                    <th onClick={() => handleSort('symbol')} className="px-6 py-3 font-medium cursor-pointer hover:text-white group transition-colors select-none">
                                        <div className="flex items-center">标的 <SortIcon columnKey="symbol" /></div>
                                    </th>
                                    <th onClick={() => handleSort('direction')} className="px-6 py-3 font-medium cursor-pointer hover:text-white group transition-colors select-none">
                                        <div className="flex items-center">方向 <SortIcon columnKey="direction" /></div>
                                    </th>
                                    <th onClick={() => handleSort('entryPrice')} className="px-6 py-3 font-medium text-right cursor-pointer hover:text-white group transition-colors select-none">
                                        <div className="flex items-center justify-end">开仓价 <SortIcon columnKey="entryPrice" /></div>
                                    </th>
                                    <th onClick={() => handleSort('exitPrice')} className="px-6 py-3 font-medium text-right cursor-pointer hover:text-white group transition-colors select-none">
                                        <div className="flex items-center justify-end">平仓价 <SortIcon columnKey="exitPrice" /></div>
                                    </th>
                                    <th onClick={() => handleSort('quantity')} className="px-6 py-3 font-medium text-right cursor-pointer hover:text-white group transition-colors select-none">
                                        <div className="flex items-center justify-end">数量 <SortIcon columnKey="quantity" /></div>
                                    </th>
                                    <th onClick={() => handleSort('fees')} className="px-6 py-3 font-medium text-right cursor-pointer hover:text-white group transition-colors select-none">
                                        <div className="flex items-center justify-end">手续费 (返佣) <SortIcon columnKey="fees" /></div>
                                    </th>
                                    <th onClick={() => handleSort('pnl')} className="px-6 py-3 font-medium text-right cursor-pointer hover:text-white group transition-colors select-none">
                                        <div className="flex items-center justify-end">净盈亏 <SortIcon columnKey="pnl" /></div>
                                    </th>
                                    <th className="px-6 py-3 font-medium">笔记</th>
                                    <th className="px-6 py-3 font-medium text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700 text-sm">
                                {sortedTrades.map((trade) => {
                                    const pnl = calculatePnL(trade);
                                    const isWin = pnl >= 0;
                                    const rebate = (trade.fees || 0) * REBATE_RATE;
                                    return (
                                        <tr key={trade.id} className="hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{trade.date}</td>
                                            <td className="px-6 py-4 font-bold text-white">{trade.symbol}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${trade.direction === 'Long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                    {trade.direction === 'Long' ? '做多' : '做空'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right text-gray-300">{trade.entryPrice}</td>
                                            <td className="px-6 py-4 text-right text-gray-300">{trade.exitPrice}</td>
                                            <td className="px-6 py-4 text-right text-gray-300">{trade.quantity.toFixed(4)}</td>
                                            <td className="px-6 py-4 text-right text-gray-400">
                                                <div>{trade.fees?.toFixed(2)}</div>
                                                <div className="text-[10px] text-emerald-400/80 font-medium">返 ${rebate.toFixed(2)}</div>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-mono font-bold ${isWin ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {isWin ? '+' : ''}{pnl.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-gray-400 max-w-xs truncate" title={trade.notes}>
                                                {trade.notes || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => deleteTrade(trade.id)}
                                                    className="text-gray-500 hover:text-rose-400 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* 记账弹窗 */}
            {showForm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
                    <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                <Plus className="mr-2 text-indigo-400" size={20} />
                                录入新交易
                            </h3>
                            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400">日期</label>
                                    <input type="date" required name="date" value={formData.date} onChange={handleInputChange}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400">交易品种</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            required
                                            name="symbol"
                                            list="symbols-list"
                                            placeholder="如 BTCUSDT"
                                            value={formData.symbol}
                                            onChange={handleInputChange}
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                        />
                                        <datalist id="symbols-list">
                                            <option value="BTCUSDT" />
                                            <option value="ETHUSDT" />
                                            <option value="SOLUSDT" />
                                            <option value="XRPUSDT" />
                                            <option value="BNBUSDT" />
                                            <option value="DOGEUSDT" />
                                        </datalist>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400">方向</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button"
                                        onClick={() => setFormData({ ...formData, direction: 'Long' })}
                                        className={`py-2 rounded-lg border font-medium transition-all ${formData.direction === 'Long' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-gray-900 border-gray-700 text-gray-400'}`}
                                    >
                                        做多 (Long)
                                    </button>
                                    <button type="button"
                                        onClick={() => setFormData({ ...formData, direction: 'Short' })}
                                        className={`py-2 rounded-lg border font-medium transition-all ${formData.direction === 'Short' ? 'bg-rose-500/20 border-rose-500 text-rose-400' : 'bg-gray-900 border-gray-700 text-gray-400'}`}
                                    >
                                        做空 (Short)
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400">开仓均价</label>
                                    <input type="number" required step="any" name="entryPrice" value={formData.entryPrice} onChange={handleInputChange}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-gray-400">平仓均价</label>
                                    <input type="number" required step="any" name="exitPrice" value={formData.exitPrice} onChange={handleInputChange}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-medium text-gray-400">数量 (Size)</label>
                                    <div className="flex bg-gray-900 rounded-md p-0.5 border border-gray-700">
                                        <button
                                            type="button"
                                            onClick={() => setQuantityType('Coin')}
                                            className={`text-xs px-2 py-0.5 rounded ${quantityType === 'Coin' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            按币
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setQuantityType('USDT')}
                                            className={`text-xs px-2 py-0.5 rounded ${quantityType === 'USDT' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            按USDT
                                        </button>
                                    </div>
                                </div>
                                <div className="relative">
                                    <input type="number" required step="any" name="quantity" value={formData.quantity} onChange={handleInputChange}
                                        placeholder={quantityType === 'Coin' ? "例如: 0.5 (BTC)" : "例如: 10000 (USDT)"}
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none pl-9" />
                                    <div className="absolute left-3 top-2.5 text-gray-500">
                                        {quantityType === 'Coin' ? <Coins size={16} /> : <DollarSign size={16} />}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400 flex items-center justify-between">
                                    <span>手续费 (总计)</span>
                                    <span className="text-[10px] text-gray-500">自动计算 (双边0.04%)</span>
                                </label>
                                <input type="number" step="any" name="fees" value={formData.fees} onChange={handleInputChange}
                                    placeholder="自动计算中..."
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                                {formData.fees && !isNaN(formData.fees) && (
                                    <div className="text-[11px] text-emerald-400 text-right mt-1">
                                        预计返佣 (30%): ${(parseFloat(formData.fees) * 0.3).toFixed(4)}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-medium text-gray-400">交易笔记/逻辑</label>
                                <textarea rows="2" name="notes" placeholder="为什么开单？为什么平仓？" value={formData.notes} onChange={handleInputChange}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>

                            <div className="pt-2">
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-indigo-500/30">
                                    保存记录
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}