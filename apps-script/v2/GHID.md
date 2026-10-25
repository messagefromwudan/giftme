# Confirmări v2: bilet cu QR, reamintiri, intrare, follow-up

Ghid pas cu pas, pentru cineva care n-a folosit niciodată Apps Script. Evenimentul: **luni, 2 noiembrie 2026, ora 09:30, CEEF Chișinău**. Toate orele sunt ora Chișinăului.

Scriptul vechi (`apps-script/rsvp.gs`) și foaia live **nu se ating** până la lansare. Totul se testează întâi pe o **copie**, cu adresa ta de email.

---

## 1. Ce face fiecare fișier

| Fișier | Ce e | Unde ajunge |
|---|---|---|
| `Cod.gs` | scriptul nou | în Apps Script, fișierul „Cod.gs” |
| `QR.gs` | generatorul de cod QR (biblioteca qrcode, MIT), rulează în Google, fără serviciu extern | în Apps Script, fișier nou „QR” |
| `coloane-foaie.tsv` | rândul 1 al foii, cu cele 20 de coloane | **nu trebuie lipit**: `setup` îl scrie singur. E aici doar ca referință. |
| `test/test-v2.js` | 81 de verificări automate pe servicii Google simulate | rulat pe calculator: `node apps-script/v2/test/test-v2.js` |
| `build-qr.mjs` | reface `QR.gs` și `public/confirma-prezenta/intrare/qr.js` | doar dacă se actualizează biblioteca |

Pe site (branch-ul `dev`): pagina nouă `/confirma-prezenta/intrare/` (scanarea biletelor), textele noi pe `/confirma-prezenta/` și `/confidentialitate/`, iar `rsvp-config.js` alege scriptul după adresă: **giftme.site → scriptul live**, **previzualizările Vercel → copia de test**.

### Coloanele foii

Coloanele 1–8 sunt exact cele vechi, în aceeași ordine (de aceea scriptul vechi poate scrie mai departe în foaie). `setup` adaugă coloanele 9–20 la dreapta:

| # | Coloană | Ce conține |
|---|---|---|
| 8 | Reamintire 1 nov | (fostă „Reamintire trimisă”) ora trimiterii sau motivul pentru care nu s-a trimis |
| 9 | Cod bilet | cod aleatoriu de 32 de caractere; e singurul lucru din QR |
| 10 | Da din | când a răspuns „Da” |
| 11 | Bilet QR trimis | când a plecat biletul cu QR |
| 12–14 | Reamintire 29 oct / 2 nov 07:30 / 2 nov 09:00 | ora sau motivul |
| 15 | **Venit?** | bifă: se pune la scanare sau de mână |
| 16–17 | Venit la / Marcat prin | ora și „scanare” sau „manual” |
| 18 | Follow-up trimis | „părere · …” sau „absent · …” |
| 19 | Fără emailuri | data la care a cerut să nu mai primească emailuri |
| 20 | Notificare echipă | când a plecat emailul către echipă |

O celulă de reamintire are fie **o oră** (trimisă), fie **un motiv** („nu: a venit deja”, „nu: confirmat după ora reamintirii”…), fie **„eroare: …”** (se reîncearcă la declanșatorul următor), fie **„se trimite…”** (scriptul s-a oprit în timpul trimiterii; nu se retrimite niciodată, ca să nu primească nimeni același email de două ori).

---

## 2. Setările (Proprietăți script)

Le pui în editorul Apps Script → ⚙️ **Setări proiect (Project Settings)** → jos, **Proprietăți script (Script properties)** → **Adaugă proprietate**.

| Proprietate | Copia de test | Live |
|---|---|---|
| `STAFF_PIN` | ex. `482913` | un PIN nou, de cel puțin 6 cifre, spus doar echipei de la intrare |
| `WEB_APP_URL` | URL-ul `/exec` al copiei | URL-ul `/exec` al scriptului live nou |
| `SITE_URL` | adresa previzualizării Vercel a branch-ului `dev`, fără `/` la final | nu o pune (implicit `https://giftme.site`) |
| `TEAM_EMAIL` | adresa ta | nu o pune (implicit `fe.giftme@gmail.com`) |
| `MOD_TEST` | `da` | **nu o pune** |
| `TEST_EMAIL` | adresa ta | nu o pune |
| `FORM_REVIEW_URL`, `FORM_ABSENT_URL` | scrise de `creeazaFormularele` | idem |
| `ORA_REAMINTIRE_1NOV` | opțional, ex. `17:30` | opțional; fără ea, ora din cod (`16:00`) |

**Ora reamintirii de duminică (acum 16:00)** se schimbă în unul din două locuri:
- **în cod**: `Cod.gs`, sus, imediat sub blocul `EVENT`: `const DEFAULT_TIME_1NOV = '16:00';`;
- **fără cod**: Proprietatea script `ORA_REAMINTIRE_1NOV` (format `HH:MM`). Dacă există, are prioritate față de valoarea din cod.

În ambele cazuri **rulează din nou `setup`**: abia el mută declanșatoarele (ora + rezerva la +15 minute). Până atunci rămâne ora veche, iar meniul **Arată reamintirile programate** te anunță. O valoare greșită oprește `setup` înainte să schimbe ceva. `setup` scrie în jurnal un ATENȚIE dacă ora e după 07:30 (cota de emailuri, secțiunea 8) sau de la 10:00 încolo (declanșatorul vechi, secțiunea 5, pasul 12). La 16:00 apar amândouă.

Cu `MOD_TEST = da`, scriptul **refuză să trimită emailuri altcuiva** decât `TEST_EMAIL` (și variantelor `adresa+ceva@gmail.com`). Chiar dacă în copie ar rămâne o adresă reală, ea nu primește nimic.

---

## 3. Copia de test (în contul tău)

Folosește o fereastră privată (incognito) logată **doar** în contul tău Google. Cu mai multe conturi logate, Google deschide des Apps Script cu contul greșit („Fișierul nu poate fi deschis acum”).

1. **Foaia.** Pe drive.google.com → **Nou → Foi de calcul Google**. Denumește-o „GiftMe – Confirmări (TEST)”. Redenumește fila de jos din „Foaie1” în **Confirmări**.
   Ca să testezi și mutarea rândurilor vechi, lipește în A1 antetul vechi și 2 rânduri inventate, cu adresa ta și un `+` (ex. `adresa+vechi@gmail.com`):
   `Trimis la | Nume, prenume | Email | Prezent(ă) | Actualizat la | Nr. invitat | Confirmare trimisă | Reamintire trimisă`.
   **Nu copia foaia live**: are adresele reale ale invitaților.
2. **Scriptul.** În foaie: **Extensii → Apps Script**. Se deschide un proiect legat de foaie. Redenumește-l (sus, „Proiect fără titlu”) în „GiftMe RSVP v2 TEST”.
3. Șterge tot din „Cod.gs”, lipește conținutul fișierului `apps-script/v2/Cod.gs`, salvează (⌘S).
4. Lângă „Fișiere”, apasă **+ → Script**, numește-l `QR`, șterge ce e în el, lipește `apps-script/v2/QR.gs`, salvează.
5. ⚙️ **Setări proiect**: bifează „Afișează fișierul manifest…” doar dacă vrei să-l vezi (nu e obligatoriu). La **Fus orar** alege **(GMT+02:00) Chisinau**. Adaugă proprietățile din coloana „Copia de test” de mai sus, în afară de `WEB_APP_URL` (o pui la pasul 8).
6. Înapoi la **Editor** (iconița `< >`). În bara de sus, din lista de funcții, alege **setup** → **Rulează**. Google cere autorizarea: **Examinează permisiunile → contul tău → Avansat → Accesează GiftMe RSVP v2 TEST (nesigur) → Permite**. Permisiunile cerute: foile tale, trimiterea de emailuri în numele tău, declanșatoarele, conexiuni externe (ca să citească `rsvp-config.js` de pe site), Google Forms și ferestrele din foaie.
   În **Jurnalul de execuție** (jos) apar: linkul foii, cele 8 declanșatoare create, ce setări lipsesc.
7. Alege **creeazaFormularele** → **Rulează**. În jurnal apar linkurile celor două formulare (pentru invitați și pentru editare). Deschide linkurile pentru invitați într-o fereastră privată și verifică dacă formularele se pot completa. Dacă nu: deschide linkul de editare → **Publică**.
8. **Implementare (Deploy) → Implementare nouă (New deployment)** → rotița → **Aplicație web (Web app)**. Descriere: „v2 test”. **Execută ca: Eu**. **Cine are acces: Oricine (Anyone)**. → **Implementează**. Copiază **URL-ul aplicației web** (se termină în `/exec`) și pune-l în proprietatea `WEB_APP_URL`.
9. Trimite-mi URL-ul `/exec`: îl pun la `test:` în `rsvp-config.js` pe branch-ul `dev`, fac push pe `dev` (doar previzualizare, nu producție) și îți dau adresa previzualizării. Pune adresa la `SITE_URL` și rulează din nou **setup**.
10. Reîncarcă foaia: apare meniul **GiftMe**, cu submeniul **Test (doar pe copie)**.

---

## 4. Planul de test (pe copie, cu adresa ta)

Toate emailurile vin din contul tău, pentru că pe copie scriptul rulează în contul tău.

| # | Pas | Rezultat așteptat |
|---|---|---|
| 1 | După `setup`, uită-te la foaie | 20 de coloane; rândurile vechi au „Cod bilet”, rândul cu „Da” are „Da din”; bife goale la „Venit?” |
| 2 | Pe previzualizare, `/confirma-prezenta/`: nume, `adresa+ana@gmail.com`, **Da** | biletul pe pagină; un email „Biletul tău…” cu nume, data, ora 09:30, locul, **codul QR**, butoanele de calendar, lista reamintirilor și linkul „oprește mesajele”; un al doilea email „RSVP Da: … (răspuns nou)” pentru echipă |
| 3 | Trimite din nou exact același răspuns | doar emailul echipei („a trimis din nou același răspuns”) |
| 4 | Schimbă răspunsul pe **Nu**, apoi înapoi pe **Da** | de fiecare dată confirmarea potrivită + notificarea echipei |
| 5 | Scanează QR-ul din email cu un **telefon fără PIN** | pagina „✓ Bilet valid”, fără nume, cu codul QR; în foaie „Venit?” rămâne nebifat |
| 6 | Pe pagină: „Ești din echipa GiftMe?” → PIN greșit | „PIN greșit”, nimic marcat |
| 7 | PIN-ul corect | ecran verde cu numele; în foaie „Venit?” bifat, „Venit la” cu ora, „scanare” |
| 8 | Scanează **încă o dată** (același telefon) | ecran galben „A intrat deja, la HH:MM” |
| 9 | Pe același telefon, deschide `/confirma-prezenta/intrare/#ffffffffffffffffffffffffffffffff` | „✗ Bilet necunoscut” |
| 10 | Apasă „Mod echipă · Ieși”, rescanează | din nou doar „Bilet valid” |
| 11 | În foaie, debifează „Venit?”; bifează-l de mână la alt rând | debifat: ora se golește; bifat de mână: ora + „manual” |
| 12 | **GiftMe → Test → Simulează reamintirea 1** | email „Luni ne vedem…” (adresa, ora, QR, linia de dezabonare) către fiecare „Da”; coloana „Reamintire 29 oct” cu ora |
| 13 | Rulează **aceeași** simulare încă o dată | 0 trimise; niciun email nou |
| 14 | „Da din” = o dată de după reamintire: la un rând, scrie în „Da din” `02.11.2026 08:00`, golește-i „Reamintire 2 nov 07:30”, simulează **reamintirea 3** | rândul primește „nu: confirmat după ora reamintirii”, nu email |
| 15 | Simulează **reamintirea 4** pentru același rând | primește reamintirea de la 09:00 (s-a „înscris” înaintea ei) |
| 16 | Simulează reamintirea 2, apoi 3 și 4 pentru ceilalți | câte un email per reamintire; cine e bifat „Venit?” primește „nu: a venit deja” la reamintirea 4 |
| 17 | În emailul de reamintire, apasă „oprește mesajele” → butonul | „Gata!”; data apare la „Fără emailuri”; la următoarea simulare: „nu: a cerut să nu mai primească emailuri” |
| 18 | **GiftMe → Test → Simulează o eroare de declanșator** | email „⚠️ GiftMe RSVP: Eroare la test…” la adresa ta |
| 19 | **GiftMe → Trimite follow-up**, scrie altceva decât GATA | „Nu am trimis nimic.” |
| 20 | Din nou, scrie **GATA** | cine e bifat „Venit?” primește linkul formularului de părere; cine a spus „Da” și nu e bifat primește „De ce n-ai putut ajunge?”; cine a spus „Nu” sau s-a dezabonat nu primește nimic |
| 21 | Încă o dată **Trimite follow-up** → GATA | „Follow-up trimis: 0” |
| 22 | **GiftMe → Verifică cota de emailuri** | numărul de emailuri rămase azi pentru contul tău |
| 23 | Dezactivează internetul pe telefon și scanează | „Nu am putut verifica biletul” + indicația cu lista tipărită |

**După teste**: în copie, rulează funcția `stergeDeclansatoarele` (altfel copia trimite reamintiri reale către adresa ta pe 29 oct – 2 nov).

---

## 5. Lansarea (doar după aprobare)

Fă pașii logat **doar** în fe.giftme@gmail.com, într-o fereastră privată.

1. Deschide **foaia live** „GiftMe – Confirmări deschidere”. **Fișier → Descarcă → Microsoft Excel**: copia de siguranță.
2. **Extensii → Apps Script**. Se creează un proiect nou, legat de foaie (scriptul vechi e un proiect separat și rămâne neatins). Redenumește-l „GiftMe RSVP v2”.
3. Lipește `Cod.gs` și `QR.gs` ca la pașii 3–4 din secțiunea 3. Fus orar: Chisinau.
4. Proprietăți script: `STAFF_PIN` (PIN-ul nou). **Fără** `MOD_TEST`, `TEST_EMAIL`, `SITE_URL`, `TEAM_EMAIL`.
5. Rulează **setup** → autorizează. Verifică în jurnal: 8 declanșatoare, fusul orar, codurile create pentru invitații existenți.
6. Rulează **creeazaFormularele** (formularele vor fi în Drive-ul fe.giftme).
7. **Implementare → Implementare nouă → Aplicație web**, Execută ca: Eu, Acces: Oricine. Pune URL-ul `/exec` în `WEB_APP_URL`. Rulează din nou **setup**.
8. Rulează **verificaCota** (vezi secțiunea 8).
9. Trimite-mi URL-ul `/exec`. Îl pun la `live:` și `liveCheckin:` în `rsvp-config.js`, apoi duc `dev` pe `main` (producție, ~70 s). Din acel moment, formularul de pe giftme.site scrie prin scriptul nou.
10. Verificare pe giftme.site cu adresa ta: înscriere → bilet cu QR → scanare cu PIN. Apoi șterge-ți rândul din foaie.
11. **Biletul cu QR pentru cei care au confirmat înainte de lansare:** reîncarcă foaia → **GiftMe → Trimite biletul cu QR celor care nu l-au primit** → verifică numărul și cota afișate → **Da**. Un email per invitat; cine l-a primit deja nu-l mai primește (coloana „Bilet QR trimis”). Dacă unii rămân netrimiși (cota zilei), rulează din nou a doua zi.

12. **Șterge declanșatorul vechi de duminică** (obligatoriu cu reamintirea la 16:00): deschide proiectul **vechi** „GiftMe RSVP” pe script.google.com → ⏰ **Declanșatoare (Triggers)** → rândul `sendReminders` → ⋮ → **Șterge declanșatorul**. Nu schimba nimic altceva acolo (codul și implementarea rămân, pentru revenire). Dacă rămâne, el pornește la 10:00, înaintea celei noi, și trimite reamintirea veche, fără QR; la 16:00, scriptul nou îi găsește pe toți „trimiși” și nu mai trimite nimic.

---

## 6. Revenirea la scriptul vechi: un singur pas

**Pasul:** în `public/confirma-prezenta/rsvp-config.js`, pune la `live:` URL-ul vechi și publică pe `main`:

```
live: 'https://script.google.com/macros/s/AKfycbwFSO9fIvZ7RBpFYwfwNNyw6QyKtbpmvksTyvqQkfTIW_qhx5zKcW45stqPTD5Bx1zU/exec',
```

(sau, dacă de la lansare nu a mai plecat nimic altceva pe site: Vercel → Deployments → implementarea dinainte → **Instant Rollback**).

Ce se întâmplă singur după acest pas:
- formularul trimite din nou la scriptul vechi, care merge pe aceeași foaie (coloanele 1–8 sunt neschimbate);
- înaintea reamintirilor de joi și de luni, scriptul nou citește `rsvp-config.js`. Văzând că `live:` nu mai e URL-ul lui, **nu trimite** și anunță echipa o singură dată per reamintire;
- reamintirea de duminică, 16:00, **pleacă totuși din scriptul nou**: declanșatorul vechi de la 10:00 a fost șters la lansare, iar scriptul vechi avea și el o reamintire de duminică. Dacă vreți să nu mai plece nimic din scriptul nou, rulați în el `stergeDeclansatoarele`;
- scanarea la intrare merge mai departe prin `liveCheckin:` (scriptul nou), pe aceeași foaie.

Dacă site-ul nu poate fi citit (cădere Vercel), scriptul nou trimite oricum reamintirile: o cădere a site-ului nu trebuie să oprească reamintirile din ziua evenimentului.

---

## 7. La intrare, pe 2 noiembrie

- **Telefoanele echipei**: deschid o dată orice bilet, apasă „Ești din echipa GiftMe?”, introduc PIN-ul. De acum, fiecare QR scanat cu camera acelui telefon marchează invitatul. Folosiți browserul obișnuit al telefonului (nu o fereastră privată, unde PIN-ul nu se păstrează).
- **Invitat fără bilet**: în foaie, pe primul rând gol, scrieți numele, emailul dacă îl dă (pentru follow-up), „Da” la „Prezent(ă)” și bifați „Venit?”. Ora se completează singură. Nu-l trimiteți să completeze formularul la ușă: asta consumă 2 emailuri din cota zilei.
- **Fără internet la ușă**: (1) cu o zi înainte, **Fișier → Descarcă → PDF** cu lista (Nume, Nr. invitat) și tipăriți-o; (2) în aplicația Google Sheets de pe telefon: ⋮ pe fișier → **Disponibil offline**. Bifele puse offline se sincronizează când revine internetul. Biletul din email arată numele și numărul, deci invitatul se găsește ușor în listă. (3) Datele mobile ale unui telefon pot servi ca rezervă pentru Wi-Fi.
- **Follow-up**: doar după ce ați terminat de marcat prezența, din **GiftMe → Trimite follow-up** (cere „GATA”). Nu pleacă nimic automat.

---

## 8. Declanșatoarele și cota de emailuri

`setup` creează exact aceste 8 declanșatoare, toate cu funcția `ruleazaReamintiri`:

| Reamintire | Ora | Rezervă (reîncearcă erorile, anunță dacă prima n-a rulat) | Valabilă până la |
|---|---|---|---|
| 1 – joi, 29 octombrie | 10:00 | 10:15 | 1 nov, 16:00 |
| 2 – duminică, 1 noiembrie | **16:00** (setarea `DEFAULT_TIME_1NOV` / `ORA_REAMINTIRE_1NOV`) | 16:15 | 2 nov, 07:30 |
| 3 – luni, 2 noiembrie | 07:30 | 07:45 | 2 nov, 09:00 |
| 4 – luni, 2 noiembrie | 09:00 | 09:15 | 2 nov, 09:30 |

**Cota.** Google nu publică cota exactă a unui cont. Pentru un cont Gmail obișnuit e de regulă **100 de destinatari pe zi**. Aflați cifra reală cu **verificaCota** în proiectul live (sau, înainte de lansare, într-un proiect gol din contul fe.giftme, cu `function cota() { Logger.log(MailApp.getRemainingDailyQuota()); }`).

**Cu reamintirea de duminică la 16:00**, toate trei (duminică 16:00, luni 07:30, luni 09:00) cad în 17 ore, deci în aceleași 24 de ore. Cu N invitați cu „Da”, au nevoie de **3 × N** emailuri, plus 1–2 pentru fiecare înscriere sau schimbare din acest interval (confirmarea + notificarea echipei). Cazul cel mai rău, cu 100 pe zi și nimic altceva trimis:

| Invitați cu „Da” | Emailuri pentru cele 3 reamintiri | Ce se întâmplă |
|---|---|---|
| până la 32 | până la 96 | încap toate |
| 33 | 99 | 1 invitat nu primește reamintirea de la 09:00 (scriptul păstrează 2 emailuri pentru alerte) |
| 34 | 102 | **peste 100**: 4 rămân fără reamintirea de la 09:00 |
| 40 | 120 | 22 rămân fără reamintirea de la 09:00 |

Fiecare înscriere de ultim moment scade pragul cu 1–2. Ce face scriptul când nu ajung emailurile:
- **notificările echipei se opresc primele**: dacă emailurile rămase nu acoperă reamintirile din următoarele 24 de ore (+7 de rezervă), notificarea nu pleacă și în coloana „Notificare echipă” apare „sărită: păstrăm emailurile pentru invitați”. De duminică, 09:00, toate trei reamintirile sunt în următoarele 24 de ore, deci cu 31 sau mai mulți invitați cu „Da” (3 × 31 + 7 = 100) nu mai pleacă nicio notificare de duminică, 09:00, până luni, 09:30; echipa urmărește foaia;
- **confirmările pentru invitații noi pleacă mereu**, cât mai există cotă (și consumă din cea a reamintirilor);
- **reamintirile se opresc când mai rămân 2 emailuri**; invitații rămași (cei de pe rândurile de jos, adică ultimii înscriși) primesc în celulă „eroare: cota zilnică de emailuri s-a terminat”. Cine e deja marcat „Venit?” nu are nevoie de reamintirea de la 09:00 și nu consumă nimic;
- **echipa primește o alertă** („⚠️ GiftMe RSVP: Probleme la reamintirea…”) cu lista celor neexpediați, trimisă din cele 2 emailuri păstrate;
- declanșatorul de rezervă (+15 minute) reîncearcă, dar dacă nu s-a eliberat cota, nu reușește nici el.

Dacă nu știți sigur că sunt sub ~30 de invitați cu „Da”: rulați **verificaCota** pe 31 octombrie. Dacă arată 100, cea mai simplă soluție e o oră de duminică înainte de 07:30 (atunci duminica nu mai împarte cele 24 de ore cu luni și pragul urcă la 49 de invitați (2 × 49 = 98)); un cont Google Workspace (1.500 pe zi) rezolvă și el problema. Pe 2 noiembrie, invitații fără bilet se adaugă de mână în foaie (secțiunea 7), nu prin formular.

---

## 9. Ce faceți de mână în Google (lista completă)

1. Copia de test: foaia goală, proiectul legat, lipirea fișierelor, proprietățile, `setup`, autorizarea, `creeazaFormularele`, implementarea ca aplicație web, `WEB_APP_URL`, `SITE_URL`.
2. Trimiteți-mi URL-ul `/exec` al copiei (pentru `test:`).
3. Testele din secțiunea 4, apoi `stergeDeclansatoarele` în copie.
4. La lansare, în contul fe.giftme: copia de siguranță, proiectul legat de foaia live, lipirea, **`STAFF_PIN`**, `setup` + **autorizarea**, `creeazaFormularele` (+ verificarea formularelor în fereastră privată), implementarea, `WEB_APP_URL`, din nou `setup` (care **creează declanșatoarele**), `verificaCota`.
5. Trimiteți-mi URL-ul `/exec` live (pentru `live:` și `liveCheckin:`), aprobați publicarea pe `main`.
6. Imediat după publicare: **GiftMe → Trimite biletul cu QR celor care nu l-au primit** (secțiunea 5, pasul 11) și **ștergerea declanșatorului vechi** `sendReminders` din proiectul vechi (secțiunea 5, pasul 12).
7. Pe 1 noiembrie: lista tipărită și foaia disponibilă offline pe telefoane; PIN-ul introdus pe telefoanele de la intrare.
8. După eveniment: marcarea prezenței, apoi **Trimite follow-up**.
9. Pentru răspunsurile „STOP” primite pe email: puneți data în coloana „Fără emailuri”.
