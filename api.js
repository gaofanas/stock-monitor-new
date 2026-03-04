/**
 * 股票 API 封装模块
 * 数据源：Python 后端 (efinance)
 * 支持：A 股、港股
 *
 * 股票代码格式说明：
 * - A 股：需要带市场前缀，如 sz300274、sh600519
 * - 港股：5 位数字，如 00700
 */

const StockAPI = (function() {
    'use strict';

    // API 基础地址 - 可从 localStorage 读取，允许用户自定义
    let API_BASE = localStorage.getItem('apiBaseUrl') || 'http://localhost:5000/api';

    /**
     * 设置 API 基础地址
     * @param {string} url - API 地址
     */
    function setApiBase(url) {
        API_BASE = url;
        localStorage.setItem('apiBaseUrl', url);
    }

    /**
     * 获取 API 基础地址
     * @returns {string} - API 地址
     */
    function getApiBase() {
        return API_BASE;
    }

    /**
     * 判断股票代码所属市场
     * @param {string} code - 股票代码
     * @returns {string} - 'hk'(港股)、'sh'(沪市 A 股)、'sz'(深市 A 股)
     */
    function detectMarket(code) {
        if (!code) return 'sz';

        const cleanCode = code.trim();

        // 港股：5 位数字
        if (/^\d{5}$/.test(cleanCode)) {
            return 'hk';
        }

        // 如果已有前缀，返回前缀
        if (/^(sh|sz|SH|SZ)/i.test(cleanCode)) {
            return cleanCode.substring(0, 2).toLowerCase();
        }

        // A 股 6 位数字，根据代码范围判断市场
        if (/^\d{6}$/.test(cleanCode)) {
            const codeNum = parseInt(cleanCode);
            // 沪市：600-603, 605, 688(科创板)
            if (codeNum >= 600000 && codeNum <= 603999 ||
                codeNum >= 605000 && codeNum <= 605999 ||
                codeNum >= 688000 && codeNum <= 688999) {
                return 'sh';
            }
            // 深市：000-003, 200(B 股), 300-301(创业板)
            if (codeNum >= 200000 && codeNum <= 200999 ||
                codeNum >= 300000 && codeNum <= 301999 ||
                codeNum >= 1 && codeNum <= 3999) {
                return 'sz';
            }
            // 默认返回 sz
            return 'sz';
        }

        return 'sz';
    }

    /**
     * 格式化股票代码为 efinance 需要的格式
     * efinance 格式：
     * - A 股：带市场前缀，如 sz300274、sh600519
     * - 港股：5 位数字，如 00700
     * @param {string} code - 原始股票代码
     * @returns {object} - { code: string, market: string, displayCode: string }
     */
    function formatStockCode(code) {
        const market = detectMarket(code);
        let displayCode = code.trim();

        // 如果已经有前缀，先去掉
        if (/^(sh|sz|SH|SZ)/i.test(displayCode)) {
            displayCode = displayCode.substring(2);
        }

        if (market === 'hk') {
            // 港股：补零到 5 位
            displayCode = displayCode.padStart(5, '0');
        } else {
            // A 股：补零到 6 位，添加市场前缀
            displayCode = displayCode.padStart(6, '0');
            displayCode = market + displayCode;
        }

        return { code: displayCode, market: market };
    }

    /**
     * 从格式化后的代码中获取纯数字代码（用于显示）
     * @param {string} formattedCode - 格式化后的代码（如 sz300274）
     * @returns {string} - 纯数字代码（如 300274）
     */
    function getPureCode(formattedCode) {
        if (!formattedCode) return '';
        return formattedCode.replace(/^(sh|sz|hk|SH|SZ|HK)/i, '');
    }

    /**
     * 获取单个股票实时数据
     * @param {string} code - 股票代码（可以是纯数字或带前缀）
     * @returns {Promise<object>} - 股票数据
     */
    async function getSingleStockData(code) {
        try {
            const { code: formattedCode, market } = formatStockCode(code);
            const pureCode = getPureCode(formattedCode);

            const response = await fetch(`${API_BASE}/stock/${formattedCode}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || '获取数据失败');
            }

            return {
                code: pureCode,
                fullCode: formattedCode,
                name: result.data.name || '未知',
                price: result.data.price || 0,
                open: result.data.open || 0,
                high: result.data.high || 0,
                low: result.data.low || 0,
                close: result.data.close || 0,
                volume: result.data.volume || 0,
                turnover: result.data.turnover || 0,
                change: result.data.change || 0,
                changePercent: result.data.change_percent || 0,
                market: market,
                timestamp: Date.now()
            };

        } catch (error) {
            throw new Error(`获取数据失败：${error.message}`);
        }
    }

    /**
     * 使用 get_quote_snapshot 接口获取单只股票数据（更稳定）
     * @param {string} code - 股票代码
     * @returns {Promise<object>} - 股票数据
     */
    async function getQuoteSnapshot(code) {
        try {
            const { code: formattedCode, market } = formatStockCode(code);
            const pureCode = getPureCode(formattedCode);

            const response = await fetch(`${API_BASE}/quote/snapshot/${formattedCode}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || '获取数据失败');
            }

            return {
                code: pureCode,
                fullCode: formattedCode,
                name: result.data.name || '未知',
                price: result.data.price || 0,
                market: market,
                timestamp: Date.now()
            };

        } catch (error) {
            throw new Error(`获取数据失败：${error.message}`);
        }
    }

    /**
     * 获取股票详细信息（财报、估值等）
     * @param {string} code - 股票代码
     * @returns {Promise<object>} - 股票详细信息
     */
    async function getStockInfo(code) {
        try {
            const { code: formattedCode } = formatStockCode(code);

            const response = await fetch(`${API_BASE}/stock/info/${formattedCode}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || '获取数据失败');
            }

            return result.data;

        } catch (error) {
            throw new Error(`获取数据失败：${error.message}`);
        }
    }

    /**
     * 批量获取股票数据
     * @param {Array<string>} codes - 股票代码数组
     * @returns {Promise<object>} - { results: Array, errors: Array }
     */
    async function getBatchStockData(codes) {
        try {
            const formattedCodes = codes.map(c => formatStockCode(c).code);

            // 增加超时时间，支持大量股票
            const controller = new AbortController();
            const timeout = Math.max(60000, codes.length * 1000); // 至少 60 秒，或按股票数量计算
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(`${API_BASE}/stock/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ codes: formattedCodes }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || '批量获取失败');
            }

            // 格式化结果 - 优先使用 full_code（带市场前缀），没有则使用 code
            const results = result.results.map(data => ({
                code: data.full_code || (data.market ? (data.market + data.code) : data.code),
                fullCode: data.full_code || data.code,
                pureCode: getPureCode(data.code),
                name: data.name,
                price: data.price,
                market: data.market,
                timestamp: Date.now()
            }));

            return {
                results: results,
                errors: result.errors || [],
                total: result.total || codes.length,
                successCount: result.success_count || results.length,
                errorCount: result.error_count || result.errors.length
            };

        } catch (error) {
            // 如果批量接口失败，降级为单个获取（带并发限制）
            console.warn('批量接口失败，降级为单个获取:', error.message);
            return await getBatchStockDataFallback(codes);
        }
    }

    /**
     * 批量获取股票数据（降级方案：带并发限制的单个获取）
     */
    async function getBatchStockDataFallback(codes) {
        const results = [];
        const errors = [];

        // 并发限制：同时最多 5 个请求
        const CONCURRENCY_LIMIT = 5;

        for (let i = 0; i < codes.length; i += CONCURRENCY_LIMIT) {
            const batch = codes.slice(i, i + CONCURRENCY_LIMIT);
            const promises = batch.map(async (code) => {
                try {
                    const data = await getSingleStockData(code);
                    return { success: true, data };
                } catch (e) {
                    return { success: false, code, error: e.message };
                }
            });

            const batchResults = await Promise.all(promises);

            batchResults.forEach(result => {
                if (result.success) {
                    results.push(result.data);
                } else {
                    errors.push({ code: result.code, error: result.error });
                }
            });

            // 每批之间稍微延迟
            if (i + CONCURRENCY_LIMIT < codes.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return { results, errors };
    }

    /**
     * 获取股票名称
     * @param {string} code - 股票代码
     * @returns {Promise<string>} - 股票名称
     */
    async function getStockName(code) {
        try {
            const data = await getSingleStockData(code);
            return data.name;
        } catch (error) {
            throw error;
        }
    }

    /**
     * 生成亿牛网链接
     * @param {string} code - 股票代码（纯数字）
     * @param {string} market - 市场类型 ('hk', 'sh', 'sz')
     * @returns {string} - 亿牛网 URL
     */
    function getYiNiuLink(code, market) {
        // 格式化代码：添加市场前缀
        let fullCode;

        // 确保 code 是纯数字（去掉可能存在的前缀）
        const pureCode = code.replace(/^(sh|sz|hk|SH|SZ|HK)/i, '');

        if (market === 'hk') {
            // 港股：hk + 5 位数字
            fullCode = 'hk' + pureCode.padStart(5, '0');
        } else if (market === 'sh') {
            // 沪市：sh + 6 位数字
            fullCode = 'sh' + pureCode.padStart(6, '0');
        } else if (market === 'sz') {
            // 深市：sz + 6 位数字
            fullCode = 'sz' + pureCode.padStart(6, '0');
        } else {
            // 默认处理：根据代码长度判断
            if (pureCode.length === 5) {
                fullCode = 'hk' + pureCode;
            } else {
                fullCode = 'sz' + pureCode.padStart(6, '0');
            }
        }

        // 统一使用新格式：https://eniu.com/gu/{代码}
        return `https://eniu.com/gu/${fullCode}`;
    }

    /**
     * 检查后端服务是否可用
     * @returns {Promise<boolean>}
     */
    async function checkHealth() {
        try {
            const response = await fetch('http://localhost:5000/health', {
                method: 'GET'
            });
            const result = await response.json();
            return result.status === 'ok';
        } catch (error) {
            return false;
        }
    }

    // 公开 API
    return {
        detectMarket,
        formatStockCode,
        getPureCode,
        getSingleStockData,
        getQuoteSnapshot,
        getStockInfo,
        getBatchStockData,
        getStockName,
        getYiNiuLink,
        checkHealth,
        setApiBase,
        getApiBase
    };

})();
