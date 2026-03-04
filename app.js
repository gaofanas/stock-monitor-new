/**
 * 股票监控系统 - 主应用逻辑
 */

(function() {
    'use strict';

    // ========================================
    // 常量定义
    // ========================================
    const STORAGE_KEY = 'stock_monitor_data';
    const REFRESH_INTERVAL = 300000; // 5 分钟自动刷新

    // ========================================
    // 状态管理
    // ========================================
    let appState = {
        stocks: [],           // 股票列表
        autoRefresh: true,    // 自动刷新开关
        refreshTimer: null,   // 自动刷新定时器
        lastUpdateTime: null  // 上次更新时间
    };

    // ========================================
    // DOM 元素引用
    // ========================================
    let elements = {};

    // ========================================
    // 初始化
    // ========================================
    function init() {
        cacheElements();
        bindEvents();
        loadFromStorage();
        renderStockList();
        startAutoRefresh();
        updateStatusbar();
        updateOverview();
    }

    /**
     * 缓存 DOM 元素
     */
    function cacheElements() {
        elements = {
            // 按钮
            refreshBtn: document.getElementById('refreshBtn'),
            addStockBtn: document.getElementById('addStockBtn'),
            exportDataBtn: document.getElementById('exportDataBtn'),
            importDataInput: document.getElementById('importDataInput'),
            clearAllBtn: document.getElementById('clearAllBtn'),

            // 模态框
            modalOverlay: document.getElementById('modalOverlay'),
            editModalOverlay: document.getElementById('editModalOverlay'),
            searchModalOverlay: document.getElementById('searchModalOverlay'),
            modalClose: document.getElementById('modalClose'),
            editModalClose: document.getElementById('editModalClose'),
            searchModalClose: document.getElementById('searchModalClose'),
            cancelBtn: document.getElementById('cancelBtn'),
            saveStockBtn: document.getElementById('saveStockBtn'),
            editCancelBtn: document.getElementById('editCancelBtn'),
            updateStockBtn: document.getElementById('updateStockBtn'),

            // 表单
            stockForm: document.getElementById('stockForm'),
            editStockForm: document.getElementById('editStockForm'),
            editIndex: document.getElementById('editIndex'),
            editStockIndex: document.getElementById('editStockIndex'),

            // 添加股票表单字段
            stockCode: document.getElementById('stockCode'),
            stockName: document.getElementById('stockName'),
            industry: document.getElementById('industry'),
            reportDate: document.getElementById('reportDate'),
            growthRate: document.getElementById('growthRate'),
            fairValue: document.getElementById('fairValue'),
            buyDiscount: document.getElementById('buyDiscount'),
            note: document.getElementById('note'),

            // 搜索相关
            searchStockBtn: document.getElementById('searchStockBtn'),
            searchResultList: document.getElementById('searchResultList'),

            // 编辑股票表单字段
            editIndustry: document.getElementById('editIndustry'),
            editReportDate: document.getElementById('editReportDate'),
            editGrowthRate: document.getElementById('editGrowthRate'),
            editFairValue: document.getElementById('editFairValue'),
            editBuyDiscount: document.getElementById('editBuyDiscount'),
            editNote: document.getElementById('editNote'),

            // 模态框标题
            modalTitle: document.getElementById('modalTitle'),
            editModalTitle: document.getElementById('editModalTitle'),

            // 显示区域
            stockTableBody: document.getElementById('stockTableBody'),
            stockCardsContainer: document.getElementById('stockCardsContainer'),
            emptyState: document.getElementById('emptyState'),

            // 概览面板
            overviewPanel: document.getElementById('overviewPanel'),
            overviewTotal: document.getElementById('overviewTotal'),
            overviewAdvantage: document.getElementById('overviewAdvantage'),
            overviewOpportunity: document.getElementById('overviewOpportunity'),
            overviewOvervalued: document.getElementById('overviewOvervalued'),

            // 状态栏
            lastUpdateTime: document.getElementById('lastUpdateTime'),
            autoRefreshStatus: document.getElementById('autoRefreshStatus'),

            // 提示
            toast: document.getElementById('toast'),

            // 自动刷新切换按钮
            toggleAutoRefreshBtn: document.getElementById('toggleAutoRefreshBtn'),

            // 备注模态框
            noteModalOverlay: document.getElementById('noteModalOverlay'),
            noteModalTitle: document.getElementById('noteModalTitle'),
            noteModalContent: document.getElementById('noteModalContent'),
            noteModalClose: document.getElementById('noteModalClose'),
            noteCloseBtn: document.getElementById('noteCloseBtn'),

            // 设置模态框
            settingsModalOverlay: document.getElementById('settingsModalOverlay'),
            settingsModalTitle: document.getElementById('settingsModalTitle'),
            settingsModalClose: document.getElementById('settingsModalClose'),
            settingsCloseBtn: document.getElementById('settingsCloseBtn'),
            settingsSaveBtn: document.getElementById('settingsSaveBtn'),
            apiBaseUrl: document.getElementById('apiBaseUrl'),
            testConnectionBtn: document.getElementById('testConnectionBtn'),
            connectionStatus: document.getElementById('connectionStatus')
        };
    }

    /**
     * 绑定事件
     */
    function bindEvents() {
        // 按钮事件
        elements.refreshBtn.addEventListener('click', handleRefresh);
        elements.addStockBtn.addEventListener('click', handleAddStock);
        elements.exportDataBtn.addEventListener('click', handleExportData);
        elements.importDataInput.addEventListener('change', handleImportData);
        elements.clearAllBtn.addEventListener('click', handleClearAll);
        elements.toggleAutoRefreshBtn.addEventListener('click', handleToggleAutoRefresh);
        elements.settingsBtn.addEventListener('click', handleOpenSettings);

        // 搜索按钮事件
        elements.searchStockBtn.addEventListener('click', handleSearchStock);

        // 模态框事件
        elements.modalClose.addEventListener('click', closeModal);
        elements.editModalClose.addEventListener('click', closeEditModal);
        elements.searchModalClose.addEventListener('click', closeSearchModal);
        elements.noteModalClose.addEventListener('click', closeNoteModal);
        elements.noteCloseBtn.addEventListener('click', closeNoteModal);
        elements.settingsModalClose.addEventListener('click', closeSettingsModal);
        elements.settingsCloseBtn.addEventListener('click', closeSettingsModal);
        elements.settingsSaveBtn.addEventListener('click', handleSaveSettings);
        elements.testConnectionBtn.addEventListener('click', handleTestConnection);
        elements.cancelBtn.addEventListener('click', closeModal);
        elements.editCancelBtn.addEventListener('click', closeEditModal);
        elements.saveStockBtn.addEventListener('click', handleSaveStock);
        elements.updateStockBtn.addEventListener('click', handleUpdateStock);

        // 点击遮罩关闭
        elements.modalOverlay.addEventListener('click', function(e) {
            if (e.target === elements.modalOverlay) {
                closeModal();
            }
        });
        elements.editModalOverlay.addEventListener('click', function(e) {
            if (e.target === elements.editModalOverlay) {
                closeEditModal();
            }
        });
        elements.searchModalOverlay.addEventListener('click', function(e) {
            if (e.target === elements.searchModalOverlay) {
                closeSearchModal();
            }
        });
        elements.noteModalOverlay.addEventListener('click', function(e) {
            if (e.target === elements.noteModalOverlay) {
                closeNoteModal();
            }
        });

        // ESC 键关闭模态框
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
                closeEditModal();
                closeSearchModal();
                closeNoteModal();
            }
        });
    }

    // ========================================
    // 数据存储
    // ========================================

    /**
     * 从 localStorage 加载数据
     */
    function loadFromStorage() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                appState.stocks = JSON.parse(data);
                showToast('数据加载成功', 'success');
            }
        } catch (error) {
            console.error('加载数据失败:', error);
            showToast('加载数据失败', 'error');
        }
    }

    /**
     * 保存数据到 localStorage
     */
    function saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(appState.stocks));
        } catch (error) {
            console.error('保存数据失败:', error);
            showToast('保存数据失败', 'error');
        }
    }

    // ========================================
    // 股票管理
    // ========================================

    /**
     * 处理添加股票
     */
    function handleAddStock() {
        elements.modalTitle.textContent = '添加股票';
        elements.stockForm.reset();
        elements.editIndex.value = '-1';
        elements.modalOverlay.classList.add('active');
        elements.stockCode.focus();
    }

    /**
     * 搜索股票
     */
    function handleSearchStock() {
        const name = elements.stockName.value.trim();
        if (!name) {
            showToast('请输入股票名称', 'warning');
            return;
        }

        // 显示加载状态
        elements.searchStockBtn.disabled = true;
        elements.searchStockBtn.textContent = '🔍 搜索中...';

        // 调用后端搜索 API
        fetch(`http://localhost:5000/api/stock/search?name=${encodeURIComponent(name)}`)
            .then(res => res.json())
            .then(result => {
                elements.searchStockBtn.disabled = false;
                elements.searchStockBtn.textContent = '🔍 搜索';

                if (!result.success || !result.data || result.data.length === 0) {
                    showToast('未找到相关股票，请检查输入或手动输入代码', 'warning');
                    return;
                }

                // 显示搜索结果
                showSearchResults(result.data);
            })
            .catch(error => {
                elements.searchStockBtn.disabled = false;
                elements.searchStockBtn.textContent = '🔍 搜索';
                showToast('搜索失败：' + error.message, 'error');
            });
    }

    /**
     * 显示搜索结果
     */
    function showSearchResults(results) {
        const html = results.map(stock => {
            const marketName = stock.market === 'hk' ? '港股' : (stock.market === 'sh' ? '沪市' : '深市');
            return `
                <div class="search-result-item" onclick="window.selectStock('${stock.code}', '${stock.name}', '${stock.market}')">
                    <div>
                        <div class="search-result-name">${stock.name}</div>
                        <div class="search-result-code">${stock.code}</div>
                    </div>
                    <span class="search-result-market">${marketName}</span>
                </div>
            `;
        }).join('');

        elements.searchResultList.innerHTML = html;
        elements.searchModalOverlay.classList.add('active');
    }

    /**
     * 选择搜索结果中的股票
     */
    function selectStock(code, name, market) {
        elements.stockCode.value = code;
        elements.stockName.value = name;
        closeSearchModal();
        showToast('已选择 ' + name + ' (' + code + ')', 'success');
        elements.fairValue.focus();
    }

    /**
     * 关闭搜索模态框
     */
    function closeSearchModal() {
        elements.searchModalOverlay.classList.remove('active');
        elements.searchResultList.innerHTML = '';
    }

    /**
     * 查看备注详情
     */
    function viewNote(index) {
        const stock = appState.stocks[index];
        if (!stock) return;

        elements.noteModalTitle.textContent = stock.name + ' - 备注详情';
        elements.noteModalContent.textContent = stock.note || '无备注内容';
        elements.noteModalOverlay.classList.add('active');
    }

    /**
     * 关闭备注模态框
     */
    function closeNoteModal() {
        elements.noteModalOverlay.classList.remove('active');
        elements.noteModalContent.textContent = '';
    }

    /**
     * 打开设置模态框
     */
    function handleOpenSettings() {
        const currentUrl = StockAPI.getApiBase();
        elements.apiBaseUrl.value = currentUrl;
        elements.connectionStatus.textContent = '';
        elements.settingsModalOverlay.classList.add('active');
    }

    /**
     * 关闭设置模态框
     */
    function closeSettingsModal() {
        elements.settingsModalOverlay.classList.remove('active');
        elements.connectionStatus.textContent = '';
    }

    /**
     * 保存设置
     */
    function handleSaveSettings() {
        const url = elements.apiBaseUrl.value.trim();
        if (!url) {
            showToast('请输入 API 地址', 'warning');
            return;
        }
        StockAPI.setApiBase(url);
        showToast('设置已保存', 'success');
        setTimeout(() => {
            closeSettingsModal();
        }, 1000);
    }

    /**
     * 测试连接
     */
    async function handleTestConnection() {
        const url = elements.apiBaseUrl.value.trim();
        elements.connectionStatus.textContent = '测试中...';

        try {
            const testUrl = url.replace('/api', '') + '/health';
            const response = await fetch(testUrl, { method: 'GET' });
            if (response.ok) {
                elements.connectionStatus.textContent = '✓ 连接成功';
                elements.connectionStatus.style.color = 'var(--down-color)';
            } else {
                elements.connectionStatus.textContent = '✗ 连接失败';
                elements.connectionStatus.style.color = 'var(--up-color)';
            }
        } catch (error) {
            elements.connectionStatus.textContent = '✗ 无法连接';
            elements.connectionStatus.style.color = 'var(--up-color)';
        }
    }

    /**
     * 处理保存股票
     */
    function handleSaveStock() {
        console.log('=== 开始保存股票 ===');

        // 检查元素是否存在
        if (!elements.stockCode || !elements.stockName || !elements.fairValue || !elements.buyDiscount) {
            console.error('表单元素未初始化！');
            showToast('系统错误：表单元素未初始化', 'error');
            return;
        }

        console.log('stockCode:', elements.stockCode.value);
        console.log('stockName:', elements.stockName.value);
        console.log('fairValue:', elements.fairValue.value);
        console.log('buyDiscount:', elements.buyDiscount.value);

        const code = elements.stockCode.value.trim();
        const name = elements.stockName.value.trim();
        const industry = elements.industry.value.trim();
        const reportDate = elements.reportDate.value.trim();
        const growthRate = elements.growthRate.value.trim();
        const fairValue = parseFloat(elements.fairValue.value);
        const buyDiscount = parseInt(elements.buyDiscount.value);
        const note = elements.note.value.trim();

        // 验证
        console.log('开始验证...');
        if (!code) {
            console.log('验证失败：缺少股票代码');
            showToast('请输入股票代码', 'error');
            return;
        }
        if (!name) {
            console.log('验证失败：缺少股票名称');
            showToast('请输入股票名称', 'error');
            return;
        }
        if (isNaN(fairValue) || fairValue <= 0) {
            console.log('验证失败：合理估值价格无效', fairValue);
            showToast('请输入有效的合理估值价格', 'error');
            return;
        }
        if (isNaN(buyDiscount) || buyDiscount < 1 || buyDiscount > 100) {
            console.log('验证失败：建议折扣无效', buyDiscount);
            showToast('建议折扣必须在 1-100 之间', 'error');
            return;
        }
        console.log('验证通过');

        // 检测是否已存在
        const existingIndex = appState.stocks.findIndex(s => s.code === code);
        if (existingIndex >= 0) {
            console.log('验证失败：股票已存在');
            showToast('该股票代码已存在', 'error');
            return;
        }
        console.log('股票不存在，可以添加');

        // 创建股票对象
        const stock = {
            id: Date.now().toString(),
            code: code,
            name: name,
            industry: industry,
            reportDate: reportDate,
            growthRate: growthRate,
            fairValue: fairValue,
            buyDiscount: buyDiscount,
            note: note,
            order: appState.stocks.length,
            market: StockAPI.detectMarket(code),
            price: 0,
            pricePercent: 0,
            loading: true,
            error: null
        };

        appState.stocks.push(stock);
        console.log('股票已添加到数组:', stock);
        saveToStorage();
        console.log('已保存到 localStorage');
        closeModal();
        console.log('已关闭模态框');
        renderStockList();
        console.log('已渲染股票列表');
        fetchStockData(stock);
        updateStatusbar();
        console.log('已更新状态栏');

        showToast('添加成功', 'success');
        console.log('=== 保存完成 ===');
    }

    /**
     * 处理更新股票（编辑）
     */
    function handleUpdateStock() {
        const index = parseInt(elements.editStockIndex.value);

        if (index < 0 || index >= appState.stocks.length) {
            showToast('无效的股票索引', 'error');
            return;
        }

        const stock = appState.stocks[index];

        stock.industry = elements.editIndustry.value.trim();
        stock.reportDate = elements.editReportDate.value.trim();
        stock.growthRate = elements.editGrowthRate.value.trim();
        stock.fairValue = parseFloat(elements.editFairValue.value) || 0;
        stock.buyDiscount = parseInt(elements.editBuyDiscount.value) || 0;
        stock.note = elements.editNote.value.trim();

        saveToStorage();
        closeEditModal();
        renderStockList();
        showToast('更新成功', 'success');
    }

    /**
     * 打开编辑模态框
     */
    function openEditModal(index) {
        const stock = appState.stocks[index];
        if (!stock) return;

        elements.editModalTitle.textContent = `编辑股票 - ${stock.name}`;
        elements.editStockIndex.value = index;

        elements.editIndustry.value = stock.industry || '';
        elements.editReportDate.value = stock.reportDate || '';
        elements.editGrowthRate.value = stock.growthRate || '';
        elements.editFairValue.value = stock.fairValue || '';
        elements.editBuyDiscount.value = stock.buyDiscount || '';
        elements.editNote.value = stock.note || '';

        elements.editModalOverlay.classList.add('active');
    }

    /**
     * 删除股票
     */
    function deleteStock(index) {
        if (!confirm('确定要删除这只股票吗？')) return;

        appState.stocks.splice(index, 1);

        // 重新排序
        appState.stocks.forEach((s, i) => s.order = i);

        saveToStorage();
        renderStockList();
        updateStatusbar();
        showToast('删除成功', 'success');
    }

    /**
     * 关闭模态框
     */
    function closeModal() {
        elements.modalOverlay.classList.remove('active');
    }

    /**
     * 关闭编辑模态框
     */
    function closeEditModal() {
        elements.editModalOverlay.classList.remove('active');
    }

    /**
     * 匹配股票代码（支持纯数字和带前缀的格式）
     * 例如：300274 可以匹配 sz300274、sz300274、300274
     */
    function matchStockCode(storedCode, apiCode) {
        // 完全匹配
        if (storedCode === apiCode) return true;

        // 去除前缀后比较
        const storedPure = storedCode.replace(/^(sh|sz|hk|SH|SZ|HK)/i, '');
        const apiPure = apiCode.replace(/^(sh|sz|hk|SH|SZ|HK)/i, '');

        return storedPure === apiPure;
    }

    // ========================================
    // 数据获取
    // ========================================

    /**
     * 手动刷新
     */
    function handleRefresh() {
        if (appState.stocks.length === 0) {
            showToast('暂无股票数据', 'warning');
            return;
        }

        elements.refreshBtn.innerHTML = '<span class="loading"></span> 刷新中';
        elements.refreshBtn.disabled = true;

        fetchAllStockData().finally(() => {
            elements.refreshBtn.innerHTML = '🔄 刷新';
            elements.refreshBtn.disabled = false;
        });
    }

    /**
     * 获取单只股票数据
     */
    function fetchStockData(stock) {
        stock.loading = true;
        stock.error = null;

        StockAPI.getSingleStockData(stock.code)
            .then(data => {
                stock.price = data.price;
                stock.name = data.name || stock.name; // 更新股票名称
                stock.pricePercent = stock.fairValue > 0
                    ? (stock.price / stock.fairValue * 100)
                    : 0;
                stock.loading = false;
                renderStockList();
            })
            .catch(error => {
                console.error(`获取 ${stock.code} 数据失败:`, error);
                stock.error = error.message;
                stock.loading = false;
                renderStockList();
            });
    }

    /**
     * 获取所有股票数据
     */
    let isRefreshing = false;  // 防止重复刷新

    async function fetchAllStockData() {
        if (appState.stocks.length === 0) return;
        if (isRefreshing) {
            console.log('数据刷新中，跳过本次请求...');
            return;
        }

        isRefreshing = true;

        // 设置所有股票为加载状态
        appState.stocks.forEach(stock => {
            stock.loading = true;
            stock.error = null;
        });
        renderStockList();
        updateStatusbar();

        const codes = appState.stocks.map(s => s.code);
        const startTime = Date.now();

        try {
            const result = await StockAPI.getBatchStockData(codes);
            const endTime = Date.now();
            console.log(`批量获取完成：耗时 ${endTime - startTime}ms, 成功 ${result.successCount || result.results.length}/${codes.length}`);

            // 更新数据 - api.js 现在返回带市场前缀的 code
            result.results.forEach(data => {
                // 优先匹配带前缀的代码，如果没有则尝试纯数字匹配
                let stock = appState.stocks.find(s => s.code === data.code);

                // 如果没找到，尝试用 pureCode 匹配
                if (!stock && data.pureCode) {
                    stock = appState.stocks.find(s => matchStockCode(s.code, data.pureCode));
                }

                // 如果还是没找到，尝试用纯数字匹配
                if (!stock) {
                    const pureApiCode = data.code.replace(/^(sh|sz|hk|SH|SZ|HK)/i, '');
                    stock = appState.stocks.find(s => matchStockCode(s.code, pureApiCode));
                }

                if (stock) {
                    stock.price = data.price;
                    stock.name = data.name || stock.name;
                    stock.pricePercent = stock.fairValue > 0
                        ? (stock.price / stock.fairValue * 100)
                        : 0;
                    stock.loading = false;
                    stock.error = null;
                    console.log(`✓ 更新股票 ${stock.code}(${stock.name}): 价格=¥${data.price}`);
                } else {
                    console.warn(`✗ 未找到匹配的股票：api 返回 code=${data.code}, pureCode=${data.pureCode}`);
                }
            });

            // 标记错误
            result.errors.forEach(err => {
                const stock = appState.stocks.find(s => matchStockCode(s.code, err.code));
                if (stock) {
                    stock.error = err.error || '获取失败';
                    stock.loading = false;
                }
            });

            appState.lastUpdateTime = new Date();
            saveToStorage();
            renderStockList();
            updateStatusbar();

            // 显示刷新结果提示
            const successCount = result.successCount || result.results.length;
            const errorCount = result.errorCount || result.errors.length;

            if (errorCount > 0) {
                console.warn(`部分股票获取失败 (${errorCount}/${codes.length}):`, result.errors);
                console.log('完整结果:', JSON.stringify(result, null, 2));
                showToast(`刷新完成：成功 ${successCount}, 失败 ${errorCount}`, errorCount > codes.length/2 ? 'error' : 'warning');
            } else {
                showToast(`刷新完成 (${successCount}只股票)`, 'success');
            }

        } catch (error) {
            console.error('刷新失败:', error);
            showToast('刷新失败：' + error.message, 'error');

            // 恢复加载状态
            appState.stocks.forEach(stock => {
                stock.loading = false;
                stock.error = error.message;
            });
            renderStockList();
            updateStatusbar();

        } finally {
            isRefreshing = false;
        }
    }

    // ========================================
    // 自动刷新
    // ========================================

    /**
     * 启动自动刷新
     */
    function startAutoRefresh() {
        if (appState.refreshTimer) {
            clearInterval(appState.refreshTimer);
        }

        appState.refreshTimer = setInterval(() => {
            if (appState.autoRefresh && appState.stocks.length > 0) {
                fetchAllStockData();
            }
        }, REFRESH_INTERVAL);
    }

    /**
     * 停止自动刷新
     */
    function stopAutoRefresh() {
        if (appState.refreshTimer) {
            clearInterval(appState.refreshTimer);
            appState.refreshTimer = null;
        }
    }

    // ========================================
    // 渲染
    // ========================================

    /**
     * 渲染股票列表
     */
    function renderStockList() {
        if (appState.stocks.length === 0) {
            elements.emptyState.style.display = 'block';
            elements.stockTableBody.innerHTML = '';
            elements.stockCardsContainer.innerHTML = '';
            return;
        }

        elements.emptyState.style.display = 'none';

        // 按 order 排序
        const sortedStocks = [...appState.stocks].sort((a, b) => a.order - b.order);

        renderTable(sortedStocks);
        renderCards(sortedStocks);
    }

    /**
     * 渲染表格视图
     */
    function renderTable(stocks) {
        const html = stocks.map((stock, displayIndex) => {
            const originalIndex = appState.stocks.findIndex(s => s.id === stock.id);
            const shouldHighlight = shouldHighlightStock(stock);

            // 计算涨跌额和涨跌幅
            const change = stock.close ? (stock.price - stock.close).toFixed(2) : 0;
            const changePercent = stock.close ? ((stock.price - stock.close) / stock.close * 100).toFixed(2) : 0;
            const changeClass = changePercent >= 0 ? 'text-up' : 'text-down';

            return `
                <tr class="${shouldHighlight ? 'highlight' : ''}"
                    data-id="${stock.id}"
                    data-index="${originalIndex}"
                    draggable="true">
                    <td class="drag-handle" title="拖拽排序"></td>
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <span class="stock-name">${stock.loading ? '<span class="loading"></span>' : stock.name}</span>
                            <span class="cell-code">${stock.code}</span>
                        </div>
                        ${stock.error ? `<span class="text-up" title="${stock.error}">⚠️</span>` : ''}
                    </td>
                    <td>${stock.industry || '-'}</td>
                    <td>${stock.reportDate || '-'}</td>
                    <td>${stock.growthRate || '-'}</td>
                    <td style="font-weight: 600;">${stock.fairValue ? stock.fairValue.toFixed(2) : '-'}</td>
                    <td><span class="badge badge-primary">${stock.buyDiscount ? stock.buyDiscount + '%' : '-'}</span></td>
                    <td>
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <span class="cell-price ${getPriceClass(stock.price, stock.pricePercent)}">
                                ${stock.loading ? '<span class="loading"></span>' : (stock.price ? stock.price.toFixed(2) : '-')}
                            </span>
                            ${stock.close ? `
                                <span class="trend-indicator ${changeClass}" style="font-size: 11px;">
                                    ${changePercent >= 0 ? '↑' : '↓'}${change} (${changePercent}%)
                                </span>
                            ` : ''}
                        </div>
                    </td>
                    <td>
                        ${stock.pricePercent ? `
                            <span class="cell-percent ${getPriceClass(stock.price, stock.pricePercent)} ${shouldHighlight ? 'highlight' : ''}">
                                ${stock.pricePercent.toFixed(1)}%
                            </span>
                        ` : '-'}
                    </td>
                    <td>
                        <span class="note-link" onclick="window.viewNote(${originalIndex})" style="cursor: pointer; color: var(--primary-color); text-decoration: underline;" title="点击查看完整备注">
                            ${stock.note ? (stock.note.length > 10 ? stock.note.substring(0, 10) + '...' : stock.note) : '-'}
                        </span>
                    </td>
                    <td>
                        <a href="${StockAPI.getYiNiuLink(stock.code, stock.market)}"
                           target="_blank"
                           class="data-link">📈 查看</a>
                    </td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn action-btn-edit"
                                    onclick="window.editStock(${originalIndex})"
                                    title="编辑">✏️</button>
                            <button class="action-btn action-btn-delete"
                                    onclick="window.deleteStock(${originalIndex})"
                                    title="删除">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        elements.stockTableBody.innerHTML = html;
        initDragAndDrop();
    }

    /**
     * 渲染卡片视图（移动端）
     */
    function renderCards(stocks) {
        const html = stocks.map((stock, displayIndex) => {
            const originalIndex = appState.stocks.findIndex(s => s.id === stock.id);
            const shouldHighlight = shouldHighlightStock(stock);

            // 计算涨跌额和涨跌幅
            const change = stock.close ? (stock.price - stock.close).toFixed(2) : 0;
            const changePercent = stock.close ? ((stock.price - stock.close) / stock.close * 100).toFixed(2) : 0;
            const changeClass = changePercent >= 0 ? 'text-up' : 'text-down';

            return `
                <div class="stock-card ${shouldHighlight ? 'highlight' : ''}"
                     data-id="${stock.id}"
                     data-index="${originalIndex}">
                    <div class="stock-card-header">
                        <div class="stock-card-title">
                            <div class="stock-card-name">${stock.loading ? '<span class="loading"></span>' : stock.name}</div>
                            <div class="stock-card-code">${stock.code} ${stock.market ? `<span class="badge badge-primary">${stock.market.toUpperCase()}</span>` : ''}</div>
                        </div>
                        <div class="stock-card-price">
                            <div class="stock-card-price-value ${getPriceClass(stock.price, stock.pricePercent)}">
                                ${stock.loading ? '<span class="loading"></span>' : (stock.price ? '¥' + stock.price.toFixed(2) : '-')}
                            </div>
                            ${stock.close ? `
                                <div class="stock-card-price-change ${changeClass}">
                                    ${changePercent >= 0 ? '↑' : '↓'}${change} (${changePercent}%)
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="stock-card-body">
                        <div class="stock-card-grid">
                            <div class="stock-card-item">
                                <span class="stock-card-label">价格百分位</span>
                                <span class="stock-card-value ${getPriceClass(stock.price, stock.pricePercent)} ${shouldHighlight ? 'highlight' : ''}" style="font-size: 18px; font-weight: 700;">
                                    ${stock.pricePercent ? stock.pricePercent.toFixed(1) + '%' : '-'}
                                </span>
                            </div>
                            <div class="stock-card-item">
                                <span class="stock-card-label">合理估值</span>
                                <span class="stock-card-value">${stock.fairValue ? '¥' + stock.fairValue.toFixed(2) : '-'}</span>
                            </div>
                            <div class="stock-card-item">
                                <span class="stock-card-label">建议折扣</span>
                                <span class="stock-card-value" style="color: var(--warning-color);">${stock.buyDiscount ? stock.buyDiscount + '%' : '-'}</span>
                            </div>
                            <div class="stock-card-item">
                                <span class="stock-card-label">所属行业</span>
                                <span class="stock-card-value">${stock.industry || '-'}</span>
                            </div>
                            <div class="stock-card-item">
                                <span class="stock-card-label">财报更新</span>
                                <span class="stock-card-value">${stock.reportDate || '-'}</span>
                            </div>
                            <div class="stock-card-item">
                                <span class="stock-card-label">业绩增速</span>
                                <span class="stock-card-value">${stock.growthRate || '-'}</span>
                            </div>
                            ${stock.note ? `
                            <div class="stock-card-item" style="grid-column: 1 / -1;">
                                <span class="stock-card-label">备注</span>
                                <span class="stock-card-value" style="font-size: 13px; font-weight: 400; color: var(--text-secondary);">${stock.note}</span>
                            </div>
                            ` : ''}
                            <div class="stock-card-item" style="grid-column: 1 / -1;">
                                <span class="stock-card-label">历史市盈率</span>
                                <a href="${StockAPI.getYiNiuLink(stock.code, stock.market)}"
                                   target="_blank"
                                   class="data-link" style="font-size: 13px;">📈 查看历史 PE（亿牛网）</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        elements.stockCardsContainer.innerHTML = html;
    }

    /**
     * 获取价格样式类
     */
    function getPriceClass(price, percent) {
        if (!price) return '';
        if (percent <= 80) return 'text-down';  // 低估（绿色）
        if (percent >= 120) return 'text-up';   // 高估（红色）
        return 'text-flat';
    }

    /**
     * 判断是否应该高亮
     */
    function shouldHighlightStock(stock) {
        if (!stock.price || !stock.buyDiscount || !stock.pricePercent) {
            return false;
        }
        // 价格百分位 <= 建议买入折扣时高亮
        return stock.pricePercent <= stock.buyDiscount;
    }

    // ========================================
    // 拖拽排序
    // ========================================
    let dragSrcEl = null;
    let dragSrcIndex = null;
    let touchSrcIndex = null;
    let touchPlaceholder = null;

    /**
     * 初始化拖拽（支持桌面和移动端）
     */
    function initDragAndDrop() {
        const rows = elements.stockTableBody.querySelectorAll('tr[draggable="true"]');

        rows.forEach(row => {
            // 桌面端拖拽事件
            row.addEventListener('dragstart', handleDragStart);
            row.addEventListener('dragenter', handleDragEnter);
            row.addEventListener('dragover', handleDragOver);
            row.addEventListener('dragleave', handleDragLeave);
            row.addEventListener('drop', handleDrop);
            row.addEventListener('dragend', handleDragEnd);

            // 移动端触摸事件
            row.addEventListener('touchstart', handleTouchStart, { passive: true });
            row.addEventListener('touchmove', handleTouchMove, { passive: false });
            row.addEventListener('touchend', handleTouchEnd);
        });
    }

    /**
     * 移动端触摸开始
     */
    function handleTouchStart(e) {
        if (!e.target.closest('.drag-handle')) return;

        touchSrcIndex = parseInt(this.dataset.index);
        this.classList.add('dragging');

        // 创建占位符
        touchPlaceholder = this.cloneNode(true);
        touchPlaceholder.classList.add('touch-placeholder');
        touchPlaceholder.style.opacity = '0.3';
    }

    /**
     * 移动端触摸移动
     */
    function handleTouchMove(e) {
        if (touchSrcIndex === null) return;
        e.preventDefault();

        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetRow = target ? target.closest('tr') : null;

        if (targetRow && targetRow !== this) {
            const targetIndex = parseInt(targetRow.dataset.index);
            if (targetIndex !== touchSrcIndex) {
                // 交换 order 值
                const srcStock = appState.stocks[touchSrcIndex];
                const targetStock = appState.stocks[targetIndex];

                const tempOrder = srcStock.order;
                srcStock.order = targetStock.order;
                targetStock.order = tempOrder;

                touchSrcIndex = targetIndex;
                saveToStorage();
                renderStockList();
            }
        }
    }

    /**
     * 移动端触摸结束
     */
    function handleTouchEnd(e) {
        this.classList.remove('dragging');
        touchSrcIndex = null;
        if (touchPlaceholder) {
            touchPlaceholder.remove();
            touchPlaceholder = null;
        }
    }

    function handleDragStart(e) {
        dragSrcEl = this;
        dragSrcIndex = parseInt(this.dataset.index);
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragSrcIndex);
    }

    function handleDragEnter(e) {
        this.classList.add('drag-over');
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    function handleDragLeave(e) {
        this.classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.stopPropagation();

        const targetIndex = parseInt(this.dataset.index);

        if (dragSrcIndex !== targetIndex) {
            // 交换 order 值
            const srcStock = appState.stocks[dragSrcIndex];
            const targetStock = appState.stocks[targetIndex];

            const tempOrder = srcStock.order;
            srcStock.order = targetStock.order;
            targetStock.order = tempOrder;

            saveToStorage();
            renderStockList();
        }

        return false;
    }

    function handleDragEnd(e) {
        this.classList.remove('dragging');
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }

    // ========================================
    // 数据导入导出
    // ========================================

    /**
     * 导出数据
     */
    function handleExportData() {
        if (appState.stocks.length === 0) {
            showToast('暂无数据可导出', 'warning');
            return;
        }

        // 导出完整数据（包含元数据）
        const exportData = {
            version: '1.0',
            exportTime: new Date().toISOString(),
            count: appState.stocks.length,
            stocks: appState.stocks.map(s => ({
                id: s.id,
                code: s.code,
                name: s.name,
                industry: s.industry || '',
                reportDate: s.reportDate || '',
                growthRate: s.growthRate || '',
                fairValue: s.fairValue,
                buyDiscount: s.buyDiscount,
                note: s.note || '',
                order: s.order,
                market: s.market
            }))
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `股票数据_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast(`导出成功 (${appState.stocks.length}只股票)`, 'success');
    }

    /**
     * 导入数据
     */
    function handleImportData(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 验证文件类型
        if (!file.name.endsWith('.json')) {
            showToast('请选择 JSON 格式文件', 'error');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedData = JSON.parse(event.target.result);

                // 兼容旧格式（直接是数组）
                let data;
                if (Array.isArray(importedData)) {
                    data = importedData;
                } else if (importedData.stocks && Array.isArray(importedData.stocks)) {
                    data = importedData.stocks;
                } else {
                    throw new Error('数据格式错误：无法识别的数据结构');
                }

                if (data.length === 0) {
                    showToast('导入文件为空', 'warning');
                    e.target.value = '';
                    return;
                }

                // 验证数据结构
                for (let i = 0; i < data.length; i++) {
                    const stock = data[i];
                    if (!stock.code || !stock.name) {
                        throw new Error(`第${i+1}条数据缺少必要字段（code 或 name）`);
                    }
                    if (typeof stock.fairValue !== 'number' || typeof stock.buyDiscount !== 'number') {
                        throw new Error(`第${i+1}条数据格式错误（估值和折扣必须是数字）`);
                    }
                }

                // 统计信息
                const newStocks = data.filter(s => !appState.stocks.find(existing => existing.code === s.code));
                const duplicateStocks = data.filter(s => appState.stocks.find(existing => existing.code === s.code));

                const confirmMsg = `发现 ${data.length} 只股票数据\n` +
                                   `新股票：${newStocks.length} 只\n` +
                                   `重复股票：${duplicateStocks.length} 只\n\n` +
                                   `点击"确定"合并数据（跳过重复）\n点击"取消"清空当前数据并导入`;

                if (confirm(confirmMsg)) {
                    // 合并模式：只添加不重复的股票
                    let added = 0;
                    const existingCodes = new Set(appState.stocks.map(s => s.code));
                    data.forEach(stock => {
                        if (!existingCodes.has(stock.code)) {
                            // 确保有必要的字段
                            const newStock = {
                                id: stock.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
                                code: stock.code,
                                name: stock.name,
                                industry: stock.industry || '',
                                reportDate: stock.reportDate || '',
                                growthRate: stock.growthRate || '',
                                fairValue: Number(stock.fairValue),
                                buyDiscount: Number(stock.buyDiscount),
                                note: stock.note || '',
                                order: appState.stocks.length,
                                market: stock.market || StockAPI.detectMarket(stock.code),
                                price: 0,
                                pricePercent: 0,
                                loading: true,
                                error: null
                            };
                            appState.stocks.push(newStock);
                            existingCodes.add(stock.code);
                            added++;
                        }
                    });
                    saveToStorage();
                    renderStockList();
                    updateStatusbar();
                    showToast(`合并完成，新增 ${added} 只股票`, 'success');
                } else {
                    // 替换模式：清空当前数据
                    appState.stocks = data.map((stock, i) => ({
                        id: stock.id || Date.now().toString() + i,
                        code: stock.code,
                        name: stock.name,
                        industry: stock.industry || '',
                        reportDate: stock.reportDate || '',
                        growthRate: stock.growthRate || '',
                        fairValue: Number(stock.fairValue),
                        buyDiscount: Number(stock.buyDiscount),
                        note: stock.note || '',
                        order: i,
                        market: stock.market || StockAPI.detectMarket(stock.code),
                        price: 0,
                        pricePercent: 0,
                        loading: true,
                        error: null
                    }));
                    saveToStorage();
                    renderStockList();
                    updateStatusbar();
                    showToast(`导入成功 (${data.length}只股票)`, 'success');
                }

            } catch (error) {
                console.error('导入失败:', error);
                showToast(`导入失败：${error.message}`, 'error');
            }
        };

        reader.onerror = function() {
            showToast('读取文件失败', 'error');
        };

        reader.readAsText(file);
        e.target.value = ''; // 重置 input
    }

    /**
     * 清空全部
     */
    function handleClearAll() {
        if (!confirm('确定要清空所有股票数据吗？此操作不可恢复！')) return;

        appState.stocks = [];
        saveToStorage();
        renderStockList();
        updateOverview();
        updateStatusbar();
        showToast('已清空所有数据', 'success');
    }

    /**
     * 切换自动刷新
     */
    function handleToggleAutoRefresh() {
        appState.autoRefresh = !appState.autoRefresh;

        if (appState.autoRefresh) {
            startAutoRefresh();
            elements.toggleAutoRefreshBtn.textContent = '⏸️ 暂停刷新';
            showToast('已开启自动刷新', 'success');
        } else {
            stopAutoRefresh();
            elements.toggleAutoRefreshBtn.textContent = '▶️ 继续刷新';
            showToast('已暂停自动刷新', 'warning');
        }

        updateStatusbar();
    }

    // ========================================
    // 概览面板更新
    // ========================================

    /**
     * 更新概览面板
     */
    function updateOverview() {
        const total = appState.stocks.length;

        // 计算低估、机会、高估数量
        let advantageCount = 0;  // 低于合理估值
        let opportunityCount = 0;  // 达到买入折扣
        let overvaluedCount = 0;  // 高于合理估值

        appState.stocks.forEach(stock => {
            if (stock.price && stock.fairValue && stock.pricePercent) {
                // 低于合理估值（价格 < 合理估值）
                if (stock.price < stock.fairValue) {
                    advantageCount++;
                }
                // 高于合理估值
                if (stock.price > stock.fairValue) {
                    overvaluedCount++;
                }
                // 达到买入折扣（价格百分位 <= 建议折扣）
                if (stock.pricePercent <= stock.buyDiscount) {
                    opportunityCount++;
                }
            }
        });

        // 更新概览面板
        if (elements.overviewTotal) {
            elements.overviewTotal.textContent = total;
        }
        if (elements.overviewAdvantage) {
            elements.overviewAdvantage.textContent = advantageCount;
        }
        if (elements.overviewOpportunity) {
            elements.overviewOpportunity.textContent = opportunityCount;
        }
        if (elements.overviewOvervalued) {
            elements.overviewOvervalued.textContent = overvaluedCount;
        }
    }

    // ========================================
    // 状态栏更新
    // ========================================

    /**
     * 更新状态栏
     */
    function updateStatusbar() {
        // 更新时间
        if (appState.lastUpdateTime) {
            const time = appState.lastUpdateTime;
            const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
            if (elements.lastUpdateTime) {
                elements.lastUpdateTime.textContent = `上次更新：${timeStr}`;
            }
        } else {
            if (elements.lastUpdateTime) {
                elements.lastUpdateTime.textContent = '上次更新：--';
            }
        }

        // 自动刷新状态
        if (elements.autoRefreshStatus) {
            elements.autoRefreshStatus.innerHTML = `自动刷新：<span class="${appState.autoRefresh ? 'status-on' : 'status-off'}">${appState.autoRefresh ? '开启' : '关闭'}</span>`;
        }

        // 更新概览面板
        updateOverview();
    }

    // ========================================
    // 提示消息
    // ========================================

    /**
     * 显示提示消息
     */
    function showToast(message, type = 'info') {
        elements.toast.textContent = message;
        elements.toast.className = `toast ${type} show`;

        setTimeout(() => {
            elements.toast.classList.remove('show');
        }, 3000);
    }

    // ========================================
    // 暴露全局方法
    // ========================================
    window.editStock = function(index) {
        openEditModal(index);
    };

    window.deleteStock = function(index) {
        deleteStock(index);
    };

    window.selectStock = function(code, name, market) {
        selectStock(code, name, market);
    };

    window.viewNote = function(index) {
        viewNote(index);
    };

    // ========================================
    // 启动应用
    // ========================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
