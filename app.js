(() => {
'use strict';
const $ = id => document.getElementById(id);
const DB_KEY = 'isbn-book-tracker-v1';
const fields = ['isbn','title','authors','publisher','year','language','pages','category','notes'];
let books = loadBooks(), editingId = null, stream = null, detector = null, scanLoop = false;

function loadBooks(){ try { const x=JSON.parse(localStorage.getItem(DB_KEY)||'[]'); return Array.isArray(x)?x:[]; } catch { return []; } }
function persist(){ localStorage.setItem(DB_KEY,JSON.stringify(books)); render(); }
function say(message,error=false){ $('status').textContent=message; $('status').classList.toggle('error',error); }
function cleanIsbn(v){return String(v||'').replace(/[^0-9Xx]/g,'').toUpperCase();}
function validIsbn(v){const s=cleanIsbn(v); if(s.length===10){let sum=0;for(let i=0;i<10;i++){const n=i===9&&s[i]==='X'?10:Number(s[i]);if(!Number.isInteger(n)||n<0||n>10)return false;sum+=(10-i)*n;}return sum%11===0;} if(s.length===13&&/^\d{13}$/.test(s)){let sum=0;for(let i=0;i<13;i++)sum+=Number(s[i])*(i%2?3:1);return sum%10===0;}return false;}
function canonicalIsbn(v){let s=cleanIsbn(v); if(s.length===10){let sum=0;for(let i=0;i<9;i++)sum+=Number(s[i])*(10-i);sum=(11-sum%11)%11;return s+' (ISBN-10)';}return s;}
function idFor(b){return b.isbn?cleanIsbn(b.isbn):'manual-'+(b.id||crypto.randomUUID());}
function normalize(b){return {id:b.id||crypto.randomUUID(),isbn:cleanIsbn(b.isbn||''),title:String(b.title||'').trim(),authors:String(b.authors||'').trim(),publisher:String(b.publisher||'').trim(),year:String(b.year||'').trim(),language:String(b.language||'').trim(),pages:String(b.pages||'').trim(),category:String(b.category||'Others').trim(),notes:String(b.notes||'').trim(),addedAt:b.addedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),cover:b.cover||''};}

function mapGoogleCategory(catArray) {
 if (!Array.isArray(catArray) || catArray.length === 0) return null;
 const text = catArray.join(' ').toLowerCase();
 if (text.includes('history')) return 'History';
 if (text.includes('crime') || text.includes('thriller') || text.includes('mystery') || text.includes('detective')) return 'Crime and thrillers';
 if (text.includes('children') || text.includes('juvenile') || text.includes('young adult')) return 'Childrens';
 if (text.includes('fiction') || text.includes('novel') || text.includes('literature')) return 'Fictions';
 const options = ['History', 'Crime and thrillers', 'Fictions', 'Childrens', 'Others'];
 for (const cat of catArray) {
  const trimmed = cat.trim();
  const match = options.find(o => o.toLowerCase() === trimmed.toLowerCase());
  if (match) return match;
 }
 return null;
}

function render(){
 const q=$('filter').value.trim().toLowerCase();
 const shown=books.filter(b=>[b.isbn,b.title,b.authors,b.publisher,b.year,b.category,b.notes].join(' ').toLowerCase().includes(q)).sort((a,b)=>a.title.localeCompare(b.title));
 $('totalCount').textContent=books.length;
 const list=$('bookList');
 if(!shown.length){list.innerHTML=`<div class="empty">${books.length?'No matching books.':'No books saved yet. Scan a barcode or enter an ISBN to get started.'}</div>`;return;}
 list.innerHTML=shown.map(b=>`<article class="book" data-id="${esc(b.id)}"><div class="booktop">${b.cover?`<img class="cover" src="${esc(b.cover)}" alt="" loading="lazy" onerror="this.style.display='none'">`:`<div class="cover" aria-hidden="true"></div>`}<div><h3>${esc(b.title||'Untitled book')}</h3><p>${esc(b.authors||'Author unknown')}</p><p>${esc([b.publisher,b.year,b.pages?b.pages+' pages':''].filter(Boolean).join(' · '))}</p><p>ISBN: ${esc(b.isbn||'Not recorded')} · ${esc(b.category||'Others')}</p>${b.notes?`<p>Notes: ${esc(b.notes)}</p>`:''}</div></div><div class="bookactions"><button class="secondary edit" data-id="${esc(b.id)}">Edit</button><button class="secondary lookup" data-isbn="${esc(b.isbn)}">Refresh metadata</button><button class="danger delete" data-id="${esc(b.id)}">Delete</button></div></article>`).join('');
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function showForm(book={}){editingId=book.id||null;$('editForm').classList.remove('hidden');for(const f of ['title','authors','publisher','year','language','pages','notes'])$(f).value=book[f]\vert{}\vert{}'';if(book.category)$('category').value=book.category;$('saveBtn').textContent=editingId?'Update book':'Save book';$('title').focus();}
function hideForm(){$('editForm').classList.add('hidden');editingId=null;}
async function lookup(isbn,existing=null){
 const s=cleanIsbn(isbn); if(!s){say('Enter an ISBN first.',true);return;}
 $('isbn').value=s; say('Looking up metadata from Google Books and Open Library…');
 const urls=[
  `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(s)}`,
  `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(s)}&format=json&jscmd=data`
 ];
 let found=null, errors=[];
 try{
  const r=await fetch(urls[0]);
  if(!r.ok)throw Error('Google Books HTTP '+r.status);
  const j=await r.json();
  const v=j.items?.[0]?.volumeInfo;
  if(v){
   const mappedCat = mapGoogleCategory(v.categories);
   found={
    title:v.title,
    authors:(v.authors||[]).join(', '),
    publisher:v.publisher,
    year:(v.publishedDate||'').slice(0,4),
    language:v.language,
    pages:v.pageCount,
    cover:v.imageLinks?.thumbnail?.replace('http://','https://'),
    description:v.description,
    category:mappedCat
   };
  }
 }catch(e){errors.push('Google Books: '+e.message);}
 if(!found){try{const r=await fetch(urls[1]);if(!r.ok)throw Error('Open Library HTTP '+r.status);const j=await r.json();const v=j['ISBN:'+s];if(v)found={title:v.title,authors:(v.authors||[]).map(a=>a.name).join(', '),publisher:(v.publishers||[]).map(p=>p.name).join(', '),year:v.publish_date?String(v.publish_date).match(/\d{4}/)?.[0]||'':'',pages:v.number_of_pages,cover:v.cover?.medium||v.cover?.large};}catch(e){errors.push('Open Library: '+e.message);}}
 if(found){
  const base=existing||{isbn:s,category:found.category||$('category').value};
  if(!existing && found.category) { base.category = found.category; }
  showForm({...base,...Object.fromEntries(Object.entries(found).filter(([k,v])=>v!==undefined&&v!==null&&v!=='')),isbn:s});
  say('Metadata found. Check the details, choose a category, then save.');
 }else{
  showForm({...existing,isbn:s,category:existing?.category||$('category').value});
  say(validIsbn(s)?'No metadata found. You can enter the details manually and save. '+errors.join(' | '):'No metadata found and the ISBN checksum looks invalid. Check the number or enter details manually.',true);
 }
}
function save(){
 const isbn=cleanIsbn($('isbn').value);
 const data=normalize({id:editingId||undefined,isbn,title:$('title').value,authors:$('authors').value,publisher:$('publisher').value,year:$('year').value,language:$('language').value,pages:$('pages').value,category:$('category').value,notes:$('notes').value});
 const coverCurrent=editingId?books.find(b=>b.id===editingId)?.cover:'';
 data.cover=coverCurrent||'';
 if(!data.title){say('Please enter a title.',true);$('title').focus();return;}
 const same=isbn?books.find(b=>cleanIsbn(b.isbn)===isbn&&b.id!==editingId):null;
 if(same){if(!confirm('A book with this ISBN already exists. Update that record with these details?'))return;data.id=same.id;data.addedAt=same.addedAt;books=books.filter(b=>b.id!==same.id);}
 if(editingId){const old=books.find(b=>b.id===editingId);data.addedAt=old?.addedAt||data.addedAt;data.cover=old?.cover||data.cover;books=books.filter(b=>b.id!==editingId);}
 books.push(data);persist();hideForm();say('Book saved.');$('isbn').value='';
}
function editBook(id){const b=books.find(x=>x.id===id);if(!b)return;$('isbn').value=b.isbn;$('category').value=b.category||'Others';showForm(b);say('Edit the details, then save.');}
function deleteBook(id){const b=books.find(x=>x.id===id);if(b&&confirm(`Delete “${b.title}”?`)){books=books.filter(x=>x.id!==id);persist();say('Book deleted.');}}
function csvCell(v){let s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function exportCsv(){const cols=['isbn','title','authors','publisher','year','language','pages','category','notes','addedAt','updatedAt'];const rows=[cols.join(','),...books.map(b=>cols.cols.map(k=>csvCell(b[k])).join(','))];const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='book-tracker-backup-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);say(`Exported ${books.length} book records to CSV.`);}
function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}else cell+=c;}if(cell.length\vert{}\vert{}row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}return rows.filter(r=>r.some(x=>x.trim()!==''));}
async function importCsv(file){try{const rows=parseCsv((await file.text()).replace(/^\ufeff/,''));if(rows.length<2)throw Error('CSV has no data rows.');const headers=rows.shift().map(h=>h.trim().toLowerCase());if(!headers.includes('title'))throw Error('CSV needs a title column.');let added=0,updated=0,skipped=0;for(const row of rows){const obj={};headers.forEach((h,i)=>obj[h]=row[i]??'');if(!String(obj.title||'').trim()){skipped++;continue;}const isbn=cleanIsbn(obj.isbn||'');const existing=isbn?books.find(b=>cleanIsbn(b.isbn)===isbn):null;const b=normalize({...obj,isbn,id:existing?.id||undefined,addedAt:existing?.addedAt||obj.addedat});if(existing){b.cover=existing.cover||'';books=books.map(x=>x.id===existing.id?b:x);updated++;}else{books.push(b);added++;}}persist();say(`Import complete: ${added} added, ${updated} updated, ${skipped} skipped.`);}catch(e){say('Import failed: '+e.message,true);}finally{$('csvFile').value='';}}
async function startScan(){
 if(!('BarcodeDetector' in window)){say('Barcode scanning is not supported by this browser. Enter the ISBN manually instead.',true);return;}
 try{detector=new BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e']});stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});$('video').srcObject=stream;$('cameraWrap').style.display='block';await$('video').play();scanLoop=true;say('Camera is on. Hold the ISBN barcode inside the camera view (tap video to focus).');scanFrame();}catch(e){stopScan();say('Could not start camera: '+e.message+'. Check camera permission and use an HTTPS page.',true);}
}
async function scanFrame(){if(!scanLoop||!stream)return;try{const codes=await detector.detect($('video'));if(codes.length){const value=codes[0].rawValue;if(value){$('isbn').value=value;stopScan();say('Barcode captured: '+value);lookup(value);return;}}}catch{}requestAnimationFrame(scanFrame);}
function stopScan(){scanLoop=false;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}$('video').srcObject=null;$('cameraWrap').style.display='none';}

// Click to focus video stream
$('video').addEventListener('click', async () => {
 if(!stream)return;
 try{
  const track=stream.getVideoTracks()[0];
  if(!track)return;
  const capabilities=track.getCapabilities?track.getCapabilities():{};
  if(capabilities.focusMode){
   const modes=Array.isArray(capabilities.focusMode)?capabilities.focusMode:[capabilities.focusMode];
   if(modes.includes('single-shot')){
    await track.applyConstraints({advanced:[{focusMode:'single-shot'}]});
    say('Camera focus triggered.');
   }else if(modes.includes('continuous')){
    await track.applyConstraints({advanced:[{focusMode:'continuous'}]});
    say('Camera focus set to continuous.');
   }else if(modes.includes('manual')){
    await track.applyConstraints({advanced:[{focusMode:'manual'}]});
    say('Camera focus set to manual.');
   }
  }else{
   await track.applyConstraints({advanced:[{focusMode:'single-shot'}]}).catch(()=>{});
   say('Camera focus requested.');
  }
 }catch(e){console.warn('Focus constraint error:',e);}
});

$('lookupBtn').addEventListener('click',()=>lookup($('isbn').value));$('scanBtn').addEventListener('click',startScan);$('stopScan').addEventListener('click',stopScan);$('manualBtn').addEventListener('click',()=>{showForm({isbn:cleanIsbn($('isbn').value),category:$('category').value});say('Enter any details you have, then save.');});
$('saveBtn').addEventListener('click',save);$('cancelEdit').addEventListener('click',()=>{hideForm();say('Editing cancelled.');});
$('filter').addEventListener('input',render);$('clearSearch').addEventListener('click',()=>{$('filter').value='';render();});$('exportBtn').addEventListener('click',exportCsv);$('csvFile').addEventListener('change',e=>{if(e.target.files[0])importCsv(e.target.files[0]);});$('clearAllBtn').addEventListener('click',()=>{if(books.length&&confirm('Delete every saved book from this device? Export a CSV backup first if needed.')){books=[];persist();say('All book records deleted.');}});
$('bookList').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.classList.contains('edit'))editBook(b.dataset.id);if(b.classList.contains('delete'))deleteBook(b.dataset.id);if(b.classList.contains('lookup'))lookup(b.dataset.isbn,books.find(x=>x.isbn===b.dataset.isbn));});
if('serviceWorker' in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();
})();