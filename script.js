// ===== KONFIGURASI =====
// 🔹 Ganti dengan URL DEPLOYMENT BARU Anda
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyd2POlhgSzjdgJ1tYlq8JxRwJ9g2Oq8IDuB1jAObqLGdLi1XFNBdpceroV0GBRAyjk/exec?action=getVouchers';

// Optional: Filter per company
const COMPANY_FILTER = 'all';

// Retry config
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 detik

// ===== FUNGSI UTAMA =====
document.addEventListener('DOMContentLoaded', fetchData);

async function fetchData(retryCount = 0) {
    try {
        showLoading(true);
        
        // Build URL dengan filter
        let url = APPS_SCRIPT_URL;
        if (COMPANY_FILTER && COMPANY_FILTER !== 'all') {
            url += `&company=${COMPANY_FILTER}`;
        }
        
        console.log('📡 Fetching:', url);
        
        // Fetch dengan timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 detik
        
        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors', // Explicit CORS
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            // Handle redirect 302
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
        
        // Retry logic untuk CORS/redirect error
        if (retryCount < MAX_RETRIES && 
            (error.message.includes('Failed to fetch') || 
             error.message.includes('CORS') ||
             error.message.includes('Redirect'))) {
            
            console.log(`🔄 Retry ${retryCount + 1}/${MAX_RETRIES}...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
            return fetchData(retryCount + 1);
        }
        
        // Tampilkan error user-friendly
        let errorMsg = error.message;
        if (errorMsg.includes('Failed to fetch')) {
            errorMsg = '⚠️ Tidak bisa terhubung ke server. Pastikan:<br>1. Apps Script sudah di-deploy ulang<br>2. "Who has access" = Anyone<br>3. URL di script.js sudah benar';
        } else if (errorMsg.includes('CORS')) {
            errorMsg = '🔒 Error CORS. Solusi:<br>1. Re-deploy Apps Script sebagai "New deployment"<br>2. Set "Who has access: Anyone"<br>3. Tunggu 2-3 menit lalu refresh';
        }
        
        showError(`❌ Gagal mengambil data:<br><small>${errorMsg}</small>`);
        
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

// Tampilkan statistik
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

// Animasi angka
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

// Tampilkan tabel
function displayTable(vouchers) {
    if (vouchers.length === 0) return;
    
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
    
    const headerHTML = columns.map(col => `<th>${col.label}</th>`).join('');
    
    const rowsHTML = vouchers.map(row => {
        return `<tr>
            ${columns.map(col => {
                let value = row[col.key] ?? '-';
                
                if (col.format === 'currency' && value !== '-' && value !== '') {
                    value = formatRupiah(value);
                }
                
                if (col.format === 'link' && value && value !== '-' && String(value).startsWith('http')) {
                    const label = row.file_name || 'Lihat File';
                    value = `<a href="${escapeHtml(value)}" target="_blank" rel="noopener" class="file-link">${escapeHtml(label)}</a>`;
                }
                
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

// Escape HTML
function escapeHtml(text) {
    if (text === null || text === undefined) return '-';
    if (typeof text !== 'string') text = String(text);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Loading helper
function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'block' : 'none';
}

// Error helper
function showError(message) {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.innerHTML = message;
        errorEl.style.display = message ? 'block' : 'none';
    }
}

// Refresh manual
window.refreshData = function() {
    showLoading(true);
    document.getElementById('error').style.display = 'none';
    document.getElementById('tableContainer').style.display = 'none';
    fetchData();
};
