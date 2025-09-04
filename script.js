class ShardCalculator {
    constructor() {
        this.IGNORED_SHARDS = [];

        this.SHARD_COUNT_BY_RARITY = {
            "C": 96,
            "U": 64,
            "R": 48,
            "E": 32,
            "L": 24
        };

        this.RARITY_NAMES = {
            "C": "Common",
            "U": "Uncommon",
            "R": "Rare",
            "E": "Epic",
            "L": "Legendary"
        };

        // User's custom ignored shards (stored in localStorage)
        this.userIgnoredShards = new Set(JSON.parse(localStorage.getItem('ignoredShards') || '[]'));
        
        // Store both insta buy and buy order data
        this.instaBuyResults = [];
        this.buyOrderResults = [];
        
        this.shardsData = [];
        this.bazaarData = {};
        this.calculatedResults = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.currentSort = { column: 'instaBuyTotal', direction: 'asc' };

        this.initializeElements();
        this.attachEventListeners();
        this.loadShardsData();
    }

    initializeElements() {
        // Control buttons
        this.calculateBtn = document.getElementById('calculateBtn');
        this.retryBtn = document.getElementById('retryBtn');
        this.manageShardsBtn = document.getElementById('manageShardsBtn');
        this.exportBtn = document.getElementById('exportBtn');

        // Management interface
        this.shardManagementModal = document.getElementById('shardManagementModal');
        this.modalBackdrop = document.getElementById('modalBackdrop');
        this.closeMgmtBtn = document.getElementById('closeMgmtBtn');
        this.shardSearch = document.getElementById('shardSearch');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.shardList = document.getElementById('shardList');

        // Filter buttons
        this.filterBtns = document.querySelectorAll('.filter-btn');
        
        // Sortable headers
        this.sortableHeaders = document.querySelectorAll('.sortable');

        // State elements
        this.loadingSpinner = document.getElementById('loadingSpinner');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorText = document.getElementById('errorText');
        this.resultsTable = document.getElementById('resultsTable');
        this.tableBody = document.getElementById('tableBody');

        // Statistics
        this.totalShards = document.getElementById('totalShards');
        this.ignoredShards = document.getElementById('ignoredShards');
        this.lastUpdated = document.getElementById('lastUpdated');
        
        // Total cost displays
        this.instaBuyTotal = document.getElementById('instaBuyTotal');
        this.buyOrderTotal = document.getElementById('buyOrderTotal');
    }

    attachEventListeners() {
        // Main buttons
        this.calculateBtn.addEventListener('click', () => this.calculateShardCosts());
        this.retryBtn.addEventListener('click', () => this.calculateShardCosts());
        this.manageShardsBtn.addEventListener('click', () => this.toggleShardManagement());
        
        // Management buttons
        this.closeMgmtBtn.addEventListener('click', () => this.hideShardManagement());
        this.modalBackdrop.addEventListener('click', () => this.hideShardManagement());
        this.selectAllBtn.addEventListener('click', () => this.toggleAllShards(true));
        this.clearAllBtn.addEventListener('click', () => this.toggleAllShards(false));
        
        // Search and filter
        this.shardSearch.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilter(e.target.dataset.rarity));
        });
        
        // Sortable headers
        this.sortableHeaders.forEach(header => {
            header.addEventListener('click', (e) => this.handleSort(e.currentTarget.dataset.sort));
        });

        // Export
        if (this.exportBtn) {
            this.exportBtn.addEventListener('click', () => this.exportResults());
        }
        
        // Keyboard support for modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.shardManagementModal.classList.contains('hidden')) {
                this.hideShardManagement();
            }
        });

    }

    async loadShardsData() {
        try {
            const response = await fetch('shards.json');
            if (!response.ok) {
                throw new Error(`Failed to load shards data: ${response.status}`);
            }
            this.shardsData = await response.json();
            this.updateStatistics();
            this.populateShardList();
            
            // Automatically fetch bazaar data after loading shards
            this.calculateShardCosts();
        } catch (error) {
            console.error('Error loading shards data:', error);
            this.showError(`Failed to load shards data: ${error.message}`);
        }
    }

    updateStatistics() {
        const availableShards = this.getAvailableShards();
        this.totalShards.textContent = availableShards.length;
        this.ignoredShards.textContent = this.getAllIgnoredShards().size;
    }

    getAvailableShards() {
        const allIgnored = this.getAllIgnoredShards();
        return this.shardsData.filter(shard => !allIgnored.has(shard.name));
    }

    getAllIgnoredShards() {
        return this.userIgnoredShards;
    }

    populateShardList() {
        if (this.shardsData.length === 0) return;

        this.shardList.innerHTML = '';
        
        const filteredShards = this.shardsData.filter(shard => {
            const matchesSearch = shard.name.toLowerCase().includes(this.searchQuery.toLowerCase());
            const matchesFilter = this.currentFilter === 'all' || shard.id[0] === this.currentFilter;
            return matchesSearch && matchesFilter;
        });

        filteredShards.forEach(shard => {
            const shardItem = this.createShardItem(shard);
            this.shardList.appendChild(shardItem);
        });
    }

    createShardItem(shard) {
        const isIgnored = this.userIgnoredShards.has(shard.name);
        
        const item = document.createElement('div');
        item.className = `shard-item ${isIgnored ? 'ignored' : ''}`;
        
        const rarity = this.RARITY_NAMES[shard.id[0]];
        const rarityClass = rarity.toLowerCase();
        
        item.innerHTML = `
            <div class="shard-checkbox ${isIgnored ? 'checked' : ''}" data-shard="${shard.name}">
                ${isIgnored ? '<i class="fas fa-times"></i>' : ''}
            </div>
            <div class="shard-info">
                <div class="shard-name">${shard.name}</div>
                <div class="shard-details">
                    <span class="shard-id">${shard.id}</span>
                    <span class="rarity-badge rarity-${rarityClass}">${rarity}</span>
                </div>
            </div>
        `;

        item.addEventListener('click', () => this.toggleShardIgnore(shard.name));

        return item;
    }

    toggleShardIgnore(shardName) {
        if (this.userIgnoredShards.has(shardName)) {
            this.userIgnoredShards.delete(shardName);
        } else {
            this.userIgnoredShards.add(shardName);
        }
        
        this.saveIgnoredShards();
        this.updateStatistics();
        this.populateShardList();
        
        // Only refresh chart if this is NOT being called from the table ignore button
        // (to avoid double refresh)
        if (!this.isToggleFromTable) {
            this.refreshChartIfNeeded();
        }
    }

    toggleAllShards(ignore) {
        if (ignore) {
            // For "Select All", only affect the filtered/visible shards
            const filteredShards = this.shardsData.filter(shard => {
                const matchesSearch = shard.name.toLowerCase().includes(this.searchQuery.toLowerCase());
                const matchesFilter = this.currentFilter === 'all' || shard.id[0] === this.currentFilter;
                return matchesSearch && matchesFilter;
            });

            filteredShards.forEach(shard => {
                this.userIgnoredShards.add(shard.name);
            });
        } else {
            // For "Clear All", clear ALL ignored shards regardless of current filter/search
            this.userIgnoredShards.clear();
        }

        this.saveIgnoredShards();
        this.updateStatistics();
        this.populateShardList();
        
        // Refresh the chart results if they exist
        this.refreshChartIfNeeded();
    }

    handleSearch(query) {
        this.searchQuery = query;
        this.populateShardList();
    }

    handleSort(column) {
        if (this.currentSort.column === column) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.column = column;
            this.currentSort.direction = 'asc';
        }
        
        this.sortResults();
        this.updateSortIcons();
        this.displayResults();
    }

    sortResults() {
        const { column, direction } = this.currentSort;
        
        this.calculatedResults.sort((a, b) => {
            let valueA = a[column];
            let valueB = b[column];
            
            if (direction === 'asc') {
                return valueA - valueB;
            } else {
                return valueB - valueA;
            }
        });
    }

    updateSortIcons() {
        this.sortableHeaders.forEach(header => {
            const icon = header.querySelector('.sort-icon');
            if (header.dataset.sort === this.currentSort.column) {
                icon.className = `fas fa-sort-${this.currentSort.direction === 'asc' ? 'up' : 'down'} sort-icon`;
            } else {
                icon.className = 'fas fa-sort sort-icon';
            }
        });
    }

    toggleShardIgnoreFromTable(shardName) {
        this.isToggleFromTable = true;
        this.toggleShardIgnore(shardName);
        this.isToggleFromTable = false;
        this.refreshChartIfNeeded();
    }

    refreshChartIfNeeded() {
        // Refresh the results if bazaar data is available
        if (this.bazaarData && Object.keys(this.bazaarData).length > 0) {
            const results = this.processShardCosts();
            this.instaBuyResults = results.instaBuy;
            this.buyOrderResults = results.buyOrder;
            this.calculatedResults = results.instaBuy;
            this.sortResults();
            this.displayResults();
            this.updateTotalCosts();
        }
    }

    handleFilter(rarity) {
        this.currentFilter = rarity;
        
        // Update filter button states
        this.filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.rarity === rarity);
        });
        
        this.populateShardList();
    }

    saveIgnoredShards() {
        localStorage.setItem('ignoredShards', JSON.stringify([...this.userIgnoredShards]));
    }

    toggleShardManagement() {
        if (this.shardManagementModal.classList.contains('hidden')) {
            this.showShardManagement();
        } else {
            this.hideShardManagement();
        }
    }

    showShardManagement() {
        this.shardManagementModal.classList.remove('hidden');
        this.populateShardList();
        // Prevent body scroll when modal is open
        document.body.style.overflow = 'hidden';
    }

    hideShardManagement() {
        this.shardManagementModal.classList.add('hidden');
        // Re-enable body scroll when modal is closed
        document.body.style.overflow = '';
    }

    async fetchBazaarData() {
        const response = await fetch('https://api.hypixel.net/skyblock/bazaar');
        if (!response.ok) {
            throw new Error(`Bazaar API returned ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Bazaar API returned unsuccessful response');
        }
        
        return data.products;
    }

    async calculateShardCosts() {
        this.showLoading();
        this.disableButtons(true);

        try {
            if (this.shardsData.length === 0) {
                await this.loadShardsData();
            }

            this.bazaarData = await this.fetchBazaarData();
            const results = this.processShardCosts();
            this.instaBuyResults = results.instaBuy;
            this.buyOrderResults = results.buyOrder;
            this.calculatedResults = results.instaBuy; // Default to insta buy for main display
            this.displayResults();
            this.updateTotalCosts();
            this.updateLastUpdatedTime();

        } catch (error) {
            console.error('Error calculating shard costs:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            this.disableButtons(false);
        }
    }

    processShardCosts() {
        const instaBuyShards = [];
        const buyOrderShards = [];
        const allIgnored = this.getAllIgnoredShards();

        for (const shard of this.shardsData) {
            // Skip if shard is ignored by user
            if (allIgnored.has(shard.name)) {
                continue;
            }

            const shardRarity = shard.id[0];
            const requiredCount = this.SHARD_COUNT_BY_RARITY[shardRarity];
            const bazaarKey = `SHARD_${shard.name.replace(/\s+/g, '_').toUpperCase()}`;
            
            const productData = this.bazaarData[bazaarKey];
            if (!productData || !productData.quick_status) {
                console.warn(`No bazaar data found for ${shard.name} (${bazaarKey})`);
                continue;
            }

            const instaBuyPrice = productData.quick_status.buyPrice || 0;
            const buyOrderPrice = productData.quick_status.sellPrice || 0;
            
            if (instaBuyPrice === 0 && buyOrderPrice === 0) {
                console.warn(`Zero prices for ${shard.name}`);
                continue;
            }

            const shardData = {
                name: shard.name,
                rarity: shardRarity,
                rarityName: this.RARITY_NAMES[shardRarity],
                requiredCount: requiredCount,
                instaBuyPrice: instaBuyPrice,
                buyOrderPrice: buyOrderPrice,
                instaBuyTotal: requiredCount * instaBuyPrice,
                buyOrderTotal: requiredCount * buyOrderPrice,
                id: shard.id
            };

            if (instaBuyPrice > 0) {
                instaBuyShards.push(shardData);
            }
            if (buyOrderPrice > 0) {
                buyOrderShards.push(shardData);
            }
        }

        return {
            instaBuy: instaBuyShards.sort((a, b) => a.instaBuyTotal - b.instaBuyTotal),
            buyOrder: buyOrderShards.sort((a, b) => b.buyOrderTotal - a.buyOrderTotal)
        };
    }

    displayResults() {
        this.hideAllStates();
        this.resultsTable.classList.remove('hidden');

        this.tableBody.innerHTML = '';

        if (this.calculatedResults.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="9" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fas fa-info-circle"></i> No shards available for calculation.
                    <br><small>All shards may be ignored or have no bazaar data.</small>
                </td>
            `;
            this.tableBody.appendChild(row);
            return;
        }

        this.calculatedResults.forEach((shard, index) => {
            const row = this.createTableRow(shard, index + 1);
            this.tableBody.appendChild(row);
        });
    }

    createTableRow(shard, rank) {
        const row = document.createElement('tr');
        
        const isTop3 = rank <= 3;
        const rankClass = isTop3 ? 'rank-cell top-3' : 'rank-cell';
        const rarityClass = `rarity-${shard.rarityName.toLowerCase()}`;

        // Add rank icon for top 3
        let rankDisplay = `#${rank}`;
        if (rank === 1) rankDisplay = `<i class="fas fa-trophy"></i> #${rank}`;
        else if (rank === 2) rankDisplay = `<i class="fas fa-medal"></i> #${rank}`;
        else if (rank === 3) rankDisplay = `<i class="fas fa-award"></i> #${rank}`;

        row.innerHTML = `
            <td class="${rankClass}">${rankDisplay}</td>
            <td><strong>${shard.name}</strong></td>
            <td><span class="rarity-badge ${rarityClass}">${shard.rarityName}</span></td>
            <td>${shard.requiredCount.toLocaleString()}</td>
            <td>${this.formatCurrency(shard.instaBuyPrice)}</td>
            <td class="cost-cell">${this.formatCurrency(shard.instaBuyTotal)}</td>
            <td>${this.formatCurrency(shard.buyOrderPrice)}</td>
            <td class="cost-cell">${this.formatCurrency(shard.buyOrderTotal)}</td>
            <td>
                <button class="btn btn-small ignore-btn" data-shard="${shard.name}">
                    <i class="fas fa-eye-slash"></i>
                    Ignore
                </button>
            </td>
        `;
        
        // Add event listener for ignore button
        const ignoreBtn = row.querySelector('.ignore-btn');
        ignoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleShardIgnoreFromTable(shard.name);
        });

        return row;
    }

    formatCurrency(amount) {
        if (amount >= 1000000000) {
            return `${(amount / 1000000000).toFixed(2)}B`;
        } else if (amount >= 1000000) {
            return `${(amount / 1000000).toFixed(2)}M`;
        } else if (amount >= 1000) {
            return `${(amount / 1000).toFixed(1)}K`;
        } else {
            return Math.round(amount).toLocaleString();
        }
    }

    updateLastUpdatedTime() {
        const now = new Date();
        const timeString = now.toLocaleString('en-US', { 
            hour12: true,
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
        this.lastUpdated.textContent = timeString;
    }

    showLoading() {
        this.hideAllStates();
        this.loadingSpinner.classList.remove('hidden');
    }

    showError(message) {
        this.hideAllStates();
        this.errorText.textContent = message;
        this.errorMessage.classList.remove('hidden');
    }

    hideAllStates() {
        this.loadingSpinner.classList.add('hidden');
        this.errorMessage.classList.add('hidden');
        this.resultsTable.classList.add('hidden');
    }

    disableButtons(disabled) {
        this.calculateBtn.disabled = disabled;
        this.manageShardsBtn.disabled = disabled;
        
        if (disabled) {
            this.calculateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        } else {
            this.calculateBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        }
    }

    getErrorMessage(error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return 'Network error: Unable to connect to Hypixel API. Please check your internet connection and try again.';
        } else if (error.message.includes('CORS')) {
            return 'CORS error: Unable to access Hypixel API directly from browser. This is a browser security limitation.';
        } else if (error.message.includes('429')) {
            return 'Rate limited: Too many requests to Hypixel API. Please wait a moment and try again.';
        } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            return 'Hypixel API is currently unavailable. Please try again in a few minutes.';
        } else if (error.message.includes('404')) {
            return 'Hypixel API endpoint not found. The API may have changed.';
        } else {
            return `Error: ${error.message}. Please try again or check the console for more details.`;
        }
    }

    updateTotalCosts() {
        if (this.instaBuyTotal && this.buyOrderTotal) {
            const instaBuySum = this.instaBuyResults.reduce((sum, shard) => sum + shard.instaBuyTotal, 0);
            const buyOrderSum = this.buyOrderResults.reduce((sum, shard) => sum + shard.buyOrderTotal, 0);
            
            this.instaBuyTotal.textContent = this.formatCurrency(instaBuySum);
            this.buyOrderTotal.textContent = this.formatCurrency(buyOrderSum);
        }
    }

    exportResults() {
        if (this.calculatedResults.length === 0) {
            alert('No results to export. Please calculate shard costs first.');
            return;
        }

        // Create CSV content
        const headers = [
            'Rank',
            'Shard Name', 
            'Rarity',
            'Required Count',
            'Insta Buy Price',
            'Insta Buy Total',
            'Buy Order Price',
            'Buy Order Total'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        this.calculatedResults.forEach((shard, index) => {
            const row = [
                index + 1,
                `"${shard.name}"`, // Quote names in case they contain commas
                shard.rarityName,
                shard.requiredCount,
                shard.instaBuyPrice.toFixed(2),
                shard.instaBuyTotal.toFixed(2),
                shard.buyOrderPrice.toFixed(2),
                shard.buyOrderTotal.toFixed(2)
            ];
            csvContent += row.join(',') + '\n';
        });

        const dataBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `shard_costs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // Show success message
        const originalText = this.exportBtn.innerHTML;
        this.exportBtn.innerHTML = '<i class="fas fa-check"></i> Exported!';
        this.exportBtn.style.background = 'var(--success)';
        
        setTimeout(() => {
            this.exportBtn.innerHTML = originalText;
            this.exportBtn.style.background = '';
        }, 2000);
    }

    // Utility method to reset user preferences
    resetUserPreferences() {
        this.userIgnoredShards.clear();
        localStorage.removeItem('ignoredShards');
        this.updateStatistics();
        this.populateShardList();
    }

    // Method to get stats for debugging
    getStats() {
        return {
            totalShards: this.shardsData.length,
            permanentlyIgnored: this.IGNORED_SHARDS.length,
            userIgnored: this.userIgnoredShards.size,
            available: this.getAvailableShards().length,
            lastCalculated: this.calculatedResults.length
        };
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const calculator = new ShardCalculator();
    
    // Make calculator available globally for debugging
    window.shardCalculator = calculator;
    
    // Add some utility functions to window for debugging
    window.resetShardPreferences = () => calculator.resetUserPreferences();
    window.getShardStats = () => calculator.getStats();
    
    console.log('Shard Calculator initialized!');
    console.log('Debug commands available: resetShardPreferences(), getShardStats()');
});