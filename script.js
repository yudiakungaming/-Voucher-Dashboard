// ===== KONFIGURASI =====
// 🔹 PENTING: Tambahkan ?action=getVouchers untuk ambil data (bukan sync)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyd2POlhgSzjdgJ1tYlq8JxRwJ9g2Oq8IDuB1jAObqLGdLi1XFNBdpceroV0GBRAyjk/exec?action=getVouchers';

// Optional: Filter per company (nmsa, ipn, atau 'all')
const COMPANY_FILTER = 'all'; // Ubah ke 'nmsa' atau 'ipn' jika ingin filter

// ===== FUNGSI UTAMA =====
document.addEventListener('DOMContentLoaded', fetchData);

async function fetchData() {
    try {
        showLoading(true);
        
        // Build URL dengan filter company jika diperlukan
        let url = APPS_SCRIPT_URL;
        if (COMPANY_FILTER && COMPANY_FILTER !== 'all') {
          url += `&company=${COMPANY_FILTER}`;
        }
        
        console.log('📡 Fetching:', url);
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const result = await response.json();
        console.log('✅ Response received:', result);
        
        // Handle response format dari Apps Script v2.3
        if (!result.success) {
          throw new Error(result.message || 'Unknown error');
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
        showError(`❌ Gagal mengambil  ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Normalisasi data dari response Apps Script v2.3
// Format: { success: true, count: N,  [...] }
function normalizeData(response) {
    // Jika response langsung array (fallback)
    if (Array.isArray(response)) return response;
    
    // Format baru dari Apps Script v2.3
    if (response?.success && Array.isArray(response.data)) {
        return response.data;
    }
    
    // Format lama / fallback lainnya
    if (response?.data && Array.isArray(response.data)) return response.data;
    if (response?.records && Array.isArray(response.records)) return response.records;
    if (response?.vouchers && Array.isArray(response.vouchers)) return response.vouchers;
    
    return [];
}

// Tampilkan statistik
function displayStats(vouchers) {
    const totalVoucher = vouchers.length;
    
    // Hitung total nominal - sesuaikan dengan field dari Apps Script
    const totalNominal = vouchers.reduce((sum, v) => {
        // Apps Script v2.3 return field: nominal (number)
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
    
    // Update DOM dengan animasi
    animateValue('totalVoucher', 0, totalVoucher, 1000);
    animateValue('totalNominal', 0, totalNominal, 1000, true);
    animateValue('rataRata', 0, rataRata, 1000, true);
}

// Animasi angka untuk efek smooth
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
    
    // Definisi kolom yang ingin ditampilkan (urutan rapi)
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
    
    // Build table header
    const headerHTML = columns.map(col => `<th>${col.label}</th>`).join('');
    
    // Build table body
    const rowsHTML = vouchers.map(row => {
        return `<tr>
            ${columns.map(col => {
                let value = row[col.key] || '-';
                
                // Format currency
                if (col.format === 'currency' && value !== '-') {
                    value = formatRupiah(value);
                }
                
                // Format link
                if (col.format === 'link' && value && value !== '-' && value.startsWith('http')) {
                    const label = row.file_name || 'Lihat File';
                    value = `<a href="${escapeHtml(value)}" target="_blank" class="file-link">📎 ${escapeHtml(label)}</a>`;
                }
                
                // Format status badge
                if (col.key === 'status') {
                    const statusClass = 
                        value === 'Lunas' ? 'status-lunas' :
                        value === 'Belum Lunas' || value === 'Belum' ? 'status-belum' :
                        'status-other';
                    value = `<span class="status-badge ${statusClass}">${escapeHtml(value)}</span>`;
                }
                
                return `<td>${value}</td>`;
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
        <p style="text-align: right; color: #666; margin-top: 10px; font-size: 0.9em;">
            Total: ${vouchers.length} data • Terakhir update: ${new Date().toLocaleString('id-ID')}
        </p>
    `;
    
    container.innerHTML = html;
    container.style.display = 'block';
}

// Helper: Escape HTML untuk cegah XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '-';
    if (typeof text !== 'string') text = String(text);
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Helper: Tampilkan/hide loading
function showLoading(show) {
    const el = document.getElementById('loading');
    if (el) el.style.display = show ? 'block' : 'none';
}

// Helper: Tampilkan error
function showError(message) {
    const errorEl = document.getElementById('error');
    if (errorEl) {
        errorEl.innerHTML = message;
        errorEl.style.display = message ? 'block' : 'none';
    }
}

// Helper: Refresh data manual (bisa dipanggil dari button)
window.refreshData = function() {
    showLoading(true);
    document.getElementById('error').style.display = 'none';
    document.getElementById('tableContainer').style.display = 'none';
    fetchData();
};
