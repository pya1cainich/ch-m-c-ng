/* ── app.js ── */
/* ════════════════════════════════════════════════════════════════════
   app.js — ỨNG DỤNG CHÍNH
   Load SAU utils.js, TRƯỚC checkin.js

   📌 HƯỚNG DẪN CHỈNH SỬA NHANH:
   ┌─────────────────────────────────────────────────────────────┐
   │ Đổi text nút/nhãn bất kỳ:                                  │
   │   → Tìm UI_STR{} bên dưới, sửa theo key tương ứng         │
   │   → Mỗi key có đủ 11 ngôn ngữ                              │
   │                                                             │
   │ Thêm ngôn ngữ mới:                                         │
   │   1. Thêm vào LANGS[]                                       │
   │   2. Thêm block mới vào TRAN{}                              │
   │   3. Thêm key mới vào MỌI entry trong UI_STR{}             │
   │                                                             │
   │ Đổi tên quốc gia/hệ số lương:                              │
   │   → PAYROLL_RULES{} — hệ số OT/đêm/lễ                     │
   │   → TAX_RULES{} — thuế + bảo hiểm                         │
   │   → COUNTRIES[] — danh sách quốc gia chọn được             │
   │                                                             │
   │ Đổi ngày lễ quốc gia:                                      │
   │   → HOLIDAYS_BY_COUNTRY{}                                   │
   └─────────────────────────────────────────────────────────────┘
   ════════════════════════════════════════════════════════════════════ */

/* ================================================
   CHẤM CÔNG PRO v2.2 | Single-file PWA
   Đa ngôn ngữ: VN, EN, KR, JP, CN, MM
   Tính lương theo luật 6 quốc gia
   Lưu trữ: localStorage | GPS Geofencing
   ================================================ */

/* ===== TIỆN ÍCH DÙNG CHUNG ===== */

/** Chọn một nút trong nhóm .num-btn (xóa sel cũ, thêm sel mới) */
function selNumBtn(el){
  el.parentElement.querySelectorAll('.num-btn').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
}

/** Lưu dữ liệu vào localStorage (có bắt lỗi tránh crash khi bộ nhớ đầy) */
// → function lsSet(key,data){try{localStorage.setItem(key,JSON.s (moved to utils.js)

/** Đọc dữ liệu từ localStorage (trả null nếu lỗi) */
// → function lsGet(key){try{const v=localStorage.getItem(key);re (moved to utils.js)

/** Lấy object bản dịch theo ngôn ngữ hiện tại của người dùng */
function getLang(){return TRAN[userData.lang||'vi']||TRAN.vi;}

/** Định dạng số tiền theo quốc gia */
// → function fmtMoney(n,country){ (moved to utils.js)

/* ===== DỮ LIỆU NGÀY LỄ QUỐC GIA 2025-2026 ===== */
/* ===== LỊCH NGÀY LỄ THEO QUỐC GIA 2025-2026 ===== */
const HOLIDAYS_BY_COUNTRY = {
  VN: { // Việt Nam
    '2025-0-1':'Tết Dương lịch','2025-1-25':'25 Chạp','2025-1-26':'26 Chạp','2025-1-27':'27 Chạp',
    '2025-1-28':'Giao thừa','2025-1-29':'Mùng 1 Tết','2025-1-30':'Mùng 2 Tết',
    '2025-1-31':'Mùng 3 Tết','2025-2-1':'Mùng 4 Tết','2025-2-2':'Mùng 5 Tết',
    '2025-3-18':'Giỗ Tổ Hùng Vương','2025-4-30':'30/4 Giải phóng',
    '2025-4-1':'1/5 Lao động','2025-8-1':'Nghỉ bù 2/9','2025-8-2':'2/9 Quốc khánh',
    '2026-0-1':'Tết Dương lịch','2026-1-14':'27 Chạp','2026-1-15':'28 Chạp',
    '2026-1-16':'Mùng 1 Tết','2026-1-17':'Mùng 2 Tết','2026-1-18':'Mùng 3 Tết',
    '2026-1-19':'Mùng 4 Tết','2026-1-20':'Mùng 5 Tết',
    '2026-3-26':'Giỗ Tổ Hùng Vương','2026-3-30':'Bù 30/4','2026-4-1':'30/4',
    '2026-4-2':'1/5 Lao động','2026-4-3':'Bù 1/5','2026-7-31':'Bù 2/9',
    '2026-8-1':'Nghỉ 2/9','2026-8-2':'2/9 Quốc khánh'
  },
  KR: { // 한국 공휴일
    '2025-0-1':'신정','2025-0-28':'설날 연휴','2025-0-29':'설날','2025-0-30':'설날 연휴',
    '2025-2-1':'삼일절','2025-4-5':'어린이날','2025-4-6':'어린이날 대체',
    '2025-5-6':'부처님오신날','2025-5-6':'현충일','2025-7-15':'광복절',
    '2025-9-5':'추석 연휴','2025-9-6':'추석','2025-9-7':'추석 연휴','2025-9-3':'개천절',
    '2025-9-9':'한글날','2025-11-25':'크리스마스',
    '2026-0-1':'신정','2026-1-16':'설날 연휴','2026-1-17':'설날','2026-1-18':'설날 연휴',
    '2026-2-1':'삼일절','2026-4-5':'어린이날','2026-5-24':'부처님오신날',
    '2026-5-6':'현충일','2026-7-15':'광복절','2026-9-24':'추석 연휴',
    '2026-9-25':'추석','2026-9-26':'추석 연휴','2026-9-3':'개천절',
    '2026-9-9':'한글날','2026-11-25':'크리스마스'
  },
  JP: { // 日本の祝日
    '2025-0-1':'元日','2025-0-13':'成人の日','2025-1-11':'建国記念の日',
    '2025-2-20':'春分の日','2025-3-29':'昭和の日','2025-4-3':'憲法記念日',
    '2025-4-4':'みどりの日','2025-4-5':'こどもの日','2025-6-21':'海の日',
    '2025-7-11':'山の日','2025-8-15':'敬老の日','2025-8-23':'秋分の日',
    '2025-9-13':'スポーツの日','2025-10-3':'文化の日','2025-10-24':'勤労感謝の日',
    '2026-0-1':'元日','2026-0-12':'成人の日','2026-1-11':'建国記念の日',
    '2026-2-20':'春分の日','2026-3-29':'昭和の日','2026-4-3':'憲法記念日',
    '2026-4-4':'みどりの日','2026-4-5':'こどもの日','2026-6-20':'海の日',
    '2026-7-11':'山の日','2026-8-21':'敬老の日','2026-8-23':'秋分の日',
    '2026-9-12':'スポーツの日','2026-10-3':'文化の日','2026-10-23':'勤労感謝の日'
  },
  TW: { // 台灣國定假日
    '2025-0-1':'元旦','2025-0-27':'除夕','2025-0-28':'春節','2025-0-29':'春節',
    '2025-0-30':'春節','2025-1-28':'和平紀念日','2025-3-4':'兒童節',
    '2025-3-5':'清明節','2025-5-1':'端午節','2025-9-6':'中秋節',
    '2025-9-10':'國慶日','2026-0-1':'元旦','2026-1-16':'除夕',
    '2026-1-17':'春節','2026-1-18':'春節','2026-1-19':'春節',
    '2026-1-28':'和平紀念日','2026-3-4':'兒童節','2026-3-5':'清明節',
    '2026-5-20':'端午節','2026-9-25':'中秋節','2026-9-10':'國慶日'
  },
  US: { // US Federal Holidays
    '2025-0-1':'New Year Day','2025-0-20':'MLK Day','2025-1-17':'Presidents Day',
    '2025-4-26':'Memorial Day','2025-5-19':'Juneteenth','2025-6-4':'Independence Day',
    '2025-8-1':'Labor Day','2025-9-13':'Columbus Day','2025-10-11':'Veterans Day',
    '2025-10-27':'Thanksgiving','2025-11-25':'Christmas Day',
    '2026-0-1':'New Year Day','2026-0-19':'MLK Day','2026-1-16':'Presidents Day',
    '2026-4-25':'Memorial Day','2026-5-19':'Juneteenth','2026-6-4':'Independence Day',
    '2026-8-7':'Labor Day','2026-9-12':'Columbus Day','2026-10-11':'Veterans Day',
    '2026-10-26':'Thanksgiving','2026-11-25':'Christmas Day'
  },
  MY: { // မြန်မာနိုင်ငံ အများပြည်သူ ရုံးပိတ်ရက်
    '2025-0-1':'နှစ်သစ်ကူး','2025-0-4':'လွတ်လပ်ရေးနေ့',
    '2025-2-2':'တပ်မတော်နေ့','2025-3-13':'မြန်မာနှစ်ဆန်း',
    '2025-3-14':'မြန်မာနှစ်ဆန်း','2025-3-15':'မြန်မာနှစ်ဆန်း',
    '2025-4-1':'May Day','2025-6-19':'မာတာနေ့',
    '2025-7-19':'အာဇာနည်နေ့','2025-9-20':'မီးထွန်းပွဲ',
    '2025-11-25':'ခရစ္စမတ်',
    '2026-0-1':'နှစ်သစ်ကူး','2026-0-4':'လွတ်လပ်ရေးနေ့',
    '2026-2-2':'တပ်မတော်နေ့','2026-3-13':'မြန်မာနှစ်ဆန်း',
    '2026-3-14':'မြန်မာနှစ်ဆန်း','2026-3-15':'မြန်မာနှစ်ဆန်း',
    '2026-4-1':'May Day','2026-7-19':'အာဇာနည်နေ့','2026-11-25':'ခရစ္စမတ်'
  },
  TH: { // วันหยุดราชการไทย 2025–2026
    '2025-0-1':'วันขึ้นปีใหม่','2025-1-12':'มาฆบูชา','2025-3-6':'จักรีวันสี',
    '2025-3-13':'สงกรานต์','2025-3-14':'สงกรานต์','2025-3-15':'สงกรานต์',
    '2025-4-1':'วันแรงงาน','2025-4-4':'วันฉัตรมงคล','2025-4-5':'วันฉัตรมงคล',
    '2025-5-2':'วันวิสาขบูชา','2025-5-3':'ชดเชย','2025-6-1':'อาสาฬหบูชา',
    '2025-6-28':'วันเฉลิมพระชนมพรรษา ร.10','2025-7-11':'วันแม่แห่งชาติ',
    '2025-9-23':'วันปิยะมหาราช','2025-11-5':'วันพ่อแห่งชาติ',
    '2025-11-10':'วันรัฐธรรมนูญ','2025-11-31':'วันสิ้นปี',
    '2026-0-1':'วันขึ้นปีใหม่','2026-1-1':'มาฆบูชา','2026-3-6':'จักรีวันสี',
    '2026-3-13':'สงกรานต์','2026-3-14':'สงกรานต์','2026-3-15':'สงกรานต์',
    '2026-4-1':'วันแรงงาน','2026-4-4':'วันฉัตรมงคล','2026-6-28':'วันเฉลิมพระชนมพรรษา ร.10',
    '2026-7-11':'วันแม่แห่งชาติ','2026-9-23':'วันปิยะมหาราช',
    '2026-11-5':'วันพ่อแห่งชาติ','2026-11-10':'วันรัฐธรรมนูญ'
  },
  ID: { // Hari Libur Nasional Indonesia 2025–2026
    '2025-0-1':'Tahun Baru','2025-0-27':'Isra Mi\'raj','2025-0-28':'Cuti Bersama',
    '2025-0-29':'Imlek','2025-2-29':'Nyepi','2025-2-31':'Cuti Nyepi',
    '2025-3-3':'Cuti Bersama','2025-3-17':'Cuti Bersama','2025-3-18':'Idul Fitri',
    '2025-3-19':'Idul Fitri','2025-3-7':'Wafat Isa Al Masih',
    '2025-4-1':'Hari Buruh','2025-4-12':'Waisak','2025-4-13':'Cuti Bersama',
    '2025-4-29':'Kenaikan Isa','2025-5-1':'Pancasila','2025-5-6':'Idul Adha',
    '2025-5-27':'Tahun Baru Hijriyah','2025-7-17':'HUT Kemerdekaan',
    '2025-8-5':'Maulid Nabi','2025-11-25':'Natal','2025-11-26':'Cuti Natal',
    '2026-0-1':'Tahun Baru','2026-1-17':'Imlek','2026-1-26':'Isra Mi\'raj',
    '2026-2-19':'Nyepi','2026-3-27':'Wafat Isa Al Masih','2026-4-1':'Hari Buruh',
    '2026-4-6':'Idul Fitri','2026-4-7':'Idul Fitri','2026-4-8':'Cuti Bersama',
    '2026-5-1':'Waisak','2026-5-1':'Pancasila','2026-5-14':'Kenaikan Isa',
    '2026-5-26':'Idul Adha','2026-7-17':'HUT Kemerdekaan','2026-8-16':'Maulid Nabi',
    '2026-11-25':'Natal'
  },
  PH: { // Philippine Public Holidays 2025–2026
    '2025-0-1':'New Year\'s Day','2025-1-25':'EDSA Revolution',
    '2025-3-9':'Maundy Thursday','2025-3-10':'Good Friday',
    '2025-3-31':'Eid\'l Fitr','2025-3-9':'Araw ng Kagitingan',
    '2025-4-1':'Labor Day','2025-5-6':'Eid\'l Adha',
    '2025-5-12':'Independence Day','2025-7-25':'Ninoy Aquino Day',
    '2025-7-25':'National Heroes Day','2025-10-1':'All Saints Day',
    '2025-10-30':'Bonifacio Day','2025-11-7':'Immaculate Conception',
    '2025-11-25':'Christmas Day','2025-11-30':'Rizal Day',
    '2026-0-1':'New Year\'s Day','2026-1-25':'EDSA Revolution',
    '2026-2-19':'Maundy Thursday','2026-2-20':'Good Friday',
    '2026-3-9':'Araw ng Kagitingan','2026-4-1':'Labor Day',
    '2026-5-12':'Independence Day','2026-7-21':'Ninoy Aquino Day',
    '2026-7-25':'National Heroes Day','2026-10-1':'All Saints Day',
    '2026-10-30':'Bonifacio Day','2026-11-25':'Christmas Day','2026-11-30':'Rizal Day'
  },
  NP: { // Nepal Public Holidays 2025–2026 (Gregorian approx)
    '2025-0-11':'Prithvi Jayanti','2025-1-26':'Maha Shivaratri',
    '2025-2-14':'Holi','2025-3-6':'Ram Navami','2025-3-14':'Chaitra Ashtami',
    '2025-4-29':'Buddha Purnima','2025-7-11':'Gaura Parva',
    '2025-8-19':'Teej','2025-9-2':'Indra Jatra','2025-9-16':'Ghatasthapana',
    '2025-9-20':'Dashain (Phulpati)','2025-9-21':'Maha Ashtami',
    '2025-9-22':'Maha Nawami','2025-9-23':'Vijaya Dashami','2025-10-9':'Tihar Start',
    '2025-10-10':'Laxmi Puja','2025-10-11':'Gobardhan Puja','2025-10-12':'Bhai Tika',
    '2025-10-30':'Chhath Puja','2025-11-25':'Christmas',
    '2026-0-11':'Prithvi Jayanti','2026-1-15':'Maha Shivaratri','2026-2-3':'Holi',
    '2026-3-25':'Ram Navami','2026-4-19':'Buddha Purnima',
    '2026-9-12':'Dashain (Vijaya)','2026-9-29':'Tihar/Laxmi Puja','2026-11-25':'Christmas'
  },
  IN: { // Indian National Holidays 2025–2026
    '2025-0-14':'Makar Sankranti','2025-0-26':'Republic Day',
    '2025-2-14':'Holi','2025-3-6':'Ram Navami','2025-3-10':'Mahavir Jayanti',
    '2025-3-14':'Dr. Ambedkar Jayanti','2025-3-18':'Good Friday',
    '2025-4-12':'Buddha Purnima','2025-5-6':'Eid ul-Adha',
    '2025-7-15':'Independence Day','2025-7-27':'Janmashtami',
    '2025-9-2':'Gandhi Jayanti','2025-9-20':'Dussehra',
    '2025-10-10':'Diwali (Laxmi Puja)','2025-10-11':'Diwali','2025-10-13':'Bhai Dooj',
    '2025-10-5':'Guru Nanak Jayanti','2025-11-25':'Christmas',
    '2026-0-26':'Republic Day','2026-2-3':'Holi','2026-3-25':'Ram Navami',
    '2026-3-3':'Good Friday','2026-7-15':'Independence Day',
    '2026-9-2':'Gandhi Jayanti','2026-11-25':'Christmas'
  }
};
/** Lấy tên ngày lễ theo quốc gia của người dùng (an toàn khi userData chưa load) */
function gNL(n,t,g){
  const country = (typeof userData !== 'undefined' && userData.country) ? userData.country : 'VN';
  const db = HOLIDAYS_BY_COUNTRY[country] || HOLIDAYS_BY_COUNTRY.VN;
  return db[n+'-'+t+'-'+g] || null;
}

function pad2(n){return String(n).padStart(2,'0');}
function legacyDateKeyFromParts(y,m,g){return y+'-'+m+'-'+g;}
function dateKeyFromParts(y,m,g){return y+'-'+pad2(Number(m)+1)+'-'+pad2(g);}
function dateKeyFromDate(d){return dateKeyFromParts(d.getFullYear(),d.getMonth(),d.getDate());}
function normalizeDateKey(k){
  const raw=String(k||'');
  const m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if(!m)return raw;
  const y=Number(m[1]), mo=Number(m[2]), day=Number(m[3]);
  if(!Number.isFinite(y)||!Number.isFinite(mo)||!Number.isFinite(day))return raw;
  const legacyMonth=(m[2].length<2||m[3].length<2||mo===0);
  if(legacyMonth&&mo>=0&&mo<=11)return dateKeyFromParts(y,mo,day);
  if(mo>=1&&mo<=12)return y+'-'+pad2(mo)+'-'+pad2(day);
  return raw;
}
function legacyDateKeyFromStandard(k){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k||''));
  if(!m)return '';
  return legacyDateKeyFromParts(Number(m[1]),Number(m[2])-1,Number(m[3]));
}
function mergeAttendanceRecord(oldRec,newRec){
  if(!oldRec||typeof oldRec!=='object')return newRec;
  if(!newRec||typeof newRec!=='object')return oldRec;
  const merged=Object.assign({},oldRec,newRec);
  if(oldRec.sub||newRec.sub)merged.sub=Object.assign({},oldRec.sub||{},newRec.sub||{});
  return merged;
}
function migrateAttendanceDateKeys(data){
  if(!data||typeof data!=='object')return data||{};
  let changed=false;
  const out={};
  Object.keys(data).forEach(k=>{
    const nk=normalizeDateKey(k);
    if(nk!==k)changed=true;
    out[nk]=(nk===k)
      ? mergeAttendanceRecord(out[nk],data[k])
      : mergeAttendanceRecord(data[k],out[nk]);
  });
  return changed?out:data;
}
function getAttRecordByKey(k){
  const data=(typeof attData!=='undefined'&&attData)?attData:{};
  const nk=normalizeDateKey(k);
  return data[nk]||data[legacyDateKeyFromStandard(nk)]||data[k]||null;
}
function getAttRecordByDateParts(y,m,g){return getAttRecordByKey(dateKeyFromParts(y,m,g));}
// Alias cho code cũ dùng NL trực tiếp
const NL = HOLIDAYS_BY_COUNTRY.VN;

/* ===== QUY TẮC TÍNH LƯƠNG THEO LUẬT TỪNG QUỐC GIA ===== */
const PAYROLL_RULES = {
  VN:{
    name:{vi:'Việt Nam',en:'Vietnam',ko:'베트남',ja:'ベトナム',zh:'越南',my:'ဗီယက်နမ်',th:'เวียดนาม',id:'Vietnam',ph:'Vietnam',ne:'भियतनाम',hi:'वियतनाम'}, flag:'🇻🇳', currency:'₫', currencyCode:'VND',
    normalFactor:1.0,
    otFactor:1.5, weekendOtFactor:2.0,
    nightFactor:1.3, nightOtExtra:0.2, nightIsAdditive:false,
    nightStart:22, nightEnd:6,
    holidayFactor:4.0,
    weeklyHours:48, dailyOtThreshold:8,
    basis:{vi:'Điều 98–112 BLLĐ 2019',en:'Labor Code Art.98–112 (2019)',ko:'근로기준법 제98–112조 (2019)',ja:'労働法第98–112条 (2019)',zh:'劳动法第98–112条 (2019)',my:'အလုပ်သမားဥပဒေ Art.98–112 (2019)',th:'กฎหมายแรงงาน มาตรา 98–112 (2562)',id:'UU Ketenagakerjaan Ps.98–112 (2019)',ph:'Labor Code Art.98–112 (2019)',ne:'श्रम ऐन धारा 98–112 (2019)',hi:'श्रम संहिता अनु. 98–112 (2019)'},
    tags:{
      vi:['×1.5 tăng ca ngày thường','×2.0 tăng ca Chủ nhật','×4.0 làm ngày lễ','+30% ca đêm (22h–6h)','+50% tăng ca đêm'],
      en:['×1.5 weekday OT','×2.0 Sunday OT','×4.0 public holiday','+30% night shift (10PM–6AM)','+50% night OT'],
      ko:['×1.5 평일 초과근무','×2.0 일요일 초과근무','×4.0 공휴일 근무','+30% 야간 (22h–6h)','+50% 야간 초과근무'],
      ja:['×1.5 平日残業','×2.0 日曜日出勤','×4.0 法定休日','+30% 深夜 (22h–6h)','+50% 深夜残業'],
      zh:['×1.5 平日加班','×2.0 周日加班','×4.0 法定假日','+30% 夜班 (22h–6h)','+50% 夜班加班'],
      my:['×1.5 ချိန်ကျော်','×2.0 တနင်္ဂနွေ','×4.0 ရုံးပိတ်ရက်','+30% ည (22h–6h)','+50% ည ချိန်ကျော်'],
      th:['×1.5 ล่วงเวลาวันธรรมดา','×2.0 วันอาทิตย์','×4.0 วันหยุดนักขัตฤกษ์','+30% กะกลางคืน (22h–6h)','+50% OT กลางคืน'],
      id:['×1.5 lembur hari biasa','×2.0 lembur hari Minggu','×4.0 hari libur nasional','+30% shift malam (22h–6h)','+50% lembur malam'],
      ph:['×1.5 weekday OT','×2.0 Linggo','×4.0 pista opisyal','+30% gabi (22h–6h)','+50% gabi OT'],
      ne:['×1.5 साधारण ओभरटाइम','×2.0 आइतबार','×4.0 सार्वजनिक बिदा','+30% रात पाली (22h–6h)','+50% रात ओभरटाइम'],
      hi:['×1.5 सामान्य ओवरटाइम','×2.0 रविवार','×4.0 सार्वजनिक छुट्टी','+30% रात शिफ्ट (22h–6h)','+50% रात OT'],
    },
  },
  KR:{
    name:{vi:'Hàn Quốc',en:'Korea',ko:'한국',ja:'韓国',zh:'韩国',my:'တောင်ကိုရီးယား',th:'เกาหลีใต้',id:'Korea Selatan',ph:'South Korea',ne:'दक्षिण कोरिया',hi:'दक्षिण कोरिया'}, flag:'🇰🇷', currency:'₩', currencyCode:'KRW',
    normalFactor:1.0,
    otFactor:1.5, nightFactor:0.5, nightIsAdditive:true,
    nightStart:22, nightEnd:6,
    holidayFactor:1.5, holidayOtFactor:2.0,
    weeklyHours:40, dailyOtThreshold:8, maxWeeklyHours:52,
    basis:{vi:'Luật tiêu chuẩn lao động Điều 56',en:'Labor Standards Act Art.56',ko:'근로기준법 제56조',ja:'労働基準法 第56条',zh:'劳动基准法 第56条',my:'အလုပ်သမားဥပဒေ Art.56',th:'พ.ร.บ.มาตรฐานแรงงาน มาตรา 56',id:'UU Standar Ketenagakerjaan Ps.56',ph:'Labor Standards Act Art.56',ne:'श्रम मापदण्ड ऐन धारा 56',hi:'श्रम मानक अधिनियम अनु. 56'},
    tags:{
      vi:['×1.5 초과근무 (>40h/주)','+50% 야간 가산 (22h–6h)','×1.5 휴일 ≤8h','×2.0 휴일 >8h','최대 52h/주'],
      en:['×1.5 OT (>40h/week)','+50% night premium (10PM–6AM)','×1.5 holiday ≤8h','×2.0 holiday >8h','Max 52h/week'],
      ko:['×1.5 초과근무 (>40h/주)','야간 +50% 가산 (22h–6h)','×1.5 휴일근무 ≤8h','×2.0 휴일근무 >8h','최대 52h/주'],
      ja:['×1.5 時間外 (>40h/週)','夜間 +50% 加算 (22h–6h)','×1.5 休日 ≤8h','×2.0 休日 >8h','最大 52h/週'],
      zh:['×1.5 加班 (>40h/周)','夜间 +50% 加给 (22h–6h)','×1.5 假日 ≤8h','×2.0 假日 >8h','每周最多52h'],
      my:['×1.5 ချိန်ကျော် (>40h/wk)','+50% ည (22h–6h)','×1.5 ရုံးပိတ် ≤8h','×2.0 ရုံးပိတ် >8h','Max 52h/wk'],
      th:['×1.5 ล่วงเวลา (>40h/สัปดาห์)','ค่ากลางคืน +50% (22h–6h)','×1.5 วันหยุด ≤8h','×2.0 วันหยุด >8h','สูงสุด 52h/สัปดาห์'],
      id:['×1.5 lembur (>40j/minggu)','malam +50% (22j–6j)','×1.5 libur ≤8j','×2.0 libur >8j','Maks 52j/minggu'],
      ph:['×1.5 OT (>40h/linggo)','+50% gabi (22h–6h)','×1.5 holiday ≤8h','×2.0 holiday >8h','Max 52h/linggo'],
      ne:['×1.5 ओभरटाइम (>40h/हप्ता)','+50% रात (22h–6h)','×1.5 बिदा ≤8h','×2.0 बिदा >8h','अधिकतम 52h/हप्ता'],
      hi:['×1.5 ओवरटाइम (>40h/सप्ताह)','+50% रात (22h–6h)','×1.5 छुट्टी ≤8h','×2.0 छुट्टी >8h','अधिकतम 52h/सप्ताह'],
    },
  },
  JP:{
    name:{vi:'Nhật Bản',en:'Japan',ko:'일본',ja:'日本',zh:'日本',my:'ဂျပန်',th:'ญี่ปุ่น',id:'Jepang',ph:'Hapon',ne:'जापान',hi:'जापान'}, flag:'🇯🇵', currency:'¥', currencyCode:'JPY',
    normalFactor:1.0,
    otFactor:1.25, otOver60Factor:1.5,
    nightFactor:0.25, nightIsAdditive:true,
    nightStart:22, nightEnd:5,
    holidayFactor:1.35, holidayNightFactor:1.60,
    weeklyHours:40, dailyOtThreshold:8,
    monthlyOtLimit:45, monthlyOtSpecialLimit:100,
    basis:{vi:'Luật tiêu chuẩn lao động Điều 37',en:'Labor Standards Act Art.37',ko:'근로기준법 제37조',ja:'労働基準法 第37条',zh:'劳动基准法 第37条',my:'အလုပ်သမားဥပဒေ Art.37',th:'พ.ร.บ.มาตรฐานแรงงาน มาตรา 37',id:'UU Standar Ketenagakerjaan Ps.37',ph:'Labor Standards Act Art.37',ne:'श्रम मापदण्ड ऐन धारा 37',hi:'श्रम मानक अधिनियम अनु. 37'},
    tags:{
      vi:['×1.25 残業 (>40h/週 or >8h/日)','×1.5 残業 >60h/月','+25% 深夜 22h–5h','×1.35 法定休日','×1.5 深夜残業'],
      en:['×1.25 OT (>40h/week or >8h/day)','×1.5 OT >60h/month','+25% late night (10PM–5AM)','×1.35 statutory holiday','×1.5 night OT'],
      ko:['×1.25 초과근무 (>40h/주)','×1.5 초과근무 >60h/월','+25% 심야 (22h–5h)','×1.35 법정 공휴일','×1.5 심야 초과근무'],
      ja:['×1.25 時間外 (>40h/週 or >8h/日)','×1.5 時間外 >60h/月','+25% 深夜 22h–5h','×1.35 法定休日','×1.5 深夜残業'],
      zh:['×1.25 加班 (>40h/周 or >8h/天)','×1.5 加班 >60h/月','+25% 深夜 (22h–5h)','×1.35 法定假日','×1.5 深夜加班'],
      my:['×1.25 ချိန်ကျော် (>40h/wk)','×1.5 ချိန်ကျော် >60h/လ','+25% နက်ရှိုင်း (22h–5h)','×1.35 ဥပဒေ ရုံးပိတ်','×1.5 ည OT'],
      th:['×1.25 ล่วงเวลา (>40h/wk)','×1.5 ล่วงเวลา >60h/เดือน','+25% กลางดึก (22h–5h)','×1.35 วันหยุดราชการ','×1.5 กลางดึก OT'],
      id:['×1.25 lembur (>40j/minggu)','×1.5 lembur >60j/bulan','+25% malam (22j–5j)','×1.35 libur nasional','×1.5 lembur malam'],
      ph:['×1.25 OT (>40h/linggo)','×1.5 OT >60h/buwan','+25% gabi (22h–5h)','×1.35 pista opisyal','×1.5 gabi OT'],
      ne:['×1.25 ओभरटाइम (>40h/हप्ता)','×1.5 ओभरटाइम >60h/महिना','+25% रात (22h–5h)','×1.35 सार्वजनिक बिदा','×1.5 रात OT'],
      hi:['×1.25 ओवरटाइम (>40h/सप्ताह)','×1.5 ओवरटाइम >60h/माह','+25% रात (22h–5h)','×1.35 राष्ट्रीय छुट्टी','×1.5 रात OT'],
    },
  },
  TW:{
    name:{vi:'Đài Loan',en:'Taiwan',ko:'대만',ja:'台湾',zh:'台湾',my:'တိုင်ဝမ်',th:'ไต้หวัน',id:'Taiwan',ph:'Taiwan',ne:'ताइवान',hi:'ताइवान'}, flag:'🇹🇼', currency:'NT$', currencyCode:'TWD',
    normalFactor:1.0,
    ot1Factor:1.33, ot1Hours:2,
    ot2Factor:1.67, ot2Hours:2,
    ot3Factor:2.0,
    flexRestFactor1:1.33, flexRestFactor2:1.67,
    fixedRestFactor:2.66,
    nightFactor:1.0, nightStart:22, nightEnd:6,
    weeklyHours:40, dailyOtThreshold:8,
    basis:{vi:'Luật lao động Điều 24',en:'Labor Standards Act Art.24',ko:'근로기준법 제24조',ja:'労働基準法 第24条',zh:'勞動基準法 第24條',my:'အလုပ်သမားဥပဒေ Art.24',th:'กฎหมายมาตรฐานแรงงาน มาตรา 24',id:'UU Standar Ketenagakerjaan Ps.24',ph:'Labor Standards Act Art.24',ne:'श्रम मापदण्ड ऐन धारा 24',hi:'श्रम मानक अधिनियम अनु. 24'},
    tags:{
      vi:['×1.33 加班前2h','×1.67 加班後2h','×2.66 固定/國定假日','×1.33/1.67 彈性休假日','夜間無法定加給'],
      en:['×1.33 OT first 2h','×1.67 OT next 2h','×2.66 fixed/national holidays','×1.33/1.67 flex rest day','No mandatory night premium'],
      ko:['×1.33 초과근무 첫 2h','×1.67 초과근무 다음 2h','×2.66 고정/국정 공휴일','×1.33/1.67 탄력 휴무일','야간 법정 가산 없음'],
      ja:['×1.33 時間外 最初2h','×1.67 時間外 次の2h','×2.66 固定/法定休日','×1.33/1.67 柔軟休日','深夜法定割増なし'],
      zh:['×1.33 加班前2h','×1.67 加班后2h','×2.66 固定/国定假日','×1.33/1.67 弹性休假日','无法定夜班加给'],
      my:['×1.33 ချိန်ကျော် ပထမ 2h','×1.67 ချိန်ကျော် နောက် 2h','×2.66 တည်ငြိမ်/နိုင်ငံ ရုံးပိတ်','×1.33/1.67 ပြောင်းလွယ် ရုံးပိတ်','ည ဥပဒေ မရ'],
      th:['×1.33 OT 2 ชั่วโมงแรก','×1.67 OT ถัดไป 2 ชั่วโมง','×2.66 วันหยุดราชการ','×1.33/1.67 วันหยุดยืดหยุ่น','ไม่มีค่าตอบแทนกลางคืนบังคับ'],
      id:['×1.33 OT 2 jam pertama','×1.67 OT 2 jam berikutnya','×2.66 libur nasional','×1.33/1.67 libur fleksibel','Tanpa premi malam wajib'],
      ph:['×1.33 OT unang 2h','×1.67 OT susunod 2h','×2.66 pista opisyal','×1.33/1.67 flex day','Walang night premium'],
      ne:['×1.33 ओभरटाइम पहिलो 2h','×1.67 ओभरटाइम अर्को 2h','×2.66 राष्ट्रिय बिदा','×1.33/1.67 लचिलो बिदा','रात भत्ता अनिवार्य छैन'],
      hi:['×1.33 OT पहले 2h','×1.67 OT अगले 2h','×2.66 राष्ट्रीय छुट्टी','×1.33/1.67 लचीली छुट्टी','रात भत्ता अनिवार्य नहीं'],
    },
  },
  US:{
    name:{vi:'Hoa Kỳ',en:'United States',ko:'미국',ja:'アメリカ',zh:'美国',my:'အမေရိကန်',th:'สหรัฐอเมริกา',id:'Amerika Serikat',ph:'Estados Unidos',ne:'संयुक्त राज्य',hi:'संयुक्त राज्य'}, flag:'🇺🇸', currency:'$', currencyCode:'USD',
    normalFactor:1.0,
    otFactor:1.5,
    nightFactor:1.0, nightStart:23, nightEnd:6,
    holidayFactor:1.0,
    weeklyHours:40, dailyOtThreshold:999,
    basis:{vi:'Đạo luật tiêu chuẩn lao động công bằng (FLSA)',en:'FLSA (Fair Labor Standards Act)',ko:'FLSA (공정근로기준법)',ja:'FLSA（公正労働基準法）',zh:'FLSA（公平劳工标准法）',my:'FLSA (Fair Labor Standards Act)',th:'FLSA (กฎหมายมาตรฐานแรงงานที่เป็นธรรม)',id:'FLSA (Fair Labor Standards Act)',ph:'FLSA (Fair Labor Standards Act)',ne:'FLSA (उचित श्रम मापदण्ड ऐन)',hi:'FLSA (उचित श्रम मानक अधिनियम)'},
    tags:{
      vi:['×1.5 OT (>40h/tuần)','Không có phụ cấp đêm liên bang','Không có phụ cấp lễ liên bang','Tùy theo tiểu bang/hợp đồng'],
      en:['×1.5 OT (>40h/week)','No federal night premium','No federal holiday rate','Varies by state/contract'],
      ko:['×1.5 초과근무 (>40h/주)','연방 야간 할증 없음','연방 공휴일 가산 없음','주/계약별 상이'],
      ja:['×1.5 時間外 (>40h/週)','連邦夜間割増なし','連邦休日割増なし','州・契約により異なる'],
      zh:['×1.5 加班 (>40h/周)','无联邦夜班加给','无联邦假日加给','因州/合同而异'],
      my:['×1.5 ချိန်ကျော် (>40h/wk)','ဖက်ဒရယ် ည မရ','ဖက်ဒရယ် ရုံးပိတ် မရ','ပြည်နယ်/စာချုပ် မူတည်'],
      th:['×1.5 ล่วงเวลา (>40h/สัปดาห์)','ไม่มีค่ากลางคืน','ไม่มีค่าวันหยุดของรัฐบาลกลาง','ขึ้นอยู่กับรัฐ/สัญญา'],
      id:['×1.5 lembur (>40j/minggu)','Tanpa premi malam federal','Tanpa premi libur federal','Tergantung negara bagian'],
      ph:['×1.5 OT (>40h/linggo)','Walang federal night premium','Walang federal holiday rate','Depende sa estado/kontrata'],
      ne:['×1.5 ओभरटाइम (>40h/हप्ता)','संघीय रात भत्ता छैन','संघीय बिदा भत्ता छैन','राज्य/सम्झौतामा निर्भर'],
      hi:['×1.5 ओवरटाइम (>40h/सप्ताह)','कोई संघीय रात भत्ता नहीं','कोई संघीय छुट्टी दर नहीं','राज्य/अनुबंध पर निर्भर'],
    },
  },
  MY:{
    name:{vi:'Myanmar',en:'Myanmar',ko:'미얀마',ja:'ミャンマー',zh:'缅甸',my:'မြန်မာ',th:'เมียนมา',id:'Myanmar',ph:'Myanmar',ne:'म्यानमार',hi:'म्यांमार'}, flag:'🇲🇲', currency:'K', currencyCode:'MMK',
    normalFactor:1.0,
    otFactor:2.0, nightFactor:1.0,
    nightStart:22, nightEnd:6,
    holidayFactor:2.0,
    weeklyHours:44, dailyOtThreshold:8,
    basis:{vi:'Luật Nhà máy 1951 / Luật Cửa hàng 1989',en:'Factories Act 1951 / Shops & Establishments Act 1989',ko:'공장법 1951 / 상점설립법 1989',ja:'工場法 1951 / 商店設立法 1989',zh:'工厂法1951/店铺法1989',my:'စက်ရုံဥပဒေ 1951 / ဆိုင်နှင့်လုပ်ငန်းဥပဒေ 1989',th:'พ.ร.บ.โรงงาน 2494 / พ.ร.บ.สถานประกอบการ 2532',id:'UU Pabrik 1951 / UU Toko 1989',ph:'Factories Act 1951 / Shops Act 1989',ne:'कारखाना ऐन 1951 / पसल ऐन 1989',hi:'कारखाना अधिनियम 1951 / दुकान अधिनियम 1989'},
    tags:{
      vi:['×2.0 tăng ca (OT)','Chuẩn 44h/tuần','×2.0 làm ngày lễ','Ca đêm: theo hợp đồng'],
      en:['×2.0 OT','44h/week standard','×2.0 public holiday','Night: by contract'],
      ko:['×2.0 초과근무','44h/주 기준','×2.0 공휴일','야간: 계약별'],
      ja:['×2.0 残業','44h/週 標準','×2.0 休日出勤','深夜: 契約による'],
      zh:['×2.0 加班','44h/周标准','×2.0 公众假期','夜班: 按合同'],
      my:['×2.0 ကျော်ချိန် (OT)','44h/week ပုံမှန်','×2.0 ရုံးပိတ်ကြားနေ့','ည: စာချုပ်မူတည်'],
      th:['×2.0 ล่วงเวลา (OT)','มาตรฐาน 44h/สัปดาห์','×2.0 วันหยุดนักขัตฤกษ์','กะกลางคืน: ตามสัญญา'],
      id:['×2.0 lembur (OT)','Standar 44j/minggu','×2.0 hari libur nasional','Malam: per kontrak'],
      ph:['×2.0 OT','44h/linggo standard','×2.0 pista opisyal','Gabi: ayon sa kontrata'],
      ne:['×2.0 ओभरटाइम (OT)','मानक 44h/हप्ता','×2.0 सार्वजनिक बिदा','रात: सम्झौता अनुसार'],
      hi:['×2.0 ओवरटाइम (OT)','मानक 44h/सप्ताह','×2.0 सार्वजनिक छुट्टी','रात: अनुबंध के अनुसार'],
    },
  },
  TH:{
    name:{vi:'Thái Lan',en:'Thailand',ko:'태국',ja:'タイ',zh:'泰国',my:'ထိုင်းနိုင်ငံ',th:'ประเทศไทย',id:'Thailand',ph:'Thailand',ne:'थाइल्याण्ड',hi:'थाईलैंड'}, flag:'🇹🇭', currency:'฿', currencyCode:'THB',
    normalFactor:1.0,
    otFactor:1.5, weekendOtFactor:3.0,
    nightFactor:1.0, nightStart:22, nightEnd:6,
    holidayFactor:3.0,
    weeklyHours:48, dailyOtThreshold:8,
    basis:{vi:'Luật bảo hộ lao động B.E.2541, Điều 61–63',en:'Labour Protection Act B.E.2541, Art.61–63',ko:'노동보호법 B.E.2541 제61–63조',ja:'労働保護法 B.E.2541 第61–63条',zh:'劳动保护法 B.E.2541 第61–63条',my:'အလုပ်သမားကာကွယ်ရေးဥပဒေ B.E.2541 Art.61–63',th:'พ.ร.บ.คุ้มครองแรงงาน พ.ศ.2541 มาตรา 61–63',id:'UU Perlindungan Tenaga Kerja B.E.2541 Ps.61–63',ph:'Labour Protection Act B.E.2541, Art.61–63',ne:'श्रम संरक्षण ऐन B.E.2541 धारा 61–63',hi:'श्रम संरक्षण अधिनियम B.E.2541 अनु.61–63'},
    tags:{
      vi:['×1.5 tăng ca (>8h/ngày)','×3.0 làm ngày lễ','×3.0 tăng ca ngày lễ','Ca đêm: theo hợp đồng','Chuẩn 48h/tuần'],
      en:['×1.5 OT (>8h/day)','×3.0 holiday work','×3.0 OT on holiday','Night: by contract','48h/week'],
      ko:['×1.5 초과근무 (>8h/일)','×3.0 공휴일 근무','×3.0 공휴일 초과근무','야간: 계약별','48h/주'],
      ja:['×1.5 時間外 (>8h/日)','×3.0 休日出勤','×3.0 休日残業','深夜: 契約による','48h/週'],
      zh:['×1.5 加班 (>8h/天)','×3.0 假日出勤','×3.0 假日加班','夜班: 按合同','48h/周'],
      my:['×1.5 ချိန်ကျော် (>8h/day)','×3.0 ရုံးပိတ် တက်','×3.0 ရုံးပိတ် ချိန်ကျော်','ည: စာချုပ်','48h/week'],
      th:['×1.5 ล่วงเวลา (>8h/วัน)','×3.0 ทำงานวันหยุด','×3.0 OT วันหยุด','กะกลางคืน: ตามสัญญา','48h/สัปดาห์'],
      id:['×1.5 lembur (>8j/hari)','×3.0 hari libur','×3.0 lembur hari libur','Malam: per kontrak','48j/minggu'],
      ph:['×1.5 OT (>8h/araw)','×3.0 holiday','×3.0 OT sa holiday','Gabi: per kontrata','48h/linggo'],
      ne:['×1.5 ओभरटाइम (>8h/दिन)','×3.0 बिदाको काम','×3.0 बिदा ओभरटाइम','रात: सम्झौता','48h/हप्ता'],
      hi:['×1.5 ओवरटाइम (>8h/दिन)','×3.0 छुट्टी पर काम','×3.0 छुट्टी OT','रात: अनुबंध','48h/सप्ताह'],
    },
  },
  ID:{
    name:{vi:'Indonesia',en:'Indonesia',ko:'인도네시아',ja:'インドネシア',zh:'印度尼西亚',my:'အင်ဒိုနီးရှား',th:'อินโดนีเซีย',id:'Indonesia',ph:'Indonesia',ne:'इन्डोनेसिया',hi:'इंडोनेशिया'}, flag:'🇮🇩', currency:'Rp', currencyCode:'IDR',
    normalFactor:1.0,
    otFactor:1.5, otFactor2:2.0,
    nightFactor:1.0, nightStart:23, nightEnd:6,
    holidayFactor:2.0, holidayOtFactor:3.0,
    weeklyHours:40, dailyOtThreshold:8,
    basis:{vi:'UU 13/2003 & PP 35/2021 (Cipta Kerja)',en:'UU No.13/2003 & PP No.35/2021 (Job Creation)',ko:'법률 제13/2003호 & 시행령 제35/2021호',ja:'法律 No.13/2003 & 政令 No.35/2021',zh:'法律13/2003号和政令35/2021号',my:'ဥပဒေ 13/2003 & PP 35/2021',th:'กฎหมาย 13/2003 & PP 35/2021 (Cipta Kerja)',id:'UU No.13/2003 & PP No.35/2021 (Cipta Kerja)',ph:'UU No.13/2003 & PP No.35/2021',ne:'UU 13/2003 & PP 35/2021',hi:'UU 13/2003 & PP 35/2021'},
    tags:{
      vi:['×1.5 lembur giờ đầu','×2.0 lembur giờ 2+','×2.0 ngày lễ ≤8h','×3.0 ngày lễ >8h','Chuẩn 40h/tuần'],
      en:['×1.5 OT 1st hour','×2.0 OT 2nd hour+','×2.0 holiday ≤8h','×3.0 holiday >8h','40h/week'],
      ko:['×1.5 초과근무 첫 1시간','×2.0 초과근무 2시간+','×2.0 공휴일 ≤8h','×3.0 공휴일 >8h','40h/주'],
      ja:['×1.5 残業 1時間目','×2.0 残業 2時間目以降','×2.0 休日 ≤8h','×3.0 休日 >8h','40h/週'],
      zh:['×1.5 加班第1小时','×2.0 加班第2小时+','×2.0 假日 ≤8h','×3.0 假日 >8h','40h/周'],
      my:['×1.5 ချိန်ကျော် ပထမ 1h','×2.0 ချိန်ကျော် 2h+','×2.0 ရုံးပိတ် ≤8h','×3.0 ရုံးပိတ် >8h','40h/week'],
      th:['×1.5 ล่วงเวลาชั่วโมงแรก','×2.0 ล่วงเวลาชั่วโมงที่ 2+','×2.0 วันหยุด ≤8h','×3.0 วันหยุด >8h','40h/สัปดาห์'],
      id:['×1.5 lembur jam pertama','×2.0 lembur jam ke-2+','×2.0 hari libur ≤8j','×3.0 hari libur >8j','40j/minggu'],
      ph:['×1.5 OT unang oras','×2.0 OT ika-2 oras+','×2.0 holiday ≤8h','×3.0 holiday >8h','40h/linggo'],
      ne:['×1.5 ओभरटाइम पहिलो घण्टा','×2.0 ओभरटाइम 2+ घण्टा','×2.0 बिदा ≤8h','×3.0 बिदा >8h','40h/हप्ता'],
      hi:['×1.5 OT पहला घंटा','×2.0 OT 2+ घंटे','×2.0 छुट्टी ≤8h','×3.0 छुट्टी >8h','40h/सप्ताह'],
    },
  },
  PH:{
    name:{vi:'Philippines',en:'Philippines',ko:'필리핀',ja:'フィリピン',zh:'菲律宾',my:'ဖိလစ်ပိုင်',th:'ฟิลิปปินส์',id:'Filipina',ph:'Pilipinas',ne:'फिलिपिन्स',hi:'फ़िलीपींस'}, flag:'🇵🇭', currency:'₱', currencyCode:'PHP',
    normalFactor:1.0,
    otFactor:1.25,
    nightFactor:1.1, nightIsAdditive:true,
    nightStart:22, nightEnd:6,
    holidayFactor:2.0, holidayOtFactor:2.6,
    weeklyHours:48, dailyOtThreshold:8,
    basis:{vi:'Bộ luật lao động Philippines (PD 442), Điều 86–94',en:'Labor Code of the Philippines (PD 442), Art.86–94',ko:'필리핀 노동법(PD 442) 제86–94조',ja:'フィリピン労働法(PD 442) 第86–94条',zh:'菲律宾劳动法(PD 442)第86–94条',my:'ဖိလစ်ပိုင်အလုပ်သမားဥပဒေ (PD 442) Art.86–94',th:'ประมวลกฎหมายแรงงานฟิลิปปินส์ (PD 442) มาตรา 86–94',id:'Kitab UU Ketenagakerjaan Filipina (PD 442) Ps.86–94',ph:'Labor Code (PD 442), Art.86–94',ne:'फिलिपिन्स श्रम संहिता (PD 442) धारा 86–94',hi:'फ़िलीपींस श्रम संहिता (PD 442) अनु. 86–94'},
    tags:{
      vi:['×1.25 tăng ca (>8h/ngày)','×2.0 ngày lễ thông thường','×2.6 ngày lễ + tăng ca','+10% ca đêm (22h–6h)','Chuẩn 48h/tuần'],
      en:['×1.25 OT (>8h/day)','×2.0 regular holiday','×2.6 holiday + OT','+10% night (10PM–6AM)','48h/week'],
      ko:['×1.25 초과근무 (>8h/일)','×2.0 정규 공휴일','×2.6 공휴일 + 초과근무','+10% 야간 (10PM–6AM)','48h/주'],
      ja:['×1.25 時間外 (>8h/日)','×2.0 法定祝日','×2.6 祝日+残業','+10% 深夜 (22h–6h)','48h/週'],
      zh:['×1.25 加班 (>8h/天)','×2.0 法定假日','×2.6 假日+加班','+10% 夜班 (22h–6h)','48h/周'],
      my:['×1.25 ချိန်ကျော် (>8h/day)','×2.0 ရုံးပိတ်ရက်','×2.6 ရုံးပိတ် + ချိန်ကျော်','+10% ည (10PM–6AM)','48h/week'],
      th:['×1.25 ล่วงเวลา (>8h/วัน)','×2.0 วันหยุดนักขัตฤกษ์','×2.6 วันหยุด + OT','+10% กะกลางคืน (10PM–6AM)','48h/สัปดาห์'],
      id:['×1.25 lembur (>8j/hari)','×2.0 hari libur nasional','×2.6 libur + lembur','+10% malam (22j–6j)','48j/minggu'],
      ph:['×1.25 OT (>8h/araw)','×2.0 regular holiday','×2.6 holiday + OT','+10% gabi (10PM–6AM)','48h/linggo'],
      ne:['×1.25 ओभरटाइम (>8h/दिन)','×2.0 सार्वजनिक बिदा','×2.6 बिदा + ओभरटाइम','+10% रात (10PM–6AM)','48h/हप्ता'],
      hi:['×1.25 ओवरटाइम (>8h/दिन)','×2.0 सार्वजनिक छुट्टी','×2.6 छुट्टी + OT','+10% रात (10PM–6AM)','48h/सप्ताह'],
    },
  },
  NP:{
    name:{vi:'Nepal',en:'Nepal',ko:'네팔',ja:'ネパール',zh:'尼泊尔',my:'နီပေါ',th:'เนปาล',id:'Nepal',ph:'Nepal',ne:'नेपाल',hi:'नेपाल'}, flag:'🇳🇵', currency:'रु', currencyCode:'NPR',
    normalFactor:1.0,
    otFactor:1.5,
    nightFactor:1.5, nightIsAdditive:true,
    nightStart:22, nightEnd:6,
    holidayFactor:2.0,
    weeklyHours:48, dailyOtThreshold:8,
    basis:{vi:'Luật lao động Nepal 2017, Điều 30 & 34',en:'Labour Act 2017 (Nepal), Sec.30 & 34',ko:'네팔 노동법 2017, 제30·34조',ja:'ネパール労働法 2017, 第30·34条',zh:'尼泊尔劳动法2017, 第30·34条',my:'နီပေါအလုပ်သမားဥပဒေ 2017, Sec.30&34',th:'พ.ร.บ.แรงงานเนปาล 2560 มาตรา 30 & 34',id:'UU Ketenagakerjaan Nepal 2017, Ps.30 & 34',ph:'Labour Act 2017 (Nepal), Sec.30 & 34',ne:'श्रम ऐन 2074 (नेपाल), दफा 30 र 34',hi:'नेपाल श्रम अधिनियम 2017, धारा 30 & 34'},
    tags:{
      vi:['×1.5 tăng ca (>8h/ngày)','×2.0 ngày lễ công cộng','+50% ca đêm (22h–6h)','Chuẩn 48h/tuần'],
      en:['×1.5 OT (>8h/day)','×2.0 public holiday','+50% night premium (10PM–6AM)','48h/week'],
      ko:['×1.5 초과근무 (>8h/일)','×2.0 공휴일','+50% 야간 (10PM–6AM)','48h/주'],
      ja:['×1.5 時間外 (>8h/日)','×2.0 祝日','+50% 深夜 (22h–6h)','48h/週'],
      zh:['×1.5 加班 (>8h/天)','×2.0 公共假日','+50% 夜班 (22h–6h)','48h/周'],
      my:['×1.5 ချိန်ကျော် (>8h/day)','×2.0 ရုံးပိတ်ရက်','+50% ည (10PM–6AM)','48h/week'],
      th:['×1.5 ล่วงเวลา (>8h/วัน)','×2.0 วันหยุดนักขัตฤกษ์','+50% กะกลางคืน (22h–6h)','48h/สัปดาห์'],
      id:['×1.5 lembur (>8j/hari)','×2.0 hari libur nasional','+50% malam (22h–6h)','48j/minggu'],
      ph:['×1.5 OT (>8h/araw)','×2.0 pista opisyal','+50% gabi (22h–6h)','48h/linggo'],
      ne:['×1.5 ओभरटाइम (>8h/दिन)','×2.0 सार्वजनिक बिदा','+50% रात (22h–6h)','48h/हप्ता'],
      hi:['×1.5 ओवरटाइम (>8h/दिन)','×2.0 सार्वजनिक छुट्टी','+50% रात (22h–6h)','48h/सप्ताह'],
    },
  },
  IN:{
    name:{vi:'Ấn Độ',en:'India',ko:'인도',ja:'インド',zh:'印度',my:'အိန္ဒိယ',th:'อินเดีย',id:'India',ph:'India',ne:'भारत',hi:'भारत'}, flag:'🇮🇳', currency:'₹', currencyCode:'INR',
    normalFactor:1.0,
    otFactor:2.0,
    nightFactor:1.0, nightStart:22, nightEnd:6,
    holidayFactor:2.0,
    weeklyHours:48, dailyOtThreshold:8,
    basis:{vi:'Luật Nhà máy 1948, Điều 59 / Bộ luật tiền lương 2019',en:'Factories Act 1948, Sec.59 / Code on Wages 2019',ko:'공장법 1948 제59조 / 임금법 2019',ja:'工場法 1948 第59条 / 賃金法 2019',zh:'工厂法1948第59条/工资法2019',my:'ကုမ္ပဏီဥပဒေ 1948 Sec.59 / လုပ်ခဥပဒေ 2019',th:'พ.ร.บ.โรงงาน 2491 มาตรา 59 / กฎหมายค่าจ้าง 2562',id:'UU Pabrik 1948 Ps.59 / UU Upah 2019',ph:'Factories Act 1948, Sec.59 / Code on Wages 2019',ne:'कारखाना ऐन 1948 दफा 59 / ज्याला संहिता 2019',hi:'कारखाना अधिनियम 1948 धारा 59 / मजदूरी संहिता 2019'},
    tags:{
      vi:['×2.0 tăng ca (>9h/ngày or >48h/tuần)','×2.0 ngày lễ công cộng','Ca đêm: theo tiểu bang/HĐ','Chuẩn 48h/tuần'],
      en:['×2.0 OT (>9h/day or >48h/week)','×2.0 public holiday','Night: by state/contract','48h/week'],
      ko:['×2.0 초과근무 (>9h/일 or >48h/주)','×2.0 공휴일','야간: 주/계약별','48h/주'],
      ja:['×2.0 時間外 (>9h/日 or >48h/週)','×2.0 法定祝日','深夜: 州・契約による','48h/週'],
      zh:['×2.0 加班 (>9h/天 or >48h/周)','×2.0 法定假日','夜班: 因州/合同而异','48h/周'],
      my:['×2.0 ချိန်ကျော် (>9h/day or >48h/wk)','×2.0 ရုံးပိတ်ရက်','ည: ပြည်နယ်/စာချုပ်','48h/week'],
      th:['×2.0 ล่วงเวลา (>9h/วัน or >48h/wk)','×2.0 วันหยุดนักขัตฤกษ์','กะกลางคืน: ตามรัฐ/สัญญา','48h/สัปดาห์'],
      id:['×2.0 lembur (>9j/hari or >48j/minggu)','×2.0 hari libur nasional','Malam: per negara bagian/kontrak','48j/minggu'],
      ph:['×2.0 OT (>9h/araw or >48h/linggo)','×2.0 pista opisyal','Gabi: ayon sa estado/kontrata','48h/linggo'],
      ne:['×2.0 ओभरटाइम (>9h/दिन or >48h/हप्ता)','×2.0 सार्वजनिक बिदा','रात: राज्य/सम्झौता','48h/हप्ता'],
      hi:['×2.0 ओवरटाइम (>9h/दिन or >48h/सप्ताह)','×2.0 सार्वजनिक छुट्टी','रात: राज्य/अनुबंध','48h/सप्ताह'],
    },
  },
  CUSTOM:{
    name:{vi:'Tùy chỉnh',en:'Custom',ko:'사용자 정의',ja:'カスタム',zh:'自定义',my:'စိတ်ကြိုက်',th:'กำหนดเอง',id:'Kustom',ph:'Custom',ne:'अनुकूलन',hi:'कस्टम'}, flag:'⚙️', currency:'', currencyCode:'',
    normalFactor:1.0, otFactor:1.5,
    nightFactor:1.3, nightStart:22, nightEnd:6,
    holidayFactor:2.0, weeklyHours:40, dailyOtThreshold:8,
    basis:{vi:'Tùy chỉnh theo hợp đồng',en:'Custom per contract',ko:'계약별 사용자 정의',ja:'契約に応じてカスタマイズ',zh:'按合同自定义',my:'စာချုပ်အတိုင်း',th:'กำหนดเองตามสัญญา',id:'Kustom sesuai kontrak',ph:'Custom ayon sa kontrata',ne:'सम्झौता अनुसार',hi:'अनुबंध के अनुसार'},
    tags:{
      vi:['Tùy chỉnh tất cả hệ số','Nhập theo thực tế công ty'],
      en:['Customize all factors','Set per your company contract'],
      ko:['모든 계수 사용자 정의','실제 계약 기준으로 입력'],
      ja:['すべての係数をカスタマイズ','実際の契約に基づいて入力'],
      zh:['自定义所有系数','按实际公司合同填写'],
      my:['အားလုံး စိတ်ကြိုက်ပြင်','ကုမ္ပဏီ စာချုပ်အတိုင်း'],
      th:['ปรับแต่งค่าตอบแทนทั้งหมด','ตั้งตามสัญญาบริษัท'],
      id:['Sesuaikan semua koefisien','Sesuai kontrak perusahaan'],
      ph:['I-customize ang lahat','Ayon sa kontrata ng kumpanya'],
      ne:['सबै गुणांक अनुकूलन गर्नुस्','कम्पनी सम्झौता अनुसार'],
      hi:['सभी कोएफिशिएंट अनुकूलित करें','कंपनी अनुबंध के अनुसार'],
    },
  }
};

/* ===== CẤU HÌNH NGÔN NGỮ & QUỐC GIA (langCfg) ===== */
var langCfg={lang:"vi",payrollCountry:"VN",overrides:{}};
try{const _lc=JSON.parse(localStorage.getItem("cp22_lang")||"null");if(_lc)langCfg=Object.assign(langCfg,_lc);}catch(e){}

// === pGio ===
function pGio(s){if(!s)return 0;const[h,m]=s.split(':').map(Number);return h*60+m;}

// === soGio ===
function _attValidTs(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:0;}
function _attDateFromKey(k){
  const nk=typeof normalizeDateKey==='function'?normalizeDateKey(k):String(k||'');
  const p=String(nk||'').split('-').map(Number);
  if(p.length!==3||p.some(n=>!Number.isFinite(n)))return null;
  return new Date(p[0],p[1]-1,p[2],0,0,0,0);
}
function _attTsFromTime(dateKey,timeStr,afterTs){
  if(!timeStr)return 0;
  const base=_attDateFromKey(dateKey);
  if(!base)return 0;
  const m=String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/);
  if(!m)return 0;
  const h=Number(m[1]),mi=Number(m[2]);
  if(!Number.isFinite(h)||!Number.isFinite(mi)||h<0||h>47||mi<0||mi>59)return 0;
  base.setHours(h%24,mi,0,0);
  let ts=base.getTime()+(h>=24?86400000:0);
  const minAfter=_attValidTs(afterTs);
  while(minAfter&&ts<minAfter)ts+=86400000;
  return ts;
}
function attendanceCheckInAt(rec,dateKey){
  if(!rec||!rec.in)return 0;
  return _attValidTs(rec.checkInAt)||_attValidTs(rec.gpsInTs)||_attTsFromTime(dateKey,rec.in,0);
}
function attendanceCheckOutAt(rec,dateKey){
  if(!rec||!rec.out)return 0;
  const inTs=attendanceCheckInAt(rec,dateKey);
  return _attValidTs(rec.checkOutAt)||_attValidTs(rec.gpsOutTs)||_attTsFromTime(dateKey,rec.out,inTs);
}
function attendanceSetIn(rec,dateKey,timeStr,ts){
  if(!rec)return;
  rec.in=timeStr;
  const n=_attValidTs(ts)||_attTsFromTime(dateKey,timeStr,0);
  if(n)rec.checkInAt=n;
  try{
    if(typeof window!=='undefined' && typeof window.gpsOnCheckinSaved==='function'){
      const day=attData&&attData[dateKey];
      const isSub=!!(day&&day.sub&&day.sub===rec);
      const isMain=!!(day&&day===rec);
      if(isMain||isSub){
        window.gpsOnCheckinSaved({
          dateKey:String(dateKey||''),
          mainIn:isMain,
          subIn:isSub
        });
      }
    }
  }catch(e){}
}
function attendanceSetOut(rec,dateKey,timeStr,ts){
  if(!rec)return;
  rec.out=timeStr;
  const inTs=attendanceCheckInAt(rec,dateKey);
  const n=_attValidTs(ts)||_attTsFromTime(dateKey,timeStr,inTs);
  if(n)rec.checkOutAt=n;
  try{
    if(typeof window!=='undefined' && typeof window.gpsOnManualCheckoutSaved==='function'){
      const day=attData&&attData[dateKey];
      const isSub=!!(day&&day.sub&&day.sub===rec);
      const isMain=!!(day&&day===rec);
      if(isMain||isSub){
        window.gpsOnManualCheckoutSaved({
          dateKey:String(dateKey||''),
          mainOut:isMain,
          subOut:isSub
        });
      }
    }
  }catch(e){}
}
function attendanceWorkedHours(rec,dateKey){
  if(!rec||!rec.in||!rec.out)return null;
  const a=attendanceCheckInAt(rec,dateKey),b=attendanceCheckOutAt(rec,dateKey);
  if(a&&b&&b>=a){
    const h=(b-a)/3600000;
    if(Number.isFinite(h)&&h>=0&&h<=48)return h;
  }
  const d=(pGio(rec.out)-pGio(rec.in)+1440)%1440;
  return d/60;
}
function attendanceNightHours(rec,dateKey,nightStart,nightEnd){
  if(!rec||!rec.in||!rec.out)return 0;
  const a=attendanceCheckInAt(rec,dateKey),b=attendanceCheckOutAt(rec,dateKey);
  if(!a||!b||b<a||b-a>48*3600000)return calcNightHours(rec.in,rec.out,nightStart,nightEnd);
  const ns=(Number(nightStart)||22)*60;
  const ne=(Number(nightEnd)||6)*60;
  const dur=((ne-ns+1440)%1440)||1440;
  let cur=new Date(a);cur.setHours(0,0,0,0);cur.setDate(cur.getDate()-1);
  const endDay=new Date(b);endDay.setHours(0,0,0,0);endDay.setDate(endDay.getDate()+1);
  let total=0;
  for(;cur<=endDay;cur.setDate(cur.getDate()+1)){
    const s=cur.getTime()+ns*60000;
    const e=s+dur*60000;
    const overlap=Math.max(0,Math.min(b,e)-Math.max(a,s));
    total+=overlap;
  }
  return total/3600000;
}
function soGio(v,r,rec,dateKey){
  if(rec&&dateKey){
    const h=attendanceWorkedHours(rec,dateKey);
    if(h!=null)return h;
  }
  if(!v||!r)return null;const d=(pGio(r)-pGio(v)+1440)%1440;return d/60;
}

// === calcNightHours ===
function calcNightHours(vao, ra, nightStart, nightEnd){
  const v = pGio(vao), r = pGio(ra);
  const dur = ((r - v + 1440) % 1440);
  const ns = nightStart * 60, ne = (nightEnd + 24) * 60; // normalize
  // Simple approximation: count overlap with night window
  let nightMin = 0;
  for(let m = 0; m < dur; m++){
    const cur = (v + m) % 1440;
    const inNight = (cur >= ns) || (cur < nightEnd*60);
    if(inNight) nightMin++;
  }
  return Math.min(nightMin / 60, dur / 60);
}

// === getPayrollRule ===
function getPayrollRule(){
  const base = PAYROLL_RULES[langCfg.payrollCountry] || PAYROLL_RULES.VN;
  const ov = langCfg.overrides || {};
  return {
    ...base,
    normalFactor: parseFloat(ov.normal)||base.normalFactor,
    otFactor: parseFloat(ov.ot)||base.otFactor,
    nightFactor: parseFloat(ov.night)||base.nightFactor,
    nightStart: parseInt(ov.nightStart)||base.nightStart,
  };
}

// === calcDaySalaryFull ===
function calcDaySalaryFull(tt,ca,gd,rule,otGio,nightGio){
const isDem=ca&&ca.laDem;
const lN=ldN(),lG=lgN(),gioCA=(_cfg_shim&&_cfg_shim.gioNgay)||8;
const nightPct=(rule.nightFactor||1.3)-1.0;
let nightTien=0;
if(rule.nightIsAdditive){nightTien=nightGio*lG*rule.nightFactor;}
else{nightTien=nightGio*lG*nightPct;}
let otTien=0;
if(langCfg.payrollCountry==='TW'){
  const ot1=Math.min(otGio,rule.ot1Hours||2);
  const ot2=Math.min(Math.max(0,otGio-(rule.ot1Hours||2)),rule.ot2Hours||2);
  otTien=(ot1*lG*(rule.ot1Factor||1.33))+(ot2*lG*(rule.ot2Factor||1.67));
}else{
  otTien=otGio*lG*(rule.otFactor||1.5);
}
if(tt==='ll') return lN*(rule.holidayFactor||4.0)+nightTien+otTien;
if(tt==='vang') return -lN;
return lN+nightTien+otTien;
}

// === tinhBH ===
// → const TRAN_BH = 46800000; (moved to utils.js)

/* ===== TAX ENGINE — 11 quốc gia (gần thực tế 2025) ===== */
const TAX_RULES = {
  VN: {
    period:'monthly', insuranceDeductible:true,
    insurance: { rate: 0.105, cap: 36000000 }, // NLĐ đóng 10.5%, trần 36M/tháng
    deduction: { personal: 11000000, dependent: 4400000 },
    brackets: [[5000000,0.05],[5000000,0.10],[8000000,0.15],[14000000,0.20],[20000000,0.25],[28000000,0.30],[Infinity,0.35]],
    rounding: 'floor', currency: '₫', flag: '🇻🇳', name: {vi:'Việt Nam',en:'Vietnam',ko:'베트남',ja:'ベトナム',zh:'越南',my:'ဗီယက်နမ်',th:'เวียดนาม',id:'Vietnam',ph:'Vietnam',ne:'भियतनाम',hi:'वियतनाम'},
    insNote: {
      vi:'BHXH 8% + BHYT 1.5% + BHTN 1% = 10.5% (trần 36 triệu/tháng)',
      en:'Social Insurance 8% + Health 1.5% + Unemployment 1% = 10.5% (cap 36M VND/month)',
      ko:'사회보험 8% + 건강보험 1.5% + 고용보험 1% = 10.5% (한도 3,600만₫/월)',
      ja:'社会保険 8% + 健康保険 1.5% + 雇用保険 1% = 10.5% (上限 3,600万₫/月)',
      zh:'社会保险 8% + 健康险 1.5% + 失业险 1% = 10.5% (上限3600万₫/月)',
      my:'လူမှုBH 8% + ကျန်းမာBH 1.5% + အလုပ်လက်မဲ့BH 1% = 10.5% (ကန့်သတ် 36M ₫/လ)',
      th:'ประกันสังคม 8% + ประกันสุขภาพ 1.5% + ประกันการว่างงาน 1% = 10.5% (เพดาน 36M ₫/เดือน)',
      id:'Jamsostek 8% + JKK 1.5% + JKm 1% = 10.5% (batas 36 juta ₫/bulan)',
      ph:'Social Insurance 8% + Health 1.5% + Unemployment 1% = 10.5% (cap 36M ₫/buwan)',
      ne:'सामाजिक बीमा 8% + स्वास्थ्य 1.5% + बेरोजगारी 1% = 10.5% (सीमा 36M ₫/महिना)',
      hi:'सामाजिक बीमा 8% + स्वास्थ्य 1.5% + बेरोजगारी 1% = 10.5% (सीमा 36M ₫/माह)'
    }
  },
  KR: {
    period:'annual', insuranceDeductible:true,
    insurance: { rate: 0.094, cap: 6170000 }, // NP 4.5% + BHYT 3.545% + LTC 0.491% + BHTN 0.9% ≈ 9.4%, trần 6.17M ₩/tháng (2025)
    localTax: 0.10, // 지방세 = 10% của thuế TNCN
    brackets: [[14000000,0.06],[36000000,0.15],[38000000,0.24],[62000000,0.35],[150000000,0.38],[200000000,0.40],[500000000,0.42],[Infinity,0.45]],
    rounding: 'floor', currency: '₩', flag: '🇰🇷', name: {vi:'Hàn Quốc',en:'Korea',ko:'한국',ja:'韓国',zh:'韩국',my:'တောင်ကိုရီးယား',th:'เกาหลีใต้',id:'Korea Selatan',ph:'South Korea',ne:'दक्षिण कोरिया',hi:'दक्षिण कोरिया'},
    insNote: {
      vi:'Lương hưu 4.5% + BHYT 3.545% + Điều dưỡng 0.491% + BHTN 0.9% ≈ 9.4% (trần 6,170,000 ₩/tháng)',
      en:'National Pension 4.5% + Health 3.545% + LTC 0.491% + Employment 0.9% ≈ 9.4% (cap 6,170,000 ₩/mo)',
      ko:'국민연금 4.5% + 건강보험 3.545% + 장기요양 0.491% + 고용보험 0.9% ≈ 9.4% (상한 6,170,000 ₩/월)',
      ja:'国民年金 4.5% + 健康保険 3.545% + 介護 0.491% + 雇用保険 0.9% ≈ 9.4% (上限 617万 ₩/月)',
      zh:'国民年金 4.5% + 健保 3.545% + 长期护理 0.491% + 就业保险 0.9% ≈ 9.4% (上限 617万 ₩/月)',
      my:'အမျိုးသားပင်စီမံချက် 4.5% + ကျန်းမာBH 3.545% + ရေရှည်ပြုစုမှု 0.491% + အလုပ် 0.9% ≈ 9.4%',
      th:'บำนาญแห่งชาติ 4.5% + ประกันสุขภาพ 3.545% + ดูแลระยะยาว 0.491% + ว่างงาน 0.9% ≈ 9.4% (เพดาน 6.17M ₩/เดือน)',
      id:'Pensiun Nasional 4.5% + Kesehatan 3.545% + Perawatan 0.491% + Ketenagakerjaan 0.9% ≈ 9.4% (batas 6,170,000 ₩/bln)',
      ph:'National Pension 4.5% + Health 3.545% + LTC 0.491% + Employment 0.9% ≈ 9.4% (cap 6,170,000 ₩/mo)',
      ne:'राष्ट्रिय पेन्सन 4.5% + स्वास्थ्य 3.545% + दीर्घकालीन हेरचाह 0.491% + रोजगार 0.9% ≈ 9.4% (सीमा 6.17M ₩/महिना)',
      hi:'राष्ट्रीय पेंशन 4.5% + स्वास्थ्य 3.545% + दीर्घकालीन देखभाल 0.491% + रोजगार 0.9% ≈ 9.4% (सीमा 6.17M ₩/माह)'
    }
  },
  JP: {
    period:'annual', insuranceDeductible:true, // JP: bảo hiểm CÓ trừ khỏi thu nhập chịu thuế (社会保険料控除)
    insurance: { rate: 0.155 }, // 厚生年金 9.15% + 健康保険 5.2% + 雇用保険 0.6% + 介護 0.55% ≈ 15.5%
    residentTax: 0.10, // 住民税 10% cộng thêm
    brackets: [[1950000,0.05],[1350000,0.10],[3650000,0.20],[2050000,0.23],[9000000,0.33],[22000000,0.40],[Infinity,0.45]],
    rounding: 'floor', currency: '¥', flag: '🇯🇵', name: {vi:'Nhật Bản',en:'Japan',ko:'일본',ja:'日本',zh:'日本',my:'ဂျပန်',th:'ญี่ปุ่น',id:'Jepang',ph:'Hapon',ne:'जापान',hi:'जापान'},
    insNote: {
      vi:'Hưu trí 9.15% + BHYT ~5.2% + Thất nghiệp 0.6% + Điều dưỡng 0.55% ≈ 15.5% (BH ĐƯỢC trừ khỏi thu nhập chịu thuế)',
      en:'Pension 9.15% + Health ~5.2% + Employment 0.6% + LTC 0.55% ≈ 15.5% (insurance IS deductible from taxable income)',
      ko:'후생연금 9.15% + 건강보험 ~5.2% + 고용보험 0.6% + 개호 0.55% ≈ 15.5% (보험료 세금공제 가능)',
      ja:'厚生年金 9.15% + 健康保険 ~5.2% + 雇用保険 0.6% + 介護 0.55% ≈ 15.5%（社会保険料控除あり）',
      zh:'厚生年金 9.15% + 健康保险 ~5.2% + 雇用保险 0.6% + 介护 0.55% ≈ 15.5%（社会保险费可从应税收入扣除）',
      my:'ပင်စီမံချက် 9.15% + ကျန်းမာ ~5.2% + အလုပ် 0.6% + ပြုစုမှု 0.55% ≈ 15.5% (BH ကို အခွန်ဝင်ငွေမှ နုတ်ရ)',
      th:'เงินบำนาญ 9.15% + ประกันสุขภาพ ~5.2% + ว่างงาน 0.6% + ดูแลระยะยาว 0.55% ≈ 15.5% (ประกันสังคมหักภาษีได้)',
      id:'Pensiun 9.15% + Kesehatan ~5.2% + Ketenagakerjaan 0.6% + Perawatan 0.55% ≈ 15.5% (asuransi dapat dikurangkan dari pajak)',
      ph:'Pension 9.15% + Health ~5.2% + Employment 0.6% + LTC 0.55% ≈ 15.5% (insurance IS deductible from taxable income)',
      ne:'पेन्सन 9.15% + स्वास्थ्य ~5.2% + रोजगार 0.6% + दीर्घकालीन हेरचाह 0.55% ≈ 15.5% (बीमा कर आयबाट काट्न मिल्छ)',
      hi:'पेंशन 9.15% + स्वास्थ्य ~5.2% + रोजगार 0.6% + दीर्घकालीन देखभाल 0.55% ≈ 15.5% (बीमा कर योग्य आय से काटा जाता है)'
    }
  },
  TW: {
    period:'annual', insuranceDeductible:true,
    insurance: { rate: 0.0481 }, // 勞工保險 2.35% + 健保 1.69% + 就業保險 0.42% ≈ 4.81% (2025)
    deduction: { personal: 97000, standard: 131000 }, // 免稅額 NT$97K + 標準扣除額 NT$131K/năm (2025)
    brackets: [[590000,0.05],[740000,0.12],[1330000,0.20],[2320000,0.30],[Infinity,0.40]],
    rounding: 'round', currency: 'NT$', flag: '🇹🇼', name: {vi:'Đài Loan',en:'Taiwan',ko:'대만',ja:'台湾',zh:'台湾',my:'တိုင်ဝမ်',th:'ไต้หวัน',id:'Taiwan',ph:'Taiwan',ne:'ताइवान',hi:'ताइवान'},
    insNote: {
      vi:'Lao bảo 2.35% + Kiện bảo 1.69% + Tựu bảo 0.42% ≈ 4.81% | Miễn thuế NT$97,000 + Khấu trừ NT$131,000/năm (2025)',
      en:'Labor Insurance 2.35% + NHI 1.69% + Employment 0.42% ≈ 4.81% | Exemption NT$97K + Standard NT$131K/yr (2025)',
      ko:'노동보험 2.35% + 건강보험 1.69% + 취업보험 0.42% ≈ 4.81% | 면세 NT$97K + 기본공제 NT$131K/년 (2025)',
      ja:'労働保険 2.35% + 健民保険 1.69% + 就業保険 0.42% ≈ 4.81% | 免税額 NT$97K + 標準控除 NT$131K/年（2025）',
      zh:'勞保 2.35% + 健保 1.69% + 就保 0.42% ≈ 4.81% | 免稅額 NT$97,000 + 標準扣除額 NT$131,000/年（2025）',
      my:'ပင်ဆောင်BH 2.35% + ကျန်းမာBH 1.69% + အလုပ်BH 0.42% ≈ 4.81% | ကင်းလွတ် NT$97K + ကိုယ်ထည့် NT$131K/နှစ်',
      th:'ประกันแรงงาน 2.35% + ประกันสุขภาพ 1.69% + ประกันว่างงาน 0.42% ≈ 4.81% | ยกเว้น NT$97K + หักมาตรฐาน NT$131K/ปี (2025)',
      id:'Asuransi Tenaga Kerja 2.35% + NHI 1.69% + Ketenagakerjaan 0.42% ≈ 4.81% | Bebas NT$97K + Standar NT$131K/thn (2025)',
      ph:'Labor Insurance 2.35% + NHI 1.69% + Employment 0.42% ≈ 4.81% | Exemption NT$97K + Standard NT$131K/yr (2025)',
      ne:'श्रम बीमा 2.35% + स्वास्थ्य 1.69% + रोजगार 0.42% ≈ 4.81% | कर छुट NT$97K + मानक NT$131K/वर्ष (2025)',
      hi:'श्रम बीमा 2.35% + स्वास्थ्य 1.69% + रोजगार 0.42% ≈ 4.81% | छूट NT$97K + मानक NT$131K/वर्ष (2025)'
    }
  },
  US: {
    period:'annual', insuranceDeductible:false, // SS/Medicare không trừ khỏi thuế liên bang
    insurance: { ssRate: 0.062, ssCap: 176100, medicareRate: 0.0145 }, // SS 6.2% (cap $176,100/năm, 2025) + Medicare 1.45%
    deduction: { standard: 15000 }, // Standard deduction 2025 (single): $15,000/năm
    brackets: [[11925,0.10],[36550,0.12],[54875,0.22],[93950,0.24],[53225,0.32],[375825,0.35],[Infinity,0.37]],
    rounding: 'round', currency: '$', flag: '🇺🇸', name: {vi:'Hoa Kỳ',en:'United States',ko:'미국',ja:'アメリカ',zh:'美国',my:'အမေရိကန်',th:'สหรัฐอเมริกา',id:'Amerika Serikat',ph:'Estados Unidos',ne:'संयुक्त राज्य',hi:'संयुक्त राज्य'},
    insNote: {
      vi:'Social Security 6.2% (giới hạn $176,100/năm, 2025) + Medicare 1.45% | Khấu trừ cơ bản $15,000/năm (độc thân)',
      en:'Social Security 6.2% (cap $176,100/yr, 2025) + Medicare 1.45% | Standard deduction $15,000/yr (single)',
      ko:'사회보장 6.2% (한도 $176,100/년, 2025) + 메디케어 1.45% | 표준공제 $15,000/년 (독신)',
      ja:'社会保障 6.2% (上限$176,100/年、2025) + メディケア 1.45% | 標準控除 $15,000/年（独身）',
      zh:'社会保障 6.2% (上限$176,100/年，2025) + 医疗保险 1.45% | 标准扣除额 $15,000/年（单身）',
      my:'Social Security 6.2% (ကန့်သတ် $176,100/နှစ်, 2025) + Medicare 1.45% | မြေပြင်နုတ် $15,000/နှစ် (တစ်ယောက်တည်း)',
      th:'Social Security 6.2% (เพดาน $176,100/ปี, 2025) + Medicare 1.45% | หักมาตรฐาน $15,000/ปี (โสด)',
      id:'Social Security 6.2% (batas $176,100/thn, 2025) + Medicare 1.45% | Potongan standar $15,000/thn (lajang)',
      ph:'Social Security 6.2% (cap $176,100/yr, 2025) + Medicare 1.45% | Standard deduction $15,000/yr (single)',
      ne:'Social Security 6.2% (सीमा $176,100/वर्ष, 2025) + Medicare 1.45% | मानक कटौती $15,000/वर्ष (एकल)',
      hi:'Social Security 6.2% (सीमा $176,100/वर्ष, 2025) + Medicare 1.45% | मानक कटौती $15,000/वर्ष (अकेला)'
    }
  },
  MY: {
    period:'annual', insuranceDeductible:true,
    insurance: { rate: 0.02 }, // SSB 2% (tỉ lệ nhân viên, chủ doanh nghiệp đóng thêm 3%)
    deduction: { personal: 4800000 }, // Personal relief MMK 4.8M/năm
    brackets: [[2000000,0],[8000000,0.05],[20000000,0.10],[20000000,0.15],[Infinity,0.25]],
    rounding: 'round', currency: 'K', flag: '🇲🇲', name: {vi:'Myanmar',en:'Myanmar',ko:'미얀마',ja:'ミャンマー',zh:'缅甸',my:'မြန်မာ',th:'เมียนมา',id:'Myanmar',ph:'Myanmar',ne:'म्यानमार',hi:'म्यांमार'},
    insNote: {
      vi:'Social Security Board (SSB): người lao động đóng 2% (chủ sử dụng 3%) | Giảm trừ bản thân: 4,800,000 MMK/năm',
      en:'Social Security Board (SSB): employee 2% (employer 3%) | Personal relief: 4,800,000 MMK/yr',
      ko:'사회보장위원회(SSB): 근로자 2% (고용주 3%) | 개인 공제: 480만 MMK/년',
      ja:'社会保障委員会(SSB): 従業員 2%（雇用主 3%）| 個人控除: 480万 MMK/年',
      zh:'社会保障委员会(SSB): 员工 2%（雇主 3%）| 个人减免: 480万 MMK/年',
      my:'Social Security Board (SSB): ဝန်ထမ်း 2% (အလုပ်ရှင် 3%) | ကိုယ်ရေးကင်းလွတ်: 4,800,000 MMK/နှစ်',
      th:'Social Security Board (SSB): ลูกจ้าง 2% (นายจ้าง 3%) | ลดหย่อนส่วนตัว: 4,800,000 MMK/ปี',
      id:'Social Security Board (SSB): karyawan 2% (pemberi kerja 3%) | Pengurangan pribadi: 4.800.000 MMK/thn',
      ph:'Social Security Board (SSB): empleyado 2% (employer 3%) | Personal relief: 4,800,000 MMK/yr',
      ne:'Social Security Board (SSB): कर्मचारी 2% (नियोक्ता 3%) | व्यक्तिगत छुट: 4,800,000 MMK/वर्ष',
      hi:'Social Security Board (SSB): कर्मचारी 2% (नियोक्ता 3%) | व्यक्तिगत छूट: 4,800,000 MMK/वर्ष'
    }
  },
  TH: {
    period:'annual', insuranceDeductible:true,
    insurance: { rate: 0.05, cap: 15000 }, // ประกันสังคม 5%, trần lương 15,000 ฿/tháng → đóng tối đa 750 ฿/tháng
    deduction: { personal: 60000 }, // ค่าลดหย่อนส่วนตัว 60,000 ฿/ปี
    brackets: [[150000,0],[150000,0.05],[200000,0.10],[250000,0.15],[250000,0.20],[3000000,0.25],[1000000,0.30],[Infinity,0.35]],
    rounding: 'round', currency: '฿', flag: '🇹🇭', name: {vi:'Thái Lan',en:'Thailand',ko:'태국',ja:'タイ',zh:'泰国',my:'ထိုင်းနိုင်ငံ',th:'ประเทศไทย',id:'Thailand',ph:'Thailand',ne:'थाइल्याण्ड',hi:'थाईลैंड'},
    insNote: {
      vi:'BHXH 5% (lương tối đa 15,000 ฿/tháng → đóng tối đa 750 ฿/tháng) | Giảm trừ 60,000 ฿/năm',
      en:'Social Security 5% (salary cap 15,000 ฿/mo → max 750 ฿/mo) | Personal deduction 60,000 ฿/yr',
      ko:'사회보험 5% (월 상한 15,000 ฿ → 최대 750 ฿/월) | 개인 공제 60,000 ฿/년',
      ja:'社会保険 5% (月上限 15,000 ฿ → 最大 750 ฿/月) | 個人控除 60,000 ฿/年',
      zh:'社会保险 5% (月工资上限 15,000 ฿ → 最多 750 ฿/月) | 个人减免 60,000 ฿/年',
      my:'လူမှုBH 5% (လစာ အများဆုံး 15,000 ฿/လ → အများဆုံး 750 ฿/လ) | ကိုယ်ရေးနုတ် 60,000 ฿/နှစ်',
      th:'ประกันสังคม 5% (เงินเดือนสูงสุด 15,000 ฿/เดือน → สูงสุด 750 ฿/เดือน) | ลดหย่อน 60,000 ฿/ปี',
      id:'Jaminan Sosial 5% (gaji maks 15,000 ฿/bln → maks 750 ฿/bln) | Pengurangan pribadi 60,000 ฿/thn',
      ph:'Social Security 5% (salary cap 15,000 ฿/mo → max 750 ฿/mo) | Personal deduction 60,000 ฿/yr',
      ne:'सामाजिक बीमा 5% (तलब सीमा 15,000 ฿/महिना → अधिकतम 750 ฿/महिना) | व्यक्तिगत छुट 60,000 ฿/वर्ष',
      hi:'सामाजिक बीमा 5% (वेतन सीमा 15,000 ฿/माह → अधिकतम 750 ฿/माह) | व्यक्तिगत कटौती 60,000 ฿/वर्ष'
    }
  },
  ID: {
    period:'annual', insuranceDeductible:true,
    insurance: { rate: 0.04 }, // BPJS Ketenagakerjaan 2% + BPJS Kesehatan 1% + JKK/JKm ≈ 1% ≈ 4% (phần NLĐ)
    deduction: { personal: 54000000 }, // PTKP (Penghasilan Tidak Kena Pajak) Rp54 juta/tahun
    brackets: [[60000000,0.05],[190000000,0.15],[250000000,0.25],[4500000000,0.30],[Infinity,0.35]],
    rounding: 'round', currency: 'Rp', flag: '🇮🇩', name: {vi:'Indonesia',en:'Indonesia',ko:'인도네시아',ja:'インドネシア',zh:'印度尼西亚',my:'အင်ဒိုနီးရှား',th:'อินโดนีเซีย',id:'Indonesia',ph:'Indonesia',ne:'इन्डोनेसिया',hi:'इंडोनेशिया'},
    insNote: {
      vi:'BPJS Ketenagakerjaan 2% + BPJS Kesehatan 1% + JKK/JKm ~1% ≈ 4% (phần NLĐ) | PTKP (lajang): Rp 54.000.000/năm',
      en:'BPJS TK 2% + BPJS Health 1% + JKK/JKm ~1% ≈ 4% (employee share) | PTKP (single): Rp 54,000,000/yr',
      ko:'BPJS TK 2% + BPJS 건강 1% + JKK/JKm ~1% ≈ 4% (근로자 부담) | PTKP (독신): Rp 54,000,000/년',
      ja:'BPJS TK 2% + BPJS 健康 1% + JKK/JKm ~1% ≈ 4% (従業員負担) | PTKP（独身）: Rp 54,000,000/年',
      zh:'BPJS TK 2% + BPJS 健康 1% + JKK/JKm ~1% ≈ 4% (员工部分) | PTKP (单身): Rp 54,000,000/年',
      my:'BPJS TK 2% + BPJS ကျန်းမာ 1% + JKK/JKm ~1% ≈ 4% (ဝန်ထမ်းပိုင်း) | PTKP (တစ်ယောက်): Rp 54,000,000/နှစ်',
      th:'BPJS TK 2% + BPJS สุขภาพ 1% + JKK/JKm ~1% ≈ 4% (ส่วนลูกจ้าง) | PTKP (โสด): Rp 54,000,000/ปี',
      id:'BPJS TK 2% + BPJS Kes. 1% + JKK/JKm ~1% ≈ 4% (porsi karyawan) | PTKP (TK/0): Rp 54.000.000/tahun',
      ph:'BPJS TK 2% + BPJS Health 1% + JKK/JKm ~1% ≈ 4% (employee share) | PTKP (single): Rp 54,000,000/yr',
      ne:'BPJS TK 2% + BPJS स्वास्थ्य 1% + JKK/JKm ~1% ≈ 4% (कर्मचारी अंश) | PTKP (एकल): Rp 54,000,000/वर्ष',
      hi:'BPJS TK 2% + BPJS स्वास्थ्य 1% + JKK/JKm ~1% ≈ 4% (कर्मचारी हिस्सा) | PTKP (अकेला): Rp 54,000,000/वर्ष'
    }
  },
  PH: {
    period:'annual', insuranceDeductible:true,
    insurance: { rate: 0.085 }, // SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% (2025)
    deduction: { personal: 250000 }, // Basic personal exemption ₱250,000/năm (TRAIN Law)
    brackets: [[250000,0],[150000,0.15],[400000,0.20],[1200000,0.25],[6000000,0.32],[Infinity,0.35]],
    rounding: 'round', currency: '₱', flag: '🇵🇭', name: {vi:'Philippines',en:'Philippines',ko:'필리핀',ja:'フィリピン',zh:'菲律宾',my:'ဖိလစ်ပိုင်',th:'ฟิลิปปินส์',id:'Filipina',ph:'Pilipinas',ne:'फिलिपिन्स',hi:'फ़िलीपींस'},
    insNote: {
      vi:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | Miễn thuế: ₱250,000/năm (TRAIN Law)',
      en:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | Basic exemption: ₱250,000/yr (TRAIN Law)',
      ko:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | 기본 면세: ₱250,000/년 (TRAIN법)',
      ja:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | 基本免除: ₱250,000/年 (TRAIN法)',
      zh:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | 基本免税: ₱250,000/年 (TRAIN法)',
      my:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | ကင်းလွတ်: ₱250,000/နှစ် (TRAIN ဥပဒေ)',
      th:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | ยกเว้นพื้นฐาน: ₱250,000/ปี (TRAIN Law)',
      id:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | Pembebasan dasar: ₱250,000/thn (TRAIN Law)',
      ph:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | Basic exemption: ₱250,000/yr (TRAIN Law)',
      ne:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | मूल कर छुट: ₱250,000/वर्ष (TRAIN Law)',
      hi:'SSS 4.5% + PhilHealth 2.5% + Pag-IBIG 1% + ECC ~0.5% ≈ 8.5% | मूल छूट: ₱250,000/वर्ष (TRAIN कानून)'
    }
  },
  NP: {
    period:'annual', insuranceDeductible:true,
    insurance: { rate: 0.11 }, // Quỹ hưu trí (CIT) 10% + bảo hiểm sức khỏe 1% = 11%
    deduction: { personal: 500000 }, // Rs.500,000/năm basic personal allowance
    brackets: [[500000,0.01],[4500000,0.10],[2500000,0.20],[2500000,0.30],[5000000,0.36],[Infinity,0.39]],
    rounding: 'round', currency: 'रु', flag: '🇳🇵', name: {vi:'Nepal',en:'Nepal',ko:'네팔',ja:'ネパール',zh:'尼泊尔',my:'နီပေါ',th:'เนปาล',id:'Nepal',ph:'Nepal',ne:'नेपाल',hi:'नेपाल'},
    insNote: {
      vi:'Quỹ hưu trí (CIT) 10% + Y tế 1% = 11% | Giảm trừ cá nhân: रु 500,000/năm',
      en:'Provident Fund (CIT) 10% + Health 1% = 11% | Personal allowance: रु 500,000/yr',
      ko:'적립금(CIT) 10% + 의료 1% = 11% | 개인 공제: रु 500,000/년',
      ja:'積立金(CIT) 10% + 医療 1% = 11% | 個人控除: रु 500,000/年',
      zh:'公积金(CIT) 10% + 医疗 1% = 11% | 个人免税额: रु 500,000/年',
      my:'ပြည်တွင်း CIT 10% + ကျန်းမာ 1% = 11% | ကိုယ်ရေးကင်းလွတ်: रु 500,000/နှစ်',
      th:'กองทุนสำรองเลี้ยงชีพ (CIT) 10% + สุขภาพ 1% = 11% | ลดหย่อนส่วนตัว: रु 500,000/ปี',
      id:'Dana Pensiun (CIT) 10% + Kesehatan 1% = 11% | Pengurangan pribadi: रु 500,000/thn',
      ph:'Provident Fund (CIT) 10% + Health 1% = 11% | Personal allowance: रु 500,000/yr',
      ne:'भविष्य कोष (CIT) 10% + स्वास्थ्य 1% = 11% | व्यक्तिगत भत्ता: रु 500,000/वर्ष',
      hi:'भविष्य निधि (CIT) 10% + स्वास्थ्य 1% = 11% | व्यक्तिगत भत्ता: रु 500,000/वर्ष'
    }
  },
  IN: {
    period:'annual', insuranceDeductible:true,
    insurance: { rate: 0.12 }, // EPF (Employees Provident Fund) 12%
    deduction: { personal: 300000 }, // Basic exemption: ₹3,00,000/năm (New Tax Regime 2024)
    brackets: [[300000,0],[300000,0.05],[300000,0.10],[300000,0.15],[300000,0.20],[Infinity,0.30]],
    rounding: 'round', currency: '₹', flag: '🇮🇳', name: {vi:'Ấn Độ',en:'India',ko:'인도',ja:'インド',zh:'印度',my:'အိန္ဒိယ',th:'อินเดีย',id:'India',ph:'India',ne:'भारत',hi:'भारत'},
    insNote: {
      vi:'EPF 12% (người lao động đóng) | Chế độ thuế mới FY2024-25: Miễn thuế ₹3,00,000',
      en:'EPF 12% (Employee contribution) | New Tax Regime FY2024-25: Exemption ₹3,00,000',
      ko:'EPF 12% (근로자 부담) | 신세제 FY2024-25: 면세 ₹3,00,000',
      ja:'EPF 12% (従業員負担) | 新税制 FY2024-25: 免除 ₹3,00,000',
      zh:'EPF 12% (员工缴纳) | 新税制 FY2024-25: 免除 ₹3,00,000',
      my:'EPF 12% (ဝန်ထမ်းပေးဆောင်) | အခွန်အသစ် FY2024-25: ကင်းလွတ် ₹3,00,000',
      th:'EPF 12% (ลูกจ้างจ่าย) | ระบบภาษีใหม่ FY2024-25: ยกเว้น ₹3,00,000',
      id:'EPF 12% (iuran karyawan) | Rezim Pajak Baru FY2024-25: Pengecualian ₹3,00,000',
      ph:'EPF 12% (Employee contribution) | New Tax Regime FY2024-25: Exemption ₹3,00,000',
      ne:'EPF 12% (कर्मचारी योगदान) | नयाँ कर व्यवस्था FY2024-25: छुट ₹3,00,000',
      hi:'EPF 12% (कर्मचारी योगदान) | नई कर व्यवस्था FY2024-25: छूट ₹3,00,000'
    }
  }
};

/** Áp thuế lũy tiến từng phần theo bậc */
// → function _applyBrackets(income, brackets){ (moved to utils.js)

/** Tính bảo hiểm hàng tháng (mọi nước đều tính từ monthly gross) */
// → function _calcInsurance(rule, monthlyGross){ (moved to utils.js)

/** Làm tròn theo quy định từng nước */
// → function _roundTax(val, mode){ (moved to utils.js)

/** Engine chính: tính lương net từ monthly gross — hỗ trợ 11 quốc gia
 * @param country 'VN'|'KR'|'JP'|'TW'|'US'|'MY'|'TH'|'ID'|'PH'|'NP'|'IN'
 * @param monthlyGross  Thu nhập tháng (gross)
 * @param dependents    Số người phụ thuộc (dùng cho VN)
// taxEngineCalculate() → moved to utils.js

/* ===== Backward compat: code cũ dùng tinhBH/tinhTNCN cho VN ===== */
// → function tinhBH(b,v){const bb=Math.min(b,TRAN_BH);const bt=M (moved to utils.js)

// === tinhTNCN ===
function tinhTNCN(t){if(t<=0)return 0;return _applyBrackets(t, TAX_RULES.VN.brackets);}


// Sync langCfg with userData country selection
function syncLangCfg(){
  langCfg.payrollCountry = userData.country || 'VN';
  langCfg.lang = userData.lang || 'vi';
  lsSet('cp22_lang',langCfg);
}

/* ===== SHIM TƯƠNG THÍCH CHO ENGINE TÍNH LƯƠNG ===== */
function buildCfgShim(){
  return {
    luong: userData.salary || 0,
    luongNgay: 0,
    kieu: 'thang',
    ngayCong: userData.ngc || 26,
    gioNgay: userData.hoursPerShift || 8,
    npt: 0,
    vung: 5310000,
    dsCa: [],
  };
}

// Shims so calcDaySalaryFull can call ldN/lgN/cfg
let _cfg_shim = {luong:0,ngayCong:26,gioNgay:8,kieu:'thang'};
function ldN(){return (_cfg_shim.luong||0)/(_cfg_shim.ngayCong||26);}
function lgN(){return ldN()/(_cfg_shim.gioNgay||8);}
function fmtFull(n){return Math.round(n).toLocaleString('vi-VN')+' ₫';}
/* ===== DỮ LIỆU TRẠNG THÁI APP ===== */
var userData={name:'',job:'',company:'',shifts:1,hoursPerShift:8,lang:'vi',country:'VN',salary:0,ngc:26};

/* ════════════════════════════════════════════════════════════════════
   GPS GLOBAL STATE — khai báo ở đây để app.js và checkin.js đều dùng được
   📌 Thay đổi giá trị mặc định:
     checkinMin  = 5  (phút xác nhận VÀO ca)
     checkoutMin = 75 (phút xác nhận HẾT ca)
     radius      = 15  (bán kính mặc định, mét)
   ════════════════════════════════════════════════════════════════════ */
// GPS globals — dùng var (không phải let) để tránh TDZ khi merge nhiều file
var _gpsInterval    = null;   // setInterval polling ID
var _gpsData        = {lat:null, lng:null, radius:15, enabled:false, checkinMin:5, checkoutMin:75, tightCompanyGps:false};
var _gpsWasInside   = null;   // trạng thái trong/ngoài lần poll trước (compat)
var _gpsPollMs      = 60000;  // poll mỗi 60 giây
var _gpsCheckinTimer  = null; // setTimeout chờ xác nhận vào ca
var _gpsCheckoutTimer = null; // setTimeout chờ xác nhận ra ca
// GPS v2 filter state (moved to checkin.js as var — declared here for TDZ safety)
var _gpsPositionHistory = [];
var _gpsDebounceCount   = 0;
var _gpsLastConfirmed   = null;

// Helper: lấy ms/phút từ _gpsData (người dùng điều chỉnh được qua slider)
function _gpsCheckinDelayMs()  { return ((_gpsData.checkinMin|0)||5)  * 60 * 1000; }
function _gpsCheckoutDelayMs() { return ((_gpsData.checkoutMin|0)||75)* 60 * 1000; }
function _gpsCheckinMinus()    { return (_gpsData.checkinMin|0)||5;  }
function _gpsCheckoutMinus()   { return (_gpsData.checkoutMin|0)||75; }

var attData={};// key: 'YYYY-MM-DD' → {type:'cm'|'vang'|'np'|'ll', in:'HH:MM', out:'HH:MM'}
let apCfg={color:0,avtB64:'',bgB64:'',bgGrad:'',calSun:'#E8433A',calSat:'#2D7DD2',calNorm:'#1A2332'};
var notifCfg={n1:true,n2:true,n3:false,n4:false};
var calView={y:new Date().getFullYear(),m:new Date().getMonth()};
var setupShifts=1,setupHours=8,ngcVal=22;
let obPage=1;
var obLang='vi',obCountry='VN';

const LANGS=[
  {id:'vi',flag:'🇻🇳',name:'Tiếng Việt'},
  {id:'en',flag:'🇺🇸',name:'English'},
  {id:'ko',flag:'🇰🇷',name:'한국어'},
  {id:'ja',flag:'🇯🇵',name:'日本語'},
  {id:'zh',flag:'🇨🇳',name:'中文'},
  {id:'my',flag:'🇲🇲',name:'မြန်မာ'},
  {id:'th',flag:'🇹🇭',name:'ภาษาไทย'},
  {id:'id',flag:'🇮🇩',name:'Bahasa Indonesia'},
  {id:'ph',flag:'🇵🇭',name:'Filipino'},
  {id:'ne',flag:'🇳🇵',name:'नेपाली'},
  {id:'hi',flag:'🇮🇳',name:'हिन्दी'},
];
const COUNTRIES=[
  {id:'VN',flag:'🇻🇳',
   name:{vi:'Việt Nam',en:'Vietnam',ko:'베트남',ja:'ベトナム',zh:'越南',my:'ဗီယက်နမ်',th:'เวียดนาม',id:'Vietnam',ph:'Vietnam',ne:'भियतनाम',hi:'वियतनाम'},
   rule:{vi:'Tăng ca ×1.5, Đêm +30%',en:'OT ×1.5, Night +30%',ko:'초과근무 ×1.5, 야간 +30%',ja:'残業 ×1.5, 深夜 +30%',zh:'加班 ×1.5, 夜班 +30%',my:'OT ×1.5, ည +30%',th:'OT ×1.5, กลางคืน +30%',id:'OT ×1.5, Malam +30%',ph:'OT ×1.5, Gabi +30%',ne:'OT ×1.5, रात +30%',hi:'OT ×1.5, रात +30%'}},
  {id:'KR',flag:'🇰🇷',
   name:{vi:'Hàn Quốc',en:'South Korea',ko:'한국',ja:'韓国',zh:'韩国',my:'တောင်ကိုရီးယား',th:'เกาหลีใต้',id:'Korea Selatan',ph:'South Korea',ne:'दक्षिण कोरिया',hi:'दक्षिण कोरिया'},
   rule:{vi:'Tăng ca ×1.5, Đêm +50%',en:'OT ×1.5, Night +50%',ko:'초과근무 ×1.5, 야간 +50%',ja:'残業 ×1.5, 深夜 +50%',zh:'加班 ×1.5, 夜班 +50%',my:'OT ×1.5, ည +50%',th:'OT ×1.5, กลางคืน +50%',id:'OT ×1.5, Malam +50%',ph:'OT ×1.5, Gabi +50%',ne:'OT ×1.5, रात +50%',hi:'OT ×1.5, रात +50%'}},
  {id:'JP',flag:'🇯🇵',
   name:{vi:'Nhật Bản',en:'Japan',ko:'일본',ja:'日本',zh:'日本',my:'ဂျပန်',th:'ญี่ปุ่น',id:'Jepang',ph:'Hapon',ne:'जापान',hi:'जापान'},
   rule:{vi:'Tăng ca ×1.25, Đêm +25%',en:'OT ×1.25, Night +25%',ko:'초과근무 ×1.25, 심야 +25%',ja:'残業 ×1.25, 深夜 +25%',zh:'加班 ×1.25, 深夜 +25%',my:'OT ×1.25, ည +25%',th:'OT ×1.25, กลางดึก +25%',id:'OT ×1.25, Malam +25%',ph:'OT ×1.25, Gabi +25%',ne:'OT ×1.25, रात +25%',hi:'OT ×1.25, रात +25%'}},
  {id:'TW',flag:'🇹🇼',
   name:{vi:'Đài Loan',en:'Taiwan',ko:'대만',ja:'台湾',zh:'台湾',my:'တိုင်ဝမ်',th:'ไต้หวัน',id:'Taiwan',ph:'Taiwan',ne:'ताइवान',hi:'ताइवान'},
   rule:{vi:'Tăng ca ×1.33→×1.67',en:'OT ×1.33→×1.67',ko:'초과근무 ×1.33→×1.67',ja:'残業 ×1.33→×1.67',zh:'加班 ×1.33→×1.67',my:'OT ×1.33→×1.67',th:'OT ×1.33→×1.67',id:'OT ×1.33→×1.67',ph:'OT ×1.33→×1.67',ne:'OT ×1.33→×1.67',hi:'OT ×1.33→×1.67'}},
  {id:'US',flag:'🇺🇸',
   name:{vi:'Hoa Kỳ',en:'United States',ko:'미국',ja:'アメリカ',zh:'美国',my:'အမေရိကန်',th:'สหรัฐอเมริกา',id:'Amerika Serikat',ph:'Estados Unidos',ne:'संयुक्त राज्य अमेरिका',hi:'संयुक्त राज्य अमेरिका'},
   rule:{vi:'Tăng ca ×1.5 (FLSA)',en:'OT ×1.5 (FLSA)',ko:'초과근무 ×1.5 (FLSA)',ja:'残業 ×1.5 (FLSA)',zh:'加班 ×1.5 (FLSA)',my:'OT ×1.5 (FLSA)',th:'OT ×1.5 (FLSA)',id:'OT ×1.5 (FLSA)',ph:'OT ×1.5 (FLSA)',ne:'OT ×1.5 (FLSA)',hi:'OT ×1.5 (FLSA)'}},
  {id:'MY',flag:'🇲🇲',
   name:{vi:'Myanmar',en:'Myanmar',ko:'미얀마',ja:'ミャンマー',zh:'缅甸',my:'မြန်မာ',th:'เมียนมา',id:'Myanmar',ph:'Myanmar',ne:'म्यानमार',hi:'म्यांमार'},
   rule:{vi:'Tăng ca ×2.0',en:'OT ×2.0',ko:'초과근무 ×2.0',ja:'残業 ×2.0',zh:'加班 ×2.0',my:'OT ×2.0',th:'OT ×2.0',id:'OT ×2.0',ph:'OT ×2.0',ne:'OT ×2.0',hi:'OT ×2.0'}},
  {id:'TH',flag:'🇹🇭',
   name:{vi:'Thái Lan',en:'Thailand',ko:'태국',ja:'タイ',zh:'泰国',my:'ထိုင်းနိုင်ငံ',th:'ประเทศไทย',id:'Thailand',ph:'Thailand',ne:'थाइल्याण्ड',hi:'थाईलैंड'},
   rule:{vi:'Tăng ca ×1.5, Lễ ×3.0',en:'OT ×1.5, Holiday ×3.0',ko:'초과근무 ×1.5, 공휴일 ×3.0',ja:'残業 ×1.5, 休日 ×3.0',zh:'加班 ×1.5, 假日 ×3.0',my:'OT ×1.5, ရုံးပိတ် ×3.0',th:'OT ×1.5, วันหยุด ×3.0',id:'OT ×1.5, Libur ×3.0',ph:'OT ×1.5, Holiday ×3.0',ne:'OT ×1.5, बिदा ×3.0',hi:'OT ×1.5, छुट्टी ×3.0'}},
  {id:'ID',flag:'🇮🇩',
   name:{vi:'Indonesia',en:'Indonesia',ko:'인도네시아',ja:'インドネシア',zh:'印度尼西亚',my:'အင်ဒိုနီးရှား',th:'อินโดนีเซีย',id:'Indonesia',ph:'Indonesia',ne:'इन्डोनेसिया',hi:'इंडोनेशिया'},
   rule:{vi:'Tăng ca ×1.5→×2.0',en:'OT ×1.5→×2.0',ko:'초과근무 ×1.5→×2.0',ja:'残業 ×1.5→×2.0',zh:'加班 ×1.5→×2.0',my:'OT ×1.5→×2.0',th:'OT ×1.5→×2.0',id:'OT ×1.5→×2.0',ph:'OT ×1.5→×2.0',ne:'OT ×1.5→×2.0',hi:'OT ×1.5→×2.0'}},
  {id:'PH',flag:'🇵🇭',
   name:{vi:'Philippines',en:'Philippines',ko:'필리핀',ja:'フィリピン',zh:'菲律宾',my:'ဖိလစ်ပိုင်',th:'ฟิลิปปินส์',id:'Filipina',ph:'Pilipinas',ne:'फिलिपिन्स',hi:'फ़िलीपींस'},
   rule:{vi:'Tăng ca ×1.25, Đêm +10%',en:'OT ×1.25, Night +10%',ko:'초과근무 ×1.25, 야간 +10%',ja:'残業 ×1.25, 深夜 +10%',zh:'加班 ×1.25, 夜班 +10%',my:'OT ×1.25, ည +10%',th:'OT ×1.25, กลางคืน +10%',id:'OT ×1.25, Malam +10%',ph:'OT ×1.25, Gabi +10%',ne:'OT ×1.25, रात +10%',hi:'OT ×1.25, रात +10%'}},
  {id:'NP',flag:'🇳🇵',
   name:{vi:'Nepal',en:'Nepal',ko:'네팔',ja:'ネパール',zh:'尼泊尔',my:'နီပေါ',th:'เนปาล',id:'Nepal',ph:'Nepal',ne:'नेपाल',hi:'नेपाल'},
   rule:{vi:'Tăng ca ×1.5, Đêm +50%',en:'OT ×1.5, Night +50%',ko:'초과근무 ×1.5, 야간 +50%',ja:'残業 ×1.5, 深夜 +50%',zh:'加班 ×1.5, 深夜 +50%',my:'OT ×1.5, ည +50%',th:'OT ×1.5, กลางคืน +50%',id:'OT ×1.5, Malam +50%',ph:'OT ×1.5, Gabi +50%',ne:'OT ×1.5, रात +50%',hi:'OT ×1.5, रात +50%'}},
  {id:'IN',flag:'🇮🇳',
   name:{vi:'Ấn Độ',en:'India',ko:'인도',ja:'インド',zh:'印度',my:'အိန္ဒိယ',th:'อินเดีย',id:'India',ph:'India',ne:'भारत',hi:'भारत'},
   rule:{vi:'Tăng ca ×2.0 (Factories Act)',en:'OT ×2.0 (Factories Act)',ko:'초과근무 ×2.0',ja:'残業 ×2.0',zh:'加班 ×2.0',my:'OT ×2.0',th:'OT ×2.0',id:'OT ×2.0',ph:'OT ×2.0',ne:'OT ×2.0',hi:'OT ×2.0'}},
];
/** Giải ngôn ngữ cho trường name/rule của COUNTRIES/PAYROLL_RULES/TAX_RULES
 *  Nhận string hoặc object {vi,en,ko,ja,zh,my} → trả về string đúng ngôn ngữ */
function cLang(field){
  if(!field) return '';
  if(typeof field === 'string') return field;
  const L = (typeof userData!=='undefined' && userData.lang) || 'vi';
  return field[L] || field.en || field.vi || Object.values(field)[0] || '';
}
const THEMES=[
  {bg:'#0D9E75',lt:'#E0F5EE',name:'Xanh lá'},
  {bg:'#2D7DD2',lt:'#EEF4FF',name:'Xanh dương'},
  {bg:'#7B5EA7',lt:'#F5F0FF',name:'Tím'},
  {bg:'#E8433A',lt:'#FFF0EF',name:'Đỏ'},
  {bg:'#F5A623',lt:'#FFF8E8',name:'Vàng'},
  {bg:'#1A2332',lt:'#F0F2F5',name:'Đen'},
];
var DAYS=window._DAYS_SHORT||['CN','T2','T3','T4','T5','T6','T7'];
var MONTHS=window._MONTHS||['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

/* ===== ĐỌC/GHI DỮ LIỆU localStorage ===== */
/** Tải toàn bộ dữ liệu từ localStorage khi khởi động app */
function isSetupUserData(data){
  return !!(data && typeof data.name === 'string' && data.name.trim());
}
function loadStoredUserData(){
  const primary = lsGet('cp22_user');
  if(isSetupUserData(primary)) return primary;

  const backup = lsGet('cp22_user_backup');
  if(isSetupUserData(backup)){
    lsSet('cp22_user', backup);
    return backup;
  }

  return primary || backup || null;
}
function backupUserDataIfReady(){
  if(isSetupUserData(userData)) lsSet('cp22_user_backup', userData);
}
function loadData(){
  const u=loadStoredUserData();
  if(u){ userData=Object.assign(userData,u); }
  backupUserDataIfReady();
  // ── Migration: đảm bảo subJob luôn tồn tại (backward compat) ──
  if(!userData.subJob) userData.subJob = {active:false,name:'',salaryMode:'hour',salary:0,salaryDay:0,salaryHour:0};
  if(userData.subJob.active === undefined) userData.subJob.active = false;
  const a=lsGet('cp22_att');if(a){const ma=migrateAttendanceDateKeys(a);attData=ma;if(ma!==a)lsSet('cp22_att',attData);}
  const ap=lsGet('cp22_ap');if(ap)apCfg=Object.assign(apCfg,ap);
  const n=lsGet('cp22_notif');if(n)notifCfg=Object.assign(notifCfg,n);
  if(notifCfg.n3 && notifCfg.n1 === false && !notifCfg._gpsN1Migrated){
    notifCfg.n1 = true;
    notifCfg._gpsN1Migrated = true;
    saveNotif();
  }
  if(notifCfg.n1 !== true || notifCfg.n2 !== true){
    notifCfg.n1 = true;
    notifCfg.n2 = true;
    saveNotif();
  }
}
/** Lưu thông tin người dùng (tên, chức vụ, cài đặt lương) */
function saveUser(){
  lsSet('cp22_user',userData);
  backupUserDataIfReady();
}
/** Lưu dữ liệu chấm công (trạng thái từng ngày) */
/* [LEGACY_ATTENDANCE_STORE]
   Ghi chu: cp22_att/attData la so cham cong chinh dang duoc cac luong cu
   va luong GPS/native cung ghi ve. Khong xoa neu chua doi schema luu tru.
*/
function saveAtt(){lsSet('cp22_att',attData);}
/** Lưu cài đặt giao diện (màu, ảnh nền, ảnh đại diện) */
function saveAp(){lsSet('cp22_ap',apCfg);}
/** Lưu cài đặt thông báo (bật/tắt từng loại) */
function saveNotif(){lsSet('cp22_notif',notifCfg);}

/* ===== ONBOARDING - THIẾT LẬP LẦN ĐẦU ===== */
/** Render màn hình Onboarding theo trang hiện tại (obPage: 1-4) */
function renderOB(){
  const progress=document.getElementById('obProgress');
  const dots=progress.children;
  for(let i=0;i<4;i++){
    dots[i].className='ob-dot'+(i<obPage-1?' done':i===obPage-1?' active':'');
  }
  document.getElementById('obBtnBack').style.opacity=obPage===1?'0.3':'1';
  // Use lang selected in onboarding (obLang), fallback to TRAN.vi
  const t=TRAN[obLang]||TRAN.vi;
  // Update onboarding header with selected language
  const obAppNameEl=document.getElementById('obAppName');
  if(obAppNameEl)obAppNameEl.textContent=t.appName||'Chấm Công Pro';
  const obSkipEl=document.getElementById('obSkipBtn');
  if(obSkipEl)obSkipEl.textContent=({vi:'Bỏ qua',en:'Skip',ko:'건너뛰기',ja:'スキップ',zh:'跳过',my:'ကျော်',th:'ข้าม',id:'Lewati',ph:'Laktawan',ne:'छोड्नुस्',hi:'छोड़ें'}[obLang]||'Bỏ qua');
  const body=document.getElementById('obBody');
  const nextBtn=document.getElementById('obBtnNext');
  if(obPage===1){
    const [titleLine1,titleLine2]=(t.obLang||'Chào mừng! 👋\nChọn ngôn ngữ').split('\n');
    body.innerHTML=`
      <div class="ob-title">${titleLine1}<br>${titleLine2||''}</div>
      <div class="ob-sub">${t.obLangSub||''}</div>
      <div class="lang-grid" id="obLangGrid"></div>
      <div style="height:8px"></div>
      <div class="ob-title" style="font-size:20px;margin-top:8px">${t.obShiftCountry||'Quốc gia làm việc'}</div>
      <div class="country-grid" id="obCountryGrid"></div>
    `;
    renderLangGrid('obLangGrid',obLang,id=>{obLang=id;renderOB();});
    renderCountryGrid('obCountryGrid',obCountry,id=>{obCountry=id;renderOB();});
    if(nextBtn)nextBtn.textContent=(t.obNext||'Tiếp theo →');
  }else if(obPage===2){
    const _sj=userData.subJob||{};
    const _sjOn=!!_sj.active;
    const _sjMode=_sj.salaryMode||'hour';
    const _sjName=_sj.name||'';
    const _sjSal=_sjMode==='hour'?(_sj.salaryHour||''):_sjMode==='day'?(_sj.salaryDay||''):(_sj.salary||'');
    body.innerHTML=`
      <div class="ob-title">${t.obUser||'Thông tin của bạn 👤'}</div>
      <div class="ob-sub">${t.obUserSub||''}</div>
      <div class="field-group">
        <div>
          <div class="field-label">${t.obName||'Họ và tên'}</div>
          <input class="field-input" id="ob2Name" placeholder="${t.obNameP||'Nguyễn Văn A'}" value="${userData.name||''}">
        </div>
        <div>
          <div class="field-label">${t.obJob||'Chức vụ / Công việc'}</div>
          <input class="field-input" id="ob2Job" placeholder="${t.obJobP||'Nhân viên...'}" value="${userData.job||''}">
        </div>
        <div>
          <div class="field-label">${t.obCo||'Tên công ty'}</div>
          <input class="field-input" id="ob2Co" placeholder="${t.obCoP||'Công ty ABC'}" value="${userData.company||''}">
        </div>
      </div>
      <div style="background:linear-gradient(135deg,#f0ebff,#e8f4ff);border-radius:14px;padding:14px 16px;margin-top:14px;border:1.5px solid #c8b4f0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:800;color:#5a3e8e">💼 Có job phụ không?</div>
            <div style="font-size:11px;color:#7B5EA7;margin-top:2px">Freelance, part-time, làm thêm...</div>
          </div>
          <div id="obTogSubJob" onclick="ob_toggleSubJob()" style="width:48px;height:28px;border-radius:14px;background:${_sjOn?'#7B5EA7':'#ccc'};position:relative;cursor:pointer;flex-shrink:0;transition:background .3s;margin-left:12px">
            <div id="obTogSubKnob" style="width:22px;height:22px;border-radius:11px;background:white;position:absolute;top:3px;left:${_sjOn?'23':'3'}px;transition:left .3s;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>
          </div>
        </div>
        <div id="obSubJobFields" style="display:${_sjOn?'block':'none'};margin-top:14px;padding-top:14px;border-top:1px solid #c8b4f0">
          <div style="font-size:11px;font-weight:800;color:#5a3e8e;margin-bottom:6px">TÊN CÔNG VIỆC PHỤ</div>
          <input class="field-input" id="obSubJobName" placeholder="Freelance / Gia sư / Part-time..." value="${_sjName}" style="margin-bottom:14px">
          <div style="font-size:11px;font-weight:800;color:#5a3e8e;margin-bottom:8px">LƯƠNG JOB PHỤ</div>
          <div style="display:flex;gap:6px;margin-bottom:10px">
            <button id="obSubModeHour"  onclick="ob_selSubMode('hour')"  style="flex:1;padding:8px 4px;border-radius:10px;border:1.5px solid #c8b4f0;background:white;color:#7B5EA7;font-size:11px;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif">⏱ / giờ</button>
            <button id="obSubModeDay"   onclick="ob_selSubMode('day')"   style="flex:1;padding:8px 4px;border-radius:10px;border:1.5px solid #c8b4f0;background:white;color:#7B5EA7;font-size:11px;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif">📅 / ngày</button>
            <button id="obSubModeMonth" onclick="ob_selSubMode('month')" style="flex:1;padding:8px 4px;border-radius:10px;border:1.5px solid #c8b4f0;background:white;color:#7B5EA7;font-size:11px;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif">🗓 / tháng</button>
          </div>
          <input class="field-input" id="obSubJobSalary" type="number" min="0" placeholder="0" value="${_sjSal}" style="margin-bottom:4px;border-color:#c8b4f0">
          <div style="font-size:11px;color:#7B5EA7;margin-top:2px" id="obSubSalaryHint"></div>
        </div>
      </div>
    `;
    if(nextBtn)nextBtn.textContent=(t.obNext||'Tiếp theo →');
    ob_selSubMode(_sjMode);
  }else if(obPage===3){
    body.innerHTML=`
      <div class="ob-title">${t.obShift||'Lịch làm việc ⏰'}</div>
      <div class="ob-sub">${t.obShiftSub||''}</div>
      <div class="field-label">${t.obShiftNum||'Số ca làm việc'}</div>
      <div class="num-grid" id="ob3ShiftGrid" style="margin-bottom:16px">
        <div class="num-btn${setupShifts===1?' sel':''}" onclick="selShift(1,this)">1</div>
        <div class="num-btn${setupShifts===2?' sel':''}" onclick="selShift(2,this)">2</div>
        <div class="num-btn${setupShifts===3?' sel':''}" onclick="selShift(3,this)">3</div>
        <div class="num-btn${setupShifts===4?' sel':''}" onclick="selShift(4,this)">4</div>
      </div>
      <div class="field-label">${t.obHours||'Số giờ mỗi ca'}</div>
      <div class="num-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:8px" id="ob3HoursGrid">
        <div class="num-btn${setupHours===6?' sel':''}" onclick="selHours(6,this)">6h</div>
        <div class="num-btn${setupHours===7?' sel':''}" onclick="selHours(7,this)">7h</div>
        <div class="num-btn${setupHours===8?' sel':''}" onclick="selHours(8,this)">8h</div>
        <div class="num-btn${setupHours===10?' sel':''}" onclick="selHours(10,this)">10h</div>
        <div class="num-btn${setupHours===12?' sel':''}" onclick="selHours(12,this)">12h</div>
      </div>
      <!-- ═══ ĐIỀU CHỈNH GIỜ TÙY CHỈNH ═══ -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:10px 14px;background:#F0F6FF;border-radius:12px;border:1.5px dashed #2D7DD2">
        <span style="font-size:12px;font-weight:700;color:#1F4F8F;white-space:nowrap">⚙️ ${t.obHoursCustom||'Hoặc nhập:'}</span>
        <input id="ob3HoursCustom" type="number" min="1" max="24" step="0.5" value="${setupHours}"
          oninput="selHoursCustom(this.value)"
          style="flex:1;border:1.5px solid #C7DBF8;border-radius:8px;padding:8px 12px;font-size:14px;font-weight:700;color:#1F4F8F;background:white;outline:none;font-family:'Nunito',sans-serif;text-align:center">
        <span style="font-size:12px;font-weight:700;color:#1F4F8F">${t.obHoursUnit||'giờ/ca'}</span>
      </div>
      <div class="field-label">${{vi:'Ngày làm trong tuần',en:'Working days',ko:'근무 요일',ja:'出勤曜日',zh:'工作日',my:'အလုပ်ရက်',th:'วันทำงาน',id:'Hari kerja',ph:'Araw ng trabaho',ne:'काम गर्ने दिन',hi:'काम के दिन'}[obLang]||'Ngày làm trong tuần'}</div>
      <div id="obWorkDayPicker" style="margin-bottom:4px"></div>
    `;
    renderWorkDayPicker('obWorkDayPicker', userData.workDays || [0,1,2,3,4], obLang);
    if(nextBtn)nextBtn.textContent=(t.obNext||'Tiếp theo →');
  }else if(obPage===4){
    const shifts=setupShifts;
    const defaultTimes=[{in:'06:00',out:'14:00'},{in:'14:00',out:'22:00'},{in:'22:00',out:'06:00'},{in:'00:00',out:'08:00'}];
    const nightLbl={vi:'Ca đêm',en:'Night shift',ko:'야간',ja:'夜勤',zh:'夜班',my:'ညဆင်း',th:'กะกลางคืน',id:'Shift malam',ph:'Night shift',ne:'रात पाली',hi:'रात शिफ्ट'}[obLang]||'Ca đêm';
    const shiftLbl={vi:'Ca',en:'Shift',ko:'교대',ja:'シフト',zh:'班',my:'ဆင်း',th:'กะ',id:'Shift',ph:'Shift',ne:'सिफ्ट',hi:'शिफ्ट'}[obLang]||'Ca';
    const inLbl=t.dpInTime||'Vào ca'; const outLbl=t.dpOutTime||'Hết ca';
    let shiftCards='';
    for(let i=0;i<shifts;i++){
      const ti=defaultTimes[i]||{in:'08:00',out:'17:00'};
      shiftCards+=`
        <div class="shift-card">
          <div class="shift-card-head">
            <div class="shift-label">${shiftLbl} ${i+1}</div>
            <div class="shift-night" style="${i>=2?'':'opacity:.4'}">🌙 ${nightLbl}</div>
          </div>
          <div class="time-row">
            <div><div class="field-label">${inLbl}</div><input class="time-inp" id="sIn${i}" type="time" value="${ti.in}"></div>
            <div class="time-sep">→</div>
            <div><div class="field-label">${outLbl}</div><input class="time-inp" id="sOut${i}" type="time" value="${ti.out}"></div>
          </div>
        </div>`;
    }
    const weekLbl=t.obWeeks||'Số tuần một vòng';
    const weekNames=['1','2','3','4'].map(w=>{
      const wLabels={vi:'tuần',en:'wk',ko:'주',ja:'週',zh:'周',my:'ပတ်',th:'สัปดาห์',id:'minggu',ph:'linggo',ne:'हप्ता',hi:'सप्ताह'};
      return w+' '+(wLabels[obLang]||'tuần');
    });
    // Câu hỏi nghỉ giữa giờ
    const breakLbl     = {vi:'Có nghỉ giữa giờ không?',en:'Any break time?',ko:'중간 휴식 있나요?',ja:'休憩時間ありますか？',zh:'有中途休息吗？',my:'အကြားနားချိန်ရှိပါသလား?',th:'มีเวลาพักไหม?',id:'Ada waktu istirahat?',ph:'May pahinga ba?',ne:'बिचमा विश्राम छ?',hi:'बीच में विराम है?'}[obLang]||'Có nghỉ giữa giờ không?';
    const breakNo      = {vi:'Không',en:'No',ko:'아니오',ja:'なし',zh:'没有',my:'မရှိ',th:'ไม่มี',id:'Tidak',ph:'Wala',ne:'छैन',hi:'नहीं'}[obLang]||'Không';
    const breakYes     = {vi:'Có',en:'Yes',ko:'예',ja:'あり',zh:'有',my:'ရှိ',th:'มี',id:'Ada',ph:'Mayroon',ne:'छ',hi:'हाँ'}[obLang]||'Có';
    const breakMinLbl  = {vi:'Số phút nghỉ',en:'Break minutes',ko:'휴식 분',ja:'休憩時間（分）',zh:'休息分钟',my:'အနားမိနစ်',th:'นาทีพัก',id:'Menit istirahat',ph:'Minutong pahinga',ne:'विश्राम मिनेट',hi:'विश्राम मिनट'}[obLang]||'Số phút nghỉ';

    // Câu hỏi tuần này làm ca nào (chỉ hiện khi >=2 ca)
    const curShiftLbl = {vi:'Tuần này bạn làm ca nào?',en:'Which shift this week?',ko:'이번 주 어느 교대?',ja:'今週はどのシフト？',zh:'本周哪个班次？',my:'ဒီအပတ် ဘယ်ဆင်း?',th:'สัปดาห์นี้กะอะไร?',id:'Shift minggu ini?',ph:'Anong shift ngayong linggo?',ne:'यो हप्ता कुन सिफ्ट?',hi:'इस सप्ताह कौन सी शिफ्ट?'}[obLang]||'Tuần này bạn làm ca nào?';
    const shiftLblShort = {vi:'Ca',en:'Shift',ko:'교대',ja:'シフト',zh:'班',my:'ဆင်း',th:'กะ',id:'Shift',ph:'Shift',ne:'सिफ्ट',hi:'शिफ्ट'}[obLang]||'Ca';
    let curShiftHtml = '';
    if(setupShifts >= 2){
      let btns = '';
      for(let i = 1; i <= setupShifts; i++){
        btns += `<div class="num-btn${i===1?' sel':''}" onclick="ob_setCurShift(${i},this)">${shiftLblShort} ${i}</div>`;
      }
      curShiftHtml = `
        <div class="field-label" style="margin-top:14px">${curShiftLbl}</div>
        <div class="num-grid" style="grid-template-columns:repeat(${Math.min(setupShifts,4)},1fr);margin-bottom:12px" id="obCurShiftGrid">
          ${btns}
        </div>`;
    }
    body.innerHTML=`
      <div class="ob-title">${t.obTime||'Giờ giấc ca làm 🕐'}</div>
      <div class="ob-sub">${t.obTimeSub||''}</div>
      <div class="field-label">${weekLbl}</div>
      <div class="week-grid" style="margin-bottom:16px" id="ob4WeekGrid">
        ${weekNames.map((w,i)=>`<div class="week-btn${i===0?' sel':''}" onclick="this.parentElement.querySelectorAll('.week-btn').forEach(b=>b.classList.remove('sel'));this.classList.add('sel')">${w}</div>`).join('')}
      </div>
      ${curShiftHtml}
      ${shiftCards}
      ${setupShifts >= 2 ? '<div id="ob4RotationBlock" style="margin-bottom:16px"></div>' : ''}
      <!-- Hỏi nghỉ giữa giờ -->
      <div class="field-label" style="margin-top:14px">${breakLbl}</div>
      <div class="num-grid" style="grid-template-columns:1fr 1fr;margin-bottom:12px" id="obBreakGrid">
        <div class="num-btn sel" id="obBrNo"  onclick="ob_setBreak(0,this)">${breakNo}</div>
        <div class="num-btn"     id="obBrYes" onclick="ob_setBreak(1,this)">${breakYes}</div>
      </div>
      <div id="obBreakMinBlock" style="display:none">
        <div class="field-label">${breakMinLbl}</div>
        <div class="num-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:8px" id="obBreakMinGrid">
          <div class="num-btn"     onclick="ob_setBreakMin(30,this)">30'</div>
          <div class="num-btn sel" onclick="ob_setBreakMin(60,this)">60'</div>
          <div class="num-btn"     onclick="ob_setBreakMin(75,this)">75'</div>
          <div class="num-btn"     onclick="ob_setBreakMin(90,this)">90'</div>
          <div class="num-btn"     onclick="ob_setBreakMin(120,this)">120'</div>
        </div>
      </div>
    `;
    if(nextBtn)nextBtn.textContent=(t.obStart||'Bắt đầu dùng app ✓');
    if(setupShifts >= 2) ob_renderRotation();
  }
  // Also update Back button
  const backBtn=document.getElementById('obBtnBack');
  if(backBtn)backBtn.textContent=(t.obBack||'←');
}

/** Hiển thị grid chọn ngôn ngữ (6 cờ) với callback khi chọn */
function renderLangGrid(elId,selLang,onSel){
  const el=document.getElementById(elId);if(!el)return;
  // Lưu callback vào window để onclick gọi trực tiếp, tránh toString() dễ vỡ
  window._langGridCb=onSel;
  el.innerHTML=LANGS.map(l=>`
    <div class="lang-item${l.id===selLang?' sel':''}" onclick="window._langGridCb('${l.id}')">
      <span class="flag">${l.flag}</span>
      <span class="lname">${l.name}</span>
    </div>`).join('');
}
/** Hiển thị grid chọn quốc gia làm việc với luật lương tương ứng */
function renderCountryGrid(elId,selC,onSel){
  const el=document.getElementById(elId);if(!el)return;
  // Lưu callback vào window để onclick gọi trực tiếp, tránh toString() dễ vỡ
  window._countryGridCb=onSel;
  el.innerHTML=COUNTRIES.map(c=>`
    <div class="country-item${c.id===selC?' sel':''}" onclick="window._countryGridCb('${c.id}')">
      <span class="cflag">${c.flag}</span>
      <div><div class="cname">${cLang(c.name)}</div><div class="crule">${cLang(c.rule)}</div></div>
    </div>`).join('');
}

/** Xử lý nút Tiếp theo: lưu dữ liệu trang hiện tại rồi chuyển sang trang sau */
function obNext(){
  if(obPage===1){
    userData.lang=obLang;userData.country=obCountry;syncLangCfg();
  }else if(obPage===2){
    const n=document.getElementById('ob2Name')?.value.trim();
    const j=document.getElementById('ob2Job')?.value.trim();
    const c=document.getElementById('ob2Co')?.value.trim();
    if(!n){alert(u('validate.empty_name'));return;}
    userData.name=n;userData.job=j;userData.company=c;
    // Lưu sub job data từ onboarding
    if(!userData.subJob) userData.subJob={active:false,name:'',salaryMode:'hour',salary:0,salaryDay:0,salaryHour:0};
    const _obSubName=document.getElementById('obSubJobName')?.value.trim()||'';
    const _obSubSalVal=parseFloat(document.getElementById('obSubJobSalary')?.value)||0;
    userData.subJob.name=_obSubName;
    const _obSubMode=userData.subJob.salaryMode||'hour';
    if(_obSubMode==='hour') userData.subJob.salaryHour=_obSubSalVal;
    else if(_obSubMode==='day') userData.subJob.salaryDay=_obSubSalVal;
    else userData.subJob.salary=_obSubSalVal;
  }else if(obPage===3){
    userData.shifts=setupShifts;userData.hoursPerShift=setupHours;
    // workDays đã được cập nhật trực tiếp bởi toggleWorkDay()
    if(!userData.workDays || userData.workDays.length===0) userData.workDays=[0,1,2,3,4];
  }else if(obPage===4){
    // Lưu cài đặt nghỉ giữa giờ từ bước 4
    userData.hasBreak     = (typeof _obBreak !== 'undefined') ? _obBreak === 1 : false;
    userData.breakMinutes = userData.hasBreak ? (_obBreakMin || 60) : 0;
    // Lưu số tuần một vòng từ ô đã chọn
    const wkSel = document.querySelector('#ob4WeekGrid .week-btn.sel');
    if(wkSel){
      const idx = Array.from(wkSel.parentElement.children).indexOf(wkSel);
      userData.weeksPerCycle = idx + 1;
    }
    // Lưu tuần này đang làm ca nào (chỉ có ý nghĩa khi >=2 ca)
    userData.currentShift = setupShifts >= 2 ? (_obCurShift || 1) : 1;
    // ═══ LƯU GIỜ VÀO/RA CỦA TỪNG CA ═══
    const shiftTimes = [];
    for(let i = 0; i < setupShifts; i++){
      const inEl = document.getElementById('sIn'+i);
      const outEl = document.getElementById('sOut'+i);
      shiftTimes.push({
        in:  inEl  ? inEl.value  : '08:00',
        out: outEl ? outEl.value : '17:00'
      });
    }
    userData.shiftTimes = shiftTimes;
    saveUser();
    goScreen('screenHome');
    initHome();
    applyI18n();
    setTimeout(moSplash, 600);
    return;
  }
  obPage=Math.min(4,obPage+1);
  renderOB();
}
/** Quay lại trang trước trong Onboarding */
function obBack(){
  if(obPage===1)return;
  obPage=Math.max(1,obPage-1);
  renderOB();
}
/** Bỏ qua Onboarding, dùng tên mặc định và vào thẳng Trang chủ */
function skipOB(){
  userData.name=u('user.default_name');userData.job=u('user.default_job');
  saveUser();goScreen('screenHome');initHome();
}

// ── WORK DAY PICKER ─────────────────────────────────────────────────
const _WD_LABELS = {
  vi:['T2','T3','T4','T5','T6','T7','CN'],
  en:['Mo','Tu','We','Th','Fr','Sa','Su'],
  ko:['월','화','수','목','금','토','일'],
  ja:['月','火','水','木','金','土','日'],
  zh:['一','二','三','四','五','六','日'],
  my:['တ','အ','ဗ','ကြ','သ','စ','တ'],
  th:['จ','อ','พ','พฤ','ศ','ส','อา'],
  id:['Sn','Sl','Rb','Km','Jm','Sb','Mg'],
  ph:['Lu','Ma','Mi','Hu','Bi','Sa','Li'],
  ne:['सो','मं','बु','बि','शु','श','आ'],
  hi:['सो','मं','बु','गु','शु','श','र']
};
function _wdLabels(){ return _WD_LABELS[userData.lang||'vi']||_WD_LABELS.vi; }
function _wdLabelsOb(lang){ return _WD_LABELS[lang||'vi']||_WD_LABELS.vi; }

function renderWorkDayPicker(containerId, days, lang){
  const el = document.getElementById(containerId);
  if(!el) return;
  const labels = lang ? _wdLabelsOb(lang) : _wdLabels();
  const sel = days || userData.workDays || [0,1,2,3,4];
  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:5px">'
    + labels.map((lb,i) =>
        `<div class="num-btn${sel.includes(i)?' sel':''}" style="padding:8px 2px;font-size:13px"
          onclick="toggleWorkDay(${i},this,'${containerId}')">${lb}</div>`
      ).join('')
    + '</div>';
}

function toggleWorkDay(idx, el, containerId){
  if(!userData.workDays) userData.workDays = [0,1,2,3,4];
  const i = userData.workDays.indexOf(idx);
  if(i === -1) userData.workDays.push(idx);
  else userData.workDays.splice(i,1);
  userData.workDays.sort((a,b)=>a-b);
  el.classList.toggle('sel');
}
// ────────────────────────────────────────────────────────────────────

/** Chọn số ca (1-4) */
/** Chọn số ca (1-4) — đồng thời hiện/ẩn ô "Tuần này làm ca nào" trong Setup */
function selShift(n,el){
  setupShifts=n;
  selNumBtn(el);
  // Re-render ô "Tuần này làm ca nào" trong panel Setup
  if(typeof renderSetupCurShift === 'function') renderSetupCurShift();
  // Re-render shift cards (giờ vào/ra cho từng ca) trong panel Setup
  if(typeof renderSetupShiftCards === 'function') renderSetupShiftCards();
  // Re-render rotation pattern khi đổi số ca
  if(typeof renderShiftRotationSection === 'function') renderShiftRotationSection();
}

/* ═══════════════════════════════════════════════════════════════════════════════
   HELPERS XOAY CA — Label ca + Rotation pattern tự động chuyển ca theo tuần
   ═══════════════════════════════════════════════════════════════════════════════
   Data model mới (backward-compatible):
   - userData.shiftLabels:          ['Ngày', 'Chiều', 'Đêm']  (mảng, index = ca - 1)
   - userData.shiftRotationEnabled: true → tự đổi ca theo tuần dựa shiftRotation
   - userData.shiftRotation:        [1, 3, 2] = tuần 1 dùng ca 1, tuần 2 dùng ca 3, tuần 3 dùng ca 2
   - userData.rotationStartDate:    timestamp ms — tuần khởi đầu chu kỳ (default: thứ Hai gần nhất)

   Nếu rotation tắt → trả userData.currentShift (legacy behavior)
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Gợi ý label tự động theo giờ vào ca (Sáng/Chiều/Đêm/Hành chính) */
function _suggestShiftLabel(inHm){
  const L = (userData && userData.lang) || 'vi';
  const dict = {
    morning:   {vi:'Ca sáng',  en:'Morning',  ko:'오전',     ja:'朝勤',  zh:'早班', my:'မနက်ဆင်း',  th:'กะเช้า',     id:'Pagi',     ph:'Umaga',     ne:'बिहान',     hi:'सुबह'},
    afternoon: {vi:'Ca chiều', en:'Afternoon',ko:'오후',     ja:'昼勤',  zh:'午班', my:'နေ့ဆင်း',     th:'กะบ่าย',     id:'Siang',    ph:'Tanghali',  ne:'दिउँसो',    hi:'दोपहर'},
    night:     {vi:'Ca đêm',   en:'Night',    ko:'야간',     ja:'夜勤',  zh:'夜班', my:'ညဆင်း',       th:'กะกลางคืน',  id:'Malam',    ph:'Gabi',      ne:'रात',       hi:'रात'},
    office:    {vi:'Hành chính',en:'Office',  ko:'사무직',   ja:'事務',  zh:'行政', my:'ရုံးချိန်',    th:'เวลาทำการ',  id:'Kantor',   ph:'Opisina',   ne:'कार्यालय',  hi:'कार्यालय'}
  };
  const m = String(inHm||'').match(/^(\d{1,2}):/);
  const h = m ? Number(m[1]) : 8;
  // Phân loại theo giờ vào ca:
  //  4-10h  → Ca sáng/ngày
  //  10-15h → Hành chính
  //  15-20h → Ca chiều
  //  20-3h  → Ca đêm
  if(h >= 4 && h < 10)  return (dict.morning[L]   || dict.morning.vi);
  if(h >= 10 && h < 15) return (dict.office[L]    || dict.office.vi);
  if(h >= 15 && h < 20) return (dict.afternoon[L] || dict.afternoon.vi);
  return (dict.night[L] || dict.night.vi);
}

/** Trả về label đã lưu của ca thứ idx (1-based). Nếu chưa có label → gợi ý theo giờ */
function getShiftLabel(idx1Based){
  const i = Math.max(1, Number(idx1Based)||1) - 1;
  const labels = (userData && Array.isArray(userData.shiftLabels)) ? userData.shiftLabels : [];
  if(labels[i] && String(labels[i]).trim()) return String(labels[i]).trim();
  const times = (userData && userData.shiftTimes) || [];
  return _suggestShiftLabel(times[i] && times[i].in);
}

/** Lấy thứ Hai (00:00) của tuần chứa timestamp `ts` (ms) — chuẩn hoá mốc rotation về đầu tuần */
function _mondayOfWeek(ts){
  const d = new Date(ts);
  d.setHours(0,0,0,0);
  // getDay(): 0=CN, 1=T2 ... 6=T7 → đẩy về T2
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.getTime();
}

/**
 * Tính ca hiệu lực hiện tại (1-based).
 *   - Rotation tắt → trả userData.currentShift (legacy)
 *   - Rotation bật → dựa số tuần đã trôi qua kể từ rotationStartDate
 *     và dãy shiftRotation [1,3,2] để chọn ca cho tuần hiện tại.
 * Hàm được expose qua window để checkin.js và capacitor-integration.js dùng chung.
 */
function getEffectiveCurrentShift(){
  if(!userData) return 1;
  const shifts = Math.max(1, Number(userData.shifts) || 1);
  const manual = Math.max(1, Math.min(shifts, Number(userData.currentShift) || 1));
  if(!userData.shiftRotationEnabled) return manual;
  const seq = Array.isArray(userData.shiftRotation) ? userData.shiftRotation.filter(n => Number.isFinite(Number(n))) : [];
  if(!seq.length) return manual;
  const startTs = Number(userData.rotationStartDate) || _mondayOfWeek(Date.now());
  const nowMonday = _mondayOfWeek(Date.now());
  const weeksSince = Math.max(0, Math.round((nowMonday - _mondayOfWeek(startTs)) / (7*24*3600*1000)));
  const idx = ((weeksSince % seq.length) + seq.length) % seq.length;
  const rotShift = Number(seq[idx]) || 1;
  return Math.max(1, Math.min(shifts, rotShift));
}
window.getEffectiveCurrentShift = getEffectiveCurrentShift;
window.getShiftLabel = getShiftLabel;

/** ═══ Render Shift Cards (giờ vào / hết ca) trong panel Setup ═══
 *  Mỗi card có:
 *    - Drag handle ⋮⋮ (đầu card) — kéo thả để đổi thứ tự ca
 *    - Input label tên ca (Ngày/Chiều/Đêm/...) — tự gợi ý theo giờ vào
 *    - Input giờ vào / giờ ra (như cũ)
 */
function renderSetupShiftCards(){
  const container = document.getElementById('setupShiftCards');
  if(!container) return;

  const shifts = setupShifts || userData.shifts || 1;
  const defaultTimes = [
    {in:'06:00', out:'14:00'},
    {in:'14:00', out:'22:00'},
    {in:'22:00', out:'06:00'},
    {in:'00:00', out:'08:00'}
  ];
  const savedTimes = userData.shiftTimes || [];
  const savedLabels = (userData && Array.isArray(userData.shiftLabels)) ? userData.shiftLabels : [];
  const L = userData.lang || 'vi';
  const tr = (TRAN && TRAN[L]) || {};
  const shiftLbl = {vi:'Ca',en:'Shift',ko:'교대',ja:'シフト',zh:'班',my:'ဆင်း',th:'กะ',id:'Shift',ph:'Shift',ne:'सिफ्ट',hi:'शिफ्ट'}[L] || 'Ca';
  const inLbl  = tr.dpInTime  || 'Vào ca';
  const outLbl = tr.dpOutTime || 'Hết ca';
  const labelPlaceholder = {vi:'Tên ca (vd: Sáng, Chiều, Đêm)',en:'Shift name (e.g., Morning, Evening, Night)',ko:'교대 이름',ja:'シフト名',zh:'班次名称',my:'အလုပ်အမည်',th:'ชื่อกะ',id:'Nama shift',ph:'Pangalan ng shift',ne:'सिफ्टको नाम',hi:'शिफ्ट का नाम'}[L] || 'Tên ca';
  const dragHint = {vi:'Kéo để đổi thứ tự',en:'Drag to reorder',ko:'끌어서 순서 변경',ja:'ドラッグで並べ替え',zh:'拖动重新排序',my:'ဆွဲ၍ ပြန်စီရန်',th:'ลากเพื่อจัดเรียง',id:'Tarik untuk ubah urutan',ph:'I-drag para baguhin ang ayos',ne:'क्रम परिवर्तन गर्न तान्नुहोस्',hi:'क्रम बदलने के लिए खींचें'}[L] || 'Kéo để đổi thứ tự';

  let html = '';
  for(let i = 0; i < shifts; i++){
    const ti = savedTimes[i] || defaultTimes[i] || {in:'08:00', out:'17:00'};
    const labelVal = (savedLabels[i] && String(savedLabels[i]).trim()) ? String(savedLabels[i]).trim() : '';
    const labelSuggestion = _suggestShiftLabel(ti.in);
    html += `
      <div class="shift-card" draggable="true"
           data-shift-idx="${i}"
           ondragstart="onShiftDragStart(event, ${i})"
           ondragover="onShiftDragOver(event)"
           ondragleave="onShiftDragLeave(event)"
           ondrop="onShiftDrop(event, ${i})"
           ondragend="onShiftDragEnd(event)"
           style="cursor:move">
        <div class="shift-card-head" style="display:flex;align-items:center;gap:8px">
          <span class="shift-drag-handle" title="${dragHint}" style="font-size:18px;color:#9aa3b2;cursor:grab;user-select:none;line-height:1">⋮⋮</span>
          <div class="shift-label" style="flex:0 0 auto">${shiftLbl} ${i+1}</div>
          <input type="text" class="shift-name-inp" id="setupSLabel${i}"
                 value="${labelVal.replace(/"/g,'&quot;')}"
                 placeholder="${labelSuggestion}"
                 oninput="onSetupShiftLabelChange()"
                 style="flex:1;min-width:0;border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;font-size:13px;font-weight:600;font-family:Nunito,sans-serif;color:var(--text);background:white;outline:none">
        </div>
        <div class="time-row">
          <div><div class="field-label">${inLbl}</div><input class="time-inp" id="setupSIn${i}" type="time" value="${ti.in}" onchange="onSetupShiftTimeChange()"></div>
          <div class="time-sep">→</div>
          <div><div class="field-label">${outLbl}</div><input class="time-inp" id="setupSOut${i}" type="time" value="${ti.out}" onchange="onSetupShiftTimeChange()"></div>
        </div>
      </div>`;
  }
  container.innerHTML = html;
}

/** Cập nhật userData.shiftLabels khi user gõ tên ca */
function onSetupShiftLabelChange(){
  const shifts = setupShifts || userData.shifts || 1;
  const labels = [];
  for(let i = 0; i < shifts; i++){
    const el = document.getElementById('setupSLabel'+i);
    labels.push(el ? String(el.value || '').trim() : '');
  }
  userData.shiftLabels = labels;
  saveUser();
}
window.onSetupShiftLabelChange = onSetupShiftLabelChange;

/* ═══════════════════════════════════════════════════════════════════════════════
   DRAG-DROP SHIFT CARDS — kéo thả để đổi thứ tự ca
   Đồng thời swap shiftTimes + shiftLabels + cập nhật currentShift để giữ
   "ca thực tế user đang làm" (vd: đang làm ca số 3, kéo ca 3 lên đầu → currentShift=1)
   ═══════════════════════════════════════════════════════════════════════════════ */
var _shiftDragSrcIdx = -1;

function onShiftDragStart(e, idx){
  _shiftDragSrcIdx = idx;
  if(e.dataTransfer){
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch(err){}
  }
  // Mờ card đang kéo
  if(e.currentTarget && e.currentTarget.style) e.currentTarget.style.opacity = '0.4';
}

function onShiftDragOver(e){
  e.preventDefault();
  if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  // Viền card target để user thấy drop zone
  if(e.currentTarget && e.currentTarget.style){
    e.currentTarget.style.outline = '2px dashed var(--ac)';
    e.currentTarget.style.outlineOffset = '-2px';
  }
  return false;
}

function onShiftDragLeave(e){
  if(e.currentTarget && e.currentTarget.style){
    e.currentTarget.style.outline = '';
    e.currentTarget.style.outlineOffset = '';
  }
}

function onShiftDrop(e, dstIdx){
  e.preventDefault();
  if(e.stopPropagation) e.stopPropagation();
  if(e.currentTarget && e.currentTarget.style){
    e.currentTarget.style.outline = '';
    e.currentTarget.style.outlineOffset = '';
  }
  const src = _shiftDragSrcIdx;
  _shiftDragSrcIdx = -1;
  if(src < 0 || src === dstIdx) return false;
  const shifts = setupShifts || userData.shifts || 1;
  if(src >= shifts || dstIdx >= shifts) return false;

  // Đọc state hiện tại từ DOM (vì user có thể đã sửa label/time mà chưa save)
  const times = [];
  const labels = [];
  for(let i = 0; i < shifts; i++){
    const inEl  = document.getElementById('setupSIn'+i);
    const outEl = document.getElementById('setupSOut'+i);
    const lbEl  = document.getElementById('setupSLabel'+i);
    times.push({ in: inEl?inEl.value:'08:00', out: outEl?outEl.value:'17:00' });
    labels.push(lbEl ? String(lbEl.value||'').trim() : '');
  }
  // Move src → dstIdx (insertion semantics)
  const movedTime = times.splice(src, 1)[0];
  const movedLabel = labels.splice(src, 1)[0];
  times.splice(dstIdx, 0, movedTime);
  labels.splice(dstIdx, 0, movedLabel);

  // Cập nhật currentShift để giữ "ca thực tế" mà user đang làm
  let cur = Number(userData.currentShift) || 1;
  cur = cur - 1; // → 0-based
  if(cur === src) cur = dstIdx;
  else if(src < cur && dstIdx >= cur) cur -= 1;
  else if(src > cur && dstIdx <= cur) cur += 1;
  cur = Math.max(0, Math.min(shifts - 1, cur)) + 1; // → 1-based

  // Cập nhật shiftRotation nếu có (map các index cũ → mới)
  let rotation = Array.isArray(userData.shiftRotation) ? userData.shiftRotation.slice() : null;
  if(rotation){
    const mapOldToNew = function(old1){
      let o = (Number(old1) || 1) - 1;  // → 0-based
      if(o === src) return dstIdx + 1;
      if(src < o && dstIdx >= o) return o; // shift xuống
      if(src > o && dstIdx <= o) return o + 2;
      return o + 1;
    };
    rotation = rotation.map(mapOldToNew);
    userData.shiftRotation = rotation;
  }

  userData.shiftTimes = times;
  userData.shiftLabels = labels;
  userData.currentShift = cur;
  setupCurShift = cur;
  saveUser();
  renderSetupShiftCards();
  if(typeof renderSetupCurShift === 'function') renderSetupCurShift();
  if(typeof renderShiftRotationSection === 'function') renderShiftRotationSection();
  if(typeof updateClock === 'function') updateClock();
  if(typeof renderHomeStats === 'function') renderHomeStats();
  if(typeof window.rescheduleNativeNotifications === 'function') window.rescheduleNativeNotifications();
  if(typeof gpsSyncNativeNow === 'function') gpsSyncNativeNow();
  return false;
}

function onShiftDragEnd(e){
  if(e.currentTarget && e.currentTarget.style) e.currentTarget.style.opacity = '';
  // Xoá outline ở mọi card phòng trường hợp dragleave không bắn
  document.querySelectorAll('.shift-card').forEach(function(c){
    c.style.outline = '';
    c.style.outlineOffset = '';
  });
}
window.onShiftDragStart = onShiftDragStart;
window.onShiftDragOver  = onShiftDragOver;
window.onShiftDragLeave = onShiftDragLeave;
window.onShiftDrop      = onShiftDrop;
window.onShiftDragEnd   = onShiftDragEnd;

/* ═══════════════════════════════════════════════════════════════════════════════
   ROTATION PATTERN — UI và logic xoay ca tự động theo tuần
   User định nghĩa shiftRotation = [1, 3, 2] có nghĩa:
     tuần 1 (của chu kỳ) → làm ca số 1
     tuần 2 (của chu kỳ) → làm ca số 3
     tuần 3 (của chu kỳ) → làm ca số 2
   App tự tính ca hiện tại dựa số tuần đã trôi qua kể từ rotationStartDate.
   ═══════════════════════════════════════════════════════════════════════════════ */

/** Render section "Lịch xoay ca tự động" trong panel Setup */
function renderShiftRotationSection(){
  const block = document.getElementById('setupRotationBlock');
  if(!block) return;
  const shifts = setupShifts || userData.shifts || 1;
  if(shifts < 2){ block.style.display = 'none'; return; }
  block.style.display = '';

  const L = (userData && userData.lang) || 'vi';
  const enabled = !!userData.shiftRotationEnabled;
  // Số tuần 1 chu kỳ — dùng chung weeksPerCycle nếu có, default = số ca
  const cycleWeeks = Math.max(1, Math.min(8, Number(userData.weeksPerCycle) || shifts));
  // Đảm bảo shiftRotation đúng length: [1,2,3,...,shifts] truncate/pad tới cycleWeeks
  let rotation = Array.isArray(userData.shiftRotation) ? userData.shiftRotation.slice() : [];
  while(rotation.length < cycleWeeks) rotation.push(((rotation.length) % shifts) + 1);
  if(rotation.length > cycleWeeks) rotation = rotation.slice(0, cycleWeeks);
  rotation = rotation.map(n => Math.max(1, Math.min(shifts, Number(n) || 1)));

  const titleTxt = {vi:'🔄 Lịch xoay ca tự động',en:'🔄 Auto shift rotation',ko:'🔄 자동 교대 순환',ja:'🔄 自動シフトローテーション',zh:'🔄 自动轮班',my:'🔄 အလိုအလျောက် ဆင်းအလှည့်',th:'🔄 หมุนกะอัตโนมัติ',id:'🔄 Rotasi shift otomatis',ph:'🔄 Auto shift rotation',ne:'🔄 स्वतः सिफ्ट परिवर्तन',hi:'🔄 स्वतः शिफ्ट रोटेशन'}[L] || '🔄 Lịch xoay ca tự động';
  const hintTxt  = {vi:'App tự đổi ca theo lịch tuần. Tắt nếu muốn chọn ca thủ công.',en:'App auto-switches shift every week. Turn off to choose manually.',ko:'매주 자동으로 교대를 변경합니다. 수동 선택을 원하면 끄세요.',ja:'毎週シフトを自動切替。手動選択はオフに。',zh:'每周自动切换班次。手动选择请关闭。',my:'အပတ်တိုင်း အလိုအလျောက် ဆင်းပြောင်းသည်။',th:'แอปเปลี่ยนกะอัตโนมัติทุกสัปดาห์',id:'Aplikasi otomatis ganti shift tiap minggu',ph:'Awtomatikong magpapalit ng shift kada linggo',ne:'हरेक हप्ता सिफ्ट स्वतः परिवर्तन हुन्छ',hi:'हर सप्ताह शिफ्ट स्वतः बदलेगी'}[L] || '';
  const weekLbl  = {vi:'Tuần',en:'Week',ko:'주',ja:'週',zh:'第',my:'အပတ်',th:'สัปดาห์',id:'Minggu',ph:'Linggo',ne:'हप्ता',hi:'सप्ताह'}[L] || 'Tuần';
  const shiftLbl = {vi:'Ca',en:'Shift',ko:'교대',ja:'シフト',zh:'班',my:'ဆင်း',th:'กะ',id:'Shift',ph:'Shift',ne:'सिफ्ट',hi:'शिफ्ट'}[L] || 'Ca';
  const currentTxt = {vi:'Tuần này → Ca',en:'This week → Shift',ko:'이번 주 → 교대',ja:'今週 → シフト',zh:'本周 → 班次',my:'ဒီအပတ် → ဆင်း',th:'สัปดาห์นี้ → กะ',id:'Minggu ini → Shift',ph:'Ngayong linggo → Shift',ne:'यो हप्ता → सिफ्ट',hi:'इस सप्ताह → शिफ्ट'}[L] || 'Tuần này → Ca';

  // Render grid: mỗi row = 1 tuần, có dropdown chọn ca
  let weeksHtml = '';
  for(let w = 0; w < cycleWeeks; w++){
    let opts = '';
    for(let s = 1; s <= shifts; s++){
      const lbl = getShiftLabel(s);
      const sel = (rotation[w] === s) ? ' selected' : '';
      opts += `<option value="${s}"${sel}>${shiftLbl} ${s} — ${lbl}</option>`;
    }
    weeksHtml += `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="flex:0 0 70px;font-size:13px;font-weight:700;color:var(--text2)">${weekLbl} ${w+1}</span>
        <select onchange="onRotationWeekChange(${w}, this.value)"
                ${enabled?'':'disabled'}
                style="flex:1;border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;font-weight:600;font-family:Nunito,sans-serif;color:var(--text);background:white;outline:none;${enabled?'':'opacity:.5'}">${opts}</select>
      </div>`;
  }

  // Hiển thị ca hiệu lực hôm nay (preview)
  const effShift = getEffectiveCurrentShift();
  const effLabel = getShiftLabel(effShift);

  block.innerHTML = `
    <div style="background:#F4FBFF;border-radius:12px;padding:12px;border:1px solid #C7DBF8">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:13px;font-weight:800;color:#1F4F8F">${titleTxt}</div>
        <button class="toggle-sw${enabled?' on':''}" onclick="onToggleShiftRotation(this)"></button>
      </div>
      <div style="font-size:11px;color:var(--text3);line-height:1.4;margin-bottom:10px">${hintTxt}</div>
      ${enabled ? `<div style="background:white;border-radius:8px;padding:8px 10px;margin-bottom:10px;font-size:12px;font-weight:700;color:#0D6E3F">${currentTxt} ${effShift} — ${effLabel}</div>` : ''}
      ${weeksHtml}
    </div>`;
}
window.renderShiftRotationSection = renderShiftRotationSection;

/** Bật/tắt rotation tự động */
function onToggleShiftRotation(btn){
  const next = !userData.shiftRotationEnabled;
  userData.shiftRotationEnabled = next;
  if(next){
    // Lần đầu bật: đặt mốc rotation = đầu tuần này
    if(!userData.rotationStartDate) userData.rotationStartDate = _mondayOfWeek(Date.now());
    // Khởi tạo shiftRotation mặc định = thứ tự tăng dần [1,2,3,...]
    const shifts = setupShifts || userData.shifts || 1;
    const cycleWeeks = Math.max(1, Math.min(8, Number(userData.weeksPerCycle) || shifts));
    if(!Array.isArray(userData.shiftRotation) || !userData.shiftRotation.length){
      const seq = [];
      for(let i = 0; i < cycleWeeks; i++) seq.push((i % shifts) + 1);
      userData.shiftRotation = seq;
    }
  }
  saveUser();
  renderShiftRotationSection();
  // Đồng bộ currentShift hiển thị + native
  if(typeof renderSetupCurShift === 'function') renderSetupCurShift();
  if(typeof updateClock === 'function') updateClock();
  if(typeof window.rescheduleNativeNotifications === 'function') window.rescheduleNativeNotifications();
  if(typeof gpsSyncNativeNow === 'function') gpsSyncNativeNow();
}
window.onToggleShiftRotation = onToggleShiftRotation;

/** User chọn ca cho tuần thứ w (0-based) trong chu kỳ */
function onRotationWeekChange(w, val){
  const shifts = setupShifts || userData.shifts || 1;
  const cycleWeeks = Math.max(1, Math.min(8, Number(userData.weeksPerCycle) || shifts));
  let rotation = Array.isArray(userData.shiftRotation) ? userData.shiftRotation.slice() : [];
  while(rotation.length < cycleWeeks) rotation.push(((rotation.length) % shifts) + 1);
  rotation[w] = Math.max(1, Math.min(shifts, Number(val) || 1));
  userData.shiftRotation = rotation.slice(0, cycleWeeks);
  saveUser();
  renderShiftRotationSection();
  if(typeof updateClock === 'function') updateClock();
  if(typeof window.rescheduleNativeNotifications === 'function') window.rescheduleNativeNotifications();
  if(typeof gpsSyncNativeNow === 'function') gpsSyncNativeNow();
}
window.onRotationWeekChange = onRotationWeekChange;

/** Cập nhật userData.shiftTimes khi user đổi giờ vào/ra trong panel Setup */
function onSetupShiftTimeChange(){
  const shifts = setupShifts || userData.shifts || 1;
  const shiftTimes = [];
  for(let i = 0; i < shifts; i++){
    const inEl  = document.getElementById('setupSIn'+i);
    const outEl = document.getElementById('setupSOut'+i);
    shiftTimes.push({
      in:  inEl  ? inEl.value  : '08:00',
      out: outEl ? outEl.value : '17:00'
    });
  }
  userData.shifts = shifts;
  if(!userData.currentShift || userData.currentShift > shifts){
    userData.currentShift = 1;
    setupCurShift = 1;
  }
  userData.shiftTimes = shiftTimes;
  saveUser();
  updateClock();
  if(typeof renderHomeStats === 'function') renderHomeStats();
  // Re-schedule native notifications khi shift times thay đổi
  if(typeof window.rescheduleNativeNotifications === 'function'){
    window.rescheduleNativeNotifications();
  }
  if(typeof gpsSyncNativeNow === 'function') gpsSyncNativeNow();
}

/** Người dùng chọn tuần này làm ca nào (trong panel Setup) */
let setupCurShift = 1;
function selCurShift(n, el){
  setupCurShift = n;
  userData.currentShift = n;
  selNumBtn(el);
  saveUser();
  updateClock();
  // Re-schedule notifications vì giờ vào/ra ca có thể đổi
  if(typeof window.rescheduleNativeNotifications === 'function'){
    window.rescheduleNativeNotifications();
  }
  if(typeof gpsSyncNativeNow === 'function') gpsSyncNativeNow();
}

/** Render ô "Tuần này làm ca nào" trong panel Setup theo số ca đã chọn */
function renderSetupCurShift(){
  const block = document.getElementById('setupCurShiftBlock');
  const grid  = document.getElementById('setupCurShiftGrid');
  if(!block || !grid) return;
  if(setupShifts < 2){
    block.style.display = 'none';
    return;
  }
  block.style.display = '';
  // Layout: 2 nút thì 2 cột, 3 nút thì 3 cột, 4 nút thì 4 cột
  grid.style.gridTemplateColumns = `repeat(${setupShifts},1fr)`;
  const L = userData.lang || 'vi';
  const shiftLbl = {vi:'Ca',en:'Shift',ko:'교대',ja:'シフト',zh:'班',my:'ဆင်း',th:'กะ',id:'Shift',ph:'Shift',ne:'सिफ्ट',hi:'शिफ्ट'}[L] || 'Ca';
  let btns = '';
  for(let i = 1; i <= setupShifts; i++){
    btns += `<div class="num-btn${i===setupCurShift?' sel':''}" onclick="selCurShift(${i},this)">${shiftLbl} ${i}</div>`;
  }
  grid.innerHTML = btns;
}

/** Chọn số giờ mỗi ca */
function selHours(h,el){
  setupHours=h;
  userData.hoursPerShift=h;
  selNumBtn(el);
  // Cập nhật cả 2 input custom (onboarding + settings)
  const customInput = document.getElementById('ob3HoursCustom');
  if(customInput) customInput.value = h;
  const setupInput = document.getElementById('setupHoursCustom');
  if(setupInput) setupInput.value = h;
  // Lưu nếu đang ở panel Setup (sửa từ Settings)
  const setupPanel = document.getElementById('panelSetup');
  if(setupPanel && setupPanel.classList.contains('open')){
    saveUser();
    if(typeof renderHomeStats === 'function') renderHomeStats();
  }
}

/** Nhập số giờ tùy chỉnh (vd: 8.5, 9, 11 giờ...) */
function selHoursCustom(val){
  const h = parseFloat(val);
  if(isNaN(h) || h <= 0 || h > 24) return;
  setupHours = h;
  userData.hoursPerShift = h;
  // Bỏ chọn các nút preset nếu giá trị custom không khớp
  const grid = document.getElementById('ob3HoursGrid');
  if(grid){
    const presets = [6, 7, 8, 10, 12];
    grid.querySelectorAll('.num-btn').forEach((btn, idx) => {
      if(presets[idx] === h) btn.classList.add('sel');
      else btn.classList.remove('sel');
    });
  }
}

/** Nhập giờ tùy chỉnh ở panel Cài đặt (Settings) */
function selHoursCustomSetup(val){
  const h = parseFloat(val);
  if(isNaN(h) || h <= 0 || h > 24) return;
  setupHours = h;
  userData.hoursPerShift = h;
  saveUser();
  // Bỏ chọn nút preset nếu không khớp
  const grid = document.getElementById('setupHoursGrid');
  if(grid){
    const presets = [6, 7, 8, 10, 12];
    grid.querySelectorAll('.num-btn').forEach((btn, idx) => {
      if(presets[idx] === h) btn.classList.add('sel');
      else btn.classList.remove('sel');
    });
  }
  // Cập nhật stats nếu home đang mở
  if(typeof renderHomeStats === 'function') renderHomeStats();
}

/* ===== Onboarding step 4: nghỉ giữa giờ ===== */
let _obBreak = 0;       // 0 = không, 1 = có
let _obBreakMin = 60;   // số phút nghỉ mặc định
let _obCurShift = 1;    // tuần này đang làm ca số mấy (1-based, mặc định Ca 1)

/** Người dùng chọn Có/Không có nghỉ giữa giờ trong onboarding */
function ob_setBreak(v, el){
  _obBreak = v;
  document.querySelectorAll('#obBreakGrid .num-btn').forEach(b => b.classList.remove('sel'));
  if(el) el.classList.add('sel');
  const blk = document.getElementById('obBreakMinBlock');
  if(blk) blk.style.display = v === 1 ? '' : 'none';
}

/** Người dùng chọn số phút nghỉ trong onboarding */
function ob_setBreakMin(min, el){
  _obBreakMin = min;
  document.querySelectorAll('#obBreakMinGrid .num-btn').forEach(b => b.classList.remove('sel'));
  if(el) el.classList.add('sel');
}

/** Người dùng chọn tuần này đang làm ca số mấy (cho ca xoay) */
function ob_setCurShift(n, el){
  _obCurShift = n;
  document.querySelectorAll('#obCurShiftGrid .num-btn').forEach(b => b.classList.remove('sel'));
  if(el) el.classList.add('sel');
}

/** Bật/tắt job phụ trong onboarding (dùng IDs riêng obTogSubJob/obSubJobFields) */
function ob_toggleSubJob(){
  if(!userData.subJob) userData.subJob={active:false,name:'',salaryMode:'hour',salary:0,salaryDay:0,salaryHour:0};
  const isOn=!userData.subJob.active;
  userData.subJob.active=isOn;
  const tog=document.getElementById('obTogSubJob');
  const knob=document.getElementById('obTogSubKnob');
  const fields=document.getElementById('obSubJobFields');
  if(tog) tog.style.background=isOn?'#7B5EA7':'#ccc';
  if(knob) knob.style.left=isOn?'23px':'3px';
  if(fields) fields.style.display=isOn?'block':'none';
}

/** Chọn chế độ tính lương job phụ trong onboarding */
function ob_selSubMode(mode){
  if(!userData.subJob) userData.subJob={active:false,name:'',salaryMode:'hour',salary:0,salaryDay:0,salaryHour:0};
  userData.subJob.salaryMode=mode;
  ['hour','day','month'].forEach(m=>{
    const btn=document.getElementById('obSubMode'+m.charAt(0).toUpperCase()+m.slice(1));
    if(!btn) return;
    const active=m===mode;
    btn.style.background=active?'#7B5EA7':'white';
    btn.style.color=active?'white':'#7B5EA7';
    btn.style.borderColor=active?'#7B5EA7':'#c8b4f0';
  });
  const hint=document.getElementById('obSubSalaryHint');
  const L=obLang||userData.lang||'vi';
  const hints={
    hour:{vi:'Nhập lương theo giờ — tự tính theo số giờ làm thực tế',en:'Enter hourly rate — auto calculated from actual hours',ko:'시간급 입력 — 실제 근무시간 기준 자동 계산',ja:'時給を入力 — 実働時間で自動計算',zh:'输入时薪 — 按实际工时自动计算',my:'နာရီလစာ — အမှန်တကယ်နာရီအလိုက် တွက်ချက်',th:'ใส่ค่าจ้างต่อชั่วโมง — คำนวณตามชั่วโมงจริง',id:'Masukkan tarif per jam — dihitung dari jam aktual',ph:'Ilagay ang hourly rate — awtomatikong kokompyutin',ne:'घण्टाको दर राख्नुहोस् — वास्तविक घण्टाबाट गणना',hi:'प्रति घंटा दर डालें — वास्तविक घंटों से गणना'},
    day: {vi:'Nhập lương theo ngày công thực tế',en:'Enter daily rate',ko:'실제 근무일 기준 일급 입력',ja:'実勤務日数に基づく日給を入力',zh:'输入实际工作日的日薪',my:'အမှန်တကယ်အလုပ်ရက်အလိုက် နေ့စားလစာ ထည့်ပါ',th:'ใส่ค่าจ้างรายวันตามวันทำงานจริง',id:'Masukkan upah harian berdasarkan hari kerja aktual',ph:'Ilagay ang daily rate batay sa araw na nagtrabaho',ne:'वास्तविक काम दिन अनुसार दैनिक दर राख्नुहोस्',hi:'वास्तविक कार्य दिवस के अनुसार दैनिक दर डालें'},
    month:{vi:'Nhập lương tháng cố định cho job này',en:'Enter fixed monthly salary for this job',ko:'이 작업의 고정 월급 입력',ja:'この仕事の固定月給を入力',zh:'输入此工作的固定月薪',my:'ဤအလုပ်အတွက် လစဉ်လစာ ထည့်ပါ',th:'ใส่เงินเดือนคงที่ของงานนี้',id:'Masukkan gaji bulanan tetap untuk pekerjaan ini',ph:'Ilagay ang fixed monthly salary ng trabahong ito',ne:'यो कामको स्थिर मासिक तलब राख्नुहोस्',hi:'इस नौकरी का निश्चित मासिक वेतन डालें'},
  };
  if(hint) hint.textContent=(hints[mode]||hints.hour)[L]||(hints[mode]||hints.hour).en||'';
}

/** Render section "Lịch xoay ca tự động" trong bước 4 onboarding */
function ob_renderRotation(){
  const block=document.getElementById('ob4RotationBlock');
  if(!block) return;
  const shifts=setupShifts||userData.shifts||1;
  if(shifts<2){block.style.display='none';return;}
  const L=obLang||userData.lang||'vi';
  const enabled=!!userData.shiftRotationEnabled;
  const cycleWeeks=Math.max(1,Math.min(8,Number(userData.weeksPerCycle)||shifts));
  let rotation=Array.isArray(userData.shiftRotation)?userData.shiftRotation.slice():[];
  while(rotation.length<cycleWeeks) rotation.push((rotation.length%shifts)+1);
  if(rotation.length>cycleWeeks) rotation=rotation.slice(0,cycleWeeks);
  rotation=rotation.map(n=>Math.max(1,Math.min(shifts,Number(n)||1)));
  const titleTxt={vi:'🔄 Lịch xoay ca tự động',en:'🔄 Auto shift rotation',ko:'🔄 자동 교대 순환',ja:'🔄 自動シフトローテーション',zh:'🔄 自动轮班',my:'🔄 အလိုအလျောက် ဆင်းအလှည့်',th:'🔄 หมุนกะอัตโนมัติ',id:'🔄 Rotasi shift otomatis',ph:'🔄 Auto shift rotation',ne:'🔄 स्वतः सिफ्ट परिवर्तन',hi:'🔄 स्वतः शिफ्ट रोटेशन'}[L]||'🔄 Lịch xoay ca tự động';
  const hintTxt={vi:'App tự đổi ca theo lịch tuần. Tắt nếu muốn chọn ca thủ công.',en:'App auto-switches shift every week. Turn off to choose manually.',ko:'매주 자동으로 교대를 변경합니다.',ja:'毎週シフトを自動切替。手動選択はオフに。',zh:'每周自动切换班次。手动选择请关闭。',my:'အပတ်တိုင်း အလိုအလျောက် ဆင်းပြောင်းသည်။',th:'แอปเปลี่ยนกะอัตโนมัติทุกสัปดาห์',id:'Aplikasi otomatis ganti shift tiap minggu',ph:'Awtomatikong magpapalit ng shift kada linggo',ne:'हरेक हप्ता सिफ्ट स्वतः परिवर्तन हुन्छ',hi:'हर सप्ताह शिफ्ट स्वतः बदलेगी'}[L]||'';
  const weekLbl={vi:'Tuần',en:'Week',ko:'주',ja:'週',zh:'第',my:'အပတ်',th:'สัปดาห์',id:'Minggu',ph:'Linggo',ne:'हप्ता',hi:'सप्ताह'}[L]||'Tuần';
  const shiftLbl={vi:'Ca',en:'Shift',ko:'교대',ja:'シフト',zh:'班',my:'ဆင်း',th:'กะ',id:'Shift',ph:'Shift',ne:'सिफ्ट',hi:'शिफ्ट'}[L]||'Ca';
  let weeksHtml='';
  for(let w=0;w<cycleWeeks;w++){
    let opts='';
    for(let s=1;s<=shifts;s++){
      const lbl=getShiftLabel(s);
      const sel=(rotation[w]===s)?' selected':'';
      opts+=`<option value="${s}"${sel}>${shiftLbl} ${s} — ${lbl}</option>`;
    }
    weeksHtml+=`
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="flex:0 0 70px;font-size:13px;font-weight:700;color:var(--text2)">${weekLbl} ${w+1}</span>
        <select onchange="ob_rotationWeekChange(${w},this.value)" ${enabled?'':'disabled'}
                style="flex:1;border:1.5px solid var(--border);border-radius:8px;padding:8px 10px;font-size:13px;font-weight:600;font-family:Nunito,sans-serif;color:var(--text);background:white;outline:none;${enabled?'':'opacity:.5'}">${opts}</select>
      </div>`;
  }
  block.innerHTML=`
    <div style="background:#F4FBFF;border-radius:12px;padding:12px;border:1px solid #C7DBF8">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:13px;font-weight:800;color:#1F4F8F">${titleTxt}</div>
        <button class="toggle-sw${enabled?' on':''}" onclick="ob_toggleRotation(this)"></button>
      </div>
      <div style="font-size:11px;color:var(--text3);line-height:1.4;margin-bottom:10px">${hintTxt}</div>
      ${weeksHtml}
    </div>`;
}

/** Bật/tắt lịch xoay ca trong onboarding */
function ob_toggleRotation(btn){
  userData.shiftRotationEnabled=!userData.shiftRotationEnabled;
  saveUser();
  ob_renderRotation();
}

/** User đổi ca cho 1 tuần trong lịch xoay (onboarding) */
function ob_rotationWeekChange(weekIdx,shiftNum){
  if(!userData.shiftRotation) userData.shiftRotation=[];
  const n=Math.max(1,Math.min(userData.shifts||setupShifts||1,Number(shiftNum)));
  userData.shiftRotation[weekIdx]=n;
  const cycleWeeks=Math.max(1,userData.weeksPerCycle||(userData.shifts||setupShifts||1));
  userData.shiftRotation=userData.shiftRotation.slice(0,cycleWeeks);
  saveUser();
}

/** Chọn số tuần một vòng (cho ca xoay) */
let setupWeeks = 1;
function selWeeks(n,el){
  setupWeeks=n;
  userData.weeksPerCycle=n;
  selNumBtn(el);
  saveUser();
  // Re-render rotation section vì số tuần chu kỳ vừa đổi
  if(typeof renderShiftRotationSection === 'function') renderShiftRotationSection();
}

/** Có nghỉ giữa giờ hay không (0 = không, 1 = có) */
let setupHasBreak = 0;
function selBreak(v,el){
  setupHasBreak = v;
  userData.hasBreak = v === 1;
  selNumBtn(el);
  const blk = document.getElementById('breakMinutesBlock');
  if(blk) blk.style.display = v === 1 ? '' : 'none';
  if(v === 0) userData.breakMinutes = 0;
  saveUser();
}

/** Số phút nghỉ giữa giờ — sẽ trừ vào giờ làm thực tế khi tính lương/giờ */
let setupBreakMin = 60;
function selBreakMin(min,el){
  setupBreakMin = min;
  userData.breakMinutes = min;
  selNumBtn(el);
  saveUser();
}

/** Chọn ngày công chuẩn tháng */
function selNgc(n,el){ngcVal=n;userData.ngc=n;selNumBtn(el);}

/* ===== ĐIỀU HƯỚNG MÀN HÌNH CHÍNH ===== */
/** Chuyển màn hình chính (home/cal/settings). Ẩn tất cả rồi hiện màn cần */
function goScreen(id){
  const target = document.getElementById(id);
  if(!target)return;
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  target.classList.add('active');
  if(id==='screenHome')renderHomeStats();
  if(id==='screenCal'){renderCalBig();setTimeout(applyCalBg,50);}
}

function getActiveScreenId(){
  const active = document.querySelector('.screen.active');
  return active ? active.id : '';
}

function closeTopOverlayOrPanel(){
  const openPanels = Array.from(document.querySelectorAll('.panel-overlay.open'));
  if(openPanels.length){
    openPanels[openPanels.length - 1].classList.remove('open');
    return true;
  }
  return false;
}

function appBackHome(ev){
  if(ev){
    ev.preventDefault();
    ev.stopPropagation();
  }
  if(closeTopOverlayOrPanel())return false;
  if(getActiveScreenId() !== 'screenHome')goScreen('screenHome');
  return false;
}

function appHandleAndroidBack(){
  if(closeTopOverlayOrPanel())return 'handled';
  const active = getActiveScreenId();
  if(active && active !== 'screenHome'){
    goScreen('screenHome');
    return 'handled';
  }
  return 'exit';
}

window.appBackHome = appBackHome;
window.appHandleAndroidBack = appHandleAndroidBack;

/* ===== QUẢN LÝ PANEL (sheet trượt lên từ dưới) ===== */
/** Mở panel trượt lên từ dưới. Init nội dung panel trước khi hiện */
function openPanel(id){
  document.getElementById(id).classList.add('open');
  if(id==='panelAppearance'){renderColorGrid();renderGradientGrid();updateBgPreview();syncAppearancePickers();}
  if(id==='panelHelp'){renderHelpPanel();}
  if(id==='panelSalary'){
    _salaryPeriod='month';
    setSalaryPeriod('month',document.getElementById('pbMonth'));
    renderHoursTable();
    _syncSalaryModeButtons();
    const inp = document.getElementById('salaryInput');
    if(inp){
      const m = userData.salaryMode || 'month';
      const savedVal = m === 'month' ? (userData.salary||0)
                     : m === 'day'   ? (userData.salaryDay||0)
                     :                  (userData.salaryHour||0);
      // Hiển thị giá trị đã lưu (nếu có), không để trống gây nhầm placeholder
      inp.value = savedVal > 0 ? savedVal : '';
    }
    calcSalary();
    if(typeof renderSubJobSalary==='function') renderSubJobSalary();
  }
  if(id==='panelNotif'){renderNotifHistory();}
  if(id==='panelExcel'){renderExcelPreview();if(typeof updateExcelPanel==='function')updateExcelPanel();}
  if(id==='panelLang'){
    renderLangGrid('settingsLangGrid',userData.lang,selLangSetting);
  }
  if(id==='panelCountry'){
    renderCountryGrid('settingsCountryGrid',userData.country,selCountrySetting);
  }
  if(id==='panelSetup'){
    if(typeof renderSetupSubJob==='function') renderSetupSubJob();
    document.getElementById('setupName').value=userData.name||'';
    document.getElementById('setupJob').value=userData.job||'';
    document.getElementById('setupCo').value=userData.company||'';
    // Đồng bộ Số ca làm việc
    setupShifts = userData.shifts || 1;
    document.querySelectorAll('#setupShiftGrid .num-btn').forEach((b,i)=>{
      b.classList.toggle('sel', (i+1) === setupShifts);
    });
    // ═══ Render Shift Cards (giờ vào/ra) ═══
    if(typeof renderSetupShiftCards === 'function') renderSetupShiftCards();
    // Đồng bộ Tuần này làm ca nào
    setupCurShift = userData.currentShift || 1;
    renderSetupCurShift();
    // ═══ Đồng bộ Số giờ / ca (preset + custom input) ═══
    setupHours = userData.hoursPerShift || 8;
    const hoursGrid = document.getElementById('setupHoursGrid');
    if(hoursGrid){
      const presets = [6, 7, 8, 10, 12];
      hoursGrid.querySelectorAll('.num-btn').forEach((btn, idx) => {
        btn.classList.toggle('sel', presets[idx] === setupHours);
      });
    }
    const setupHoursInput = document.getElementById('setupHoursCustom');
    if(setupHoursInput) setupHoursInput.value = setupHours;
    // Đồng bộ label theo ngôn ngữ
    const lblCustom = document.getElementById('setupHoursCustomLbl');
    const lblUnit   = document.getElementById('setupHoursCustomUnit');
    const tr = (TRAN && TRAN[userData.lang||'vi']) || {};
    if(lblCustom) lblCustom.textContent = '⚙️ ' + (tr.obHoursCustom || 'Hoặc nhập:');
    if(lblUnit)   lblUnit.textContent   = tr.obHoursUnit || 'giờ/ca';
    // Đồng bộ label "Giờ vào & hết ca" theo ngôn ngữ
    const lblShiftTimes = document.getElementById('setupLblShiftTimes');
    if(lblShiftTimes){
      const L = userData.lang || 'vi';
      const shiftTimesLbl = {
        vi:'⏰ Giờ vào & hết ca', en:'⏰ Shift start & end times', ko:'⏰ 출퇴근 시간',
        ja:'⏰ シフトの始業・終業時間', zh:'⏰ 上下班时间', my:'⏰ ဆင်းချိန်',
        th:'⏰ เวลาเข้า-ออกกะ', id:'⏰ Jam masuk-keluar', ph:'⏰ Oras pasok-labas',
        ne:'⏰ शिफ्टको समय', hi:'⏰ शिफ्ट समय'
      }[L] || '⏰ Giờ vào & hết ca';
      lblShiftTimes.textContent = shiftTimesLbl;
    }
    // Render work day picker
    renderWorkDayPicker('setupWorkDayPicker', userData.workDays || [0,1,2,3,4]);
    // Đồng bộ nút Số tuần một vòng
    setupWeeks = userData.weeksPerCycle || 1;
    document.querySelectorAll('#setupWeeksGrid .num-btn').forEach((b,i)=>{
      b.classList.toggle('sel', (i+1) === setupWeeks);
    });
    // Render section "Lịch xoay ca tự động" (chỉ hiện khi >=2 ca)
    if(typeof renderShiftRotationSection === 'function') renderShiftRotationSection();
    // Đồng bộ nút Có/Không nghỉ giữa giờ
    setupHasBreak = userData.hasBreak ? 1 : 0;
    const brNo = document.getElementById('brBtnNo');
    const brYes = document.getElementById('brBtnYes');
    if(brNo)  brNo.classList.toggle('sel',  setupHasBreak === 0);
    if(brYes) brYes.classList.toggle('sel', setupHasBreak === 1);
    document.getElementById('breakMinutesBlock').style.display = setupHasBreak === 1 ? '' : 'none';
    // Đồng bộ nút số phút nghỉ
    setupBreakMin = userData.breakMinutes || 60;
    const brMins = [30,60,75,90,120];
    document.querySelectorAll('#setupBreakMinGrid .num-btn').forEach((b,i)=>{
      b.classList.toggle('sel', brMins[i] === setupBreakMin);
    });
  }
}

function getEntertainmentGameUrl(){
  const lang = (typeof userData !== 'undefined' && userData.lang) ? userData.lang : 'vi';
  return 'mini_game_zone_playable_test/index.html?lang=' + encodeURIComponent(lang);
}

function syncEntertainmentGameFrame(forceReload){
  const frame = document.getElementById('miniGameFrame');
  if(!frame) return;
  const nextSrc = getEntertainmentGameUrl();
  if(forceReload || frame.getAttribute('src') !== nextSrc){
    frame.setAttribute('src', nextSrc);
  }
}

/** Mở khu trò chơi giải trí trong panel tiện ích cũ. */
function openEntertainmentGames(){
  syncEntertainmentGameFrame(false);
  openPanel('panelUtil');
}

function syncRelaxSoundFrame(forceReload){
  const frame = document.getElementById('relaxSoundFrame');
  if(!frame) return;
  const lang = (typeof userData !== 'undefined' && userData.lang) ? userData.lang : 'vi';
  const baseSrc = frame.dataset.src || 'chamcongpro_sleep_sound.html';
  const join = baseSrc.includes('?') ? '&' : '?';
  const nextSrc = baseSrc + join + 'lang=' + encodeURIComponent(lang);
  if(forceReload || frame.getAttribute('src') !== nextSrc){
    frame.setAttribute('src', nextSrc);
  }
}

function openRelaxSounds(){
  syncRelaxSoundFrame(false);
  openPanel('panelRelax');
}

/** Đóng panel */
function closePanel(id){
  document.getElementById(id).classList.remove('open');
}
document.querySelectorAll('.panel-overlay').forEach(p=>{
  p.addEventListener('click',e=>{if(e.target===p)p.classList.remove('open');});
});

/** Đồng bộ giá trị các slider GPS theo _gpsData.
 *  QUAN TRỌNG: Re-load từ localStorage để chắc chắn không dùng stale reference */
function syncGpsSliders(){
  // Force re-load _gpsData từ localStorage để chắc chắn giá trị mới nhất
  if(typeof loadGpsData === 'function'){
    loadGpsData();
  }
  // Lấy giá trị đã save (fallback về mặc định nếu chưa có)
  const radius     = (_gpsData && typeof _gpsData.radius     === 'number' && _gpsData.radius     > 0) ? _gpsData.radius     : 15;
  const checkinMin = (_gpsData && typeof _gpsData.checkinMin === 'number' && _gpsData.checkinMin > 0) ? _gpsData.checkinMin : 5;
  const checkoutMin= (_gpsData && typeof _gpsData.checkoutMin=== 'number' && _gpsData.checkoutMin> 0) ? _gpsData.checkoutMin: 75;
  const tightCompanyGps = !!(_gpsData && _gpsData.tightCompanyGps);

  const r = document.getElementById('gpsRadius');
  const rv = document.getElementById('gpsRadiusVal');
  if(r && rv){ r.value = radius; rv.textContent = radius + 'm'; }

  const ci = document.getElementById('gpsCheckinDelay');
  const civ = document.getElementById('gpsCheckinDelayVal');
  if(ci && civ){ ci.value = checkinMin; civ.textContent = checkinMin + 'p'; }

  const co = document.getElementById('gpsCheckoutDelay');
  const cov = document.getElementById('gpsCheckoutDelayVal');
  if(co && cov){ co.value = checkoutMin; cov.textContent = checkoutMin + 'p'; }

  const tightBtn = document.getElementById('togGpsTightCompany');
  if(tightBtn){ tightBtn.className = 'toggle-sw' + (tightCompanyGps ? ' on' : ''); }

  // Đảm bảo _gpsData cũng có giá trị đúng (đề phòng đã bị reset đâu đó)
  _gpsData.radius      = radius;
  _gpsData.checkinMin  = checkinMin;
  _gpsData.checkoutMin = checkoutMin;
  _gpsData.tightCompanyGps = tightCompanyGps;
}

/** Mở panel GPS — dùng panelNotif (nơi đặt UI cấu hình GPS), tự mở rộng card GPS */
function openPanelGPS(){
  openPanel('panelGPS');
  setTimeout(()=>{
    const card = document.getElementById('gpsSetupCard');
    if(card && _gpsData.enabled) card.style.display = 'block';
    syncGpsSliders();
  }, 80);
}

/** Mở panel Thuế & Bảo hiểm — render nội dung theo quốc gia làm việc hiện tại */
function openPanelTax(){
  renderTaxPanel();
  openPanel('panelTax');
}

/** Render quy định thuế & bảo hiểm theo quốc gia làm việc hiện tại */
function renderTaxPanel(){
  const c = (typeof userData!=='undefined' && userData.country) ? userData.country : 'VN';
  const rule = (typeof TAX_RULES!=='undefined' && TAX_RULES[c]) ? TAX_RULES[c] : null;
  const payroll = (typeof PAYROLL_RULES!=='undefined' && PAYROLL_RULES[c]) ? PAYROLL_RULES[c] : null;
  const box = document.getElementById('taxContent');
  if(!box) return;
  const T = getLang(); // bản dịch theo ngôn ngữ hiện tại
  if(!rule){
    box.innerHTML = '<div style="background:#F4F7F6;border-radius:14px;padding:24px;text-align:center;color:var(--text2)">N/A</div>';
    return;
  }
  const sym = rule.currency || '';
  const isAnnual = rule.period === 'annual';
  const periodLabel = isAnnual ? (T.taxPeriodAnnual||'năm (quy về tháng)') : (T.taxPeriodMonthly||'tháng');
  const perLabel    = isAnnual ? (T.taxPerYear||'năm') : (T.taxPerMonth||'tháng');
  const fmt = (n)=> n===Infinity?'∞' : n>=1e9?(n/1e9).toFixed(1)+'B' : n>=1e6?(n/1e6).toFixed(2)+'M' : n>=1e3?n.toLocaleString('en-US'):String(n);

  // 1. Bảo hiểm
  let insRows = '';
  if(rule.insurance.ssRate){
    insRows = `<div class="tx-row"><span>${T.taxSS||'Social Security'}</span><b>${(rule.insurance.ssRate*100).toFixed(2)}%</b></div>`
            + `<div class="tx-row"><span>${T.taxSsCap||'SS cap/năm'}</span><b>${sym}${fmt(rule.insurance.ssCap)}</b></div>`
            + `<div class="tx-row"><span>${T.taxMedicare||'Medicare'}</span><b>${(rule.insurance.medicareRate*100).toFixed(2)}%</b></div>`;
  } else if(rule.insurance.cap){
    insRows = `<div class="tx-row"><span>${T.taxInsRate||'Tỷ lệ đóng'}</span><b>${(rule.insurance.rate*100).toFixed(2)}%</b></div>`
            + `<div class="tx-row"><span>${T.taxInsCap||'Trần lương/tháng'}</span><b>${sym}${fmt(rule.insurance.cap)}</b></div>`
            + `<div class="tx-row"><span>${T.taxInsMax||'Đóng tối đa/tháng'}</span><b>${sym}${fmt(Math.round(rule.insurance.cap*rule.insurance.rate))}</b></div>`;
  } else {
    insRows = `<div class="tx-row"><span>${T.taxInsFlat||'Tỷ lệ phẳng'}</span><b>${(rule.insurance.rate*100).toFixed(2)}%</b></div>`;
  }
  if(rule.insNote){
    const insNoteText = (typeof rule.insNote === 'object') ? cLang(rule.insNote) : rule.insNote;
    insRows += `<div style="margin-top:8px;font-size:11px;color:var(--text3);line-height:1.5;background:white;padding:8px 10px;border-radius:8px">${insNoteText}</div>`;
  }
  const insDeductLabel = rule.insuranceDeductible===false
    ? `<span style="color:#E8433A;font-size:11px;font-weight:700">${T.taxInsDeductN||'⚠️ BH không trừ khỏi thu nhập chịu thuế'}</span>`
    : `<span style="color:#0D9E75;font-size:11px;font-weight:700">${T.taxInsDeductY||'✓ BH được trừ trước khi tính thuế'}</span>`;

  // 2. Giảm trừ
  let deductRows = `<div style="color:var(--text3);font-size:13px">—</div>`;
  if(rule.deduction){
    const dr = [];
    if(rule.deduction.personal!=null)  dr.push(`<div class="tx-row"><span>${T.taxPersonal||'Bản thân'}</span><b>${sym}${fmt(rule.deduction.personal)}/${perLabel}</b></div>`);
    if(rule.deduction.dependent!=null) dr.push(`<div class="tx-row"><span>${T.taxDependent||'Người phụ thuộc'}</span><b>${sym}${fmt(rule.deduction.dependent)}/${perLabel}</b></div>`);
    if(rule.deduction.standard!=null)  dr.push(`<div class="tx-row"><span>${T.taxStandard||'Khấu trừ cơ bản'}</span><b>${sym}${fmt(rule.deduction.standard)}/${perLabel}</b></div>`);
    if(dr.length) deductRows = dr.join('');
  }

  // 3. Bậc thuế
  const bNo   = T.taxBandNo   || 'Bậc';
  const bInc  = T.taxBandIncome || 'Thu nhập chịu thuế';
  const bRate = T.taxBandRate  || 'Thuế suất';
  const bAbove = T.taxAbove    || 'Trên';
  const bExempt = T.taxExempt  || '0% (miễn)';
  let bHtml = `<div style="display:grid;grid-template-columns:auto 1fr auto;gap:5px 10px;font-size:12px;align-items:center">
    <div style="font-weight:800;color:var(--text2);padding-bottom:4px">${bNo}</div>
    <div style="font-weight:800;color:var(--text2);padding-bottom:4px">${bInc} (${perLabel})</div>
    <div style="font-weight:800;color:var(--text2);text-align:right;padding-bottom:4px">${bRate}</div>`;
  let acc = 0;
  rule.brackets.forEach((b,i)=>{
    const [limit, rate] = b;
    let range = limit===Infinity ? `${bAbove} ${sym}${fmt(acc)}` : `${sym}${fmt(acc)} – ${sym}${fmt(acc+limit)}`;
    if(limit!==Infinity) acc+=limit;
    const rs = rate===0 ? `<span style="color:#0D9E75;font-weight:800">${bExempt}</span>` : `<b style="color:var(--ac)">${(rate*100).toFixed(0)}%</b>`;
    bHtml += `<div style="color:var(--text3)">${i+1}</div><div>${range}</div><div style="text-align:right">${rs}</div>`;
  });
  bHtml += '</div>';
  const localTaxLbl    = T.taxLocalTax    || 'Thuế địa phương';
  const residentTaxLbl = T.taxResidentTax || 'Thuế cư trú';
  if(rule.localTax)    bHtml += `<div class="tx-row" style="margin-top:8px;border-top:1px dashed var(--border);padding-top:8px"><span>${localTaxLbl}</span><b>+${(rule.localTax*100).toFixed(0)}%</b></div>`;
  if(rule.residentTax) bHtml += `<div class="tx-row" style="margin-top:8px;border-top:1px dashed var(--border);padding-top:8px"><span>${residentTaxLbl}</span><b>+${(rule.residentTax*100).toFixed(0)}%</b></div>`;

  // 4. Hệ số lương
  let payrollHtml = '';
  if(payroll && payroll.tags){
    const lang = userData.lang || 'vi';
    // tags là object {vi:[...], en:[...], ...} hoặc array cũ
    const tagsArr = Array.isArray(payroll.tags)
      ? payroll.tags
      : (payroll.tags[lang] || payroll.tags.en || payroll.tags.vi || []);
    payrollHtml = `<div style="background:#F4F7F6;border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:8px">${T.taxSecPayroll||'⏱️ HỆ SỐ LƯƠNG THEO LUẬT'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${tagsArr.map(tag=>`<span style="background:#E0F5EE;color:#0a7d5c;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px">${tag}</span>`).join('')}</div>
      ${payroll.basis ? `<div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.5">📜 ${cLang(payroll.basis)||payroll.basis}</div>` : ''}
    </div>`;
  }

  const noteText = T.taxNote || 'Số liệu tham khảo theo luật 2025.';
  const calcByTxt = `${T.taxCalcBy||'Tính theo'} ${periodLabel}`;

  box.innerHTML = `
    <style>.tx-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:5px 0;border-bottom:1px solid #f0f0f0}.tx-row:last-of-type{border-bottom:none}</style>
    <div style="background:linear-gradient(135deg,var(--ac),#0a7d5c);color:white;border-radius:14px;padding:14px 16px;margin-bottom:14px">
      <div style="font-size:20px;font-weight:900">${rule.flag||''} ${cLang(rule.name)||''}</div>
      <div style="font-size:12px;opacity:.85;margin-top:3px">${sym} · ${calcByTxt}</div>
    </div>
    <div style="background:#F4F7F6;border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:8px">${T.taxSecIns||'🛡️ BẢO HIỂM XÃ HỘI / AN SINH'}</div>
      ${insRows}
      <div style="margin-top:8px">${insDeductLabel}</div>
    </div>
    <div style="background:#F4F7F6;border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:8px">${T.taxSecDeduct||'💰 GIẢM TRỪ GIA CẢNH / MIỄN THUẾ'}</div>
      ${deductRows}
    </div>
    <div style="background:#F4F7F6;border-radius:14px;padding:14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:800;color:var(--text2);margin-bottom:8px">${T.taxSecBrackets||'📊 BIỂU THUẾ THU NHẬP CÁ NHÂN (LŨY TIẾN)'}</div>
      ${bHtml}
    </div>
    ${payrollHtml}
    <div style="background:#FFF8E8;border:1.5px solid #F5A623;border-radius:14px;padding:12px 14px;font-size:12px;color:#854F0B;line-height:1.6">
      ⚠️ <b>${T.taxNote?'':''}</b>${noteText}
    </div>
  `;
}

function selLangSetting(id){
  userData.lang=id;saveUser();syncLangCfg();
  document.getElementById('siLangSub').textContent=LANGS.find(l=>l.id===id)?.name||id;
  renderLangGrid('settingsLangGrid',id,selLangSetting);
  applyI18n();
  syncEntertainmentGameFrame(true);
  closePanel('panelLang');
}
/** Đổi quốc gia làm việc: cập nhật luật lương và tính lại ngay */
function selCountrySetting(id){
  userData.country=id;saveUser();syncLangCfg();
  document.getElementById('siCountrySub').textContent=cLang(COUNTRIES.find(c=>c.id===id)?.name)||id;
  renderCountryGrid('settingsCountryGrid',id,selCountrySetting);
  renderHomeStats();
  // Đóng panel sau khi chọn (giống selLangSetting)
  closePanel('panelCountry');
}

function saveSetup(){
  userData.name=document.getElementById('setupName').value.trim()||userData.name;
  userData.job=document.getElementById('setupJob').value.trim()||userData.job;
  userData.company=document.getElementById('setupCo').value.trim()||userData.company;
  userData.shifts = setupShifts || userData.shifts || 1;
  userData.hoursPerShift = setupHours || userData.hoursPerShift || 8;
  userData.currentShift = Math.min(setupCurShift || userData.currentShift || 1, userData.shifts);
  if(!userData.workDays || userData.workDays.length===0) userData.workDays=[0,1,2,3,4];
  // ═══ Lưu shift times từ panel Setup ═══
  if(typeof onSetupShiftTimeChange === 'function') onSetupShiftTimeChange();
  if(typeof saveSubJob==='function') saveSubJob(); // TRƯỚC saveUser!
  saveUser();initHome();
  closePanel('panelSetup');
  // Re-schedule notifications sau khi user lưu thông tin
  if(typeof window.rescheduleNativeNotifications === 'function'){
    window.rescheduleNativeNotifications();
  }
  if(typeof gpsSyncNativeNow === 'function') gpsSyncNativeNow();
}

/* ===== ĐỒNG HỒ REALTIME ===== */
const ATT_TIME_PLACEHOLDER = '__ __';

function getTodayAttendanceTimeText(){
  const now = new Date();
  const k = dateKeyFromDate(now);
  const day = attData[k] || {};
  const rec = (day.in || day.out) ? day : (day.sub || {});
  const inTime = rec.in || ATT_TIME_PLACEHOLDER;
  const outTime = rec.out || ATT_TIME_PLACEHOLDER;
  return `${inTime}-${outTime}`;
}

function updateTodayStatusTime(){
  const statusEl = document.getElementById('todayStatus');
  if(!statusEl) return;
  const now = new Date();
  const day = getAttRecordByKey(dateKeyFromDate(now)) || {};
  const rec = (day.in || day.out) ? day : (day.sub || {});
  statusEl.textContent = getTodayAttendanceTimeText();
  statusEl.className = 'status-pill ' + (rec.out ? 'out' : rec.in ? 'in' : 'none');
}

function updateClockShiftTime(){
  const oldShiftEl = document.getElementById('clockShiftTime');
  if(oldShiftEl) oldShiftEl.remove();
  updateTodayStatusTime();
}

/** Cập nhật đồng hồ realtime (gọi mỗi giây) */
function updateClock(){
  const now=new Date();
  const h=String(now.getHours()).padStart(2,'0');
  const min=String(now.getMinutes()).padStart(2,'0');
  document.getElementById('clockTime').textContent=`${h}:${min}`;
  const days=(window._DAYS&&window._DAYS.length===7)?[...window._DAYS]:['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  document.getElementById('clockDate').textContent=`${days[now.getDay()]}, ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;
  updateClockShiftTime();
  document.getElementById('clockDay').textContent=now.getDate();
  document.getElementById('clockMonth').textContent=`${MONTHS[now.getMonth()]}, ${now.getFullYear()}`;
}
setInterval(updateClock,1000);


/* --- Tiếp theo: Kiểu trả lương, Panel chi tiết, Popup chào, i18n, Init --- */

/* ===== KIỂU TRẢ LƯƠNG: Tháng / Ngày / Giờ ===== */
let _salaryMode = 'month'; // 'month' | 'day' | 'hour'

/** Đổi kiểu trả lương — cập nhật label input + ẩn/hiện ô ngày công */
function setSalaryMode(mode, el){
  _salaryMode = mode;
  userData.salaryMode = mode;
  saveUser();

  // Style nút active
  document.querySelectorAll('.salary-mode-btn').forEach(b=>{
    b.style.background='white'; b.style.color='var(--text2)'; b.style.borderColor='var(--border)';
  });
  if(el){ el.style.background='var(--ac)'; el.style.color='white'; el.style.borderColor='var(--ac)'; }

  // Đổi label input theo kiểu
  const L = userData.lang||'vi';
  const lblMap = {
    month: {vi:'Lương hợp đồng / tháng', en:'Contract salary / month', ko:'월 계약 급여',  ja:'月額契約給与', zh:'合同月薪',     my:'လစဉ်လစာ',th:'เงินเดือนต่อเดือน',id:'Gaji per bulan',ph:'Sahod bawat buwan',ne:'मासिक तलब',hi:'मासिक वेतन'},
    day:   {vi:'Lương / ngày công',       en:'Salary / day',           ko:'일 급여',        ja:'日給',         zh:'日薪',         my:'နေ့စဉ်လစာ',th:'เงินเดือนต่อวัน',id:'Gaji per hari',ph:'Sahod bawat araw',ne:'दैनिक तलब',hi:'दैनिक वेतन'},
    hour:  {vi:'Lương / giờ',             en:'Salary / hour',          ko:'시급',           ja:'時給',         zh:'时薪',         my:'နာရီလစာ',th:'เงินเดือนต่อชั่วโมง',id:'Gaji per jam',ph:'Sahod bawat oras',ne:'प्रति घण्टा तलब',hi:'प्रति घंटे वेतन'},
  };
  const phMap = {
    month: '10,000,000',
    day:   '500,000',
    hour:  '60,000',
  };
  _s('salaryContract2', (lblMap[mode][L]||lblMap[mode].vi));
  const inp = document.getElementById('salaryInput');
  if(inp){ inp.placeholder = phMap[mode]; inp.value=''; }

  // Ẩn ô "ngày công chuẩn" khi không phải month
  const daysBlock = document.getElementById('salaryDaysBlock');
  if(daysBlock) daysBlock.style.display = (mode === 'month') ? '' : 'none';

  calcSalary();
}

/** Đồng bộ nút khi mở panel theo userData.salaryMode đã lưu */
function _syncSalaryModeButtons(){
  const mode = userData.salaryMode || 'month';
  _salaryMode = mode;
  const ids = {month:'smbMonth', day:'smbDay', hour:'smbHour'};
  Object.keys(ids).forEach(m=>{
    const el = document.getElementById(ids[m]);
    if(!el) return;
    const isActive = (m === mode);
    el.style.background  = isActive ? 'var(--ac)' : 'white';
    el.style.color       = isActive ? 'white' : 'var(--text2)';
    el.style.borderColor = isActive ? 'var(--ac)' : 'var(--border)';
  });
  const daysBlock = document.getElementById('salaryDaysBlock');
  if(daysBlock) daysBlock.style.display = (mode === 'month') ? '' : 'none';
}

/** Đổi tab Bảng giờ / Bảng lương */
function switchSalaryTab(tab){
  const isHours = tab === 'hours';
  document.getElementById('tabHoursContent').style.display  = isHours ? '' : 'none';
  document.getElementById('tabSalaryContent').style.display = isHours ? 'none' : '';
  const bH = document.getElementById('tabHours');
  const bS = document.getElementById('tabSalary');
  if(bH){ bH.style.color = isHours ? 'var(--ac)' : 'var(--text3)'; bH.style.borderBottomColor = isHours ? 'var(--ac)' : 'transparent'; }
  if(bS){ bS.style.color = isHours ? 'var(--text3)' : 'var(--ac)'; bS.style.borderBottomColor = isHours ? 'transparent' : 'var(--ac)'; }
  if(!isHours){ renderHoursTable(); calcSalary(); }
  else renderHoursTable();
}

/** Chọn kỳ tính giờ */
let _salaryPeriod = 'month';
function setSalaryPeriod(p, el){
  _salaryPeriod = p;
  document.querySelectorAll('.period-btn').forEach(b=>{
    b.style.background='white'; b.style.color='var(--text2)'; b.style.borderColor='var(--border)';
  });
  if(el){ el.style.background='var(--ac)'; el.style.color='white'; el.style.borderColor='var(--ac)'; }
  renderHoursTable();
}

/** Tính toán và render bảng giờ */
function renderHoursTable(){
  const now = new Date();
  const pr = getPayrollRule();
  const shiftH = userData.hoursPerShift || 8;

  // Xác định khoảng ngày
  let days=[], label='';
  if(_salaryPeriod==='week'){
    const dow=now.getDay();
    const mon=new Date(now); mon.setDate(now.getDate()-(dow===0?6:dow-1));
    for(let i=0;i<7;i++){const d=new Date(mon);d.setDate(mon.getDate()+i);days.push(d);}
    label=`${mon.getDate()}/${mon.getMonth()+1} – ${days[6].getDate()}/${days[6].getMonth()+1}/${now.getFullYear()}`;
  } else if(_salaryPeriod==='month'){
    const y=now.getFullYear(),m=now.getMonth(),nd=new Date(y,m+1,0).getDate();
    for(let g=1;g<=nd;g++) days.push(new Date(y,m,g));
    const mn=getLang().months||['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
    label=mn[now.getMonth()]+' '+now.getFullYear();
  } else {
    const y=now.getFullYear();
    for(let m=0;m<12;m++){const nd=new Date(y,m+1,0).getDate();for(let g=1;g<=nd;g++)days.push(new Date(y,m,g));}
    label=(getLang().year||'Năm')+' '+now.getFullYear();
  }

  // Tích lũy giờ từ attData (trừ giờ nghỉ giữa giờ nếu có)
  const breakHours = (userData.hasBreak && userData.breakMinutes) ? userData.breakMinutes/60 : 0;
  let bH=0,otH=0,niH=0,hoH=0,bD=0,otD=0,niD=0,hoD=0;
  days.forEach(d=>{
    const k=dateKeyFromDate(d);
    const rec=getAttRecordByKey(k); if(!rec) return;
    let worked=shiftH;
    if(rec.in&&rec.out) worked=(typeof attendanceWorkedHours==='function'?attendanceWorkedHours(rec,k):((timeToMin(rec.out)-timeToMin(rec.in)+1440)%1440)/60);
    // Trừ thời gian nghỉ giữa giờ ra khỏi giờ làm thực tế
    worked = Math.max(0, worked - breakHours);
    const nl=gNL(d.getFullYear(),d.getMonth(),d.getDate());
    if(rec.type==='ll'||nl){hoH+=worked;hoD++;}
    else if(rec.type==='cm'){
      const basic=Math.min(worked,shiftH), ot=Math.max(0,worked-shiftH);
      bH+=basic; if(basic>0)bD++;
      otH+=ot;   if(ot>0)otD++;
      const night=(typeof attendanceNightHours==='function')?attendanceNightHours(rec,k,pr.nightStart,pr.nightEnd):0;
      if(night>0){niH+=night;niD++;}
    }
  });

  const totH=bH+otH+niH+hoH, totD=bD+otD+niD+hoD;
  const wk = _salaryPeriod==='week'?1:_salaryPeriod==='month'?4.33:52;
  const fn=v=>v>0?(Math.round(v*10)/10)+'h':'0h';
  const fd=v=>v>0?v:'0';
  const fw=v=>v>0?(Math.round(v/wk*10)/10)+'h':'0h';
  const fm=v=>{
    const mv=_salaryPeriod==='month'?v:_salaryPeriod==='week'?v*4.33:v/12;
    return mv>0?(Math.round(mv*10)/10)+'h':'0h';
  };

  // Summary cards
  _s('thTongGio',  fn(totH)); _s('thNgayCong',(bD+hoD).toString()); _s('thTangCa',fn(otH));

  // Table rows
  _s('thBasicH',fn(bH));  _s('thBasicD',fd(bD));  _s('thBasicW',fw(bH));  _s('thBasicM',fm(bH));
  _s('thOTH',   fn(otH)); _s('thOTD',   fd(otD)); _s('thOTW',   fw(otH)); _s('thOTM',   fm(otH));
  _s('thNightH',fn(niH)); _s('thNightD',fd(niD)); _s('thNightW',fw(niH)); _s('thNightM',fm(niH));
  _s('thHolH',  fn(hoH)); _s('thHolD',  fd(hoD)); _s('thHolW',  fw(hoH)); _s('thHolM',  fm(hoH));
  _s('thTotalH',fn(totH));_s('thTotalD',fd(totD));_s('thTotalW',fw(totH));_s('thTotalM',fm(totH));

  // Rate labels từ payroll rule của nước đang dùng
  _s('thRowOTRate',   '×'+pr.otFactor.toFixed(1));
  _s('thRowNightRate','+'+Math.round((pr.nightFactor-1)*100)+'%');
  _s('thRowHolRate',  '×'+pr.holidayFactor.toFixed(1));
  _s('thPeriodLabel', label);

  // Lưu cho bảng lương dùng
  window._hoursData={basicH:bH,otH,nightH:niH,holH:hoH,basicD:bD,totalD:totD};
}



function confirmReset(){
  openPanel('panelConfirmReset');
}

/** Xóa toàn bộ localStorage và reload app về trạng thái ban đầu */
function renderHelpPanel(){
  const el = document.getElementById('helpPanelBody');
  if(!el) return;
  const L = (window.userData && window.userData.lang) || 'vi';
  const guide = {
    vi:{
      title:'Hướng dẫn sử dụng',
      intro:'Ứng dụng này dùng để chấm công và ghi lại giờ làm thực tế mỗi ngày. Cuối tháng, bạn có dữ liệu để so sánh với bảng chấm công của chủ lao động hoặc công ty.',
      sections:[
        {h:'1. Thiết lập ban đầu', b:['Chọn <b>ngôn ngữ</b> và <b>quốc gia làm việc</b>.','Nhập tên, công ty, vị trí công việc, lịch làm dự kiến, số giờ mỗi ca và cách tính lương.','Nếu có việc phụ, bật <b>công việc phụ</b> rồi nhập tên việc và cách tính lương riêng.']},
        {h:'2. Chấm công hằng ngày', b:['Khi bắt đầu làm, bấm <b>Vào ca</b>. Khi kết thúc, bấm <b>Hết ca</b>.','Nếu cần sửa giờ hoặc ghi chú, vào <b>Lịch chấm công</b>, chọn ngày và chỉnh lại thông tin.','Sau khi một ngày đã có giờ vào hoặc giờ ra, hãy sửa trong lịch nếu muốn thay đổi.']},
        {h:'3. Dùng GPS tự động', b:['Mở mục <b>GPS</b>, bật chấm công tự động và chọn công việc chính hoặc công việc phụ.','Đứng tại vị trí công ty rồi bấm <b>Lấy vị trí hiện tại</b>. Vị trí này sẽ được lưu để dùng cho các lần sau.','Giữ <b>Vị trí</b> của điện thoại luôn bật khi đi làm. Nếu công ty rộng hoặc tín hiệu yếu, chỉnh bán kính trong mục GPS.','Khi đổi sang địa điểm làm việc mới, vào GPS và bấm lấy vị trí mới.']},
        {h:'4. Quyền cần bật', b:['Trong nút chuông có các nút mở nhanh: <b>quyền thông báo</b>, <b>quyền vị trí</b> và <b>cài đặt pin của ứng dụng</b>.','Với vị trí, chọn <b>Luôn cho phép</b> và bật <b>vị trí chính xác</b>.','Với pin, chọn <b>Không hạn chế</b> hoặc tắt tối ưu pin cho ứng dụng.']},
        {h:'5. Lịch, lương và xuất file', b:['Vào <b>Lịch chấm công</b> để xem từng ngày, sửa giờ, sửa trạng thái hoặc thêm ghi chú.','Vào <b>Lương</b> để xem số tiền ước tính theo dữ liệu đã ghi.','Dùng <b>Xuất Excel</b> cuối tháng để lưu dữ liệu đối chiếu.']},
        {h:'6. Dữ liệu cá nhân', b:['Dữ liệu chấm công, lương, GPS và thông tin cá nhân được lưu trên điện thoại của bạn.','Hãy xuất file định kỳ nếu bạn đổi điện thoại, xóa ứng dụng hoặc cần lưu bản đối chiếu riêng.']}
      ]
    },
    en:{
      title:'User Guide',
      intro:'This app is for clocking in/out and recording your actual work hours each day. At the end of the month, you have data to compare with your employer or company attendance records.',
      sections:[
        {h:'1. First setup', b:['Choose your <b>language</b> and <b>work country</b>.','Enter your name, company, job position, expected schedule, hours per shift, and salary method.','If you have a second job, turn on <b>Sub job</b> and enter its name and pay method.']},
        {h:'2. Daily attendance', b:['When work starts, tap <b>IN</b>. When work ends, tap <b>OUT</b>.','To change time or notes, open <b>Calendar</b>, choose the day, and edit the record.','After a day already has an IN or OUT time, use Calendar if you need to change it.']},
        {h:'3. Auto GPS', b:['Open <b>GPS</b>, turn on automatic attendance, and choose the main job or sub job.','Stand at the company location and tap <b>Get current location</b>. This location is saved for future use.','Keep phone <b>Location</b> on while working. If the workplace is large or the signal is weak, adjust the radius in GPS.','When you move to a new work location, open GPS and save the new location.']},
        {h:'4. Required permissions', b:['The bell menu has quick buttons for <b>Notification permission</b>, <b>Location permission</b>, and <b>App battery settings</b>.','For location, choose <b>Allow all the time</b> and turn on <b>Precise location</b>.','For battery, choose <b>Unrestricted</b> or turn off battery optimization for the app.']},
        {h:'5. Calendar, salary, export', b:['Use <b>Calendar</b> to review each day, edit times, change status, or add notes.','Use <b>Salary</b> to view estimated pay from your saved records.','Use <b>Export Excel</b> at month-end to save comparison data.']},
        {h:'6. Personal data', b:['Attendance, salary, GPS, and personal settings are stored on your phone.','Export regularly when changing phones, removing the app, or keeping your own comparison copy.']}
      ]
    },
    ko:{
      title:'사용 가이드',
      intro:'이 앱은 매일 실제 출퇴근 시간과 근무 시간을 기록하기 위한 앱입니다. 월말에 고용주 또는 회사의 근태 기록과 비교할 수 있는 데이터를 남길 수 있습니다.',
      sections:[
        {h:'1. 처음 설정', b:['<b>언어</b>와 <b>근무 국가</b>를 선택합니다.','이름, 회사, 직무, 예정 근무표, 한 근무의 시간, 급여 계산 방식을 입력합니다.','부업이 있으면 <b>부업</b>을 켜고 이름과 급여 방식을 입력합니다.']},
        {h:'2. 매일 출퇴근 기록', b:['근무를 시작할 때 <b>출근</b>, 끝날 때 <b>퇴근</b>을 누릅니다.','시간이나 메모를 바꾸려면 <b>달력</b>에서 날짜를 선택해 수정합니다.','이미 출근 또는 퇴근 시간이 있는 날은 달력에서 수정합니다.']},
        {h:'3. 자동 GPS 사용', b:['<b>GPS</b>를 열고 자동 출퇴근을 켠 뒤 주 업무 또는 부업을 선택합니다.','회사 위치에 서서 <b>현재 위치 가져오기</b>를 누릅니다. 이 위치는 다음에도 사용됩니다.','근무 중에는 휴대폰 <b>위치</b>를 켜 둡니다. 회사가 넓거나 신호가 약하면 GPS 화면에서 반경을 조정합니다.','근무지가 바뀌면 GPS에서 새 위치를 저장합니다.']},
        {h:'4. 필요한 권한', b:['알림 종 메뉴에서 <b>알림 권한</b>, <b>위치 권한</b>, <b>앱 배터리 설정</b>을 바로 열 수 있습니다.','위치는 <b>항상 허용</b>을 선택하고 <b>정확한 위치</b>를 켭니다.','배터리는 <b>제한 없음</b> 또는 앱 배터리 최적화 해제를 선택합니다.']},
        {h:'5. 달력, 급여, 내보내기', b:['<b>달력</b>에서 날짜별 기록, 시간, 상태, 메모를 확인하고 수정합니다.','<b>급여</b>에서 저장된 기록 기준의 예상 급여를 확인합니다.','월말에는 <b>Excel 내보내기</b>로 비교용 데이터를 저장합니다.']},
        {h:'6. 개인 데이터', b:['근태, 급여, GPS, 개인 설정은 휴대폰에 저장됩니다.','휴대폰을 바꾸거나 앱을 삭제하기 전, 또는 별도 보관이 필요할 때 정기적으로 내보내세요.']}
      ]
    },
    ja:{
      title:'使用ガイド',
      intro:'このアプリは、毎日の出退勤と実際の勤務時間を記録するためのものです。月末に、雇用主または会社の勤怠記録と比較できるデータを残せます。',
      sections:[
        {h:'1. 初期設定', b:['<b>言語</b>と<b>勤務国</b>を選びます。','名前、会社、職種、予定シフト、1シフトの時間、給与計算方法を入力します。','副業がある場合は<b>副業</b>をオンにし、名前と給与方法を入力します。']},
        {h:'2. 毎日の打刻', b:['仕事を始める時は<b>出勤</b>、終わる時は<b>退勤</b>を押します。','時間やメモを変更する場合は<b>カレンダー</b>で日付を選んで編集します。','すでに出勤または退勤時刻がある日は、カレンダーから修正します。']},
        {h:'3. 自動GPS', b:['<b>GPS</b>を開き、自動打刻をオンにして、本業または副業を選びます。','会社の場所に立って<b>現在地を取得</b>を押します。この場所は次回以降も使われます。','勤務中はスマホの<b>位置情報</b>をオンにします。職場が広い、または電波が弱い場合はGPS画面で半径を調整します。','勤務場所が変わったら、GPSで新しい場所を保存します。']},
        {h:'4. 必要な権限', b:['ベルメニューから<b>通知権限</b>、<b>位置情報権限</b>、<b>アプリのバッテリー設定</b>を開けます。','位置情報は<b>常に許可</b>を選び、<b>正確な位置情報</b>をオンにします。','バッテリーは<b>制限なし</b>、またはこのアプリの最適化をオフにします。']},
        {h:'5. カレンダー、給与、出力', b:['<b>カレンダー</b>で日別記録、時間、状態、メモを確認・編集します。','<b>給与</b>で保存済み記録から推定給与を確認します。','月末に<b>Excel出力</b>で比較用データを保存します。']},
        {h:'6. 個人データ', b:['勤怠、給与、GPS、個人設定はスマホに保存されます。','機種変更、アプリ削除、別保存が必要な時は定期的に出力してください。']}
      ]
    },
    zh:{
      title:'使用指南',
      intro:'本应用用于每天打卡并记录实际工作时间。到月底，你可以用这些数据与雇主或公司的考勤记录进行对比。',
      sections:[
        {h:'1. 初始设置', b:['选择<b>语言</b>和<b>工作国家</b>。','填写姓名、公司、职位、预计班表、每班小时数和工资计算方式。','如果有副业，开启<b>副业</b>并填写名称和工资方式。']},
        {h:'2. 每日打卡', b:['开始工作时点<b>上班</b>，结束工作时点<b>下班</b>。','需要修改时间或备注时，打开<b>日历</b>，选择日期后编辑。','当天已有上班或下班时间后，如需更改请到日历修改。']},
        {h:'3. 使用自动GPS', b:['打开<b>GPS</b>，开启自动打卡，并选择主工作或副业。','站在公司位置，点击<b>获取当前位置</b>。该位置会保存供以后使用。','工作时保持手机<b>位置</b>开启。公司范围较大或信号较弱时，在GPS页面调整半径。','更换工作地点时，到GPS保存新的位置。']},
        {h:'4. 需要开启的权限', b:['铃铛菜单中有快捷按钮：<b>通知权限</b>、<b>位置权限</b>、<b>应用电池设置</b>。','位置请选择<b>始终允许</b>，并开启<b>精确位置</b>。','电池请选择<b>不受限制</b>，或关闭本应用的电池优化。']},
        {h:'5. 日历、工资、导出', b:['在<b>日历</b>查看每天记录，修改时间、状态或备注。','在<b>工资</b>查看根据记录估算的工资。','月底使用<b>导出Excel</b>保存对比数据。']},
        {h:'6. 个人数据', b:['考勤、工资、GPS和个人设置保存在你的手机上。','换手机、删除应用或需要单独保存时，请定期导出。']}
      ]
    },
    my:{
      title:'အသုံးပြုနည်း',
      intro:'ဤအက်ပ်သည် နေ့စဉ် အလုပ်ဝင်/ထွက်ချိန်နှင့် အလုပ်လုပ်ချိန်ကို မှတ်တမ်းတင်ရန် အသုံးပြုသည်။ လကုန်တွင် သင့်အလုပ်ရှင် သို့မဟုတ် ကုမ္ပဏီ၏ အချိန်မှတ်တမ်းနှင့် နှိုင်းယှဉ်ရန် ဒေတာရှိနေမည်။',
      sections:[
        {h:'1. ပထမဆုံး စတင်သတ်မှတ်ခြင်း', b:['<b>ဘာသာစကား</b>နှင့် <b>အလုပ်လုပ်သောနိုင်ငံ</b>ကို ရွေးပါ။','အမည်၊ ကုမ္ပဏီ၊ အလုပ်ရာထူး၊ မျှော်မှန်းအလုပ်ချိန်ဇယား၊ တစ်ဆိုင်းနာရီနှင့် လစာတွက်နည်းကို ထည့်ပါ။','အပိုအလုပ်ရှိပါက <b>Sub job</b> ကိုဖွင့်ပြီး အမည်နှင့် လစာတွက်နည်းကို ထည့်ပါ။']},
        {h:'2. နေ့စဉ် အလုပ်ချိန်မှတ်ခြင်း', b:['အလုပ်စချိန် <b>IN</b> ကိုနှိပ်ပါ။ အလုပ်ပြီးချိန် <b>OUT</b> ကိုနှိပ်ပါ။','ချိန် သို့မဟုတ် မှတ်ချက် ပြင်ရန် <b>Calendar</b> တွင်နေ့ရက်ကိုရွေးပြီး ပြင်ပါ။','နေ့တစ်နေ့တွင် IN သို့မဟုတ် OUT ရှိပြီးသားဖြစ်ပါက Calendar ထဲတွင် ပြင်ပါ။']},
        {h:'3. Auto GPS အသုံးပြုခြင်း', b:['<b>GPS</b> ကိုဖွင့်ပြီး automatic attendance ကိုဖွင့်ကာ main job သို့မဟုတ် sub job ကိုရွေးပါ။','ကုမ္ပဏီနေရာတွင် ရပ်ပြီး <b>Get current location</b> ကိုနှိပ်ပါ။ ထိုနေရာကို နောက်ပိုင်းအသုံးပြုရန် သိမ်းထားမည်။','အလုပ်လုပ်နေစဉ် ဖုန်း <b>Location</b> ကိုဖွင့်ထားပါ။ နေရာကျယ်ခြင်း သို့မဟုတ် signal အားနည်းခြင်းရှိပါက GPS တွင် radius ကိုပြင်ပါ။','အလုပ်နေရာအသစ်ပြောင်းပါက GPS တွင် နေရာအသစ်ကိုသိမ်းပါ။']},
        {h:'4. လိုအပ်သော ခွင့်ပြုချက်များ', b:['bell menu တွင် <b>Notification permission</b>, <b>Location permission</b>, <b>App battery settings</b> ခလုတ်များရှိသည်။','Location အတွက် <b>Allow all the time</b> ကိုရွေးပြီး <b>Precise location</b> ကိုဖွင့်ပါ။','Battery အတွက် <b>Unrestricted</b> သို့မဟုတ် app battery optimization ပိတ်ပါ။']},
        {h:'5. Calendar, Salary, Export', b:['<b>Calendar</b> တွင် နေ့စဉ်မှတ်တမ်း၊ ချိန်၊ status၊ note ကိုကြည့်ပြီး ပြင်ပါ။','<b>Salary</b> တွင် သိမ်းထားသောဒေတာအရ ခန့်မှန်းလစာကိုကြည့်ပါ။','လကုန်တွင် <b>Export Excel</b> ဖြင့် နှိုင်းယှဉ်ဒေတာကို သိမ်းပါ။']},
        {h:'6. ကိုယ်ရေးဒေတာ', b:['Attendance, salary, GPS နှင့် personal settings များကို သင့်ဖုန်းထဲတွင် သိမ်းထားသည်။','ဖုန်းပြောင်းခြင်း၊ app ဖျက်ခြင်း သို့မဟုတ် သီးခြားသိမ်းလိုခြင်းရှိပါက ပုံမှန် export လုပ်ပါ။']}
      ]
    },
    th:{
      title:'คู่มือการใช้งาน',
      intro:'แอปนี้ใช้สำหรับลงเวลาเข้าออกงานและบันทึกชั่วโมงทำงานจริงในแต่ละวัน เมื่อถึงสิ้นเดือน คุณจะมีข้อมูลไว้เปรียบเทียบกับบันทึกเวลาของนายจ้างหรือบริษัท.',
      sections:[
        {h:'1. ตั้งค่าครั้งแรก', b:['เลือก<b>ภาษา</b>และ<b>ประเทศที่ทำงาน</b>.','กรอกชื่อ บริษัท ตำแหน่งงาน ตารางงานที่คาดไว้ ชั่วโมงต่อกะ และวิธีคำนวณเงินเดือน.','ถ้ามีงานเสริม ให้เปิด <b>Sub job</b> แล้วกรอกชื่องานและวิธีคำนวณเงิน.']},
        {h:'2. ลงเวลาประจำวัน', b:['เมื่อเริ่มงานให้แตะ <b>IN</b> เมื่อเลิกงานให้แตะ <b>OUT</b>.','ถ้าต้องแก้เวลา หรือหมายเหตุ ให้เปิด <b>Calendar</b> เลือกวันแล้วแก้ไข.','ถ้าวันนั้นมีเวลา IN หรือ OUT แล้ว ให้แก้จาก Calendar เมื่อต้องการเปลี่ยน.']},
        {h:'3. ใช้ GPS อัตโนมัติ', b:['เปิด <b>GPS</b> เปิด automatic attendance แล้วเลือกงานหลักหรืองานเสริม.','ยืนที่ตำแหน่งบริษัทแล้วแตะ <b>Get current location</b> ตำแหน่งนี้จะถูกบันทึกไว้ใช้ครั้งต่อไป.','เปิด <b>Location</b> ของโทรศัพท์ไว้ระหว่างทำงาน ถ้าพื้นที่บริษัทกว้างหรือสัญญาณอ่อน ให้ปรับ radius ในหน้า GPS.','เมื่อเปลี่ยนสถานที่ทำงาน ให้บันทึกตำแหน่งใหม่ใน GPS.']},
        {h:'4. สิทธิ์ที่ต้องเปิด', b:['ในเมนูรูประฆังมีปุ่มลัดสำหรับ <b>Notification permission</b>, <b>Location permission</b>, และ <b>App battery settings</b>.','ตำแหน่งให้เลือก <b>Allow all the time</b> และเปิด <b>Precise location</b>.','แบตเตอรี่ให้เลือก <b>Unrestricted</b> หรือปิด battery optimization สำหรับแอปนี้.']},
        {h:'5. Calendar, Salary, Export', b:['ใช้ <b>Calendar</b> เพื่อดูและแก้เวลา สถานะ หรือหมายเหตุในแต่ละวัน.','ใช้ <b>Salary</b> เพื่อดูเงินเดือนประมาณจากข้อมูลที่บันทึก.','สิ้นเดือนใช้ <b>Export Excel</b> เพื่อเก็บข้อมูลเปรียบเทียบ.']},
        {h:'6. ข้อมูลส่วนตัว', b:['ข้อมูลเวลา เงินเดือน GPS และการตั้งค่าส่วนตัวถูกบันทึกไว้ในโทรศัพท์ของคุณ.','ควร export เป็นประจำเมื่อเปลี่ยนโทรศัพท์ ลบแอป หรือต้องการเก็บสำเนาไว้เอง.']}
      ]
    },
    id:{
      title:'Panduan Penggunaan',
      intro:'Aplikasi ini digunakan untuk absen masuk/keluar dan mencatat jam kerja nyata setiap hari. Di akhir bulan, Anda punya data untuk dibandingkan dengan catatan absensi dari pemberi kerja atau perusahaan.',
      sections:[
        {h:'1. Pengaturan awal', b:['Pilih <b>bahasa</b> dan <b>negara kerja</b>.','Isi nama, perusahaan, posisi, jadwal kerja perkiraan, jam per shift, dan metode gaji.','Jika ada pekerjaan tambahan, aktifkan <b>Sub job</b> lalu isi nama dan metode gajinya.']},
        {h:'2. Absensi harian', b:['Saat mulai kerja, tekan <b>IN</b>. Saat selesai kerja, tekan <b>OUT</b>.','Untuk mengubah jam atau catatan, buka <b>Calendar</b>, pilih tanggal, lalu edit.','Jika hari tersebut sudah punya jam IN atau OUT, ubah melalui Calendar.']},
        {h:'3. GPS otomatis', b:['Buka <b>GPS</b>, aktifkan automatic attendance, lalu pilih main job atau sub job.','Berdiri di lokasi perusahaan lalu tekan <b>Get current location</b>. Lokasi ini disimpan untuk digunakan lagi.','Biarkan <b>Location</b> ponsel aktif saat bekerja. Jika area perusahaan besar atau sinyal lemah, atur radius di menu GPS.','Saat pindah lokasi kerja, simpan lokasi baru di GPS.']},
        {h:'4. Izin yang diperlukan', b:['Menu lonceng memiliki tombol cepat untuk <b>Notification permission</b>, <b>Location permission</b>, dan <b>App battery settings</b>.','Untuk lokasi, pilih <b>Allow all the time</b> dan aktifkan <b>Precise location</b>.','Untuk baterai, pilih <b>Unrestricted</b> atau matikan battery optimization untuk aplikasi ini.']},
        {h:'5. Calendar, Salary, Export', b:['Gunakan <b>Calendar</b> untuk melihat dan mengedit jam, status, atau catatan harian.','Gunakan <b>Salary</b> untuk melihat estimasi gaji dari data tersimpan.','Di akhir bulan, gunakan <b>Export Excel</b> untuk menyimpan data pembanding.']},
        {h:'6. Data pribadi', b:['Absensi, gaji, GPS, dan pengaturan pribadi disimpan di ponsel Anda.','Export secara berkala saat ganti ponsel, hapus aplikasi, atau ingin menyimpan salinan sendiri.']}
      ]
    },
    ph:{
      title:'Gabay sa Paggamit',
      intro:'Ginagamit ang app na ito para mag-clock in/out at itala ang totoong oras ng trabaho araw-araw. Sa katapusan ng buwan, may data kang maihahambing sa attendance record ng employer o kumpanya.',
      sections:[
        {h:'1. Unang setup', b:['Piliin ang <b>wika</b> at <b>bansa ng trabaho</b>.','Ilagay ang pangalan, kumpanya, posisyon, inaasahang schedule, oras bawat shift, at paraan ng sahod.','Kung may second job, i-on ang <b>Sub job</b> at ilagay ang pangalan at paraan ng bayad.']},
        {h:'2. Araw-araw na attendance', b:['Kapag magsisimula sa trabaho, tapikin ang <b>IN</b>. Kapag tapos na, tapikin ang <b>OUT</b>.','Para baguhin ang oras o notes, buksan ang <b>Calendar</b>, pumili ng araw, at i-edit.','Kung may IN o OUT na ang araw, sa Calendar ito baguhin.']},
        {h:'3. Auto GPS', b:['Buksan ang <b>GPS</b>, i-on ang automatic attendance, at piliin ang main job o sub job.','Tumayo sa lokasyon ng kumpanya at tapikin ang <b>Get current location</b>. Mase-save ito para sa mga susunod na gamit.','Panatilihing naka-on ang phone <b>Location</b> habang nagtatrabaho. Kung malaki ang lugar o mahina ang signal, ayusin ang radius sa GPS.','Kapag lumipat ng work location, mag-save ng bagong location sa GPS.']},
        {h:'4. Mga kailangang permission', b:['Sa bell menu may quick buttons para sa <b>Notification permission</b>, <b>Location permission</b>, at <b>App battery settings</b>.','Sa location, piliin ang <b>Allow all the time</b> at i-on ang <b>Precise location</b>.','Sa battery, piliin ang <b>Unrestricted</b> o i-off ang battery optimization para sa app.']},
        {h:'5. Calendar, Salary, Export', b:['Gamitin ang <b>Calendar</b> para tingnan at baguhin ang oras, status, o notes bawat araw.','Gamitin ang <b>Salary</b> para makita ang tantiyang sahod mula sa na-save na records.','Sa katapusan ng buwan, gamitin ang <b>Export Excel</b> para mag-save ng comparison data.']},
        {h:'6. Personal data', b:['Attendance, salary, GPS, at personal settings ay naka-save sa iyong phone.','Mag-export nang regular kapag magpapalit ng phone, mag-aalis ng app, o kailangan ng sariling kopya.']}
      ]
    },
    ne:{
      title:'प्रयोग मार्गदर्शिका',
      intro:'यो एप दैनिक हाजिरी लगाउन र वास्तविक काम गरेको समय रेकर्ड गर्न प्रयोग हुन्छ। महिनाको अन्त्यमा, तपाईंले रोजगारदाता वा कम्पनीको हाजिरी विवरणसँग तुलना गर्न डेटा पाउनुहुन्छ।',
      sections:[
        {h:'1. सुरुको सेटअप', b:['<b>भाषा</b> र <b>काम गर्ने देश</b> छान्नुहोस्।','नाम, कम्पनी, पद, अपेक्षित काम तालिका, प्रति सिफ्ट घण्टा र तलब गणना तरिका भर्नुहोस्।','अर्को काम छ भने <b>Sub job</b> खोल्नुहोस् र नाम तथा तलब तरिका भर्नुहोस्।']},
        {h:'2. दैनिक हाजिरी', b:['काम सुरु गर्दा <b>IN</b> थिच्नुहोस्। काम सकिँदा <b>OUT</b> थिच्नुहोस्।','समय वा नोट सच्याउन <b>Calendar</b> खोल्नुहोस्, दिन छान्नुहोस् र सम्पादन गर्नुहोस्।','दिनमा IN वा OUT समय भइसकेपछि परिवर्तन गर्न Calendar प्रयोग गर्नुहोस्।']},
        {h:'3. Auto GPS प्रयोग', b:['<b>GPS</b> खोल्नुहोस्, automatic attendance खोल्नुहोस् र main job वा sub job छान्नुहोस्।','कम्पनीको स्थानमा उभिएर <b>Get current location</b> थिच्नुहोस्। यो स्थान पछि प्रयोगका लागि सेभ हुन्छ।','काम गर्दा फोनको <b>Location</b> खुला राख्नुहोस्। कम्पनी ठूलो वा signal कमजोर भए GPS मा radius मिलाउनुहोस्।','काम गर्ने ठाउँ परिवर्तन भए GPS मा नयाँ स्थान सेभ गर्नुहोस्।']},
        {h:'4. आवश्यक अनुमति', b:['bell menu मा <b>Notification permission</b>, <b>Location permission</b>, र <b>App battery settings</b> का छिटो बटन छन्।','Location मा <b>Allow all the time</b> छान्नुहोस् र <b>Precise location</b> खोल्नुहोस्।','Battery मा <b>Unrestricted</b> छान्नुहोस् वा app battery optimization बन्द गर्नुहोस्।']},
        {h:'5. Calendar, Salary, Export', b:['<b>Calendar</b> मा दिनअनुसार समय, status वा note हेर्न र सच्याउन सकिन्छ।','<b>Salary</b> मा सेभ गरिएको रेकर्डबाट अनुमानित तलब हेर्नुहोस्।','महिनाको अन्त्यमा <b>Export Excel</b> प्रयोग गरेर तुलना गर्ने डेटा सेभ गर्नुहोस्।']},
        {h:'6. व्यक्तिगत डेटा', b:['हाजिरी, तलब, GPS र व्यक्तिगत सेटिङ तपाईंको फोनमा सेभ हुन्छ।','फोन फेर्दा, app हटाउँदा वा आफ्नै प्रतिलिपि राख्नुपर्दा नियमित export गर्नुहोस्।']}
      ]
    },
    hi:{
      title:'उपयोग गाइड',
      intro:'यह ऐप रोज़ clock in/out करने और वास्तविक काम के घंटे रिकॉर्ड करने के लिए है। महीने के अंत में आपके पास नियोक्ता या कंपनी के attendance record से तुलना करने के लिए डेटा रहेगा।',
      sections:[
        {h:'1. पहली सेटिंग', b:['<b>भाषा</b> और <b>काम का देश</b> चुनें।','नाम, कंपनी, पद, expected schedule, हर shift के घंटे और salary method भरें।','अगर दूसरा काम है, तो <b>Sub job</b> चालू करें और उसका नाम तथा pay method भरें।']},
        {h:'2. रोज़ की attendance', b:['काम शुरू करते समय <b>IN</b> दबाएँ। काम खत्म करते समय <b>OUT</b> दबाएँ।','समय या note बदलने के लिए <b>Calendar</b> खोलें, दिन चुनें और edit करें।','अगर किसी दिन IN या OUT time पहले से है, तो बदलाव Calendar से करें।']},
        {h:'3. Auto GPS इस्तेमाल', b:['<b>GPS</b> खोलें, automatic attendance चालू करें और main job या sub job चुनें।','कंपनी की जगह पर खड़े होकर <b>Get current location</b> दबाएँ। यह location आगे के लिए save रहेगी।','काम के समय phone <b>Location</b> चालू रखें। कंपनी बड़ी हो या signal कमजोर हो तो GPS में radius बदलें।','काम की जगह बदलने पर GPS में नई location save करें।']},
        {h:'4. जरूरी permissions', b:['bell menu में <b>Notification permission</b>, <b>Location permission</b>, और <b>App battery settings</b> के quick buttons हैं।','Location में <b>Allow all the time</b> चुनें और <b>Precise location</b> चालू करें।','Battery में <b>Unrestricted</b> चुनें या इस app के लिए battery optimization बंद करें।']},
        {h:'5. Calendar, Salary, Export', b:['<b>Calendar</b> में हर दिन का time, status या note देखें और edit करें।','<b>Salary</b> में saved records से estimated salary देखें।','महीने के अंत में <b>Export Excel</b> से comparison data save करें।']},
        {h:'6. Personal data', b:['Attendance, salary, GPS और personal settings आपके phone में save रहती हैं।','Phone बदलने, app हटाने या अपनी copy रखने के लिए regular export करें।']}
      ]
    }
  };
  const data = guide[L] || guide.en || guide.vi;
  const panel = document.querySelector('#panelHelp .panel-title');
  if(panel) panel.textContent = data.title;
  const sectionHtml = (sec) => `
    <div style="border-bottom:1px solid var(--border);padding:0 0 14px;margin-bottom:14px">
      <div style="font-size:15px;font-weight:900;color:var(--text);margin-bottom:7px">${sec.h}</div>
      <ul style="margin:0 0 0 18px;padding:0;font-size:13.5px;line-height:1.65;color:var(--text2)">
        ${sec.b.map(item => `<li style="margin-bottom:5px">${item}</li>`).join('')}
      </ul>
    </div>`;
  el.innerHTML = `
    <div style="font-size:13.5px;line-height:1.65;color:var(--text2);background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:14px">${data.intro}</div>
    ${data.sections.map(sectionHtml).join('')}
  `;
}

function doReset(){
  function clearLocalResetData(){
    const keys=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k && k.indexOf('cp22_')===0) keys.push(k);
    }
    keys.forEach(k=>localStorage.removeItem(k));
  }
  function finishReset(){
    clearLocalResetData();
    location.reload();
  }
  try{
    const plugin=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.ChamCongNative;
    if(plugin&&plugin.clearNativeAttendance){
      Promise.resolve(plugin.clearNativeAttendance({clearAll:true,resetState:true}))
        .then(finishReset)
        .catch(()=>finishReset());
      return;
    }
  }catch(e){}
  finishReset();
}

/* ===== PANEL CHI TIẾT TỪNG NGÀY (chọn trạng thái, nhập giờ) ===== */
const TT_CFG=[{id:'cm',ten:'Có mặt',sub:'Đi làm đúng ca',bg:'#1D9E75',svgC:'#0F6E56',bgI:'#E1F5EE',sel:'s-cm'},{id:'np',ten:'Nghỉ phép',sub:'Có hưởng lương',bg:'#EF9F27',svgC:'#633806',bgI:'#FAEEDA',sel:'s-np'},{id:'vang',ten:'Vắng mặt',sub:'Không phép — trừ lương',bg:'#E24B4A',svgC:'#791F1F',bgI:'#FCEBEB',sel:'s-vang'},{id:'ll',ten:'Làm ngày lễ',sub:'Tính 400%',bg:'#378ADD',svgC:'#0C447C',bgI:'#E6F1FB',sel:'s-ll'}];
const ICONS={cm:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M5 13l4 4L19 7"/></svg>`,np:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 12h4M17 12h4M12 3v4M12 17v4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8"/></svg>`,vang:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><path d="M18 6L6 18M6 6l12 12"/></svg>`,ll:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,dem:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 3a6 6 0 009 9 9 9 0 11-9-9z"/></svg>`};

// Map v22 attData keys to v21 format
let _dayKey='', _daySelType=null, _dayCa=null;

const TT_COLORS={cm:'#0D9E75',np:'#F5A623',vang:'#E8433A',ll:'#2D7DD2'};
const TT_BG={cm:'#E0F5EE',np:'#FFF8E8',vang:'#FFF0EF',ll:'#EEF4FF'};
const TT_ICON={cm:'✓',np:'☀',vang:'✕',ll:'★'};
const DAY_STATUS_I18N={
  vi:{cm:{n:'Có mặt',s:'Đi làm đúng ca'},np:{n:'Nghỉ phép',s:'Có hưởng lương'},vang:{n:'Vắng mặt',s:'Không phép — trừ lương'},ll:{n:'Làm ngày lễ',s:'Tính theo luật'}},
  en:{cm:{n:'Present',s:'Worked the shift'},np:{n:'Leave',s:'Paid leave'},vang:{n:'Absent',s:'Unpaid absence'},ll:{n:'Holiday work',s:'By law'}},
  ko:{cm:{n:'출근',s:'정상 출근'},np:{n:'연차',s:'유급 휴가'},vang:{n:'결근',s:'무단 결근'},ll:{n:'휴일 근무',s:'법적 기준'}},
  ja:{cm:{n:'出勤',s:'通常出勤'},np:{n:'有給',s:'有給休暇'},vang:{n:'欠勤',s:'無断欠勤'},ll:{n:'休日出勤',s:'法定'}},
  zh:{cm:{n:'出勤',s:'正常出勤'},np:{n:'请假',s:'带薪假'},vang:{n:'缺勤',s:'无故缺勤'},ll:{n:'节假日',s:'按法律'}},
  my:{cm:{n:'တက်',s:'ပုံမှန်'},np:{n:'ခွင့်',s:'လစာပါ'},vang:{n:'ပျက်',s:'ခွင့်မဲ့'},ll:{n:'ရုံးပိတ်',s:'ဥပဒေ'}},
  th:{cm:{n:'มาทำงาน',s:'ทำงานตามกะ'},np:{n:'ลาหยุด',s:'ลาโดยได้รับเงิน'},vang:{n:'ขาดงาน',s:'ขาดงานโดยไม่มีเหตุ'},ll:{n:'ทำงานวันหยุด',s:'ตามกฎหมาย'}},
  id:{cm:{n:'Hadir',s:'Masuk kerja sesuai shift'},np:{n:'Cuti',s:'Cuti berbayar'},vang:{n:'Absen',s:'Tidak masuk tanpa izin'},ll:{n:'Kerja hari libur',s:'Sesuai hukum'}},
  ph:{cm:{n:'Naroroon',s:'Nagtrabaho ng shift'},np:{n:'Leave',s:'Bayad na bakasyon'},vang:{n:'Absent',s:'Walang pahintulot'},ll:{n:'Trabaho sa holiday',s:'Ayon sa batas'}},
  ne:{cm:{n:'उपस्थित',s:'सिफ्ट अनुसार काम गरे'},np:{n:'बिदा',s:'तलबसहित बिदा'},vang:{n:'अनुपस्थित',s:'अनुमति बिना अनुपस्थित'},ll:{n:'बिदाको दिन काम',s:'कानुन अनुसार'}},
  hi:{cm:{n:'उपस्थित',s:'शिफ्ट के अनुसार काम किया'},np:{n:'छुट्टी',s:'सवेतन अवकाश'},vang:{n:'अनुपस्थित',s:'बिना अनुमति अनुपस्थित'},ll:{n:'अवकाश पर काम',s:'कानून के अनुसार'}},
};
/** Lấy object tên trạng thái ngày theo ngôn ngữ hiện tại */
function getDayStatus(){return DAY_STATUS_I18N[userData.lang||'vi']||DAY_STATUS_I18N.vi;}

/** Mở panel chi tiết ngày: hiển thị ca, trạng thái, giờ vào/ra, ghi chú */
function openDayPanel(g, y, m) {
  const k = dateKeyFromParts(y,m,g);
  _dayKey = k;
  const rec = attData[k] || {};
  _daySelType = rec.type || null;

  // Title — dùng getLang() để lấy tên thứ theo ngôn ngữ hiện tại
  const now = new Date(y,m,g);
  const _tDP = getLang();
  const dayNames = _tDP.days || ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  // Từ "ngày" dịch theo ngôn ngữ: vi=ngày, en=date, ko=일, ja=日, zh=日, my=ရက်
  const _dayWord = {vi:'ngày',en:'',ko:'',ja:'',zh:'',my:'ရက်',th:'',id:'',ph:'',ne:'',hi:''}[userData.lang||'vi']||'';
  const _titleDate = _dayWord ? `${dayNames[now.getDay()]}, ${_dayWord} ${g}/${m+1}/${y}` : `${dayNames[now.getDay()]}, ${g}/${m+1}/${y}`;
  document.getElementById('dayPanelTitle').textContent = _titleDate;
  
  // Ca info — "Ca:" dịch theo ngôn ngữ
  const _caWord = {vi:'Ca',en:'Shift',ko:'교대',ja:'シフト',zh:'班',my:'ဆင်း',th:'กะ',id:'Shift',ph:'Shift',ne:'सिफ्ट',hi:'शिफ्ट'}[userData.lang||'vi']||'Ca';
  const _caMainName = {vi:'Ca hành chính',en:'Main shift',ko:'정규 근무',ja:'通常シフト',zh:'正常班',my:'ပုံမှန်ဆင်း',th:'กะปกติ',id:'Shift normal',ph:'Regular shift',ne:'नियमित सिफ्ट',hi:'नियमित शिफ्ट'}[userData.lang||'vi']||'Ca hành chính';
  const caEl = document.getElementById('dayPanelCa');
  if(userData.shifts >= 1) {
    caEl.textContent = `${_caWord}: ${_caMainName} (08:00 – 17:00)`;
    caEl.style.display = 'block';
    _dayCa = {vao:'08:00', ra:'17:00'};
  } else {
    caEl.style.display = 'none';
    _dayCa = null;
  }

  // Time inputs
  document.getElementById('dayTimeIn').value = rec.in || '';
  // Để trống nếu chưa có out thực tế — tránh ghi nhầm giờ mặc định vào attData khi user bấm Lưu
  document.getElementById('dayTimeOut').value = rec.out || '';
  
  // Note
  document.getElementById('dayNote').value = rec.note || '';
  if(typeof updateDayJobTypeUI==='function') updateDayJobTypeUI(rec);
  
  // Status grid
  renderDayStatusGrid();
  
  // Show panel
  document.getElementById('panelDay').classList.add('open');
}

/** Render 4 nút chọn trạng thái ngày (Có mặt/Nghỉ phép/Vắng/Làm lễ) */
function renderDayStatusGrid() {
  const types = ['cm','np','vang','ll'];
  const grid = document.getElementById('dayStatusGrid');
  const _dst=getDayStatus();
  grid.innerHTML = types.map(id => {
    const sel = _daySelType === id;
    return `<button onclick="selectDayType('${id}')" style="border:2px solid ${sel?TT_COLORS[id]:'var(--border)'};border-radius:14px;padding:14px 8px;text-align:center;cursor:pointer;background:${sel?TT_BG[id]:'white'};transition:all .15s;font-family:Nunito,sans-serif">
      <div style="font-size:22px;width:32px;height:32px;border-radius:50%;background:${sel?TT_COLORS[id]:'#F0F0F0'};display:flex;align-items:center;justify-content:center;margin:0 auto 6px;color:${sel?'white':TT_COLORS[id]};font-weight:900">${TT_ICON[id]}</div>
      <div style="font-size:12px;font-weight:800;color:${sel?TT_COLORS[id]:'var(--text)'}">${_dst[id].n}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:2px;line-height:1.3">${_dst[id].s}</div>
    </button>`;
  }).join('');
  
  // Show time block only for cm or ll
  const showTime = _daySelType === 'cm' || _daySelType === 'll';
  document.getElementById('dayTimeBlock').style.display = showTime ? 'block' : 'none';
  dayCalcHours();
}

/** Chọn/bỏ chọn trạng thái ngày, cập nhật UI */
function selectDayType(id) {
  _daySelType = _daySelType === id ? null : id;
  renderDayStatusGrid();
}

/** Reset giờ vào/ra về mặc định của ca làm việc */
function dayResetTime() {
  if(_dayCa) {
    document.getElementById('dayTimeIn').value = _dayCa.vao;
    document.getElementById('dayTimeOut').value = _dayCa.ra;
    dayCalcHours();
  }
}

/** Tính số giờ và tăng ca khi người dùng nhập giờ vào/ra */
function dayCalcHours() {
  const inv = document.getElementById('dayTimeIn').value;
  const outv = document.getElementById('dayTimeOut').value;
  const el = document.getElementById('dayHoursSummary');
  if(inv && outv) {
    const dur = ((pGio(outv)-pGio(inv)+1440)%1440)/60;
    const gioCA = userData.hoursPerShift||8;
    const ot = Math.max(0,dur-gioCA);
    el.textContent = `Tổng: ${dur.toFixed(1)}h${ot>0?' | Tăng ca: +'+ot.toFixed(1)+'h':''}`;
    el.style.color = ot>0?'#F5A623':'var(--ac)';
  } else {
    el.textContent = '';
  }
}

function closeDayPanel() {
  document.getElementById('panelDay').classList.remove('open');
}

/** Lưu trạng thái + giờ + ghi chú cho ngày được chọn */
function saveDayPanel() {
  let manualMainOutSaved = false;
  let manualSubOutSaved = false;
  if(!_daySelType) {
    delete attData[_dayKey];
  } else {
    if(!attData[_dayKey]) attData[_dayKey] = {};
    attData[_dayKey].type = _daySelType;
    const inv = document.getElementById('dayTimeIn').value;
    const outv = document.getElementById('dayTimeOut').value;
    if((_daySelType==='cm'||_daySelType==='ll') && inv && outv) {
      if(typeof attendanceSetIn==='function')attendanceSetIn(attData[_dayKey],_dayKey,inv);
      else attData[_dayKey].in = inv;
      if(typeof attendanceSetOut==='function')attendanceSetOut(attData[_dayKey],_dayKey,outv);
      else attData[_dayKey].out = outv;
      manualMainOutSaved = true;
    } else {
      delete attData[_dayKey].in;
      delete attData[_dayKey].out;
      delete attData[_dayKey].checkInAt;
      delete attData[_dayKey].checkOutAt;
    }
    const note = document.getElementById('dayNote').value.trim();
    if(note) attData[_dayKey].note = note;
    else delete attData[_dayKey].note;
    // Save sub job data (dual job model)
    if(userData.subJob && userData.subJob.active){
      const subIn  = document.getElementById('daySubTimeIn')?.value || '';
      const subOut = document.getElementById('daySubTimeOut')?.value || '';
      const subFields = document.getElementById('daySubFields');
      const subActive = subFields && subFields.style.display !== 'none';
      if(subActive && subIn){
        attData[_dayKey].sub = { type:'cm' };
        if(typeof attendanceSetIn==='function')attendanceSetIn(attData[_dayKey].sub,_dayKey,subIn);
        else attData[_dayKey].sub.in = subIn;
        if(subOut){
          if(typeof attendanceSetOut==='function')attendanceSetOut(attData[_dayKey].sub,_dayKey,subOut);
          else attData[_dayKey].sub.out = subOut;
          manualSubOutSaved = true;
        }
      } else {
        delete attData[_dayKey].sub;
      }
    }
  }
  saveAtt();
  if((manualMainOutSaved || manualSubOutSaved) && typeof window.gpsOnManualCheckoutSaved === 'function'){
    try{
      window.gpsOnManualCheckoutSaved({
        dateKey: _dayKey,
        mainOut: manualMainOutSaved,
        subOut: manualSubOutSaved
      });
    }catch(e){}
  }
  closeDayPanel();
  renderCalBig();
  renderHomeStats();

  // ═══ GỬI NATIVE NOTIFICATION KHI CHẤM CÔNG THỦ CÔNG ═══
  if(window.ccNative && window.ccNative.sendNotification && _daySelType){
    const L = userData.lang || 'vi';
    const inv = document.getElementById('dayTimeIn')?.value || '';
    const outv = document.getElementById('dayTimeOut')?.value || '';
    if(_daySelType === 'cm' && inv){
      const titleMap = {
        vi:'📝 Đã ghi nhận chấm công', en:'📝 Attendance recorded', ko:'📝 출퇴근 기록됨',
        ja:'📝 打刻記録済み', zh:'📝 已记录考勤', th:'📝 บันทึกแล้ว',
        id:'📝 Absensi tercatat', my:'📝 မှတ်တမ်းတင်ပြီး', ph:'📝 Na-record na',
        ne:'📝 हाजिरी दर्ता भयो', hi:'📝 उपस्थिति दर्ज'
      };
      const bodyMap = {
        vi: outv ? `Vào: ${inv} — Ra: ${outv}` : `Vào ca: ${inv}`,
        en: outv ? `In: ${inv} — Out: ${outv}` : `Clock in: ${inv}`,
        ko: outv ? `출근: ${inv} — 퇴근: ${outv}` : `출근: ${inv}`,
        ja: outv ? `出勤: ${inv} — 退勤: ${outv}` : `出勤: ${inv}`,
        zh: outv ? `上班: ${inv} — 下班: ${outv}` : `上班: ${inv}`,
        hi: outv ? `प्रवेश: ${inv} — निकास: ${outv}` : `प्रवेश: ${inv}`
      };
      window.ccNative.sendNotification(
        titleMap[L] || titleMap.vi,
        bodyMap[L] || bodyMap.vi,
        1003
      );
    }
  }
}


/* ===== POPUP CHÀO BUỔI SÁNG ===== */
const TEN_THANG=['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const cauGD1=[
"Hành trình vạn dặm bắt đầu từ một bước chân nhỏ.",
"Cần cù bù thông minh — tục ngữ Việt Nam.",
"Bắt đầu là đã thành công một nửa rồi!",
"Siêng năng là cha của may mắn.",
"Chăm chỉ hôm nay, thanh thản ngày mai.",
"Đầu xuôi đuôi lọt — bắt đầu tốt, cả tháng tốt!",
"Gieo hạt hôm nay, gặt quả ngày mai.",
"Mỗi ngày đến làm là thêm một viên gạch xây tương lai.",
"Không gì khó, chỉ cần có quyết tâm từ bước đầu.",
"Mưa dầm thấm lâu — chăm chỉ ắt thành công.",
"Người siêng năng sẽ đứng trên người lười biếng.",
"Thắng không kiêu, bại không nản — ngày đầu cứ bền.",
"Tháng mới — trang mới — năng lượng mới — tiến thôi!",
"Đã bắt đầu thì phải bền, bền thì mới thắng.",
"Mỗi buổi sáng là một cơ hội mới để thay đổi cuộc đời.",
"Người không làm thì không ăn — tục ngữ.",
"Ngày hôm nay bạn làm là nền móng cho thành công tháng này!"
];
const cauGD2=[
"Công mài sắt có ngày nên kim — tục ngữ.",
"Nước chảy đá mòn — bạn đang thắng từng ngày!",
"Không có gì khó, chỉ sợ lòng không bền — Hồ Chí Minh.",
"Sự xuất sắc không phải là hành động mà là thói quen — Aristotle.",
"Tài năng không bằng sự kiên trì — Calvin Coolidge.",
"Kiên trì và nhẫn nại là hai người thầy vĩ đại nhất — Dickens.",
"Người chăm chỉ thắng người thông minh mà lười biếng.",
"Một tuần làm đầy đủ — ví đã ấm hơn rồi đấy!",
"Thất bại là mẹ thành công — nhưng bạn đang thành công rồi!",
"Ai ơi đã quyết thì hành, đã đi thì đến, đã làm thì xong.",
"Bạn đang chứng minh mình không phải người bỏ cuộc!",
"Bền gan vững chí mới thành, dao cùn mài mãi cũng sắc đi.",
"Nửa tháng rồi — tiếp tục phát huy nhé!",
"Hãy nhớ lý do bạn bắt đầu — nó vẫn còn nguyên vẹn!",
"Bạn đang xây dựng thói quen kỷ luật — thứ quý giá nhất!",
"Chí lớn ai cũng có, khó ở chỗ giữ được lâu dài.",
"Giữa chặng đường là lúc thử thách — bạn đang vượt qua tốt lắm!"
];
const cauGD3=[
"Sắp về đích rồi — bứt tốc nào!",
"Cuối tháng là lúc thành quả được quy ra tiền!",
"Người dũng cảm vẫn tiến dù mệt — Nelson Mandela.",
"Nước về biển lớn — lương về túi ta!",
"Dẻo dai mới thắng, bền chí mới nên — tục ngữ.",
"Bạn đã đi quá xa để dừng lại bây giờ!",
"Thành công là tổng những nỗ lực nhỏ mỗi ngày — R.Collier.",
"Sắp ngày lương — mồ hôi hôm nay thành nụ cười ngày mai!",
"Người làm đến cùng mới nếm hương vị của thành công.",
"Khi mệt nhất, hãy nhớ: cuối tháng là tài khoản rạng rỡ!",
"Mỗi giờ làm những ngày cuối đều đang tính thêm tiền!",
"Bạn đã chứng minh sự kiên trì suốt tháng này — tuyệt vời!",
"Vài ngày nữa thôi — đừng để nước rút mà nhụt chí!",
"Kết thúc tháng trong vinh quang, tháng sau bắt đầu mạnh hơn!",
"Tự hào về bản thân đi — bạn xứng đáng được như vậy!",
"Bạn đã làm điều tuyệt vời tháng này — hãy tự hào lên!"
];

const quotesI18N={
  en:['Hard work beats talent when talent does not work hard.','Every day is a new opportunity.','Success is the sum of small efforts repeated daily.','The secret of getting ahead is getting started.'],
  ko:['오늘도 최선을 다하세요!','작은 노력이 쌓여 큰 성과를 만듭니다.','시작이 반입니다. 잘하고 있어요!','꾸준함이 재능을 이깁니다.'],
  ja:['継続は力なり。今日も頑張りましょう！','小さな努力が大きな成果を生みます。','始めることが最初の一歩です。'],
  zh:['坚持就是胜利，今天也要加油！','积少成多，每天进步一点点。','今天的努力是明天成果的种子。'],
  my:['ကြိုးစားမှုသည်အောင်မြင်မှု၏သော့ချက်','တစ်နေ့တစ်နေ့တိုးတက်မှု','ကြိုးပမ်းသမျှ ရလဒ်ရမည်'],
  th:['ก้าวแรกคือชัยชนะครึ่งหนึ่ง!','ขยันวันนี้ สบายวันหน้า','เดินทีละก้าว สำเร็จทีละวัน','เดือนใหม่ พลังใหม่ ไปเลย!','ความสำเร็จเริ่มต้นจากวันนี้'],
  id:['Langkah pertama adalah separuh keberhasilan!','Rajin pangkal pandai!','Setiap hari adalah kesempatan baru!','Bulan baru, semangat baru, ayo!','Kerja keras hari ini, panen esok!'],
  ph:['Ang unang hakbang ay kalahati ng tagumpay!','Ang kasipagan ay ina ng kapalaran!','Bawat araw ay bagong pagkakataon!','Bagong buwan, bagong lakas, go!','Patuloy lang, magaling ka!'],
  ne:['पहिलो कदम आधा सफलता हो!','मेहनत भाग्यको आमा हो!','हरेक दिन नयाँ अवसर हो!','नयाँ महिना, नयाँ शक्ति, जाऊ!','ढिलोस्तो भए पनि नरोकिनुस्'],
  hi:['पहला कदम आधी सफलता है!','मेहनत किस्मत की माँ है!','हर दिन एक नया अवसर है!','नया महीना, नई ऊर्जा, चलो!','लगे रहो, सफलता मिलेगी!'],
};

/** Hiển thị popup chào buổi sáng với thống kê tháng và câu động viên ngẫu nhiên */
function moSplash(){
  const now=new Date();
  const y=now.getFullYear(),m=now.getMonth();
  const nd=new Date(y,m,1).getDay();
  let tCM=0;
  for(let g=1;g<=now.getDate();g++){
    const thu=(nd+g-1)%7;
    if(thu===0||thu===6)continue;
    const rec=getAttRecordByDateParts(y,m,g);
    if(rec&&(rec.type==='cm'||rec.type==='ll'))tCM++;
  }
  const isCL=false;
  const h=now.getHours();
  const L=userData.lang||'vi';
  const chaoMap={vi:h<12?'Chào buổi sáng':h<18?'Chào buổi chiều':'Chào buổi tối',en:h<12?'Good morning':h<18?'Good afternoon':'Good evening',ko:h<12?'좋은 아침이에요':h<18?'안녕하세요':'좋은 저녁이에요',ja:h<12?'おはようございます':h<18?'こんにちは':'こんばんは',zh:h<12?'早上好':h<18?'下午好':'晚上好',my:h<12?'မင်္ဂလာနံနက်ခင်း':h<18?'မင်္ဂလာနေ့ခင်း':'မင်္ဂလာညနေ',th:h<12?'สวัสดีตอนเช้า':h<18?'สวัสดีตอนบ่าย':'สวัสดีตอนเย็น',id:h<12?'Selamat pagi':h<18?'Selamat siang':'Selamat malam',ph:h<12?'Magandang umaga':h<18?'Magandang tanghali':'Magandang gabi',ne:h<12?'शुभ प्रभात':h<18?'शुभ अपरान्ह':'शुभ सन्ध्या',hi:h<12?'सुप्रभात':h<18?'शुभ दोपहर':'शुभ संध्या'};
  const chao=chaoMap[L]||chaoMap.vi;
  // dvMap → u('splash.days_present')
  // startMap → u('splash.start_btn')
  // Dùng userData.lang (ngôn ngữ đã lưu), KHÔNG dùng obLang (chỉ dành cho onboarding)
  const _mthLang = userData.lang||'vi';
  const _mths=(TRAN[_mthLang]||TRAN.vi).months||TEN_THANG;
  // Format tháng theo ngôn ngữ: zh/ja dùng "4月", ko dùng "4월", th dùng tên tháng, vi dùng "Tháng 4"
  const _mNum = m+1;
  const _mthName = _mths[m] || (
    ['zh','ja'].includes(_mthLang) ? `${_mNum}月` :
    _mthLang==='ko' ? `${_mNum}월` :
    `Tháng ${_mNum}`
  );
  const monthLbl = _mthName + ' · ' + y;
  const L2=userData.lang||'vi';
  const pool=L2!=='vi'&&quotesI18N[L2]?quotesI18N[L2]:(tCM<=7?cauGD1:tCM<=14?cauGD2:cauGD3);
  const cau=pool[Math.floor(Math.random()*pool.length)];

  // Fill splash content - with null guards
  const _s=(id,txt)=>{const el=document.getElementById(id);if(el)el.textContent=txt;};
  const _st=(id,prop,val)=>{const el=document.getElementById(id);if(el)el.style[prop]=val;};
  _s('spBadgeTxt',monthLbl);
  _s('spSo',String(tCM));
  _s('spDv',u('splash.days_present'));
  _s('spCau',chao+', '+(userData.name||'bạn')+'! '+cau);
  _s('spNut',u('splash.start_btn'));
  _st('spNut','background','var(--ac)');
  _st('spDot','background','var(--ac)');
  _st('spBadge','background','var(--ac-lt)');
  _st('spBadgeTxt','color','var(--ac2)');
  _st('spSo','color','var(--ac)');

  const p=document.getElementById('splashBox');
  p.style.animation='none';p.offsetHeight;p.style.animation='pop-in .38s cubic-bezier(.34,1.56,.64,1) both';
  document.getElementById('splashOv').className='splash-ov mo';
}

/** Đóng popup chào */
function dongSplash(){
  document.getElementById('splashOv').className='splash-ov';
}

/* ==================== FULL i18n SYSTEM ==================== */
/* ════════════════════════════════════════════════════════════════════
   UI_STR — KHO CHUỖI GIAO DIỆN TẬP TRUNG (11 ngôn ngữ)
   ════════════════════════════════════════════════════════════════════

   🔧 CÁCH SỬA NỘI DUNG:
     1. Tìm key theo section bên dưới (ví dụ: 'home.in_at')
     2. Sửa text ở ngôn ngữ bạn muốn
     3. Không được xóa ngôn ngữ khác!

   ➕ THÊM NGÔN NGỮ MỚI:
     1. Thêm entry vào LANGS[] và TRAN{}
     2. Thêm key mới vào MỌI entry trong UI_STR
     3. Dùng en: làm mẫu nếu chưa dịch kịp

   🔍 TRA CỨU NHANH — key nào điều khiển chỗ nào:
     'home.*'     → Trang chủ (nút VÀO/HẾT CA, trạng thái, giờ)
     'salary.*'   → Bảng lương (bảo hiểm, thuế, loại ngày)
     'gps.*'      → GPS panel (tiêu đề, nhãn slider, nút, tip)
     'appear.*'   → Panel Giao diện (avatar, màu, ảnh nền)
     'setup.*'    → Panel Thiết lập (tên, chức vụ, ca làm)
     'delete.*'   → Xác nhận xóa dữ liệu
     'splash.*'   → Popup chào buổi sáng

   ════════════════════════════════════════════════════════════════════ */
const UI_STR = {

  /* ── GPS v3 PANEL — Battery profile / Stats / Trail ────────────────── */
  'gpsv3.battery_title':  {vi:'🔋 Chế độ pin',                       en:'🔋 Battery mode',                ko:'🔋 배터리 모드',          ja:'🔋 バッテリーモード',           zh:'🔋 电池模式',          my:'🔋 ဘက်ထရီ',             th:'🔋 โหมดแบตเตอรี่',           id:'🔋 Mode baterai',           ph:'🔋 Battery mode',         ne:'🔋 ब्याट्री मोड',           hi:'🔋 बैटरी मोड'},
  'gps.panel_title':      {vi:'🧠 Chấm công thông minh', en:'🧠 Smart attendance', ko:'🧠 스마트 출퇴근', ja:'🧠 スマート打刻', zh:'🧠 智能打卡', my:'🧠 Smart attendance', th:'🧠 เช็คอินอัจฉริยะ', id:'🧠 Absensi pintar', ph:'🧠 Smart attendance', ne:'🧠 स्मार्ट हाजिरी', hi:'🧠 स्मार्ट उपस्थिति'},
  'gps.auto_title':       {vi:'Chấm công tự động thông minh', en:'Smart auto attendance', ko:'스마트 자동 출퇴근', ja:'スマート自動打刻', zh:'智能自动打卡', my:'အလိုအလျောက် တက်မှတ်', th:'เช็คอินอัตโนมัติอัจฉริยะ', id:'Absensi otomatis cerdas', ph:'Smart auto attendance', ne:'स्मार्ट स्वचालित हाजिरी', hi:'स्मार्ट स्वत: उपस्थिति'},
  'gps.auto_sub':         {vi:'Dùng Wi-Fi + BTS + GPS để tự động vào/ra ca', en:'Wi-Fi + BTS + GPS for auto clock-in/out', ko:'Wi-Fi + BTS + GPS로 자동 출퇴근', ja:'Wi-Fi + BTS + GPSで自動打刻', zh:'Wi-Fi + BTS + GPS 自动上下班', my:'Wi-Fi + BTS + GPS — အလိုအလျောက် တက်/ဆင်း', th:'Wi-Fi + BTS + GPS สำหรับเช็คอิน/เอาท์อัตโนมัติ', id:'Wi-Fi + BTS + GPS untuk absen otomatis', ph:'Wi-Fi + BTS + GPS para auto time in/out', ne:'Wi-Fi + BTS + GPS स्वत: इन/आउट', hi:'Wi-Fi + BTS + GPS से स्वत: प्रवेश/निकास'},
  'gps.home_title':       {vi:'🏠 Hồ sơ nhà', en:'🏠 Home Profile', ko:'🏠 집 프로필', ja:'🏠 自宅プロフィール', zh:'🏠 家庭档案', my:'🏠 အိမ် ပရိုဖိုင်', th:'🏠 โปรไฟล์บ้าน', id:'🏠 Profil Rumah', ph:'🏠 Home Profile', ne:'🏠 घर प्रोफाइल', hi:'🏠 घर प्रोफ़ाइल'},
  'gps.home_hint':        {vi:'Đứng ở nhà → bấm để lưu tín hiệu nhận diện.', en:'At home → tap to save identification signals.', ko:'집에서 → 눌러서 신호 저장', ja:'自宅で → タップして信号を保存', zh:'在家 → 点击保存识别信号', my:'အိမ်မှာ → တင်ဒေသသိမ်းရန် နှိပ်ပါ', th:'อยู่บ้าน → กดบันทึกสัญญาณ', id:'Di rumah → tekan untuk simpan sinyal', ph:'Nasa bahay → i-tap para i-save ang signal', ne:'घरमा → संकेत सेभ गर्न थिच्नुस्', hi:'घर पर → संकेत सहेजने के लिए टैप करें'},
  'gps.work_title':       {vi:'🏢 Hồ sơ công ty', en:'🏢 Work Profile', ko:'🏢 회사 프로필', ja:'🏢 職場プロフィール', zh:'🏢 公司档案', my:'🏢 ကုမ္ပဏီ ပရိုဖိုင်', th:'🏢 โปรไฟล์บริษัท', id:'🏢 Profil Kantor', ph:'🏢 Work Profile', ne:'🏢 कार्य प्रोफाइल', hi:'🏢 कंपनी प्रोफ़ाइल'},
  'gps.work_hint':        {vi:'Đứng ở công ty → bấm để lưu Wi-Fi / GPS công ty.', en:'At work → tap to save work Wi-Fi / GPS.', ko:'회사에서 → Wi-Fi/GPS 저장', ja:'職場で → Wi-Fi/GPS保存', zh:'在公司 → 保存Wi-Fi/GPS', my:'ကုမ္ပဏီမှာ → Wi-Fi/GPS သိမ်းရန် နှိပ်ပါ', th:'อยู่บริษัท → กดบันทึก Wi-Fi/GPS', id:'Di kantor → simpan Wi-Fi/GPS kantor.', ph:'Nasa work → i-save ang Wi-Fi/GPS.', ne:'कम्पनीमा → Wi-Fi/GPS सेभ गर्नुस्', hi:'कंपनी में → Wi-Fi/GPS सहेजें'},
  'gps.signal_title':     {vi:'📡 Tín hiệu hiện tại', en:'📡 Current signals', ko:'📡 현재 신호', ja:'📡 現在の信号', zh:'📡 当前信号', my:'📡 လက်ရှိ အချက်ပြ', th:'📡 สัญญาณปัจจุบัน', id:'📡 Sinyal saat ini', ph:'📡 Kasalukuyang signal', ne:'📡 हालको संकेत', hi:'📡 वर्तमान संकेत'},
  'gps.signal_refresh':   {vi:'Cập nhật', en:'Refresh', ko:'새로고침', ja:'更新', zh:'刷新', my:'ပြန်စစ်', th:'รีเฟรช', id:'Segarkan', ph:'I-refresh', ne:'ताजा', hi:'रिफ्रेश'},
  'gps.signal_waiting':   {vi:'Đang chờ tín hiệu...', en:'Waiting for signals...', ko:'신호 대기 중...', ja:'信号待機中...', zh:'等待信号...', my:'အချက်ပြ စောင့်နေ...', th:'รอสัญญาณ...', id:'Menunggu sinyal...', ph:'Naghihintay ng signal...', ne:'संकेत पर्खँदै...', hi:'संकेत प्रतीक्षा...'},
  'sa.status_starting':   {vi:'Đang khởi động...', en:'Starting...', ko:'시작 중...', ja:'起動中...', zh:'正在启动...', my:'စတင်နေသည်...', th:'กำลังเริ่มต้น...', id:'Memulai...', ph:'Nagsisimula...', ne:'सुरु हुँदैछ...', hi:'प्रारंभ हो रहा...'},
  'gpsv3.battery_normal': {vi:'Bình thường',                          en:'Normal',                          ko:'일반',                     ja:'通常',                          zh:'正常',                  my:'ပုံမှန်',                  th:'ปกติ',                       id:'Normal',                    ph:'Normal',                   ne:'सामान्य',                    hi:'सामान्य'},
  'gpsv3.battery_low':    {vi:'Tiết kiệm',                            en:'Low Power',                       ko:'절전',                     ja:'省電力',                        zh:'省电',                  my:'ပါဝါသက်သာ',             th:'ประหยัด',                    id:'Hemat',                     ph:'Tipid',                    ne:'किफायती',                    hi:'कम बिजली'},
  'gpsv3.battery_min':    {vi:'Tối thiểu',                            en:'Critical',                        ko:'최소',                     ja:'最小',                          zh:'最低',                  my:'အနိမ့်ဆုံး',              th:'ต่ำสุด',                     id:'Minimum',                   ph:'Pinakamababa',             ne:'न्यूनतम',                    hi:'न्यूनतम'},
  'gpsv3.battery_hint':   {vi:'⚡ Tự động chuyển khi pin yếu (cần Battery API)', en:'⚡ Auto-switch on low battery (Battery API)',  ko:'⚡ 배터리 부족 시 자동 전환 (Battery API 필요)', ja:'⚡ バッテリー低下時に自動切替 (Battery API)',  zh:'⚡ 电量低时自动切换 (需 Battery API)',  my:'⚡ ဘက်ထရီနည်းသည့်အခါ အလိုအလျောက် ပြောင်း',  th:'⚡ สลับอัตโนมัติเมื่อแบตอ่อน',  id:'⚡ Otomatis ganti saat baterai lemah',  ph:'⚡ Auto-switch sa mababang baterya',  ne:'⚡ ब्याट्री कम भएमा स्वत: स्विच',  hi:'⚡ कम बैटरी पर ऑटो स्विच'},
  'gpsv3.stats_title':    {vi:'📊 Trạng thái GPS',                    en:'📊 GPS Status',                   ko:'📊 GPS 상태',              ja:'📊 GPS 状態',                   zh:'📊 GPS 状态',           my:'📊 GPS အခြေအနေ',         th:'📊 สถานะ GPS',               id:'📊 Status GPS',             ph:'📊 GPS Status',            ne:'📊 GPS स्थिति',              hi:'📊 GPS स्थिति'},
  'gpsv3.refresh':        {vi:'Refresh',                              en:'Refresh',                         ko:'새로고침',                 ja:'更新',                          zh:'刷新',                  my:'ပြန်စစ်',                 th:'รีเฟรช',                     id:'Segarkan',                  ph:'I-refresh',                ne:'ताजा गर्ने',                  hi:'रिफ्रेश'},
  'gpsv3.stats_empty':    {vi:'Bấm Refresh để xem...',                 en:'Tap Refresh to view...',          ko:'새로고침을 눌러주세요...',  ja:'更新ボタンを押してください...', zh:'点击刷新查看...',     my:'ကြည့်ရန် ပြန်စစ်ကို နှိပ်ပါ', th:'แตะรีเฟรชเพื่อดู...',         id:'Tekan Segarkan untuk lihat...', ph:'I-tap ang Refresh upang tingnan...', ne:'हेर्न ताजा गर्ने थिच्नुहोस्...', hi:'देखने के लिए रिफ्रेश दबाएं...'},
  'gpsv3.trail_title':    {vi:'📍 GPS Trail (Audit)',                  en:'📍 GPS Trail (Audit)',            ko:'📍 GPS 기록 (감사)',       ja:'📍 GPS 履歴 (監査)',           zh:'📍 GPS 轨迹 (审计)',     my:'📍 GPS မှတ်တမ်း (စစ်ဆေးရန်)', th:'📍 GPS Trail (ตรวจสอบ)',     id:'📍 Riwayat GPS (Audit)',    ph:'📍 GPS Trail (Audit)',     ne:'📍 GPS पथ (परीक्षण)',         hi:'📍 GPS ट्रेल (ऑडिट)'},
  'gpsv3.trail_today':    {vi:'Xem hôm nay',                          en:'View today',                      ko:'오늘 보기',                ja:'今日を表示',                    zh:'查看今天',              my:'ယနေ့ ကြည့်ရန်',           th:'ดูวันนี้',                    id:'Lihat hari ini',            ph:'Tingnan ngayon',           ne:'आज हेर्ने',                  hi:'आज देखें'},
  'gpsv3.trail_empty':    {vi:'Bấm "Xem hôm nay" để hiển thị...',     en:'Tap "View today" to show...',     ko:'"오늘 보기"를 눌러주세요...', ja:'「今日を表示」を押してください...', zh:'点击"查看今天"显示...', my:'"ယနေ့ ကြည့်ရန်"ကို နှိပ်ပါ',  th:'แตะ "ดูวันนี้" เพื่อแสดง...', id:'Tekan "Lihat hari ini"...', ph:'I-tap ang "Tingnan ngayon"...', ne:'"आज हेर्ने" थिच्नुहोस्...', hi:'"आज देखें" दबाएं...'},
  'gpsv3.trail_no_data':  {vi:'Chưa có dữ liệu hôm nay',              en:'No data for today',               ko:'오늘 데이터 없음',          ja:'今日のデータなし',              zh:'今天暂无数据',          my:'ယနေ့အတွက် ဒေတာ မရှိ',     th:'ไม่มีข้อมูลวันนี้',           id:'Tidak ada data hari ini',   ph:'Walang data ngayong araw', ne:'आजको डाटा छैन',              hi:'आज का डेटा नहीं'},

  /* ── SMART ATTENDANCE (chấm công thông minh) ────────────────────────── */
  'sa.title':            {vi:'🧠 Chấm công thông minh',                en:'🧠 Smart Attendance',             ko:'🧠 스마트 출퇴근',          ja:'🧠 スマート出勤',                zh:'🧠 智能考勤',            my:'🧠 စမတ်တက်ရောက်',         th:'🧠 เช็คอินอัจฉริยะ',          id:'🧠 Absensi Pintar',         ph:'🧠 Smart Attendance',      ne:'🧠 स्मार्ट हाजिरी',           hi:'🧠 स्मार्ट अटेंडेंस'},
  'sa.hint':             {vi:'Wi-Fi + BTS + GPS — tự động phát hiện đi/về', en:'Wi-Fi + BTS + GPS — auto detect leave/arrive', ko:'Wi-Fi + BTS + GPS — 자동 감지', ja:'Wi-Fi + BTS + GPS — 自動検出', zh:'Wi-Fi + BTS + GPS — 自动检测', my:'Wi-Fi + BTS + GPS — အလိုအလျောက်', th:'Wi-Fi + BTS + GPS — ตรวจจับอัตโนมัติ', id:'Wi-Fi + BTS + GPS — deteksi otomatis', ph:'Wi-Fi + BTS + GPS — auto detect', ne:'Wi-Fi + BTS + GPS — स्वचालित', hi:'Wi-Fi + BTS + GPS — स्वत: पहचान'},
  'sa.status_off':       {vi:'Chưa bật',                                en:'Not enabled',                     ko:'비활성화',                  ja:'無効',                          zh:'未启用',                my:'ပိတ်ထား',                   th:'ยังไม่เปิด',                  id:'Belum aktif',               ph:'Hindi pa naka-on',         ne:'सक्षम छैन',                   hi:'सक्षम नहीं'},
  'sa.home_title':       {vi:'🏠 Hồ sơ nhà',                           en:'🏠 Home Profile',                 ko:'🏠 집 프로필',              ja:'🏠 自宅プロフィール',            zh:'🏠 家庭档案',            my:'🏠 အိမ် ပရိုဖိုင်',         th:'🏠 โปรไฟล์บ้าน',              id:'🏠 Profil Rumah',           ph:'🏠 Home Profile',          ne:'🏠 घर प्रोफाइल',              hi:'🏠 होम प्रोफ़ाइल'},
  'sa.home_hint':        {vi:'Bấm nút bên dưới khi đang ở nhà để lưu tín hiệu.', en:'Tap below while at home to save signals.', ko:'집에서 아래 버튼을 눌러 신호를 저장하세요.', ja:'自宅で下のボタンを押して信号を保存', zh:'在家时点击下方保存信号', my:'အိမ်မှာ ရှိစဉ် အောက်ဖက်ကို နှိပ်ပါ', th:'กดปุ่มด้านล่างขณะอยู่บ้าน', id:'Tekan tombol saat di rumah', ph:'I-tap ang button habang nasa bahay', ne:'घरमा हुँदा तल थिच्नुहोस्', hi:'घर पर होने पर नीचे टैप करें'},
  'sa.work_title':       {vi:'🏢 Hồ sơ công ty (Wi-Fi + GPS)',          en:'🏢 Work Profile (Wi-Fi + GPS)',   ko:'🏢 회사 프로필 (Wi-Fi + GPS)', ja:'🏢 職場プロフィール (Wi-Fi + GPS)', zh:'🏢 公司档案 (Wi-Fi + GPS)', my:'🏢 အလုပ် ပရိုဖိုင် (Wi-Fi + GPS)', th:'🏢 โปรไฟล์ที่ทำงาน (Wi-Fi + GPS)', id:'🏢 Profil Kantor (Wi-Fi + GPS)', ph:'🏢 Work Profile (Wi-Fi + GPS)', ne:'🏢 कार्य प्रोफाइल (Wi-Fi + GPS)', hi:'🏢 वर्क प्रोफ़ाइल (Wi-Fi + GPS)'},
  'sa.work_gps_note':    {vi:'GPS công ty dùng chung với phần "Vị trí công ty" ở trên', en:'Work GPS shared with "Company Location" above', ko:'회사 GPS는 위의 "회사 위치"와 공유', ja:'職場GPSは上の「会社の位置」と共有', zh:'公司GPS与上方"公司位置"共享', my:'ကုမ္ပဏီ GPS အထက်က "ကုမ္ပဏီ တည်နေရာ"နှင့် မျှဝေ', th:'GPS ที่ทำงานใช้ร่วมกับ "ตำแหน่งบริษัท" ด้านบน', id:'GPS kantor sama dengan "Lokasi Kantor" di atas', ph:'Work GPS shared sa "Company Location" sa itaas', ne:'कार्य GPS माथिको "कम्पनी स्थान"सँग साझा', hi:'वर्क GPS ऊपर "कंपनी स्थान" के साथ साझा'},
  'sa.save_wifi':        {vi:'📶 Lưu Wi-Fi',                            en:'📶 Save Wi-Fi',                   ko:'📶 Wi-Fi 저장',             ja:'📶 Wi-Fi保存',                  zh:'📶 保存Wi-Fi',           my:'📶 Wi-Fi သိမ်း',             th:'📶 บันทึก Wi-Fi',             id:'📶 Simpan Wi-Fi',           ph:'📶 I-save Wi-Fi',          ne:'📶 Wi-Fi सेभ',                hi:'📶 Wi-Fi सेव करें'},
  'sa.save_bts':         {vi:'📡 Lưu BTS',                              en:'📡 Save BTS',                     ko:'📡 BTS 저장',               ja:'📡 BTS保存',                    zh:'📡 保存BTS',             my:'📡 BTS သိမ်း',               th:'📡 บันทึก BTS',               id:'📡 Simpan BTS',             ph:'📡 I-save BTS',            ne:'📡 BTS सेभ',                  hi:'📡 BTS सेव करें'},
  'sa.save_gps':         {vi:'📍 Lưu GPS',                              en:'📍 Save GPS',                     ko:'📍 GPS 저장',               ja:'📍 GPS保存',                    zh:'📍 保存GPS',             my:'📍 GPS သိမ်း',               th:'📍 บันทึก GPS',               id:'📍 Simpan GPS',             ph:'📍 I-save GPS',            ne:'📍 GPS सेभ',                  hi:'📍 GPS सेव करें'},
  'sa.trail_title':      {vi:'🧠 Smart Trail (Debug)',                  en:'🧠 Smart Trail (Debug)',          ko:'🧠 스마트 기록 (디버그)',    ja:'🧠 スマートトレイル (デバッグ)',   zh:'🧠 智能轨迹 (调试)',     my:'🧠 စမတ် မှတ်တမ်း (Debug)',  th:'🧠 Smart Trail (Debug)',      id:'🧠 Smart Trail (Debug)',    ph:'🧠 Smart Trail (Debug)',   ne:'🧠 स्मार्ट ट्रेल (डिबग)',     hi:'🧠 स्मार्ट ट्रेल (डीबग)'},

  /* ── BACKGROUND STATUS PANEL ────────────────────────────────────────── */
  'bg.status_title':      {vi:'🛡️ Trạng thái chạy ngầm',              en:'🛡️ Background status',           ko:'🛡️ 백그라운드 상태',       ja:'🛡️ バックグラウンド状態',       zh:'🛡️ 后台状态',           my:'🛡️ နောက်ခံ အခြေအနေ',     th:'🛡️ สถานะเบื้องหลัง',         id:'🛡️ Status latar',           ph:'🛡️ Background status',     ne:'🛡️ पृष्ठभूमि स्थिति',         hi:'🛡️ बैकग्राउंड स्थिति'},
  'bg.refresh':           {vi:'🔄 Làm mới',                           en:'🔄 Refresh',                      ko:'🔄 새로고침',              ja:'🔄 更新',                       zh:'🔄 刷新',                my:'🔄 ပြန်စစ်',                th:'🔄 รีเฟรช',                  id:'🔄 Segarkan',               ph:'🔄 I-refresh',             ne:'🔄 ताजा गर्ने',               hi:'🔄 रिफ्रेश'},
  'bg.reschedule':        {vi:'⏰ Lên lịch lại tất cả',                en:'⏰ Reschedule all',               ko:'⏰ 모두 다시 예약',         ja:'⏰ すべて再スケジュール',         zh:'⏰ 全部重新安排',         my:'⏰ အားလုံး ပြန်ဇယားဆွဲ',  th:'⏰ ตั้งเวลาทั้งหมดใหม่',      id:'⏰ Jadwal ulang semua',     ph:'⏰ I-reschedule lahat',    ne:'⏰ सबै पुनः तालिका',          hi:'⏰ सब पुनर्निर्धारित'},
  'bg.force_bg':          {vi:'🚀 Bật chạy ngầm GPS (force)',          en:'🚀 Force start background GPS',   ko:'🚀 백그라운드 GPS 강제 시작', ja:'🚀 バックグラウンドGPS強制起動', zh:'🚀 强制启动后台GPS',    my:'🚀 နောက်ခံ GPS အတင်းစ',     th:'🚀 บังคับเริ่ม GPS เบื้องหลัง',  id:'🚀 Paksa mulai GPS latar',  ph:'🚀 Pilitin BG GPS',        ne:'🚀 बैकग्राउन्ड GPS जबरजस्ती सुरु', hi:'🚀 बैकग्राउंड GPS जबरन शुरू'},
  'perm.notif':           {vi:'🔔 Quyền thông báo',                    en:'🔔 Notification permission',      ko:'🔔 알림 권한',             ja:'🔔 通知権限',                   zh:'🔔 通知权限',           my:'🔔 အသိပေး ခွင့်ပြုချက်', th:'🔔 สิทธิ์การแจ้งเตือน',       id:'🔔 Izin notifikasi',       ph:'🔔 Notification permission', ne:'🔔 सूचना अनुमति',          hi:'🔔 नोटिफिकेशन अनुमति'},
  'perm.location':        {vi:'📍 Quyền vị trí',                       en:'📍 Location permission',          ko:'📍 위치 권한',             ja:'📍 位置情報の権限',             zh:'📍 位置权限',           my:'📍 တည်နေရာ ခွင့်ပြုချက်', th:'📍 สิทธิ์ตำแหน่ง',           id:'📍 Izin lokasi',          ph:'📍 Location permission',   ne:'📍 स्थान अनुमति',          hi:'📍 स्थान अनुमति'},
  'perm.battery':         {vi:'🔋 Cài đặt pin',                        en:'🔋 Battery settings',             ko:'🔋 배터리 설정',           ja:'🔋 バッテリー設定',             zh:'🔋 电池设置',           my:'🔋 ဘက်ထရီ ဆက်တင်',       th:'🔋 ตั้งค่าแบตเตอรี่',        id:'🔋 Pengaturan baterai',    ph:'🔋 Battery settings',      ne:'🔋 ब्याट्री सेटिङ',        hi:'🔋 बैटरी सेटिंग'},
  'bg.loading':           {vi:'Đang tải...',                          en:'Loading...',                      ko:'불러오는 중...',          ja:'読み込み中...',                  zh:'加载中...',             my:'တင်နေသည်...',            th:'กำลังโหลด...',                id:'Memuat...',                  ph:'Naglo-load...',            ne:'लोड हुँदै...',                hi:'लोड हो रहा...'},

  /* ── TRANG CHỦ ─────────────────────────────────────────────────────
     Nút VÀO CA: sub-text bên dưới nút (hiển thị giờ đã bấm)
     Nút HẾT CA: sub-text bên dưới nút
     Status pill: badge trạng thái (xanh khi vào ca, đỏ khi ra)
     Hours badge: chip giờ làm nhỏ bên phải ngày
     ─────────────────────────────────────────────────────────────── */
  'home.in_at':      {vi:'Vào lúc',       en:'In at',         ko:'출근',     ja:'出勤',    zh:'上班',   my:'တက် ',    th:'เข้า ',     id:'Masuk ',     ph:'Pumasok ',   ne:'प्रवेश ',  hi:'प्रवेश '},
  'home.out_at':     {vi:'Ra lúc',        en:'Out at',        ko:'퇴근',     ja:'退勤',    zh:'下班',   my:'ဆင်း ',   th:'ออก ',      id:'Keluar ',    ph:'Lumabas ',   ne:'निस्किने ',hi:'प्रस्थान '},
  'home.status_in':  {vi:'✓ Vào ca',      en:'✓ In',          ko:'✓ 출근',   ja:'✓ 出勤',  zh:'✓ 上班', my:'✓ တက် ',  th:'✓ เข้างาน ',id:'✓ Masuk ',   ph:'✓ Pumasok ', ne:'✓ प्रवेश ', hi:'✓ प्रवेश '},
  'home.h_worked':   {vi:'h làm việc',    en:'h worked',      ko:'h 근무',   ja:'h 勤務',  zh:'工作h',  my:'h အလုပ်',  th:'h ทำงาน',   id:'j kerja',    ph:'h nagtrabaho',ne:'h काम',  hi:'h काम'},

  /* ── BẢNG LƯƠNG ─────────────────────────────────────────────────────
     salaryBreakdown: các dòng chi tiết trong bảng tính lương
     Muốn đổi tên "Bảo hiểm" → sửa 'salary.insurance'
     Muốn đổi "Tăng ca"      → sửa 'salary.overtime'
     ─────────────────────────────────────────────────────────────── */
  'salary.insurance': {vi:'Bảo hiểm',      en:'Insurance',     ko:'사회보험',  ja:'社会保険', zh:'社保',   my:'အာမခံ',    th:'ประกันสังคม',id:'Asuransi',  ph:'Insurance',  ne:'बीमा',      hi:'बीमा'},
  'salary.tax':       {vi:'Thuế thu nhập', en:'Income tax',    ko:'소득세',    ja:'所得税',   zh:'所得税', my:'ဝင်ငွေခွန်',th:'ภาษีเงินได้',id:'Pajak penghasilan',ph:'Income tax',ne:'आयकर',  hi:'आयकर'},
  'salary.present':   {vi:'Có mặt',        en:'Present',       ko:'출근',      ja:'出勤',     zh:'出勤',   my:'တက်',      th:'มาทำงาน',    id:'Hadir',     ph:'Dumalo',     ne:'उपस्थित',  hi:'उपस्थित'},
  'salary.days':      {vi:'ngày',          en:'days',          ko:'일',        ja:'日',       zh:'天',     my:'ရက်',      th:'วัน',         id:'hari',      ph:'araw',       ne:'दिन',       hi:'दिन'},
  'salary.night':     {vi:'Ca đêm',        en:'Night shift',   ko:'야간 근무', ja:'夜勤',     zh:'夜班',   my:'ညဆင်း',   th:'กะกลางคืน',  id:'Shift malam',ph:'Night shift',ne:'रात पाली',hi:'रात शिफ्ट'},
  'salary.overtime':  {vi:'Tăng ca',       en:'Overtime',      ko:'초과근무',  ja:'残業',     zh:'加班',   my:'ချိန်ပို',  th:'ล่วงเวลา',   id:'Lembur',    ph:'Overtime',   ne:'ओभरटाइम',  hi:'ओवरटाइम'},
  'salary.leave':     {vi:'Nghỉ phép',     en:'Leave',         ko:'연차',      ja:'有給',     zh:'请假',   my:'ခွင့်',    th:'ลา',          id:'Cuti',      ph:'Leave',      ne:'बिदा',      hi:'छुट्टी'},
  'salary.absent':    {vi:'Vắng',          en:'Absent',        ko:'결근',      ja:'欠勤',     zh:'缺勤',   my:'ပျက်',     th:'ขาดงาน',     id:'Absen',     ph:'Absent',     ne:'अनुपस्थित',hi:'अनुपस्थित'},
  'salary.holiday':   {vi:'Làm ngày lễ',   en:'Holiday work',  ko:'휴일 근무', ja:'休日出勤', zh:'节假日', my:'ရုံးပိတ်ရက်',th:'ทำงานวันหยุด',id:'Kerja hari libur',ph:'Holiday work',ne:'बिदा काम',hi:'छुट्टी काम'},

  /* ── GPS PANEL ───────────────────────────────────────────────────────
     Nhãn trên panel GPS (Thông báo > GPS auto)
     Muốn đổi tiêu đề section → 'gps.section'
     Muốn đổi nhãn bán kính   → 'gps.radius'
     Muốn đổi nút lấy vị trí  → 'gps.btn_get'
     Muốn đổi tip dưới cùng   → 'gps.tip'
     Muốn đổi nhãn slider vào/ra ca → 'gps.checkin_lbl' / 'gps.checkout_lbl'
     ─────────────────────────────────────────────────────────────── */
  'gps.section':      {vi:'📍 VỊ TRÍ CÔNG TY',      en:'📍 COMPANY LOCATION',       ko:'📍 회사 위치',        ja:'📍 会社の位置',     zh:'📍 公司位置',     my:'📍 ကုမ္ပဏီတည်နေရာ',th:'📍 ที่ตั้งบริษัท',id:'📍 LOKASI PERUSAHAAN',ph:'📍 LOKASYON NG KUMPANYA',ne:'📍 कम्पनीको स्थान',hi:'📍 कंपनी का स्थान'},
  'gps.radius':       {vi:'Bán kính phát hiện',      en:'Detection radius',          ko:'감지 반경',           ja:'検出半径',          zh:'检测半径',        my:'သိရှိနိုင်သောအချင်း',th:'รัศมีตรวจจับ',  id:'Radius deteksi',ph:'Radius ng pagtuklas',ne:'पहिचान त्रिज्या',hi:'पहचान त्रिज्या'},
  'gps.checkin_lbl':  {vi:'⏱️ Phút xác nhận VÀO ca', en:'⏱️ Check-in confirm (min)', ko:'⏱️ 출근 확인 (분)',   ja:'⏱️ 出勤確認 (分)',  zh:'⏱️ 上班确认 (分)', my:'⏱️ တက် မိနစ်',   th:'⏱️ นาทียืนยันเข้างาน',id:'⏱️ Menit konfirmasi MASUK',ph:'⏱️ Minuto para kumpirmahin ang PASOK',ne:'⏱️ हाजिर मिनेट',hi:'⏱️ प्रवेश मिनट'},
  'gps.checkout_lbl': {vi:'⏱️ Phút xác nhận HẾT ca', en:'⏱️ Check-out confirm (min)',ko:'⏱️ 퇴근 확인 (분)',   ja:'⏱️ 退勤確認 (分)',  zh:'⏱️ 下班确认 (分)', my:'⏱️ ဆင်း မိနစ်',  th:'⏱️ นาทียืนยันออกงาน',id:'⏱️ Menit konfirmasi KELUAR',ph:'⏱️ Minuto para kumpirmahin ang LABAS',ne:'⏱️ विदाइ मिनेट',hi:'⏱️ प्रस्थान मिनट'},
  'gps.tight_company_lbl': {vi:'Ở công ty: GPS chặt', en:'At company: tight GPS', ko:'회사 안: 정밀 GPS', ja:'会社内: 高精度GPS', zh:'在公司: 精准GPS', my:'ကုမ္ပဏီတွင်: တင်းကျပ် GPS', th:'อยู่บริษัท: GPS เข้มงวด', id:'Di kantor: GPS ketat', ph:'Nasa kumpanya: tight GPS', ne:'कम्पनीमै: कडा GPS', hi:'कंपनी में: सख्त GPS'},
  'gps.tight_company_hint': {vi:'Dùng bán kính 15m và vùng đệm 20m, vẫn chấm vào/ra bằng GPS.', en:'Use a 15m radius and 20m buffer; clock in/out still uses GPS.', ko:'반경 15m와 버퍼 20m를 사용하며 출퇴근은 계속 GPS로 처리합니다.', ja:'半径15mとバッファ20mを使い、打刻は引き続きGPSで行います。', zh:'使用15米半径和20米缓冲区，仍然通过GPS上下班打卡。', my:'15m အချင်းဝက်နှင့် 20m buffer သုံးပြီး GPS ဖြင့်သာ တက်/ဆင်းမှတ်မည်။', th:'ใช้รัศมี 15 ม. และเขตกันชน 20 ม. โดยยังเช็คเข้า/ออกด้วย GPS', id:'Gunakan radius 15m dan buffer 20m; absen masuk/keluar tetap memakai GPS.', ph:'Gamit ang 15m radius at 20m buffer; GPS pa rin ang in/out.', ne:'१५m radius र २०m buffer प्रयोग हुन्छ; इन/आउट GPS बाटै हुन्छ।', hi:'15m radius और 20m buffer उपयोग होगा; इन/आउट GPS से ही होगा।'},
  'gps.btn_get':      {vi:'📍 Lấy vị trí hiện tại',  en:'📍 Get current location',   ko:'📍 현재 위치 가져오기',ja:'📍 現在地を取得',   zh:'📍 获取当前位置', my:'📍 လက်ရှိတည်နေရာ',th:'📍 รับตำแหน่งปัจจุบัน',id:'📍 Dapatkan lokasi saat ini',ph:'📍 Kunin ang kasalukuyang lokasyon',ne:'📍 हालको स्थान',hi:'📍 वर्तमान स्थान'},
  'gps.tip':          {vi:'💡 Chấm công tự động dùng Wi-Fi + BTS + GPS; GPS chỉ là một tín hiệu xác thực, không còn chấm độc lập.',en:'💡 Auto attendance uses Wi-Fi + BTS + GPS; GPS is only one verification signal, not a standalone clock-in method.',ko:'💡 Wi-Fi + BTS + GPS로 자동 출퇴근하며 GPS 단독打刻은 사용하지 않습니다.',ja:'💡 Wi-Fi + BTS + GPSで自動打刻します。GPS単独打刻は使いません。',zh:'💡 自动打卡使用 Wi-Fi + BTS + GPS；GPS 不再单独打卡。',my:'💡 Wi-Fi + BTS + GPS ဖြင့် auto attendance လုပ်သည်; GPS သီးသန့်မသုံးပါ။',th:'💡 ใช้ Wi-Fi + BTS + GPS สำหรับเช็คอินอัตโนมัติ ไม่ใช้ GPS เดี่ยว',id:'💡 Absensi otomatis memakai Wi-Fi + BTS + GPS; GPS bukan metode tunggal.',ph:'💡 Auto attendance uses Wi-Fi + BTS + GPS; hindi na GPS-only.',ne:'💡 Auto attendance Wi-Fi + BTS + GPS प्रयोग गर्छ; GPS मात्र होइन।',hi:'💡 Auto attendance Wi-Fi + BTS + GPS उपयोग करता है; केवल GPS नहीं।'},
  'gps.no_setup':     {vi:'Chưa thiết lập vị trí công ty',en:'Company location not set',ko:'회사 위치가 설정되지 않음',ja:'会社の位置が未設定',zh:'公司位置未设置',my:'ကုမ္ပဏီနေရာ မသတ်မှတ်ရသေး',th:'ยังไม่ได้ตั้งค่าตำแหน่งบริษัท',id:'Lokasi perusahaan belum diatur',ph:'Hindi pa naitakda ang lokasyon',ne:'कम्पनीको स्थान सेट गरिएको छैन',hi:'कंपनी का स्थान निर्धारित नहीं है'},
  'gps.loading':      {vi:'⏳ Đang lấy vị trí...',  en:'⏳ Getting location...',  ko:'⏳ 위치 가져오는 중...',ja:'⏳ 位置取得中...',  zh:'⏳ 正在获取位置...', my:'⏳ နေရာရယူနေသည်...',th:'⏳ กำลังรับตำแหน่ง...',id:'⏳ Mendapatkan lokasi...',ph:'⏳ Kinukuha ang lokasyon...',ne:'⏳ स्थान प्राप्त गर्दैछ...',hi:'⏳ स्थान प्राप्त हो रहा है...'},
  'gps.active':       {vi:'📍 GPS đang theo dõi (cứ {s}s/lần)',en:'📍 GPS tracking active (every {s}s)',ko:'📍 GPS 추적 중 ({s}s 간격)',ja:'📍 GPS追跡中（{s}秒ごと）',zh:'📍 GPS追踪中（每{s}秒）',my:'📍 GPS ပြေး ({s}s)',th:'📍 GPS กำลังติดตาม (ทุก {s}วิ)',id:'📍 GPS aktif (setiap {s}dtk)',ph:'📍 GPS aktibo (bawat {s}s)',ne:'📍 GPS सक्रिय ({s}s अन्तर)',hi:'📍 GPS सक्रिय (हर {s}s)'},
  'gps.saved':        {vi:'✅ Đã lưu vị trí công ty. Đang chờ GPS xác nhận vị trí hiện tại.',en:'✅ Company location saved. Waiting for GPS to confirm current position.',ko:'✅ 회사 위치 저장됨. GPS가 현재 위치를 확인하는 중입니다.',ja:'✅ 会社の位置を保存しました。GPSで現在地を確認中です。',zh:'✅ 公司位置已保存。正在等待GPS确认当前位置。',my:'✅ ကုမ္ပဏီနေရာ သိမ်းပြီးပါပြီ။ GPS က လက်ရှိနေရာ အတည်ပြုနေသည်။',th:'✅ บันทึกตำแหน่งบริษัทแล้ว กำลังรอ GPS ยืนยันตำแหน่งปัจจุบัน',id:'✅ Lokasi perusahaan disimpan. Menunggu GPS mengonfirmasi posisi saat ini.',ph:'✅ Na-save ang lokasyon ng kumpanya. Hinihintay ang GPS na kumpirmahin ang kasalukuyang lokasyon.',ne:'✅ कम्पनी स्थान सुरक्षित भयो। GPS ले हालको स्थान पुष्टि गर्दैछ।',hi:'✅ कंपनी स्थान सहेजा गया। GPS वर्तमान स्थान की पुष्टि कर रहा है।'},
  'gps.in_zone':      {vi:'🟢 Đang trong khu vực công ty',en:'🟢 Inside company area',ko:'🟢 회사 구역 내',ja:'🟢 会社エリア内',zh:'🟢 在公司区域内',my:'🟢 ကုမ္ပဏီနယ်အတွင်း',th:'🟢 อยู่ในเขตบริษัท',id:'🟢 Dalam area kantor',ph:'🟢 Loob ng kumpanya',ne:'🟢 कम्पनी क्षेत्रभित्र',hi:'🟢 कंपनी क्षेत्र में'},
  'gps.out_zone':     {vi:'🔴 Ngoài khu vực công ty',en:'🔴 Outside company area',ko:'🔴 회사 구역 외',ja:'🔴 会社エリア外',zh:'🔴 在公司区域外',my:'🔴 ကုမ္ပဏီနယ်အပြင်',th:'🔴 นอกเขตบริษัท',id:'🔴 Luar area kantor',ph:'🔴 Labas ng kumpanya',ne:'🔴 कम्पनी क्षेत्रबाहिर',hi:'🔴 कंपनी क्षेत्र के बाहर'},
  'gps.no_device':    {vi:'Thiết bị không hỗ trợ GPS',en:'Device does not support GPS',ko:'기기가 GPS를 지원하지 않음',ja:'端末がGPSをサポートしていません',zh:'设备不支持GPS',my:'စက်ပစ္စည်းသည် GPS မထောက်ပံ့',th:'อุปกรณ์ไม่รองรับ GPS',id:'Perangkat tidak mendukung GPS',ph:'Hindi sinusuportahan ng device ang GPS',ne:'उपकरणले GPS समर्थन गर्दैन',hi:'उपकरण GPS का समर्थन नहीं करता'},
  'gps.err_denied':   {vi:'GPS bị từ chối. Vui lòng nhập tọa độ thủ công.',en:'GPS denied. Please enter coordinates manually.',ko:'GPS 거부됨. 좌표를 수동으로 입력하세요.',ja:'GPSが拒否されました。座標を手動入力してください。',zh:'GPS被拒绝。请手动输入坐标。',my:'GPS ငြင်းပယ်ခံရ။ ကိုသြဒိနိတ်ကို လက်ဖြင့်ထည့်ပါ။',th:'ปฏิเสธ GPS โปรดใส่พิกัดด้วยตนเอง',id:'GPS ditolak. Masukkan koordinat secara manual.',ph:'Hindi pinayagan ang GPS. Ipasok ang koordinate nang manu-mano.',ne:'GPS अस्वीकार। निर्देशांक हस्तसंलग्न गर्नुस्।',hi:'GPS अस्वीकृत। मैन्युअल रूप से निर्देशांक डालें।'},
  'gps.err_position': {vi:'Không xác định được vị trí. Thử ở nơi thoáng hơn.',en:'Position unavailable. Try in an open area.',ko:'위치를 확인할 수 없음. 트인 곳에서 시도하세요.',ja:'位置を取得できません。開けた場所で試してください。',zh:'无法确定位置。请在开阔处尝试。',my:'တည်နေရာ ဆုံးဖြတ်မရ။ ပွင့်လင်းသောနေရာတွင် ကြိုးစားပါ။',th:'ระบุตำแหน่งไม่ได้ ลองในที่โล่ง',id:'Lokasi tidak ditemukan. Coba di area terbuka.',ph:'Hindi makita ang lokasyon. Subukan sa lantad.',ne:'स्थान पत्ता लाग्न सकेन। खुला ठाउँमा प्रयास।',hi:'स्थान अनुपलब्ध। खुले स्थान पर प्रयास करें।'},
  'gps.err_timeout':  {vi:'Hết thời gian. Thử lại.',en:'Timeout. Try again.',ko:'시간 초과. 다시 시도.',ja:'タイムアウト。再試行。',zh:'超时。请重试。',my:'အချိန်ကုန်။ ပြန်ကြိုးစား။',th:'หมดเวลา ลองใหม่',id:'Waktu habis. Coba lagi.',ph:'Nag-timeout. Subukan muli.',ne:'समय सकियो। पुन: प्रयास।',hi:'समय समाप्त। पुन: प्रयास।'},
  'gps.err_label':    {vi:'Lỗi GPS',en:'GPS error',ko:'GPS 오류',ja:'GPSエラー',zh:'GPS错误',my:'GPS အမှား',th:'ผิดพลาด GPS',id:'Kesalahan GPS',ph:'Error sa GPS',ne:'GPS त्रुटि',hi:'GPS त्रुटि'},
  'gps.no_gps_api':   {vi:'❌ Không có GPS',en:'❌ No GPS',ko:'❌ GPS 없음',ja:'❌ GPSなし',zh:'❌ 无GPS',my:'❌ GPS မရှိ',th:'❌ ไม่มี GPS',id:'❌ Tidak ada GPS',ph:'❌ Walang GPS',ne:'❌ GPS छैन',hi:'❌ GPS नहीं'},
  'gps.coords_line':  {vi:'Bán kính: {r}m | Polling: {p}s',en:'Radius: {r}m | Polling: {p}s',ko:'반경: {r}m | 폴링: {p}s',ja:'半径: {r}m | ポーリング: {p}s',zh:'半径: {r}m | 轮询: {p}s',my:'အချင်း: {r}m | Polling: {p}s',th:'รัศมี: {r}m | Polling: {p}s',id:'Radius: {r}m | Polling: {p}s',ph:'Radius: {r}m | Polling: {p}s',ne:'त्रिज्या: {r}m | Polling: {p}s',hi:'त्रिज्या: {r}m | Polling: {p}s'},
  'gps.coords_invalid':{vi:'Tọa độ không hợp lệ. Kiểm tra lại.',en:'Invalid coordinates. Check again.',ko:'좌표가 잘못되었습니다. 다시 확인하세요.',ja:'座標が無効です。再確認してください。',zh:'坐标无效。请重新检查。',my:'ကိုသြဒိနိတ် မမှန်ပါ။ ပြန်စစ်ပါ။',th:'พิกัดไม่ถูกต้อง โปรดตรวจสอบ',id:'Koordinat tidak valid. Periksa lagi.',ph:'Maling koordinate. Suriin muli.',ne:'निर्देशांक अमान्य। पुन: जाँच गर्नुस्।',hi:'निर्देशांक अमान्य। फिर जाँचें।'},
  'gps.cycle_wait':   {vi:'GPS đã ra ca - chưa đủ 8 tiếng để vào chu kỳ mới ({m}p)',en:'GPS clocked out - need 8h before new cycle ({m}m)',ko:'GPS 퇴근 - 새 사이클까지 8시간 필요 ({m}분)',ja:'GPS退勤 - 新サイクルまで8時間 ({m}分)',zh:'GPS已签退 - 距新周期还需8小时 ({m}分钟)',my:'GPS ထွက်ပြီး - စက်ဝန်းသစ်အတွက် 8 နာရီ ({m}မိနစ်)',th:'GPS ออกแล้ว - ต้องรอ 8 ชม. ({m}น)',id:'GPS keluar - butuh 8 jam untuk siklus baru ({m}m)',ph:'GPS time out - kailangan 8h bago bagong cycle ({m}m)',ne:'GPS बाहिर - नयाँ चक्रलाई ८ घण्टा ({m}मि)',hi:'GPS बाहर - नए चक्र के लिए 8 घंटे ({m}m)'},
  'export.popup_blocked':{vi:'⚠️ Trình duyệt chặn pop-up. Vui lòng cho phép pop-up để xuất PDF.',en:'⚠️ Browser blocked pop-up. Allow pop-ups to export PDF.',ko:'⚠️ 브라우저가 팝업을 차단했습니다. PDF 내보내기를 위해 팝업을 허용하세요.',ja:'⚠️ ブラウザがポップアップをブロックしました。PDFエクスポートのため許可してください。',zh:'⚠️ 浏览器拦截了弹窗。请允许弹窗以导出PDF。',my:'⚠️ ဘရောက်ဇာက pop-up ပိတ်ထား။ PDF ထုတ်ရန် ခွင့်ပြုပါ။',th:'⚠️ เบราว์เซอร์บล็อกป๊อปอัป โปรดอนุญาตเพื่อส่งออก PDF',id:'⚠️ Browser memblokir pop-up. Izinkan pop-up untuk ekspor PDF.',ph:'⚠️ Hinaharangan ng browser ang pop-up. Payagan para mag-export ng PDF.',ne:'⚠️ ब्राउजरले पप-अप रोक्यो। PDF निर्यातका लागि अनुमति दिनुस्।',hi:'⚠️ ब्राउज़र ने पॉप-अप को रोका। PDF निर्यात के लिए अनुमति दें।'},
  'salary.detail_empty':{vi:'Nhập thông tin lương để tính tự động',en:'Enter salary info to auto-calculate',ko:'급여 정보를 입력하면 자동 계산',ja:'給与情報を入力すると自動計算',zh:'输入工资信息以自动计算',my:'အလိုအလျောက် တွက်ရန် လစာအချက်အလက် ထည့်ပါ',th:'กรอกข้อมูลเงินเดือนเพื่อคำนวณอัตโนมัติ',id:'Masukkan info gaji untuk hitung otomatis',ph:'Ilagay ang impormasyon ng sahod para auto-compute',ne:'स्वत: गणनाका लागि तलब जानकारी',hi:'स्वत: गणना के लिए वेतन जानकारी डालें'},
  'salary.detail_hour':{vi:'{h} thực tế · {r} · Thực nhận ≈ {n}',en:'{h} actual · {r} · Net ≈ {n}',ko:'{h} 실제 · {r} · 실수령 ≈ {n}',ja:'{h} 実績 · {r} · 手取り ≈ {n}',zh:'{h} 实际 · {r} · 实收 ≈ {n}',my:'{h} အမှန် · {r} · လက်ခံ ≈ {n}',th:'{h} จริง · {r} · สุทธิ ≈ {n}',id:'{h} aktual · {r} · Bersih ≈ {n}',ph:'{h} aktwal · {r} · Net ≈ {n}',ne:'{h} वास्तविक · {r} · निखुर ≈ {n}',hi:'{h} वास्तविक · {r} · नेट ≈ {n}'},
  'salary.detail_day':{vi:'{d} ngày đã tan ca · {r} · Thực nhận ≈ {n}',en:'{d} completed days · {r} · Net ≈ {n}',ko:'{d}일 완료 · {r} · 실수령 ≈ {n}',ja:'{d}日完了 · {r} · 手取り ≈ {n}',zh:'{d} 天已完成 · {r} · 实收 ≈ {n}',my:'{d} ရက် ပြီးပြီး · {r} · လက်ခံ ≈ {n}',th:'{d} วันเสร็จ · {r} · สุทธิ ≈ {n}',id:'{d} hari selesai · {r} · Bersih ≈ {n}',ph:'{d} araw tapos · {r} · Net ≈ {n}',ne:'{d} दिन समापन · {r} · निखुर ≈ {n}',hi:'{d} दिन पूर्ण · {r} · नेट ≈ {n}'},
  'validate.empty_name':{vi:'Vui lòng nhập họ và tên!',en:'Please enter your full name!',ko:'이름을 입력하세요!',ja:'氏名を入力してください！',zh:'请输入姓名！',my:'အမည် ထည့်ပါ။',th:'กรุณากรอกชื่อ-นามสกุล!',id:'Masukkan nama lengkap!',ph:'Ilagay ang buong pangalan!',ne:'पूरा नाम लेख्नुस्!',hi:'अपना पूरा नाम दर्ज करें!'},

  /* ── PANEL GIAO DIỆN (⭐ Thiết lập > Giao diện) ─────────────────────
     Muốn đổi nhãn "Ảnh đại diện" → 'appear.avatar'
     Muốn đổi nhãn "Màu chủ đạo" → 'appear.color'
     Muốn đổi nhãn "Ảnh nền lịch" → 'appear.bg'
     Muốn đổi nút "Chọn ảnh"     → 'appear.btn_choose'
     Muốn đổi nút "Lưu giao diện"→ 'appear.save'
     ─────────────────────────────────────────────────────────────── */
  'appear.avatar':    {vi:'Ảnh đại diện',      en:'Avatar',          ko:'아바타',    ja:'アバター',    zh:'头像',   my:'ဓာတ်ပုံ',   th:'รูปโปรไฟล์',   id:'Avatar',     ph:'Avatar',       ne:'अवतार',     hi:'अवतार'},
  'appear.avt_desc':  {vi:'Ảnh hiển thị trên trang chủ',en:'Photo shown on home',ko:'홈에 표시되는 사진',ja:'ホームに表示する写真',zh:'显示在主页的照片',my:'မူလစာမျက်နှာတွင်ပြသ',th:'รูปที่แสดงบนหน้าหลัก',id:'Foto ditampilkan di beranda',ph:'Larawan sa home',ne:'गृह पृष्ठमा देखिने फोटो',hi:'होम स्क्रीन पर दिखाई जाने वाली फ़ोटो'},
  'appear.btn_choose':{vi:'📷 Chọn ảnh',       en:'📷 Choose photo', ko:'📷 사진 선택',ja:'📷 写真を選択',zh:'📷 选择照片',my:'📷 ဓာတ်ပုံရွေး',th:'📷 เลือกรูป',  id:'📷 Pilih foto', ph:'📷 Pumili ng larawan',ne:'📷 फोटो छान्नुस्',hi:'📷 फ़ोटो चुनें'},
  'appear.color':     {vi:'Màu chủ đạo',       en:'Theme color',     ko:'테마 색상',  ja:'テーマカラー',zh:'主题颜色',my:'အရောင်',     th:'สีธีม',         id:'Warna tema',  ph:'Kulay ng tema', ne:'थिम रंग',    hi:'थीम रंग'},
  'appear.bg':        {vi:'Ảnh nền lịch',       en:'Calendar background',ko:'달력 배경',ja:'カレンダー背景',zh:'日历背景',my:'ပြက္ခဒိန်နောက်ခံ',th:'พื้นหลังปฏิทิน',id:'Latar kalender',ph:'Background ng kalendaryo',ne:'क्यालेन्डर पृष्ठभूमि',hi:'कैलेंडर पृष्ठभूमि'},
  'appear.btn_bg':    {vi:'📷 Chọn ảnh từ máy', en:'📷 Choose from device',ko:'📷 기기에서 선택',ja:'📷 端末から選択',zh:'📷 从设备选择',my:'📷 ထည့်သွင်း',th:'📷 เลือกจากอุปกรณ์',id:'📷 Pilih dari perangkat',ph:'📷 Pumili mula sa device',ne:'📷 उपकरणबाट छान्नुस्',hi:'📷 डिवाइस से चुनें'},
  'appear.btn_clear': {vi:'✕ Xóa ảnh',         en:'✕ Remove',        ko:'✕ 제거',    ja:'✕ 削除',      zh:'✕ 删除', my:'✕ ဖျက်',   th:'✕ ลบ',          id:'✕ Hapus',     ph:'✕ Alisin',     ne:'✕ हटाउनुस्',hi:'✕ हटाएं'},
  'appear.gradient':  {vi:'Màu nền gradient',   en:'Gradient presets',ko:'그라데이션', ja:'グラデーション',zh:'渐变预设',my:'Gradient',  th:'พื้นหลัง Gradient',id:'Preset Gradient',ph:'Mga Gradient preset',ne:'Gradient प्रिसेट',hi:'Gradient प्रीसेट'},
  'appear.no_bg':     {vi:'Chưa có ảnh nền',    en:'No background image',ko:'배경 이미지 없음',ja:'背景画像なし',zh:'无背景图片',my:'နောက်ခံပုံမရှိ',th:'ไม่มีภาพพื้นหลัง',id:'Tidak ada gambar latar',ph:'Walang background',ne:'पृष्ठभूमि छैन',hi:'कोई पृष्ठभूमि नहीं'},
  'appear.save':      {vi:'✓ Lưu giao diện',    en:'✓ Save appearance',ko:'✓ 저장',    ja:'✓ 外観を保存', zh:'✓ 保存外观',my:'✓ သိမ်း',   th:'✓ บันทึกธีม',   id:'✓ Simpan tampilan',ph:'✓ I-save ang hitsura',ne:'✓ थिम सुरक्षित',hi:'✓ थीम सहेजें'},

  /* ── PANEL THIẾT LẬP (📝 Thiết lập > Thiết lập thông tin) ───────────
     Muốn đổi nhãn "Họ và tên"     → 'setup.name'
     Muốn đổi nhãn "Chức vụ"       → 'setup.job'
     Muốn đổi nhãn "Công ty"       → 'setup.company'
     Muốn đổi nhãn "Số ca làm việc"→ 'setup.shifts'
     Muốn đổi nút "Lưu thông tin"  → 'setup.save'
     Muốn đổi nhãn "Nghỉ giữa giờ"→ 'setup.break'
     ─────────────────────────────────────────────────────────────── */
  'setup.name':        {vi:'Họ và tên',      en:'Full Name',      ko:'성명',    ja:'氏名',    zh:'姓名',   my:'အမည်',   th:'ชื่อ-นามสกุล',id:'Nama Lengkap',ph:'Buong Pangalan',ne:'पूरा नाम',hi:'पूरा नाम'},
  'setup.job':         {vi:'Chức vụ',        en:'Job Title',      ko:'직책',    ja:'職種',    zh:'职位',   my:'ရာထူး',  th:'ตำแหน่งงาน',  id:'Jabatan',    ph:'Trabaho',      ne:'पद',        hi:'पद'},
  'setup.company':     {vi:'Công ty',        en:'Company',        ko:'회사',    ja:'会社名',  zh:'公司',   my:'ကုမ္ပဏီ',th:'บริษัท',       id:'Perusahaan', ph:'Kumpanya',     ne:'कम्पनी',    hi:'कंपनी'},
  'setup.shifts':      {vi:'Số ca làm việc', en:'Number of shifts',ko:'교대 수',ja:'シフト数',zh:'班次数量',my:'Shift', th:'จำนวนกะ',     id:'Jumlah shift',ph:'Bilang ng shift',ne:'सिफ्ट संख्या',hi:'शिफ्ट की संख्या'},
  'setup.hours':       {vi:'Số giờ / ca',    en:'Hours / shift',  ko:'교대당 시간',ja:'時間/シフト',zh:'每班时长',my:'နာရီ',th:'ชั่วโมง/กะ', id:'Jam/shift',  ph:'Oras/shift',   ne:'घण्टा/सिफ्ट',hi:'घंटे/शिफ्ट'},
  'setup.save':        {vi:'✓ Lưu thông tin',en:'✓ Save Info',    ko:'✓ 저장',  ja:'✓ 保存',  zh:'✓ 保存信息',my:'✓ သိမ်း',th:'✓ บันทึกข้อมูล',id:'✓ Simpan info',ph:'✓ I-save',   ne:'✓ सुरक्षित',hi:'✓ जानकारी सहेजें'},
  'setup.weeks':       {vi:'Số tuần một vòng',en:'Weeks per rotation',ko:'순환 주 수',ja:'ローテーション週数',zh:'轮班周数',my:'အပတ်လည်ပတ်',th:'สัปดาห์/รอบ',id:'Minggu/siklus',ph:'Linggo/siklo',ne:'हप्ता/चक्र',hi:'सप्ताह/चक्र'},
  'setup.break_q':     {vi:'Có nghỉ giữa giờ không?',en:'Any break time?',ko:'중간 휴식 있나요?',ja:'休憩時間ありますか？',zh:'有中途休息吗？',my:'အကြားနားချိန်ရှိပါသလား?',th:'มีเวลาพักไหม?',id:'Ada waktu istirahat?',ph:'May break?',ne:'बिश्राम छ?',hi:'कोई ब्रेक है?'},
  'setup.break_no':    {vi:'Không',   en:'No',    ko:'아니오', ja:'なし', zh:'没有', my:'မရှိ', th:'ไม่',  id:'Tidak', ph:'Hindi', ne:'छैन',  hi:'नहीं'},
  'setup.break_yes':   {vi:'Có',      en:'Yes',   ko:'예',     ja:'あり', zh:'有',   my:'ရှိ',  th:'ใช่',  id:'Ya',    ph:'Oo',    ne:'छ',    hi:'हाँ'},
  'setup.break_min':   {vi:'Số phút nghỉ (sẽ trừ vào giờ thực tế)',en:'Break minutes (will subtract from worked hours)',ko:'휴식 분 (실제 근무시간에서 차감)',ja:'休憩時間（実働から差し引き）',zh:'休息分钟数（从实际工时扣除）',my:'အနားချိန် (အလုပ်ချိန်မှနုတ်)',th:'นาทีพัก (หักจากชั่วโมงทำงาน)',id:'Menit istirahat (dikurangi dari jam kerja)',ph:'Minuto ng pahinga (ibabawas sa oras ng trabaho)',ne:'बिश्राम मिनेट (काम घण्टाबाट घटाइन्छ)',hi:'ब्रेक मिनट (काम के घंटों से घटाया जाएगा)'},
  /* ── JOB PHỤ (Sub Job) ────────────────────────────────────────────────
     Muốn đổi nhãn "Có job phụ không?" → 'setup.has_sub'
     Muốn đổi nhãn "Tên job phụ"       → 'setup.sub_name'
     Muốn đổi nhãn "Lương job phụ"     → 'setup.sub_salary'
     ─────────────────────────────────────────────────────────────── */
  'setup.has_sub':      {vi:'Có job phụ không?',      en:'Have a secondary job?',  ko:'부업 있나요?',     ja:'副業はありますか？', zh:'有副业吗？',    my:'အလုပ်ခွဲရှိပါသလား?', th:'มีงานเสริมไหม?',     id:'Punya pekerjaan sampingan?', ph:'May pangalawang trabaho?', ne:'दोस्रो काम छ?',       hi:'कोई दूसरी नौकरी है?'},
  'setup.sub_name':     {vi:'Tên job phụ',             en:'Sub-job name',           ko:'부업 이름',         ja:'副業名',             zh:'副业名称',      my:'အလုပ်ခွဲ အမည်',      th:'ชื่องานเสริม',        id:'Nama pekerjaan sampingan',   ph:'Pangalan ng pangalawang trabaho', ne:'दोस्रो काम नाम',   hi:'दूसरी नौकरी का नाम'},
  'setup.sub_salary':   {vi:'Lương job phụ',           en:'Sub-job salary',         ko:'부업 급여',         ja:'副業給与',           zh:'副业薪资',      my:'အလုပ်ခွဲ လစာ',       th:'รายได้งานเสริม',      id:'Gaji sampingan',             ph:'Sahod ng pangalawang trabaho',   ne:'दोस्रो काम तलब',  hi:'दूसरी नौकरी का वेतन'},
  'setup.sub_total':    {vi:'Tổng thu nhập (Main + Sub)', en:'Total income (Main + Sub)', ko:'합산 수입 (주+부)',ja:'合計収入（主+副）', zh:'合计收入（主+副）', my:'စုစုပေါင်း (Main+Sub)', th:'รายได้รวม (หลัก+เสริม)', id:'Total pendapatan (Utama+Sampingan)', ph:'Kabuuang kita (Main+Sub)', ne:'कुल आय (Main+Sub)', hi:'कुल आय (Main+Sub)'},
  'job.main':           {vi:'Job chính',   en:'Main job',   ko:'주업',     ja:'本業',     zh:'主业',   my:'အဓိကအလုပ်', th:'งานหลัก',  id:'Pekerjaan utama',   ph:'Pangunahing trabaho', ne:'मुख्य काम', hi:'मुख्य नौकरी'},
  'job.sub':            {vi:'Job phụ',     en:'Sub job',    ko:'부업',     ja:'副業',     zh:'副业',   my:'အလုပ်ခွဲ',  th:'งานเสริม', id:'Pekerjaan sampingan',ph:'Pangalawang trabaho', ne:'दोस्रो काम', hi:'दूसरी नौकरी'},
  'export.all':         {vi:'Xuất tất cả',  en:'Export ALL',  ko:'전체 내보내기',ja:'全て出力', zh:'导出全部', my:'အားလုံး',  th:'ส่งออกทั้งหมด',id:'Ekspor SEMUA',  ph:'I-export Lahat',  ne:'सबै निर्यात', hi:'सभी निर्यात'},
  'export.main':        {vi:'Xuất job chính',en:'Export MAIN',ko:'주업만 내보내기',ja:'本業のみ出力',zh:'仅导出主业',my:'အဓိကသာ',th:'ส่งออกงานหลัก',id:'Ekspor UTAMA',ph:'I-export MAIN',ne:'मुख्य निर्यात',hi:'मुख्य निर्यात'},
  'export.sub':         {vi:'Xuất job phụ', en:'Export SUB',  ko:'부업만 내보내기',ja:'副業のみ出力',zh:'仅导出副业',my:'အလုပ်ခွဲသာ',th:'ส่งออกงานเสริม',id:'Ekspor SAMPINGAN',ph:'I-export SUB',ne:'दोस्रो निर्यात',hi:'दूसरी निर्यात'},

  'setup.which_shift': {vi:'Tuần này bạn làm ca nào?',en:'Which shift this week?',ko:'이번 주 어느 교대?',ja:'今週はどのシフト？',zh:'本周哪个班次？',my:'ဒီအပတ် ဘယ်ဆင်း?',th:'สัปดาห์นี้กะอะไร?',id:'Shift minggu ini?',ph:'Anong shift ngayong linggo?',ne:'यो हप्ता कुन सिफ्ट?',hi:'इस सप्ताह कौन सी शिफ्ट?'},

  /* ── XÁC NHẬN XÓA DỮ LIỆU ───────────────────────────────────────────
     Muốn đổi tiêu đề popup xóa → 'delete.title'
     Muốn đổi mô tả xóa         → 'delete.desc'
     Muốn đổi nhãn setting       → 'delete.setting_name' / 'delete.setting_sub'
     ─────────────────────────────────────────────────────────────── */
  /* ── FALLBACK TÊN / CHỨC VỤ NGƯỜI DÙNG ─────────────────────────────
     Muốn đổi tên mặc định khi chưa nhập → 'user.default_name'
     Muốn đổi chức vụ mặc định          → 'user.default_job'
     ─────────────────────────────────────────────────────────────── */
  'user.default_name': {vi:'Người dùng',en:'User',ko:'사용자',ja:'ユーザー',zh:'用户',my:'သုံးစွဲသူ',th:'ผู้ใช้',id:'Pengguna',ph:'Gumagamit',ne:'प्रयोगकर्ता',hi:'उपयोगकर्ता'},
  'user.default_job':  {vi:'Nhân viên',  en:'Employee',ko:'직원',ja:'社員',zh:'员工',my:'ဝန်ထမ်း',th:'พนักงาน',id:'Karyawan',ph:'Empleyado',ne:'कर्मचारी',hi:'कर्मचारी'},

  'delete.title':       {vi:'Xóa toàn bộ dữ liệu',en:'Delete All Data',ko:'모든 데이터 삭제',ja:'全データ削除',zh:'删除所有数据',my:'ဒေတာဖျက်',th:'ลบข้อมูลทั้งหมด',id:'Hapus Semua Data',ph:'Burahin Lahat ng Data',ne:'सबै डेटा मेटाउनुस्',hi:'सभी डेटा हटाएं'},
  'delete.subtitle':    {vi:'Không thể khôi phục',en:'Cannot be recovered',ko:'복구 불가',ja:'元に戻せません',zh:'无法恢复',my:'ပြန်မရနိုင်',th:'กู้คืนไม่ได้',id:'Tidak dapat dipulihkan',ph:'Hindi mababawi',ne:'पुनः प्राप्त हुँदैन',hi:'पुनः प्राप्त नहीं किया जा सकता'},

  /* ── POPUP CHÀO BUỔI SÁNG (splash) ──────────────────────────────────
     Muốn đổi "ngày có mặt tháng này" → 'splash.days_present'
     Muốn đổi nút "Bắt đầu ngày làm"  → 'splash.start_btn'
     ─────────────────────────────────────────────────────────────── */
  'splash.days_present':{vi:'ngày có mặt tháng này',en:'days present this month',ko:'이달 출근일',ja:'今月の出勤日数',zh:'本月出勤天数',my:'ဤလ တက်ရောက်ရက်',th:'วันมาทำงานเดือนนี้',id:'hari hadir bulan ini',ph:'araw ng pagdalo ngayong buwan',ne:'यो महिना उपस्थिति दिन',hi:'इस महीने उपस्थिति दिन'},
  'splash.start_btn':   {vi:'Bắt đầu ngày làm việc',en:'Start the workday',ko:'오늘 업무 시작',ja:'今日の業務を開始',zh:'开始今天的工作',my:'ယနေ့အလုပ်စတင်',th:'เริ่มต้นวันทำงาน',id:'Mulai hari kerja',ph:'Simulan ang araw ng trabaho',ne:'आज काम सुरु',hi:'आज का कार्यदिवस शुरू'},
};

/**
 * u(key) — Lấy chuỗi UI từ UI_STR theo ngôn ngữ hiện tại
 *
 * Dùng: u('home.in_at')     → 'Vào lúc' (tiếng Việt)
 *       u('salary.tax')     → 'ภาษีเงินได้' (tiếng Thái)
 *
 * Nếu key không tồn tại → trả về chính key (dễ debug)
 * Fallback: en → vi → key
 *
 * @param {string} key  - key trong UI_STR, vd: 'home.in_at'
 * @param {string} [subs] - object thay thế {s:'60'} cho template '{s}'
 */
function u(key, subs){
  const obj = UI_STR[key];
  if(!obj) return key;
  const L = (typeof userData!=='undefined' && userData.lang) || 'vi';
  let txt = obj[L] || obj.en || obj.vi || key;
  if(subs) Object.keys(subs).forEach(k=>{ txt=txt.replace('{'+k+'}', subs[k]); });
  return txt;
}

/* ──────────────────────────────────────────────────────────────────────
   TRAN — CHUỖI GIAO DIỆN CHÍNH (menu, nút lớn, onboarding, cài đặt)
   ──────────────────────────────────────────────────────────────────── */
const TRAN = {
  vi:{
    appName:'Chấm Công Pro', appSub:'Chấm công thông minh · Lương đúng luật',
    vaoCA:'VÀO CA', hetCA:'HẾT CA',
    batDauCa:'Nhấn để bắt đầu ca', ketThucCa:'Nhấn khi kết thúc ca',
    chuaChamCong:'Chưa chấm công',
    gioLam:'Giờ làm tháng này',
    binhThuong:'Bình thường', chamChi:'Chăm chỉ ⚡', quaSuc:'Quá sức 🔥',
    coMat:'Có mặt', vang:'Vắng', nghiPhep:'Nghỉ phép', tangCa:'Tăng ca',
    chucNang:'Chức năng',
    lich:'Lịch', thietLap:'Thiết lập', giaoDien:'Giao diện', caiDat:'Cài đặt',
    luong:'Lương', xuatExcel:'Xuất Excel', thongBao:'Thông báo', huongDan:'Hướng dẫn',
    flGPS:'GPS', flUtil:'Trò chơi', flTax:'Thuế & BH',
    taxTitle:'🏛️ Quy định Thuế & Bảo hiểm',
    utilTitle:'🎮 Trò chơi', utilEmptyTitle:'Chọn game để chơi',
    utilEmptyDesc:'Các trò chơi đã được thêm vào khu vực này.',
    taxSecIns:'🛡️ BẢO HIỂM XÃ HỘI / AN SINH',
    taxSecDeduct:'💰 GIẢM TRỪ GIA CẢNH / MIỄN THUẾ',
    taxSecBrackets:'📊 BIỂU THUẾ THU NHẬP CÁ NHÂN (LŨY TIẾN)',
    taxSecPayroll:'⏱️ HỆ SỐ LƯƠNG THEO LUẬT',
    taxBandNo:'Bậc', taxBandIncome:'Thu nhập chịu thuế', taxBandRate:'Thuế suất',
    taxInsRate:'Tỷ lệ đóng', taxInsCap:'Trần lương/tháng', taxInsMax:'Đóng tối đa/tháng',
    taxInsFlat:'Tỷ lệ phẳng', taxSS:'Social Security', taxSsCap:'Cap SS/năm', taxMedicare:'Medicare',
    taxPersonal:'Bản thân', taxDependent:'Người phụ thuộc', taxStandard:'Khấu trừ cơ bản',
    taxExempt:'0% (miễn)', taxAbove:'Trên',
    taxInsDeductY:'✓ BH được trừ trước khi tính thuế',
    taxInsDeductN:'⚠️ BH không trừ khỏi thu nhập chịu thuế',
    taxLocalTax:'Thuế địa phương', taxResidentTax:'Thuế cư trú',
    taxCalcBy:'Tính theo', taxPeriodAnnual:'năm (quy về tháng)', taxPeriodMonthly:'tháng',
    taxPerYear:'năm', taxPerMonth:'tháng',
    taxNote:'Số liệu tham khảo theo luật 2025. Thuế/BH thực tế tùy chính sách công ty, tình trạng gia đình và các khoản giảm trừ riêng.',
    luongUocTinh:'💼 Lương ước tính tháng này',
    lichChamCong:'Lịch chấm công',
    chipCM:'✓ Có mặt', chipV:'✕ Vắng', chipNP:'☀ Nghỉ phép', chipLL:'★ Làm lễ',
    navHome:'Trang chủ', navLich:'Lịch', navLuong:'Lương', navCaiDat:'Cài đặt',
    // Settings screen
    settingsTitle:'Cài đặt',
    siLang:'Ngôn ngữ', siCountry:'Quốc gia làm việc',
    siSetup:'Thiết lập thông tin', siSetupSub:'Tên, chức vụ, ca làm việc',
    siNotif:'Cài đặt thông báo', siNotifSub:'Nhắc giờ làm, tự động chấm công',
    siAppear:'Chỉnh sửa giao diện', siAppearSub:'Màu sắc, ảnh đại diện, ảnh nền',
    siAbout:'Thông tin về app', siAboutSub:'Phiên bản 2.2.0',
    siHelp:'Hướng dẫn sử dụng', siHelpSub:'Cách dùng app hiệu quả',
    siDelete:'Xóa toàn bộ dữ liệu', siDeleteSub:'Không thể khôi phục',
    // Panels
    panelAppear:'⭐ Chỉnh sửa giao diện', panelNotif:'🔔 Cài đặt thông báo',
    panelSalary:'💰 Bảng lương', panelExcel:'📊 Xuất Excel',
    panelSetup:'📝 Thiết lập thông tin', panelHelp:'📖 Hướng dẫn sử dụng',
    panelAbout:'ℹ️ Về ứng dụng', panelLang:'🌐 Chọn ngôn ngữ',
    panelCountry:'🗺️ Quốc gia làm việc',
    closeBtn:'Đóng',
    // Onboarding
    obLang:'Chào mừng! 👋\nChọn ngôn ngữ', obLangSub:'Chọn ngôn ngữ và quốc gia bạn đang làm việc.',
    obUser:'Thông tin của bạn 👤', obUserSub:'Nhập thông tin cá nhân để cá nhân hóa app.',
    obShift:'Lịch làm việc ⏰', obShiftSub:'Bạn làm mấy ca? Mỗi ca mấy tiếng?',
    obTime:'Giờ giấc ca làm 🕐', obTimeSub:'Thiết lập giờ vào và hết ca cho từng ca.',
    obNext:'Tiếp theo →', obBack:'←', obStart:'Bắt đầu dùng app ✓',
    obName:'Họ và tên', obNameP:'Nguyễn Văn A',
    obJob:'Chức vụ / Công việc', obJobP:'Nhân viên / Công nhân...',
    obCo:'Tên công ty', obCoP:'Công ty ABC',
    obShiftNum:'Số ca làm việc', obHours:'Số giờ mỗi ca', obHoursCustom:'Hoặc nhập:', obHoursUnit:'giờ/ca',
    obWeeks:'Số tuần một vòng',
    obShiftCountry:'Quốc gia làm việc',
    // Days and months
    days:['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'],
    daysShort:['CN','T2','T3','T4','T5','T6','T7'],
    months:['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'],
    // Salary panel
    salaryContract:'Lương hợp đồng / tháng', salaryDays:'Ngày công chuẩn / tháng',
    salaryEst:'Lương ước tính tháng này', salaryNet:'Thực nhận ước tính',
    salarySave:'✓ Lưu thông tin lương',
    // Day panel
    dpStatus:'TRẠNG THÁI', dpActual:'GIỜ THỰC TẾ', dpNote:'GHI CHÚ',
    dpReset:'Đặt lại theo ca', dpCancel:'Hủy bỏ', dpSave:'Lưu lại',
    dpTotalHours:'Tổng:', dpOT:'Tăng ca:',
    dpInTime:'Giờ vào', dpOutTime:'Giờ ra',
    dpNoteP:'Thêm ghi chú cho ngày này...',
    // Status labels
    stCM:'Có mặt', stCMSub:'Đi làm đúng ca',
    stNP:'Nghỉ phép', stNPSub:'Có hưởng lương',
    stV:'Vắng mặt', stVSub:'Không phép — trừ lương',
    stLL:'Làm ngày lễ', stLLSub:'Tính theo luật',
    // Splash
    spPresent:'ngày có mặt tháng này', spStart:'Bắt đầu ngày làm việc',
    // Reset
    resetTitle:'Xóa toàn bộ dữ liệu?',
    resetDesc:'Tất cả dữ liệu sẽ bị xóa vĩnh viễn. Không thể khôi phục!',
    resetCancel:'Hủy bỏ', resetOk:'🗑 Xóa hết',
    // Export
    exportPreview:'Xem trước dữ liệu xuất ra:',
    exportBtn:'📊 Xuất file Excel (.csv)',
    // Notif panel
    n1Name:'Nhắc trước giờ làm 30 phút', n1Desc:'Thông báo nhắc nhở trước ca bắt đầu',
    n2Name:'Xác nhận giờ nghỉ sau 30 phút', n2Desc:'Hỏi giờ tan ca thực tế sau khi hết ca',
    n3Name:'Chấm công tự động (GPS)', n3Desc:'Tự động ghi nhận khi vào/ra khu vực công ty',
    n4Name:'Nhắc cuối tuần tổng kết', n4Desc:'Xem tổng hợp tuần vào thứ 6 hàng tuần',
    calEmpty:'Chưa có dữ liệu tháng này', noData:'Chưa có dữ liệu',
    salaryDetail:'Nhập thông tin lương để tính tự động',
  },
  en:{
    appName:'Work Tracker Pro', appSub:'Smart attendance · Legal payroll',
    vaoCA:'CLOCK IN', hetCA:'CLOCK OUT',
    batDauCa:'Tap to start shift', ketThucCa:'Tap when shift ends',
    chuaChamCong:'Not checked in',
    gioLam:'Work hours this month',
    binhThuong:'Normal', chamChi:'Diligent ⚡', quaSuc:'Overworked 🔥',
    coMat:'Present', vang:'Absent', nghiPhep:'Leave', tangCa:'Overtime',
    chucNang:'Functions',
    lich:'Calendar', thietLap:'Setup', giaoDien:'Appearance', caiDat:'Settings',
    luong:'Salary', xuatExcel:'Export Excel', thongBao:'Notifications', huongDan:'Help',
    flGPS:'GPS', flUtil:'Games', flTax:'Tax & Ins.',
    taxTitle:'🏛️ Tax & Insurance Guide',
    utilTitle:'🎮 Games', utilEmptyTitle:'Choose a game',
    utilEmptyDesc:'Games have been added to this area.',
    taxSecIns:'🛡️ SOCIAL INSURANCE / SOCIAL SECURITY',
    taxSecDeduct:'💰 PERSONAL ALLOWANCE / DEDUCTIONS',
    taxSecBrackets:'📊 INCOME TAX BRACKETS (PROGRESSIVE)',
    taxSecPayroll:'⏱️ STATUTORY PAY FACTORS',
    taxBandNo:'Band', taxBandIncome:'Taxable income', taxBandRate:'Tax rate',
    taxInsRate:'Contribution rate', taxInsCap:'Monthly salary cap', taxInsMax:'Max contribution/month',
    taxInsFlat:'Flat rate', taxSS:'Social Security', taxSsCap:'SS cap/year', taxMedicare:'Medicare',
    taxPersonal:'Personal', taxDependent:'Dependents', taxStandard:'Standard deduction',
    taxExempt:'0% (exempt)', taxAbove:'Over',
    taxInsDeductY:'✓ Insurance deductible from taxable income',
    taxInsDeductN:'⚠️ Insurance NOT deductible from taxable income',
    taxLocalTax:'Local tax', taxResidentTax:'Resident tax',
    taxCalcBy:'Based on', taxPeriodAnnual:'year (shown monthly)', taxPeriodMonthly:'month',
    taxPerYear:'year', taxPerMonth:'month',
    taxNote:'Reference data per 2025 law. Actual tax/insurance depends on employer policy, family status and individual deductions.',
    luongUocTinh:'💼 Estimated salary this month',
    lichChamCong:'Attendance Calendar',
    chipCM:'✓ Present', chipV:'✕ Absent', chipNP:'☀ Leave', chipLL:'★ Holiday work',
    navHome:'Home', navLich:'Calendar', navLuong:'Salary', navCaiDat:'Settings',
    settingsTitle:'Settings',
    siLang:'Language', siCountry:'Working country',
    siSetup:'Setup Info', siSetupSub:'Name, job, work shifts',
    siNotif:'Notifications', siNotifSub:'Work reminders, auto check-in',
    siAppear:'Appearance', siAppearSub:'Colors, avatar, background',
    siAbout:'About App', siAboutSub:'Version 2.2.0',
    siHelp:'User Guide', siHelpSub:'How to use the app effectively',
    siDelete:'Delete All Data', siDeleteSub:'Cannot be recovered',
    panelAppear:'⭐ Appearance', panelNotif:'🔔 Notifications',
    panelSalary:'💰 Salary', panelExcel:'📊 Export Excel',
    panelSetup:'📝 Setup Info', panelHelp:'📖 User Guide',
    panelAbout:'ℹ️ About App', panelLang:'🌐 Language',
    panelCountry:'🗺️ Working Country',
    closeBtn:'Close',
    obLang:'Welcome! 👋\nChoose Language', obLangSub:'Select your display language and working country.',
    obUser:'Your Info 👤', obUserSub:'Enter your info to personalize the app.',
    obShift:'Work Schedule ⏰', obShiftSub:'How many shifts? Hours per shift?',
    obTime:'Shift Hours 🕐', obTimeSub:'Set check-in and check-out times for each shift.',
    obNext:'Next →', obBack:'←', obStart:'Start Using App ✓',
    obName:'Full Name', obNameP:'John Smith',
    obJob:'Job Title', obJobP:'Employee / Worker...',
    obCo:'Company', obCoP:'Company ABC',
    obShiftNum:'Number of shifts', obHours:'Hours per shift', obHoursCustom:'Or enter:', obHoursUnit:'h/shift',
    obWeeks:'Weeks per cycle',
    obShiftCountry:'Working country',
    days:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
    daysShort:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    months:['January','February','March','April','May','June','July','August','September','October','November','December'],
    salaryContract:'Contract salary / month', salaryDays:'Standard working days / month',
    salaryEst:'Estimated salary this month', salaryNet:'Estimated take-home pay',
    salarySave:'✓ Save salary info',
    dpStatus:'STATUS', dpActual:'ACTUAL HOURS', dpNote:'NOTE',
    dpReset:'Reset to shift', dpCancel:'Cancel', dpSave:'Save',
    dpTotalHours:'Total:', dpOT:'Overtime:',
    dpInTime:'Check-in', dpOutTime:'Check-out',
    dpNoteP:'Add a note for this day...',
    stCM:'Present', stCMSub:'Worked the full shift',
    stNP:'Leave', stNPSub:'Paid leave',
    stV:'Absent', stVSub:'Unpaid absence',
    stLL:'Holiday work', stLLSub:'By law',
    spPresent:'days present this month', spStart:'Start the workday',
    resetTitle:'Delete all data?',
    resetDesc:'All data will be permanently deleted. Cannot be recovered!',
    resetCancel:'Cancel', resetOk:'🗑 Delete All',
    exportPreview:'Preview data to export:',
    exportBtn:'📊 Export Excel (.csv)',
    n1Name:'Remind 30min before shift', n1Desc:'Notification before shift starts',
    n2Name:'Confirm break after 30min', n2Desc:'Ask for actual clock-out time',
    n3Name:'Auto check-in (GPS)', n3Desc:'Auto record when entering/leaving workplace',
    n4Name:'Weekly summary reminder', n4Desc:'View weekly summary every Friday',
    calEmpty:'No data for this month', noData:'No data',
    salaryDetail:'Enter salary info to auto-calculate',
  },
  ko:{
    appName:'근태관리 Pro', appSub:'스마트 출퇴근 · 법정 급여 계산',
    vaoCA:'출근', hetCA:'퇴근',
    batDauCa:'탭하여 출근 시작', ketThucCa:'퇴근 시 탭하세요',
    chuaChamCong:'미출근',
    gioLam:'이달 근무시간',
    binhThuong:'정상', chamChi:'열심히 ⚡', quaSuc:'과로 🔥',
    coMat:'출근', vang:'결근', nghiPhep:'연차', tangCa:'초과근무',
    chucNang:'기능',
    lich:'달력', thietLap:'설정', giaoDien:'테마', caiDat:'환경설정',
    luong:'급여', xuatExcel:'Excel 내보내기', thongBao:'알림', huongDan:'도움말',
    flGPS:'GPS', flUtil:'게임', flTax:'세금/보험',
    taxTitle:'🏛️ 세금 & 보험 안내',
    utilTitle:'🎮 게임', utilEmptyTitle:'게임 선택',
    utilEmptyDesc:'이 영역에 게임이 추가되었습니다.',
    taxSecIns:'🛡️ 사회보험 / 사회보장',
    taxSecDeduct:'💰 소득공제 / 인적공제',
    taxSecBrackets:'📊 소득세 구간 (누진세율)',
    taxSecPayroll:'⏱️ 법정 급여 계수',
    taxBandNo:'구간', taxBandIncome:'과세 소득', taxBandRate:'세율',
    taxInsRate:'납부 비율', taxInsCap:'월 기준소득 상한', taxInsMax:'월 최대 납부액',
    taxInsFlat:'정률', taxSS:'Social Security', taxSsCap:'SS 연간 상한', taxMedicare:'메디케어',
    taxPersonal:'본인', taxDependent:'부양가족', taxStandard:'기본공제',
    taxExempt:'0% (면세)', taxAbove:'초과',
    taxInsDeductY:'✓ 보험료 과세소득 공제 가능',
    taxInsDeductN:'⚠️ 보험료 과세소득 공제 불가',
    taxLocalTax:'지방소득세', taxResidentTax:'주민세',
    taxCalcBy:'기준', taxPeriodAnnual:'연간 (월 환산)', taxPeriodMonthly:'월',
    taxPerYear:'년', taxPerMonth:'월',
    taxNote:'2025년 기준 참고 데이터입니다. 실제 세금/보험은 회사 정책, 가족 상황에 따라 다를 수 있습니다.',
    luongUocTinh:'💼 이달 예상 급여',
    lichChamCong:'근태 달력',
    chipCM:'✓ 출근', chipV:'✕ 결근', chipNP:'☀ 연차', chipLL:'★ 휴일근무',
    navHome:'홈', navLich:'달력', navLuong:'급여', navCaiDat:'설정',
    settingsTitle:'설정',
    siLang:'언어', siCountry:'근무 국가',
    siSetup:'정보 설정', siSetupSub:'이름, 직책, 교대근무',
    siNotif:'알림 설정', siNotifSub:'출근 알림, 자동 체크인',
    siAppear:'화면 꾸미기', siAppearSub:'색상, 아바타, 배경',
    siAbout:'앱 정보', siAboutSub:'버전 2.2.0',
    siHelp:'사용 가이드', siHelpSub:'앱을 효과적으로 사용하는 방법',
    siDelete:'모든 데이터 삭제', siDeleteSub:'복구 불가',
    panelAppear:'⭐ 화면 꾸미기', panelNotif:'🔔 알림 설정',
    panelSalary:'💰 급여 계산', panelExcel:'📊 Excel 내보내기',
    panelSetup:'📝 정보 설정', panelHelp:'📖 사용 가이드',
    panelAbout:'ℹ️ 앱 정보', panelLang:'🌐 언어 선택',
    panelCountry:'🗺️ 근무 국가',
    closeBtn:'닫기',
    obLang:'환영합니다! 👋\n언어 선택', obLangSub:'표시 언어와 근무 국가를 선택하세요.',
    obUser:'내 정보 👤', obUserSub:'앱 개인화를 위해 정보를 입력하세요.',
    obShift:'근무 일정 ⏰', obShiftSub:'몇 교대 근무? 한 교대당 시간은?',
    obTime:'교대 시간 🕐', obTimeSub:'각 교대의 출퇴근 시간을 설정하세요.',
    obNext:'다음 →', obBack:'←', obStart:'앱 사용 시작 ✓',
    obName:'성명', obNameP:'홍길동',
    obJob:'직책', obJobP:'직원 / 근로자...',
    obCo:'회사명', obCoP:'ABC 회사',
    obShiftNum:'교대 수', obHours:'교대당 시간', obHoursCustom:'또는 입력:', obHoursUnit:'시간/교대',
    obWeeks:'주기당 주 수',
    obShiftCountry:'근무 국가',
    days:['일요일','월요일','화요일','수요일','목요일','금요일','토요일'],
    daysShort:['일','월','화','수','목','금','토'],
    months:['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
    salaryContract:'계약 급여 / 월', salaryDays:'월 기준 근무일수',
    salaryEst:'이달 예상 급여', salaryNet:'예상 실수령액',
    salarySave:'✓ 급여 정보 저장',
    dpStatus:'상태', dpActual:'실제 시간', dpNote:'메모',
    dpReset:'교대로 초기화', dpCancel:'취소', dpSave:'저장',
    dpTotalHours:'합계:', dpOT:'초과근무:',
    dpInTime:'출근 시간', dpOutTime:'퇴근 시간',
    dpNoteP:'이날의 메모를 추가하세요...',
    stCM:'출근', stCMSub:'정상 출근',
    stNP:'연차', stNPSub:'유급 휴가',
    stV:'결근', stVSub:'무단 결근',
    stLL:'휴일 근무', stLLSub:'법적 기준 적용',
    spPresent:'이달 출근일', spStart:'오늘 업무 시작',
    resetTitle:'모든 데이터를 삭제할까요?',
    resetDesc:'모든 데이터가 영구 삭제됩니다. 복구할 수 없습니다!',
    resetCancel:'취소', resetOk:'🗑 모두 삭제',
    exportPreview:'내보낼 데이터 미리보기:',
    exportBtn:'📊 Excel 파일 내보내기 (.csv)',
    n1Name:'출근 30분 전 알림', n1Desc:'교대 시작 전 알림',
    n2Name:'30분 후 퇴근 확인', n2Desc:'실제 퇴근 시간 확인',
    n3Name:'자동 체크인 (GPS)', n3Desc:'회사 구역 진입/이탈 시 자동 기록',
    n4Name:'주간 요약 알림', n4Desc:'매주 금요일 주간 요약 보기',
    calEmpty:'이달 데이터 없음', noData:'데이터 없음',
    salaryDetail:'급여 정보를 입력하면 자동 계산됩니다',
  },
  ja:{
    appName:'勤怠管理 Pro', appSub:'スマート出退勤 · 法定給与計算',
    vaoCA:'出勤', hetCA:'退勤',
    batDauCa:'タップして出勤', ketThucCa:'退勤時にタップ',
    chuaChamCong:'未打刻',
    gioLam:'今月の勤務時間',
    binhThuong:'通常', chamChi:'勤勉 ⚡', quaSuc:'過労 🔥',
    coMat:'出勤', vang:'欠勤', nghiPhep:'有給', tangCa:'残業',
    chucNang:'機能',
    lich:'カレンダー', thietLap:'設定', giaoDien:'外観', caiDat:'設定',
    luong:'給与', xuatExcel:'Excel出力', thongBao:'通知', huongDan:'ヘルプ',
    flGPS:'GPS', flUtil:'ゲーム', flTax:'税金・保険',
    taxTitle:'🏛️ 税金・保険ガイド',
    utilTitle:'🎮 ゲーム', utilEmptyTitle:'ゲームを選択',
    utilEmptyDesc:'このエリアにゲームが追加されました。',
    taxSecIns:'🛡️ 社会保険',
    taxSecDeduct:'💰 所得控除・人的控除',
    taxSecBrackets:'📊 所得税率表（累進課税）',
    taxSecPayroll:'⏱️ 法定給与係数',
    taxBandNo:'区分', taxBandIncome:'課税所得', taxBandRate:'税率',
    taxInsRate:'保険料率', taxInsCap:'月額上限（給与）', taxInsMax:'月最大額',
    taxInsFlat:'一律', taxSS:'Social Security', taxSsCap:'SS年間上限', taxMedicare:'メディケア',
    taxPersonal:'本人', taxDependent:'扶養家族', taxStandard:'基礎控除',
    taxExempt:'0%（非課税）', taxAbove:'超え',
    taxInsDeductY:'✓ 保険料は課税所得から控除可能',
    taxInsDeductN:'⚠️ 保険料は課税所得から控除不可',
    taxLocalTax:'住民税', taxResidentTax:'地方税',
    taxCalcBy:'計算基準', taxPeriodAnnual:'年間（月換算）', taxPeriodMonthly:'月',
    taxPerYear:'年', taxPerMonth:'月',
    taxNote:'2025年法令に基づく参考値です。実際の税額・保険料は会社方針・家族状況により異なります。',
    luongUocTinh:'💼 今月の給与見込み',
    lichChamCong:'勤怠カレンダー',
    chipCM:'✓ 出勤', chipV:'✕ 欠勤', chipNP:'☀ 有給', chipLL:'★ 休日出勤',
    navHome:'ホーム', navLich:'カレンダー', navLuong:'給与', navCaiDat:'設定',
    settingsTitle:'設定',
    siLang:'言語', siCountry:'勤務国',
    siSetup:'情報設定', siSetupSub:'氏名、職種、シフト',
    siNotif:'通知設定', siNotifSub:'出勤リマインダー、自動打刻',
    siAppear:'外観設定', siAppearSub:'色、アバター、背景',
    siAbout:'アプリ情報', siAboutSub:'バージョン 2.2.0',
    siHelp:'使用ガイド', siHelpSub:'アプリの効果的な使い方',
    siDelete:'全データ削除', siDeleteSub:'元に戻せません',
    panelAppear:'⭐ 外観設定', panelNotif:'🔔 通知設定',
    panelSalary:'💰 給与計算', panelExcel:'📊 Excel出力',
    panelSetup:'📝 情報設定', panelHelp:'📖 使用ガイド',
    panelAbout:'ℹ️ アプリ情報', panelLang:'🌐 言語選択',
    panelCountry:'🗺️ 勤務国',
    closeBtn:'閉じる',
    obLang:'ようこそ！ 👋\n言語選択', obLangSub:'表示言語と勤務国を選択してください。',
    obUser:'あなたの情報 👤', obUserSub:'アプリをパーソナライズするために情報を入力してください。',
    obShift:'勤務スケジュール ⏰', obShiftSub:'シフト数は？1シフトの時間は？',
    obTime:'シフト時間 🕐', obTimeSub:'各シフトの出退勤時間を設定してください。',
    obNext:'次へ →', obBack:'←', obStart:'アプリを開始 ✓',
    obName:'氏名', obNameP:'山田太郎',
    obJob:'職種', obJobP:'社員 / 作業員...',
    obCo:'会社名', obCoP:'ABC株式会社',
    obShiftNum:'シフト数', obHours:'1シフトの時間', obHoursCustom:'または入力:', obHoursUnit:'時間/シフト',
    obWeeks:'サイクル週数',
    obShiftCountry:'勤務国',
    days:['日曜日','月曜日','火曜日','水曜日','木曜日','金曜日','土曜日'],
    daysShort:['日','月','火','水','木','金','土'],
    months:['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    salaryContract:'契約給与 / 月', salaryDays:'月間基準勤務日数',
    salaryEst:'今月の給与見込み', salaryNet:'手取り見込み',
    salarySave:'✓ 給与情報を保存',
    dpStatus:'状態', dpActual:'実際の時間', dpNote:'メモ',
    dpReset:'シフトに戻す', dpCancel:'キャンセル', dpSave:'保存',
    dpTotalHours:'合計:', dpOT:'残業:',
    dpInTime:'出勤時間', dpOutTime:'退勤時間',
    dpNoteP:'この日のメモを追加...',
    stCM:'出勤', stCMSub:'通常出勤',
    stNP:'有給', stNPSub:'有給休暇',
    stV:'欠勤', stVSub:'無断欠勤',
    stLL:'休日出勤', stLLSub:'法定基準適用',
    spPresent:'今月の出勤日数', spStart:'今日の業務を開始',
    resetTitle:'全データを削除しますか？',
    resetDesc:'全データが永久に削除されます。元に戻せません！',
    resetCancel:'キャンセル', resetOk:'🗑 全て削除',
    exportPreview:'エクスポートデータのプレビュー:',
    exportBtn:'📊 Excelファイルを出力 (.csv)',
    n1Name:'30分前出勤リマインダー', n1Desc:'シフト開始前の通知',
    n2Name:'30分後退勤確認', n2Desc:'実際の退勤時間を確認',
    n3Name:'自動打刻 (GPS)', n3Desc:'職場エリア入退場時に自動記録',
    n4Name:'週次サマリーリマインダー', n4Desc:'毎週金曜日に週次サマリーを表示',
    calEmpty:'今月のデータなし', noData:'データなし',
    salaryDetail:'給与情報を入力すると自動計算されます',
  },
  zh:{
    appName:'考勤管理 Pro', appSub:'智能打卡 · 合规薪资计算',
    vaoCA:'上班打卡', hetCA:'下班打卡',
    batDauCa:'点击开始上班', ketThucCa:'下班时点击',
    chuaChamCong:'未打卡',
    gioLam:'本月工作时长',
    binhThuong:'正常', chamChi:'勤奋 ⚡', quaSuc:'过劳 🔥',
    coMat:'出勤', vang:'缺勤', nghiPhep:'请假', tangCa:'加班',
    chucNang:'功能',
    lich:'日历', thietLap:'设置', giaoDien:'外观', caiDat:'设置',
    luong:'薪资', xuatExcel:'导出Excel', thongBao:'通知', huongDan:'帮助',
    flGPS:'GPS', flUtil:'游戏', flTax:'税务/保险',
    taxTitle:'🏛️ 税务与保险指南',
    utilTitle:'🎮 游戏', utilEmptyTitle:'选择游戏',
    utilEmptyDesc:'游戏已添加到此区域。',
    taxSecIns:'🛡️ 社会保险',
    taxSecDeduct:'💰 个人免税额 / 扣除额',
    taxSecBrackets:'📊 个人所得税税率表（累进）',
    taxSecPayroll:'⏱️ 法定薪资系数',
    taxBandNo:'级', taxBandIncome:'应纳税所得额', taxBandRate:'税率',
    taxInsRate:'缴纳比例', taxInsCap:'月工资上限', taxInsMax:'月最高缴纳额',
    taxInsFlat:'固定税率', taxSS:'社会保障', taxSsCap:'SS年度上限', taxMedicare:'医疗保险',
    taxPersonal:'本人', taxDependent:'家属', taxStandard:'标准扣除额',
    taxExempt:'0%（免税）', taxAbove:'超过',
    taxInsDeductY:'✓ 社保费可从应税收入中扣除',
    taxInsDeductN:'⚠️ 社保费不可从应税收入扣除',
    taxLocalTax:'地方税', taxResidentTax:'居民税',
    taxCalcBy:'计算依据', taxPeriodAnnual:'年（换算月均）', taxPeriodMonthly:'月',
    taxPerYear:'年', taxPerMonth:'月',
    taxNote:'数据基于2025年法律，仅供参考。实际税/保险因公司政策及个人情况而异。',
    luongUocTinh:'💼 本月预计薪资',
    lichChamCong:'考勤日历',
    chipCM:'✓ 出勤', chipV:'✕ 缺勤', chipNP:'☀ 请假', chipLL:'★ 节假日工作',
    navHome:'主页', navLich:'日历', navLuong:'薪资', navCaiDat:'设置',
    settingsTitle:'设置',
    siLang:'语言', siCountry:'工作国家',
    siSetup:'信息设置', siSetupSub:'姓名、职位、班次',
    siNotif:'通知设置', siNotifSub:'上班提醒、自动打卡',
    siAppear:'外观设置', siAppearSub:'颜色、头像、背景',
    siAbout:'关于应用', siAboutSub:'版本 2.2.0',
    siHelp:'使用指南', siHelpSub:'如何高效使用应用',
    siDelete:'删除所有数据', siDeleteSub:'无法恢复',
    panelAppear:'⭐ 外观设置', panelNotif:'🔔 通知设置',
    panelSalary:'💰 薪资计算', panelExcel:'📊 导出Excel',
    panelSetup:'📝 信息设置', panelHelp:'📖 使用指南',
    panelAbout:'ℹ️ 关于应用', panelLang:'🌐 选择语言',
    panelCountry:'🗺️ 工作国家',
    closeBtn:'关闭',
    obLang:'欢迎！ 👋\n选择语言', obLangSub:'请选择显示语言和工作国家。',
    obUser:'您的信息 👤', obUserSub:'请输入个人信息以个性化应用。',
    obShift:'工作安排 ⏰', obShiftSub:'几个班次？每班多少小时？',
    obTime:'班次时间 🕐', obTimeSub:'为每个班次设置上下班时间。',
    obNext:'下一步 →', obBack:'←', obStart:'开始使用 ✓',
    obName:'姓名', obNameP:'张伟',
    obJob:'职位', obJobP:'员工 / 工人...',
    obCo:'公司名称', obCoP:'ABC公司',
    obShiftNum:'班次数量', obHours:'每班时长', obHoursCustom:'或输入:', obHoursUnit:'小时/班',
    obWeeks:'周期周数',
    obShiftCountry:'工作国家',
    days:['星期日','星期一','星期二','星期三','星期四','星期五','星期六'],
    daysShort:['日','一','二','三','四','五','六'],
    months:['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    salaryContract:'合同工资 / 月', salaryDays:'月基准工作天数',
    salaryEst:'本月预计薪资', salaryNet:'预计实到手薪资',
    salarySave:'✓ 保存薪资信息',
    dpStatus:'状态', dpActual:'实际时间', dpNote:'备注',
    dpReset:'重置为班次', dpCancel:'取消', dpSave:'保存',
    dpTotalHours:'合计:', dpOT:'加班:',
    dpInTime:'上班时间', dpOutTime:'下班时间',
    dpNoteP:'为这天添加备注...',
    stCM:'出勤', stCMSub:'正常出勤',
    stNP:'请假', stNPSub:'带薪假',
    stV:'缺勤', stVSub:'无故缺勤',
    stLL:'节假日工作', stLLSub:'按法律计算',
    spPresent:'本月出勤天数', spStart:'开始今天的工作',
    resetTitle:'删除所有数据？',
    resetDesc:'所有数据将被永久删除，无法恢复！',
    resetCancel:'取消', resetOk:'🗑 全部删除',
    exportPreview:'预览导出数据：',
    exportBtn:'📊 导出Excel文件 (.csv)',
    n1Name:'上班前30分钟提醒', n1Desc:'班次开始前通知',
    n2Name:'30分钟后确认下班', n2Desc:'确认实际下班时间',
    n3Name:'自动打卡 (GPS)', n3Desc:'进入/离开公司区域时自动记录',
    n4Name:'每周总结提醒', n4Desc:'每周五查看每周总结',
    calEmpty:'本月暂无数据', noData:'暂无数据',
    salaryDetail:'输入薪资信息以自动计算',
  },
  my:{
    appName:'လုပ်ငန်း Pro', appSub:'အလုပ်မှတ်တမ်း · လစာတွက်ချက်မှု',
    vaoCA:'တက်မှတ်', hetCA:'ဆင်းမှတ်',
    batDauCa:'နှိပ်ပြီးစတင်ပါ', ketThucCa:'ဆင်းချိန် နှိပ်ပါ',
    chuaChamCong:'မမှတ်ရသေး',
    gioLam:'ဤလ အလုပ်ချိန်',
    binhThuong:'ပုံမှန်', chamChi:'ကြိုးစား ⚡', quaSuc:'အလွန်အကျွံ 🔥',
    coMat:'တက်ရောက်', vang:'ပျက်ကွက်', nghiPhep:'ခွင့်', tangCa:'ချိန်ပို',
    chucNang:'လုပ်ဆောင်ချက်',
    lich:'ပြက္ခဒိန်', thietLap:'သတ်မှတ်', giaoDien:'ဒီဇိုင်း', caiDat:'ဆက်တင်',
    luong:'လစာ', xuatExcel:'Excel ထုတ်ယူ', thongBao:'အသိပေး', huongDan:'အကူအညီ',
    flGPS:'GPS', flUtil:'ဂိမ်းများ', flTax:'အခွန်/အာမခံ',
    taxTitle:'🏛️ အခွန် & အာမခံ လမ်းညွှန်',
    utilTitle:'🎮 ဂိမ်းများ', utilEmptyTitle:'ဂိမ်းရွေးပါ',
    utilEmptyDesc:'ဂိမ်းများကို ဤနေရာတွင် ထည့်ပြီးပါပြီ။',
    taxSecIns:'🛡️ လူမှုဖူလုံရေး / အာမခံ',
    taxSecDeduct:'💰 ကိုယ်ရေး ကင်းလွတ်ခွင့်',
    taxSecBrackets:'📊 ဝင်ငွေခွန် ဇယား (ပိုမိုကောက်ခံ)',
    taxSecPayroll:'⏱️ ဥပဒေနှင့်အညီ လစာကိန်းဂဏန်းများ',
    taxBandNo:'အဆင့်', taxBandIncome:'အခွန်ကျသင့်ဝင်ငွေ', taxBandRate:'နှုန်း',
    taxInsRate:'ထည့်ဝင်နှုန်း', taxInsCap:'လစာ အများဆုံး/လ', taxInsMax:'အများဆုံး/လ',
    taxInsFlat:'သတ်မှတ်နှုန်း', taxSS:'Social Security', taxSsCap:'SS နှစ်စဉ်ကန့်သတ်', taxMedicare:'Medicare',
    taxPersonal:'ကိုယ်တိုင်', taxDependent:'မှီခိုသူ', taxStandard:'ပုံသေနုတ်ငွေ',
    taxExempt:'0% (ကင်းလွတ်)', taxAbove:'ကျော်',
    taxInsDeductY:'✓ အာမခံ အခွန်မှ နုတ်ယူနိုင်',
    taxInsDeductN:'⚠️ အာမခံ အခွန်မှ နုတ်မရ',
    taxLocalTax:'ဒေသဆိုင်ရာ အခွန်', taxResidentTax:'နေထိုင်သူ အခွန်',
    taxCalcBy:'တွက်ချက်မူ', taxPeriodAnnual:'နှစ်စဉ် (လပေါင်းပြ)', taxPeriodMonthly:'လ',
    taxPerYear:'နှစ်', taxPerMonth:'လ',
    taxNote:'၂၀၂၅ ဥပဒေနှင့်အညီ ကိုးကားသာသုံးရမည်။ အမှန်တကယ် အခွန်/အာမခံ ကုမ္ပဏီမူဝါဒနှင့် မိသားစုအပေါ် မူတည်သည်။',
    luongUocTinh:'💼 ဤလ ခန့်မှန်းလစာ',
    lichChamCong:'တက်ရောက်မှု ပြက္ခဒိန်',
    chipCM:'✓ တက်', chipV:'✕ ပျက်', chipNP:'☀ ခွင့်', chipLL:'★ အားလပ်ရက်',
    navHome:'မူလ', navLich:'ပြက္ခဒိန်', navLuong:'လစာ', navCaiDat:'ဆက်တင်',
    settingsTitle:'ဆက်တင်',
    siLang:'ဘာသာစကား', siCountry:'အလုပ်လုပ်သောနိုင်ငံ',
    siSetup:'အချက်အလက်', siSetupSub:'အမည်၊ ရာထူး၊ Shift',
    siNotif:'အသိပေး', siNotifSub:'အချိန်သတိပေး',
    siAppear:'ဒီဇိုင်း', siAppearSub:'အရောင်၊ ဓာတ်ပုံ',
    siAbout:'အပ်အကြောင်း', siAboutSub:'ဗားရှင်း 2.2.0',
    siHelp:'အသုံးပြုနည်း', siHelpSub:'ထိရောက်စွာ အသုံးပြုနည်း',
    siDelete:'ဒေတာအားလုံးဖျက်', siDeleteSub:'ပြန်ရမည်မဟုတ်',
    panelAppear:'⭐ ဒီဇိုင်း', panelNotif:'🔔 အသိပေးချိန်',
    panelSalary:'💰 လစာ', panelExcel:'📊 Excel ထုတ်ယူ',
    panelSetup:'📝 အချက်အလက်', panelHelp:'📖 အသုံးပြုနည်း',
    panelAbout:'ℹ️ အပ်အကြောင်း', panelLang:'🌐 ဘာသာ',
    panelCountry:'🗺️ နိုင်ငံ',
    closeBtn:'ပိတ်',
    obLang:'ကြိုဆိုပါသည်! 👋\nဘာသာရွေးချယ်', obLangSub:'ဘာသာစကားနှင့်နိုင်ငံကိုရွေးချယ်ပါ',
    obUser:'သင့်အချက်အလက် 👤', obUserSub:'အပ်ကိုပုဂ္ဂိုလ်ဆိုင်ရာပြုလုပ်ရန်',
    obShift:'အလုပ်ချိန် ⏰', obShiftSub:'ဘယ်နှစ်ဆင်း? တစ်ဆင်းဘယ်နှစ်နာရီ?',
    obTime:'Shift အချိန် 🕐', obTimeSub:'တစ်ဆင်းချင်းအချိန်သတ်မှတ်ပါ',
    obNext:'ရှေ့ →', obBack:'←', obStart:'အပ်စတင် ✓',
    obName:'အမည်', obNameP:'ကိုစိုး',
    obJob:'ရာထူး', obJobP:'ဝန်ထမ်း...',
    obCo:'ကုမ္ပဏီ', obCoP:'ABC ကုမ္ပဏီ',
    obShiftNum:'Shift အရေ', obHours:'တစ်ဆင်းနာရီ', obHoursCustom:'သို့မဟုတ် ရိုက်ထည့်:', obHoursUnit:'နာရီ/ဆင်း',
    obWeeks:'Cycle ပတ်',
    obShiftCountry:'အလုပ်နိုင်ငံ',
    days:['တနင်္ဂနွေ','တနင်္လာ','အင်္ဂါ','ဗုဒ္ဓဟူး','ကြာသပတေး','သောကြာ','စနေ'],
    daysShort:['တ','တ','အ','ဗ','က','သ','စ'],
    months:['ဇန်နဝါရီ','ဖေဖော်ဝါရီ','မတ်','ဧပြီ','မေ','ဇွန်','ဇူလိုင်','သြဂုတ်','စက်တင်ဘာ','အောက်တိုဘာ','နိုဝင်ဘာ','ဒီဇင်ဘာ'],
    salaryContract:'စာချုပ်လစာ / လ', salaryDays:'လ ပုံမှန်အလုပ်ရက်',
    salaryEst:'ဤလ ခန့်မှန်းလစာ', salaryNet:'ခန့်မှန်းလက်ခံ',
    salarySave:'✓ လစာသိမ်း',
    dpStatus:'အခြေအနေ', dpActual:'အချိန်တိတိ', dpNote:'မှတ်ချက်',
    dpReset:'Shift အချိန်ပြန်', dpCancel:'ပယ်ဖျက်', dpSave:'သိမ်း',
    dpTotalHours:'စုစုပေါင်း:', dpOT:'ချိန်ပို:',
    dpInTime:'တက်ချိန်', dpOutTime:'ဆင်းချိန်',
    dpNoteP:'ဤနေ့အတွက်မှတ်ချက်ထည့်ပါ...',
    stCM:'တက်ရောက်', stCMSub:'ပုံမှန်တက်',
    stNP:'ခွင့်', stNPSub:'လစာပါ ခွင့်',
    stV:'ပျက်ကွက်', stVSub:'ခွင့်မဲ့',
    stLL:'အားလပ်ရက်', stLLSub:'ဥပဒေအတိုင်း',
    spPresent:'ဤလ တက်ရောက်ရက်', spStart:'ယနေ့အလုပ်စတင်',
    resetTitle:'ဒေတာအားလုံးဖျက်မလား?',
    resetDesc:'ဒေတာအားလုံး ပြန်မရနိုင်ဘဲ ဖျက်မည်!',
    resetCancel:'ပယ်ဖျက်', resetOk:'🗑 အားလုံးဖျက်',
    exportPreview:'ထုတ်ယူမည့်ဒေတာကြိုကြည့်:',
    exportBtn:'📊 Excel ထုတ်ယူ (.csv)',
    n1Name:'30မိနစ်ကြိုသတိပေး', n1Desc:'Shift မစမီ အသိပေး',
    n2Name:'30မိနစ်ပြီး ဆင်းအချိန်အတည်ပြု', n2Desc:'တိတိကျကျ ဆင်းချိန်မေးမြန်း',
    n3Name:'အလိုအလျောက် (GPS)', n3Desc:'ကုမ္ပဏီဝင်/ထွက်သောအခါ မှတ်တမ်း',
    n4Name:'အပတ်စဉ်နောင်',n4Desc:'သောကြာတိုင်းအပတ်ချုပ်',
    calEmpty:'ဤလတွင် ဒေတာမရှိသေးပါ', noData:'ဒေတာမရှိသေးပါ',
    salaryDetail:'လစာအချက်အလက် ထည့်ပါ',
  },

  th:{
    appName:'บันทึกเวลาทำงาน Pro', appSub:'บันทึกการทำงาน · คำนวณเงินเดือนตามกฎหมาย',
    vaoCA:'เข้างาน', hetCA:'ออกงาน',
    batDauCa:'กดเพื่อเริ่มกะ', ketThucCa:'กดเมื่อสิ้นสุดกะ',
    chuaChamCong:'ยังไม่ได้บันทึก',
    gioLam:'ชั่วโมงทำงานเดือนนี้',
    binhThuong:'ปกติ', chamChi:'ขยัน ⚡', quaSuc:'หนักเกินไป 🔥',
    coMat:'มาทำงาน', vang:'ขาดงาน', nghiPhep:'ลาพักร้อน', tangCa:'ล่วงเวลา',
    chucNang:'ฟังก์ชัน',
    lich:'ปฏิทิน', thietLap:'ตั้งค่า', giaoDien:'ธีม', caiDat:'การตั้งค่า',
    luong:'เงินเดือน', xuatExcel:'ส่งออก Excel', thongBao:'การแจ้งเตือน', huongDan:'คู่มือ',
    flGPS:'GPS', flUtil:'เกม', flTax:'ภาษี/ประกัน',
    taxTitle:'🏛️ คู่มือภาษีและประกันสังคม',
    utilTitle:'🎮 เกม', utilEmptyTitle:'เลือกเกม',
    utilEmptyDesc:'เพิ่มเกมไว้ในส่วนนี้แล้ว',
    taxSecIns:'🛡️ ประกันสังคม',
    taxSecDeduct:'💰 ค่าลดหย่อนส่วนตัว',
    taxSecBrackets:'📊 อัตราภาษีเงินได้บุคคลธรรมดา (อัตราก้าวหน้า)',
    taxSecPayroll:'⏱️ ค่าตอบแทนตามกฎหมาย',
    taxBandNo:'ระดับ', taxBandIncome:'รายได้ที่ต้องเสียภาษี', taxBandRate:'อัตราภาษี',
    taxInsRate:'อัตราการจ่าย', taxInsCap:'เพดานเงินเดือน/เดือน', taxInsMax:'จ่ายสูงสุด/เดือน',
    taxInsFlat:'อัตราคงที่', taxSS:'Social Security', taxSsCap:'เพดาน SS/ปี', taxMedicare:'Medicare',
    taxPersonal:'ส่วนตัว', taxDependent:'ผู้อยู่ในความดูแล', taxStandard:'ค่าลดหย่อนมาตรฐาน',
    taxExempt:'0% (ยกเว้น)', taxAbove:'เกิน',
    taxInsDeductY:'✓ หักประกันสังคมจากรายได้ที่ต้องเสียภาษีได้',
    taxInsDeductN:'⚠️ ไม่สามารถหักประกันสังคมจากรายได้ที่ต้องเสียภาษี',
    taxLocalTax:'ภาษีท้องถิ่น', taxResidentTax:'ภาษีถิ่นที่อยู่',
    taxCalcBy:'คำนวณตาม', taxPeriodAnnual:'ปี (แสดงรายเดือน)', taxPeriodMonthly:'เดือน',
    taxPerYear:'ปี', taxPerMonth:'เดือน',
    taxNote:'ข้อมูลอ้างอิงตามกฎหมายปี 2568 ภาษี/ประกันจริงขึ้นอยู่กับนโยบายบริษัทและสถานะครอบครัว',
    luongUocTinh:'💼 ประมาณการเงินเดือนเดือนนี้',
    lichChamCong:'ปฏิทินการทำงาน',
    chipCM:'✓ มาทำงาน', chipV:'✕ ขาดงาน', chipNP:'☀ ลา', chipLL:'★ ทำงานวันหยุด',
    navHome:'หน้าหลัก', navLich:'ปฏิทิน', navLuong:'เงินเดือน', navCaiDat:'การตั้งค่า',
    settingsTitle:'การตั้งค่า',
    siLang:'ภาษา', siCountry:'ประเทศที่ทำงาน',
    siSetup:'ตั้งค่าข้อมูล', siSetupSub:'ชื่อ ตำแหน่ง กะการทำงาน',
    siNotif:'การแจ้งเตือน', siNotifSub:'แจ้งเตือนเวลาทำงาน GPS',
    siAppear:'ธีม', siAppearSub:'สี รูปโปรไฟล์ พื้นหลัง',
    siAbout:'เกี่ยวกับแอป', siAboutSub:'เวอร์ชัน 2.2.0',
    siHelp:'คู่มือการใช้งาน', siHelpSub:'วิธีใช้งานแอปอย่างมีประสิทธิภาพ',
    siDelete:'ลบข้อมูลทั้งหมด', siDeleteSub:'ไม่สามารถกู้คืนได้',
    panelAppear:'⭐ ธีม', panelNotif:'🔔 การแจ้งเตือน',
    panelSalary:'💰 เงินเดือน', panelExcel:'📊 ส่งออก Excel',
    panelSetup:'📝 ตั้งค่าข้อมูล', panelHelp:'📖 คู่มือ',
    panelAbout:'ℹ️ เกี่ยวกับแอป', panelLang:'🌐 ภาษา',
    panelCountry:'🗺️ ประเทศ',
    closeBtn:'ปิด',
    obLang:'ยินดีต้อนรับ! 👋\nเลือกภาษา', obLangSub:'เลือกภาษาและประเทศที่ทำงาน',
    obUser:'ข้อมูลของคุณ 👤', obUserSub:'กรอกข้อมูลเพื่อปรับแต่งแอป',
    obShift:'ตารางงาน ⏰', obShiftSub:'กี่กะ? กี่ชั่วโมงต่อกะ?',
    obTime:'เวลากะ 🕐', obTimeSub:'ตั้งเวลาเข้า-ออกสำหรับแต่ละกะ',
    obNext:'ถัดไป →', obBack:'←', obStart:'เริ่มใช้งาน ✓',
    obName:'ชื่อ-นามสกุล', obNameP:'สมชาย ใจดี',
    obJob:'ตำแหน่งงาน', obJobP:'พนักงาน...',
    obCo:'บริษัท', obCoP:'บริษัท ABC',
    obShiftNum:'จำนวนกะ', obHours:'ชั่วโมง/กะ', obHoursCustom:'หรือใส่:', obHoursUnit:'ชม./กะ',
    obWeeks:'สัปดาห์/รอบ',
    obShiftCountry:'ประเทศที่ทำงาน',
    days:['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'],
    daysShort:['อา','จ','อ','พ','พฤ','ศ','ส'],
    months:['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'],
    salaryContract:'เงินเดือนสัญญา/เดือน', salaryDays:'วันทำงานมาตรฐาน/เดือน',
    salaryEst:'ประมาณการเดือนนี้', salaryNet:'ประมาณการรับสุทธิ',
    salarySave:'✓ บันทึกข้อมูลเงินเดือน',
    dpStatus:'สถานะ', dpActual:'ชั่วโมงจริง', dpNote:'หมายเหตุ',
    dpReset:'รีเซ็ตตามกะ', dpCancel:'ยกเลิก', dpSave:'บันทึก',
    dpTotalHours:'รวม:', dpOT:'ล่วงเวลา:',
    dpInTime:'เวลาเข้า', dpOutTime:'เวลาออก',
    dpNoteP:'เพิ่มหมายเหตุสำหรับวันนี้...',
    stCM:'มาทำงาน', stCMSub:'ทำงานครบกะ',
    stNP:'ลาพักร้อน', stNPSub:'ลาโดยได้รับค่าจ้าง',
    stV:'ขาดงาน', stVSub:'ขาดโดยไม่ได้รับค่าจ้าง',
    stLL:'ทำงานวันหยุด', stLLSub:'ตามกฎหมาย',
    spPresent:'วันมาทำงานเดือนนี้', spStart:'เริ่มต้นวันทำงาน',
    resetTitle:'ลบข้อมูลทั้งหมด?',
    resetDesc:'ข้อมูลทั้งหมดจะถูกลบถาวร ไม่สามารถกู้คืนได้!',
    resetCancel:'ยกเลิก', resetOk:'🗑 ลบทั้งหมด',
    exportPreview:'ตัวอย่างข้อมูลที่จะส่งออก:',
    exportBtn:'📊 ส่งออก Excel (.csv)',
    n1Name:'แจ้งเตือนก่อน 30 นาที', n1Desc:'แจ้งก่อนกะเริ่ม',
    n2Name:'ยืนยันหลัง 30 นาที', n2Desc:'ถามเวลาออกจริง',
    n3Name:'เช็คชื่ออัตโนมัติ (GPS)', n3Desc:'บันทึกอัตโนมัติเมื่อเข้า/ออกบริษัท',
    n4Name:'สรุปรายสัปดาห์', n4Desc:'ดูสรุปทุกวันศุกร์',
    calEmpty:'ไม่มีข้อมูลเดือนนี้', noData:'ไม่มีข้อมูล',
    salaryDetail:'กรอกข้อมูลเงินเดือนเพื่อคำนวณอัตโนมัติ',
  },
  id:{
    appName:'Absensi Pro', appSub:'Catat Waktu Kerja · Hitung Gaji Sesuai Hukum',
    vaoCA:'MASUK', hetCA:'KELUAR',
    batDauCa:'Tekan untuk mulai shift', ketThucCa:'Tekan saat shift selesai',
    chuaChamCong:'Belum absen',
    gioLam:'Jam kerja bulan ini',
    binhThuong:'Normal', chamChi:'Rajin ⚡', quaSuc:'Terlalu berat 🔥',
    coMat:'Hadir', vang:'Absen', nghiPhep:'Cuti', tangCa:'Lembur',
    chucNang:'Fitur',
    lich:'Kalender', thietLap:'Pengaturan', giaoDien:'Tampilan', caiDat:'Setelan',
    luong:'Gaji', xuatExcel:'Ekspor Excel', thongBao:'Notifikasi', huongDan:'Panduan',
    flGPS:'GPS', flUtil:'Game', flTax:'Pajak/Asuransi',
    taxTitle:'🏛️ Panduan Pajak & Asuransi',
    utilTitle:'🎮 Game', utilEmptyTitle:'Pilih game',
    utilEmptyDesc:'Game telah ditambahkan di area ini.',
    taxSecIns:'🛡️ JAMINAN SOSIAL / BPJS',
    taxSecDeduct:'💰 PENGURANGAN PRIBADI / PTKP',
    taxSecBrackets:'📊 TARIF PPh PASAL 21 (PROGRESIF)',
    taxSecPayroll:'⏱️ KOEFISIEN UPAH SESUAI HUKUM',
    taxBandNo:'Lapisan', taxBandIncome:'Penghasilan Kena Pajak', taxBandRate:'Tarif Pajak',
    taxInsRate:'Tarif iuran', taxInsCap:'Batas gaji/bulan', taxInsMax:'Iuran maks/bulan',
    taxInsFlat:'Tarif tetap', taxSS:'Social Security', taxSsCap:'Batas SS/tahun', taxMedicare:'Medicare',
    taxPersonal:'Pribadi', taxDependent:'Tanggungan', taxStandard:'Pengurangan standar',
    taxExempt:'0% (bebas)', taxAbove:'Di atas',
    taxInsDeductY:'✓ Iuran BPJS dapat dikurangkan dari penghasilan kena pajak',
    taxInsDeductN:'⚠️ Iuran BPJS TIDAK dapat dikurangkan dari penghasilan kena pajak',
    taxLocalTax:'Pajak daerah', taxResidentTax:'Pajak penduduk',
    taxCalcBy:'Dihitung per', taxPeriodAnnual:'tahun (dibagi bulanan)', taxPeriodMonthly:'bulan',
    taxPerYear:'tahun', taxPerMonth:'bulan',
    taxNote:'Data referensi berdasarkan hukum 2025. Pajak/asuransi aktual tergantung kebijakan perusahaan dan kondisi keluarga.',
    luongUocTinh:'💼 Estimasi gaji bulan ini',
    lichChamCong:'Kalender Kehadiran',
    chipCM:'✓ Hadir', chipV:'✕ Absen', chipNP:'☀ Cuti', chipLL:'★ Kerja Hari Libur',
    navHome:'Beranda', navLich:'Kalender', navLuong:'Gaji', navCaiDat:'Setelan',
    settingsTitle:'Setelan',
    siLang:'Bahasa', siCountry:'Negara kerja',
    siSetup:'Info Pengaturan', siSetupSub:'Nama, jabatan, shift kerja',
    siNotif:'Notifikasi', siNotifSub:'Pengingat kerja, absen otomatis',
    siAppear:'Tampilan', siAppearSub:'Warna, avatar, latar belakang',
    siAbout:'Tentang Aplikasi', siAboutSub:'Versi 2.2.0',
    siHelp:'Panduan Pengguna', siHelpSub:'Cara menggunakan aplikasi',
    siDelete:'Hapus Semua Data', siDeleteSub:'Tidak dapat dipulihkan',
    panelAppear:'⭐ Tampilan', panelNotif:'🔔 Notifikasi',
    panelSalary:'💰 Gaji', panelExcel:'📊 Ekspor Excel',
    panelSetup:'📝 Info Pengaturan', panelHelp:'📖 Panduan',
    panelAbout:'ℹ️ Tentang Aplikasi', panelLang:'🌐 Bahasa',
    panelCountry:'🗺️ Negara',
    closeBtn:'Tutup',
    obLang:'Selamat Datang! 👋\nPilih Bahasa', obLangSub:'Pilih bahasa dan negara tempat bekerja.',
    obUser:'Info Anda 👤', obUserSub:'Masukkan info untuk personalisasi.',
    obShift:'Jadwal Kerja ⏰', obShiftSub:'Berapa shift? Jam per shift?',
    obTime:'Jam Shift 🕐', obTimeSub:'Atur jam masuk-keluar tiap shift.',
    obNext:'Lanjut →', obBack:'←', obStart:'Mulai Gunakan ✓',
    obName:'Nama Lengkap', obNameP:'Budi Santoso',
    obJob:'Jabatan', obJobP:'Karyawan...',
    obCo:'Perusahaan', obCoP:'PT ABC',
    obShiftNum:'Jumlah shift', obHours:'Jam/shift', obHoursCustom:'Atau ketik:', obHoursUnit:'jam/shift',
    obWeeks:'Minggu/siklus',
    obShiftCountry:'Negara kerja',
    days:['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'],
    daysShort:['Min','Sen','Sel','Rab','Kam','Jum','Sab'],
    months:['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],
    salaryContract:'Gaji kontrak/bulan', salaryDays:'Hari kerja standar/bulan',
    salaryEst:'Estimasi gaji bulan ini', salaryNet:'Estimasi gaji bersih',
    salarySave:'✓ Simpan info gaji',
    dpStatus:'STATUS', dpActual:'JAM AKTUAL', dpNote:'CATATAN',
    dpReset:'Reset ke shift', dpCancel:'Batal', dpSave:'Simpan',
    dpTotalHours:'Total:', dpOT:'Lembur:',
    dpInTime:'Jam masuk', dpOutTime:'Jam keluar',
    dpNoteP:'Tambahkan catatan untuk hari ini...',
    stCM:'Hadir', stCMSub:'Masuk penuh shift',
    stNP:'Cuti', stNPSub:'Cuti berbayar',
    stV:'Absen', stVSub:'Absen tidak berbayar',
    stLL:'Kerja Hari Libur', stLLSub:'Sesuai hukum',
    spPresent:'hari hadir bulan ini', spStart:'Mulai hari kerja',
    resetTitle:'Hapus semua data?',
    resetDesc:'Semua data akan dihapus permanen. Tidak dapat dipulihkan!',
    resetCancel:'Batal', resetOk:'🗑 Hapus Semua',
    exportPreview:'Pratinjau data yang akan diekspor:',
    exportBtn:'📊 Ekspor Excel (.csv)',
    n1Name:'Ingatkan 30 menit sebelum shift', n1Desc:'Notifikasi sebelum shift mulai',
    n2Name:'Konfirmasi setelah 30 menit', n2Desc:'Tanya jam keluar aktual',
    n3Name:'Absen Otomatis (GPS)', n3Desc:'Catat otomatis saat masuk/keluar area',
    n4Name:'Ringkasan mingguan', n4Desc:'Lihat ringkasan tiap Jumat',
    calEmpty:'Tidak ada data bulan ini', noData:'Tidak ada data',
    salaryDetail:'Masukkan info gaji untuk kalkulasi otomatis',
  },
  ph:{
    appName:'Attendance Pro', appSub:'I-record ang Oras · Kalkulahin ang Sahod',
    vaoCA:'PUMASOK', hetCA:'LUMABAS',
    batDauCa:'Pindutin para magsimula', ketThucCa:'Pindutin sa katapusan ng shift',
    chuaChamCong:'Hindi pa naka-record',
    gioLam:'Oras ng trabaho ngayong buwan',
    binhThuong:'Normal', chamChi:'Masipag ⚡', quaSuc:'Sobrang pagod 🔥',
    coMat:'Dumalo', vang:'Absent', nghiPhep:'Leave', tangCa:'Overtime',
    chucNang:'Mga Feature',
    lich:'Kalendaryo', thietLap:'Setup', giaoDien:'Hitsura', caiDat:'Settings',
    luong:'Sahod', xuatExcel:'I-export sa Excel', thongBao:'Mga Abiso', huongDan:'Gabay',
    flGPS:'GPS', flUtil:'Mga Laro', flTax:'Buwis/Seguro',
    taxTitle:'🏛️ Gabay sa Buwis at Seguro',
    utilTitle:'🎮 Mga Laro', utilEmptyTitle:'Pumili ng laro',
    utilEmptyDesc:'Naidagdag na ang mga laro sa bahaging ito.',
    taxSecIns:'🛡️ SOCIAL INSURANCE / SSS',
    taxSecDeduct:'💰 PERSONAL EXEMPTION / DEDUCTIONS',
    taxSecBrackets:'📊 INCOME TAX BRACKETS (PROGRESIBO)',
    taxSecPayroll:'⏱️ STATUTORY PAY RATES',
    taxBandNo:'Antas', taxBandIncome:'Taxable na kita', taxBandRate:'Tax rate',
    taxInsRate:'Rate ng kontribusyon', taxInsCap:'Limitasyon ng sahod/buwan', taxInsMax:'Pinakamataas/buwan',
    taxInsFlat:'Flat rate', taxSS:'Social Security', taxSsCap:'SS cap/taon', taxMedicare:'Medicare',
    taxPersonal:'Personal', taxDependent:'Dependent', taxStandard:'Standard deduction',
    taxExempt:'0% (exempt)', taxAbove:'Higit sa',
    taxInsDeductY:'✓ Ang insurance ay mababawas mula sa taxable income',
    taxInsDeductN:'⚠️ Ang insurance ay HINDI mababawas mula sa taxable income',
    taxLocalTax:'Local tax', taxResidentTax:'Resident tax',
    taxCalcBy:'Batay sa', taxPeriodAnnual:'taon (ipinapakita buwanang)', taxPeriodMonthly:'buwan',
    taxPerYear:'taon', taxPerMonth:'buwan',
    taxNote:'Sangguniang datos batay sa batas 2025. Ang aktwal na buwis/seguro ay depende sa patakaran ng kumpanya at katayuan ng pamilya.',
    luongUocTinh:'💼 Tinatantiyang sahod ngayong buwan',
    lichChamCong:'Kalendaryo ng Attendance',
    chipCM:'✓ Dumalo', chipV:'✕ Absent', chipNP:'☀ Leave', chipLL:'★ Holiday Work',
    navHome:'Home', navLich:'Kalendaryo', navLuong:'Sahod', navCaiDat:'Settings',
    settingsTitle:'Settings',
    siLang:'Wika', siCountry:'Bansang pinagtatrabahuhan',
    siSetup:'Setup ng Info', siSetupSub:'Pangalan, trabaho, shift',
    siNotif:'Mga Abiso', siNotifSub:'Paalala ng trabaho, auto check-in',
    siAppear:'Hitsura', siAppearSub:'Kulay, avatar, background',
    siAbout:'Tungkol sa App', siAboutSub:'Bersyon 2.2.0',
    siHelp:'Gabay ng Gumagamit', siHelpSub:'Paano gamitin ang app',
    siDelete:'Burahin Lahat ng Data', siDeleteSub:'Hindi na mababawi',
    panelAppear:'⭐ Hitsura', panelNotif:'🔔 Mga Abiso',
    panelSalary:'💰 Sahod', panelExcel:'📊 I-export sa Excel',
    panelSetup:'📝 Setup ng Info', panelHelp:'📖 Gabay',
    panelAbout:'ℹ️ Tungkol sa App', panelLang:'🌐 Wika',
    panelCountry:'🗺️ Bansa',
    closeBtn:'Isara',
    obLang:'Maligayang pagdating! 👋\nPiliin ang Wika', obLangSub:'Piliin ang wika at bansang pinagtatrabahuhan.',
    obUser:'Iyong Impormasyon 👤', obUserSub:'Ilagay ang info para i-personalize ang app.',
    obShift:'Iskedyul ng Trabaho ⏰', obShiftSub:'Ilang shift? Ilang oras bawat shift?',
    obTime:'Oras ng Shift 🕐', obTimeSub:'Itakda ang oras ng pasok at labas.',
    obNext:'Susunod →', obBack:'←', obStart:'Simulan ang Paggamit ✓',
    obName:'Buong Pangalan', obNameP:'Juan dela Cruz',
    obJob:'Trabaho', obJobP:'Empleyado...',
    obCo:'Kumpanya', obCoP:'ABC Company',
    obShiftNum:'Bilang ng shift', obHours:'Oras/shift', obHoursCustom:'O ilagay:', obHoursUnit:'oras/shift',
    obWeeks:'Linggo/siklo',
    obShiftCountry:'Bansang pinagtatrabahuhan',
    days:['Linggo','Lunes','Martes','Miyerkules','Huwebes','Biyernes','Sabado'],
    daysShort:['Lin','Lun','Mar','Miy','Huw','Biy','Sab'],
    months:['Enero','Pebrero','Marso','Abril','Mayo','Hunyo','Hulyo','Agosto','Setyembre','Oktubre','Nobyembre','Disyembre'],
    salaryContract:'Kontratang sahod/buwan', salaryDays:'Karaniwang araw ng trabaho/buwan',
    salaryEst:'Tinatantiyang sahod ngayong buwan', salaryNet:'Tinatantiyang take-home pay',
    salarySave:'✓ I-save ang impormasyon ng sahod',
    dpStatus:'KATAYUAN', dpActual:'AKTWAL NA ORAS', dpNote:'TALA',
    dpReset:'I-reset sa shift', dpCancel:'Kanselahin', dpSave:'I-save',
    dpTotalHours:'Kabuuan:', dpOT:'Overtime:',
    dpInTime:'Oras ng pasok', dpOutTime:'Oras ng labas',
    dpNoteP:'Magdagdag ng tala para sa araw na ito...',
    stCM:'Dumalo', stCMSub:'Kumpleto ang shift',
    stNP:'Leave', stNPSub:'Bayad na leave',
    stV:'Absent', stVSub:'Absent na walang bayad',
    stLL:'Holiday Work', stLLSub:'Ayon sa batas',
    spPresent:'araw ng pagdalo ngayong buwan', spStart:'Simulan ang araw ng trabaho',
    resetTitle:'Burahin ang lahat ng data?',
    resetDesc:'Lahat ng data ay permanenteng mabubura. Hindi na mababawi!',
    resetCancel:'Kanselahin', resetOk:'🗑 Burahin Lahat',
    exportPreview:'Preview ng data na ie-export:',
    exportBtn:'📊 I-export sa Excel (.csv)',
    n1Name:'Paalala 30 minuto bago shift', n1Desc:'Abiso bago magsimula ang shift',
    n2Name:'Kumpirmahin pagkatapos ng 30 minuto', n2Desc:'Tanungin ang aktwal na oras ng labas',
    n3Name:'Auto check-in (GPS)', n3Desc:'Awtomatikong i-record sa pasukan/labasan ng opisina',
    n4Name:'Lingguhang buod', n4Desc:'Tingnan ang buod tuwing Biyernes',
    calEmpty:'Walang data ngayong buwan', noData:'Walang data',
    salaryDetail:'Ilagay ang impormasyon ng sahod para awtomatikong kalkulahin',
  },
  ne:{
    appName:'हाजिरी Pro', appSub:'समय ट्र्याक गर्नुस् · कानुनी तलब गणना',
    vaoCA:'हाजिर', hetCA:'विदाइ',
    batDauCa:'सिफ्ट सुरु गर्न थिच्नुस्', ketThucCa:'सिफ्ट सकिँदा थिच्नुस्',
    chuaChamCong:'अझै रेकर्ड गरिएको छैन',
    gioLam:'यो महिनाको कार्य घण्टा',
    binhThuong:'सामान्य', chamChi:'मेहनती ⚡', quaSuc:'अति थकित 🔥',
    coMat:'उपस्थित', vang:'अनुपस्थित', nghiPhep:'बिदा', tangCa:'ओभरटाइम',
    chucNang:'सुविधाहरू',
    lich:'क्यालेन्डर', thietLap:'सेटअप', giaoDien:'थिम', caiDat:'सेटिङ',
    luong:'तलब', xuatExcel:'Excel निर्यात', thongBao:'सूचनाहरू', huongDan:'गाइड',
    flGPS:'GPS', flUtil:'खेलहरू', flTax:'कर/बीमा',
    taxTitle:'🏛️ कर र बीमा गाइड',
    utilTitle:'🎮 खेलहरू', utilEmptyTitle:'खेल छान्नुहोस्',
    utilEmptyDesc:'खेलहरू यस क्षेत्रमा थपिएका छन्।',
    taxSecIns:'🛡️ सामाजिक बीमा',
    taxSecDeduct:'💰 व्यक्तिगत छुट',
    taxSecBrackets:'📊 आयकर स्ल्याब (प्रगतिशील)',
    taxSecPayroll:'⏱️ कानुनी पारिश्रमिक दर',
    taxBandNo:'स्ल्याब', taxBandIncome:'करयोग्य आय', taxBandRate:'कर दर',
    taxInsRate:'योगदान दर', taxInsCap:'तलब सीमा/महिना', taxInsMax:'अधिकतम/महिना',
    taxInsFlat:'एकल दर', taxSS:'Social Security', taxSsCap:'SS सीमा/वर्ष', taxMedicare:'Medicare',
    taxPersonal:'व्यक्तिगत', taxDependent:'आश्रित', taxStandard:'मानक कटौती',
    taxExempt:'0% (छुट)', taxAbove:'माथि',
    taxInsDeductY:'✓ बीमा करयोग्य आयबाट कटाउन सकिन्छ',
    taxInsDeductN:'⚠️ बीमा करयोग्य आयबाट कटाउन सकिँदैन',
    taxLocalTax:'स्थानीय कर', taxResidentTax:'आवासीय कर',
    taxCalcBy:'आधारमा', taxPeriodAnnual:'वार्षिक (मासिक देखाइन्छ)', taxPeriodMonthly:'महिनाको',
    taxPerYear:'वर्ष', taxPerMonth:'महिना',
    taxNote:'२०२५ को कानुनमा आधारित सन्दर्भ डेटा। वास्तविक कर/बीमा कम्पनीको नीति र पारिवारिक अवस्थामा निर्भर छ।',
    luongUocTinh:'💼 यो महिनाको अनुमानित तलब',
    lichChamCong:'हाजिरी क्यालेन्डर',
    chipCM:'✓ उपस्थित', chipV:'✕ अनुपस्थित', chipNP:'☀ बिदा', chipLL:'★ छुट्टीमा काम',
    navHome:'होम', navLich:'क्यालेन्डर', navLuong:'तलब', navCaiDat:'सेटिङ',
    settingsTitle:'सेटिङ',
    siLang:'भाषा', siCountry:'काम गर्ने देश',
    siSetup:'जानकारी सेटअप', siSetupSub:'नाम, पद, सिफ्ट',
    siNotif:'सूचनाहरू', siNotifSub:'काम रिमाइन्डर, GPS',
    siAppear:'थिम', siAppearSub:'रङ, अवतार, पृष्ठभूमि',
    siAbout:'एपको बारेमा', siAboutSub:'संस्करण 2.2.0',
    siHelp:'प्रयोगकर्ता गाइड', siHelpSub:'एप प्रभावकारी रूपमा कसरी प्रयोग गर्ने',
    siDelete:'सबै डेटा मेटाउनुस्', siDeleteSub:'पुनः प्राप्त गर्न सकिँदैन',
    panelAppear:'⭐ थिम', panelNotif:'🔔 सूचनाहरू',
    panelSalary:'💰 तलब', panelExcel:'📊 Excel निर्यात',
    panelSetup:'📝 जानकारी सेटअप', panelHelp:'📖 गाइड',
    panelAbout:'ℹ️ एपको बारेमा', panelLang:'🌐 भाषा',
    panelCountry:'🗺️ देश',
    closeBtn:'बन्द गर्नुस्',
    obLang:'स्वागत छ! 👋\nभाषा चयन गर्नुस्', obLangSub:'भाषा र कार्यस्थल देश चयन गर्नुस्।',
    obUser:'तपाईंको जानकारी 👤', obUserSub:'एप व्यक्तिगत बनाउन जानकारी भर्नुस्।',
    obShift:'कार्य तालिका ⏰', obShiftSub:'कति सिफ्ट? प्रति सिफ्ट कति घण्टा?',
    obTime:'सिफ्ट समय 🕐', obTimeSub:'प्रत्येक सिफ्टको समय सेट गर्नुस्।',
    obNext:'अर्को →', obBack:'←', obStart:'एप सुरु गर्नुस् ✓',
    obName:'पूरा नाम', obNameP:'राम श्रेष्ठ',
    obJob:'पद', obJobP:'कर्मचारी...',
    obCo:'कम्पनी', obCoP:'ABC कम्पनी',
    obShiftNum:'सिफ्ट संख्या', obHours:'घण्टा/सिफ्ट', obHoursCustom:'वा प्रविष्ट:', obHoursUnit:'घन्टा/पाली',
    obWeeks:'हप्ता/चक्र',
    obShiftCountry:'काम गर्ने देश',
    days:['आइतबार','सोमबार','मङ्गलबार','बुधबार','बिहिबार','शुक्रबार','शनिबार'],
    daysShort:['आइत','सोम','मङ्गल','बुध','बिहि','शुक्र','शनि'],
    months:['जनवरी','फेब्रुअरी','मार्च','अप्रिल','मे','जुन','जुलाई','अगस्ट','सेप्टेम्बर','अक्टोबर','नोभेम्बर','डिसेम्बर'],
    salaryContract:'सम्झौता तलब/महिना', salaryDays:'मानक कार्य दिन/महिना',
    salaryEst:'यो महिनाको अनुमानित तलब', salaryNet:'अनुमानित शुद्ध तलब',
    salarySave:'✓ तलब जानकारी सुरक्षित गर्नुस्',
    dpStatus:'अवस्था', dpActual:'वास्तविक समय', dpNote:'टिप्पणी',
    dpReset:'सिफ्टमा रिसेट', dpCancel:'रद्द गर्नुस्', dpSave:'सुरक्षित गर्नुस्',
    dpTotalHours:'जम्मा:', dpOT:'ओभरटाइम:',
    dpInTime:'प्रवेश समय', dpOutTime:'निस्कने समय',
    dpNoteP:'आजको लागि टिप्पणी थप्नुस्...',
    stCM:'उपस्थित', stCMSub:'पूर्ण सिफ्ट गरियो',
    stNP:'बिदा', stNPSub:'पारिश्रमिक सहित बिदा',
    stV:'अनुपस्थित', stVSub:'बिना पारिश्रमिक अनुपस्थित',
    stLL:'छुट्टीमा काम', stLLSub:'कानुन अनुसार',
    spPresent:'यो महिना उपस्थिति दिन', spStart:'कार्य दिन सुरु गर्नुस्',
    resetTitle:'सबै डेटा मेटाउने?',
    resetDesc:'सबै डेटा स्थायी रूपमा मेटिनेछ। पुनः प्राप्त गर्न सकिँदैन!',
    resetCancel:'रद्द', resetOk:'🗑 सबै मेटाउनुस्',
    exportPreview:'निर्यात हुने डेटाको पूर्वावलोकन:',
    exportBtn:'📊 Excel निर्यात (.csv)',
    n1Name:'३० मिनेट अघि रिमाइन्डर', n1Desc:'सिफ्ट सुरु हुनु अघि सूचना',
    n2Name:'३० मिनेट पछि पुष्टि', n2Desc:'वास्तविक निस्कने समय सोध्नुस्',
    n3Name:'स्वचालित हाजिरी (GPS)', n3Desc:'कार्यालय क्षेत्रमा प्रवेश/निस्किँदा स्वतः रेकर्ड',
    n4Name:'साप्ताहिक सारांश', n4Desc:'प्रत्येक शुक्रबार सारांश हेर्नुस्',
    calEmpty:'यो महिना डेटा छैन', noData:'डेटा छैन',
    salaryDetail:'स्वतः गणनाको लागि तलब जानकारी भर्नुस्',
  },
  hi:{
    appName:'उपस्थिति Pro', appSub:'काम का समय रिकॉर्ड करें · वेतन गणना',
    vaoCA:'उपस्थित', hetCA:'प्रस्थान',
    batDauCa:'शिफ्ट शुरू करने के लिए दबाएं', ketThucCa:'शिफ्ट समाप्त होने पर दबाएं',
    chuaChamCong:'अभी तक रिकॉर्ड नहीं किया',
    gioLam:'इस महीने काम के घंटे',
    binhThuong:'सामान्य', chamChi:'मेहनती ⚡', quaSuc:'बहुत थका हुआ 🔥',
    coMat:'उपस्थित', vang:'अनुपस्थित', nghiPhep:'छुट्टी', tangCa:'ओवरटाइम',
    chucNang:'सुविधाएँ',
    lich:'कैलेंडर', thietLap:'सेटअप', giaoDien:'थीम', caiDat:'सेटिंग',
    luong:'वेतन', xuatExcel:'Excel में निर्यात', thongBao:'सूचनाएं', huongDan:'मार्गदर्शिका',
    flGPS:'GPS', flUtil:'गेम', flTax:'कर/बीमा',
    taxTitle:'🏛️ कर और बीमा मार्गदर्शिका',
    utilTitle:'🎮 गेम', utilEmptyTitle:'गेम चुनें',
    utilEmptyDesc:'गेम इस क्षेत्र में जोड़ दिए गए हैं।',
    taxSecIns:'🛡️ सामाजिक बीमा / भविष्य निधि',
    taxSecDeduct:'💰 व्यक्तिगत छूट / कटौती',
    taxSecBrackets:'📊 आयकर स्लैब (प्रगतिशील)',
    taxSecPayroll:'⏱️ कानूनी वेतन दर',
    taxBandNo:'स्लैब', taxBandIncome:'कर योग्य आय', taxBandRate:'कर दर',
    taxInsRate:'अंशदान दर', taxInsCap:'वेतन सीमा/माह', taxInsMax:'अधिकतम/माह',
    taxInsFlat:'एकल दर', taxSS:'Social Security', taxSsCap:'SS सीमा/वर्ष', taxMedicare:'Medicare',
    taxPersonal:'व्यक्तिगत', taxDependent:'आश्रित', taxStandard:'मानक कटौती',
    taxExempt:'0% (छूट)', taxAbove:'से अधिक',
    taxInsDeductY:'✓ बीमा कर योग्य आय से काटा जा सकता है',
    taxInsDeductN:'⚠️ बीमा कर योग्य आय से नहीं काटा जा सकता',
    taxLocalTax:'स्थानीय कर', taxResidentTax:'निवासी कर',
    taxCalcBy:'आधार', taxPeriodAnnual:'वार्षिक (मासिक दिखाया)', taxPeriodMonthly:'माह',
    taxPerYear:'वर्ष', taxPerMonth:'माह',
    taxNote:'2025 के कानून के अनुसार संदर्भ डेटा। वास्तविक कर/बीमा कंपनी की नीति और पारिवारिक स्थिति पर निर्भर करता है।',
    luongUocTinh:'💼 इस महीने का अनुमानित वेतन',
    lichChamCong:'उपस्थिति कैलेंडर',
    chipCM:'✓ उपस्थित', chipV:'✕ अनुपस्थित', chipNP:'☀ छुट्टी', chipLL:'★ छुट्टी पर काम',
    navHome:'होम', navLich:'कैलेंडर', navLuong:'वेतन', navCaiDat:'सेटिंग',
    settingsTitle:'सेटिंग',
    siLang:'भाषा', siCountry:'कार्यस्थल देश',
    siSetup:'जानकारी सेटअप', siSetupSub:'नाम, पद, शिफ्ट',
    siNotif:'सूचनाएं', siNotifSub:'काम रिमाइंडर, GPS',
    siAppear:'थीम', siAppearSub:'रंग, अवतार, पृष्ठभूमि',
    siAbout:'ऐप के बारे में', siAboutSub:'संस्करण 2.2.0',
    siHelp:'उपयोगकर्ता मार्गदर्शिका', siHelpSub:'ऐप को प्रभावी ढंग से कैसे उपयोग करें',
    siDelete:'सभी डेटा हटाएं', siDeleteSub:'पुनः प्राप्त नहीं किया जा सकता',
    panelAppear:'⭐ थीम', panelNotif:'🔔 सूचनाएं',
    panelSalary:'💰 वेतन', panelExcel:'📊 Excel निर्यात',
    panelSetup:'📝 जानकारी सेटअप', panelHelp:'📖 मार्गदर्शिका',
    panelAbout:'ℹ️ ऐप के बारे में', panelLang:'🌐 भाषा',
    panelCountry:'🗺️ देश',
    closeBtn:'बंद करें',
    obLang:'स्वागत है! 👋\nभाषा चुनें', obLangSub:'अपनी भाषा और कार्यस्थल देश चुनें।',
    obUser:'आपकी जानकारी 👤', obUserSub:'ऐप को व्यक्तिगत बनाने के लिए जानकारी भरें।',
    obShift:'काम का शेड्यूल ⏰', obShiftSub:'कितनी शिफ्ट? प्रति शिफ्ट कितने घंटे?',
    obTime:'शिफ्ट समय 🕐', obTimeSub:'प्रत्येक शिफ्ट के लिए समय सेट करें।',
    obNext:'अगला →', obBack:'←', obStart:'ऐप शुरू करें ✓',
    obName:'पूरा नाम', obNameP:'राम कुमार',
    obJob:'पद', obJobP:'कर्मचारी...',
    obCo:'कंपनी', obCoP:'ABC कंपनी',
    obShiftNum:'शिफ्ट की संख्या', obHours:'घंटे/शिफ्ट', obHoursCustom:'या दर्ज:', obHoursUnit:'घंटे/शिफ्ट',
    obWeeks:'सप्ताह/चक्र',
    obShiftCountry:'कार्यस्थल देश',
    days:['रविवार','सोमवार','मंगलवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'],
    daysShort:['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'],
    months:['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'],
    salaryContract:'अनुबंध वेतन/माह', salaryDays:'मानक कार्य दिवस/माह',
    salaryEst:'इस महीने का अनुमानित वेतन', salaryNet:'अनुमानित शुद्ध वेतन',
    salarySave:'✓ वेतन जानकारी सहेजें',
    dpStatus:'स्थिति', dpActual:'वास्तविक समय', dpNote:'टिप्पणी',
    dpReset:'शिफ्ट पर रीसेट', dpCancel:'रद्द करें', dpSave:'सहेजें',
    dpTotalHours:'कुल:', dpOT:'ओवरटाइम:',
    dpInTime:'प्रवेश समय', dpOutTime:'प्रस्थान समय',
    dpNoteP:'इस दिन के लिए टिप्पणी जोड़ें...',
    stCM:'उपस्थित', stCMSub:'पूरी शिफ्ट की',
    stNP:'छुट्टी', stNPSub:'वेतन सहित छुट्टी',
    stV:'अनुपस्थित', stVSub:'बिना वेतन अनुपस्थित',
    stLL:'छुट्टी पर काम', stLLSub:'कानून के अनुसार',
    spPresent:'इस महीने उपस्थिति दिन', spStart:'काम का दिन शुरू करें',
    resetTitle:'सभी डेटा हटाएं?',
    resetDesc:'सभी डेटा स्थायी रूप से हटा दिया जाएगा। पुनः प्राप्त नहीं किया जा सकता!',
    resetCancel:'रद्द करें', resetOk:'🗑 सभी हटाएं',
    exportPreview:'निर्यात किए जाने वाले डेटा का पूर्वावलोकन:',
    exportBtn:'📊 Excel निर्यात (.csv)',
    n1Name:'शिफ्ट से 30 मिनट पहले याद दिलाएं', n1Desc:'शिफ्ट शुरू होने से पहले सूचना',
    n2Name:'30 मिनट बाद पुष्टि करें', n2Desc:'वास्तविक निकलने का समय पूछें',
    n3Name:'स्वचालित उपस्थिति (GPS)', n3Desc:'कार्यालय में प्रवेश/निकलने पर स्वतः रिकॉर्ड',
    n4Name:'साप्ताहिक सारांश', n4Desc:'हर शुक्रवार सारांश देखें',
    calEmpty:'इस महीने कोई डेटा नहीं', noData:'कोई डेटा नहीं',
    salaryDetail:'स्वतः गणना के लिए वेतन जानकारी भरें',
  },
};

/** Hàm dịch ngắn gọn: lấy chuỗi theo key từ bảng TRAN */
function T(key){ return (TRAN[userData.lang||'vi']||TRAN.vi)[key]||(TRAN.vi)[key]||key; }


/* ===== ĐA NGÔN NGỮ - DỊCH UI (6 ngôn ngữ) ===== */
/** Helper: set textContent cho element theo ID (an toàn, bỏ qua nếu null) */
function _s(id,txt){const el=document.getElementById(id);if(el&&txt!==undefined)el.textContent=txt;}
/** Helper: set innerHTML cho element theo ID (an toàn) */
function _h(id,html){const el=document.getElementById(id);if(el&&html!==undefined)el.innerHTML=html;}
/** Áp dụng bản dịch toàn bộ UI theo ngôn ngữ userData.lang
 * Gọi sau mỗi lần đổi ngôn ngữ hoặc khi initHome() */
function applyI18n(){
  const L=userData.lang||'vi'; // ngôn ngữ hiện tại
  const t=getLang();           // object bản dịch
  const s=_s; // global helper
  const h=_h; // global helper

  // App names
  document.querySelectorAll('.rgb-text').forEach(el=>el.textContent=t.appName);
  document.querySelectorAll('#homeAppTitle').forEach(el=>el.textContent=t.appName);
  document.title=t.appName;
  // Onboarding skip button
  const skipLbl={vi:'Bỏ qua',en:'Skip',ko:'건너뛰기',ja:'スキップ',zh:'跳过',my:'ကျော်',th:'ข้าม',id:'Lewati',ph:'Laktawan',ne:'छोड्नुस्',hi:'छोड़ें'};
  s('obSkipBtn',skipLbl[L]||skipLbl.vi);
  // About panel app name (not rgb-text)
  const aboutName=document.querySelector('#panelAbout .rgb-text');
  if(aboutName)aboutName.textContent=t.appName;

  // Home screen
  s('lblVaoCA',t.vaoCA); s('lblHetCA',t.hetCA);
  s('lastIn',t.batDauCa); s('lastOut',t.ketThucCa);
  s('todayStatus',t.chuaChamCong);
  s('meterTitle',t.gioLam);
  s('lblCM',t.coMat); s('lblV',t.vang); s('lblNP',t.nghiPhep); s('lblOT',t.tangCa);
  s('lblFuncTitle',t.chucNang);
  s('flLich',t.lich); s('flThietLap',t.thietLap); s('flGiaoDien',t.giaoDien);
  s('flCaiDat',t.caiDat); s('flLuong',t.luong); s('flExcel',t.xuatExcel);
  s('flThongBao',t.thongBao); s('flHuongDan',t.huongDan);
  s('flGPS',t.flGPS); s('flUtil',t.flUtil); s('flTax',t.flTax);
  s('flRelax',({vi:'Thư giãn',en:'Relax',ko:'휴식',ja:'リラックス',zh:'放松',my:'အနားယူ',th:'ผ่อนคลาย',id:'Relaks',ph:'Relax',ne:'आराम',hi:'आराम'}[L]||'Thư giãn'));
  if(t.taxTitle) s('taxTitle',t.taxTitle);
  if(t.utilTitle) s('utilTitle',t.utilTitle);
  if(t.utilEmptyTitle) s('utilEmptyTitle',t.utilEmptyTitle);
  if(t.utilEmptyDesc) s('utilEmptyDesc',t.utilEmptyDesc);
  s('lblSalaryCard',t.luongUocTinh);

  // Bottom nav labels
  document.querySelectorAll('.nav-lbl').forEach((el,i)=>{
    const lbls=[t.navHome,t.navLich,t.navLuong,t.navCaiDat];
    // Find which nav this is by sibling icon
    const icon=el.previousElementSibling?.textContent;
    if(icon==='🏠')el.textContent=t.navHome;
    else if(icon==='📅')el.textContent=t.navLich;
    else if(icon==='💰')el.textContent=t.navLuong;
    else if(icon==='⚙️')el.textContent=t.navCaiDat;
  });

  // Calendar screen
  s('calScreenTitle',t.lichChamCong);
  s('chipCM',t.chipCM); s('chipV',t.chipV); s('chipNP',t.chipNP); s('chipLL',t.chipLL);

  // Calendar day headers — cập nhật 7 span CN/T2.../T7
  // daysShort[0]=CN(Chủ nhật), [1]=T2, ..., [6]=T7
  const _ds = t.daysShort;
  [0,1,2,3,4,5,6].forEach(i=>{
    const el=document.getElementById('dowD'+i);
    if(el) el.textContent=_ds[i];
  });
  // Fallback: cập nhật qua querySelectorAll nếu id không tìm được
  const dow=document.getElementById('calDow');
  if(dow){
    const spans=dow.querySelectorAll('span');
    _ds.forEach((d,i)=>{if(spans[i])spans[i].textContent=d;});
  }
  // Cập nhật ô preview trong panel Giao diện (CN T2 T3 T4 T5 T6 T7)
  const _previewIds=['previewSun','previewD1','previewD2','previewD3','previewD4','previewD5','previewSat'];
  _previewIds.forEach((pid,i)=>{
    const pel=document.getElementById(pid);
    if(pel) pel.textContent=_ds[i];
  });
  // Đồng thời update mảng DAYS dùng trong renderCalBig và danh sách ngày
  if(typeof DAYS!=='undefined'&&DAYS.length===7) DAYS.splice(0,7,..._ds);
  window._DAYS_SHORT=_ds;

  // Settings screen
  s('settingsTitle',t.settingsTitle);
  // Settings items - find by structure
  document.querySelectorAll('.settings-item').forEach(item=>{
    const icon=item.querySelector('.si-icon')?.textContent?.trim();
    const name=item.querySelector('.si-name');
    const sub=item.querySelector('.si-sub');
    if(!name)return;
    if(icon==='🌐'){name.textContent=t.siLang;}
    else if(icon==='🗺️'){name.textContent=t.siCountry;}
    else if(icon==='📝'){name.textContent=t.siSetup;if(sub)sub.textContent=t.siSetupSub;}
    else if(icon==='🔔'){name.textContent=t.siNotif;if(sub)sub.textContent=t.siNotifSub;}
    else if(icon==='⭐'){name.textContent=t.siAppear;if(sub)sub.textContent=t.siAppearSub;}
    else if(icon==='ℹ️'){name.textContent=t.siAbout;if(sub)sub.textContent=t.siAboutSub;}
    else if(icon==='📖'){name.textContent=t.siHelp;if(sub)sub.textContent=t.siHelpSub;}
    else if(icon==='🗑️'){if(sub)sub.textContent=t.siDeleteSub;}
  });

  // Panel titles
  document.querySelectorAll('.panel-title').forEach(el=>{
    const txt=el.textContent.trim();
    if(txt.includes('Giao diện')||txt.includes('Appearance')||txt.includes('화면')||txt.includes('外観')||txt.includes('外观')||txt.includes('ဒီဇိုင်း'))el.textContent=t.panelAppear;
    else if(txt.includes('Thông báo')||txt.includes('Notif')||txt.includes('알림')||txt.includes('通知'))el.textContent=t.panelNotif;
    else if(txt.includes('Bảng lương')||txt.includes('Salary')||txt.includes('급여')||txt.includes('給与')||txt.includes('薪资')||txt.includes('လစာ'))el.textContent=t.panelSalary;
    else if(txt.includes('Excel'))el.textContent=t.panelExcel;
    else if(txt.includes('Thiết lập')||txt.includes('Setup')||txt.includes('정보 설정')||txt.includes('情報設定')||txt.includes('信息设置'))el.textContent=t.panelSetup;
    else if(txt.includes('Hướng dẫn')||txt.includes('Guide')||txt.includes('사용 가이드')||txt.includes('使用'))el.textContent=t.panelHelp;
    else if(txt.includes('Về ứng')||txt.includes('About')||txt.includes('앱 정보')||txt.includes('アプリ情報')||txt.includes('关于')||txt.includes('အပ်'))el.textContent=t.panelAbout;
    else if(txt.includes('ngôn ngữ')||txt.includes('Language')||txt.includes('언어')||txt.includes('言語')||txt.includes('语言')||txt.includes('ဘာသာ'))el.textContent=t.panelLang;
    else if(txt.includes('Quốc gia')||txt.includes('Country')||txt.includes('국가')||txt.includes('勤務国')||txt.includes('国家')||txt.includes('နိုင်ငံ'))el.textContent=t.panelCountry;
  });

  // Panel close buttons
  document.querySelectorAll('.panel-close').forEach(btn=>{if(btn.textContent==='✕'||btn.textContent===t.closeBtn)btn.textContent='✕';});

  // Notif panel rows
  // 4 dòng thông báo — dùng id trực tiếp thay vì querySelectorAll (tránh bị lệch index)
  _s('n1Name',t.n1Name); _s('n1Desc',t.n1Desc);
  _s('n2Name',t.n2Name); _s('n2Desc',t.n2Desc);
  _s('n3Name',t.n3Name); _s('n3Desc',t.n3Desc);
  _s('n4Name',t.n4Name); _s('n4Desc',t.n4Desc);
  // Tiêu đề panel thông báo
  _s('notifPanelTitle', '🔔 '+(t.panelNotif||t.panelNotif||'Cài đặt thông báo').replace('🔔 ',''));
  // Settings list - notif item
  _s('siNotifName', t.siNotif||'Cài đặt thông báo');
  _s('siNotifSub',  t.siNotifSub||'Nhắc giờ làm, tự động chấm công');

  // Salary panel
  document.querySelectorAll('.field-label').forEach(el=>{
    const txt=el.textContent;
    if(txt.includes('Lương hợp đồng')||txt.includes('Contract')||txt.includes('계약')||txt.includes('契約')||txt.includes('合同'))el.textContent=t.salaryContract;
    else if(txt.includes('Ngày công')||txt.includes('working day')||txt.includes('근무일')||txt.includes('勤務日')||txt.includes('工作天'))el.textContent=t.salaryDays;
  });

  // Reset confirm panel
  const rTitle=document.querySelector('#panelConfirmReset [style*="E8433A"]');
  if(rTitle)rTitle.textContent=t.resetTitle;
  const rDesc=document.querySelector('#panelConfirmReset [style*="text2"]');

  // Day panel labels
  s('dpStatusLbl',t.dpStatus); s('dpActualLbl',t.dpActual); s('dpNoteLbl',t.dpNote);
  s('dpInTimeLbl',t.dpInTime||'Giờ vào'); s('dpOutTimeLbl',t.dpOutTime||'Giờ ra');
  // Excel preview headers
  const _eh2={vi:['Ngày','Thứ','Trạng thái','Vào','Ra'],en:['Date','Day','Status','In','Out'],ko:['날짜','요일','상태','출근','퇴근'],ja:['日付','曜日','状態','出勤','退勤'],zh:['日期','星期','状态','上班','下班'],my:['ရက်','နေ့','အခြေ','တက်','ဆင်'],th:['วันที่','วัน','สถานะ','เข้า','ออก'],id:['Tanggal','Hari','Status','Masuk','Keluar'],ph:['Petsa','Araw','Katayuan','Pasok','Labas'],ne:['मिति','बार','अवस्था','प्रवेश','निस्किने'],hi:['तारीख','दिन','स्थिति','प्रवेश','प्रस्थान']}[L]||['Ngày','Thứ','Trạng thái','Vào','Ra'];
  s('exHNgay',_eh2[0]);s('exHThu',_eh2[1]);s('exHTT',_eh2[2]);s('exHVao',_eh2[3]);s('exHRa',_eh2[4]);
  const dayNote=document.getElementById('dayNote');if(dayNote)dayNote.placeholder=t.dpNoteP;
  const dayReset=document.getElementById('dayResetBtn');if(dayReset)dayReset.textContent=t.dpReset;
  const dayCancel=document.getElementById('dayCancelBtn');if(dayCancel)dayCancel.textContent=t.dpCancel;
  const daySave=document.getElementById('daySaveBtn');if(daySave)daySave.textContent=t.dpSave;

  // Update days/months arrays used by updateClock and renderCalBig
  window._DAYS=t.days;
  window._MONTHS=t.months;
  window._DAYS_SHORT=t.daysShort;
  // Also update the let variables directly so renderCalBig uses them immediately
  if(typeof DAYS!=='undefined')DAYS.splice(0,7,...t.daysShort);
  if(typeof MONTHS!=='undefined')MONTHS.splice(0,12,...t.months);

  // Appearance panel section titles
  const apSec={
    vi:{avt:'Ảnh đại diện',avtDesc:'Ảnh hiển thị trên trang chủ',avtBtn:'📷 Chọn ảnh',color:'Màu chủ đạo',bg:'Ảnh nền lịch',bgBtn:'📷 Chọn ảnh từ máy',bgClear:'✕ Xóa ảnh',gradient:'Màu nền gradient',calColor:'🎨 Màu chữ trong lịch',sunLbl:'Chủ nhật (CN)',sunSub:'Màu chữ ngày Chủ nhật',satLbl:'Thứ 7 (T7)',satSub:'Màu chữ ngày Thứ 7',normLbl:'Ngày thường (T2–T6)',normSub:'Màu chữ ngày trong tuần',reset:'↺ Đặt lại màu mặc định',save:'✓ Lưu giao diện'},
    en:{avt:'Avatar',avtDesc:'Photo shown on home screen',avtBtn:'📷 Choose photo',color:'Theme color',bg:'Calendar background',bgBtn:'📷 Choose from device',bgClear:'✕ Remove',gradient:'Gradient presets',calColor:'🎨 Calendar text colors',sunLbl:'Sunday (Sun)',sunSub:'Sunday text color',satLbl:'Saturday (Sat)',satSub:'Saturday text color',normLbl:'Weekdays (Mon–Fri)',normSub:'Weekday text color',reset:'↺ Reset to default',save:'✓ Save appearance'},
    ko:{avt:'아바타',avtDesc:'홈 화면에 표시되는 사진',avtBtn:'📷 사진 선택',color:'테마 색상',bg:'달력 배경',bgBtn:'📷 기기에서 선택',bgClear:'✕ 제거',gradient:'그라데이션 프리셋',calColor:'🎨 달력 텍스트 색상',sunLbl:'일요일 (일)',sunSub:'일요일 글자색',satLbl:'토요일 (토)',satSub:'토요일 글자색',normLbl:'평일 (월–금)',normSub:'평일 글자색',reset:'↺ 기본값으로',save:'✓ 저장'},
    ja:{avt:'アバター',avtDesc:'ホーム画面に表示する写真',avtBtn:'📷 写真を選択',color:'テーマカラー',bg:'カレンダー背景',bgBtn:'📷 端末から選択',bgClear:'✕ 削除',gradient:'グラデーション',calColor:'🎨 カレンダー文字色',sunLbl:'日曜日（日）',sunSub:'日曜の文字色',satLbl:'土曜日（土）',satSub:'土曜の文字色',normLbl:'平日（月〜金）',normSub:'平日の文字色',reset:'↺ デフォルトに戻す',save:'✓ 外観を保存'},
    zh:{avt:'头像',avtDesc:'显示在主页的照片',avtBtn:'📷 选择照片',color:'主题颜色',bg:'日历背景',bgBtn:'📷 从设备选择',bgClear:'✕ 删除',gradient:'渐变预设',calColor:'🎨 日历文字颜色',sunLbl:'周日（日）',sunSub:'周日文字颜色',satLbl:'周六（六）',satSub:'周六文字颜色',normLbl:'工作日（一–五）',normSub:'工作日文字颜色',reset:'↺ 重置为默认',save:'✓ 保存外观'},
    my:{avt:'ဓာတ်ပုံ',avtDesc:'မူလစာမျက်နှာတွင်ပြသ',avtBtn:'📷 ဓာတ်ပုံရွေး',color:'အရောင်',bg:'ပြက္ခဒိန်နောက်ခံ',bgBtn:'📷 ထည့်သွင်း',bgClear:'✕ ဖျက်',gradient:'Gradient',calColor:'🎨 ပြက္ခဒိန်အရောင်',sunLbl:'တနင်္ဂနွေ',sunSub:'တနင်္ဂနွေ',satLbl:'စနေ',satSub:'စနေ',normLbl:'ပုံမှန်ရက်',normSub:'ပုံမှန်',reset:'↺ မူရင်းပြန်',save:'✓ သိမ်း'},
    th:{avt:'รูปโปรไฟล์',avtDesc:'รูปที่แสดงบนหน้าหลัก',avtBtn:'📷 เลือกรูป',color:'สีธีม',bg:'พื้นหลังปฏิทิน',bgBtn:'📷 เลือกจากอุปกรณ์',bgClear:'✕ ลบ',gradient:'พื้นหลัง Gradient',calColor:'🎨 สีข้อความในปฏิทิน',sunLbl:'วันอาทิตย์',sunSub:'สีข้อความวันอาทิตย์',satLbl:'วันเสาร์',satSub:'สีข้อความวันเสาร์',normLbl:'วันธรรมดา (จ–ศ)',normSub:'สีข้อความวันธรรมดา',reset:'↺ รีเซ็ตเป็นค่าเริ่มต้น',save:'✓ บันทึกธีม'},
    id:{avt:'Avatar',avtDesc:'Foto ditampilkan di beranda',avtBtn:'📷 Pilih foto',color:'Warna tema',bg:'Latar kalender',bgBtn:'📷 Pilih dari perangkat',bgClear:'✕ Hapus',gradient:'Preset Gradient',calColor:'🎨 Warna teks kalender',sunLbl:'Minggu',sunSub:'Warna teks Minggu',satLbl:'Sabtu',satSub:'Warna teks Sabtu',normLbl:'Hari kerja (Sen–Jum)',normSub:'Warna teks hari kerja',reset:'↺ Reset ke default',save:'✓ Simpan tampilan'},
    ph:{avt:'Avatar',avtDesc:'Larawan na ipinapakita sa home',avtBtn:'📷 Pumili ng larawan',color:'Kulay ng tema',bg:'Background ng kalendaryo',bgBtn:'📷 Pumili mula sa device',bgClear:'✕ Alisin',gradient:'Mga Gradient preset',calColor:'🎨 Mga kulay ng teksto ng kalendaryo',sunLbl:'Linggo',sunSub:'Kulay ng teksto ng Linggo',satLbl:'Sabado',satSub:'Kulay ng teksto ng Sabado',normLbl:'Mga araw ng trabaho (Lun–Biy)',normSub:'Kulay ng teksto ng araw ng trabaho',reset:'↺ I-reset sa default',save:'✓ I-save ang hitsura'},
    ne:{avt:'अवतार',avtDesc:'गृह पृष्ठमा देखिने फोटो',avtBtn:'📷 फोटो छान्नुस्',color:'थिम रंग',bg:'क्यालेन्डर पृष्ठभूमि',bgBtn:'📷 उपकरणबाट छान्नुस्',bgClear:'✕ हटाउनुस्',gradient:'Gradient प्रिसेट',calColor:'🎨 क्यालेन्डर पाठ रंग',sunLbl:'आइतबार',sunSub:'आइतबार पाठ रंग',satLbl:'शनिबार',satSub:'शनिबार पाठ रंग',normLbl:'कार्यदिन (सोम–शुक्र)',normSub:'कार्यदिन पाठ रंग',reset:'↺ डिफल्टमा रिसेट',save:'✓ थिम सुरक्षित गर्नुस्'},
    hi:{avt:'अवतार',avtDesc:'होम स्क्रीन पर दिखाई जाने वाली फ़ोटो',avtBtn:'📷 फ़ोटो चुनें',color:'थीम रंग',bg:'कैलेंडर पृष्ठभूमि',bgBtn:'📷 डिवाइस से चुनें',bgClear:'✕ हटाएं',gradient:'Gradient प्रीसेट',calColor:'🎨 कैलेंडर पाठ रंग',sunLbl:'रविवार',sunSub:'रविवार पाठ रंग',satLbl:'शनिवार',satSub:'शनिवार पाठ रंग',normLbl:'कार्यदिवस (सोम–शुक्र)',normSub:'कार्यदिवस पाठ रंग',reset:'↺ डिफ़ॉल्ट पर रीसेट',save:'✓ थीम सहेजें'},
  };
  const av=apSec[L]||apSec.vi;
  // Tiêu đề panel Giao diện
  _s('appearPanelTitle', '⭐ '+(t.panelAppear||'Chỉnh sửa giao diện').replace(/^⭐\s*/,''));
  // Settings list — appearance item
  _s('siAppearName', t.siAppear||'Chỉnh sửa giao diện');
  _s('siAppearSub2', t.siAppearSub||'Màu sắc, ảnh đại diện, ảnh nền');
  // Text "Chưa có ảnh nền" trong preview vùng ảnh
  _s('apBgPreviewTxt', u('appear.no_bg'));
  s('apSecAvt',      u('appear.avatar'));
  s('apSecColor',    u('appear.color'));
  s('apSecBg',       u('appear.bg'));
  s('apSecGradient', u('appear.gradient'));
  s('apAvtDesc',     u('appear.avt_desc'));
  s('btnChooseAvt',  u('appear.btn_choose'));
  s('btnChooseImg',  u('appear.btn_bg'));
  s('btnClearBg',    u('appear.btn_clear'));
  s('calColorSunLbl',av.sunLbl); s('calColorSunSub',av.sunSub);
  s('calColorSatLbl',av.satLbl); s('calColorSatSub',av.satSub);
  s('calColorNormLbl',av.normLbl); s('calColorNormSub',av.normSub);
  s('btnSaveAppear',  u('appear.save'));
  // Excel panel labels
  _s('excelPanelTitle',  '📊 '+(t.xuatExcel||'Xuất Excel'));
  _s('excelPreviewLbl',  t.exportPreview||'Xem trước dữ liệu xuất ra:');
  _s('excelExportBtn',   t.exportBtn||'📊 Xuất file Excel (.csv)');

  // Setup panel labels
  const sp2={
    vi:{name:'Họ và tên',nameP:'Nguyễn Văn A',job:'Chức vụ',jobP:'Nhân viên...',co:'Công ty',coP:'Công ty ABC',shift:'Số ca làm việc',hours:'Số giờ / ca',save:'✓ Lưu thông tin'},
    en:{name:'Full Name',nameP:'John Smith',job:'Job Title',jobP:'Employee...',co:'Company',coP:'ABC Company',shift:'Number of shifts',hours:'Hours / shift',save:'✓ Save Info'},
    ko:{name:'성명',nameP:'홍길동',job:'직책',jobP:'직원...',co:'회사',coP:'ABC 회사',shift:'교대 수',hours:'교대당 시간',save:'✓ 저장'},
    ja:{name:'氏名',nameP:'山田太郎',job:'職種',jobP:'社員...',co:'会社名',coP:'ABC株式会社',shift:'シフト数',hours:'時間/シフト',save:'✓ 保存'},
    zh:{name:'姓名',nameP:'张伟',job:'职位',jobP:'员工...',co:'公司',coP:'ABC公司',shift:'班次数量',hours:'每班时长',save:'✓ 保存信息'},
    my:{name:'အမည်',nameP:'ကိုစိုး',job:'ရာထူး',jobP:'ဝန်ထမ်း...',co:'ကုမ္ပဏီ',coP:'ABC',shift:'Shift',hours:'နာရီ',save:'✓ သိမ်း'},
    th:{name:'ชื่อ-นามสกุล',nameP:'สมชาย ใจดี',job:'ตำแหน่งงาน',jobP:'พนักงาน...',co:'บริษัท',coP:'บริษัท ABC',shift:'จำนวนกะ',hours:'ชั่วโมง/กะ',save:'✓ บันทึกข้อมูล'},
    id:{name:'Nama Lengkap',nameP:'Budi Santoso',job:'Jabatan',jobP:'Karyawan...',co:'Perusahaan',coP:'PT ABC',shift:'Jumlah shift',hours:'Jam/shift',save:'✓ Simpan info'},
    ph:{name:'Buong Pangalan',nameP:'Juan dela Cruz',job:'Trabaho',jobP:'Empleyado...',co:'Kumpanya',coP:'ABC Corp',shift:'Bilang ng shift',hours:'Oras/shift',save:'✓ I-save'},
    ne:{name:'पूरा नाम',nameP:'राम श्रेष्ठ',job:'पद',jobP:'कर्मचारी...',co:'कम्पनी',coP:'ABC कम्पनी',shift:'सिफ्ट संख्या',hours:'घण्टा/सिफ्ट',save:'✓ सुरक्षित गर्नुस्'},
    hi:{name:'पूरा नाम',nameP:'राम कुमार',job:'पद',jobP:'कर्मचारी...',co:'कंपनी',coP:'ABC कंपनी',shift:'शिफ्ट की संख्या',hours:'घंटे/शिफ्ट',save:'✓ जानकारी सहेजें'},
  };
  const sv2=sp2[L]||sp2.vi;
  s('setupLblName',  u('setup.name'));
  s('setupLblJob',   u('setup.job'));
  s('setupLblCo',    u('setup.company'));
  s('setupLblShift', u('setup.shifts'));
  s('setupLblHours', u('setup.hours'));
  s('btnSaveSetup',  u('setup.save'));
  // Số tuần một vòng + nghỉ giữa giờ
  const _setupT = {
    weeks:    {vi:'Số tuần một vòng',         en:'Weeks per rotation',         ko:'순환 주 수',          ja:'ローテーション週数',         zh:'轮班周数',                 my:'အပတ်လည်ပတ်',th:'สัปดาห์/รอบ',id:'Minggu/siklus',ph:'Linggo/siklo',ne:'हप्ता/चक्र',hi:'सप्ताह/चक्र'},
    break:    {vi:'Có nghỉ giữa giờ không?',  en:'Any break time?',            ko:'중간 휴식 있나요?',   ja:'休憩時間ありますか？',       zh:'有中途休息吗？',           my:'အကြားနားချိန်ရှိပါသလား?',th:'มีเวลาพักไหม?',id:'Ada waktu istirahat?',ph:'May break?',ne:'बिश्राम छ?',hi:'कोई ब्रेक है?'},
    no:       {vi:'Không',                    en:'No',                          ko:'아니오',              ja:'なし',                       zh:'没有',                     my:'မရှိ',th:'ไม่',id:'Tidak',ph:'Hindi',ne:'छैन',hi:'नहीं'},
    yes:      {vi:'Có',                       en:'Yes',                         ko:'예',                  ja:'あり',                       zh:'有',                       my:'ရှိ',th:'ใช่',id:'Ya',ph:'Oo',ne:'छ',hi:'हाँ'},
    breakMin: {vi:'Số phút nghỉ (sẽ trừ vào giờ thực tế)', en:'Break minutes (will subtract from worked hours)', ko:'휴식 분 (실제 근무시간에서 차감)', ja:'休憩時間（実働から差し引き）', zh:'休息分钟数（从实际工时扣除）', my:'အနားချိန် (အလုပ်ချိန်မှနုတ်)',th:'นาทีพัก (หักจากชั่วโมงทำงาน)',id:'Menit istirahat (dikurangi dari jam kerja)',ph:'Minuto ng pahinga (ibabawas sa oras ng trabaho)',ne:'बिश्राम मिनेट (काम घण्टाबाट घटाइन्छ)',hi:'ब्रेक मिनट (काम के घंटों से घटाया जाएगा)'},
  };
  _s('setupLblWeeks',    u('setup.weeks'));
  _s('setupLblBreak',    u('setup.break_q'));
  _s('brLblNo',          u('setup.break_no'));
  _s('brLblYes',         u('setup.break_yes'));
  _s('setupLblBreakMin', u('setup.break_min'));
  // Tuần này làm ca nào
  const _curShiftT = {vi:'Tuần này bạn làm ca nào?',en:'Which shift this week?',ko:'이번 주 어느 교대?',ja:'今週はどのシフト？',zh:'本周哪个班次？',my:'ဒီအပတ် ဘယ်ဆင်း?',th:'สัปดาห์นี้กะอะไร?',id:'Shift minggu ini?',ph:'Anong shift ngayong linggo?',ne:'यो हप्ता कुन सिफ्ट?',hi:'इस सप्ताह कौन सी शिफ्ट?'};
  _s('setupLblCurShift', u('setup.which_shift'));
  // Re-render lại label các nút "Ca 1, Ca 2..." theo ngôn ngữ mới
  if(typeof renderSetupCurShift === 'function' && document.getElementById('setupCurShiftGrid')) renderSetupCurShift();
  const sn=document.getElementById('setupName');if(sn)sn.placeholder=sv2.nameP;
  const sj=document.getElementById('setupJob');if(sj)sj.placeholder=sv2.jobP;
  const sc=document.getElementById('setupCo');if(sc)sc.placeholder=sv2.coP;

  // Delete row in settings
  const delName={vi:'Xóa toàn bộ dữ liệu',en:'Delete All Data',ko:'모든 데이터 삭제',ja:'全データ削除',zh:'删除所有数据',my:'ဒေတာဖျက်',th:'ลบข้อมูลทั้งหมด',id:'Hapus Semua Data',ph:'Burahin Lahat ng Data',ne:'सबै डेटा मेटाउनुस्',hi:'सभी डेटा हटाएं'};
  s('siDeleteName',delName[L]||delName.vi);
  // Mô tả xóa dữ liệu (dòng phụ trong settings + nội dung trong panel confirm)
  const delSubMap={vi:'Không thể khôi phục',en:'Cannot be recovered',ko:'복구 불가',ja:'元に戻せません',zh:'无法恢复',my:'ပြန်မရနိုင်',th:'กู้คืนไม่ได้',id:'Tidak dapat dipulihkan',ph:'Hindi mababawi',ne:'पुनः प्राप्त हुँदैन',hi:'पुनः प्राप्त नहीं किया जा सकता'};
  s('siDeleteSub', delSubMap[L]||delSubMap.vi);
  // Đoạn mô tả trong panel xác nhận xóa (có html bold nên dùng innerHTML)
  const resetDescEl=document.getElementById('resetDescTxt');
  if(resetDescEl){
    const rd={
      vi:'Tất cả dữ liệu chấm công, cài đặt và thông tin cá nhân sẽ bị xóa vĩnh viễn.<br><strong>Không thể khôi phục!</strong>',
      en:'All attendance data, settings and personal info will be permanently deleted.<br><strong>Cannot be recovered!</strong>',
      ko:'모든 출퇴근 데이터, 설정 및 개인 정보가 영구적으로 삭제됩니다.<br><strong>복구할 수 없습니다!</strong>',
      ja:'全ての打刻データ、設定、個人情報が永久に削除されます。<br><strong>元に戻せません！</strong>',
      zh:'所有考勤数据、设置和个人信息将被永久删除。<br><strong>无法恢复！</strong>',
      my:'ဒေတာ၊ ဆက်တင်နှင့် ကိုယ်ရေးအချက်အလက်အားလုံး ဖျက်မည်။<br><strong>ပြန်မရနိုင်!</strong>',th:'ข้อมูลทั้งหมดจะถูกลบถาวร<br><strong>ไม่สามารถกู้คืนได้!</strong>',id:'Semua data akan dihapus permanen.<br><strong>Tidak dapat dipulihkan!</strong>',ph:'Lahat ng data ay permanenteng mabubura.<br><strong>Hindi na mababawi!</strong>',ne:'सबै डेटा स्थायी रूपमा मेटिनेछ।<br><strong>पुनः प्राप्त गर्न सकिँदैन!</strong>',hi:'सभी डेटा स्थायी रूप से हटा दिया जाएगा।<br><strong>पुनः प्राप्त नहीं किया जा सकता!</strong>'
    };
    resetDescEl.innerHTML=rd[L]||rd.vi;
  }

  // ===== GPS PANEL TRANSLATIONS =====
  const gpsT = {
    vi:{section:'📍 VỊ TRÍ CÔNG TY', radius:'Bán kính phát hiện', checkinLbl:'⏱️ Phút xác nhận VÀO ca', checkoutLbl:'⏱️ Phút xác nhận HẾT ca', btnGet:'📍 Lấy vị trí hiện tại',
      permTitle:'⚠️ Chrome chặn GPS với file cục bộ',
      permBody:'Chrome trên điện thoại không cho phép GPS khi mở file .html trực tiếp.<br><br><b>Giải pháp nhanh:</b> Nhập tọa độ công ty thủ công 👇',
      manualTitle:'🗺️ NHẬP TỌA ĐỘ THỦ CÔNG',
      manualHint:'Mở <b>Google Maps</b> → nhấn giữ vị trí công ty → copy tọa độ',
      lat:'Vĩ độ (Latitude)', lng:'Kinh độ (Longitude)', saveManual:'✓ Lưu vị trí công ty',
      manualFooter:'📌 Cách lấy tọa độ: Mở <b>Google Maps</b> → tìm công ty → nhấn giữ → copy 2 số xuất hiện',
      hostTitle:'🌐 Cấp quyền GPS tự động',
      tip:'💡 Sau khi lưu vị trí, app dùng GPS điện thoại để kiểm tra khoảng cách và tự chấm công.',
      noSetup:'Chưa thiết lập vị trí công ty', notSupport:'Thiết bị không hỗ trợ GPS',
      loading:'⏳ Đang lấy vị trí...', denied:'GPS bị từ chối. Vui lòng nhập tọa độ thủ công.'},
    en:{section:'📍 COMPANY LOCATION', radius:'Detection radius', checkinLbl:'⏱️ Check-in confirm (min)', checkoutLbl:'⏱️ Check-out confirm (min)', btnGet:'📍 Get current location',
      permTitle:'⚠️ Chrome blocks GPS for local files',
      permBody:'Chrome on mobile does not allow GPS when opening .html files directly.<br><br><b>Quick fix:</b> Enter company coordinates manually 👇',
      manualTitle:'🗺️ MANUAL COORDINATES',
      manualHint:'Open <b>Google Maps</b> → long press company location → copy coordinates',
      lat:'Latitude', lng:'Longitude', saveManual:'✓ Save company location',
      manualFooter:'📌 How to get coordinates: Open <b>Google Maps</b> → find company → long press → copy 2 numbers',
      hostTitle:'🌐 Enable GPS automatically',
      tip:'💡 After saving location, app uses GPS to check distance and auto clock in/out.',
      noSetup:'Company location not set', notSupport:'Device does not support GPS',
      loading:'⏳ Getting location...', denied:'GPS denied. Please enter coordinates manually.'},
    ko:{section:'📍 회사 위치', radius:'감지 반경', checkinLbl:'⏱️ 출근 확인 (분)', checkoutLbl:'⏱️ 퇴근 확인 (분)', btnGet:'📍 현재 위치 가져오기',
      permTitle:'⚠️ Chrome이 로컬 파일의 GPS를 차단함',
      permBody:'Chrome 모바일은 .html 파일을 직접 열면 GPS를 허용하지 않습니다.<br><br><b>빠른 해결책:</b> 회사 좌표를 수동으로 입력하세요 👇',
      manualTitle:'🗺️ 수동 좌표 입력',
      manualHint:'<b>Google Maps</b> 열기 → 회사 위치 길게 누르기 → 좌표 복사',
      lat:'위도 (Latitude)', lng:'경도 (Longitude)', saveManual:'✓ 회사 위치 저장',
      manualFooter:'📌 좌표 얻기: <b>Google Maps</b> → 회사 찾기 → 길게 누르기 → 숫자 2개 복사',
      hostTitle:'🌐 GPS 자동 허용',
      tip:'💡 위치 저장 후 앱이 GPS로 거리를 확인하여 자동 출퇴근합니다.',
      noSetup:'회사 위치가 설정되지 않음', notSupport:'기기가 GPS를 지원하지 않음',
      loading:'⏳ 위치 가져오는 중...', denied:'GPS 거부됨. 수동으로 좌표를 입력하세요.'},
    ja:{section:'📍 会社の位置', radius:'検出半径', checkinLbl:'⏱️ 出勤確認 (分)', checkoutLbl:'⏱️ 退勤確認 (分)', btnGet:'📍 現在地を取得',
      permTitle:'⚠️ ChromeはローカルファイルのGPSをブロック',
      permBody:'Chromeモバイルは.htmlを直接開くとGPSを許可しません。<br><br><b>簡単な解決策:</b> 会社の座標を手動入力してください 👇',
      manualTitle:'🗺️ 手動座標入力',
      manualHint:'<b>Google Maps</b>を開く → 会社の場所を長押し → 座標をコピー',
      lat:'緯度 (Latitude)', lng:'経度 (Longitude)', saveManual:'✓ 会社の位置を保存',
      manualFooter:'📌 座標の取得: <b>Google Maps</b> → 会社を検索 → 長押し → 数字2つをコピー',
      hostTitle:'🌐 GPS自動許可',
      tip:'💡 位置保存後、アプリがGPSで距離を確認し自動打刻します。',
      noSetup:'会社の位置が未設定', notSupport:'デバイスがGPSをサポートしていません',
      loading:'⏳ 位置取得中...', denied:'GPS拒否されました。座標を手動入力してください。'},
    zh:{section:'📍 公司位置', radius:'检测半径', checkinLbl:'⏱️ 上班确认 (分钟)', checkoutLbl:'⏱️ 下班确认 (分钟)', btnGet:'📍 获取当前位置',
      permTitle:'⚠️ Chrome阻止本地文件的GPS',
      permBody:'Chrome手机版不允许直接打开.html文件时使用GPS。<br><br><b>快速解决方案:</b> 手动输入公司坐标 👇',
      manualTitle:'🗺️ 手动输入坐标',
      manualHint:'打开<b>Google Maps</b> → 长按公司位置 → 复制坐标',
      lat:'纬度 (Latitude)', lng:'经度 (Longitude)', saveManual:'✓ 保存公司位置',
      manualFooter:'📌 获取坐标: 打开<b>Google Maps</b> → 找到公司 → 长按 → 复制2个数字',
      hostTitle:'🌐 自动启用GPS',
      tip:'💡 保存位置后，应用通过GPS检查距离并自动打卡。',
      noSetup:'公司位置未设置', notSupport:'设备不支持GPS',
      loading:'⏳ 正在获取位置...', denied:'GPS被拒绝。请手动输入坐标。'},
    my:{section:'📍 ကုမ္ပဏီတည်နေရာ', radius:'သိရှိနိုင်သောအချင်း', btnGet:'📍 လက်ရှိတည်နေရာ',
      checkinLbl:'⏱️ မိနစ် — VÀO ca အတည်ပြု', checkoutLbl:'⏱️ မိနစ် — HẾT ca အတည်ပြု',
      permTitle:'⚠️ Chrome GPS ကိုပိတ်ထားသည်',
      permBody:'.html ဖိုင်ကိုတိုက်ရိုက်ဖွင့်သောအခါ GPS ခွင့်မပြု<br><br><b>အမြန်ဖြေရှင်းချက်:</b> ကုမ္ပဏီကိုဩဒိနိတ် ထည့်ပါ 👇',
      manualTitle:'🗺️ ကိုဩဒိနိတ် ထည့်ပါ',
      manualHint:'<b>Google Maps</b> ဖွင့် → ကုမ္ပဏီနေရာ နှိပ်ဆွဲ → ကိုဩဒိနိတ် ကူးယူ',
      lat:'အလျားဒီဂရီ (Latitude)', lng:'အကျယ်ဒီဂရီ (Longitude)', saveManual:'✓ ကုမ္ပဏီနေရာ သိမ်း',
      manualFooter:'📌 ကိုဩဒိနိတ်ရယူနည်း: <b>Google Maps</b> → ကုမ္ပဏီရှာ → နှိပ်ဆွဲ → ဂဏန်း ၂ ခုကူးယူ',
      hostTitle:'🌐 GPS အလိုအလျောက်ခွင့်ပြု',
      tip:'💡 နေရာသိမ်းပြီးနောက် app သည် GPS ဖြင့် တက်/ဆင်းမှတ်မည်',
      noSetup:'ကုမ္ပဏီနေရာ မသတ်မှတ်ရသေး', notSupport:'GPS ပံ့ပိုးမှုမရှိ',
      loading:'⏳ နေရာရယူနေသည်...', denied:'GPS ငြင်းဆန်ခြင်း။ ကိုဩဒိနိတ် ထည့်ပါ'},
    th:{section:'📍 ที่ตั้งบริษัท', radius:'รัศมีตรวจจับ', btnGet:'📍 รับตำแหน่งปัจจุบัน',
      checkinLbl:'⏱️ นาทียืนยันเข้างาน', checkoutLbl:'⏱️ นาทียืนยันออกงาน',
      permTitle:'⚠️ Chrome ปิดกั้น GPS สำหรับไฟล์ในเครื่อง',
      permBody:'Chrome มือถือไม่อนุญาต GPS เมื่อเปิดไฟล์ .html โดยตรง<br><br><b>แก้ไขด่วน:</b> ลองเปิดผ่าน HTTPS',
      manualTitle:'🗺️ กรอกพิกัดด้วยตนเอง',
      manualHint:'เปิด <b>Google Maps</b> → กดค้างที่ตำแหน่งบริษัท → คัดลอกพิกัด',
      lat:'ละติจูด (Latitude)', lng:'ลองจิจูด (Longitude)', saveManual:'✓ บันทึกตำแหน่งบริษัท',
      manualFooter:'📌 วิธีรับพิกัด: เปิด <b>Google Maps</b> → ค้นหาบริษัท → กดค้าง → คัดลอก 2 ตัวเลข',
      hostTitle:'🌐 เปิดใช้ GPS อัตโนมัติ',
      tip:'💡 หลังบันทึกตำแหน่ง แอปจะใช้ GPS ตรวจสอบระยะทางและเช็คชื่ออัตโนมัติ',
      noSetup:'ยังไม่ได้ตั้งค่าตำแหน่งบริษัท', notSupport:'อุปกรณ์ไม่รองรับ GPS',
      loading:'⏳ กำลังรับตำแหน่ง...', denied:'GPS ถูกปฏิเสธ กรุณากรอกพิกัดด้วยตนเอง'},
    id:{section:'📍 LOKASI PERUSAHAAN', radius:'Radius deteksi', btnGet:'📍 Dapatkan lokasi saat ini',
      checkinLbl:'⏱️ Menit konfirmasi MASUK', checkoutLbl:'⏱️ Menit konfirmasi KELUAR',
      permTitle:'⚠️ Chrome memblokir GPS untuk file lokal',
      permBody:'Chrome mobile tidak mengizinkan GPS saat membuka file .html langsung<br><br><b>Solusi cepat:</b> Buka melalui HTTPS',
      manualTitle:'🗺️ MASUKKAN KOORDINAT MANUAL',
      manualHint:'Buka <b>Google Maps</b> → tekan lama lokasi perusahaan → salin koordinat',
      lat:'Latitude', lng:'Longitude', saveManual:'✓ Simpan lokasi perusahaan',
      manualFooter:'📌 Cara mendapatkan koordinat: Buka <b>Google Maps</b> → cari perusahaan → tekan lama → salin 2 angka',
      hostTitle:'🌐 Aktifkan GPS otomatis',
      tip:'💡 Setelah menyimpan lokasi, app menggunakan GPS untuk memeriksa jarak dan absen otomatis.',
      noSetup:'Lokasi perusahaan belum diatur', notSupport:'Perangkat tidak mendukung GPS',
      loading:'⏳ Mendapatkan lokasi...', denied:'GPS ditolak. Silakan masukkan koordinat secara manual.'},
    ph:{section:'📍 LOKASYON NG KUMPANYA', radius:'Radius ng pagtuklas', btnGet:'📍 Kunin ang kasalukuyang lokasyon',
      checkinLbl:'⏱️ Minuto para kumpirmahin ang PASOK', checkoutLbl:'⏱️ Minuto para kumpirmahin ang LABAS',
      permTitle:'⚠️ Hinaharangan ng Chrome ang GPS para sa lokal na mga file',
      permBody:'Hindi pinapayagan ng Chrome mobile ang GPS kapag direktang binubuksan ang .html file<br><br><b>Mabilis na solusyon:</b> Buksan sa pamamagitan ng HTTPS',
      manualTitle:'🗺️ MAGLAGAY NG KOORDINASYON NG KAMAY',
      manualHint:'Buksan ang <b>Google Maps</b> → matagal na pindutin ang lokasyon ng kumpanya → kopyahin ang koordinasyon',
      lat:'Latitude', lng:'Longitude', saveManual:'✓ I-save ang lokasyon ng kumpanya',
      manualFooter:'📌 Paraan ng pagkuha ng koordinasyon: Buksan ang <b>Google Maps</b> → hanapin ang kumpanya → matagal na pindutin → kopyahin ang 2 numero',
      hostTitle:'🌐 I-enable ang GPS awtomatiko',
      tip:'💡 Pagkatapos i-save ang lokasyon, gagamitin ng app ang GPS upang suriin ang distansya at awtomatikong mag-record.',
      noSetup:'Hindi pa naitakda ang lokasyon ng kumpanya', notSupport:'Hindi sinusuportahan ng device ang GPS',
      loading:'⏳ Kinukuha ang lokasyon...', denied:'Tinanggihan ang GPS. Mangyaring ilagay ang mga koordinasyon nang mano-mano.'},
    ne:{section:'📍 कम्पनीको स्थान', radius:'पहिचान त्रिज्या', btnGet:'📍 हालको स्थान प्राप्त गर्नुस्',
      checkinLbl:'⏱️ हाजिर मिनेट पुष्टि', checkoutLbl:'⏱️ विदाइ मिनेट पुष्टि',
      permTitle:'⚠️ Chrome ले स्थानीय फाइलहरूको GPS ब्लक गर्छ',
      permBody:'Chrome मोबाइलले .html फाइल सिधै खोल्दा GPS अनुमति दिँदैन<br><br><b>द्रुत समाधान:</b> HTTPS मार्फत खोल्नुस्',
      manualTitle:'🗺️ म्यानुअल निर्देशांक प्रविष्ट गर्नुस्',
      manualHint:'<b>Google Maps</b> खोल्नुस् → कम्पनी स्थान लामो समय थिच्नुस् → निर्देशांक कोपी गर्नुस्',
      lat:'अक्षांश (Latitude)', lng:'देशान्तर (Longitude)', saveManual:'✓ कम्पनी स्थान सुरक्षित गर्नुस्',
      manualFooter:'📌 निर्देशांक कसरी पाउने: <b>Google Maps</b> खोल्नुस् → कम्पनी खोज्नुस् → लामो थिच्नुस् → २ संख्या कोपी गर्नुस्',
      hostTitle:'🌐 GPS स्वचालित रूपमा सक्षम गर्नुस्',
      tip:'💡 स्थान सुरक्षित गरेपछि, app ले GPS प्रयोग गरी दूरी जाँच्छ र स्वतः हाजिरी मार्छ।',
      noSetup:'कम्पनीको स्थान सेट गरिएको छैन', notSupport:'यन्त्रले GPS समर्थन गर्दैन',
      loading:'⏳ स्थान प्राप्त गर्दैछ...', denied:'GPS अस्वीकृत। कृपया निर्देशांक म्यानुअल रूपमा प्रविष्ट गर्नुस्।'},
    hi:{section:'📍 कंपनी का स्थान', radius:'पहचान त्रिज्या', btnGet:'📍 वर्तमान स्थान प्राप्त करें',
      checkinLbl:'⏱️ प्रवेश मिनट की पुष्टि', checkoutLbl:'⏱️ प्रस्थान मिनट की पुष्टि',
      permTitle:'⚠️ Chrome स्थानीय फ़ाइलों के लिए GPS ब्लॉक करता है',
      permBody:'Chrome मोबाइल .html फ़ाइल सीधे खोलने पर GPS की अनुमति नहीं देता<br><br><b>त्वरित समाधान:</b> HTTPS के माध्यम से खोलें',
      manualTitle:'🗺️ मैन्युअल निर्देशांक दर्ज करें',
      manualHint:'<b>Google Maps</b> खोलें → कंपनी स्थान को देर तक दबाएं → निर्देशांक कॉपी करें',
      lat:'अक्षांश (Latitude)', lng:'देशांतर (Longitude)', saveManual:'✓ कंपनी स्थान सहेजें',
      manualFooter:'📌 निर्देशांक कैसे प्राप्त करें: <b>Google Maps</b> → कंपनी खोजें → देर तक दबाएं → 2 संख्याएं कॉपी करें',
      hostTitle:'🌐 GPS स्वचालित रूप से सक्षम करें',
      tip:'💡 स्थान सहेजने के बाद, ऐप GPS से दूरी जांचता है और स्वचालित रूप से उपस्थिति दर्ज करता है।',
      noSetup:'कंपनी का स्थान निर्धारित नहीं है', notSupport:'डिवाइस GPS का समर्थन नहीं करता',
      loading:'⏳ स्थान प्राप्त हो रहा है...', denied:'GPS अस्वीकृत। कृपया निर्देशांक मैन्युअल रूप से दर्ज करें।'},
  };
  const gv = gpsT[L]||gpsT.vi;
  _s('gpsSectionTitle',      u('gps.section'));
  _s('gpsRadiusLbl',         u('gps.radius'));
  _s('gpsCheckinDelayLbl',   u('gps.checkin_lbl'));
  _s('gpsCheckoutDelayLbl',  u('gps.checkout_lbl'));
  _s('gpsTightCompanyLbl',   u('gps.tight_company_lbl'));
  _s('gpsTightCompanyHint',  u('gps.tight_company_hint'));
  _s('gpsBtnGetPos',         u('gps.btn_get'));
  _h('gpsPermTitle',    gv.permTitle);
  _h('gpsPermBody',     gv.permBody);
  _s('gpsManualTitle',  gv.manualTitle);
  _h('gpsManualHint',   gv.manualHint);
  _s('gpsLatLbl',       gv.lat);
  _s('gpsLngLbl',       gv.lng);
  _s('gpsBtnSaveManual',gv.saveManual);
  _h('gpsManualFooter', gv.manualFooter);
  _s('gpsHostTitle',    gv.hostTitle);
  _s('gpsTip',          u('gps.tip'));
  _s('gpsPanelTitle',   u('gps.panel_title'));
  _s('gpsAutoTitle',    u('gps.auto_title'));
  _s('gpsAutoSub',      u('gps.auto_sub'));

  // ═══ GPS v3 panel: Battery profile / Stats / Trail ═══
  _s('gpsV3BatteryTitle',    u('gpsv3.battery_title'));
  _s('gpsV3BatBtnNormal',    u('gpsv3.battery_normal'));
  _s('gpsV3BatBtnLow',       u('gpsv3.battery_low'));
  _s('gpsV3BatBtnCritical',  u('gpsv3.battery_min'));
  _s('gpsV3BatteryHint',     u('gpsv3.battery_hint'));
  _s('gpsV3StatsTitle',      u('gpsv3.stats_title'));
  _s('gpsV3StatsBtn',        u('gpsv3.refresh'));
  _s('gpsV3TrailTitle',      u('gpsv3.trail_title'));
  _s('gpsV3TrailBtn',        u('gpsv3.trail_today'));
  // Cập nhật placeholder text body chỉ khi đang ở placeholder mặc định (chưa load data)
  const v3statsBody = document.getElementById('gpsV3StatsBody');
  if(v3statsBody){
    const cur = v3statsBody.textContent || '';
    if(cur.includes('Bấm Refresh') || cur.includes('Tap Refresh') || cur.includes('새로고침을') || cur.includes('更新ボタン') || cur.includes('点击刷新')){
      v3statsBody.textContent = u('gpsv3.stats_empty');
    }
  }
  const v3trailBody = document.getElementById('gpsV3TrailBody');
  if(v3trailBody){
    const cur = v3trailBody.textContent || '';
    if(cur.includes('Bấm "Xem hôm nay"') || cur.includes('Tap "View today"') || cur.includes('"오늘 보기"') || cur.includes('「今日を表示」') || cur.includes('点击"查看今天"')){
      v3trailBody.textContent = u('gpsv3.trail_empty');
    }
  }

  // ═══ Smart Attendance panel (chấm công thông minh) ═══
  // Cập nhật saStatusText chỉ khi đang ở placeholder mặc định
  const saStatus = document.getElementById('saStatusText');
  if(saStatus){
    const _saTxt = saStatus.textContent || '';
    const _saPlaceholders = ['Chưa bật','Not enabled','비활성화','無効','未启用','ပိတ်ထား','ยังไม่เปิด','Belum aktif','Hindi pa naka-on','सक्षम छैन','सक्षम नहीं','Đang khởi động...','Starting...','시작 중...','起動中...','正在启动...','စတင်နေသည်...','กำลังเริ่มต้น...','Memulai...','Nagsisimula...','सुरु हुँदैछ...','प्रारंभ हो रहा...'];
    if(_saPlaceholders.indexOf(_saTxt) >= 0) saStatus.textContent = u('sa.status_off');
  }
  // Section headers: home/work profile titles+hints, signal debug
  _s('saHomeSectionTitle',   u('gps.home_title'));
  _s('saHomeSectionHint',    u('gps.home_hint'));
  _s('saWorkSectionTitle',   u('gps.work_title'));
  _s('saWorkSectionHint',    u('gps.work_hint'));
  _s('saSignalTitle',        u('gps.signal_title'));
  _s('saSignalRefreshBtn',   u('gps.signal_refresh'));
  // saSignalDebugBody placeholder
  const _saDbg = document.getElementById('saSignalDebugBody');
  if(_saDbg){
    const _dbgTxt = _saDbg.textContent || '';
    if(_dbgTxt.includes('Đang chờ') || _dbgTxt.includes('Waiting for') || _dbgTxt.includes('신호 대기') || _dbgTxt.includes('等待信号') || _dbgTxt.includes('Menunggu sinyal')){
      _saDbg.textContent = u('gps.signal_waiting');
    }
  }

  // Notification permission quick buttons
  _s('btnOpenNotifPerm',    u('perm.notif'));
  _s('btnOpenLocationPerm', u('perm.location'));
  _s('btnOpenBatteryPerm',  u('perm.battery'));
  // Cập nhật status text nếu đang hiện placeholder
  const gStEl=document.getElementById('gpsStatusTxt');
  if(gStEl && (gStEl.textContent.includes('Chưa thiết lập')||gStEl.textContent.includes('not set')||gStEl.textContent.includes('미설정')||gStEl.textContent.includes('未設定')||gStEl.textContent.includes('未设置')))
    gStEl.textContent=u('gps.no_setup');
  const sdEl=document.getElementById('salaryDetail');
  if(sdEl && (sdEl.textContent.includes('Nhập thông tin') || !sdEl.textContent.trim())){
    sdEl.textContent=t.salaryDetail||'Nhập thông tin lương để tính tự động';
  }
  // Panel lương — tiêu đề, nhãn thực nhận, nút lưu
  _s('salaryEstTitle', t.salaryEst||'Lương ước tính tháng này');
  _s('salaryNetLabel', t.salaryNet||'Thực nhận ước tính');
  _s('btnSaveSalary',  t.salarySave||'✓ Lưu thông tin lương');

  // ===== BẢNG GIỜ — toàn bộ label =====
  const _hT = {
    panelTitle: {vi:'💰 Bảng lương',en:'💰 Salary',ko:'💰 급여',ja:'💰 給与',zh:'💰 薪资',my:'💰 လစာ',th:'💰 เงินเดือน',id:'💰 Gaji',ph:'💰 Sahod',ne:'💰 तलब',hi:'💰 वेतन'},
    tabHours:   {vi:'⏱ Bảng giờ',  en:'⏱ Hours',  ko:'⏱ 근무시간',ja:'⏱ 勤務時間',zh:'⏱ 工时表',my:'⏱ နာရီ',th:'⏱ ชั่วโมง',id:'⏱ Jam',ph:'⏱ Oras',ne:'⏱ घण्टा',hi:'⏱ घंटे'},
    tabSalary:  {vi:'💵 Bảng lương',en:'💵 Salary', ko:'💵 급여',  ja:'💵 給与',  zh:'💵 薪资',  my:'💵 လစာ',th:'💵 เงินเดือน',id:'💵 Gaji',ph:'💵 Sahod',ne:'💵 तलब',hi:'💵 वेतन'},
    week:  {vi:'Tuần này',en:'This week',ko:'이번 주', ja:'今週',    zh:'本周',     my:'အပတ်',th:'สัปดาห์นี้',id:'Minggu ini',ph:'Linggong ito',ne:'यो हप्ता',hi:'इस सप्ताह'},
    month: {vi:'Tháng này',en:'This month',ko:'이번 달',ja:'今月',  zh:'本月',     my:'လ',th:'เดือนนี้',id:'Bulan ini',ph:'Ngayong buwan',ne:'यो महिना',hi:'इस महीने'},
    year:  {vi:'Năm nay', en:'This year',ko:'올해',   ja:'今年',    zh:'今年',     my:'နှစ်',th:'ปีนี้',id:'Tahun ini',ph:'Ngayong taon',ne:'यो वर्ष',hi:'इस वर्ष'},
    tongGio:  {vi:'Tổng giờ', en:'Total',     ko:'총 시간',  ja:'合計',  zh:'总时',  my:'စုစုပေါင်း',th:'รวมชั่วโมง',id:'Total jam',ph:'Kabuuang oras',ne:'जम्मा घण्टा',hi:'कुल घंटे'},
    ngayCong: {vi:'Ngày công',en:'Workdays',  ko:'근무일',  ja:'勤務日', zh:'工作日',my:'အလုပ်ရက်',th:'วันทำงาน',id:'Hari kerja',ph:'Araw ng trabaho',ne:'कार्य दिन',hi:'कार्य दिवस'},
    tangCa:   {vi:'Tăng ca',  en:'Overtime',  ko:'초과근무',ja:'残業',  zh:'加班',  my:'ချိန်ပို',th:'ล่วงเวลา',id:'Lembur',ph:'Overtime',ne:'ओभरटाइम',hi:'ओवरटाइम'},
    hLoai:  {vi:'Loại giờ',en:'Type',  ko:'구분', ja:'種類',  zh:'类型', my:'အမျိုးအစား',th:'ประเภท',id:'Jenis',ph:'Uri',ne:'प्रकार',hi:'प्रकार'},
    hGio:   {vi:'Giờ',     en:'Hour',  ko:'시간', ja:'時間',  zh:'小时', my:'နာရီ',th:'ชั่วโมง',id:'Jam',ph:'Oras',ne:'घण्टा',hi:'घंटे'},
    hNgay:  {vi:'Ngày',    en:'Day',   ko:'일',   ja:'日',    zh:'日',   my:'ရက်',th:'วัน',id:'Hari',ph:'Araw',ne:'दिन',hi:'दिन'},
    hTuan:  {vi:'Tuần',    en:'Week',  ko:'주',   ja:'週',    zh:'周',   my:'အပတ်',th:'สัปดาห์',id:'Minggu',ph:'Linggo',ne:'हप्ता',hi:'सप्ताह'},
    hThang: {vi:'Tháng',   en:'Month', ko:'월',   ja:'月',    zh:'月',   my:'လ',th:'เดือน',id:'Bulan',ph:'Buwan',ne:'महिना',hi:'माह'},
    rowBasic:{vi:'🟢 Giờ cơ bản',en:'🟢 Basic hours',ko:'🟢 기본 시간',ja:'🟢 基本時間',zh:'🟢 基本工时',my:'🟢 အခြေခံ',th:'🟢 ชั่วโมงปกติ',id:'🟢 Jam dasar',ph:'🟢 Oras base',ne:'🟢 आधारभूत',hi:'🟢 आधार घंटे'},
    rowOT:   {vi:'⚡ Tăng ca',   en:'⚡ Overtime',   ko:'⚡ 초과근무',  ja:'⚡ 残業',     zh:'⚡ 加班',     my:'⚡ ချိန်ပို',th:'⚡ ล่วงเวลา',id:'⚡ Lembur',ph:'⚡ Overtime',ne:'⚡ ओभरटाइम',hi:'⚡ ओवरटाइम'},
    rowNight:{vi:'🌙 Ca đêm',    en:'🌙 Night shift',ko:'🌙 야간근무', ja:'🌙 夜勤',    zh:'🌙 夜班',     my:'🌙 ညဆင်း',th:'🌙 กะกลางคืน',id:'🌙 Shift malam',ph:'🌙 Night shift',ne:'🌙 रात पाली',hi:'🌙 रात शिफ्ट'},
    rowHol:  {vi:'🎌 Ngày lễ',   en:'🎌 Holiday',    ko:'🎌 휴일근무', ja:'🎌 休日',    zh:'🎌 节假日',   my:'🎌 ရုံးပိတ်',th:'🎌 วันหยุด',id:'🎌 Libur',ph:'🎌 Holiday',ne:'🎌 बिदा',hi:'🎌 छुट्टी'},
    rowTotal:{vi:'📊 Tổng',      en:'📊 Total',      ko:'📊 합계',    ja:'📊 合計',    zh:'📊 总计',     my:'📊 စုစုပေါင်း',th:'📊 รวม',id:'📊 Total',ph:'📊 Kabuuan',ne:'📊 जम्मा',hi:'📊 कुल'},
  };
  _s('salaryPanelTitle', _hT.panelTitle[L]||_hT.panelTitle.vi);
  _s('tabHours',         _hT.tabHours[L]  ||_hT.tabHours.vi);
  _s('tabSalary',        _hT.tabSalary[L] ||_hT.tabSalary.vi);
  _s('pbWeek',           _hT.week[L]      ||_hT.week.vi);
  _s('pbMonth',          _hT.month[L]     ||_hT.month.vi);
  _s('pbYear',           _hT.year[L]      ||_hT.year.vi);
  _s('thTongGioLbl',     _hT.tongGio[L]   ||_hT.tongGio.vi);
  _s('thNgayCongLbl',    _hT.ngayCong[L]  ||_hT.ngayCong.vi);
  _s('thTangCaLbl',      _hT.tangCa[L]    ||_hT.tangCa.vi);
  _s('thHLoai',          _hT.hLoai[L]     ||_hT.hLoai.vi);
  _s('thHGio',           _hT.hGio[L]      ||_hT.hGio.vi);
  _s('thHNgay',          _hT.hNgay[L]     ||_hT.hNgay.vi);
  _s('thHTuan',          _hT.hTuan[L]     ||_hT.hTuan.vi);
  _s('thHThang',         _hT.hThang[L]    ||_hT.hThang.vi);
  _s('thRowBasicLbl',    _hT.rowBasic[L]  ||_hT.rowBasic.vi);
  _s('thRowOTLbl',       _hT.rowOT[L]     ||_hT.rowOT.vi);
  _s('thRowNightLbl',    _hT.rowNight[L]  ||_hT.rowNight.vi);
  _s('thRowHolLbl',      _hT.rowHol[L]    ||_hT.rowHol.vi);
  _s('thRowTotalLbl',    _hT.rowTotal[L]  ||_hT.rowTotal.vi);

  // Re-render các panel có nội dung động khi đổi ngôn ngữ
  if(document.getElementById('helpPanelBody')) renderHelpPanel();
  if(document.querySelector('#panelExcel.open')) renderExcelPreview();
  // Selector kiểu trả lương: Tháng / Ngày / Giờ
  const _smT={
    lbl: {vi:'Cách trả lương',en:'Payment method',ko:'급여 지급 방식',ja:'給与支払方法',zh:'薪资支付方式',my:'လစာပေးချေနည်း',th:'วิธีรับเงินเดือน',id:'Metode pembayaran',ph:'Paraan ng bayad',ne:'तलब भुक्तानी विधि',hi:'वेतन भुगतान विधि'},
    mo:  {vi:'Theo tháng',    en:'Monthly',       ko:'월급',          ja:'月給',         zh:'月薪',           my:'လစဉ်',th:'รายเดือน',id:'Bulanan',ph:'Buwanang',ne:'मासिक',hi:'मासिक'},
    da:  {vi:'Theo ngày',     en:'Daily',         ko:'일급',          ja:'日給',         zh:'日薪',           my:'နေ့စဉ်',th:'รายวัน',id:'Harian',ph:'Araw-araw',ne:'दैनिक',hi:'दैनिक'},
    ho:  {vi:'Theo giờ',      en:'Hourly',        ko:'시급',          ja:'時給',         zh:'时薪',           my:'နာရီ',th:'รายชั่วโมง',id:'Per jam',ph:'Bawat oras',ne:'प्रति घण्टा',hi:'प्रति घंटे'},
  };
  _s('salaryModeLbl', _smT.lbl[L]||_smT.lbl.vi);
  _s('smLblMonth',    _smT.mo[L]||_smT.mo.vi);
  _s('smLblDay',      _smT.da[L]||_smT.da.vi);
  _s('smLblHour',     _smT.ho[L]||_smT.ho.vi);
  // Cập nhật label input theo mode hiện tại
  if(typeof _salaryMode!=='undefined'){
    const _lblM={
      month:{vi:'Lương hợp đồng / tháng',en:'Contract salary / month',ko:'월 계약 급여',ja:'月額契約給与',zh:'合同月薪',my:'လစဉ်လစာ',th:'เงินเดือน/เดือน',id:'Gaji/bulan',ph:'Sahod/buwan',ne:'तलब/महिना',hi:'वेतन/माह'},
      day:  {vi:'Lương / ngày công',     en:'Salary / day',           ko:'일 급여',     ja:'日給',         zh:'日薪',     my:'နေ့စဉ်လစာ',th:'เงินค่าจ้าง/วัน',id:'Gaji/hari',ph:'Sahod/araw',ne:'तलब/दिन',hi:'वेतन/दिन'},
      hour: {vi:'Lương / giờ',           en:'Salary / hour',          ko:'시급',        ja:'時給',         zh:'时薪',     my:'နာရီလစာ',th:'เงินค่าจ้าง/ชั่วโมง',id:'Gaji/jam',ph:'Sahod/oras',ne:'तलब/घण्टा',hi:'वेतन/घंटे'},
    };
    _s('salaryContract2', _lblM[_salaryMode][L]||_lblM[_salaryMode].vi);
  }

  // Panel Về ứng dụng
  _s('aboutPanelTitle', 'ℹ️ '+(t.panelAbout||'Về ứng dụng').replace(/^ℹ️\s*/,''));
  const _ver={vi:'Phiên bản',en:'Version',ko:'버전',ja:'バージョン',zh:'版本',my:'ဗားရှင်း',th:'เวอร์ชัน',id:'Versi',ph:'Bersyon',ne:'संस्करण',hi:'संस्करण'}[L]||'Phiên bản';
  _s('aboutVersion', _ver+' 2.2.0');
  const _desc={
    vi:'App chấm công thông minh hỗ trợ đa ngôn ngữ, tính lương theo luật lao động 6 quốc gia. Dữ liệu lưu trên thiết bị, bảo mật tuyệt đối.',
    en:'Smart attendance app with multilingual support and salary calculation per labor law for 6 countries. Data stored locally on your device.',
    ko:'6개국 노동법에 따른 급여 계산을 지원하는 스마트 출퇴근 앱. 데이터는 기기에 로컬로 저장됩니다.',
    ja:'6か国の労働法に基づく給与計算に対応したスマート勤怠管理アプリ。データは端末内に保存されます。',
    zh:'支持6国劳动法薪资计算的智能考勤应用。数据存储在本地设备上，安全可靠。',
    my:'နိုင်ငံ ၆ ခု၏ အလုပ်သမားဥပဒေအတိုင်း လစာတွက်ချက်သောApp။ ဒေတာကိုကိရိယာပေါ်တွင်သိမ်းသည်။'
  }[L]||'';
  _s('aboutDesc', _desc);

  // Reset confirm panel buttons
  const resetBox=document.querySelector('#panelConfirmReset');
  if(resetBox){
    const rBtns=resetBox.querySelectorAll('button');
    const rCancel={vi:'Hủy bỏ',en:'Cancel',ko:'취소',ja:'キャンセル',zh:'取消',my:'ပယ်ဖျက်',th:'ยกเลิก',id:'Batal',ph:'Kanselahin',ne:'रद्द',hi:'रद्द करें'};
    const rOk={vi:'🗑 Xóa hết',en:'🗑 Delete All',ko:'🗑 모두 삭제',ja:'🗑 全て削除',zh:'🗑 全部删除',my:'🗑 ဖျက်',th:'🗑 ลบทั้งหมด',id:'🗑 Hapus Semua',ph:'🗑 Burahin Lahat',ne:'🗑 सबै मेटाउनुस्',hi:'🗑 सभी हटाएं'};
    if(rBtns[0])rBtns[0].textContent=rCancel[L]||rCancel.vi;
    if(rBtns[1])rBtns[1].textContent=rOk[L]||rOk.vi;
    const rTitle=resetBox.querySelector('[style*="E8433A"][style*="font-size:18px"]');
    const rTitleMap={vi:'Xóa toàn bộ dữ liệu?',en:'Delete all data?',ko:'모든 데이터를 삭제할까요?',ja:'全データを削除しますか？',zh:'删除所有数据？',my:'ဒေတာဖျက်မလား?',th:'ลบข้อมูลทั้งหมด?',id:'Hapus semua data?',ph:'Burahin ang lahat ng data?',ne:'सबै डेटा मेटाउने?',hi:'सभी डेटा हटाएं?'};
    if(rTitle)rTitle.textContent=rTitleMap[L]||rTitleMap.vi;
  }

  // Re-render if on cal screen
  if(document.getElementById('screenCal')?.classList.contains('active')){
    renderCalBig();
  }
  updateClock();

  // Sync i18n cho các UI mới của GPS v3 + Background notifications
  if(typeof syncGpsV3I18n === 'function') syncGpsV3I18n();
  if(typeof syncBgStatusI18n === 'function') syncBgStatusI18n();

  // Re-render các UI có nội dung động dùng helper i18n (_saB, u, getLang…).
  // Đảm bảo khi đổi ngôn ngữ là tất cả text user-visible refresh ngay, không phải tắt-mở app.
  try{ if(typeof saUpdateUI === 'function') saUpdateUI(); }catch(e){}
  try{ if(typeof saRenderHomeProfile === 'function') saRenderHomeProfile(); }catch(e){}
  try{ if(typeof saRenderWorkProfile === 'function') saRenderWorkProfile(); }catch(e){}
  try{ if(typeof saRenderSubWorkProfile === 'function') saRenderSubWorkProfile(); }catch(e){}
  try{ if(typeof updateGpsStatus === 'function') updateGpsStatus(); }catch(e){}
  try{ if(typeof renderHomeStats === 'function') renderHomeStats(); }catch(e){}
  try{ if(typeof renderHomeStatsActual === 'function') renderHomeStatsActual(); }catch(e){}
  try{ if(typeof renderSubJobSalary === 'function') renderSubJobSalary(); }catch(e){}
  try{ if(typeof renderCalDayList === 'function') renderCalDayList(); }catch(e){}
  try{ if(typeof updateTodayStatusTime === 'function') updateTodayStatusTime(); }catch(e){}
  // Salary panel — chỉ re-render khi đang mở (calcSalaryActual có side-effect)
  try{
    if(typeof calcSalaryActual === 'function' && document.querySelector('#panelSalary.open')){
      calcSalaryActual();
    }
  }catch(e){}
  // Đồng bộ ngôn ngữ sang native ngay → notification native cũng đổi theo
  try{
    if(window.ccNative && window.ccNative.syncNativeGps && window._gpsData){
      window.ccNative.syncNativeGps(window._gpsData);
    }
  }catch(e){}
}

/* ═══════════════════════════════════════════════════════════════════════════
   I18N CHO GPS v3 CARDS (Battery profile, Stats, Trail viewer)
   ═══════════════════════════════════════════════════════════════════════════ */
/** Đồng bộ text các card GPS v3 theo ngôn ngữ */
function syncGpsV3I18n(){
  const L = (userData && userData.lang) || 'vi';
  const T = {
    vi:{
      batteryTitle:'🔋 Chế độ pin', batNormal:'Bình thường', batLow:'Tiết kiệm', batCritical:'Tối thiểu',
      batteryHint:'⚡ Tự động chuyển khi pin yếu (cần Battery API)',
      statsTitle:'📊 Trạng thái GPS', statsRefresh:'Làm mới', statsHint:'Bấm Làm mới để xem...',
      trailTitle:'📍 GPS Trail (Audit)', trailView:'Xem hôm nay', trailHint:'Bấm "Xem hôm nay" để hiển thị...'
    },
    en:{
      batteryTitle:'🔋 Battery mode', batNormal:'Normal', batLow:'Saver', batCritical:'Minimum',
      batteryHint:'⚡ Auto-switch on low battery (Battery API required)',
      statsTitle:'📊 GPS Status', statsRefresh:'Refresh', statsHint:'Tap Refresh to view...',
      trailTitle:'📍 GPS Trail (Audit)', trailView:'View today', trailHint:'Tap "View today" to show...'
    },
    ko:{
      batteryTitle:'🔋 배터리 모드', batNormal:'보통', batLow:'절약', batCritical:'최소',
      batteryHint:'⚡ 배터리 부족 시 자동 전환 (Battery API 필요)',
      statsTitle:'📊 GPS 상태', statsRefresh:'새로고침', statsHint:'새로고침을 눌러 확인...',
      trailTitle:'📍 GPS 기록 (감사)', trailView:'오늘 보기', trailHint:'"오늘 보기"를 눌러 표시...'
    },
    ja:{
      batteryTitle:'🔋 バッテリーモード', batNormal:'通常', batLow:'省電力', batCritical:'最小',
      batteryHint:'⚡ バッテリー残量低下時に自動切替 (Battery APIが必要)',
      statsTitle:'📊 GPSステータス', statsRefresh:'更新', statsHint:'更新を押して表示...',
      trailTitle:'📍 GPS履歴 (監査)', trailView:'今日を表示', trailHint:'「今日を表示」を押して表示...'
    },
    zh:{
      batteryTitle:'🔋 电池模式', batNormal:'正常', batLow:'省电', batCritical:'最低',
      batteryHint:'⚡ 电量低时自动切换 (需要 Battery API)',
      statsTitle:'📊 GPS 状态', statsRefresh:'刷新', statsHint:'点击刷新查看...',
      trailTitle:'📍 GPS 轨迹 (审计)', trailView:'查看今天', trailHint:'点击"查看今天"显示...'
    },
    my:{
      batteryTitle:'🔋 ဘတ္ထရီ မုဒ်', batNormal:'ပုံမှန်', batLow:'ချွေတာ', batCritical:'အနည်းဆုံး',
      batteryHint:'⚡ ဘတ္ထရီနည်းသောအခါ အလိုအလျောက်ပြောင်းသည် (Battery API လိုအပ်)',
      statsTitle:'📊 GPS အခြေအနေ', statsRefresh:'ပြန်လည်ဖွင့်', statsHint:'ကြည့်ရန် ပြန်လည်ဖွင့်ကို နှိပ်ပါ...',
      trailTitle:'📍 GPS မှတ်တမ်း', trailView:'ဒီနေ့ ကြည့်', trailHint:'"ဒီနေ့ ကြည့်" ကို နှိပ်ပါ...'
    },
    th:{
      batteryTitle:'🔋 โหมดแบตเตอรี่', batNormal:'ปกติ', batLow:'ประหยัด', batCritical:'ขั้นต่ำ',
      batteryHint:'⚡ สลับอัตโนมัติเมื่อแบตอ่อน (ต้องใช้ Battery API)',
      statsTitle:'📊 สถานะ GPS', statsRefresh:'รีเฟรช', statsHint:'กดรีเฟรชเพื่อดู...',
      trailTitle:'📍 บันทึก GPS', trailView:'ดูวันนี้', trailHint:'กด "ดูวันนี้" เพื่อแสดง...'
    },
    id:{
      batteryTitle:'🔋 Mode baterai', batNormal:'Normal', batLow:'Hemat', batCritical:'Minimum',
      batteryHint:'⚡ Otomatis beralih saat baterai lemah (perlu Battery API)',
      statsTitle:'📊 Status GPS', statsRefresh:'Refresh', statsHint:'Tap Refresh untuk lihat...',
      trailTitle:'📍 Jejak GPS (Audit)', trailView:'Lihat hari ini', trailHint:'Tap "Lihat hari ini" untuk tampilkan...'
    },
    ph:{
      batteryTitle:'🔋 Battery mode', batNormal:'Normal', batLow:'Tipid', batCritical:'Minimum',
      batteryHint:'⚡ Awtomatikong lumipat kapag mababa ang baterya (kailangan ng Battery API)',
      statsTitle:'📊 Status ng GPS', statsRefresh:'I-refresh', statsHint:'Pindutin ang Refresh upang tingnan...',
      trailTitle:'📍 GPS Trail (Audit)', trailView:'Tingnan ngayon', trailHint:'Pindutin ang "Tingnan ngayon" upang ipakita...'
    },
    ne:{
      batteryTitle:'🔋 ब्याट्री मोड', batNormal:'सामान्य', batLow:'बचत', batCritical:'न्यूनतम',
      batteryHint:'⚡ ब्याट्री कम भएमा स्वत: परिवर्तन (Battery API चाहिन्छ)',
      statsTitle:'📊 GPS स्थिति', statsRefresh:'रिफ्रेस', statsHint:'हेर्न रिफ्रेस थिच्नुहोस्...',
      trailTitle:'📍 GPS ट्रेल (अडिट)', trailView:'आज हेर्नुस्', trailHint:'देखाउन "आज हेर्नुस्" थिच्नुहोस्...'
    },
    hi:{
      batteryTitle:'🔋 बैटरी मोड', batNormal:'सामान्य', batLow:'बचत', batCritical:'न्यूनतम',
      batteryHint:'⚡ बैटरी कम होने पर स्वत: स्विच (Battery API आवश्यक)',
      statsTitle:'📊 GPS स्थिति', statsRefresh:'रिफ्रेश', statsHint:'देखने के लिए रिफ्रेश दबाएं...',
      trailTitle:'📍 GPS ट्रेल (ऑडिट)', trailView:'आज देखें', trailHint:'दिखाने के लिए "आज देखें" दबाएं...'
    }
  };
  const t = T[L] || T.vi;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };

  setText('gpsV3BatteryTitle',  t.batteryTitle);
  setText('gpsV3BatBtnNormal',  t.batNormal);
  setText('gpsV3BatBtnLow',     t.batLow);
  setText('gpsV3BatBtnCritical',t.batCritical);
  setText('gpsV3BatteryHint',   t.batteryHint);
  setText('gpsV3StatsTitle',    t.statsTitle);
  setText('gpsV3StatsBtn',      t.statsRefresh);
  setText('gpsV3TrailTitle',    t.trailTitle);
  setText('gpsV3TrailBtn',      t.trailView);

  // Cập nhật text mặc định trong body chỉ nếu đang là placeholder
  const statsBody = document.getElementById('gpsV3StatsBody');
  if(statsBody){
    const isDefault = /^Bấm |^Tap |^새로고침|^更新|^刷新|^ကြည့်|^กด|^Pindutin|^हेर्न|^देखने/.test(statsBody.textContent.trim());
    if(isDefault || !statsBody.textContent.includes('Platform')) statsBody.textContent = t.statsHint;
  }
  const trailBody = document.getElementById('gpsV3TrailBody');
  if(trailBody){
    const isDefault = /^Bấm |^Tap |^"오늘|^「今日|^点击|^"ဒီနေ့|^กด |^Pindutin |^"आज/.test(trailBody.textContent.trim());
    if(isDefault) trailBody.textContent = t.trailHint;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   I18N CHO BACKGROUND STATUS CARD (panel Notification)
   ═══════════════════════════════════════════════════════════════════════════ */
/** Đồng bộ text card "Trạng thái chạy ngầm" theo ngôn ngữ */
function syncBgStatusI18n(){
  const L = (userData && userData.lang) || 'vi';
  const T = {
    vi:{title:'🛡️ Trạng thái chạy ngầm', refresh:'🔄 Làm mới',
        reschedule:'⏰ Lên lịch lại tất cả'},
    en:{title:'🛡️ Background Status', refresh:'🔄 Refresh',
        reschedule:'⏰ Re-schedule all'},
    ko:{title:'🛡️ 백그라운드 상태', refresh:'🔄 새로고침',
        reschedule:'⏰ 모두 재예약'},
    ja:{title:'🛡️ バックグラウンド状態', refresh:'🔄 更新',
        reschedule:'⏰ 全て再スケジュール'},
    zh:{title:'🛡️ 后台状态', refresh:'🔄 刷新',
        reschedule:'⏰ 重新安排全部'},
    my:{title:'🛡️ နောက်ခံ အခြေအနေ', refresh:'🔄 ပြန်လည်ဖွင့်',
        reschedule:'⏰ အားလုံး ပြန်စီစဉ်ရန်'},
    th:{title:'🛡️ สถานะพื้นหลัง', refresh:'🔄 รีเฟรช',
        reschedule:'⏰ จัดตารางใหม่ทั้งหมด'},
    id:{title:'🛡️ Status Background', refresh:'🔄 Refresh',
        reschedule:'⏰ Jadwalkan ulang semua'},
    ph:{title:'🛡️ Background Status', refresh:'🔄 I-refresh',
        reschedule:'⏰ I-reschedule lahat'},
    ne:{title:'🛡️ ब्याकग्राउन्ड स्थिति', refresh:'🔄 रिफ्रेस',
        reschedule:'⏰ सबै फेरि तालिका'},
    hi:{title:'🛡️ बैकग्राउंड स्थिति', refresh:'🔄 रिफ्रेश',
        reschedule:'⏰ सब रीशेड्यूल करें'}
  };
  const t = T[L] || T.vi;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  };

  setText('bgStatusTitle', t.title);
  setText('btnOpenNotifPerm',    u('perm.notif') || '🔔 Quyền thông báo');
  setText('btnOpenLocationPerm', u('perm.location') || '📍 Quyền vị trí');
  setText('btnOpenBatteryPerm',  u('perm.battery') || '🔋 Cài đặt pin');

  // Cập nhật nút Refresh (là sibling của bgStatusTitle, không có id riêng)
}

/* ===== KHỞI ĐỘNG APP ===== */
/** Khởi động app: load data → kiểm tra onboarding → vào Home hoặc Onboarding */
function init(){
  loadData();
  loadGpsData();
  // Restore GPS toggle
  if(_gpsData.enabled){
    const btn=document.getElementById('togN3');
    if(btn)btn.classList.add('on');
    const card=document.getElementById('gpsSetupCard');
    if(card)card.style.display='block';
    notifCfg.n3 = true;
    if(typeof gpsScheduleAutoStart === 'function'){
      gpsScheduleAutoStart('app-init');
    } else if(typeof ensureGpsAutoRunning === 'function'){
      ensureGpsAutoRunning('app-init');
    } else if(_gpsData.lat && typeof startGeofencing === 'function'){
      startGeofencing();
    }
  }
  // Restore open-shift reminders (chỉ chạy 1 lần khi app start, không chạy trong GPS poll)
  setTimeout(function(){
    if(typeof gpsRestoreOpenShiftReminders === 'function') gpsRestoreOpenShiftReminders();
  }, 2000);
  // Check if first time
  if(!userData.name){
    goScreen('screenOB');
    renderOB();
  }else{
    goScreen('screenHome');
    initHome();
    setTimeout(moSplash, 600);
  }
  // notif toggles
  ['n1','n2','n3','n4'].forEach((k,i)=>{
    const el=document.getElementById(`togN${i+1}`);
    if(el){el.className='toggle-sw'+(notifCfg[k]?' on':'');}
  });
  // settings subs
  document.getElementById('siLangSub').textContent=LANGS.find(l=>l.id===userData.lang)?.name||'Tiếng Việt';
  document.getElementById('siCountrySub').textContent=cLang(COUNTRIES.find(c=>c.id===userData.country)?.name)||'Việt Nam';
}

// Defer init() đến khi DOM + tất cả scripts (utils.js, app.js, checkin.js) đã load xong
// → đảm bảo loadGpsData (defined in checkin.js) đã sẵn sàng
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM đã sẵn sàng → defer 1 tick để chắc chắn checkin.js đã load
  setTimeout(init, 0);
}

/* PATCH v2.2.8 - keep shift reminder notifications after setup changes */
(function(){
  if(window.__setupNotificationReschedulePatchInstalled) return;
  window.__setupNotificationReschedulePatchInstalled = true;

  var retryTimer = null;
  var debounceTimer = null;

  function requestSetupNotificationReschedule(reason){
    window.__ccPendingNotificationReschedule = true;
    window.__ccPendingNotificationReason = reason || 'setup';
    if(debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function(){
      tryRunReschedule(0);
    }, 300);
  }

  function tryRunReschedule(attempt){
    if(retryTimer) clearTimeout(retryTimer);
    if(typeof window.rescheduleNativeNotifications === 'function'){
      window.__ccPendingNotificationReschedule = false;
      Promise.resolve(window.rescheduleNativeNotifications()).then(function(){
        if(typeof refreshBgStatus === 'function') setTimeout(refreshBgStatus, 800);
      }).catch(function(e){
        console.warn('[SetupNotif] reschedule failed:', e);
      });
      return;
    }
    if(attempt < 30){
      retryTimer = setTimeout(function(){ tryRunReschedule(attempt + 1); }, 500);
    }
  }

  function wrap(name, reason){
    var oldFn = window[name];
    if(typeof oldFn !== 'function' || oldFn.__setupNotifWrapped) return;
    var wrapped = function(){
      var result = oldFn.apply(this, arguments);
      requestSetupNotificationReschedule(reason || name);
      return result;
    };
    wrapped.__setupNotifWrapped = true;
    window[name] = wrapped;
    try{ eval(name + ' = window[name]'); }catch(e){}
  }

  window.ccRequestNotificationReschedule = requestSetupNotificationReschedule;

  ['saveSetup','onSetupShiftTimeChange','selCurShift','selShift','selHours','selHoursCustomSetup','selBreak','selBreakMin','selLangSetting','selCountrySetting'].forEach(function(name){
    wrap(name, name);
  });

  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(function(){ requestSetupNotificationReschedule('boot'); }, 2200);
    _updateNotifDot();
  });
})();

// ══════════════════════════════════════════════════════
//  NOTIFICATION HISTORY — lịch sử thông báo (max 100)
// ══════════════════════════════════════════════════════

function _nhEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _nhTimeAgo(ms) {
  if (ms < 60000)    return Math.floor(ms / 1000) + 'g trước';
  if (ms < 3600000)  return Math.floor(ms / 60000) + 'p trước';
  if (ms < 86400000) return Math.floor(ms / 3600000) + 'h trước';
  return Math.floor(ms / 86400000) + 'ng trước';
}

function _updateNotifDot() {
  try {
    var dot = document.getElementById('notifDot');
    if (!dot) return;
    var arr = JSON.parse(localStorage.getItem('cp22_notif_history') || '[]');
    var lastSeen = parseInt(localStorage.getItem('cp22_notif_last_seen') || '0', 10);
    var unread = arr.filter(function(n){ return n.at > lastSeen; }).length;
    dot.style.display = unread > 0 ? 'block' : 'none';
  } catch(e) {}
}

function renderNotifHistory() {
  var list = document.getElementById('notifHistoryList');
  var countEl = document.getElementById('notifHistoryCount');
  if (!list) return;
  // Đánh dấu đã đọc
  localStorage.setItem('cp22_notif_last_seen', String(Date.now()));
  var dot = document.getElementById('notifDot');
  if (dot) dot.style.display = 'none';
  try {
    var arr = JSON.parse(localStorage.getItem('cp22_notif_history') || '[]');
    if (countEl) countEl.textContent = arr.length + ' thông báo';
    if (arr.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:48px 20px;color:var(--text3)">'
        + '<div style="font-size:48px;margin-bottom:12px">🔕</div>'
        + '<div style="font-size:14px;font-weight:800;color:var(--text2)">Chưa có thông báo nào</div>'
        + '<div style="font-size:12px;margin-top:6px">Thông báo từ app sẽ hiển thị ở đây</div>'
        + '</div>';
      return;
    }
    var now = Date.now();
    var html = arr.map(function(n) {
      var icon = n.type === 'scheduled' ? '🕐' : '🔔';
      var ago  = _nhTimeAgo(now - n.at);
      var schedLine = (n.type === 'scheduled' && n.scheduledFor)
        ? '<div style="font-size:10px;color:#cc8800;margin-top:3px">⏰ ' + new Date(n.scheduledFor).toLocaleString() + '</div>'
        : '';
      return '<div style="padding:12px 16px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:flex-start">'
        + '<div style="font-size:22px;flex-shrink:0;line-height:1">' + icon + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:3px">' + _nhEsc(n.title) + '</div>'
        + '<div style="font-size:12px;color:var(--text2);line-height:1.4">' + _nhEsc(n.body) + '</div>'
        + schedLine
        + '</div>'
        + '<div style="font-size:10px;color:var(--text3);white-space:nowrap;padding-top:2px">' + ago + '</div>'
        + '</div>';
    }).join('');
    list.innerHTML = html;
  } catch(e) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3)">Lỗi tải lịch sử</div>';
  }
}

function clearNotifHistory() {
  localStorage.removeItem('cp22_notif_history');
  localStorage.removeItem('cp22_notif_last_seen');
  renderNotifHistory();
}
