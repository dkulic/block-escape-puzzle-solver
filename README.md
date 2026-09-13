# Color Block Escape Puzzle Solver

A modern, responsive, browser-based **Color Block Escape Puzzle Solver** built for deployment on **Cloudflare Pages** (or any static Web Host).

## 🌟 O Projektu (Features)

- **Vizuelni Editor Mape:**
  - Podesive dimenzije table (od 3x3 do 15x15, podrazumevano 8x8 ili 10x10).
  - Postavljanje tipova polja: **Pod** (Floor), **Zid** (Wall), **Kapija** (Gate u boji), **Praznina** (Void).
  - Paleta boja za definisanje kapija i blokova.

- **Kreiranje i Ubacivanje Blokova:**
  - Podržani oblici:
    - `Single (1x1)`
    - `Linija (2, 3, 4 kvadrata)`
    - `L Profil (3 kvadrata)`
    - `T Profil (4 kvadrata)`
    - `+ Profil (5 kvadrata)`
  - Podrška za **rotaciju oblika za 90°** pre i nakon ubacivanja.
  - Slobodno pozicioniranje i selekcija blokova na tabli.

- **Automatski Solver (Slagalica Solver):**
  - Implementiran BFS (Breadth-First Search) algoritam u JavaScript-u koji radi direktno u browseru.
  - Izlazak bloka sa mape kroz kapiju njegove odgovarajuće boje.

- **Korak-po-Korak Prikaz Rešenja (Solution Player):**
  - Navigacija kroz rešenje pomoću dugmića `<` i `>` ili sa tastature (Strelica levo / Strelica desno).
  - Jasni opisi svakog pojedinačnog poteza (koji blok se pomera i u kom smeru ili izlazi van mape).

---

## 🚀 Pokretanje i Testiranje (Local Run)

Aplikacija je napravljena koristeći čist HTML5, CSS3 i ES6 JavaScript module, tako da nije potreban kompleksan build step.

Možete je pokrenuti na sledeće načine:

### Način 1: Korišćenje bilo kog lokalnog HTTP servera
npx serve .
# ili
python3 -m http.server 8000


Zatim otvorite pregledač na `http://localhost:8000`.

---

## ☁️ Deploy na Cloudflare Pages

1. Otvorite vaš [Cloudflare Dashboard](https://dash.cloudflare.com/) i idite na **Workers & Pages**.
2. Kliknite na **Create application** -> **Pages** -> **Connect to Git**.
3. Izaberite vaš repozitorijum.
4. Podesite build podešavanja:
   - **Framework preset:** `None`
   - **Build command:** *(Ostavite prazno)*
   - **Build output directory:** `/` (koren repozitorijuma ili folder gde je `index.html`)
5. Kliknite **Save and Deploy**. Aplikacija će za par sekundi biti uživo na vašem `.pages.dev` domenu.

---

## 🎮 Uputstvo za Korišćenje

1. **Izrada Mape:**
   - Izaberite dimenzije table i kliknite na **Postavi**.
   - Kliknite na tip polja (**Zid** ili **Kapija**), izaberite boju za kapiju i klikćite po tabli.
   - Izaberite oblik bloka, rotirajte ga i izaberite boju, pa kliknite na **➕ Ubaci Blok na Mapu**.
   - Klikom na blok na tabli možete ga selektovati i promeniti mu poziciju, rotirati ga pritiskom na taster `R`, ili obrisati tasterom `Delete`.

2. **Rešavanje:**
   - Kliknite na zeleno dugme **🚀 Pronađi Rešenje (Solve)**.
   - Kada solver pronađe rešenje, automatski se otvara pregledač koraka u kom pomoću dugmića `<` i `>` možete pratiti slagalicu korak po korak.
