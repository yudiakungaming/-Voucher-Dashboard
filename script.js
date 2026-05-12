// ═══════════════════════════════════════════════════════
// FINANCE SYNC PRO - DASHBOARD SCRIPT (v3.1)
// ✅ Search, Filter, Export CSV, Auto-Refresh, Dark Mode
// ✅ Manual Sync Trigger dengan Token Keamanan
// ✅ Compatible with Code.gs v3.1
// ═══════════════════════════════════════════════════════

// ===== KONFIGURASI =====
// 🔹 URL untuk ambil data voucher (read-only)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw6dG2VCeD2cu5SxTS0sf5v7_nwKzsEqnzWAoLD_pV-t2Qih1a656gMKsyNUMZreF2d/exec?action=getVouchers';

// 🔹 URL untuk trigger sync manual (dengan token keamanan)
const SYNC_TRIGGER_URL = 'https://script.google.com/macros/s/AKfycbw6dG2VCeD2cu5SxTS0sf5v7_nwKzsEqnzWAoLD_pV-t2Qih1a656gMKsyNUMZreF2d/exec?action=triggerSync&token=Yudi0201';

// 🔹 Konfigurasi lainnya
const COMPANY_FILTER_DEFAULT = 'all';
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 menit
const SYNC_COOLDOWN = 5 * 60 * 1000; // 5 menit cooldown untuk sync manual

// ===== STATE =====
let allVouchers = [];
let filteredVouchers = [];
let sortConfig = { key: 'tanggal', direction: 'desc' };
let autoRefreshTimer = null;
let isSyncing = false;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    fetchData();
});

// ═══════════════════════════════════════════════════════
// 🌓 THEME (DARK MODE)
// ═══════════════════════════════════════════════════════

function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        const toggle = document.getElementById('themeToggle');
        if (toggle) toggle.textContent = '☀️';
    }
}

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
        themeToggle.textContent = isDark ? '🌓' : '☀️';
        localStorage.setItem('theme', isDark ? 'light' : 'dark');
    });
}

// ═══════════════════════════════════════════════════════
// 🔘 EVENT LISTENERS
// ═══════════════════════════════════════════════════════

function initEventListeners() {
    // 🔹 Refresh button (reload data)
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            clearFilters();
            fetchData();
        });
    }
    
    // 🔹 Sync button (trigger sync di Apps Script)
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', triggerManualSync);
    }
    
    // 🔹 Export CSV
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    // 🔹 Auto-refresh toggle
    const autoRefresh = document.getElementById('autoRefresh');
    if (autoRefresh) {
        autoRefresh.addEventListener('change', (e) => {
            toggleAutoRefresh(e.target.checked);
        });
    }
    
    // 🔹 Search input (debounced)
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => applyFilters(), 300);
        });
    }
    
    // 🔹 Company filter
    const companyFilter = document.getElementById('companyFilter');
    if (companyFilter) {
        companyFilter.addEventListener('change', applyFilters);
    }
    
    // 🔹 Date filters
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
    
    // 🔹 Table header sorting (delegated event)
    document.addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort]');
        if (th) {
            const key = th.dataset.sort;
            toggleSort(key);
        }
    });
}

// ═══════════════════════════════════════════════════════
// 🔄 MANUAL SYNC TRIGGER
// ═══════════════════════════════════════════════════════

async function triggerManualSync() {
    const syncBtn = document.getElementById('syncBtn');
    const statusEl = document.getElementById('syncStatus');
    
    if (!syncBtn || !statusEl || isSyncing) return;
    
    // 🔹 Cooldown check
    const lastSync = localStorage.getItem('lastManualSync');
    const now = Date.now();
    if (lastSync && (now - parseInt(lastSync)) < SYNC_COOLDOWN) {
        const remaining = Math.ceil((SYNC_COOLDOWN - (now - parseInt(lastSync))) / 1000);
        showSyncStatus(`⏱️ Tunggu ${remaining} detik sebelum sync berikutnya`, 'info');
        return;
    }
    
    // 🔹 Disable button & show loading
    isSyncing = true;
    syncBtn.disabled = true;
    syncBtn.classList.add('syncing');
    syncBtn.innerHTML = '⏳ Syncing...';
    
    showSyncStatus('🔄 Memulai sinkronisasi... Mohon tunggu.', 'info');
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90 detik timeout
        
        // 🔹 IMPORTANT: Use text/plain for GAS CORS compatibility
        const response = await fetch(SYNC_TRIGGER_URL, {
            method: 'POST',
            mode: 'cors',
            signal: controller.signal,
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({
                action: 'triggerSync',
                token: 'Yudi0201',
                timestamp: new Date().toISOString()
            })
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result?.success) {
            showSyncStatus('✅ Sinkronisasi selesai! Data terbaru sudah tersedia.', 'success');
            
            // Auto-refresh data setelah sync sukses
            setTimeout(() => {
                fetchData();
            }, 2000);
            
            // Update cooldown
            localStorage.setItem('lastManualSync', Date.now().toString());
            
        } else {
            throw new Error(result?.message || 'Unknown error');
        }
        
    } catch (error) {
        console.error('❌ Sync error:', error);
        let errorMsg = error.message;
        if (errorMsg.includes('Unauthorized')) {
            errorMsg = 'Token tidak valid. Hubungi admin.';
        } else if (errorMsg.includes('fetch') || errorMsg.includes('Network')) {
            errorMsg = 'Tidak bisa terhubung ke server. Cek koneksi internet.';
        }
        showSyncStatus(`❌ Gagal sync: ${errorMsg}`, 'error');
    } finally {
        // Re-enable button
        isSyncing = false;
        if (syncBtn) {
            syncBtn.disabled = false;
            syncBtn.classList.remove('syncing');
            syncBtn.innerHTML = '🔄 Sync Sekarang';
        }
        
        // Hide status after 6 seconds
        setTimeout(() => {
            if (statusEl) statusEl.style.display = 'none';
        }, 6000);
    }
}

function showSyncStatus(message, type = 'info') {
    const el = document.getElementById('syncStatus');
    if (!el) return;
    
    el.innerHTML = message;
    el.className = `sync-status ${type}`;
    el.style.display = 'block';
}

// ═══════════════════════════════════════════════════════
// 📡 FETCH DATA VOUCHER
// ═══════════════════════════════════════════════════════

async function fetchData(retryCount = 0) {
    try {
        showLoading(true);
        showElements(['error', 'emptyState', 'tableContainer'], false);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'GET',
            mode: 'cors',
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        
        if (!result?.success) throw new Error(result?.message || 'Unknown error');
        
        allVouchers = normalizeData(result);
        
        if (allVouchers.length === 0) {
            showEmptyState('⚠️ Tidak ada data voucher ditemukan');
            return;
        }
        
        // Set default date range to last 90 days
        initDateRange();
        
        // Apply filters & render
        applyFilters();
        updateLastSync();
        
        console.log(`✅ Loaded ${allVouchers.length} vouchers`);
        
    } catch (error) {
        console.error('❌ Fetch error:', error);
        
        if (retryCount < 3 && (error.message.includes('fetch') || error.message.includes('CORS'))) {
            await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
            return fetchData(retryCount + 1);
        }
        
        showError(`❌ Gagal mengambil data <br><small>${getFriendlyError(error.message)}</small>`);
        
    } finally {
        showLoading(false);
    }
}

// ═══════════════════════════════════════════════════════
// 🔍 FILTER & SORT
// ═══════════════════════════════════════════════════════

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const companyFilterEl = document.getElementById('companyFilter');
    const dateFromEl = document.getElementById('dateFrom');
    const dateToEl = document.getElementById('dateTo');
    
    const searchTerm = searchInput?.value?.toLowerCase() || '';
    const companyFilter = companyFilterEl?.value || COMPANY_FILTER_DEFAULT;
    const dateFrom = dateFromEl?.value;
    const dateTo = dateToEl?.value;
    
    filteredVouchers = allVouchers.filter(v => {
        // Company filter
        if (companyFilter !== 'all' && v.company !== companyFilter) return false;
        
        // Search filter - ✅ PERBAIKAN: gunakan isi_invoice (bukan keterangan)
        if (searchTerm) {
            const searchFields = [
                v.no_invoice, 
                v.isi_invoice,  // ← Field dari Code.gs
                v.lokasi, 
                v.jenis,
                v.dibayarkan,
                v.file_name
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchFields.includes(searchTerm)) return false;
        }
        
        // Date filter
        if (dateFrom && v.tanggal < dateFrom) return false;
        if (dateTo && v.tanggal > dateTo) return false;
        
        return true;
    });
    
    // Apply sorting
    filteredVouchers.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        const modifier = sortConfig.direction === 'asc' ? 1 : -1;
        
        if (sortConfig.key === 'nominal') {
            return (parseFloat(aVal) - parseFloat(bVal)) * modifier;
        }
        if (sortConfig.key === 'tanggal') {
            return (new Date(aVal) - new Date(bVal)) * modifier;
        }
        return String(aVal).localeCompare(String(bVal)) * modifier;
    });
    
    // Update UI
    updateStats(filteredVouchers);
    displayTable(filteredVouchers);
    updateFilteredCount();
}

function toggleSort(key) {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = key === 'tanggal' ? 'desc' : 'asc';
    }
    
    // Update header visual
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortConfig.key) {
            th.classList.add(`sort-${sortConfig.direction}`);
        }
    });
    
    applyFilters();
}

// ═══════════════════════════════════════════════════════
// 📅 DATE RANGE
// ═══════════════════════════════════════════════════════

function initDateRange() {
    const today = new Date();
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    const dateTo = document.getElementById('dateTo');
    const dateFrom = document.getElementById('dateFrom');
    
    if (dateTo && !dateTo.value) dateTo.valueAsDate = today;
    if (dateFrom && !dateFrom.value) dateFrom.valueAsDate = ninetyDaysAgo;
}

// ═══════════════════════════════════════════════════════
// 📊 STATS
// ═══════════════════════════════════════════════════════

function updateStats(vouchers) {
    const total = vouchers.length;
    const totalNominal = vouchers.reduce((sum, v) => sum + (parseFloat(v.nominal) || 0), 0);
    const lunas = vouchers.filter(v => v.status === 'Lunas').reduce((sum, v) => sum + (parseFloat(v.nominal) || 0), 0);
    const belum = totalNominal - lunas;
    
    animateValue('totalVoucher', total);
    animateValue('totalNominal', totalNominal, true);
    animateValue('totalLunas', lunas, true);
    animateValue('totalBelum', belum, true);
}

function animateValue(elementId, value, isCurrency = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = isCurrency ? formatRupiah(value) : value.toLocaleString('id-ID');
}

// ═══════════════════════════════════════════════════════
// 📋 TABLE
// ═══════════════════════════════════════════════════════

function displayTable(vouchers) {
    const container = document.getElementById('tableContainer');
    if (!container) return;
    
    if (vouchers.length === 0) {
        showEmptyState('🔍 Tidak ada data yang sesuai filter');
        return;
    }
    
    const columns = [
        { key: 'tanggal', label: 'Tanggal', sortable: true },
        { key: 'no_invoice', label: 'No Invoice', sortable: true },
        { key: 'company', label: 'Company', sortable: true },
        { key: 'jenis', label: 'Jenis' },
        { key: 'lokasi', label: 'Lokasi' },
        { key: 'isi_invoice', label: 'Keterangan' },
        { key: 'nominal', label: 'Nominal', format: 'currency', sortable: true },
        { key: 'status', label: 'Status' },
        { key: 'dibayarkan', label: 'Dibayarkan' },
        { key: 'file_url', label: 'File', format: 'link' }
    ];
    
    const headerHTML = columns.map(col => 
        `<th ${col.sortable ? `data-sort="${col.key}"` : ''}>${col.label}</th>`
    ).join('');
    
    const rowsHTML = vouchers.map(row => `
        <tr>
            ${columns.map(col => {
                let value = row[col.key] ?? '-';
                
                if (col.format === 'currency' && value !== '-' && value !== '') {
                    value = formatRupiah(value);
                }
                
                if (col.format === 'link' && value?.startsWith('http')) {
                    const label = row.file_name || 'Lihat File';
                    value = `<a href="${escapeHtml(value)}" target="_blank" rel="noopener" class="file-link">${escapeHtml(label)}</a>`;
                }
                
                if (col.key === 'status') {
                    const cls = value === 'Lunas' ? 'status-lunas' : 
                               ['Belum', 'Belum Lunas'].includes(value) ? 'status-belum' : 'status-other';
                    value = `<span class="status-badge ${cls}">${escapeHtml(value)}</span>`;
                }
                
                return `<td>${value ?? '-'}</td>`;
            }).join('')}
        </tr>
    `).join('');
    
    container.innerHTML = `
        <div style="overflow-x:auto">
        <table class="data-table">
            <thead><tr>${headerHTML}</tr></thead>
            <tbody>${rowsHTML}</tbody>
        </table>
        </div>
        <p class="table-footer">
            Menampilkan ${vouchers.length} dari ${allVouchers.length} data • Update: ${new Date().toLocaleString('id-ID')}
        </p>
    `;
    
    container.style.display = 'block';
}

// ═══════════════════════════════════════════════════════
// 📥 EXPORT CSV
// ═══════════════════════════════════════════════════════

function exportToCSV() {
    if (filteredVouchers.length === 0) {
        alert('Tidak ada data untuk di-export');
        return;
    }
    
    const columns = ['tanggal', 'no_invoice', 'company', 'jenis', 'lokasi', 'isi_invoice', 'nominal', 'status', 'dibayarkan', 'file_url'];
    const headers = ['Tanggal', 'No Invoice', 'Company', 'Jenis', 'Lokasi', 'Keterangan', 'Nominal', 'Status', 'Dibayarkan', 'Link File'];
    
    let csv = headers.join(',') + '\n';
    
    filteredVouchers.forEach(row => {
        const values = columns.map(col => {
            let val = row[col] ?? '';
            if (col === 'nominal') val = parseFloat(val) || 0;
            if (String(val).includes(',') || String(val).includes('"')) {
                val = `"${String(val).replace(/"/g, '""')}"`;
            }
            return val;
        });
        csv += values.join(',') + '\n';
    });
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voucher-export-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    // Feedback
    const btn = document.getElementById('exportBtn');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Terkirim!';
        setTimeout(() => btn.innerHTML = originalText, 2000);
    }
}

// ═══════════════════════════════════════════════════════
// 🔄 AUTO-REFRESH
// ═══════════════════════════════════════════════════════

function toggleAutoRefresh(enabled) {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
    
    if (enabled) {
        autoRefreshTimer = setInterval(() => {
            console.log('🔄 Auto-refresh...');
            fetchData();
        }, AUTO_REFRESH_INTERVAL);
        console.log(`⏱️ Auto-refresh aktif: setiap ${AUTO_REFRESH_INTERVAL/60000} menit`);
    }
}

// ═══════════════════════════════════════════════════════
// 🔧 UTILITIES
// ═══════════════════════════════════════════════════════

function normalizeData(response) {
    if (Array.isArray(response)) return response;
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (response?.data && Array.isArray(response.data)) return response.data;
    return [];
}

function formatRupiah(angka) {
    if (typeof angka !== 'number') angka = parseFloat(angka) || 0;
    return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}

function escapeHtml(text) {
    if (!text) return '-';
    const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

function getFriendlyError(msg) {
    if (msg.includes('fetch') || msg.includes('Network')) {
        return 'Tidak bisa terhubung ke server.<br>• Cek koneksi internet<br>• Pastikan Apps Script sudah di-deploy';
    }
    if (msg.includes('CORS')) {
        return 'Error CORS.<br>• Re-deploy Apps Script sebagai "New deployment"<br>• Set "Who has access: Anyone"';
    }
    return msg;
}

function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'block' : 'none';
}

function showError(msg) {
    const el = document.getElementById('error');
    if (el) { el.innerHTML = msg; el.style.display = 'block'; }
}

function showEmptyState(msg) {
    const el = document.getElementById('emptyState');
    if (el) { 
        const p = el.querySelector('p');
        if (p) p.textContent = msg; 
        el.style.display = 'block'; 
    }
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) tableContainer.style.display = 'none';
}

function showElements(ids, show) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? 'block' : 'none';
    });
}

function updateFilteredCount() {
    const el = document.getElementById('filteredCount');
    if (el) el.textContent = `${filteredVouchers.length} data`;
}

function updateLastSync() {
    const el = document.getElementById('lastSync');
    if (el) el.textContent = new Date().toLocaleString('id-ID');
}

function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    const companyFilter = document.getElementById('companyFilter');
    
    if (searchInput) searchInput.value = '';
    if (companyFilter) companyFilter.value = COMPANY_FILTER_DEFAULT;
    
    initDateRange();
    applyFilters();
}

// Expose for HTML onclick
window.clearFilters = clearFilters;
window.refreshData = () => fetchData();
