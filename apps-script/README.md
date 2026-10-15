# Confirmările de prezență → Google Sheets + emailuri

Pagina `/confirma-prezenta/` trimite răspunsurile către un script Google Apps Script. Scriptul le scrie într-un Google Sheet și trimite emailurile din contul **fe.giftme@gmail.com**. Nu e nevoie de server, bază de date sau chei secrete.

## Instalare (o singură dată, ~10 minute)

Fă totul **logat doar în fe.giftme@gmail.com**, pentru că emailurile pleacă din contul care deține scriptul. Cel mai simplu: o fereastră privată (incognito) în care te loghezi doar cu acest cont.

1. Deschide **https://script.google.com** → **Proiect nou**. Redenumește-l „GiftMe RSVP”.
2. Șterge codul implicit, lipește conținutul din `rsvp.gs` și salvează (⌘S).
3. **Pregătește foaia:** alege funcția `setup` în bara de sus și apasă **Rulează**. Autorizează scriptul (Google avertizează că aplicația nu e verificată: **Avansat → Accesează GiftMe RSVP (nesigur)** → **Permite**). Scriptul creează în Drive foaia „GiftMe – Confirmări deschidere”, programează reamintirea pentru 1 noiembrie, ora 10:00, și scrie linkul foii în **Jurnalul de execuție**.
4. **Testează emailurile:** alege `testEmails` și apasă **Rulează**. În fe.giftme@gmail.com vor sosi două emailuri de probă, unul pentru „Da” și unul pentru „Nu”.
5. **Publică:** **Implementare → Implementare nouă → tip: Aplicație web**
   - Execută ca: **Eu** (fe.giftme@gmail.com)
   - Cine are acces: **Oricine**
6. Copiază URL-ul care se termină în `/exec` și pune-l în `confirma-prezenta/rsvp-config.js` la `endpoint`.

URL-ul `/exec` nu este o parolă: oricine îl vede în codul paginii. Protecția vine din validarea pe server, capcana pentru roboți, timpul minim de completare și limitele de trimitere din `rsvp.gs`.

## Ce primesc invitații

- **„Da”:** un email cu biletul de invitat (nume, număr, data, ora, locul), butoane pentru Google Calendar și Apple/Outlook și evenimentul atașat ca fișier `.ics`.
- **„Nu”:** un email scurt de mulțumire, cu link pentru a-și schimba răspunsul.
- **Cu o zi înainte**, doar celor cu „Da”: o reamintire, din nou cu evenimentul pentru calendar.

Emailurile au „Răspunde la” setat pe fe.giftme@gmail.com. Gmail permite cam 100 de emailuri pe zi dintr-un cont gratuit, suficient pentru ~35 de invitați.

## Cum citești răspunsurile

Fila **Confirmări**: data trimiterii, numele, emailul, Da/Nu, data ultimei modificări, numărul invitatului și când au plecat confirmarea și reamintirea. O persoană = un rând, identificat după email. Dacă cineva își schimbă răspunsul, rândul se actualizează și primește un email nou.

Dacă un email nu a putut fi trimis, în coloană apare `eroare: …`, dar răspunsul rămâne salvat.

## Dacă vezi „Fișierul nu poate fi deschis acum”

Apare de obicei când browserul e logat în mai multe conturi Google și Apps Script se deschide cu alt cont decât cel care deține foaia. Folosește o fereastră privată logată doar în fe.giftme@gmail.com și pornește de la **script.google.com** (pașii de mai sus), nu din meniul foii. Dacă un cont de școală/organizație blochează Apps Script, folosește un cont Gmail personal.

## Dacă modifici scriptul

**Implementare → Gestionează implementările → Editează → Versiune: nouă**. Așa URL-ul rămâne același.

## Întrebări noi în formular

Adaugă câmpul în `fields` din `rsvp-config.js`, în `FIELDS` din `rsvp.gs` și o coloană în `HEADERS` / `COL` / `upsert()`.
