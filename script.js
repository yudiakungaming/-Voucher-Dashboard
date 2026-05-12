// ===== KONFIGURASI =====
// 🔹 URL Apps Script dengan parameter ?action=getVouchers (WAJIB!)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw7bbX8yit6Y2mGgZ_zWVDduAKf60bVfYHMeEh_nj8TJ1kzu9p5f5HDS7ezUeVWADb5/exec?action=getVouchers';

// Optional: Filter per company (nmsa, ipn, atau 'all')
const COMPANY_FILTER = 'all';

// Retry config untuk handle CORS/redirect
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ===== FUNGSI UTAMA =====
document.addEventListener('DOMContentLoaded', fetchData);

async function fetchData(retryCount = 0) {
    try {
        showLoading(true);
        
        // Build URL dengan filter company jika diperlukan
        let url = APPS_SCRIPT_URL;
        if (COMPANY_FILTER && COMPANY_FILTER !== 'all') {
            url += `&company=${COMPANY_FILTER}`;
        }
        
        console.log('📡 Fetching:', url);
        
        // Fetch dengan timeout & abort controller
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            if (response.status === 302 || response.type === 'opaqueredirect') {
                console.warn('⚠️ Redirect detected, retrying...');
                throw new Error('Redirect detected');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ Response received:', result);
        
        if (!result?.success) {
            throw new Error(result?.message || 'Unknown error from server');
        }
        
        const vouchers = normalizeData(result);
        
        if (vouchers.length === 0) {
            showError('⚠️ Tidak ada data voucher ditemukan');
            return;
        }
        
        console.log(`📊 Displaying ${vouchers.length} vouchers`);
        displayStats(vouchers);
        displayTable(vouchers);
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        // Retry logic untuk CORS/redirect/network error
        if (retryCount < MAX_RETRIES && 
            (error.message.includes('Failed to fetch') || 
             error.message.includes('CORS') ||
             error.message.includes('Redirect') ||
             error.message.includes('Network'))) {
            
            console.log(`🔄 Retry ${retryCount + 1}/${MAX_RETRIES} in ${RETRY_DELAY * (retryCount + 1)}ms...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
            return fetchData(retryCount + 1);
        }
        
        // Tampilkan error user-friendly
        let errorMsg = error.message;
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
            errorMsg = '🔌 Tidak bisa terhubung ke server.<br><small>Pastikan:<br>• Apps Script sudah di-deploy<br>• "Who has access" = Anyone<br>• URL di script.js benar</small>';
        } else if (errorMsg.includes('CORS')) {
            errorMsg = '🔒 Error CORS.<br><small>Solusi:<br>• Re-deploy Apps Script sebagai "New deployment"<br>• Set "Who has access: Anyone"<br>• Tunggu 2-3 menit lalu refresh</small>';
        }
        
        showError(`❌ Gagal mengambil  <br><small>${errorMsg}</small>`);
        
    } finally {
        showLoading(false);
    }
}

// Normalisasi data dari response Apps Script v2.3
function normalizeData(response) {
    if (Array.isArray(response)) return response;
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (response?.data && Array.isArray(response.data)) return response.data;
    if (response?.records && Array.isArray(response.records)) return response.records;
    if (response?.vouchers && Array.isArray(response.vouchers)) return response.vouchers;
    return [];
}

// Tampilkan statistik dengan animasi
function displayStats(vouchers) {
    const totalVoucher = vouchers.length;
    
    const totalNominal = vouchers.reduce((sum, v) => {
        const nominal = 
            typeof v.nominal === 'number' ? v.nominal :
            parseFloat(v.nominal) || 
            parseFloat(v.Jumlah) || 
            parseFloat(v.Nominal) || 
            parseFloat(v.total) || 
            parseFloat(v.jumlah) || 
            parseFloat(v.amount) || 
            0;
        return sum + nominal;
    }, 0);
    
    const rataRata = totalVoucher > 0 ? totalNominal / totalVoucher : 0;
    
    animateValue('totalVoucher', 0, totalVoucher, 1000);
    animateValue('totalNominal', 0, totalNominal, 1000, true);
    animateValue('rataRata', 0, rataRata, 1000, true);
}

// Animasi angka smooth
function animateValue(elementId, start, end, duration, isCurrency = false) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = progress * (end - start) + start;
        
        element.textContent = isCurrency ? formatRupiah(value) : Math.round(value).toLocaleString('id-ID');
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// Format Rupiah
function formatRupiah(angka) {
    if (typeof angka !== 'number') angka = parseFloat(angka) || 0;
    return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}

// Tampilkan tabel dengan kolom terstruktur
function displayTable(vouchers) {
    if (vouchers.length === 0) return;
    
    // Definisi kolom yang ingin ditampilkan
    const columns = [
        { key: 'tanggal', label: 'Tanggal' },
        { key: 'no_invoice', label: 'No Invoice' },
        { key: 'company', label: 'Company' },
        { key: 'jenis', label: 'Jenis' },
        { key: 'lokasi', label: 'Lokasi' },
        { key: 'isi_invoice', label: 'Keterangan' },
        { key: 'nominal', label: 'Nominal', format: 'currency' },
        { key: 'status', label: 'Status' },
        { key: 'dibayarkan', label: 'Dibayarkan' },
        { key: 'file_url', label: 'File', format: 'link' }
    ];
    
    const container = document.getElementById('tableContainer');
    
    // Build header
    const headerHTML = columns.map(col => `<th>${col.label}</th>`).join('');
    
    // Build rows
    const rowsHTML = vouchers.map(row => {
        return `<tr>
            ${columns.map(col => {
                let value = row[col.key] ?? '-';
                
                // Format currency
                if (col.format === 'currency' && value !== '-' && value !== '') {
                    value = formatRupiah(value);
                }
                
                // Format link file
                if (col.format === 'link' && value && value !== '-' && String(value).startsWith('http')) {
                    const label = row.file_name || 'Lihat File';
                    value = `<a href="${escapeHtml(value)}" target="_blank" rel="noopener" class="file-link">${escapeHtml(label)}</a>`;
                }
                
                // Format status badge
                if (col.key === 'status') {
                    const statusClass = 
                        value === 'Lunas' ? 'status-lunas' :
                        value === 'Belum Lunas' || value === 'Belum' ? 'status-belum' :
                        'status-other';
                    value = `<span class="status-badge ${statusClass}">${escapeHtml(value)}</span>`;
                }
                
                return `<td>${value ?? '-'}</td>`;
            }).join('')}
        </tr>`;
    }).join('');
    
    const html = `
        <div style="overflow-x: auto;">
        <table class="data-table">
            <thead>
                <tr>${headerHTML}</tr>
            </thead>
            <tbody>
                ${rowsHTML}
            </tbody>
        </table>
        </div>
        <p class="table-footer">
            Total: ${vouchers.length} data • Terakhir update: ${new Date().toLocaleString('id-ID')}
        </p>
    `;
    
    container.innerHTML = html;
    container.style.display = 'block';
}

// Escape HTML untuk cegah XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '-';
    if (typeof text !== 'string') text = String(text);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Helper: Loading
function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'block' : 'none';
}

// Helper: Error
function showError(message) {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.innerHTML = message;
        errorEl.style.display = message ? 'block' : 'none';
    }
}

// Helper: Refresh manual (bisa dipanggil dari button)
window.refreshData = function() {
    showLoading(true);
    const errorEl = document.getElementById('error');
    const tableEl = document.getElementById('tableContainer');
    if (errorEl) errorEl.style.display = 'none';
    if (tableEl) tableEl.style.display = 'none';
    fetchData();
};
