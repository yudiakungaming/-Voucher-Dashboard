// ===== KONFIGURASI =====
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyd2POlhgSzjdgJ1tYlq8JxRwJ9g2Oq8IDuB1jAObqLGdLi1XFNBdpceroV0GBRAyjk/exec';

// ===== FUNGSI UTAMA =====
document.addEventListener('DOMContentLoaded', fetchData);

async function fetchData() {
    try {
        showLoading(true);
        
        const response = await fetch(APPS_SCRIPT_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        console.log('Data received:', data);
        
        // Handle berbagai format response
        const vouchers = normalizeData(data);
        
        if (vouchers.length === 0) {
            showError('⚠️ Tidak ada data ditemukan di spreadsheet');
            return;
        }
        
        displayStats(vouchers);
        displayTable(vouchers);
        
    } catch (error) {
        console.error('Error:', error);
        showError(`❌ Gagal mengambil data: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Normalisasi data agar fleksibel dengan berbagai format JSON
function normalizeData(data) {
    if (Array.isArray(data)) return data;
    if (data.data && Array.isArray(data.data)) return data.data;
    if (data.records && Array.isArray(data.records)) return data.records;
    if (data.vouchers && Array.isArray(data.vouchers)) return data.vouchers;
    return [];
}

// Tampilkan statistik
function displayStats(vouchers) {
    const totalVoucher = vouchers.length;
    
    // Coba berbagai kemungkinan nama field untuk nominal
    const totalNominal = vouchers.reduce((sum, v) => {
        const nominal = 
            parseFloat(v.Jumlah) || 
            parseFloat(v.Nominal) || 
            parseFloat(v.total) || 
            parseFloat(v.jumlah) || 
            parseFloat(v.amount) || 
            0;
        return sum + nominal;
    }, 0);
    
    const rataRata = totalVoucher > 0 ? totalNominal / totalVoucher : 0;
    
    // Update DOM
    document.getElementById('totalVoucher').textContent = totalVoucher.toLocaleString('id-ID');
    document.getElementById('totalNominal').textContent = formatRupiah(totalNominal);
    document.getElementById('rataRata').textContent = formatRupiah(rataRata);
}

// Format Rupiah
function formatRupiah(angka) {
    return 'Rp ' + Math.round(angka).toLocaleString('id-ID');
}

// Tampilkan tabel
function displayTable(vouchers) {
    if (vouchers.length === 0) return;
    
    const headers = Object.keys(vouchers[0]);
    const container = document.getElementById('tableContainer');
    
    let html = `
        <div style="overflow-x: auto;">
        <table>
            <thead>
                <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${vouchers.map(row => `
                    <tr>
                        ${headers.map(h => `<td>${escapeHtml(row[h])}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
    `;
    
    container.innerHTML = html;
    container.style.display = 'block';
}

// Helper: Escape HTML untuk cegah XSS
function escapeHtml(text) {
    if (text === null || text === undefined) return '-';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Helper: Tampilkan/hide loading
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
}

// Helper: Tampilkan error
function showError(message) {
    const errorEl = document.getElementById('error');
    errorEl.innerHTML = message;
    errorEl.style.display = message ? 'block' : 'none';
}
