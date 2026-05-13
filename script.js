// ═══════════════════════════════════════════════════════
// FINANCE SYNC PRO - DASHBOARD SCRIPT (v3.4 - FINAL)
// ✅ FIX: CORS-safe fetch, URL deploy terbaru, cache-busting
// ✅ Filter company dinamis, Refresh digabung Sync
// ✅ Compatible with Code.gs v3.1+
// ═══════════════════════════════════════════════════════

// ===== KONFIGURASI =====
// 🔹 URL DEPLOY TERBARU (dari user)
const BASE_URL = 'https://script.google.com/macros/s/AKfycbwAJNMlb-SjF-SPjdmq0uL8tgj8jb4WpEHBgA7BW1sBhiKULWkdLAG_8WuSJrfkVpzV/exec';

// 🔹 Cache-busting: timestamp unik per request
const APPS_SCRIPT_URL = () => `${BASE_URL}?action=getVouchers&_t=${Date.now()}`;
const SYNC_TRIGGER_URL = () => `${BASE_URL}?action=triggerSync&token=Yudi0201&_t=${Date.now()}`;

const COMPANY_FILTER_DEFAULT = 'all';
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 menit
const SYNC_COOLDOWN = 5 * 60 * 1000; // 5 menit cooldown

// ===== STATE =====
let allVouchers = [];
let filteredVouchers = [];
let sortConfig = { key: 'tanggal', direction: 'desc' };
let autoRefreshTimer = null;
let isSyncing = false;
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 detik minimal antara fetch

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEventListeners();
    fetchData(true); // force fetch on first load
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
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            clearFilters();
            triggerManualSync();
        });
    }
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    const autoRefresh = document.getElementById('autoRefresh');
    if (autoRefresh) {
        autoRefresh.addEventListener('change', (e) => toggleAutoRefresh(e.target.checked));
    }
    
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => applyFilters(), 300);
        });
    }
    
    const companyFilter = document.getElementById('companyFilter');
    if (companyFilter) {
        companyFilter.addEventListener('change', applyFilters);
    }
    
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
    
    document.addEventListener('click', (e) => {
        const th = e.target.closest('th[data-sort]');
        if (th) toggleSort(th.dataset.sort);
    });

    const syncCloseBtn = document.getElementById('syncCloseBtn');
    if (syncCloseBtn) {
        syncCloseBtn.addEventListener('click', () => {
            document.getElementById('syncNotification').style.display = 'none';
        });
    }
    
    const manualSyncLink = document.getElementById('manualSyncLink');
    if (manualSyncLink) {
        manualSyncLink.addEventListener('click', (e) => {
            e.preventDefault();
            triggerManualSync();
        });
    }
}

// ═══════════════════════════════════════════════════════
// 🔄 MANUAL SYNC TRIGGER - CORS-SAFE
// ═══════════════════════════════════════════════════════
async function triggerManualSync() {
    const btn = document.getElementById('refreshBtn');
    const notif = document.getElementById('syncNotification');
    const msgEl = document.getElementById('syncMessage');
    
    if (!btn || !notif || isSyncing) return;
    
    const lastSync = localStorage.getItem('lastManualSync');
    const now = Date.now();
    if (lastSync && (now - parseInt(lastSync)) < SYNC_COOLDOWN) {
        const remaining = Math.ceil((SYNC_COOLDOWN - (now - parseInt(lastSync))) / 1000);
        msgEl.textContent = `⏱️ Tunggu ${remaining} detik sebelum sync berikutnya`;
        notif.style.display = 'block';
        return;
    }
    
    isSyncing = true;
    btn.disabled = true;
    btn.innerHTML = '⏳ Syncing...';
    msgEl.textContent = '🔄 Memulai sinkronisasi... Mohon tunggu.';
    notif.style.display = 'block';
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000);
        
        // 🔹 CORS-SAFE POST: Content-Type text/plain TIDAK trigger preflight
        const response = await fetch(SYNC_TRIGGER_URL(), {
            method: 'POST',
            signal: controller.signal,
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8'
                // ❌ JANGAN tambahkan 'Accept' atau header lain yang trigger preflight
            },
            body: JSON.stringify({
                action: 'triggerSync',
                token: 'Yudi0201',
                timestamp: new Date().toISOString()
            })
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        if (!result?.success) throw new Error(result?.message || 'Unknown error');
        
        msgEl.textContent = '✅ Sinkronisasi selesai! Memuat data terbaru...';
        localStorage.setItem('lastManualSync', Date.now().toString());
        
        setTimeout(() => fetchData(true), 1500);
        
    } catch (error) {
        console.error('❌ Sync error:', error);
        let errorMsg = error.message;
        if (errorMsg.includes('Unauthorized')) errorMsg = 'Token tidak valid. Hubungi admin.';
        else if (errorMsg.includes('fetch') || errorMsg.includes('Network')) errorMsg = 'Gagal terhubung ke server. Cek koneksi.';
        
        msgEl.textContent = `❌ Gagal sync: ${errorMsg}`;
        setTimeout(() => fetchData(true), 1000);
        
    } finally {
        isSyncing = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '🔄 Refresh Data';
        }
        setTimeout(() => { notif.style.display = 'none'; }, 6000);
    }
}

// ═══════════════════════════════════════════════════════
// 📡 FETCH DATA - CORS-SAFE GET (TANPA PREFLIGHT)
// ═══════════════════════════════════════════════════════
async function fetchData(force = false, retryCount = 0) {
    const now = Date.now();
    if (!force && now - lastFetchTime < CACHE_DURATION && allVouchers.length > 0) {
        console.log('⚡ Using cached data');
        applyFilters();
        return;
    }
    
    try {
        showLoading(true);
        showElements(['error', 'emptyState', 'tableContainer'], false);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        // 🔹 CORS-SAFE GET: Minimal config, NO custom headers yang trigger preflight
        const response = await fetch(APPS_SCRIPT_URL(), {
            method: 'GET',
            signal: controller.signal
            // ❌ JANGAN pakai: mode:'cors', headers:{'Accept':...}, cache:'no-store'
            // ✅ Apps Script Web App sudah otomatis return CORS header jika "Who has access: Anyone"
        });
        
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const result = await response.json();
        if (!result?.success) throw new Error(result?.message || 'Unknown error');
        
        allVouchers = normalizeData(result);
        lastFetchTime = now;
        
        if (allVouchers.length === 0) {
            resetCompanyFilter();
            showEmptyState('⚠️ Tidak ada data voucher ditemukan');
            return;
        }
        
        populateCompanyFilter(allVouchers);
        initDateRange();
        applyFilters();
        updateLastSync();
        console.log(`✅ Loaded ${allVouchers.length} vouchers`);
        
    } catch (error) {
        console.error('❌ Fetch error:', error);
        
        if (retryCount < 3 && (error.message.includes('fetch') || error.message.includes('CORS'))) {
            await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
            return fetchData(force, retryCount + 1);
        }
        
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
            showError(`❌ Error koneksi ke server<br>
                <small>
                <b>Penyebab:</b> Deployment Apps Script belum akses "Anyone"<br><br>
                <b>Solusi:</b><br>
                1. Buka Apps Script → Deploy → Manage deployments<br>
                2. Klik ✏️ pada deployment aktif<br>
                3. Set <b>Who has access: Anyone</b><br>
                4. Klik "Deploy" → "New deployment"<br>
                5. Copy URL baru → update BASE_URL di script.js<br>
                6. Hard refresh browser: Ctrl+Shift+R
                </small>`);
        } else {
            showError(`❌ Gagal mengambil data <br><small>${getFriendlyError(error.message)}</small>`);
        }
    } finally {
        showLoading(false);
    }
}

// ═══════════════════════════════════════════════════════
// 🏢 POPULATE COMPANY FILTER DINAMIS
// ═══════════════════════════════════════════════════════
function populateCompanyFilter(vouchers) {
    const select = document.getElementById('companyFilter');
    if (!select) return;
    
    const currentSelection = select.value;
    select.innerHTML = '<option value="all">Semua</option>';
    
    const companies = [...new Set(
        vouchers
            .map(v => v.company)
            .filter(c => c && String(c).trim() !== '')
            .map(c => String(c).trim().toLowerCase())
    )].sort((a, b) => a.localeCompare(b));
    
    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company;
        option.textContent = company.toUpperCase();
        select.appendChild(option);
    });
    
    if (currentSelection && currentSelection !== 'all') {
        const exists = Array.from(select.options).some(opt => opt.value === currentSelection.toLowerCase());
        if (exists) select.value = currentSelection.toLowerCase();
    }
}

function resetCompanyFilter() {
    const select = document.getElementById('companyFilter');
    if (select) {
        select.innerHTML = '<option value="all">Semua</option>';
        select.value = 'all';
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
        if (companyFilter !== 'all' && v.company?.toLowerCase() !== companyFilter.toLowerCase()) return false;
        
        if (searchTerm) {
            const searchFields = [
                v.no_invoice, v.isi_invoice, v.lokasi, v.jenis, v.dibayarkan, v.file_name
            ].filter(Boolean).join(' ').toLowerCase();
            if (!searchFields.includes(searchTerm)) return false;
        }
        
        if (dateFrom && v.tanggal < dateFrom) return false;
        if (dateTo && v.tanggal > dateTo) return false;
        
        return true;
    });
    
    filteredVouchers.sort((a, b) => {
        const aVal = a[sortConfig.key] || '';
        const bVal = b[sortConfig.key] || '';
        const modifier = sortConfig.direction === 'asc' ? 1 : -1;
        
        if (sortConfig.key === 'nominal') return (parseFloat(aVal) - parseFloat(bVal)) * modifier;
        if (sortConfig.key === 'tanggal') return (new Date(aVal) - new Date(bVal)) * modifier;
        return String(aVal).localeCompare(String(bVal)) * modifier;
    });
    
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
    
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.dataset.sort === sortConfig.key) th.classList.add(`sort-${sortConfig.direction}`);
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
    
    const headerHTML = columns.map(col => `<th ${col.sortable ? `data-sort="${col.key}"` : ''}>${col.label}</th>`).join('');
    
    const rowsHTML = vouchers.map(row => `
        <tr>
            ${columns.map(col => {
                let value = row[col.key] ?? '-';
                if (col.format === 'currency' && value !== '-' && value !== '') value = formatRupiah(value);
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
        <p class="table-footer">Menampilkan ${vouchers.length} dari ${allVouchers.length} data • Update: ${new Date().toLocaleString('id-ID')}</p>
    `;
    container.style.display = 'block';
}

// ═══════════════════════════════════════════════════════
// 📥 EXPORT CSV
// ═══════════════════════════════════════════════════════
function exportToCSV() {
    if (filteredVouchers.length === 0) { alert('Tidak ada data untuk di-export'); return; }
    
    const columns = ['tanggal', 'no_invoice', 'company', 'jenis', 'lokasi', 'isi_invoice', 'nominal', 'status', 'dibayarkan', 'file_url'];
    const headers = ['Tanggal', 'No Invoice', 'Company', 'Jenis', 'Lokasi', 'Keterangan', 'Nominal', 'Status', 'Dibayarkan', 'Link File'];
    
    let csv = headers.join(',') + '\n';
    filteredVouchers.forEach(row => {
        const values = columns.map(col => {
            let val = row[col] ?? '';
            if (col === 'nominal') val = parseFloat(val) || 0;
            if (String(val).includes(',') || String(val).includes('"')) val = `"${String(val).replace(/"/g, '""')}"`;
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
    if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
    if (enabled) {
        autoRefreshTimer = setInterval(() => fetchData(false), AUTO_REFRESH_INTERVAL);
        console.log(`⏱️ Auto-refresh aktif: setiap ${AUTO_REFRESH_INTERVAL/60000} menit`);
    }
}

// ═══════════════════════════════════════════════════════
// 🔧 UTILITIES
// ═══════════════════════════════════════════════════════
function normalizeData(response) {
    let raw = [];
    if (Array.isArray(response)) raw = response;
    else if (response?.success && Array.isArray(response.data)) raw = response.data;
    else if (response?.data && Array.isArray(response.data)) raw = response.data;
    
    return raw.map(item => ({
        ...item,
        company: item.company ? String(item.company).trim().toLowerCase() : '',
        nominal: String(item.nominal || '').replace(/[^0-9.-]/g, '') || '0',
        status: item.status ? String(item.status).trim() : 'Belum'
    }));
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
    if (msg.includes('fetch') || msg.includes('Network')) return 'Tidak bisa terhubung ke server.<br>• Cek koneksi internet<br>• Pastikan Apps Script sudah di-deploy';
    if (msg.includes('CORS')) return 'Error CORS.<br>• Re-deploy Apps Script sebagai "New deployment"<br>• Set "Who has access: Anyone"';
    return msg;
}

function showLoading(show) { const el = document.getElementById('loading'); if (el) el.style.display = show ? 'block' : 'none'; }
function showError(msg) { const el = document.getElementById('error'); if (el) { el.innerHTML = msg; el.style.display = 'block'; } }
function showEmptyState(msg) { 
    const el = document.getElementById('emptyState');
    if (el) { const p = el.querySelector('p'); if (p) p.textContent = msg; el.style.display = 'block'; }
    const tableContainer = document.getElementById('tableContainer');
    if (tableContainer) tableContainer.style.display = 'none';
}
function showElements(ids, show) { ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = show ? 'block' : 'none'; }); }
function updateFilteredCount() { const el = document.getElementById('filteredCount'); if (el) el.textContent = `${filteredVouchers.length} data`; }
function updateLastSync() { const el = document.getElementById('lastSync'); if (el) el.textContent = new Date().toLocaleString('id-ID'); }

function clearFilters() {
    const searchInput = document.getElementById('searchInput');
    const companyFilter = document.getElementById('companyFilter');
    if (searchInput) searchInput.value = '';
    if (companyFilter) companyFilter.value = COMPANY_FILTER_DEFAULT;
    initDateRange();
    applyFilters();
}

window.clearFilters = clearFilters;
window.refreshData = () => fetchData(true);
window.forceReload = () => {
    localStorage.removeItem('theme');
    window.location.reload(true);
};
