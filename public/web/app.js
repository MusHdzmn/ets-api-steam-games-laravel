// ---------- Pengaturan dasar ----------
const API = '/api';
let token = sessionStorage.getItem('token') || '';
let sudahLogin = !!token;
let halaman = 1;
let lastPage = 1;

const $ = (id) => document.getElementById(id);

// Mencegah teks dari database dibaca sebagai HTML (XSS)
const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));

// Pembungkus fetch: menambah header, token, dan membaca JSON
async function api(path, opsi = {}) {
    const headers = { Accept: 'application/json', ...(opsi.headers || {}) };
    if (opsi.body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;

    const res = await fetch(API + path, { ...opsi, headers });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
}

// Respons bisa berupa array langsung atau { data: [...] }
const baris = (j) => (Array.isArray(j) ? j : j.data || []);

// Ambil pesan error dari respons (detail, message, atau daftar errors validasi)
function pesanError(data, cadangan) {
    const errors = data.errors ? Object.values(data.errors).flat().join(' ') : '';
    const teks = ((data.detail || data.message || '') + ' ' + errors).trim();
    return teks || cadangan;
}

// ---------- Tab ----------
document.querySelectorAll('nav button').forEach((btn) => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('nav button').forEach((b) =>
            b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab').forEach((t) =>
            t.classList.toggle('active', t.id === btn.dataset.tab));

        if (btn.dataset.tab === 'top') muatTop();
        if (btn.dataset.tab === 'statistik') muatStatistik();
        if (btn.dataset.tab === 'akun') muatAkun();
    });
});

// ---------- Tab Daftar ----------
function kartu(g) {
    const gratis = g.is_free === true || g.is_free === 1 || Number(g.price) === 0;
    const harga = gratis ? 'Gratis' : '$' + Number(g.price).toFixed(2);
    const genre = String(g.genres || '').split(';').join(', ');

    // Tombol hapus hanya muncul kalau sudah login
    const tombolHapus = token
        ? `<button class="hapus" data-appid="${esc(g.appid)}"
                   data-nama="${esc(g.name)}">Hapus</button>`
        : '';

    return `
        <article class="kartu">
            <h3>${esc(g.name)}</h3>
            <p class="meta">${esc(g.developer)} · ${esc(g.release_year)}</p>
            <p>${esc(genre)}</p>
            <p class="harga">${esc(harga)}
                <span class="rating">${esc(g.positive_pct)}% positif</span></p>
            ${tombolHapus}
        </article>`;
}

async function muatDaftar() {
    const q = $('q').value.trim();
    const p = new URLSearchParams({ page: halaman, per_page: 12 });
    let path;

    if (q) {
        p.set('q', q);
        path = '/games/search?' + p;
    } else {
        if ($('genre').value.trim()) p.set('genre', $('genre').value.trim());
        if ($('min').value !== '') p.set('min_price', $('min').value);
        if ($('max').value !== '') p.set('max_price', $('max').value);
        path = '/games?' + p;
    }

    $('info').textContent = 'Memuat...';
    const r = await api(path);

    if (!r.ok) {
        $('info').textContent = 'Gagal: ' + (r.data.detail || 'status ' + r.status);
        $('hasil').innerHTML = '';
        return;
    }

    const j = r.data;
    lastPage = j.last_page || 1;

    // Kalau halaman sekarang melewati halaman terakhir (mis. setelah hapus), mundur
    if (halaman > lastPage) {
        halaman = lastPage;
        return muatDaftar();
    }

    $('info').textContent = `${j.total} game ditemukan`;
    $('hasil').innerHTML = baris(j).map(kartu).join('') || '<p>Tidak ada hasil.</p>';
    $('halaman').textContent = `Halaman ${j.current_page} dari ${lastPage}`;
    $('prev').disabled = halaman <= 1;
    $('next').disabled = halaman >= lastPage;
}

$('form-cari').addEventListener('submit', (e) => {
    e.preventDefault();
    halaman = 1;
    muatDaftar();
});
$('prev').addEventListener('click', () => { halaman--; muatDaftar(); });
$('next').addEventListener('click', () => { halaman++; muatDaftar(); });

// Hapus game (satu listener untuk semua tombol, lewat event delegation)
$('hasil').addEventListener('click', async (e) => {
    const tombol = e.target.closest('.hapus');
    if (!tombol) return;

    const appid = tombol.dataset.appid;
    const nama = tombol.dataset.nama;

    if (!confirm(`Hapus game "${nama}" (appid ${appid})?`)) return;

    const key = prompt('Masukkan API key:');
    if (!key) return;

    const r = await api('/games/' + encodeURIComponent(appid), {
        method: 'DELETE',
        headers: { 'X-API-KEY': key },
    });

    if (!r.ok) {
        alert(`Gagal menghapus (${r.status}): ${pesanError(r.data, 'terjadi kesalahan.')}`);
        return;
    }

    await muatDaftar();
    $('info').textContent += ` · "${nama}" berhasil dihapus`;
});

// ---------- Tab Top ----------
async function muatTop() {
    const r = await api('/games/top?limit=' + $('limit').value);
    if (!r.ok) {
        $('hasil-top').innerHTML = '<li>Gagal memuat data.</li>';
        return;
    }
    $('hasil-top').innerHTML = baris(r.data).map((g) => `
        <li><strong>${esc(g.name)}</strong>
            · ${esc(g.positive_pct)}% positif
            · ${Number(g.positive_ratings).toLocaleString('id-ID')} ulasan positif</li>
    `).join('');
}
$('limit').addEventListener('change', muatTop);

// ---------- Tab Statistik ----------
function tabel(el, judulKolom, kolom, data) {
    const kepala = judulKolom.map((j) => `<th>${j}</th>`).join('');
    const isi = data.map((d) =>
        '<tr>' + kolom.map((k) => `<td>${esc(d[k])}</td>`).join('') + '</tr>'
    ).join('');
    el.innerHTML = `<tr>${kepala}</tr>${isi}`;
}

async function muatStatistik() {
    const [g, t] = await Promise.all([api('/stats/genre'), api('/stats/year')]);

    tabel($('tabel-genre'),
        ['Genre', 'Jumlah game', 'Harga rata-rata', 'Rata-rata positif (%)'],
        ['genre', 'total_games', 'avg_price', 'avg_positive_pct'],
        baris(g.data));

    tabel($('tabel-tahun'),
        ['Tahun', 'Jumlah game', 'Harga rata-rata', 'Rata-rata positif (%)'],
        ['release_year', 'total_games', 'avg_price', 'avg_positive_pct'],
        baris(t.data));
}

// ---------- Tab Akun ----------
// user = null  -> tampilkan form login (atau register kalau sedang dipilih)
// user = objek -> tampilkan kotak akun
function tampilAkun(user) {
    $('box-user').hidden = !user;
    if (user) {
        $('form-login').hidden = true;
        $('form-register').hidden = true;
        $('nama-user').textContent = user.name;
    } else {
        gantiForm('login');
    }

    // Status login berubah -> muat ulang daftar supaya tombol Hapus muncul/hilang
    if (!!user !== sudahLogin) {
        sudahLogin = !!user;
        muatDaftar();
    }
}

function gantiForm(mana) {
    $('form-login').hidden = mana !== 'login';
    $('form-register').hidden = mana !== 'register';
}

$('ke-register').addEventListener('click', (e) => {
    e.preventDefault();
    $('pesan-login').textContent = '';
    gantiForm('register');
});
$('ke-login').addEventListener('click', (e) => {
    e.preventDefault();
    $('pesan-register').textContent = '';
    gantiForm('login');
});

async function muatAkun() {
    if (!token) { tampilAkun(null); return; }
    const r = await api('/auth/me');
    if (!r.ok) {
        token = '';
        sessionStorage.removeItem('token');
        tampilAkun(null);
        return;
    }
    tampilAkun(r.data);
}

// Login dipakai bersama oleh form login dan register (login otomatis)
async function prosesLogin(email, password) {
    const r = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    if (!r.ok) return r;

    token = r.data.access_token;
    sessionStorage.setItem('token', token);
    await muatAkun();
    return r;
}

$('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await prosesLogin($('email').value, $('password').value);

    if (!r.ok) {
        $('pesan-login').textContent = pesanError(r.data, 'Login gagal.');
        return;
    }
    $('password').value = '';
    $('pesan-login').textContent = '';
});

$('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pesan = $('pesan-register');
    pesan.className = 'pesan';

    if ($('r-password').value !== $('r-konfirmasi').value) {
        pesan.textContent = 'Konfirmasi password tidak sama.';
        return;
    }

    const email = $('r-email').value;
    const password = $('r-password').value;

    const r = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
            name: $('r-nama').value,
            email,
            password,
            password_confirmation: $('r-konfirmasi').value,
        }),
    });

    if (!r.ok) {
        pesan.textContent = pesanError(r.data, 'Pendaftaran gagal.');
        return;
    }

    // Berhasil daftar -> langsung login
    const l = await prosesLogin(email, password);
    if (!l.ok) {
        pesan.className = 'pesan ok';
        pesan.textContent = 'Akun dibuat. Silakan login.';
        gantiForm('login');
        return;
    }
    $('form-register').reset();
    pesan.textContent = '';
});

$('btn-logout').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    token = '';
    sessionStorage.removeItem('token');
    tampilAkun(null);
});

$('form-tambah').addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = await api('/games', {
        method: 'POST',
        headers: { 'X-API-KEY': $('t-key').value },
        body: JSON.stringify({
            name: $('t-name').value,
            genres: $('t-genres').value,
            price: Number($('t-price').value),
            release_date: $('t-date').value,
            positive_ratings: Number($('t-pos').value),
            negative_ratings: Number($('t-neg').value),
        }),
    });

    const pesan = $('pesan-tambah');
    if (r.status === 201) {
        pesan.className = 'pesan ok';
        pesan.textContent = 'Berhasil disimpan dengan appid ' + r.data.appid;
        $('form-tambah').reset();
        muatDaftar();
        return;
    }

    pesan.className = 'pesan';
    pesan.textContent = `Gagal (${r.status}): ${pesanError(r.data, '')}`;
});

// ---------- Mulai ----------
muatDaftar();