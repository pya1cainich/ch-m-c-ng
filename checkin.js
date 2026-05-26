/* ── checkin.js ── */
/* ════════════════════════════════════════════════════════════════════
   checkin.js — CHẤM CÔNG THỦ CÔNG & TỰ ĐỘNG GPS
   Load SAU app.js (cần: userData, attData, renderHomeStats, u(), lsGet/lsSet)

   📌 Chỉnh sửa:
   ┌─────────────────────────────────────────────────────────────┐
   │ Thay đổi thời gian xác nhận GPS mặc định:                  │
   │   _gpsData.checkinMin  = 20  (phút chờ xác nhận VÀO ca)    │
   │   _gpsData.checkoutMin = 80  (phút chờ xác nhận HẾT ca)    │
   │ Thay đổi bán kính GPS tối thiểu:                           │
   │   Slider HTML: min="25" max="500" step="25"                 │
   │ Thay đổi thông báo GPS (banner):                           │
   │   UI_STR['gps.active'], UI_STR['gps.saved'] trong app.js   │
   └─────────────────────────────────────────────────────────────┘

   ════════════════════════════════════════════════════════════════════ */

/* ===== CHẤM CÔNG THỦ CÔNG ===== */
/* [LEGACY_ATTENDANCE_MANUAL]
   Ghi chu: day la logic cham cong thu cong cu cho nut Vao/Ra ca
   va popup chon job. Khong xoa khi sua GPS/native vi nhieu man hinh
   van ghi truc tiep vao attData thong qua cac ham ben duoi.
*/
/** Tạo key cho ngày hôm nay theo format 'YYYY-MM-DD' để lưu attData */
function todayKey(){const n=new Date();return typeof dateKeyFromDate==='function'?dateKeyFromDate(n):`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;}
function fmtTime(d){return`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}

function _attJobLabel(job){
  if(job === 'sub') return (userData.subJob && userData.subJob.name) || (typeof u === 'function' ? u('job.sub') : 'Job phụ');
  return typeof u === 'function' ? u('job.main') : 'Công việc chính';
}

function _attEditNoticeText(action, job, time){
  const L = (userData && userData.lang) || 'vi';
  const dict = {
    vi:'Đã chấm công mốc này rồi. Hãy vào Lịch chấm công để sửa.',
    en:'This attendance time is already recorded. Edit it in Attendance Calendar.',
    ko:'이 출퇴근 기록은 이미 저장되었습니다. 근태 달력에서 수정하세요.',
    ja:'この打刻はすでに記録されています。勤怠カレンダーで修正してください。',
    zh:'此打卡时间已记录。请到考勤日历中修改。',
    my:'ဤအချိန်ကို မှတ်တမ်းတင်ပြီးပါပြီ။ ပြင်ရန် Attendance Calendar သို့ သွားပါ။',
    th:'บันทึกเวลานี้แล้ว กรุณาแก้ไขในปฏิทินลงเวลา',
    id:'Waktu absensi ini sudah tercatat. Ubah melalui Kalender Absensi.',
    ph:'Naitala na ang oras na ito. I-edit sa Attendance Calendar.',
    ne:'यो हाजिरी समय पहिले नै रेकर्ड भएको छ। Attendance Calendar मा गएर सच्याउनुहोस्।',
    hi:'यह उपस्थिति समय पहले ही दर्ज है। Attendance Calendar में जाकर संशोधित करें।'
  };
  const label = _attJobLabel(job);
  const kind = action === 'out' ? 'OUT' : 'IN';
  return `${label} ${kind}${time ? ' ' + time : ''}: ${dict[L] || dict.vi}`;
}

function showAttendanceEditNotice(action, job, time){
  let banner = document.getElementById('attendanceEditNotice');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'attendanceEditNotice';
    banner.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);'
      + 'z-index:30000;width:calc(100% - 28px);max-width:380px;padding:13px 16px;'
      + 'border-radius:14px;background:#1A2332;color:white;font-size:13px;font-weight:800;'
      + 'font-family:Nunito,sans-serif;line-height:1.35;text-align:center;'
      + 'box-shadow:0 12px 32px rgba(0,0,0,.32);transition:opacity .25s, transform .25s;'
      + 'pointer-events:auto';
    banner.onclick = () => { banner.style.opacity = '0'; };
    document.body.appendChild(banner);
  }
  banner.textContent = _attEditNoticeText(action, job, time);
  banner.style.opacity = '1';
  banner.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => { banner.style.opacity = '0'; }, 4200);
  if(navigator.vibrate) navigator.vibrate(35);
}

function _attendanceRec(job){
  const day = attData[todayKey()];
  return job === 'sub' ? day && day.sub : day;
}

function _blockIfAttendanceExists(action, job){
  const rec = _attendanceRec(job);
  if(rec && rec[action]){
    showAttendanceEditNotice(action, job, rec[action]);
    return true;
  }
  return false;
}

/** Bấm VÀO CA: ghi nhận giờ vào, cập nhật UI và stats */
function doCheckin(){
  const hasSub = userData.subJob && userData.subJob.active;
  if(hasSub){
    showJobPicker('in');
  } else {
    _doCheckinMain();
  }
}
function doCheckout(){
  const hasSub = userData.subJob && userData.subJob.active;
  if(hasSub){
    showJobPicker('out');
  } else {
    _doCheckoutMain();
  }
}

/** Thực hiện chấm VÀO ca job chính */
function _doCheckinMain(){
  if(typeof gpsEnsureCycleForCheckin === 'function'){
    var guardMain = gpsEnsureCycleForCheckin('main', { source: 'manual', allowConfirm: true, showBanner: true });
    if(!guardMain || !guardMain.allowed) return;
  }
  if(_blockIfAttendanceExists('in', 'main')) return;
  const k=todayKey();
  const now=new Date();
  const t=fmtTime(now);
  if(!attData[k])attData[k]={type:'cm'};
  if(typeof attendanceSetIn==='function')attendanceSetIn(attData[k],k,t,now.getTime());
  else{attData[k].in=t;attData[k].checkInAt=now.getTime();}
  attData[k].type='cm';
  saveAtt();
  addRipple('rippleIn');
  document.getElementById('lastIn').textContent=_lbl_in(t);
  if(typeof updateTodayStatusTime === 'function') updateTodayStatusTime();
  renderHomeStats();
}
/** Thực hiện chấm HẾT ca job chính */
function _doCheckoutMain(){
  if(_blockIfAttendanceExists('out', 'main')) return;
  const k=todayKey();
  const now=new Date();
  const t=fmtTime(now);
  if(!attData[k])attData[k]={type:'cm'};
  if(typeof attendanceSetOut==='function')attendanceSetOut(attData[k],k,t,now.getTime());
  else{attData[k].out=t;attData[k].checkOutAt=now.getTime();}
  saveAtt();
  addRipple('rippleOut');
  document.getElementById('lastOut').textContent=_lbl_out(t);
  if(typeof updateTodayStatusTime === 'function') updateTodayStatusTime();
  renderHomeStats();
}
/** Thực hiện chấm VÀO ca job phụ */
function _doCheckinSub(){
  if(typeof gpsEnsureCycleForCheckin === 'function'){
    var guardSub = gpsEnsureCycleForCheckin('sub', { source: 'manual', allowConfirm: true, showBanner: true });
    if(!guardSub || !guardSub.allowed) return;
  }
  if(_blockIfAttendanceExists('in', 'sub')) return;
  const k=todayKey();
  const now=new Date();
  const t=fmtTime(now);
  if(!attData[k])attData[k]={type:'cm'};
  if(!attData[k].sub) attData[k].sub={type:'cm'};
  if(typeof attendanceSetIn==='function')attendanceSetIn(attData[k].sub,k,t,now.getTime());
  else{attData[k].sub.in=t;attData[k].sub.checkInAt=now.getTime();}
  attData[k].sub.type='cm';
  saveAtt();
  addRipple('rippleIn');
  const subName = userData.subJob?.name || u('job.sub');
  document.getElementById('lastIn').textContent='💼 '+subName+' '+t;
  if(typeof updateTodayStatusTime === 'function') updateTodayStatusTime();
  renderHomeStats();
}
/** Thực hiện chấm HẾT ca job phụ */
function _doCheckoutSub(){
  if(_blockIfAttendanceExists('out', 'sub')) return;
  const k=todayKey();
  const now=new Date();
  const t=fmtTime(now);
  if(!attData[k])attData[k]={type:'cm'};
  if(!attData[k].sub) attData[k].sub={type:'cm'};
  if(typeof attendanceSetOut==='function')attendanceSetOut(attData[k].sub,k,t,now.getTime());
  else{attData[k].sub.out=t;attData[k].sub.checkOutAt=now.getTime();}
  saveAtt();
  addRipple('rippleOut');
  const subName = userData.subJob?.name || u('job.sub');
  document.getElementById('lastOut').textContent='💼 '+subName+' '+t;
  if(typeof updateTodayStatusTime === 'function') updateTodayStatusTime();
  renderHomeStats();
}

/** Hiện popup chọn Job chính / Job phụ trước khi chấm công */
function showJobPicker(action){
  // action = 'in' hoặc 'out'
  const subName = userData.subJob?.name || u('job.sub');
  const isIn = action === 'in';
  const titleText = isIn ? u('home.in_at').replace(/\s*$/,'') : u('home.out_at').replace(/\s*$/,'');

  // Tạo overlay popup
  let ov = document.getElementById('jobPickerOv');
  if(ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'jobPickerOv';
  ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s';
  ov.onclick = e => { if(e.target===ov) ov.remove(); };

  const box = document.createElement('div');
  box.style.cssText = 'background:white;border-radius:20px;padding:24px 20px;width:90%;max-width:340px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)';
  box.innerHTML = `
    <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">${titleText}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:20px">Chọn công việc bạn đang ${isIn?'bắt đầu':'kết thúc'}</div>
    <div style="display:flex;gap:12px">
      <button id="jpMain" style="flex:1;padding:16px 10px;border-radius:14px;border:2px solid var(--ac);background:linear-gradient(135deg,var(--ac),#40E0D0);color:white;font-size:14px;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;display:flex;flex-direction:column;align-items:center;gap:6px">
        <span style="font-size:28px">🏢</span>
        <span>${u('job.main')}</span>
      </button>
      <button id="jpSub" style="flex:1;padding:16px 10px;border-radius:14px;border:2px solid #7B5EA7;background:linear-gradient(135deg,#7B5EA7,#9B6FC0);color:white;font-size:14px;font-weight:800;cursor:pointer;font-family:Nunito,sans-serif;display:flex;flex-direction:column;align-items:center;gap:6px">
        <span style="font-size:28px">💼</span>
        <span>${subName}</span>
      </button>
    </div>
    <button onclick="document.getElementById('jobPickerOv').remove()" style="margin-top:14px;padding:10px;border:none;background:none;color:var(--text3);font-size:13px;cursor:pointer;font-family:Nunito,sans-serif">Hủy</button>
  `;
  ov.appendChild(box);
  document.body.appendChild(ov);

  // Wire button actions
  box.querySelector('#jpMain').onclick = () => {
    ov.remove();
    if(isIn) _doCheckinMain(); else _doCheckoutMain();
  };
  box.querySelector('#jpSub').onclick = () => {
    ov.remove();
    if(isIn) _doCheckinSub(); else _doCheckoutSub();
  };
}
function timeToMin(s){const[h,m]=s.split(':').map(Number);return h*60+m;}
/** Trả về chuỗi "Vào lúc HH:MM" theo ngôn ngữ hiện tại */
function _lbl_in(t){return u('home.in_at')+t;}
/** Trả về chuỗi "Ra lúc HH:MM" theo ngôn ngữ hiện tại */
function _lbl_out(t){return u('home.out_at')+t;}
/** Trả về chuỗi "✓ Vào ca HH:MM" theo ngôn ngữ hiện tại */
function _lbl_status_in(t){return u('home.status_in')+t;}
/** Trả về chuỗi "⏱ X.Xh làm việc" theo ngôn ngữ hiện tại */
function _lbl_hours(h){return '⏱ '+h+u('home.h_worked');}
/** Tạo hiệu ứng gợn sóng (ripple) khi bấm nút chấm công */
function addRipple(id){
  const el=document.getElementById(id);
  if(!el)return;
  const c=document.createElement('div');
  c.className='ripple-circle';
  el.appendChild(c);
  setTimeout(()=>c.remove(),700);
}

/* ===== THỐNG KÊ TRANG CHỦ ===== */
/** Khởi tạo màn Trang chủ: cập nhật tên, ảnh, theme, stats */
function initHome(){
  applyI18n();
  document.getElementById('homeUname').textContent=userData.name||u('user.default_name');
  document.getElementById('homeUjob').textContent=(userData.job||u('user.default_job'))+(userData.company?` · ${userData.company}`:'');
  if(apCfg.avtB64){
    document.getElementById('homeAvt').innerHTML=`<img src="${apCfg.avtB64}">`;
  }
  applyTheme(apCfg.color||0);
  applyCalColors();
  renderHomeStats();
  updateClock();
  // restore today status
  const k=todayKey();
  if(attData[k]){
    if(attData[k].in)document.getElementById('lastIn').textContent=_lbl_in(attData[k].in);
    if(attData[k].out)document.getElementById('lastOut').textContent=_lbl_out(attData[k].out);
  }
  if(typeof updateTodayStatusTime === 'function') updateTodayStatusTime();
  // salary
  if(userData.salary){
    document.getElementById('salaryInput').value=userData.salary;
    calcSalary();
  }
}

/** Tính và hiển thị thống kê tháng: giờ làm, có mặt/vắng/nghỉ phép, thang đo mức làm việc */
function renderHomeStats(){
  const _tl=getLang();
  const now=new Date();
  const y=now.getFullYear(),m=now.getMonth();
  let cm=0,v=0,np=0,totalH=0;
  const daysInMonth=new Date(y,m+1,0).getDate();
  for(let d=1;d<=daysInMonth;d++){
    const k=dateKeyFromParts(y,m,d);
    const rec=attData[k];
    if(!rec)continue;
    if(rec.type==='cm')cm++;
    else if(rec.type==='vang')v++;
    else if(rec.type==='np')np++;
    if(rec.in&&rec.out){
      const h=(typeof attendanceWorkedHours==='function'?attendanceWorkedHours(rec,k):soGio(rec.in,rec.out))||0;
      totalH+=h;
    }else if(rec.type==='cm'){
      totalH+=userData.hoursPerShift||8;
    }
  }
  const ot=Math.max(0,totalH-176);
  document.getElementById('statCM').textContent=cm;
  document.getElementById('statV').textContent=v;
  document.getElementById('statNP').textContent=np;
  document.getElementById('statOT').textContent=ot>0?`${ot.toFixed(0)}h`:'0h';
  // meter
  document.getElementById('meterHours').textContent=`${totalH.toFixed(0)}h`;
  const maxH=260;
  const pct=Math.min(100,totalH/maxH*100);
  const fill=document.getElementById('meterFill');
  let fillColor='linear-gradient(90deg,#0D9E75,#40E0D0)';
  let badgeTxt=_tl.binhThuong||'Bình thường',badgeBg='#E0F5EE',badgeFg='#0a7d5c';
  if(totalH>220){fillColor='linear-gradient(90deg,#0D9E75,#F5A623,#E8433A)';badgeTxt=_tl.quaSuc||'Quá sức 🔥';badgeBg='#FFF0EF';badgeFg='#E8433A';}
  else if(totalH>176){fillColor='linear-gradient(90deg,#0D9E75,#F5A623)';badgeTxt=_tl.chamChi||'Chăm chỉ ⚡';badgeBg='#FFF8E8';badgeFg='#cc8800';}
  fill.style.width=`${Math.max(2,pct)}%`;
  fill.style.background=fillColor;
  const mb=document.getElementById('meterBadge');
  if(mb){mb.textContent=badgeTxt;mb.style.background=badgeBg;mb.style.color=badgeFg;}
  // salary
  calcSalary();
}

/* ===== TÍNH LƯƠNG ƯỚC TÍNH ===== */
/** Tính lương ước tính theo quốc gia: OT, ca đêm, ngày lễ, bảo hiểm, thuế TNCN
 *  Hỗ trợ 3 kiểu trả lương: theo tháng / theo ngày / theo giờ */
function calcSalary(){
  // Đọc từ input nếu panel đang mở, nếu không dùng giá trị đã lưu
  const _salInp = document.getElementById('salaryInput');
  const mode = _salaryMode || userData.salaryMode || 'month';
  const _savedSal = mode==='month' ? (userData.salary||0)
                  : mode==='day'   ? (userData.salaryDay||0)
                  :                   (userData.salaryHour||0);
  const inputVal = parseFloat(_salInp?.value)||_savedSal||0;
  const ngc = userData.ngc||26;
  const gioCA = userData.hoursPerShift||8;

  // Quy về lương tháng để dùng engine cũ
  let raw = 0;
  if(mode === 'month'){
    raw = inputVal || userData.salary || 0;
  } else if(mode === 'day'){
    // Lương ngày × số ngày công chuẩn = lương tháng
    raw = (inputVal || userData.salaryDay || 0) * ngc;
    userData.salaryDay = inputVal;
  } else if(mode === 'hour'){
    // Lương giờ × giờ/ngày × ngày công = lương tháng
    raw = (inputVal || userData.salaryHour || 0) * gioCA * ngc;
    userData.salaryHour = inputVal;
  }
  userData.salary = raw;
  userData.salaryMode = mode;
  saveUser();
  // Update cfg shim for v21 engine
  _cfg_shim={luong:raw,ngayCong:userData.ngc||26,gioNgay:userData.hoursPerShift||8,kieu:'thang',vung:5310000};
  syncLangCfg();
  const rule=getPayrollRule();
  const now=new Date();const y=now.getFullYear(),m=now.getMonth();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const lN=ldN();const lG=lgN();
  let cm=0,np=0,v=0,ll=0,nightDays=0,tongGop=0,tongOT=0;
  for(let d=1;d<=daysInMonth;d++){
    const rec=getAttRecordByDateParts(y,m,d);
    if(!rec)continue;
    const nl=gNL(y,m,d);
    const sg=rec.in&&rec.out?(typeof attendanceWorkedHours==='function'?attendanceWorkedHours(rec,dateKeyFromParts(y,m,d)):soGio(rec.in,rec.out)):gioCA;
    const otGio=Math.max(0,(sg||gioCA)-gioCA);
    let nightGio=0;
    if(rec.in&&rec.out)nightGio=typeof attendanceNightHours==='function'?attendanceNightHours(rec,dateKeyFromParts(y,m,d),rule.nightStart,rule.nightEnd):calcNightHours(rec.in,rec.out,rule.nightStart,rule.nightEnd);
    const nightPct=(rule.nightFactor||1.3)-1.0;
    const nightTien=rule.nightIsAdditive?nightGio*lG*rule.nightFactor:nightGio*lG*nightPct;
    let otTien=0;
    if(langCfg.payrollCountry==='TW'){
      const ot1=Math.min(otGio,rule.ot1Hours||2);
      const ot2=Math.min(Math.max(0,otGio-(rule.ot1Hours||2)),rule.ot2Hours||2);
      otTien=(ot1*lG*(rule.ot1Factor||1.33))+(ot2*lG*(rule.ot2Factor||1.67));
    }else{otTien=otGio*lG*(rule.otFactor||1.5);}
    if(rec.type==='cm'){cm++;tongGop+=lN+nightTien+otTien;tongOT+=otTien;if(nightGio>1)nightDays++;}
    else if(rec.type==='np'){np++;tongGop+=lN;}
    else if(rec.type==='vang'){v++;tongGop-=lN;}
    else if(rec.type==='ll'){ll++;tongGop+=lN*(rule.holidayFactor||4.0)+nightTien+otTien;}
  }
  const pr=PAYROLL_RULES[langCfg.payrollCountry]||PAYROLL_RULES.VN;
  const country = langCfg.payrollCountry || 'VN';

  // ===== TAX ENGINE — dùng quy tắc thực tế từng quốc gia =====
  // tongGop = gross tháng (đã cộng OT, ca đêm, lễ; đã trừ vắng)
  const taxResult = taxEngineCalculate(country, Math.max(0, tongGop), userData.dependents || 0);
  const bhTong   = taxResult.insurance;
  const thueTong = taxResult.tax;
  const net      = taxResult.net;
  const taxRule  = taxResult.rule;
  const cur=pr.currency||'₫';
  const fmtN=n=>{
    if(country==='VN') return Math.round(n).toLocaleString('vi-VN')+'₫';
    const sym=pr.currency||'';
    return sym+(Math.round(n)).toLocaleString();
  };
  const bd=document.getElementById('salaryBreakdown');
  if(bd){
    bd.innerHTML=
      // Translated salary labels
      (()=>{const L=userData.lang||'vi';const _b={vi:{coMat:'Có mặt',ngay:'ngày',caDem:'Ca đêm',tangCa:'Tăng ca',nghiPhep:'Nghỉ phép',vang:'Vắng',lamLe:'Làm ngày lễ'},en:{coMat:'Present',ngay:'days',caDem:'Night shift',tangCa:'Overtime',nghiPhep:'Leave',vang:'Absent',lamLe:'Holiday work'},ko:{coMat:'출근',ngay:'일',caDem:'야간 근무',tangCa:'초과근무',nghiPhep:'연차',vang:'결근',lamLe:'휴일 근무'},ja:{coMat:'出勤',ngay:'日',caDem:'夜勤',tangCa:'残業',nghiPhep:'有給',vang:'欠勤',lamLe:'休日出勤'},zh:{coMat:'出勤',ngay:'天',caDem:'夜班',tangCa:'加班',nghiPhep:'请假',vang:'缺勤',lamLe:'节假日'},my:{coMat:'တက်',ngay:'ရက်',caDem:'ညဆင်း',tangCa:'ချိန်ပို',nghiPhep:'ခွင့်',vang:'ပျက်',lamLe:'ရုံးပိတ်ရက်'},th:{coMat:'มาทำงาน',ngay:'วัน',caDem:'กะกลางคืน',tangCa:'ล่วงเวลา',nghiPhep:'ลา',vang:'ขาดงาน',lamLe:'ทำงานวันหยุด'},id:{coMat:'Hadir',ngay:'hari',caDem:'Shift malam',tangCa:'Lembur',nghiPhep:'Cuti',vang:'Absen',lamLe:'Kerja hari libur'},ph:{coMat:'Dumalo',ngay:'araw',caDem:'Night shift',tangCa:'Overtime',nghiPhep:'Leave',vang:'Absent',lamLe:'Holiday work'},ne:{coMat:'उपस्थित',ngay:'दिन',caDem:'रात पाली',tangCa:'ओभरटाइम',nghiPhep:'बिदा',vang:'अनुपस्थित',lamLe:'बिदा काम'},hi:{coMat:'उपस्थित',ngay:'दिन',caDem:'रात शिफ्ट',tangCa:'ओवरटाइम',nghiPhep:'छुट्टी',vang:'अनुपस्थित',lamLe:'छुट्टी काम'}}[L]||{coMat:'Có mặt',ngay:'ngày',caDem:'Ca đêm',tangCa:'Tăng ca',nghiPhep:'Nghỉ phép',vang:'Vắng',lamLe:'Làm ngày lễ'};return `<strong>${pr.flag} ${cLang(pr.name)}</strong> · ${cLang(pr.basis)}<br>`+
      `${_b.coMat}: ${cm} ${_b.ngay} × ${fmtN(lN)} = <strong>${fmtN(cm*lN)}</strong><br>`+
      (nightDays>0?`${_b.caDem} (${nightDays} ${_b.ngay}, +${Math.round((rule.nightFactor-1)*100)}%) = <strong style="color:#7B5EA7">+${fmtN(nightDays*lG*gioCA*(rule.nightFactor-1))}</strong><br>`:'')+ 
      (tongOT>0?`${_b.tangCa} (×${rule.otFactor||1.5}): <strong style="color:#F5A623">+${fmtN(tongOT)}</strong><br>`:'')+ 
      (np>0?`${_b.nghiPhep}: ${np} ${_b.ngay} = <strong>${fmtN(np*lN)}</strong><br>`:'')+
      (v>0?`${_b.vang}: -${v} ${_b.ngay} = <strong style="color:#E8433A">-${fmtN(v*lN)}</strong><br>`:'')+
      (ll>0?`${_b.lamLe}: ${ll} ${_b.ngay} × ${rule.holidayFactor||4} = <strong style="color:#2D7DD2">${fmtN(ll*lN*(rule.holidayFactor||4))}</strong><br>`:'')+
      '';})();
      // insurance/tax labels → u('salary.insurance'), u('salary.tax')
      // Hiển thị bảo hiểm + thuế — chỉ hiện nếu > 0 để tránh "-0₫"
      const _bhPct = bhTong>0&&tongGop>0 ? ' ('+(bhTong/tongGop*100).toFixed(1)+'%)' : '';
      let insTxt = '';
      if(bhTong>0) insTxt += `${u('salary.insurance')}${_bhPct}: <strong style="color:#E8433A">-${fmtN(bhTong)}</strong>`;
      if(thueTong>0) insTxt += (insTxt?'<br>':'')+`${u('salary.tax')}: <strong style="color:#E8433A">-${fmtN(thueTong)}</strong>`;
      if(insTxt) bd.innerHTML+=insTxt;
  }
  const netEl=document.getElementById('salaryNet');
  if(netEl)netEl.textContent=fmtN(net);
  const amtEl=document.getElementById('salaryAmount');
  if(amtEl)amtEl.textContent=fmtN(tongGop>0?tongGop:0);
  const detEl=document.getElementById('salaryDetail');
  if(detEl)detEl.textContent=raw?`${cm} ngày có mặt · ${cLang(pr.name)} · Thực nhận ≈ ${fmtN(net)}`:getLang().salaryDetail||'Nhập thông tin lương để tính tự động';
  saveUser();
}

/* ===== LỊCH CHẤM CÔNG ===== */
/** Vẽ lịch tháng: header, các ô ngày với màu trạng thái chấm công */
function renderCalBig(){
  const {y,m}=calView;
  const _cm = MONTHS[m] || (()=>{const L=userData.lang||'vi';return ['zh','ja'].includes(L)?`${m+1}月`:L==='ko'?`${m+1}월`:`Tháng ${m+1}`;})();
  document.getElementById('calBigMonth').textContent=`${_cm} ${y}`;
  document.getElementById('calScreenSub').textContent=`${_cm}, ${y}`;
  const grid=document.getElementById('calBigDays');
  grid.innerHTML='';
  const fd=new Date(y,m,1).getDay();
  const nd=new Date(y,m+1,0).getDate();
  const hn=new Date();
  for(let i=0;i<fd;i++){const d=document.createElement('div');d.className='cal-day empty';grid.appendChild(d);}
  for(let g=1;g<=nd;g++){
    const thu=(fd+g-1)%7;
    const k=dateKeyFromParts(y,m,g);
    const rec=attData[k];
    const isToday=g===hn.getDate()&&m===hn.getMonth()&&y===hn.getFullYear();
    const nl=gNL(y,m,g);
    let cls='cal-day';
    if(thu===0)cls+=' sun';if(thu===6)cls+=' sat';
    if(isToday)cls+=' today';
    else if(rec){
      if(rec.type==='cm')cls+=' cm';
      else if(rec.type==='vang')cls+=' vang';
      else if(rec.type==='np')cls+=' np';
      else if(rec.type==='ll')cls+=' ll';
    }else if(nl&&!rec){cls+=' le';}
    else if(thu===0||thu===6){cls+=' ct';}
    const d=document.createElement('div');
    d.className=cls;


    // === Nội dung ô lịch: DUAL JOB support ===
    const hasMain = rec && rec.type === 'cm' && rec.in;
    const hasSub  = rec && rec.sub && rec.sub.in;
    const hasBoth = hasMain && hasSub;

    const statusIcon={cm:'\u2713',vang:'\u2715',np:'\u2600',ll:'\u2605'}[rec?.type]||'';
    let timeStr='';
    if(rec?.in&&rec?.out) timeStr=rec.in+'\u2013'+rec.out;
    else if(rec?.in)      timeStr='\u2192'+rec.in;
    else if(rec?.out)     timeStr=rec.out+'\u2190';

    let subTimeStr = '';
    if(hasSub){
      if(rec.sub.in && rec.sub.out) subTimeStr = rec.sub.in+'\u2013'+rec.sub.out;
      else if(rec.sub.in) subTimeStr = '\u2192'+rec.sub.in;
    }

    // GPS badge
    const gpsCoord = (_gpsData && _gpsData.lat && _gpsData.lng);
    const gpsIcon = (rec && (rec.in||rec.out) && gpsCoord) ? '<div style="font-size:7px;color:#2D7DD2;line-height:1">\ud83d\udccd</div>' : '';

    let inner = '';

    if(hasBoth){
      // CẢ 2 JOB: chia ô 3 phần: ngày / giờ chính / giờ phụ
      d.classList.add('dual-job-day');
      const mainLabel = u('job.main');
      const subLabelRaw = (userData?.subJob?.name || u('job.sub'));
      const mainTime = timeStr || ((rec.in||'') + (rec.out ? '–'+rec.out : ''));
      const subTime = subTimeStr || ((rec.sub.in||'') + (rec.sub.out ? '–'+rec.sub.out : ''));
      // Dùng nhãn thật ngắn để toàn bộ nội dung vừa trong ô lịch.
      const mainShort = 'CHÍNH';
      const subShort = 'PHỤ';
      inner = `<div class="dual-job-box" title="${mainLabel}: ${mainTime} | ${subLabelRaw}: ${subTime}">` +
        `<div class="dual-job-date-row">` +
          `<span class="dual-job-daynum">${g}</span>` +
          `<span class="dual-job-status">✓</span>` +
        `</div>` +
        `<div class="dual-job-work dual-job-main">` +
          `<span class="dual-job-icon">✓</span>` +
          `<div class="dual-job-lines">` +
            `<div class="dual-job-title">${mainShort}</div>` +
            `<div class="dual-job-time">${mainTime}</div>` +
          `</div>` +
        `</div>` +
        `<div class="dual-job-work dual-job-sub">` +
          `<span class="dual-job-icon">💼</span>` +
          `<div class="dual-job-lines">` +
            `<div class="dual-job-title">${subShort}</div>` +
            `<div class="dual-job-time">${subTime}</div>` +
          `</div>` +
        `</div>` +
      `</div>`;
    } else if(hasSub && !hasMain){
      // CHỈ JOB PHỤ: nền tím
      d.style.background = '#f0ebff';
      d.style.borderLeft = '3px solid #7B5EA7';
      inner = `<div class="d-num" style="color:#7B5EA7">${g}</div>`;
      inner += `<div class="d-icon" style="color:#7B5EA7">\ud83d\udcbc</div>`;
      if(subTimeStr) inner += `<div class="d-time" style="color:#7B5EA7;font-size:10px">${subTimeStr}</div>`;
    } else if(rec){
      // JOB CHÍNH hoặc trạng thái khác (giữ nguyên)
      inner = `<div class="d-num">${g}</div>`;
      if(statusIcon) inner+=`<div class="d-icon">${statusIcon}</div>`;
      if(timeStr)    inner+=`<div class="d-time">${timeStr}</div>`;
      if(gpsIcon)    inner+=gpsIcon;
    } else if(nl){
      inner = `<div class="d-num">${g}</div>`;
      inner+=`<div class="d-holiday">${nl.substring(0,8)}</div>`;
    } else {
      inner = `<div class="d-num">${g}</div>`;
    }

    d.innerHTML=inner;
    d.onclick=()=>dayTap(g);
    grid.appendChild(d);
  }
  // Day list
  renderCalDayList();
  // Re-apply background after days rendered
  requestAnimationFrame(()=>requestAnimationFrame(applyCalBg));
}
/** Chuyển tháng trên lịch (dir: -1=trước, +1=sau) */
function calChange(dir){calView.m+=dir;if(calView.m>11){calView.m=0;calView.y++;}if(calView.m<0){calView.m=11;calView.y--;}renderCalBig();}
/** Hiển thị danh sách các ngày có chấm công trong tháng */
function renderCalDayList(){
  const {y,m}=calView;
  const nd=new Date(y,m+1,0).getDate();
  const list=document.getElementById('calDayList');
  list.innerHTML='';
  const hasSub = userData.subJob && userData.subJob.active;
  const subName = (userData.subJob?.name || u('job.sub')).substring(0,8);
  let count=0;

  for(let g=nd;g>=1&&count<15;g--){
    const k=dateKeyFromParts(y,m,g);
    const rec=attData[k];
    if(!rec)continue;
    count++;

    const dayName = DAYS[(new Date(y,m,g).getDay())];
    const hasMainTime = rec.in || rec.out;
    const hasSubTime  = rec.sub && (rec.sub.in || rec.sub.out);
    const mainTime = rec.in && rec.out ? `${rec.in} – ${rec.out}` : rec.in ? `→ ${rec.in}` : '';
    const subTime  = hasSubTime ? (rec.sub.in && rec.sub.out ? `${rec.sub.in} – ${rec.sub.out}` : `→ ${rec.sub.in||''}`) : '';

    const el=document.createElement('div');
    el.style.cssText='display:flex;background:white;border-radius:14px;margin-bottom:8px;box-shadow:0 2px 8px rgba(0,0,0,.06);overflow:hidden;min-height:56px';
    el.onclick=()=>dayTap(g);

    // === CỘT 1: Ngày tháng (nền xám nhạt, bên trái) ===
    const colDate = `<div style="width:60px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f5f5f5;padding:8px 4px">
      <div style="font-size:18px;font-weight:900;color:var(--text);line-height:1">${g}</div>
      <div style="font-size:10px;color:var(--text3);font-weight:600;margin-top:2px">${dayName}</div>
    </div>`;

    // === CỘT 2: Job chính (nền xanh nhạt) ===
    let colMain = '';
    if(hasMainTime || rec.type){
      const statusIcon = {cm:'✓',vang:'✕',np:'☀',ll:'★'}[rec.type]||'';
      colMain = `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:8px 10px;background:#f0faf5;border-left:3px solid var(--ac)">
        <div style="font-size:10px;font-weight:800;color:var(--ac);margin-bottom:2px">${statusIcon} ${u('job.main')}</div>
        <div style="font-size:13px;font-weight:700;color:#0a6644">${mainTime || '—'}</div>
      </div>`;
    } else {
      colMain = `<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:8px;color:#ccc;font-size:11px">—</div>`;
    }

    // === CỘT 3: Job phụ (nền tím nhạt) — chỉ hiện khi có sub job active ===
    let colSub = '';
    if(hasSub){
      if(hasSubTime){
        colSub = `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:8px 10px;background:#f0ebff;border-left:3px solid #7B5EA7">
          <div style="font-size:10px;font-weight:800;color:#7B5EA7;margin-bottom:2px">💼 ${subName}</div>
          <div style="font-size:13px;font-weight:700;color:#5a3e8e">${subTime}</div>
        </div>`;
      } else {
        colSub = `<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:8px;background:#faf8ff;color:#c8b4f0;font-size:11px">—</div>`;
      }
    }

    el.innerHTML = colDate + colMain + colSub;
    list.appendChild(el);
  }

  const _emptyTxt=(TRAN[userData.lang||'vi']||TRAN.vi).calEmpty||'Chưa có dữ liệu tháng này';
  if(count===0){list.innerHTML='<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-txt">'+_emptyTxt+'</div></div>';}
}
function dayTap(g){const {y,m}=calView;openDayPanel(g,y,m);}

function legacyHolidayLabel(langPack){
  if(langPack && (langPack.lamLe || langPack.chipLL)) return langPack.lamLe || langPack.chipLL;
  try{ if(typeof u === 'function') return u('salary.holiday'); }catch(e){}
  return 'Holiday work';
}

/* ===== XUẤT FILE EXCEL ===== */
/** Hiển thị bảng xem trước dữ liệu Excel trước khi xuất */
function renderExcelPreview(){
  const {y,m}=calView;
  const nd=new Date(y,m+1,0).getDate();
  const _t2=getLang();
  const STATUS={cm:_t2.coMat||'Có mặt',vang:_t2.vang||'Vắng',np:_t2.nghiPhep||'Nghỉ phép',ll:legacyHolidayLabel(_t2)};
  const CLS={cm:'cm',vang:'vg',np:'',ll:''};
  const _hdr={vi:['Ngày','Thứ','Trạng thái','Vào','Ra'],en:['Date','Day','Status','In','Out'],ko:['날짜','요일','상태','출근','퇴근'],ja:['日付','曜日','状態','出勤','退勤'],zh:['日期','星期','状态','上班','下班'],my:['ရက်','နေ့','အခြေ','တက်','ဆင်'],th:['วันที่','วัน','สถานะ','เข้า','ออก'],id:['Tanggal','Hari','Status','Masuk','Keluar'],ph:['Petsa','Araw','Katayuan','Pasok','Labas'],ne:['मिति','बार','अवस्था','प्रवेश','निस्किने'],hi:['तारीख','दिन','स्थिति','प्रवेश','प्रस्थान']}[userData.lang||'vi']||['Ngày','Thứ','Trạng thái','Vào','Ra'];
  let rows=`<div class="excel-row head">${_hdr.map(h=>'<div class="excel-cell">'+h+'</div>').join('')}</div>`;
  let count=0;
  for(let g=1;g<=nd&&count<8;g++){
    const k=dateKeyFromParts(y,m,g);const rec=attData[k];if(!rec)continue;count++;
    const thu=DAYS[new Date(y,m,g).getDay()];
    const lbl=STATUS[rec.type]||rec.type;
    const cls=CLS[rec.type]||'';
    rows+=`<div class="excel-row"><div class="excel-cell">${g}/${m+1}</div><div class="excel-cell">${thu}</div><div class="excel-cell ${cls}">${lbl}</div><div class="excel-cell">${rec.in||''}</div><div class="excel-cell">${rec.out||''}</div></div>`;
  }
  const _noData=(TRAN[userData.lang||'vi']||TRAN.vi).noData||'Chưa có dữ liệu';
  if(count===0)rows+='<div style="padding:16px;text-align:center;color:var(--text3);font-size:13px">'+_noData+'</div>';
  document.getElementById('excelPreview').innerHTML=rows;
}
/** Xuất file CSV (mở được bằng Excel). Thêm BOM để Excel đọc được tiếng Việt */
function doExport(){
  const {y,m}=calView;const nd=new Date(y,m+1,0).getDate();
  const _t3=getLang();
  const STATUS={cm:_t3.coMat||'Có mặt',vang:_t3.vang||'Vắng',np:_t3.nghiPhep||'Nghỉ phép',ll:legacyHolidayLabel(_t3)};
  // CSV header với cột Vị trí GPS
  const _csvHdr={
    vi:'Ngày,Thứ,Trạng thái,Giờ vào,Giờ ra,Số giờ,Vị trí GPS',
    en:'Date,Day,Status,In,Out,Hours,GPS Location',
    ko:'날짜,요일,상태,출근,퇴근,시간,GPS 위치',
    ja:'日付,曜日,状態,出勤,退勤,時間,GPS位置',
    zh:'日期,星期,状态,上班,下班,时长,GPS位置',
    my:'ရက်,နေ့,အခြေ,တက်,ဆင်,ချိန်,GPS တည်နေရာ',th:'วันที่,วัน,สถานะ,เข้า,ออก,ชั่วโมง,GPS',id:'Tanggal,Hari,Status,Masuk,Keluar,Jam,GPS',ph:'Petsa,Araw,Katayuan,Pasok,Labas,Oras,GPS',ne:'मिति,बार,अवस्था,प्रवेश,निस्किने,घण्टा,GPS',hi:'तारीख,दिन,स्थिति,प्रवेश,प्रस्थान,घंटे,GPS'
  }[userData.lang||'vi']||'Ngày,Thứ,Trạng thái,Giờ vào,Giờ ra,Số giờ,Vị trí GPS';
  let csv=_csvHdr+'\n';
  // Lấy tọa độ GPS đã lưu (nếu có)
  const gpsCoord = (_gpsData && _gpsData.lat && _gpsData.lng)
    ? `${_gpsData.lat.toFixed(6)}, ${_gpsData.lng.toFixed(6)}`
    : '';
  for(let g=1;g<=nd;g++){
    const k=dateKeyFromParts(y,m,g);const rec=attData[k];
    const thu=DAYS[new Date(y,m,g).getDay()];
    const lbl=rec?STATUS[rec.type]||'':'';
    const ins=rec?.in||'',outs=rec?.out||'';
    let dur='';
    if(ins&&outs)dur=(((timeToMin(outs)-timeToMin(ins)+1440)%1440)/60).toFixed(1);
    // Cột vị trí: chỉ ghi tọa độ nếu ngày đó có chấm công
    const loc = (ins || outs) ? `"${gpsCoord}"` : '';
    csv+=`${g}/${m+1}/${y},${thu},${lbl},${ins},${outs},${dur},${loc}\n`;
  }
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;
  a.download='ChamCong.csv';
  document.body.appendChild(a);a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},300);
  closePanel('panelExcel');
}

/* ===== GIAO DIỆN & CHỈNH SỬA THEME ===== */
/** Hiển thị grid các chấm màu theme để người dùng chọn */
function renderColorGrid(){
  const grid=document.getElementById('colorGrid');
  grid.innerHTML=THEMES.map((t,i)=>`
    <div class="color-dot${apCfg.color===i?' sel':''}" style="background:${t.bg}" onclick="selColor(${i})" title="${t.name}"></div>
  `).join('');
}
/** Chọn màu theme, lưu và apply ngay */
function selColor(i){
  apCfg.color=i;saveAp();applyTheme(i);renderColorGrid();
}
/** Inject CSS variables cho màu theme vào <head> */
function applyTheme(i){
  const t=THEMES[i]||THEMES[0];
  let st=document.getElementById('dynTheme');
  if(!st){st=document.createElement('style');st.id='dynTheme';document.head.appendChild(st);}
  st.textContent=`:root{--ac:${t.bg};--ac2:${t.bg};--ac-lt:${t.lt};}`;
}
async function uploadAvt(inp){
  if(!inp.files[0])return;
  const fr=new FileReader();
  fr.onload=e=>{
    apCfg.avtB64=e.target.result;saveAp();
    document.getElementById('apAvtPrev').innerHTML=`<img src="${e.target.result}">`;
    document.getElementById('homeAvt').innerHTML=`<img src="${e.target.result}">`;
  };
  fr.readAsDataURL(inp.files[0]);
}
const GRADIENTS=[
  {id:'none',label:'Không',css:'',preview:'#F4F7F6'},
  {id:'g1',label:'Bình minh',css:'linear-gradient(135deg,#f9a825,#e91e63)'},
  {id:'g2',label:'Biển',css:'linear-gradient(135deg,#0288d1,#26c6da)'},
  {id:'g3',label:'Rừng',css:'linear-gradient(135deg,#1b5e20,#66bb6a)'},
  {id:'g4',label:'Hoàng hôn',css:'linear-gradient(135deg,#ff6f00,#ad1457)'},
  {id:'g5',label:'Tím',css:'linear-gradient(135deg,#4a148c,#e91e63)'},
  {id:'g6',label:'Mint',css:'linear-gradient(135deg,#00695c,#80cbc4)'},
  {id:'g7',label:'Đêm',css:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)'},
  {id:'g8',label:'Hồng',css:'linear-gradient(135deg,#f06292,#fff9c4)'},
];

/** Hiển thị các ô gradient preset để chọn nền lịch */
function renderGradientGrid(){
  const grid=document.getElementById('gradientGrid');
  if(!grid)return;
  grid.innerHTML=GRADIENTS.map(g=>{
    const isSel=(!apCfg.bgB64&&apCfg.bgGrad===g.css)||(g.id==='none'&&!apCfg.bgB64&&!apCfg.bgGrad);
    const preview=g.css||g.preview;
    return`<div onclick="selectGradient('${g.id}','${g.css.replace(/'/g,"\\'")}')" style="width:52px;height:40px;border-radius:10px;cursor:pointer;border:3px solid ${isSel?'var(--text)':'transparent'};background:${preview};transition:all .15s;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center" title="${g.label}">${g.id==='none'?'<span style="font-size:16px">✕</span>':''}</div>`;
  }).join('');
}

function selectGradient(id,css){
  apCfg.bgGrad=css;
  if(id==='none'){apCfg.bgGrad='';apCfg.bgB64='';}
  saveAp();applyCalBg();renderGradientGrid();updateBgPreview();
}

const _WRAP_BASE='margin:0 8px;margin-top:-60px;border-radius:20px;overflow:hidden;';

/** Apply ảnh nền hoặc gradient lên calendar wrap, đổi màu text cho dễ đọc */
function applyCalBg(){
  const wrap=document.getElementById('calBigWrap');
  if(!wrap) return; // not on calendar screen yet

  if(apCfg.bgB64){
    // Photo background
    wrap.setAttribute('style',
      _WRAP_BASE +
      `box-shadow:var(--shadow);position:relative;z-index:2;` +
      `background-image:url(${apCfg.bgB64});` +
      `background-size:cover;background-position:center top;` +
      `background-color:#333`
    );
    _applyCalTextWhite(true);
  } else if(apCfg.bgGrad){
    // Gradient background
    wrap.setAttribute('style',
      _WRAP_BASE +
      `box-shadow:var(--shadow);position:relative;z-index:2;` +
      `background:${apCfg.bgGrad}`
    );
    _applyCalTextWhite(true);
  } else {
    // Default white
    wrap.setAttribute('style',
      _WRAP_BASE +
      `box-shadow:var(--shadow);position:relative;z-index:2;background:white`
    );
    _applyCalTextWhite(false);
  }
}

/** Đổi màu chữ/nút trong lịch sang trắng (khi có ảnh nền) hoặc về mặc định */
function _applyCalTextWhite(white){
  const month=document.getElementById('calBigMonth');
  const dow=document.getElementById('calDow');
  const prev=document.getElementById('calNavPrev');
  const next=document.getElementById('calNavNext');
  if(!month&&!dow)return; // calendar not rendered yet, skip
  if(white){
    if(month) month.style.cssText='color:white;text-shadow:0 1px 6px rgba(0,0,0,.5)';
    if(dow) dow.querySelectorAll('span').forEach(s=>{
      s.style.color='rgba(255,255,255,.9)';s.style.textShadow='0 1px 4px rgba(0,0,0,.6)';
    });
    if(prev) prev.style.cssText='width:32px;height:32px;border-radius:50%;border:1.5px solid rgba(255,255,255,.5);background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;font-weight:700;color:white;backdrop-filter:blur(4px)';
    if(next) next.style.cssText='width:32px;height:32px;border-radius:50%;border:1.5px solid rgba(255,255,255,.5);background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;font-weight:700;color:white;backdrop-filter:blur(4px)';
    document.querySelectorAll('#calBigDays .cal-day').forEach(d=>{
      if(!d.classList.contains('today')&&!d.classList.contains('cm')&&
         !d.classList.contains('vang')&&!d.classList.contains('np')&&
         !d.classList.contains('ll')&&!d.classList.contains('empty')){
        d.style.background='rgba(255,255,255,.2)';
        d.style.color='white';
        d.style.textShadow='0 1px 3px rgba(0,0,0,.5)';
      }
    });
  } else {
    if(month) month.style.cssText='';
    if(dow) dow.querySelectorAll('span').forEach(s=>{s.style.cssText='';});
    if(prev) prev.style.cssText='';
    if(next) next.style.cssText='';
    document.querySelectorAll('#calBigDays .cal-day').forEach(d=>{
      d.style.background='';d.style.color='';d.style.textShadow='';
    });
  }
}

/** Cập nhật preview ảnh nền trong panel Giao diện */
function updateBgPreview(){
  const prev=document.getElementById('apBgPreview');
  const txt=document.getElementById('apBgPreviewTxt');
  if(!prev)return;
  if(apCfg.bgB64){
    prev.style.backgroundImage=`url(${apCfg.bgB64})`;
    prev.style.backgroundSize='cover';prev.style.backgroundPosition='center';
    if(txt)txt.style.display='none';
  }else if(apCfg.bgGrad){
    prev.style.backgroundImage='';prev.style.background=apCfg.bgGrad;
    const _gradTxt={vi:'Màu gradient',en:'Gradient color',ko:'그라데이션',ja:'グラデーション',zh:'渐变色',my:'Gradient',th:'สีไล่โทน',id:'Warna gradasi',ph:'Gradient na kulay',ne:'ग्रेडियन्ट रंग',hi:'ग्रेडिएंट रंग'}[userData.lang||'vi']||'Màu gradient';
    if(txt){txt.style.display='';txt.textContent=_gradTxt;txt.style.color='white';}
  }else{
    prev.style.backgroundImage='';prev.style.background='#F4F7F6';
    const _noBgTxt={vi:'Chưa có ảnh nền',en:'No background image',ko:'배경 이미지 없음',ja:'背景画像なし',zh:'无背景图片',my:'နောက်ခံပုံမရှိ',th:'ไม่มีภาพพื้นหลัง',id:'Tidak ada gambar latar',ph:'Walang background',ne:'पृष्ठभूमि छैन',hi:'कोई पृष्ठभूमि नहीं'}[userData.lang||'vi']||'Chưa có ảnh nền';
    if(txt){txt.style.display='';txt.textContent=_noBgTxt;txt.style.color='var(--text3)';}
  }
}

async function uploadBg(inp){
  if(!inp.files[0])return;
  const fr=new FileReader();
  fr.onload=e=>{
    apCfg.bgB64=e.target.result;apCfg.bgGrad='';
    saveAp();applyCalBg();updateBgPreview();renderGradientGrid();
  };
  fr.readAsDataURL(inp.files[0]);
}
function clearBg(){apCfg.bgB64='';apCfg.bgGrad='';saveAp();applyCalBg();updateBgPreview();renderGradientGrid();}

/* ========== CALENDAR TEXT COLORS ========== */
function onCalColorChange(){
  const sun=document.getElementById('sunColorPick')?.value||'#E8433A';
  const sat=document.getElementById('satColorPick')?.value||'#2D7DD2';
  const norm=document.getElementById('normColorPick')?.value||'#1A2332';
  const sd=document.getElementById('sunColorShow');if(sd)sd.style.background=sun;
  const satd=document.getElementById('satColorShow');if(satd)satd.style.background=sat;
  const nd=document.getElementById('normColorShow');if(nd)nd.style.background=norm;
  const she=document.getElementById('sunColorHex');if(she)she.textContent=sun;
  const sathe=document.getElementById('satColorHex');if(sathe)sathe.textContent=sat;
  const nhe=document.getElementById('normColorHex');if(nhe)nhe.textContent=norm;
  const ps=document.getElementById('previewSun');if(ps)ps.style.color=sun;
  const psat=document.getElementById('previewSat');if(psat)psat.style.color=sat;
}
function resetCalColors(){
  const sp=document.getElementById('sunColorPick');if(sp)sp.value='#E8433A';
  const satp=document.getElementById('satColorPick');if(satp)satp.value='#2D7DD2';
  const np=document.getElementById('normColorPick');if(np)np.value='#1A2332';
  onCalColorChange();
}
/** Lưu tất cả cài đặt giao diện và apply ngay */
function saveAppearance(){
  apCfg.calSun=document.getElementById('sunColorPick')?.value||'#E8433A';
  apCfg.calSat=document.getElementById('satColorPick')?.value||'#2D7DD2';
  apCfg.calNorm=document.getElementById('normColorPick')?.value||'#1A2332';
  saveAp();applyCalColors();renderCalBig();closePanel('panelAppearance');
}
/** Inject CSS động cho màu chữ ngày CN/T7/thường trong lịch */
function applyCalColors(){
  let st=document.getElementById('dynCalColors');
  if(!st){st=document.createElement('style');st.id='dynCalColors';document.head.appendChild(st);}
  const sun=apCfg.calSun||'#E8433A';
  const sat=apCfg.calSat||'#2D7DD2';
  const norm=apCfg.calNorm||'#1A2332';
  st.textContent=`
    .cal-dow .sun{color:${sun}!important}
    .cal-dow .sat{color:${sat}!important}
    .cal-day.sun:not(.today):not(.cm):not(.vang):not(.np):not(.ll):not(.le){color:${sun}!important}
    .cal-day.sat:not(.today):not(.cm):not(.vang):not(.np):not(.ll):not(.le){color:${sat}!important}
    .cal-day:not(.sun):not(.sat):not(.today):not(.cm):not(.vang):not(.np):not(.ll):not(.empty):not(.ct):not(.le){color:${norm}!important}
  `;
}
function syncAppearancePickers(){
  const sp=document.getElementById('sunColorPick');if(sp)sp.value=apCfg.calSun||'#E8433A';
  const satp=document.getElementById('satColorPick');if(satp)satp.value=apCfg.calSat||'#2D7DD2';
  const np=document.getElementById('normColorPick');if(np)np.value=apCfg.calNorm||'#1A2332';
  onCalColorChange();
}

/* ===== THÔNG BÁO ===== */
function togNotif(id){
  const el=document.getElementById(id);
  el.classList.toggle('on');
  const key=id.replace('togN','n');
  notifCfg[key]=el.classList.contains('on');
  saveNotif();
  // Re-schedule native notifications khi user thay đổi toggle
  if(typeof window.rescheduleNativeNotifications === 'function'){
    window.rescheduleNativeNotifications();
  }
  // Cập nhật UI status sau 500ms
  setTimeout(refreshBgStatus, 500);
}

/** ═══ UI HELPERS CHO BACKGROUND STATUS (chỉ hoạt động trong APK) ═══ */

/** Refresh thông tin trạng thái chạy ngầm */
async function refreshBgStatus(){
  const body = document.getElementById('bgStatusBody');
  if(!body) return;
  // Helper lấy text đa ngôn ngữ với fallback
  const _t = (key, fallback) => (typeof u === 'function') ? (u(key) || fallback) : fallback;
  if(!window.ccNative || !window.ccNative.isNative){
    const L = (window.userData && window.userData.lang) || 'vi';
    const noNative = {
      vi:'⚠️ Chỉ hoạt động trong APK Android', en:'⚠️ Only works in Android APK',
      ko:'⚠️ Android APK에서만 동작', ja:'⚠️ Android APKでのみ動作',
      zh:'⚠️ 仅在 Android APK 中可用', my:'⚠️ Android APK တွင်သာ',
      th:'⚠️ ทำงานเฉพาะ APK Android', id:'⚠️ Hanya berfungsi di APK',
      ph:'⚠️ Sa Android APK lang', ne:'⚠️ Android APK मा मात्र',
      hi:'⚠️ केवल Android APK में'
    };
    body.innerHTML = noNative[L] || noNative.vi;
    return;
  }
  try{
    const L = (window.userData && window.userData.lang) || 'vi';
    const labels = {
      vi: {plat:'📱 Platform', gps:'📍 GPS Service', bg:'🌐 Background watcher', n1:'⏰ Nhắc trước ca (n1)', n2:'🏁 Xác nhận ra ca (n2)', n4:'📊 Tổng kết tuần (n4)', total:'📅 Tổng', scheduled:'đã lên lịch', notifs:'thông báo nền', on:'✅ Đang chạy', off:'❌ Tắt', active:'✅ Active', inactive:'❌ Inactive', plugins:'🔌 Plugins'},
      en: {plat:'📱 Platform', gps:'📍 GPS Service', bg:'🌐 Background watcher', n1:'⏰ Pre-shift reminder (n1)', n2:'🏁 Post-shift confirm (n2)', n4:'📊 Weekly summary (n4)', total:'📅 Total', scheduled:'scheduled', notifs:'background notifications', on:'✅ Running', off:'❌ Off', active:'✅ Active', inactive:'❌ Inactive', plugins:'🔌 Plugins'},
      ko: {plat:'📱 플랫폼', gps:'📍 GPS 서비스', bg:'🌐 백그라운드', n1:'⏰ 출근 전 알림 (n1)', n2:'🏁 퇴근 확인 (n2)', n4:'📊 주간 요약 (n4)', total:'📅 총', scheduled:'예약됨', notifs:'백그라운드 알림', on:'✅ 동작 중', off:'❌ 꺼짐', active:'✅ 활성', inactive:'❌ 비활성', plugins:'🔌 플러그인'},
      ja: {plat:'📱 プラットフォーム', gps:'📍 GPS サービス', bg:'🌐 バックグラウンド', n1:'⏰ 始業前通知 (n1)', n2:'🏁 退勤確認 (n2)', n4:'📊 週間まとめ (n4)', total:'📅 合計', scheduled:'予定済み', notifs:'バックグラウンド通知', on:'✅ 動作中', off:'❌ オフ', active:'✅ アクティブ', inactive:'❌ 非アクティブ', plugins:'🔌 プラグイン'},
      zh: {plat:'📱 平台', gps:'📍 GPS 服务', bg:'🌐 后台监听', n1:'⏰ 上班前提醒 (n1)', n2:'🏁 下班确认 (n2)', n4:'📊 周总结 (n4)', total:'📅 共', scheduled:'已安排', notifs:'后台通知', on:'✅ 运行中', off:'❌ 关闭', active:'✅ 活跃', inactive:'❌ 未活跃', plugins:'🔌 插件'},
      th: {plat:'📱 แพลตฟอร์ม', gps:'📍 บริการ GPS', bg:'🌐 ทำงานเบื้องหลัง', n1:'⏰ เตือนก่อนเข้างาน', n2:'🏁 ยืนยันออกงาน', n4:'📊 สรุปสัปดาห์', total:'📅 รวม', scheduled:'นัดไว้แล้ว', notifs:'การแจ้งเตือนเบื้องหลัง', on:'✅ ทำงาน', off:'❌ ปิด', active:'✅ ใช้งาน', inactive:'❌ ไม่ใช้งาน', plugins:'🔌 ปลั๊กอิน'},
      id: {plat:'📱 Platform', gps:'📍 Layanan GPS', bg:'🌐 Background', n1:'⏰ Pengingat sebelum shift', n2:'🏁 Konfirmasi keluar', n4:'📊 Ringkasan mingguan', total:'📅 Total', scheduled:'dijadwalkan', notifs:'notifikasi latar', on:'✅ Berjalan', off:'❌ Mati', active:'✅ Aktif', inactive:'❌ Tidak aktif', plugins:'🔌 Plugin'},
      my: {plat:'📱 ပလက်ဖောင်း', gps:'📍 GPS ဝန်ဆောင်မှု', bg:'🌐 နောက်ခံ', n1:'⏰ ဆင်းမတိုင်မီ သတိပေးချက်', n2:'🏁 ဆင်းပြီး အတည်ပြု', n4:'📊 အပတ်စဉ် အကျဉ်း', total:'📅 စုစုပေါင်း', scheduled:'စီစဉ်ထား', notifs:'အသိပေးချက်', on:'✅ အလုပ်လုပ်', off:'❌ ပိတ်', active:'✅ အသုံးပြု', inactive:'❌ မအသုံးပြု', plugins:'🔌 Plugin'},
      ph: {plat:'📱 Platform', gps:'📍 GPS Service', bg:'🌐 Background', n1:'⏰ Paalala bago shift', n2:'🏁 Kumpirma paglabas', n4:'📊 Lingguhang buod', total:'📅 Kabuuan', scheduled:'naka-iskedyul', notifs:'mga abiso', on:'✅ Tumatakbo', off:'❌ Off', active:'✅ Aktibo', inactive:'❌ Hindi aktibo', plugins:'🔌 Plugins'},
      ne: {plat:'📱 प्लेटफर्म', gps:'📍 GPS सेवा', bg:'🌐 पृष्ठभूमि', n1:'⏰ शिफ्ट अघि सम्झना', n2:'🏁 बाहिर पुष्टि', n4:'📊 साप्ताहिक सार', total:'📅 जम्मा', scheduled:'तालिका गरिएको', notifs:'सूचनाहरू', on:'✅ चलिरहेको', off:'❌ बन्द', active:'✅ सक्रिय', inactive:'❌ निष्क्रिय', plugins:'🔌 प्लगइन'},
      hi: {plat:'📱 प्लेटफ़ॉर्म', gps:'📍 GPS सेवा', bg:'🌐 बैकग्राउंड', n1:'⏰ शिफ्ट से पहले रिमाइंडर', n2:'🏁 बाहर पुष्टि', n4:'📊 साप्ताहिक सारांश', total:'📅 कुल', scheduled:'निर्धारित', notifs:'बैकग्राउंड नोटिफिकेशन', on:'✅ चालू', off:'❌ बंद', active:'✅ सक्रिय', inactive:'❌ निष्क्रिय', plugins:'🔌 प्लगइन'}
    };
    const lbl = labels[L] || labels.vi;
    const pending = await window.ccNative.getPending();
    const n1 = pending.filter(n => n.id >= 10000 && n.id <= 19999).length;
    const n2 = pending.filter(n => n.id >= 20000 && n.id <= 29999).length;
    const n4 = pending.filter(n => n.id >= 40000 && n.id <= 49999).length;
    const gpsOn = (window._gpsData && window._gpsData.enabled) ? lbl.on : lbl.off;
    const bgWatch = (window._gpsBgWatchId != null) ? lbl.active : lbl.inactive;
    const platform = window.ccNative.platform || 'unknown';
    // Plugin status - hiển thị plugin nào có sẵn
    const pluginsInfo = window.ccNative.plugins || {};
    const pluginStatus = [
      `BG=${pluginsInfo.BG ? '✅' : '❌'}`,
      `Geo=${pluginsInfo.Geo ? '✅' : '❌'}`,
      `Notif=${pluginsInfo.Notif ? '✅' : '❌'}`,
      `App=${pluginsInfo.App ? '✅' : '❌'}`
    ].join(' ');

    let extraWarning = '';
    if(!pluginsInfo.BG){
      const warningMsg = {
        vi:'⚠️ Plugin BackgroundGeolocation CHƯA cài → cần npm install + npx cap sync',
        en:'⚠️ BackgroundGeolocation plugin NOT installed',
        ko:'⚠️ BackgroundGeolocation 플러그인 설치 안됨',
        ja:'⚠️ BackgroundGeolocation プラグイン未インストール',
        zh:'⚠️ BackgroundGeolocation 插件未安装',
        hi:'⚠️ BackgroundGeolocation प्लगइन इंस्टॉल नहीं है'
      };
      extraWarning = `<br><span style="color:#E8433A">${warningMsg[L] || warningMsg.vi}</span>`;
    } else if(window._gpsData && window._gpsData.enabled && window._gpsBgWatchId == null){
      const warningMsg = {
        vi:'⚠️ Plugin OK nhưng watcher chưa active → bấm "🚀 Bật chạy ngầm" bên dưới',
        en:'⚠️ Plugin OK but watcher not active → press "🚀 Start background"',
        ko:'⚠️ 플러그인 OK이지만 watcher 비활성 → "🚀 백그라운드 시작" 누르기',
        ja:'⚠️ プラグインOKだがwatcher非アクティブ → 「🚀 バックグラウンド開始」を押す',
        zh:'⚠️ 插件OK但watcher未激活 → 按"🚀 开始后台"',
        hi:'⚠️ प्लगइन OK लेकिन watcher निष्क्रिय → "🚀 बैकग्राउंड चालू" दबाएं'
      };
      extraWarning = `<br><span style="color:#F5A623">${warningMsg[L] || warningMsg.vi}</span>`;
    }

    body.innerHTML =
      `${lbl.plat}: <b>${platform}</b><br>` +
      `${lbl.plugins}: <b>${pluginStatus}</b><br>` +
      `${lbl.gps}: <b>${gpsOn}</b><br>` +
      `${lbl.bg}: <b>${bgWatch}</b>` +
      (window._gpsBgWatchId ? ` (id=${window._gpsBgWatchId})` : '') +
      `<br>` +
      `${lbl.n1}: <b>${n1}</b> ${lbl.scheduled}<br>` +
      `${lbl.n2}: <b>${n2}</b> ${lbl.scheduled}<br>` +
      `${lbl.n4}: <b>${n4}</b> ${lbl.scheduled}<br>` +
      `<b>${lbl.total}: ${pending.length} ${lbl.notifs}</b>` +
      extraWarning;
  }catch(e){
    body.textContent = bgForceText('error', {err:e.message || e});
  }
}

function bgForceText(key, vars){
  const L = (window.userData && window.userData.lang) || 'vi';
  const packs = {
    vi:{apkOnly:'⚠️ Chỉ hoạt động trong APK',pluginMissing:'❌ Plugin BackgroundGeolocation CHƯA được cài trong APK!\n\nCần rebuild APK với:\n  npm install\n  npx cap sync android\n  ./gradlew assembleDebug',gpsFirst:'⚠️ Hãy bật GPS toggle trước',starting:'🚀 Đang khởi động background watcher...',started:'✅ Đã bật chạy ngầm thành công!',failed:'❌ Vẫn chưa bật được. Kiểm tra quyền vị trí "Luôn cho phép" trong Cài đặt.',error:'❌ Lỗi: {err}'},
    en:{apkOnly:'⚠️ APK only',pluginMissing:'❌ BackgroundGeolocation plugin is not installed!\n\nRebuild the APK with:\n  npm install\n  npx cap sync android',gpsFirst:'⚠️ Enable the GPS toggle first',starting:'🚀 Starting background watcher...',started:'✅ Background watcher started!',failed:'❌ Failed. Check Location permission "Allow all the time".',error:'❌ Error: {err}'},
    ko:{apkOnly:'⚠️ APK 전용',pluginMissing:'❌ BackgroundGeolocation 플러그인이 설치되지 않았습니다!\n\nAPK를 다시 빌드하세요.',gpsFirst:'⚠️ 먼저 GPS 토글을 켜세요',starting:'🚀 백그라운드 감시를 시작하는 중...',started:'✅ 백그라운드 감시가 시작되었습니다!',failed:'❌ 실패했습니다. 위치 권한 "항상 허용"을 확인하세요.',error:'❌ 오류: {err}'},
    ja:{apkOnly:'⚠️ APKのみ',pluginMissing:'❌ BackgroundGeolocationプラグインがインストールされていません。\n\nAPKを再ビルドしてください。',gpsFirst:'⚠️ 先にGPSトグルを有効にしてください',starting:'🚀 バックグラウンド監視を開始中...',started:'✅ バックグラウンド監視を開始しました!',failed:'❌ 失敗しました。位置情報権限「常に許可」を確認してください。',error:'❌ エラー: {err}'},
    zh:{apkOnly:'⚠️ 仅APK可用',pluginMissing:'❌ 尚未安装 BackgroundGeolocation 插件！\n\n请重新构建 APK。',gpsFirst:'⚠️ 请先开启 GPS 开关',starting:'🚀 正在启动后台监听...',started:'✅ 后台监听已启动！',failed:'❌ 启动失败。请检查位置权限“始终允许”。',error:'❌ 错误: {err}'},
    my:{apkOnly:'⚠️ APK တွင်သာ အသုံးပြုနိုင်သည်',pluginMissing:'❌ BackgroundGeolocation plugin မထည့်ရသေးပါ။\n\nAPK ကို ပြန် build လုပ်ပါ။',gpsFirst:'⚠️ GPS toggle ကို အရင်ဖွင့်ပါ',starting:'🚀 နောက်ခံ watcher စတင်နေသည်...',started:'✅ နောက်ခံ watcher စတင်ပြီး!',failed:'❌ မစတင်နိုင်သေးပါ။ Location permission “Allow all the time” ကို စစ်ဆေးပါ။',error:'❌ အမှား: {err}'},
    th:{apkOnly:'⚠️ ใช้ได้เฉพาะ APK',pluginMissing:'❌ ยังไม่ได้ติดตั้งปลั๊กอิน BackgroundGeolocation!\n\nโปรด rebuild APK',gpsFirst:'⚠️ เปิดสวิตช์ GPS ก่อน',starting:'🚀 กำลังเริ่ม background watcher...',started:'✅ เริ่ม background watcher แล้ว!',failed:'❌ ไม่สำเร็จ ตรวจสอบสิทธิ์ตำแหน่ง "อนุญาตตลอดเวลา"',error:'❌ ข้อผิดพลาด: {err}'},
    id:{apkOnly:'⚠️ Hanya untuk APK',pluginMissing:'❌ Plugin BackgroundGeolocation belum terpasang!\n\nRebuild APK terlebih dahulu.',gpsFirst:'⚠️ Aktifkan toggle GPS dulu',starting:'🚀 Memulai background watcher...',started:'✅ Background watcher dimulai!',failed:'❌ Gagal. Periksa izin Lokasi "Izinkan sepanjang waktu".',error:'❌ Error: {err}'},
    ph:{apkOnly:'⚠️ APK lang',pluginMissing:'❌ Hindi naka-install ang BackgroundGeolocation plugin!\n\nI-rebuild ang APK.',gpsFirst:'⚠️ I-on muna ang GPS toggle',starting:'🚀 Sinisimulan ang background watcher...',started:'✅ Nagsimula na ang background watcher!',failed:'❌ Nabigo. Suriin ang Location permission na "Allow all the time".',error:'❌ Error: {err}'},
    ne:{apkOnly:'⚠️ APK मा मात्र',pluginMissing:'❌ BackgroundGeolocation plugin install भएको छैन!\n\nAPK फेरि build गर्नुहोस्।',gpsFirst:'⚠️ पहिले GPS toggle खोल्नुहोस्',starting:'🚀 background watcher सुरु हुँदै...',started:'✅ background watcher सुरु भयो!',failed:'❌ असफल भयो। Location permission "Allow all the time" जाँच्नुहोस्।',error:'❌ त्रुटि: {err}'},
    hi:{apkOnly:'⚠️ केवल APK',pluginMissing:'❌ BackgroundGeolocation plugin इंस्टॉल नहीं है!\n\nAPK फिर से build करें।',gpsFirst:'⚠️ पहले GPS toggle चालू करें',starting:'🚀 background watcher शुरू हो रहा है...',started:'✅ background watcher शुरू हो गया!',failed:'❌ विफल। Location permission "Allow all the time" जांचें।',error:'❌ त्रुटि: {err}'}
  };
  const pack = packs[L] || packs.en || packs.vi;
  let out = pack[key] || key;
  vars = vars || {};
  Object.keys(vars).forEach(k => { out = out.replace(new RegExp('\\{'+k+'\\}', 'g'), vars[k]); });
  return out;
}

/** Force start background watcher (gọi từ nút "🚀 Bật chạy ngầm") */
async function forceStartBgWatcher(){
  const L = (window.userData && window.userData.lang) || 'vi';
  if(!window.ccNative || !window.ccNative.isNative){
    alert(bgForceText('apkOnly'));
    return;
  }
  if(!window.ccNative.startBg && !window.startBackgroundGps){
    alert(bgForceText('pluginMissing'));
    return;
  }
  if(!window._gpsData || !window._gpsData.enabled){
    alert(bgForceText('gpsFirst'));
    return;
  }

  // Force start
  const banner = (msg, color) => {
    if(typeof showGpsBanner === 'function') showGpsBanner(msg, color);
  };

  banner(bgForceText('starting'), '#2D7DD2');
  console.log('[ForceBg] Starting background watcher manually');

  try{
    if(window.ccNative.startBg){
      const result = await window.ccNative.startBg();
      console.log('[ForceBg] startBg result:', result);
    } else if(window.startBackgroundGps){
      const result = window.startBackgroundGps();
      console.log('[ForceBg] startBackgroundGps result:', result);
    }
    // Đợi 1.5s để watcher init xong
    setTimeout(() => {
      refreshBgStatus();
      if(window._gpsBgWatchId){
        banner(bgForceText('started'), '#0D9E75');
      } else {
        banner(bgForceText('failed'), '#E8433A');
      }
    }, 1500);
  }catch(e){
    console.warn('[ForceBg] Error:', e);
    banner(bgForceText('error', {err:e.message || e}), '#E8433A');
  }
}

/** Manual reschedule (gọi từ nút "Lên lịch lại tất cả") */
function manualRescheduleNotifs(){
  if(!window.ccNative || !window.ccNative.isNative){
    alert(bgForceText('apkOnly'));
    return;
  }
  if(typeof window.rescheduleNativeNotifications === 'function'){
    window.rescheduleNativeNotifications();
    setTimeout(refreshBgStatus, 800);
  }
}

/** Mở nhanh trang quyền hệ thống: thông báo / vị trí / pin */
var _batteryPermissionReturnHandler = null;
var _batteryPermissionCheckTimer = null;

function permEscHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
  });
}

function getBatteryGuideText(){
  const L = (window.userData && window.userData.lang) || 'vi';
  const txt = {
    vi:{title:'Chưa bật quyền pin cho Chấm Công Pro',body:'Để GPS và chấm công ngầm ổn định, hãy đặt pin của ứng dụng sang Không hạn chế.',steps:['Mở Cài đặt > Ứng dụng > Chấm Công Pro.','Vào Pin hoặc Sử dụng pin.','Chọn Không hạn chế / Unrestricted. Nếu thấy mục Ngủ hoặc Ngủ sâu, hãy bỏ Chấm Công Pro khỏi danh sách đó.'],reopen:'Mở lại cài đặt pin',close:'Đã hiểu',granted:'Đã bật quyền pin. GPS chạy ngầm sẽ ổn định hơn.',denied:'Chưa bật quyền pin. Hãy chọn Không hạn chế trong phần Pin của ứng dụng.',openFail:'Không mở được trang pin tự động. Hãy mở thủ công theo hướng dẫn.'},
    en:{title:'Battery permission is not enabled',body:'For reliable background GPS and auto attendance, set this app battery mode to Unrestricted.',steps:['Open Settings > Apps > Cham Cong Pro.','Open Battery or Battery usage.','Choose Unrestricted. If the app is in Sleeping or Deep sleeping apps, remove it from that list.'],reopen:'Open battery settings',close:'Got it',granted:'Battery permission is enabled. Background GPS should be more reliable.',denied:'Battery permission is still off. Choose Unrestricted in the app battery page.',openFail:'Could not open battery settings automatically. Please follow the steps.'},
    ko:{title:'배터리 권한이 켜져 있지 않습니다',body:'백그라운드 GPS와 자동 출퇴근 기록을 안정적으로 사용하려면 배터리를 제한 없음으로 설정하세요.',steps:['설정 > 애플리케이션 > Cham Cong Pro를 여세요.','배터리 또는 배터리 사용량을 여세요.','제한 없음을 선택하세요. 절전/초절전 앱 목록에 있으면 제거하세요.'],reopen:'배터리 설정 열기',close:'확인',granted:'배터리 권한이 켜졌습니다.',denied:'배터리 권한이 아직 꺼져 있습니다. 제한 없음을 선택하세요.',openFail:'배터리 설정을 자동으로 열 수 없습니다. 안내대로 직접 열어 주세요.'},
    ja:{title:'バッテリー権限が有効ではありません',body:'バックグラウンドGPSと自動打刻を安定させるには、バッテリー設定を無制限にしてください。',steps:['設定 > アプリ > Cham Cong Pro を開きます。','バッテリーまたはバッテリー使用量を開きます。','無制限を選びます。スリープ中のアプリ一覧にある場合は削除してください。'],reopen:'バッテリー設定を開く',close:'了解',granted:'バッテリー権限が有効になりました。',denied:'まだ有効ではありません。アプリのバッテリーで無制限を選んでください。',openFail:'バッテリー設定を自動で開けません。手順に沿って開いてください。'},
    zh:{title:'尚未开启电池权限',body:'为保证后台 GPS 和自动打卡稳定，请将应用电池设置为不受限制。',steps:['打开 设置 > 应用 > Cham Cong Pro。','进入 电池 或 电池使用情况。','选择 不受限制。若在睡眠/深度睡眠应用中，请移除。'],reopen:'打开电池设置',close:'知道了',granted:'电池权限已开启，后台 GPS 会更稳定。',denied:'电池权限仍未开启，请选择不受限制。',openFail:'无法自动打开电池设置，请按步骤手动打开。'},
    my:{title:'Battery permission မဖွင့်ရသေးပါ',body:'နောက်ခံ GPS နှင့် auto attendance တည်ငြိမ်ရန် app battery ကို Unrestricted သို့ ပြောင်းပါ။',steps:['Settings > Apps > Cham Cong Pro ကို ဖွင့်ပါ။','Battery သို့မဟုတ် Battery usage ကို ဖွင့်ပါ။','Unrestricted ကို ရွေးပါ။ Sleeping/Deep sleeping apps ထဲရှိပါက ဖယ်ရှားပါ။'],reopen:'Battery settings ဖွင့်ရန်',close:'နားလည်ပါပြီ',granted:'Battery permission ဖွင့်ပြီးပါပြီ။',denied:'Battery permission မဖွင့်ရသေးပါ။ Unrestricted ကို ရွေးပါ။',openFail:'Battery settings ကို အလိုအလျောက် မဖွင့်နိုင်ပါ။ လမ်းညွှန်အတိုင်း ဖွင့်ပါ။'},
    th:{title:'ยังไม่ได้เปิดสิทธิ์แบตเตอรี่',body:'เพื่อให้ GPS เบื้องหลังและการลงเวลาอัตโนมัติเสถียร ให้ตั้งค่าแบตเตอรี่เป็นไม่จำกัด',steps:['เปิด ตั้งค่า > แอป > Cham Cong Pro','เข้า แบตเตอรี่ หรือ การใช้แบตเตอรี่','เลือก ไม่จำกัด หากอยู่ในรายการแอปพัก/หลับลึก ให้เอาออก'],reopen:'เปิดตั้งค่าแบตเตอรี่',close:'เข้าใจแล้ว',granted:'เปิดสิทธิ์แบตเตอรี่แล้ว',denied:'ยังไม่ได้เปิดสิทธิ์แบตเตอรี่ กรุณาเลือกไม่จำกัด',openFail:'เปิดหน้าแบตเตอรี่อัตโนมัติไม่ได้ กรุณาทำตามขั้นตอน'},
    id:{title:'Izin baterai belum aktif',body:'Agar GPS latar belakang dan absensi otomatis stabil, atur baterai aplikasi ke Tidak dibatasi.',steps:['Buka Setelan > Aplikasi > Cham Cong Pro.','Buka Baterai atau Penggunaan baterai.','Pilih Tidak dibatasi. Jika ada di aplikasi tidur/tidur nyenyak, hapus dari daftar itu.'],reopen:'Buka setelan baterai',close:'Mengerti',granted:'Izin baterai sudah aktif.',denied:'Izin baterai belum aktif. Pilih Tidak dibatasi.',openFail:'Setelan baterai tidak bisa dibuka otomatis. Ikuti langkah manual.'},
    ph:{title:'Hindi pa naka-on ang battery permission',body:'Para maging maayos ang background GPS at auto attendance, gawing Unrestricted ang battery ng app.',steps:['Buksan ang Settings > Apps > Cham Cong Pro.','Buksan ang Battery o Battery usage.','Piliin ang Unrestricted. Kung nasa Sleeping/Deep sleeping apps, alisin ito doon.'],reopen:'Buksan battery settings',close:'Nakuha ko',granted:'Naka-on na ang battery permission.',denied:'Hindi pa naka-on. Piliin ang Unrestricted sa battery page.',openFail:'Hindi mabuksan nang automatic ang battery settings. Sundin ang steps.'},
    ne:{title:'ब्याट्री अनुमति खुलेको छैन',body:'Background GPS र auto attendance स्थिर बनाउन app battery लाई Unrestricted राख्नुहोस्।',steps:['Settings > Apps > Cham Cong Pro खोल्नुहोस्।','Battery वा Battery usage खोल्नुहोस्।','Unrestricted छान्नुहोस्। Sleeping/Deep sleeping apps मा भए हटाउनुहोस्।'],reopen:'Battery settings खोल्नुहोस्',close:'बुझेँ',granted:'Battery permission खुलेको छ।',denied:'Battery permission अझै खुलेको छैन। Unrestricted छान्नुहोस्।',openFail:'Battery settings आफैं खुल्न सकेन। यी चरण पालना गर्नुहोस्।'},
    hi:{title:'बैटरी अनुमति चालू नहीं है',body:'Background GPS और auto attendance स्थिर रखने के लिए app battery को Unrestricted करें।',steps:['Settings > Apps > Cham Cong Pro खोलें।','Battery या Battery usage खोलें।','Unrestricted चुनें। Sleeping/Deep sleeping apps में हो तो हटाएं।'],reopen:'Battery settings खोलें',close:'समझ गया',granted:'Battery permission चालू हो गई है।',denied:'Battery permission अभी भी बंद है। Unrestricted चुनें।',openFail:'Battery settings अपने आप नहीं खुली। कृपया चरणों का पालन करें।'}
  };
  return txt[L] || txt.en || txt.vi;
}

function showBatteryPermissionGuide(openFail){
  const t = getBatteryGuideText();
  let ov = document.getElementById('batteryGuideOv');
  if(ov)ov.remove();
  ov = document.createElement('div');
  ov.id = 'batteryGuideOv';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:30000;display:flex;align-items:center;justify-content:center;padding:18px';
  ov.innerHTML = '<div style="width:100%;max-width:380px;background:white;border-radius:20px;padding:22px 18px;box-shadow:0 20px 70px rgba(0,0,0,.32);font-family:Nunito,sans-serif;color:var(--text)"><div style="font-size:18px;font-weight:900;margin-bottom:8px">'+permEscHtml(t.title)+'</div><div style="font-size:13px;color:var(--text2);line-height:1.55;margin-bottom:12px">'+permEscHtml(openFail?t.openFail:t.body)+'</div><div style="display:flex;flex-direction:column;gap:8px;margin:12px 0 16px">'+t.steps.map(function(s,i){return '<div style="background:#F4F7F6;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.45"><b>'+(i+1)+'.</b> '+permEscHtml(s)+'</div>';}).join('')+'</div><div style="display:flex;gap:10px"><button id="batteryGuideClose" style="flex:1;padding:13px;border-radius:12px;border:1.5px solid var(--border);background:white;color:var(--text2);font-size:13px;font-weight:800;font-family:Nunito,sans-serif">'+permEscHtml(t.close)+'</button><button id="batteryGuideOpen" style="flex:1.5;padding:13px;border-radius:12px;border:none;background:var(--ac);color:white;font-size:13px;font-weight:900;font-family:Nunito,sans-serif">'+permEscHtml(t.reopen)+'</button></div></div>';
  document.body.appendChild(ov);
  document.getElementById('batteryGuideClose').onclick = function(){ ov.remove(); };
  document.getElementById('batteryGuideOpen').onclick = function(){ ov.remove(); openNativePermissionSetting('battery'); };
}

async function checkBatteryOptimizationState(){
  try{
    if(window.ccNative && window.ccNative.checkBatteryOptimization)return await window.ccNative.checkBatteryOptimization();
    const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ChamCongNative;
    if(plugin && plugin.checkBatteryOptimizationPermission)return await plugin.checkBatteryOptimizationPermission();
  }catch(e){ console.warn('[BatteryPermission] check failed:', e); }
  return { granted:false, missingBridge:true };
}

async function finishBatteryPermissionCheck(openFail){
  clearTimeout(_batteryPermissionCheckTimer);
  if(_batteryPermissionReturnHandler){
    window.removeEventListener('focus', _batteryPermissionReturnHandler);
    document.removeEventListener('visibilitychange', _batteryPermissionReturnHandler);
    _batteryPermissionReturnHandler = null;
  }
  const t = getBatteryGuideText();
  const status = await checkBatteryOptimizationState();
  const granted = !!(status && (status.granted || status.ignoringBatteryOptimizations));
  if(granted){
    if(typeof showGpsBanner === 'function')showGpsBanner(t.granted, '#0D9E75');
  }else{
    if(typeof showGpsBanner === 'function')showGpsBanner(t.denied, '#E8433A');
    showBatteryPermissionGuide(openFail);
  }
}

function scheduleBatteryPermissionCheck(openResult){
  const granted = !!(openResult && (openResult.granted || openResult.ignoringBatteryOptimizations));
  const opened = !!(openResult && openResult.openedSettings);
  if(granted){
    const t = getBatteryGuideText();
    if(typeof showGpsBanner === 'function')showGpsBanner(t.granted, '#0D9E75');
    return;
  }
  if(!opened){ finishBatteryPermissionCheck(true); return; }
  _batteryPermissionReturnHandler = function(){
    if(document.visibilityState && document.visibilityState !== 'visible')return;
    setTimeout(function(){ finishBatteryPermissionCheck(false); }, 650);
  };
  window.addEventListener('focus', _batteryPermissionReturnHandler);
  document.addEventListener('visibilitychange', _batteryPermissionReturnHandler);
  clearTimeout(_batteryPermissionCheckTimer);
  _batteryPermissionCheckTimer = setTimeout(function(){
    if(!document.visibilityState || document.visibilityState === 'visible')finishBatteryPermissionCheck(false);
  }, 3500);
}

async function openNativePermissionSetting(kind){
  const L = (window.userData && window.userData.lang) || 'vi';
  const onlyApk = {
    vi:'⚠️ Chỉ hoạt động trong APK Android',
    en:'⚠️ Only works in the Android APK',
    ko:'⚠️ Android APK에서만 작동합니다',
    ja:'⚠️ Android APKでのみ動作します',
    zh:'⚠️ 仅在 Android APK 中可用',
    my:'⚠️ Android APK တွင်သာ အလုပ်လုပ်သည်',
    th:'⚠️ ใช้งานได้เฉพาะใน Android APK',
    id:'⚠️ Hanya berfungsi di APK Android',
    ph:'⚠️ Sa Android APK lang',
    ne:'⚠️ Android APK मा मात्र काम गर्छ',
    hi:'⚠️ केवल Android APK में काम करता है'
  };
  const openFailNative = {
    vi:'⚠️ Không mở được cài đặt: ',
    en:'⚠️ Could not open settings: ',
    ko:'⚠️ 설정을 열 수 없습니다: ',
    ja:'⚠️ 設定を開けません: ',
    zh:'⚠️ 无法打开设置: ',
    my:'⚠️ ဆက်တင်များကို မဖွင့်နိုင်ပါ: ',
    th:'⚠️ เปิดการตั้งค่าไม่ได้: ',
    id:'⚠️ Tidak dapat membuka setelan: ',
    ph:'⚠️ Hindi mabuksan ang settings: ',
    ne:'⚠️ सेटिङ खोल्न सकिएन: ',
    hi:'⚠️ सेटिंग नहीं खुली: '
  };
  if(!window.ccNative || !window.ccNative.isNative){
    alert(onlyApk[L] || onlyApk.vi);
    return;
  }

  try{
    if(kind === 'notification' && window.ccNative.openNotificationSettings){
      await window.ccNative.openNotificationSettings();
    } else if(kind === 'location' && window.ccNative.openLocationSettings){
      await window.ccNative.openLocationSettings();
    } else if(kind === 'battery' && window.ccNative.requestIgnoreBatteryOptimization){
      scheduleBatteryPermissionCheck(await window.ccNative.requestIgnoreBatteryOptimization());
      return;
    } else {
      const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ChamCongNative;
      if(kind === 'notification' && plugin && plugin.openNotificationSettings) await plugin.openNotificationSettings();
      else if(kind === 'location' && plugin && plugin.openLocationSettings) await plugin.openLocationSettings();
      else if(kind === 'battery' && plugin && plugin.requestIgnoreBatteryOptimization){
        scheduleBatteryPermissionCheck(await plugin.requestIgnoreBatteryOptimization());
        return;
      }
      else throw new Error('Native settings bridge unavailable');
    }
  }catch(e){
    console.warn('[PermissionSettings] open failed:', kind, e);
    if(kind === 'battery'){
      showBatteryPermissionGuide(true);
      return;
    }
    alert((openFailNative[L] || openFailNative.en || openFailNative.vi) + (e && e.message ? e.message : e));
  }
}

/* ===== GPS TỰ ĐỘNG CHẤM CÔNG (Capacitor Native) =====
   Dùng Capacitor.Plugins.Geolocation thay navigator.geolocation
   → Yêu cầu build APK qua Capacitor + Android Studio
   ===== */

// GPS globals → declared in app.js to avoid TDZ when files are merged
// _gpsData, _gpsInterval, _gpsWasInside, _gpsPollMs, timers

/** Đọc cài đặt GPS từ localStorage */
function loadGpsData(){
  const g = lsGet('cp22_gps');
  if(g) _gpsData = Object.assign(_gpsData, g);
  _gpsData.tightCompanyGps = !!_gpsData.tightCompanyGps;
  _gpsData.smartAttendanceMode = _gpsData.enabled ? true : !!_gpsData.smartAttendanceMode;
  _gpsData.insideScheduleOut = false;
  if(typeof gpsApplyDefaultRadiusMigration === 'function') gpsApplyDefaultRadiusMigration();
  if(typeof gpsRepairLocationPersistence === 'function'){
    gpsRepairLocationPersistence();
    lsSet('cp22_gps', _gpsData);
  }
}

function gpsNum(value){
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function gpsValidPair(lat, lng){
  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function gpsHasLocation(loc){
  if(!loc) return false;
  return gpsValidPair(gpsNum(loc.lat), gpsNum(loc.lng));
}

function gpsJobKey(jobKey){
  return jobKey === 'sub' ? 'sub' : 'main';
}

function gpsLocationRadius(radius){
  const r = Number(radius);
  return Number.isFinite(r) && r > 0 ? Math.round(r) : ((_gpsData && Number(_gpsData.radius) > 0) ? Math.round(Number(_gpsData.radius)) : 15);
}

function gpsTightCompanyEnabled(){
  return !!(_gpsData && _gpsData.tightCompanyGps);
}

function gpsActiveRadius(radius){
  return gpsTightCompanyEnabled() ? 15 : gpsLocationRadius(radius);
}

function gpsApplyDefaultRadiusMigration(){
  if(!_gpsData || _gpsData.radiusDefault15) return;
  const oldDefaults = [100, 75];
  const nextDefault = 15;
  const rootRadius = Number(_gpsData.radius);
  if(!Number.isFinite(rootRadius) || oldDefaults.includes(rootRadius)) _gpsData.radius = nextDefault;
  if(_gpsData.locations && typeof _gpsData.locations === 'object'){
    ['main','sub'].forEach(job => {
      const loc = _gpsData.locations[job];
      if(!loc) return;
      const locRadius = Number(loc.radius);
      if(!Number.isFinite(locRadius) || oldDefaults.includes(locRadius)) loc.radius = nextDefault;
    });
  }
  _gpsData.radiusDefault15 = true;
}

function gpsEnsureLocationStore(){
  if(typeof _gpsData === 'undefined' || !_gpsData) return null;
  const radius = gpsLocationRadius(_gpsData.radius);
  if(!_gpsData.locations || typeof _gpsData.locations !== 'object') _gpsData.locations = {};
  if(!_gpsData.locations.main) _gpsData.locations.main = {lat:null, lng:null, radius};
  if(!_gpsData.locations.sub) _gpsData.locations.sub = {lat:null, lng:null, radius};
  _gpsData.activeJob = gpsJobKey(_gpsData.activeJob);
  return _gpsData.locations;
}

function gpsGetStoredCompanyLocation(jobKey){
  const locations = gpsEnsureLocationStore();
  if(!locations) return null;
  const job = gpsJobKey(jobKey || _gpsData.activeJob);
  const preferred = locations[job];
  if(gpsHasLocation(preferred)){
    return {
      lat: gpsNum(preferred.lat),
      lng: gpsNum(preferred.lng),
      radius: gpsLocationRadius(preferred.radius)
    };
  }
  if(gpsHasLocation(locations.main)){
    return {
      lat: gpsNum(locations.main.lat),
      lng: gpsNum(locations.main.lng),
      radius: gpsLocationRadius(locations.main.radius)
    };
  }
  const lat = gpsNum(_gpsData.lat);
  const lng = gpsNum(_gpsData.lng);
  if(gpsValidPair(lat, lng)) return {lat, lng, radius: gpsLocationRadius(_gpsData.radius)};
  return null;
}

function gpsRepairLocationPersistence(){
  const locations = gpsEnsureLocationStore();
  if(!locations) return;
  const rootLat = gpsNum(_gpsData.lat);
  const rootLng = gpsNum(_gpsData.lng);
  if(gpsValidPair(rootLat, rootLng) && !gpsHasLocation(locations.main)){
    locations.main = {lat:rootLat, lng:rootLng, radius:gpsLocationRadius(_gpsData.radius)};
  }
  const loc = gpsGetStoredCompanyLocation(_gpsData.activeJob);
  if(loc){
    _gpsData.lat = loc.lat;
    _gpsData.lng = loc.lng;
    _gpsData.radius = loc.radius;
  }
}

function gpsPersistCompanyLocation(lat, lng, radius, jobKey){
  const nLat = gpsNum(lat);
  const nLng = gpsNum(lng);
  if(!gpsValidPair(nLat, nLng)) return false;
  const locations = gpsEnsureLocationStore();
  if(!locations) return false;
  const job = gpsJobKey(jobKey || _gpsData.activeJob);
  const loc = {lat:nLat, lng:nLng, radius:gpsLocationRadius(radius)};
  locations[job] = loc;
  if(job === 'main' || !gpsHasLocation(locations.main)){
    locations.main = Object.assign({}, loc);
  }
  if(gpsJobKey(_gpsData.activeJob) === job){
    _gpsData.lat = loc.lat;
    _gpsData.lng = loc.lng;
    _gpsData.radius = loc.radius;
  }
  try{ _gpsWasInside = null; }catch(e){}
  try{
    if(typeof saSyncWorkGpsFromLegacy === 'function') saSyncWorkGpsFromLegacy();
    if(window._sa && typeof saSave === 'function') saSave();
  }catch(e){}
  return true;
}

window.gpsGetStoredCompanyLocation = gpsGetStoredCompanyLocation;

function gpsTimeToMinutes(value, fallback){
  const s = String(value || '');
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return fallback;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if(!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return fallback;
  return h * 60 + min;
}

function gpsCurrentShiftSchedule(){
  const shifts = (userData && Array.isArray(userData.shiftTimes) && userData.shiftTimes.length) ? userData.shiftTimes : [{in:'08:00', out:'17:00'}];
  // Dùng getEffectiveCurrentShift (xét rotation pattern nếu user bật) thay vì
  // userData.currentShift trực tiếp. Hàm này được expose bởi app.js; fallback
  // về userData.currentShift khi app.js chưa load (vd: native preview).
  const curShift = (typeof window.getEffectiveCurrentShift === 'function')
    ? window.getEffectiveCurrentShift()
    : ((userData && Number(userData.currentShift)) || 1);
  const idx = Math.max(0, Math.min(shifts.length - 1, curShift - 1));
  const shift = shifts[idx] || shifts[0] || {};
  const inTime = shift.in || '08:00';
  const outTime = shift.out || '17:00';
  return {
    in: inTime,
    out: outTime,
    inMin: gpsTimeToMinutes(inTime, 8 * 60),
    outMin: gpsTimeToMinutes(outTime, 17 * 60)
  };
}

function gpsNativeConfigFromData(){
  const loc = gpsGetStoredCompanyLocation(_gpsData.activeJob || 'main');
  const sa = window._sa || {};
  const saHome = sa.home || {};
  const saWork = sa.work || {};
  const shift = gpsCurrentShiftSchedule();
  const smartAttendanceMode = !!(_gpsData.enabled || _gpsData.smartAttendanceMode || sa.enabled);
  const smartJson = (value, fallback) => {
    try{ return JSON.stringify(value == null ? fallback : value); }
    catch(e){ return JSON.stringify(fallback); }
  };
  return {
    lat: loc ? loc.lat : 0,
    lng: loc ? loc.lng : 0,
    radius: loc ? gpsActiveRadius(loc.radius) : gpsActiveRadius(_gpsData.radius),
    checkinMin: Number(_gpsData.checkinMin) > 0 ? Number(_gpsData.checkinMin) : 20,
    checkoutMin: Number(_gpsData.checkoutMin) > 0 ? Number(_gpsData.checkoutMin) : 80,
    scheduleInMin: shift.inMin,
    scheduleOutMin: shift.outMin,
    tightCompanyGps: !!_gpsData.tightCompanyGps,
    smartAttendanceMode: smartAttendanceMode,
    smartState: smartAttendanceMode && sa.state ? String(sa.state) : '',
    smartCheckinWindowStart: Number(sa.checkinWindowStart) || 0,
    smartCheckoutWindowStart: Number(sa.checkoutWindowStart) || 0,
    smartLastCheckoutAt: Number(sa.lastCheckoutAt) || 0,
    smartCycleReadyAt: Number(sa.cycleReadyAt) || 0,
    smartGpsWakeupAt: Number(sa.gpsWakeupAt) || 0,
    smartHomeWifi: smartJson(saHome.wifi, []),
    // smartHomeBts đã bỏ — không còn dùng BTS
    smartHomeGps: smartJson(saHome.gps, null),
    smartWorkWifi: smartJson(saWork.wifi, []),
    // smartWorkBts đã bỏ — không còn dùng BTS
    smartWorkGps: smartJson(saWork.gps, null),
    insideScheduleOut: false,
    enabled: !!((_gpsData.enabled || (sa && sa.enabled)) && loc),
    hasLocation: !!loc
  };
}

function gpsSyncNativeNow(){
  const cfg = gpsNativeConfigFromData();
  try{ lsSet('cp22_gps_native_cfg', cfg); }catch(e){}

  try{
    const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ChamCongNative;
    if(plugin && plugin.setGpsConfig){
      plugin.setGpsConfig(cfg)
        .then(() => {
          if(cfg.enabled && plugin.startNativeGps) return plugin.startNativeGps(cfg);
          if(!cfg.enabled && plugin.stopNativeGps) return plugin.stopNativeGps();
          return null;
        })
        .catch(e => console.warn('[GPS] direct native sync failed:', e));
    }
  }catch(e){}

  try{
    if(window.ccNative && window.ccNative.syncNativeGps){
      window.ccNative.syncNativeGps(_gpsData).then(function(res){
        if(!res || !res.started) return;
        // Nhắc user bật battery optimization nếu chưa whitelist — nguyên nhân #1
        // khiến service GPS chết trên MIUI/Samsung khi tắt app một lúc
        if(res.needBatteryPrompt && !window._batteryPromptShownThisSession){
          window._batteryPromptShownThisSession = true;
          setTimeout(function(){
            if(typeof openNativePermissionSetting === 'function'){
              openNativePermissionSetting('battery');
            }
          }, 1500);
        }
        // Nhắc user cấp SCHEDULE_EXACT_ALARM nếu chưa có (Android 12+) —
        // không có quyền này, alarm restart không fire → service không tự khôi phục
        if(res.needExactAlarmPrompt && !window._exactAlarmPromptShownThisSession){
          window._exactAlarmPromptShownThisSession = true;
          setTimeout(function(){
            try{
              var plugin = (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ChamCongNative);
              if(plugin && plugin.requestExactAlarmPermission) plugin.requestExactAlarmPermission();
              else if(window.ccNative && window.ccNative.requestExactAlarmPermission) window.ccNative.requestExactAlarmPermission();
            }catch(e){}
          }, 3000);
        }
      }).catch(function(){});
    }
  }catch(e){}
  return cfg;
}

window.gpsSyncNativeNow = gpsSyncNativeNow;

/** Lưu cài đặt GPS vào localStorage */
function saveGpsData(){
  if(typeof gpsRepairLocationPersistence === 'function') gpsRepairLocationPersistence();
  _gpsData.tightCompanyGps = !!_gpsData.tightCompanyGps;
  _gpsData.smartAttendanceMode = _gpsData.enabled ? true : !!_gpsData.smartAttendanceMode;
  _gpsData.insideScheduleOut = false;
  lsSet('cp22_gps', _gpsData);
  try{ gpsSyncNativeNow(); }catch(e){}
}

function toggleGpsTightCompany(btn){
  if(!_gpsData) return;
  _gpsData.tightCompanyGps = !(_gpsData.tightCompanyGps);
  _gpsData.insideScheduleOut = false;
  if(btn) btn.className = 'toggle-sw' + (_gpsData.tightCompanyGps ? ' on' : '');
  saveGpsData();
  if(typeof syncGpsSliders === 'function') syncGpsSliders();
  if(_gpsData.enabled && _gpsData.lat){
    stopGeofencing();
    startGeofencing();
  }
}

/** Lấy Geolocation API: ưu tiên Capacitor (native), fallback về Web API */
function getGeoAPI(){
  if(window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Geolocation){
    return 'capacitor';
  }
  if(navigator.geolocation){
    return 'web';
  }
  return null;
}

function gpsIsNativeRuntime(){
  return !!(window.Capacitor && (
    typeof window.Capacitor.isNativePlatform !== 'function' ||
    window.Capacitor.isNativePlatform()
  ));
}

function gpsPermissionGranted(res){
  return !!(res && (
    res.granted === true ||
    res.location === 'granted' ||
    res.coarseLocation === 'granted'
  ));
}

async function gpsEnsureNativeLocationPermission(){
  if(!gpsIsNativeRuntime()) return true;
  try{
    if(window.ccNative && window.ccNative.ensureLocationPermission){
      return gpsPermissionGranted(await window.ccNative.ensureLocationPermission());
    }
    const plugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ChamCongNative;
    if(plugin){
      if(plugin.checkLocationPermission){
        const cur = await plugin.checkLocationPermission();
        if(gpsPermissionGranted(cur)) return true;
      }
      if(plugin.requestLocationPermission){
        return gpsPermissionGranted(await plugin.requestLocationPermission());
      }
    }
    const geo = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation;
    if(geo){
      if(geo.checkPermissions){
        const cur = await geo.checkPermissions();
        if(gpsPermissionGranted(cur)) return true;
      }
      if(geo.requestPermissions){
        return gpsPermissionGranted(await geo.requestPermissions());
      }
    }
  }catch(e){
    console.warn('[GPS Permission] native request failed:', e);
  }
  return false;
}

/** Lấy vị trí hiện tại — tự động chọn Capacitor hoặc Web API */
function gpsCurrentPosition(onSuccess, onError){
  const api = getGeoAPI();
  // v3: Lấy battery profile để quyết định enableHighAccuracy
  const profile = (typeof GPS_BATTERY_PROFILES !== 'undefined' && typeof _gpsBatteryProfile !== 'undefined')
    ? GPS_BATTERY_PROFILES[_gpsBatteryProfile] || GPS_BATTERY_PROFILES.NORMAL
    : {enableHighAccuracy: true};
  const useHighAcc = profile.enableHighAccuracy !== false;

  function isGpsTimeoutError(err){
    if(!err) return false;
    const code = err.code;
    const msg = String(err.message || err.errorMessage || err.toString && err.toString() || '').toLowerCase();
    return code === 3 || code === 'TIMEOUT' || msg.indexOf('timeout') >= 0 || msg.indexOf('timed out') >= 0;
  }

  function readWebPosition(){
    // FIX timeout (code=3): trước đây timeout 15s + maximumAge 0 (bắt GPS lấy fix
    // mới hoàn toàn) → trong nhà / GPS lạnh thường quá 15s → timeout liên tục.
    // Sửa:
    //  - timeout 30s cho high-accuracy (GPS vệ tinh cần thời gian cold-start)
    //  - maximumAge 30s: cho phép dùng fix gần đây (đỡ phải chờ fix mới mỗi lần)
    //  - Nếu high-accuracy vẫn timeout → tự thử lại 1 lần với low-accuracy
    //    (network/Wi-Fi location — nhanh hơn nhiều, vẫn đủ dùng cho geofence)
    var triedLowAccuracy = false;
    function attempt(highAcc){
      navigator.geolocation.getCurrentPosition(
        function(pos){ onSuccess(pos); },
        function(err){
          if(err && err.code === 3 && highAcc && !triedLowAccuracy){
            triedLowAccuracy = true;
            console.info('[GPS] high-accuracy timeout — thử lại low-accuracy');
            attempt(false);
            return;
          }
          onError(err);
        },
        {
          enableHighAccuracy: highAcc,
          timeout: highAcc ? 30000 : 15000,
          maximumAge: 30000
        }
      );
    }
    attempt(useHighAcc);
  }

  if(api === 'capacitor'){
    // Native Capacitor — không bị chặn quyền như Chrome
    var triedNativeLowAccuracy = false;
    function attemptNative(highAcc){
      Capacitor.Plugins.Geolocation.getCurrentPosition({
        enableHighAccuracy: highAcc,
        timeout: highAcc ? 30000 : 15000,
        maximumAge: 30000
      }).then(pos => onSuccess(pos))
        .catch(err => {
          if(highAcc && !triedNativeLowAccuracy && isGpsTimeoutError(err)){
            triedNativeLowAccuracy = true;
            console.info('[GPS] native high-accuracy timeout — thử lại low-accuracy');
            attemptNative(false);
            return;
          }
          onError(err);
        });
    }
    attemptNative(useHighAcc);
  } else if(api === 'web'){
    // Fallback Web API (chạy trong browser thường)
    if(gpsIsNativeRuntime()){
      gpsEnsureNativeLocationPermission()
        .then(ok => {
          if(ok) readWebPosition();
          else onError({code: 1, message: 'Location permission denied'});
        })
        .catch(err => onError(err));
    } else {
      readWebPosition();
    }
  } else {
    onError({code: 0, message: 'Thiết bị không hỗ trợ GPS'});
  }
}

/** Yêu cầu quyền GPS (Capacitor tự xử lý, Web fallback hỏi trình duyệt) */
async function gpsRequestPermission(){
  const api = getGeoAPI();
  const permGuide = document.getElementById('gpsPermGuide');
  const manualBox = document.getElementById('gpsManualBox');

  if(api === 'capacitor'){
    // Capacitor: yêu cầu quyền native Android/iOS
    try{
      const perm = await Capacitor.Plugins.Geolocation.requestPermissions();
      if(perm.location === 'granted'){
        gpsGetCurrentPos();
      } else {
        if(permGuide) permGuide.style.display = 'block';
        if(manualBox) manualBox.style.display = 'block';
      }
    } catch(e){
      gpsGetCurrentPos(); // Thử trực tiếp nếu requestPermissions lỗi
    }
  } else if(api === 'web'){
    // Web fallback: dùng navigator.permissions
    if(navigator.permissions){
      navigator.permissions.query({name:'geolocation'}).then(result => {
        if(result.state === 'denied'){
          if(permGuide) permGuide.style.display = 'block';
          if(manualBox) manualBox.style.display = 'block';
        } else {
          gpsGetCurrentPos();
        }
      }).catch(() => gpsGetCurrentPos());
    } else {
      gpsGetCurrentPos();
    }
  } else {
    if(permGuide) permGuide.style.display = 'block';
    if(manualBox) manualBox.style.display = 'block';
  }
}

function gpsShowHostGuide(){
  const g = document.getElementById('gpsHostGuide');
  if(g) g.style.display = g.style.display === 'none' ? 'block' : 'none';
  return false;
}

/** Lưu tọa độ công ty nhập thủ công */
function gpsSaveManual(){
  const lat = parseFloat(document.getElementById('gpsManualLat')?.value);
  const lng = parseFloat(document.getElementById('gpsManualLng')?.value);
  if(isNaN(lat)||isNaN(lng)||lat<-90||lat>90||lng<-180||lng>180){
    showGpsBanner(u('gps.coords_invalid'), '#E8433A');
    return;
  }
  gpsPersistCompanyLocation(lat, lng, parseInt(document.getElementById('gpsRadius')?.value) || 15);
  saveGpsData();
  updateGpsStatus();
  startGeofencing();
  showGpsBanner(u('gps.saved'),'#0D9E75');
  const pg = document.getElementById('gpsPermGuide');
  if(pg) pg.style.display = 'none';
}

/** Lấy vị trí GPS hiện tại 1 lần để lưu làm vị trí công ty */
function gpsGetCurrentPos(){
  const statusTxt = document.getElementById('gpsStatusTxt');
  const statusDot = document.getElementById('gpsStatusDot');
  const permGuide = document.getElementById('gpsPermGuide');

  if(!getGeoAPI()){
    if(statusTxt) statusTxt.textContent = u('gps.no_device');
    if(statusDot) statusDot.style.background = '#E8433A';
    return;
  }

  if(statusTxt) statusTxt.textContent = u('gps.loading');
  if(statusDot) statusDot.style.background = '#F5A623';

  gpsCurrentPosition(
    pos => {
      gpsPersistCompanyLocation(
        pos.coords.latitude,
        pos.coords.longitude,
        parseInt(document.getElementById('gpsRadius')?.value) || 15
      );
      saveGpsData();
      updateGpsStatus();
      startGeofencing();
      if(permGuide) permGuide.style.display = 'none';
    },
    err => {
      const msgs = {
        1: u('gps.err_denied'),
        2: u('gps.err_position'),
        3: u('gps.err_timeout')
      };
      if(statusTxt) statusTxt.textContent = msgs[err.code] || (u('gps.err_label') + ': ' + err.message);
      if(statusDot) statusDot.style.background = '#E8433A';
      if(err.code === 1 && permGuide){
        permGuide.style.display = 'block';
        const mb = document.getElementById('gpsManualBox');
        if(mb) mb.style.display = 'block';
      }
    }
  );
}

/** Bật/tắt GPS auto check-in */
function togGPS(btn){
  const willEnable = !(btn && btn.classList && btn.classList.contains('on'));
  return gpsSetSmartAutoAttendance(willEnable, 'togGPS-legacy');
}

/** Xóa cài đặt GPS và dừng theo dõi */
function gpsClear(){
  window.__gpsManualOffThisSession = true;
  stopGeofencing();
  _gpsData.lat = null;
  _gpsData.lng = null;
  _gpsData.enabled = false;
  saveGpsData();
  const btn = document.getElementById('togN3');
  if(btn) btn.classList.remove('on');
  notifCfg.n3 = false; saveNotif();
  const card = document.getElementById('gpsSetupCard');
  if(card) card.style.display = 'none';
  updateGpsStatus();
}

/** Cập nhật UI trạng thái GPS */
function updateGpsStatus(){
  const statusTxt = document.getElementById('gpsStatusTxt');
  const statusDot = document.getElementById('gpsStatusDot');
  const coordsBox = document.getElementById('gpsCoordsBox');
  const coordsTxt = document.getElementById('gpsCoordsText');
  if(!statusTxt) return;
  const api = getGeoAPI();
  const apiLabel = api === 'capacitor' ? '📱 Capacitor Native' : api === 'web' ? '🌐 Web GPS' : u('gps.no_gps_api');
  if(_gpsData.lat && _gpsData.lng){
    const inside = _gpsWasInside;
    statusTxt.textContent = inside === true  ? u('gps.in_zone')
                          : inside === false ? u('gps.out_zone')
                          : u('gps.saved');
    statusDot.style.background = inside === true ? '#0D9E75' : inside === false ? '#E8433A' : '#F5A623';
    if(coordsBox) coordsBox.style.display = 'block';
    if(coordsTxt) coordsTxt.innerHTML =
      `${apiLabel}<br>Lat: ${_gpsData.lat.toFixed(6)} | Lng: ${_gpsData.lng.toFixed(6)}<br>` +
      u('gps.coords_line', {r:_gpsData.radius, p:_gpsPollMs/1000});
  } else {
    statusTxt.textContent = u('gps.no_setup');
    statusDot.style.background = '#ccc';
    if(coordsBox) coordsBox.style.display = 'none';
  }
}

/** Tính khoảng cách (mét) giữa 2 điểm GPS theo công thức Haversine */
function gpsDistance(lat1, lng1, lat2, lng2){
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ══════════════════════════════════════════════════════════════════════════════
   GPS ENGINE — Stub layer (Smart Attendance đã thay thế toàn bộ)
   Các hàm bên dưới chỉ delegate sang smart-attendance.js.
   Không có polling, không có debounce, không có trail logging.
   ══════════════════════════════════════════════════════════════════════════════ */

// Giữ lại để capacitor-integration.js không bị crash khi tham chiếu
var GPS_MAX_ACCURACY = 25;
var GPS_ACCURACY_TRUST = 15;
var GPS_ACCURACY_LOG = 200;
var GPS_BUFFER_ZONE = 20;
var GPS_DEBOUNCE_IN = 2;
var GPS_DEBOUNCE_OUT = 5;
var GPS_NEW_CYCLE_WAIT_MS = 8 * 60 * 60 * 1000;
var GPS_OPEN_SHIFT_CONFIRM_MS = 20 * 60 * 60 * 1000;
var GPS_OPEN_SHIFT_PROMPT_COOLDOWN_MS = 5 * 60 * 1000;
// Qua ngày nhưng chưa checkout: chỉ cho mở vòng mới sau 23h55 từ lúc check-in cũ.
var GPS_OPEN_SHIFT_NEXT_DAY_UNLOCK_MS = ((23 * 60) + 55) * 60 * 1000;
var GPS_POLL_SCHEDULE = {
  BUFFER_ZONE: 3000,
  NEAR: 5000,
  INSIDE: 30000,
  FAR_AWAY: 60000
};
var GPS_BATTERY_PROFILES = {
  NORMAL:    { name: 'Normal',    pollMultiplier: 1, enableHighAccuracy: true,  maxAccuracy: 80  },
  LOW_POWER: { name: 'Low Power', pollMultiplier: 3, enableHighAccuracy: false, maxAccuracy: 150 },
  CRITICAL:  { name: 'Critical',  pollMultiplier: 6, enableHighAccuracy: false, maxAccuracy: 200 }
};
var _gpsBatteryProfile = 'NORMAL';

// Biến state tối thiểu (giữ để không crash các hàm đọc chúng)
var _gpsLastPosition  = null;
var _gpsErrorCount    = 0;
var _gpsTrail         = [];
var _gpsLastOutsideAt = 0;
var _gpsBgWatchId     = null;
var _gpsOpenShiftPromptTs = { main: 0, sub: 0 };
var _gpsOpenShiftBannerTs = { main: 0, sub: 0 };
var GPS_OPEN_SHIFT_NOTICE_STORE_KEY = 'cp22_open_shift_notice_once';
var GPS_OPEN_SHIFT_REMINDER_STORE_KEY = 'cp22_open_shift_reminders_v1';
var GPS_OPEN_SHIFT_REMINDER_AFTER_MS = 20 * 60 * 60 * 1000;
var GPS_OPEN_SHIFT_REMINDER_ID_BASE = 52000;
var _gpsOpenShiftNoticeState = null;
var _gpsOpenShiftReminderState = null;

function _addGpsTrail(entry){
  try{
    var e = Object.assign({ timestamp: Date.now() }, entry || {});
    _gpsTrail.push(e);
    if(_gpsTrail.length > 200) _gpsTrail.shift();
    return e;
  }catch(err){
    return null;
  }
}

function _classifyAccuracy(acc){
  var n = Number(acc);
  if(!Number.isFinite(n)) return 'REJECT';
  if(n <= GPS_ACCURACY_TRUST) return 'TRUSTED';
  if(n <= GPS_MAX_ACCURACY) return 'NORMAL';
  if(n <= GPS_ACCURACY_LOG) return 'LOG_ONLY';
  return 'REJECT';
}

function _calcSmoothedPosition(samples){
  if(!samples || !samples.length) return null;
  if(samples.length === 1) return samples[0];
  var lat = 0, lng = 0, weightSum = 0;
  samples.forEach(function(p){
    var acc = Math.max(1, Number(p.acc || p.accuracy || GPS_MAX_ACCURACY));
    var w = 1 / acc;
    lat += Number(p.lat) * w;
    lng += Number(p.lng) * w;
    weightSum += w;
  });
  if(!weightSum) return samples[samples.length - 1];
  return {
    lat: lat / weightSum,
    lng: lng / weightSum,
    acc: Math.min.apply(null, samples.map(function(p){ return Number(p.acc || p.accuracy || GPS_MAX_ACCURACY); }))
  };
}

function _calcAdaptivePollMs(dist, wasInside, wasOutside){
  if(dist == null || !Number.isFinite(Number(dist))) return GPS_POLL_SCHEDULE.FAR_AWAY;
  var d = Number(dist);
  var r = gpsActiveRadius(_gpsData && _gpsData.radius);
  if(!wasInside && !wasOutside && d <= r + GPS_BUFFER_ZONE) return GPS_POLL_SCHEDULE.BUFFER_ZONE;
  if(Math.abs(d - r) <= 100) return GPS_POLL_SCHEDULE.NEAR;
  if(d > r + 500) return GPS_POLL_SCHEDULE.FAR_AWAY;
  return wasInside ? GPS_POLL_SCHEDULE.INSIDE : GPS_POLL_SCHEDULE.NEAR;
}

function _distanceToPolygonCenter(lat, lng, polygon){
  if(!polygon || polygon.length < 3) return null;
  var center = polygon.reduce(function(acc, p){
    acc.lat += Number(p.lat);
    acc.lng += Number(p.lng);
    return acc;
  }, {lat:0, lng:0});
  center.lat /= polygon.length;
  center.lng /= polygon.length;
  return gpsDistance(lat, lng, center.lat, center.lng);
}

// ── Migration data sang format multi-location ─────────────────────────────────
function _migrateGpsData(){
  if(_gpsData.locations){ return; }
  _gpsData.locations = {
    main: { lat: _gpsData.lat || null, lng: _gpsData.lng || null, radius: gpsActiveRadius(_gpsData.radius) },
    sub:  { lat: null, lng: null, radius: 15 }
  };
  _gpsData.activeJob = _gpsData.activeJob || 'main';
  saveGpsData();
}

function getActiveGpsLocation(jobKey){
  _migrateGpsData();
  var j = jobKey || _gpsData.activeJob || 'main';
  return (_gpsData.locations && _gpsData.locations[j]) || null;
}

function setActiveGpsJob(jobKey){
  _migrateGpsData();
  if(jobKey !== 'main' && jobKey !== 'sub') return;
  _gpsData.activeJob = jobKey;
  var loc = _gpsData.locations[jobKey];
  if(loc && loc.lat && loc.lng){
    _gpsData.lat = loc.lat;
    _gpsData.lng = loc.lng;
    _gpsData.radius = loc.radius || 15;
  }
  saveGpsData();
  if(_gpsData.enabled && typeof saStopGps === 'function'){
    try{ saStopGps(); }catch(e){}
    if(typeof saEnable === 'function') setTimeout(function(){ saEnable(); }, 300);
  }
  if(typeof updateGpsStatus === 'function') updateGpsStatus();
}

function saveGpsLocationForJob(jobKey, lat, lng, radius){
  _migrateGpsData();
  if(jobKey !== 'main' && jobKey !== 'sub') return;
  if(typeof gpsPersistCompanyLocation === 'function') gpsPersistCompanyLocation(lat, lng, radius, jobKey);
  saveGpsData();
}

// ── Polygon helper (dùng bởi UI / saIsAtWorkGps) ─────────────────────────────
function isInsidePolygon(lat, lng, polygon){
  if(!polygon || polygon.length < 3) return false;
  var inside = false;
  for(var i = 0, j = polygon.length - 1; i < polygon.length; j = i++){
    var xi = polygon[i].lat, yi = polygon[i].lng;
    var xj = polygon[j].lat, yj = polygon[j].lng;
    var intersect = ((yi > lng) !== (yj > lng)) &&
      (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if(intersect) inside = !inside;
  }
  return inside;
}

// ── Cycle guard — dùng bởi smart-attendance.js ───────────────────────────────
function gpsDateFromKey(dateKey){
  var parts = String(dateKey || '').split('-');
  var p = parts.map(Number);
  if(p.length !== 3 || p.some(function(n){ return !Number.isFinite(n); })) return null;
  var legacyMonth = parts[1].length < 2 || parts[2].length < 2 || p[1] === 0;
  return new Date(p[0], legacyMonth ? p[1] : p[1] - 1, p[2], 0, 0, 0, 0);
}

function gpsCheckoutTsForRecord(dateKey, rec){
  if(!rec || !rec.out) return 0;
  if(typeof attendanceCheckOutAt === 'function'){
    var exactOut = attendanceCheckOutAt(rec, dateKey);
    if(exactOut > 0) return exactOut;
  }
  var storedOut = Number(rec.checkOutAt || rec.gpsOutTs || 0);
  if(Number.isFinite(storedOut) && storedOut > 0) return storedOut;
  var base = gpsDateFromKey(dateKey);
  if(!base) return 0;
  var outMin = gpsTimeToMinutes(rec.out, null);
  if(outMin == null) return 0;
  base.setHours(Math.floor(outMin / 60), outMin % 60, 0, 0);
  var inMin = rec.in ? gpsTimeToMinutes(rec.in, null) : null;
  if(inMin != null && outMin <= inMin) base.setDate(base.getDate() + 1);
  return base.getTime();
}

function gpsCheckinTsForRecord(dateKey, rec){
  if(!rec || !rec.in) return 0;
  if(typeof attendanceCheckInAt === 'function'){
    var exactIn = attendanceCheckInAt(rec, dateKey);
    if(exactIn > 0) return exactIn;
  }
  var storedIn = Number(rec.checkInAt || rec.gpsInTs || 0);
  if(Number.isFinite(storedIn) && storedIn > 0) return storedIn;
  var base = gpsDateFromKey(dateKey);
  if(!base) return 0;
  var inMin = gpsTimeToMinutes(rec.in, null);
  if(inMin == null) return 0;
  base.setHours(Math.floor(inMin / 60), inMin % 60, 0, 0);
  return base.getTime();
}

function gpsFindLastCheckoutInfo(jobKey){
  var best = null;
  var useSub = jobKey === 'sub';
  if(!attData) return null;
  Object.keys(attData).forEach(function(k){
    var day = attData[k];
    var rec = useSub ? (day && day.sub) : day;
    var ts = gpsCheckoutTsForRecord(k, rec);
    if(ts > 0 && (!best || ts > best.ts))
      best = { ts: ts, dateKey: k, time: rec.out, job: useSub ? 'sub' : 'main' };
  });
  return best;
}

function gpsFindOpenShiftInfo(jobKey){
  var best = null;
  var useSub = jobKey === 'sub';
  if(!attData) return null;
  Object.keys(attData).forEach(function(k){
    var day = attData[k];
    var rec = useSub ? (day && day.sub) : day;
    if(!rec || !rec.in || rec.out) return;
    var ts = gpsCheckinTsForRecord(k, rec);
    if(ts > 0 && (!best || ts > best.ts)){
      best = { ts: ts, dateKey: k, time: rec.in, job: useSub ? 'sub' : 'main' };
    }
  });
  return best;
}

function gpsIsCrossedToNextDay(fromTs, toTs){
  var a = new Date(Number(fromTs) || 0);
  var b = new Date(Number(toTs) || 0);
  if(!Number.isFinite(a.getTime()) || !Number.isFinite(b.getTime())) return false;
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return b.getTime() > a.getTime();
}

function gpsCycleGuardInfo(jobKey, nowMs){
  var job = (jobKey === 'sub') ? 'sub' : 'main';
  var now = Number(nowMs);
  if(!Number.isFinite(now) || now <= 0) now = Date.now();

  var open = gpsFindOpenShiftInfo(job);
  if(open && !gpsOpenShiftStillValid(open, job)){
    gpsCancelOpenShiftRemindersByInfo({ job: job, open: open });
    open = null;
  }
  if(open){
    var elapsed = Math.max(0, now - open.ts);
    var crossedDay = gpsIsCrossedToNextDay(open.ts, now);
    if(crossedDay){
      var overnightLeft = GPS_OPEN_SHIFT_NEXT_DAY_UNLOCK_MS - elapsed;
      if(overnightLeft > 0){
        return {
          allow: false,
          reason: 'open_shift_overnight_wait',
          job: job,
          open: open,
          crossedDay: true,
          elapsedMs: elapsed,
          elapsedMin: Math.floor(elapsed / 60000),
          leftMs: overnightLeft,
          minutesLeft: Math.max(0, Math.ceil(overnightLeft / 60000))
        };
      }
      return {
        allow: true,
        reason: 'open_shift_overnight_ready',
        job: job,
        open: open,
        crossedDay: true,
        elapsedMs: elapsed,
        elapsedMin: Math.floor(elapsed / 60000),
        minutesLeft: 0
      };
    }
    return {
      allow: false,
      reason: 'open_shift',
      job: job,
      open: open,
      elapsedMs: elapsed,
      elapsedMin: Math.floor(elapsed / 60000),
      needsLongOpenConfirm: elapsed >= GPS_OPEN_SHIFT_CONFIRM_MS
    };
  }

  var last = gpsFindLastCheckoutInfo(job);
  if(!last){
    return { allow: true, reason: 'ok', job: job, minutesLeft: 0 };
  }
  var left = GPS_NEW_CYCLE_WAIT_MS - (now - last.ts);
  if(left > 0){
    return {
      allow: false,
      reason: 'wait_8h',
      job: job,
      lastCheckout: last,
      leftMs: left,
      minutesLeft: Math.max(0, Math.ceil(left / 60000))
    };
  }
  return { allow: true, reason: 'ok', job: job, minutesLeft: 0, lastCheckout: last };
}

function gpsCanStartNewAutoCycle(jobKey){
  return !!gpsCycleGuardInfo(jobKey).allow;
}

function gpsMinutesUntilNewCycle(jobKey){
  var info = gpsCycleGuardInfo(jobKey);
  return info.reason === 'wait_8h' ? (info.minutesLeft || 0) : 0;
}

function gpsOpenShiftBlockText(info){
  var jobLabel = (info && info.job === 'sub') ? 'Job phụ' : 'Job chính';
  if(!info || !info.open){
    return jobLabel + ': ca trước chưa checkout, chưa thể vào ca mới.';
  }
  return jobLabel + ': ca trước chưa checkout (' + info.open.dateKey + ' ' + info.open.time + ').';
}

function gpsOpenShiftConfirmText(info){
  // Hiển thị theo dữ liệu thực tế, không ép tối thiểu 20h để tránh cảnh báo sai cảm nhận.
  var hours = Math.max(0, Math.floor((info.elapsedMs || 0) / 3600000));
  var jobLabel = (info && info.job === 'sub') ? 'job phụ' : 'job chính';
  var start = info && info.open ? (info.open.dateKey + ' ' + info.open.time) : 'ca trước';
  return 'Bạn chưa checkout ' + jobLabel + ' từ ' + start + '.\n\n'
    + 'Đã quá ' + hours + ' giờ. Xác nhận checkout ca cũ ngay bây giờ để mở ca mới?';
}

function gpsResolveOvernightCloseTs(info, nowMs){
  if(!info || !info.open || !Number.isFinite(Number(info.open.ts))) return Number(nowMs) || Date.now();
  var unlockAt = Number(info.open.ts) + GPS_OPEN_SHIFT_NEXT_DAY_UNLOCK_MS;
  var now = Number(nowMs);
  if(!Number.isFinite(now) || now <= 0) now = Date.now();
  return Math.min(now, unlockAt > 0 ? unlockAt : now);
}

function gpsShouldPromptOpenShift(job, nowMs){
  var key = job === 'sub' ? 'sub' : 'main';
  var now = Number(nowMs);
  if(!Number.isFinite(now) || now <= 0) now = Date.now();
  var last = Number(_gpsOpenShiftPromptTs[key] || 0);
  if(last > 0 && (now - last) < GPS_OPEN_SHIFT_PROMPT_COOLDOWN_MS) return false;
  _gpsOpenShiftPromptTs[key] = now;
  return true;
}

function gpsShouldShowOpenShiftBanner(job, source, nowMs){
  var key = job === 'sub' ? 'sub' : 'main';
  var src = String(source || '');
  // Manual check-in luôn được hiện banner để user biết lý do bị chặn.
  if(src !== 'smart_attendance') return true;
  // Auto check-in khi app ẩn: không bật banner nổi để tránh cảm giác "tự dưng báo".
  try{
    if(typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  }catch(e){}
  // Auto check-in khi app đang mở: giới hạn tần suất banner theo cooldown.
  var now = Number(nowMs);
  if(!Number.isFinite(now) || now <= 0) now = Date.now();
  var last = Number(_gpsOpenShiftBannerTs[key] || 0);
  if(last > 0 && (now - last) < GPS_OPEN_SHIFT_PROMPT_COOLDOWN_MS) return false;
  _gpsOpenShiftBannerTs[key] = now;
  return true;
}

function gpsGetOpenShiftNoticeState(){
  if(_gpsOpenShiftNoticeState) return _gpsOpenShiftNoticeState;
  var raw = null;
  try{ raw = (typeof lsGet === 'function') ? lsGet(GPS_OPEN_SHIFT_NOTICE_STORE_KEY) : null; }catch(e){}
  _gpsOpenShiftNoticeState = (raw && typeof raw === 'object') ? raw : { main: {}, sub: {} };
  if(!_gpsOpenShiftNoticeState.main) _gpsOpenShiftNoticeState.main = {};
  if(!_gpsOpenShiftNoticeState.sub) _gpsOpenShiftNoticeState.sub = {};
  return _gpsOpenShiftNoticeState;
}

function gpsSaveOpenShiftNoticeState(){
  try{
    if(typeof lsSet === 'function'){
      lsSet(GPS_OPEN_SHIFT_NOTICE_STORE_KEY, gpsGetOpenShiftNoticeState());
    }
  }catch(e){}
}

function gpsGetOpenShiftReminderState(){
  if(_gpsOpenShiftReminderState) return _gpsOpenShiftReminderState;
  var raw = null;
  try{ raw = (typeof lsGet === 'function') ? lsGet(GPS_OPEN_SHIFT_REMINDER_STORE_KEY) : null; }catch(e){}
  _gpsOpenShiftReminderState = (raw && typeof raw === 'object') ? raw : { main: {}, sub: {} };
  if(!_gpsOpenShiftReminderState.main) _gpsOpenShiftReminderState.main = {};
  if(!_gpsOpenShiftReminderState.sub) _gpsOpenShiftReminderState.sub = {};
  return _gpsOpenShiftReminderState;
}

function gpsSaveOpenShiftReminderState(){
  try{
    if(typeof lsSet === 'function'){
      lsSet(GPS_OPEN_SHIFT_REMINDER_STORE_KEY, gpsGetOpenShiftReminderState());
    }
  }catch(e){}
}

function gpsOpenShiftReminderIdSet(info){
  var key = gpsOpenShiftNoticeId(info);
  if(!key) return null;
  var hash = 0;
  for(var i = 0; i < key.length; i++){
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  var idx = Math.abs(hash) % 9000;
  var base = GPS_OPEN_SHIFT_REMINDER_ID_BASE + (idx * 3);
  return { n20: base, weekend: base + 1, monthEnd: base + 2 };
}

/** Lấy giờ ra ca dự kiến từ cấu hình shift của user ("17:00" fallback) */
function _gpsGetExpectedOutTime(){
  try{
    var ud = window.userData || {};
    var shiftTimes = ud.shiftTimes || [];
    var currentShift = (typeof window.getEffectiveCurrentShift === 'function')
      ? window.getEffectiveCurrentShift()
      : (ud.currentShift || 1);
    var shiftIdx = Math.max(0, (Number(currentShift) || 1) - 1);
    return (shiftTimes[shiftIdx] && shiftTimes[shiftIdx].out) || '17:00';
  }catch(e){ return '17:00'; }
}

/** Tính timestamp của "HH:MM + offsetMin" trên ngày date cho trước */
function _gpsTimestampAtTimeOnDate(date, timeStr, offsetMin){
  try{
    var parts = String(timeStr || '17:00').split(':');
    var h = parseInt(parts[0], 10) || 17;
    var m = (parseInt(parts[1], 10) || 0) + (offsetMin || 0);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m, 0, 0).getTime();
  }catch(e){ return 0; }
}

/** Cuối tuần (Thứ Bảy) kể từ openTs, lúc giờ outTime + offsetMin */
function gpsEndOfWeekTsAt(openTs, timeStr, offsetMin){
  var src = new Date(Number(openTs) || Date.now());
  var d = new Date(src.getTime());
  var addDays = (6 - d.getDay() + 7) % 7; // 6 = Thứ Bảy
  d.setDate(d.getDate() + addDays);
  var parts = String(timeStr || '17:00').split(':');
  d.setHours(parseInt(parts[0],10)||17, (parseInt(parts[1],10)||0)+(offsetMin||0), 0, 0);
  if(d.getTime() <= src.getTime()) d.setDate(d.getDate() + 7);
  return d.getTime();
}

/** Ngày cuối tháng kể từ openTs, lúc giờ outTime + offsetMin */
function gpsEndOfMonthTsAt(openTs, timeStr, offsetMin){
  var src = new Date(Number(openTs) || Date.now());
  var parts = String(timeStr || '17:00').split(':');
  var h = parseInt(parts[0],10)||17;
  var m = (parseInt(parts[1],10)||0)+(offsetMin||0);
  var d = new Date(src.getFullYear(), src.getMonth() + 1, 0, h, m, 0, 0);
  if(d.getTime() <= src.getTime()){
    d = new Date(src.getFullYear(), src.getMonth() + 2, 0, h, m, 0, 0);
  }
  return d.getTime();
}

function gpsReminderPlanForOpenShift(info, nowMs){
  if(!info || !info.open || !Number.isFinite(Number(info.open.ts))) return null;
  var now = Number(nowMs);
  if(!Number.isFinite(now) || now <= 0) now = Date.now();
  var minFuture = now + 60 * 1000;

  var outTime = _gpsGetExpectedOutTime(); // vd: "17:00" — dùng cho weekend/monthEnd
  var openTs = Number(info.open.ts);

  // n20: đúng 20 giờ sau lúc check-in
  var t20 = openTs + GPS_OPEN_SHIFT_REMINDER_AFTER_MS;
  // weekend: outTime + 15 phút Chủ nhật tuần đó
  var tWeekend = gpsEndOfWeekTsAt(openTs, outTime, 15);
  // monthEnd: outTime + 15 phút ngày cuối tháng
  var tMonthEnd = gpsEndOfMonthTsAt(openTs, outTime, 15);

  // Nếu tất cả đã qua, dùng now + 2 phút (để notification thực sự fire được)
  var catchUp = now + 2 * 60 * 1000;
  return {
    n20:      t20      > minFuture ? t20      : catchUp,
    weekend:  tWeekend > minFuture ? tWeekend : catchUp,
    monthEnd: tMonthEnd > minFuture ? tMonthEnd : catchUp
  };
}

/** extra (tuỳ chọn): { dateKey, job } — dùng để validate trước khi fire khi app tắt */
function gpsScheduleNativeReminder(id, title, body, atMs, extra){
  try{
    if(!window.ccNative || !window.ccNative.isNative || typeof window.ccNative.scheduleNotification !== 'function') return;
    var t = new Date(Number(atMs) || 0);
    if(!Number.isFinite(t.getTime())) return;
    var p = window.ccNative.scheduleNotification(title, body, id, t, extra || null);
    if(p && typeof p.catch === 'function') p.catch(function(){});
  }catch(e){}
}

function gpsCancelNativeReminder(id){
  try{
    if(!window.ccNative || !window.ccNative.isNative || typeof window.ccNative.cancelNotification !== 'function') return;
    var p = window.ccNative.cancelNotification(Number(id));
    if(p && typeof p.catch === 'function') p.catch(function(){});
  }catch(e){}
}

function gpsScheduleOpenShiftReminders(info, nowMs){
  if(!info || !info.open) return;
  if(!gpsOpenShiftStillValid(info.open, info.job)) return;
  var ids = gpsOpenShiftReminderIdSet(info);
  var plan = gpsReminderPlanForOpenShift(info, nowMs);
  var noticeId = gpsOpenShiftNoticeId(info);
  if(!ids || !plan || !noticeId) return;

  var st = gpsGetOpenShiftReminderState();
  var job = info.job === 'sub' ? 'sub' : 'main';
  if(!st[job]) st[job] = {};

  var prev = st[job][noticeId] || {};
  if(prev.openTs === Number(info.open.ts)
    && prev.n20At === plan.n20
    && prev.weekendAt === plan.weekend
    && prev.monthEndAt === plan.monthEnd){
    return;
  }

  var label = job === 'sub' ? 'job phụ' : 'job chính';
  var start = String(info.open.dateKey || '') + ' ' + String(info.open.time || '');
  // Truyền extra {dateKey, job} để NotificationReceiver có thể validate khi app tắt
  var extra = { dateKey: info.open.dateKey || '', job: job };
  gpsScheduleNativeReminder(ids.n20, 'Chưa checkout ca', 'Đã 20 giờ từ lúc vào ' + label + ' (' + start + '). Mở app để checkout.', plan.n20, extra);
  gpsScheduleNativeReminder(ids.weekend, 'Cuối tuần chưa checkout', label + ' từ ' + start + ' vẫn chưa checkout. Vui lòng cập nhật.', plan.weekend, extra);
  gpsScheduleNativeReminder(ids.monthEnd, 'Cuối tháng chưa checkout', label + ' từ ' + start + ' vẫn đang mở. Vui lòng chốt ca.', plan.monthEnd, extra);

  st[job][noticeId] = {
    openTs: Number(info.open.ts) || 0,
    dateKey: info.open.dateKey || '',
    n20Id: ids.n20,
    weekendId: ids.weekend,
    monthEndId: ids.monthEnd,
    n20At: plan.n20,
    weekendAt: plan.weekend,
    monthEndAt: plan.monthEnd,
    scheduledAt: Date.now()
  };
  gpsSaveOpenShiftReminderState();
}

function gpsCancelOpenShiftRemindersByInfo(info){
  if(!info || !info.open) return;
  var noticeId = gpsOpenShiftNoticeId(info);
  if(!noticeId) return;
  var st = gpsGetOpenShiftReminderState();
  var job = info.job === 'sub' ? 'sub' : 'main';
  var dateKey = info.open.dateKey || '';
  var entry = st[job] && st[job][noticeId];
  if(entry){
    gpsCancelNativeReminder(entry.n20Id);
    gpsCancelNativeReminder(entry.weekendId);
    gpsCancelNativeReminder(entry.monthEndId);
    delete st[job][noticeId];
    gpsSaveOpenShiftReminderState();
  } else {
    var ids = gpsOpenShiftReminderIdSet(info);
    if(ids){
      gpsCancelNativeReminder(ids.n20);
      gpsCancelNativeReminder(ids.weekend);
      gpsCancelNativeReminder(ids.monthEnd);
    }
  }
  // Đánh dấu ca đã đóng vào SharedPreferences để NotificationReceiver validate khi app tắt
  if(dateKey && window.ccNative && typeof window.ccNative.markOpenShiftClosed === 'function'){
    try{ window.ccNative.markOpenShiftClosed(dateKey, job); }catch(e){}
  }
}

function gpsCancelOpenShiftRemindersByDate(jobKey, dateKey){
  var st = gpsGetOpenShiftReminderState();
  var job = jobKey === 'sub' ? 'sub' : 'main';
  var bucket = st[job] || {};
  var prefix = job + '|' + String(dateKey || '') + '|';
  Object.keys(bucket).forEach(function(id){
    if(String(id).indexOf(prefix) !== 0) return;
    var e = bucket[id] || {};
    gpsCancelNativeReminder(e.n20Id);
    gpsCancelNativeReminder(e.weekendId);
    gpsCancelNativeReminder(e.monthEndId);
    delete bucket[id];
  });
  st[job] = bucket;
  gpsSaveOpenShiftReminderState();
  // Đánh dấu ca đã đóng vào SharedPreferences để NotificationReceiver validate khi app tắt
  if(dateKey && window.ccNative && typeof window.ccNative.markOpenShiftClosed === 'function'){
    try{ window.ccNative.markOpenShiftClosed(String(dateKey), job); }catch(e){}
  }
}

function gpsOpenShiftNoticeId(info){
  if(!info || !info.open) return '';
  return [
    info.job || 'main',
    info.open.dateKey || '',
    info.open.time || '',
    Math.floor(Number(info.open.ts || 0) / 60000)
  ].join('|');
}

function gpsHasSeenOpenShiftNotice(info){
  var id = gpsOpenShiftNoticeId(info);
  if(!id) return false;
  var st = gpsGetOpenShiftNoticeState();
  var job = (info && info.job === 'sub') ? 'sub' : 'main';
  return !!(st[job] && st[job][id]);
}

function gpsMarkOpenShiftNotice(info, nowMs){
  var id = gpsOpenShiftNoticeId(info);
  if(!id) return;
  var st = gpsGetOpenShiftNoticeState();
  var job = (info && info.job === 'sub') ? 'sub' : 'main';
  if(!st[job]) st[job] = {};
  st[job][id] = Number(nowMs) > 0 ? Number(nowMs) : Date.now();
  gpsSaveOpenShiftNoticeState();
}

function gpsRecByJobOnDate(jobKey, dateKey){
  var day = null;
  if(typeof getAttRecordByKey === 'function') day = getAttRecordByKey(dateKey);
  else day = attData ? attData[dateKey] : null;
  if(!day) return null;
  return jobKey === 'sub' ? (day.sub || null) : day;
}

function gpsHasCheckoutAfterTs(jobKey, afterTs){
  var useSub = jobKey === 'sub';
  var baseTs = Number(afterTs);
  if(!Number.isFinite(baseTs) || baseTs <= 0 || !attData) return false;
  var found = false;
  Object.keys(attData).forEach(function(k){
    if(found) return;
    var day = attData[k];
    var rec = useSub ? (day && day.sub) : day;
    var outTs = gpsCheckoutTsForRecord(k, rec);
    if(outTs > baseTs) found = true;
  });
  return found;
}

function gpsOpenShiftStillValid(openInfo, jobKey){
  if(!openInfo || !openInfo.dateKey) return false;
  var rec = gpsRecByJobOnDate(jobKey, openInfo.dateKey);
  if(!rec || !rec.in || rec.out) return false;
  if(gpsHasCheckoutAfterTs(jobKey, openInfo.ts)) return false;
  return true;
}

function gpsShouldNotifyOpenShiftOnce(info, source, nowMs){
  if(!info || !info.open) return true;
  var now = Number(nowMs);
  if(!Number.isFinite(now) || now <= 0) now = Date.now();
  // Chỉ nhắc khi đã sang ngày mới so với ca mở.
  if(!gpsIsCrossedToNextDay(info.open.ts, now)) return false;
  if(gpsHasSeenOpenShiftNotice(info)) return false;
  if(!gpsShouldShowOpenShiftBanner(info.job, source, now)) return false;
  gpsMarkOpenShiftNotice(info, now);
  return true;
}

function gpsClearOpenShiftNoticeByDate(jobKey, dateKey){
  var st = gpsGetOpenShiftNoticeState();
  var job = (jobKey === 'sub') ? 'sub' : 'main';
  var bucket = st[job] || {};
  var prefix = job + '|' + String(dateKey || '') + '|';
  Object.keys(bucket).forEach(function(id){
    if(String(id).indexOf(prefix) === 0){
      delete bucket[id];
    }
  });
  st[job] = bucket;
}

function gpsHideOpenShiftBannerNow(){
  var banner = document.getElementById('gpsBanner');
  if(!banner) return;
  var msg = String(banner.textContent || '').toLowerCase();
  if(msg.indexOf('chưa checkout') >= 0 || msg.indexOf('23h55') >= 0 || msg.indexOf('ca cũ') >= 0){
    banner.style.opacity = '0';
  }
}

function gpsOnCheckinSaved(payload){
  var p = payload || {};
  var dateKey = String(p.dateKey || '');
  if(!dateKey) return;
  var now = Date.now();
  if(p.mainIn){
    var openMain = gpsFindOpenShiftInfo('main');
    if(openMain && openMain.dateKey === dateKey && gpsOpenShiftStillValid(openMain, 'main')){
      gpsScheduleOpenShiftReminders({ job: 'main', open: openMain }, now);
    }
  }
  if(p.subIn){
    var openSub = gpsFindOpenShiftInfo('sub');
    if(openSub && openSub.dateKey === dateKey && gpsOpenShiftStillValid(openSub, 'sub')){
      gpsScheduleOpenShiftReminders({ job: 'sub', open: openSub }, now);
    }
  }
}

function gpsOnManualCheckoutSaved(payload){
  var p = payload || {};
  var dateKey = String(p.dateKey || '');
  if(!dateKey) return;
  if(p.mainOut){
    gpsClearOpenShiftNoticeByDate('main', dateKey);
    gpsCancelOpenShiftRemindersByDate('main', dateKey);
    _gpsOpenShiftPromptTs.main = 0;
    _gpsOpenShiftBannerTs.main = 0;
  }
  if(p.subOut){
    gpsClearOpenShiftNoticeByDate('sub', dateKey);
    gpsCancelOpenShiftRemindersByDate('sub', dateKey);
    _gpsOpenShiftPromptTs.sub = 0;
    _gpsOpenShiftBannerTs.sub = 0;
  }
  gpsSaveOpenShiftNoticeState();
  gpsHideOpenShiftBannerNow();
}

function gpsCloseOpenShift(openInfo, closeMs){
  if(!openInfo || !openInfo.dateKey || !attData) return false;
  var day = attData[openInfo.dateKey];
  if(!day) return false;
  var rec;
  if(openInfo.job === 'sub'){
    if(!day.sub) day.sub = { type: 'cm' };
    rec = day.sub;
  } else {
    rec = day;
  }
  if(!rec || !rec.in || rec.out) return false;
  var t = new Date(Number(closeMs) > 0 ? Number(closeMs) : Date.now());
  var hm = fmtTime(t);
  if(typeof attendanceSetOut === 'function') attendanceSetOut(rec, openInfo.dateKey, hm, t.getTime());
  else { rec.out = hm; rec.checkOutAt = t.getTime(); }
  rec.type = rec.type || 'cm';
  rec.auto = true;
  rec.autoMethod = 'recover_open_shift';
  gpsCancelOpenShiftRemindersByInfo({ job: openInfo.job, open: openInfo });
  saveAtt();
  if(typeof updateTodayStatusTime === 'function') updateTodayStatusTime();
  if(typeof renderHomeStats === 'function') renderHomeStats();
  return true;
}

function gpsEnsureCycleForCheckin(jobKey, opts){
  opts = opts || {};
  var source = String(opts.source || '');
  var isSmartAuto = source === 'smart_attendance';
  var info = gpsCycleGuardInfo(jobKey, opts.nowMs);
  if(info.allow){
    // Qua ngày đủ 23h55: KHÔNG tự động chốt ca cũ.
    // Ca cũ để nguyên → user vào lịch tự sửa, 3 reminder vẫn chạy đúng.
    // Chỉ hiện banner nhắc nhẹ, rồi cho phép check-in mới bình thường.
    if(info.reason === 'open_shift_overnight_ready' && info.open){
      if(opts.showBanner !== false && typeof showGpsBanner === 'function'
        && gpsShouldShowOpenShiftBanner(info.job, opts.source, opts.nowMs)){
        var jobLabelReady = (info.job === 'sub') ? 'job phụ' : 'job chính';
        showGpsBanner('⚠️ ' + jobLabelReady + ' hôm qua chưa checkout. Vui lòng vào lịch để cập nhật.', '#F5A623');
      }
    }
    return { allowed: true, reason: 'ok', info: info };
  }

  if(info.reason === 'wait_8h'){
    if(opts.showBanner !== false && typeof showGpsBanner === 'function'){
      showGpsBanner(u('gps.cycle_wait', { m: info.minutesLeft || 0 }), '#F5A623');
    }
    return { allowed: false, reason: 'wait_8h', minutesLeft: info.minutesLeft || 0, info: info };
  }

  // Không schedule ở đây — hàm này chạy liên tục theo GPS poll.
  // Reminder đã được lên lịch 1 lần duy nhất trong gpsOnCheckinSaved và gpsRestoreOpenShiftReminders.

  if(info.reason === 'open_shift_overnight_wait'){
    if(opts.showBanner !== false && typeof showGpsBanner === 'function'
      && gpsShouldNotifyOpenShiftOnce(info, opts.source, opts.nowMs)){
      var jobLabelWait = (info && info.job === 'sub') ? 'job phụ' : 'job chính';
      showGpsBanner(
        '⏳ ' + jobLabelWait + ' qua ngày nhưng chưa đủ 23h55 từ lúc vào ca cũ. Còn ' + (info.minutesLeft || 0) + ' phút.',
        '#F5A623'
      );
    }
    return { allowed: false, reason: 'open_shift_overnight_wait', minutesLeft: info.minutesLeft || 0, info: info };
  }

  var blockText = gpsOpenShiftBlockText(info);
  if(opts.showBanner !== false && typeof showGpsBanner === 'function'
    && gpsShouldNotifyOpenShiftOnce(info, opts.source, opts.nowMs)){
    showGpsBanner(blockText, '#F5A623');
  }
  if(!info.needsLongOpenConfirm){
    return { allowed: false, reason: 'open_shift', info: info };
  }

  // Smart auto: không bật popup confirm để tránh cảnh báo "tự dưng" khi app foreground.
  // Luồng manual vẫn giữ confirm đầy đủ.
  if(isSmartAuto){
    return { allowed: false, reason: 'open_shift_confirm_required', info: info };
  }

  if(opts.allowConfirm === false){
    return { allowed: false, reason: 'open_shift_confirm_required', info: info };
  }
  if(!gpsShouldPromptOpenShift(info.job, opts.nowMs)){
    return { allowed: false, reason: 'open_shift_prompt_cooldown', info: info };
  }

  var ok = false;
  try{
    ok = window.confirm ? !!window.confirm(gpsOpenShiftConfirmText(info)) : true;
  }catch(e){
    ok = false;
  }
  if(!ok) return { allowed: false, reason: 'open_shift_user_declined', info: info };

  var closeTs = Number(opts.closeMs);
  if(!Number.isFinite(closeTs) || closeTs <= 0) closeTs = Date.now();
  if(!gpsCloseOpenShift(info.open, closeTs)){
    if(opts.showBanner !== false && typeof showGpsBanner === 'function'){
      showGpsBanner('Không thể đóng ca cũ tự động. Vui lòng checkout thủ công trước.', '#E8433A');
    }
    return { allowed: false, reason: 'open_shift_close_failed', info: info };
  }

  if(opts.showBanner !== false && typeof showGpsBanner === 'function'){
    showGpsBanner('✅ Đã checkout ca cũ. Tiếp tục vào ca mới.', '#0D9E75');
  }
  return { allowed: true, reason: 'open_shift_closed', info: info };
}

// ── Banner thông báo nổi ──────────────────────────────────────────────────────
function showGpsBanner(msg, color){
  var banner = document.getElementById('gpsBanner');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'gpsBanner';
    banner.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);'
      + 'z-index:9999;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:700;'
      + 'font-family:Nunito,sans-serif;color:white;box-shadow:0 4px 20px rgba(0,0,0,.25);'
      + 'transition:opacity .4s;max-width:320px;text-align:center;pointer-events:none';
    document.body.appendChild(banner);
  }
  banner.textContent = msg;
  banner.style.background = color || '#0D9E75';
  banner.style.opacity = '1';
  clearTimeout(banner._timer);
  banner._timer = setTimeout(function(){ banner.style.opacity = '0'; }, 4000);
}

function gpsResolveRunnableLocation(){
  if(!_gpsData) return null;
  var loc = null;
  try{
    if(typeof gpsGetStoredCompanyLocation === 'function'){
      loc = gpsGetStoredCompanyLocation(_gpsData.activeJob || 'main')
        || gpsGetStoredCompanyLocation('main')
        || gpsGetStoredCompanyLocation('sub');
    }
  }catch(e){}
  if(!loc && typeof gpsHasLocation === 'function' && gpsHasLocation(_gpsData)){
    loc = {
      lat: Number(_gpsData.lat),
      lng: Number(_gpsData.lng),
      radius: (typeof gpsLocationRadius === 'function') ? gpsLocationRadius(_gpsData.radius) : (Number(_gpsData.radius) || 15)
    };
  }
  if(!loc) return null;
  _gpsData.lat = Number(loc.lat);
  _gpsData.lng = Number(loc.lng);
  _gpsData.radius = (typeof gpsLocationRadius === 'function') ? gpsLocationRadius(loc.radius) : (Number(loc.radius) || 15);
  return loc;
}
window.gpsResolveRunnableLocation = gpsResolveRunnableLocation;
window._addGpsTrail = _addGpsTrail;
window.toggleGpsTightCompany = toggleGpsTightCompany;
window.gpsActiveRadius = gpsActiveRadius;
window.gpsFindLastCheckoutInfo = gpsFindLastCheckoutInfo;
window.gpsFindOpenShiftInfo = gpsFindOpenShiftInfo;
window.gpsCycleGuardInfo = gpsCycleGuardInfo;
window.gpsEnsureCycleForCheckin = gpsEnsureCycleForCheckin;
window.gpsCanStartNewAutoCycle = gpsCanStartNewAutoCycle;
window.gpsOnCheckinSaved = gpsOnCheckinSaved;
window.gpsOnManualCheckoutSaved = gpsOnManualCheckoutSaved;

/**
 * Xem lại toàn bộ reminder đang chờ trong storage.
 * - Ca đã checkout / không còn open → huỷ hết 3 thông báo của ca đó ngay lập tức.
 * - Ca vẫn đang mở → giữ nguyên.
 * Gọi mỗi khi app lên foreground hoặc boot để đảm bảo không bắn thông báo thừa.
 */
function gpsValidateOpenShiftReminders(){
  ['main','sub'].forEach(function(job){
    var st = gpsGetOpenShiftReminderState();
    var bucket = st[job] || {};
    var changed = false;
    Object.keys(bucket).forEach(function(noticeId){
      var e = bucket[noticeId] || {};
      // Tái tạo openInfo tối giản để kiểm tra validity
      var openInfo = { dateKey: e.dateKey || '', ts: e.openTs || 0 };
      if(!openInfo.dateKey || !openInfo.ts) return;
      if(!gpsOpenShiftStillValid(openInfo, job)){
        // Dữ liệu đã cập nhật (checkout) → huỷ cả 3 thông báo
        gpsCancelNativeReminder(e.n20Id);
        gpsCancelNativeReminder(e.weekendId);
        gpsCancelNativeReminder(e.monthEndId);
        delete bucket[noticeId];
        changed = true;
      }
    });
    if(changed){
      st[job] = bucket;
      gpsSaveOpenShiftReminderState();
    }
  });
}
window.gpsValidateOpenShiftReminders = gpsValidateOpenShiftReminders;

/**
 * Gọi 1 lần khi app khởi động:
 * 1. Huỷ reminder của các ca đã đóng (validate)
 * 2. Lên lịch lại cho ca đang còn mở (nếu chưa có)
 */
function gpsRestoreOpenShiftReminders(){
  gpsValidateOpenShiftReminders(); // bước 1: dọn stale trước
  var now = Date.now();
  ['main','sub'].forEach(function(job){
    var open = gpsFindOpenShiftInfo(job);
    if(!open || !gpsOpenShiftStillValid(open, job)) return;
    gpsScheduleOpenShiftReminders({ job: job, open: open }, now); // bước 2: restore nếu cần
  });
}
window.gpsRestoreOpenShiftReminders = gpsRestoreOpenShiftReminders;
window.showGpsBanner = showGpsBanner;
// Note: _gpsData, _gpsBgWatchId, _gpsLastPosition, _gpsPositionHistory, _gpsBatteryProfile
// are already exposed automatically via top-level `var` declarations.
// We DON'T redefine them as accessors (would throw "Cannot redefine property").
// The values stay in sync because top-level vars in classic script ARE properties of window.


/** Đọc cài đặt GPS từ localStorage */
function loadGpsData(){
  const g = lsGet('cp22_gps');
  if(g) _gpsData = Object.assign(_gpsData, g);
  _gpsData.tightCompanyGps = !!_gpsData.tightCompanyGps;
  _gpsData.smartAttendanceMode = _gpsData.enabled ? true : !!_gpsData.smartAttendanceMode;
  _gpsData.insideScheduleOut = false;
  if(typeof gpsApplyDefaultRadiusMigration === 'function') gpsApplyDefaultRadiusMigration();
  if(typeof gpsRepairLocationPersistence === 'function'){
    gpsRepairLocationPersistence();
    lsSet('cp22_gps', _gpsData);
  }
}

/** Lưu cài đặt GPS vào localStorage */
function saveGpsData(){
  if(typeof gpsRepairLocationPersistence === 'function') gpsRepairLocationPersistence();
  _gpsData.tightCompanyGps = !!_gpsData.tightCompanyGps;
  _gpsData.smartAttendanceMode = _gpsData.enabled ? true : !!_gpsData.smartAttendanceMode;
  _gpsData.insideScheduleOut = false;
  lsSet('cp22_gps', _gpsData);
  try{ gpsSyncNativeNow(); }catch(e){}
}

// FIX P3 #7: debounce 300ms khi user kéo slider GPS (gpsRadius/gpsCheckinDelay/gpsCheckoutDelay).
// Trước đây mỗi event input ghi cp22_gps + sync native ngay → log thấy 5-10 lần ghi cho 1 lần kéo.
// _gpsData vẫn được update vào RAM ngay (giữ UI responsive), chỉ phần persist + sync native là debounce.
var _gpsSliderSaveTimer = null;
function gpsSliderSaveDebounced(){
  if(_gpsSliderSaveTimer) clearTimeout(_gpsSliderSaveTimer);
  _gpsSliderSaveTimer = setTimeout(function(){
    _gpsSliderSaveTimer = null;
    saveGpsData();
  }, 300);
}
window.gpsSliderSaveDebounced = gpsSliderSaveDebounced;

/** Bật/tắt GPS auto check-in: hiện/ẩn panel cấu hình */
function togGPS(btn){
  const willEnable = !(btn && btn.classList && btn.classList.contains('on'));
  return gpsSetSmartAutoAttendance(willEnable, 'togGPS');
}

/** Yêu cầu quyền GPS — hiển thị hướng dẫn + form nhập thủ công */
function gpsRequestPermission(){
  const permGuide = document.getElementById('gpsPermGuide');
  const manualBox = document.getElementById('gpsManualBox');
  // Kiểm tra xem trình duyệt có hỗ trợ GPS không
  if(!navigator.geolocation){
    if(permGuide) permGuide.style.display = 'block';
    if(manualBox) manualBox.style.display = 'block';
    return;
  }
  // Thử kiểm tra quyền trước (API mới hơn)
  if(navigator.permissions){
    navigator.permissions.query({name:'geolocation'})
      .then(result => {
        if(result.state === 'denied'){
          // Bị từ chối → hiện hướng dẫn + form nhập tay
          if(permGuide) permGuide.style.display = 'block';
          if(manualBox) manualBox.style.display = 'block';
        } else {
          gpsGetCurrentPos();
        }
      })
      .catch(() => gpsGetCurrentPos()); // fallback nếu API permission không hỗ trợ
  } else {
    gpsGetCurrentPos(); // Trực tiếp lấy vị trí
  }
}

/** Toggle hướng dẫn mở server cục bộ */
function gpsShowHostGuide(){
  const g = document.getElementById('gpsHostGuide');
  if(g) g.style.display = g.style.display === 'none' ? 'block' : 'none';
  return false;
}

/** Lưu tọa độ nhập thủ công từ Google Maps */
function gpsSaveManual(){
  const lat = parseFloat(document.getElementById('gpsManualLat')?.value);
  const lng = parseFloat(document.getElementById('gpsManualLng')?.value);
  // Kiểm tra tọa độ hợp lệ
  if(isNaN(lat)||isNaN(lng)||lat<-90||lat>90||lng<-180||lng>180){
    showGpsBanner('Tọa độ không hợp lệ. Kiểm tra lại.','#E8433A');
    return;
  }
  gpsPersistCompanyLocation(lat, lng, parseInt(document.getElementById('gpsRadius')?.value) || 15);
  saveGpsData();
  updateGpsStatus();
  startGeofencing(); // Bắt đầu theo dõi ngay sau khi lưu
  showGpsBanner(u('gps.saved'),'#0D9E75');
  const pg = document.getElementById('gpsPermGuide');
  if(pg) pg.style.display = 'none';
}

/** Lấy vị trí GPS hiện tại 1 lần để lưu làm vị trí công ty */
function gpsGetCurrentPos(){
  const statusTxt = document.getElementById('gpsStatusTxt');
  const statusDot = document.getElementById('gpsStatusDot');
  const permGuide = document.getElementById('gpsPermGuide');
  if(!navigator.geolocation){
    if(statusTxt) statusTxt.textContent = u('gps.no_device');
    if(statusDot) statusDot.style.background = '#E8433A';
    return;
  }
  if(statusTxt) statusTxt.textContent = u('gps.loading');
  if(statusDot) statusDot.style.background = '#F5A623';
  navigator.geolocation.getCurrentPosition(
    pos => {
      // Thành công → lưu vị trí công ty
      gpsPersistCompanyLocation(
        pos.coords.latitude,
        pos.coords.longitude,
        parseInt(document.getElementById('gpsRadius')?.value) || 15
      );
      saveGpsData();
      updateGpsStatus();
      startGeofencing();
      if(permGuide) permGuide.style.display = 'none';
    },
    err => {
      // Thất bại → hiện thông báo lỗi và hướng dẫn
      const msgs = {
        1: u('gps.err_denied'),
        2: u('gps.err_position'),
        3: u('gps.err_timeout')
      };
      if(statusTxt) statusTxt.textContent = msgs[err.code] || u('gps.err_label');
      if(statusDot) statusDot.style.background = '#E8433A';
      if(err.code === 1 && permGuide){
        permGuide.style.display = 'block';
        const mb = document.getElementById('gpsManualBox');
        if(mb) mb.style.display = 'block';
      }
    },
    {enableHighAccuracy: true, timeout: 15000, maximumAge: 0}
  );
}

/** Xóa cài đặt GPS và dừng theo dõi */
function gpsClear(){
  window.__gpsManualOffThisSession = true;
  stopGeofencing();
  _gpsData.lat = null;
  _gpsData.lng = null;
  _gpsData.enabled = false;
  saveGpsData();
  const btn = document.getElementById('togN3');
  if(btn) btn.classList.remove('on');
  notifCfg.n3 = false; saveNotif();
  const card = document.getElementById('gpsSetupCard');
  if(card) card.style.display = 'none';
  updateGpsStatus();
}

/** Cập nhật UI trạng thái GPS (đang trong/ngoài khu vực, tọa độ) */
function updateGpsStatus(){
  const statusTxt = document.getElementById('gpsStatusTxt');
  const statusDot = document.getElementById('gpsStatusDot');
  const coordsBox = document.getElementById('gpsCoordsBox');
  const coordsTxt = document.getElementById('gpsCoordsText');
  if(!statusTxt) return;
  if(_gpsData.lat && _gpsData.lng){
    const inside = _gpsWasInside;
    statusTxt.textContent = inside === true  ? u('gps.in_zone')
                          : inside === false ? u('gps.out_zone')
                          : u('gps.saved');
    statusDot.style.background = inside === true ? '#0D9E75' : inside === false ? '#E8433A' : '#F5A623';
    if(coordsBox) coordsBox.style.display = 'block';
    if(coordsTxt) coordsTxt.innerHTML =
      `Lat: ${_gpsData.lat.toFixed(6)} | Lng: ${_gpsData.lng.toFixed(6)} | R: ${_gpsData.radius}m<br>` +
      u('gps.coords_line', {r:_gpsData.radius, p:_gpsPollMs/1000});
  } else {
    statusTxt.textContent = u('gps.no_setup');
    statusDot.style.background = '#ccc';
    if(coordsBox) coordsBox.style.display = 'none';
  }
}

/** Tính khoảng cách (mét) giữa 2 điểm GPS theo công thức Haversine */
function gpsDistance(lat1, lng1, lat2, lng2){
  const R = 6371000; // Bán kính Trái Đất (mét)
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* showGpsBanner and helpers below */
function showGpsBanner(msg, color){
  let banner = document.getElementById('gpsBanner');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'gpsBanner';
    banner.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);'
      + 'z-index:9999;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:700;'
      + 'font-family:Nunito,sans-serif;color:white;box-shadow:0 4px 20px rgba(0,0,0,.25);'
      + 'transition:opacity .4s;max-width:320px;text-align:center;pointer-events:none';
    document.body.appendChild(banner);
  }
  banner.textContent = msg;
  banner.style.background = color || '#0D9E75';
  banner.style.opacity = '1';
  clearTimeout(banner._timer);
  banner._timer = setTimeout(() => { banner.style.opacity = '0'; }, 4000);
}


/** Render nội dung panel Hướng dẫn theo ngôn ngữ hiện tại */
/* ═══════════════════════════════════════════════════════════════════════
   SUB JOB — JOB PHỤ (thêm mới, backward compatible)
   ═══════════════════════════════════════════════════════════════════════

   DATA MODEL:
     userData.subJob = { active, name, salaryMode, salary, salaryDay, salaryHour }
     attData[k].jobType = 'main' | 'sub' | null   (null = main mặc định)

   📌 ĐỂ CHỈNH SỬA:
     - Màu job phụ trên lịch: CSS class 'sub' trong style.css
     - Logic tính lương phụ: calcSubJobSalary() bên dưới
     - Xuất CSV: doExport() bên dưới
   ═══════════════════════════════════════════════════════════════════════ */

var _exportFilter = 'all'; // 'all' | 'main' | 'sub'
var _dayJobType   = null;  // 'main' | 'sub' | null — jobType cho ngày đang edit

// ── SETUP PANEL: Toggle sub job ─────────────────────────────────────────

/** Bật/tắt job phụ */
function toggleSubJob(){
  const tog   = document.getElementById('togSubJob');
  const knob  = document.getElementById('togSubKnob');
  const fields = document.getElementById('subJobFields');
  if(!tog || !fields) return;
  if(!userData.subJob) userData.subJob = {active:false,name:'',salaryMode:'hour',salary:0,salaryDay:0,salaryHour:0};
  const isOn = !userData.subJob.active;
  userData.subJob.active = isOn;
  // Update toggle visual
  tog.style.background  = isOn ? '#7B5EA7' : '#ccc';
  if(knob) knob.style.left = isOn ? '23px' : '3px';
  fields.style.display = isOn ? 'block' : 'none';
  saveUser();
}

/** Chọn chế độ tính lương job phụ: 'hour' | 'day' | 'month' */
function selSubMode(mode){
  if(!userData.subJob) userData.subJob = {active:false,name:'',salaryMode:'hour',salary:0,salaryDay:0,salaryHour:0};
  userData.subJob.salaryMode = mode;
  ['hour','day','month'].forEach(m => {
    const btn = document.getElementById(`subMode${m.charAt(0).toUpperCase()+m.slice(1)}`);
    if(!btn) return;
    const active = m === mode;
    btn.style.background  = active ? '#7B5EA7' : 'white';
    btn.style.color       = active ? 'white'   : '#7B5EA7';
    btn.style.borderColor = active ? '#7B5EA7' : '#c8b4f0';
  });
  const hint = document.getElementById('setupSubSalaryHint');
  const L = userData.lang || 'vi';
  const hints = {
    hour: {vi:'Nhập lương theo giờ — tự tính theo số giờ làm thực tế', en:'Enter hourly rate — auto calculated from actual hours', ko:'시간급 입력 — 실제 근무시간 기준 자동 계산', ja:'時給を入力 — 実働時間で自動計算', zh:'输入时薪 — 按实际工时自动计算', my:'နာရီလစာ — အမှန်တကယ်နာရီအလိုက် တွက်ချက်', th:'ใส่ค่าจ้างต่อชั่วโมง — คำนวณตามชั่วโมงจริง', id:'Masukkan tarif per jam — dihitung dari jam aktual', ph:'Ilagay ang hourly rate — awtomatikong kokompyutin', ne:'घण्टाको दर राख्नुहोस् — वास्तविक घण्टाबाट गणना', hi:'प्रति घंटा दर डालें — वास्तविक घंटों से गणना'},
    day:  {vi:'Nhập lương theo ngày công thực tế', en:'Enter daily rate', ko:'실제 근무일 기준 일급 입력', ja:'実勤務日数に基づく日給を入力', zh:'输入实际工作日的日薪', my:'အမှန်တကယ်အလုပ်ရက်အလိုက် နေ့စားလစာ ထည့်ပါ', th:'ใส่ค่าจ้างรายวันตามวันทำงานจริง', id:'Masukkan upah harian berdasarkan hari kerja aktual', ph:'Ilagay ang daily rate batay sa araw na nagtrabaho', ne:'वास्तविक काम दिन अनुसार दैनिक दर राख्नुहोस्', hi:'वास्तविक कार्य दिवस के अनुसार दैनिक दर डालें'},
    month:{vi:'Nhập lương tháng cố định cho job này', en:'Enter fixed monthly salary for this job', ko:'이 작업의 고정 월급 입력', ja:'この仕事の固定月給を入力', zh:'输入此工作的固定月薪', my:'ဤအလုပ်အတွက် လစဉ်လစာ ထည့်ပါ', th:'ใส่เงินเดือนคงที่ของงานนี้', id:'Masukkan gaji bulanan tetap untuk pekerjaan ini', ph:'Ilagay ang fixed monthly salary ng trabahong ito', ne:'यो कामको स्थिर मासिक तलब राख्नुहोस्', hi:'इस नौकरी का निश्चित मासिक वेतन डालें'},
  };
  if(hint) hint.textContent = (hints[mode]||hints.hour)[L] || hints[mode].en;
  saveUser();
}

/** Render Setup sub job fields từ userData.subJob */
function renderSetupSubJob(){
  const sj = userData.subJob || {};
  const tog  = document.getElementById('togSubJob');
  const knob = document.getElementById('togSubKnob');
  const fields = document.getElementById('subJobFields');
  if(!tog || !fields) return;
  const isOn = !!sj.active;
  // Sync toggle visual
  tog.style.background = isOn ? '#7B5EA7' : '#ccc';
  if(knob) knob.style.left = isOn ? '23px' : '3px';
  fields.style.display = isOn ? 'block' : 'none';
  // Fill fields
  const nameEl = document.getElementById('setupSubJob');
  if(nameEl) nameEl.value = sj.name || '';
  const salEl = document.getElementById('setupSubSalary');
  if(salEl){
    const mode = sj.salaryMode || 'hour';
    salEl.value = mode==='hour' ? (sj.salaryHour||'') : mode==='day' ? (sj.salaryDay||'') : (sj.salary||'');
  }
  selSubMode(sj.salaryMode || 'hour');
}

// ── SAVE SETUP: lưu sub job fields ──────────────────────────────────────

/** Gọi sau saveSetup() để lưu thêm sub job data */
function saveSubJob(){
  if(!userData.subJob) userData.subJob = {active:false,name:'',salaryMode:'hour',salary:0,salaryDay:0,salaryHour:0};
  const nameEl = document.getElementById('setupSubJob');
  const salEl  = document.getElementById('setupSubSalary');
  if(nameEl) userData.subJob.name = nameEl.value.trim();
  if(salEl){
    const val = parseFloat(salEl.value) || 0;
    const mode = userData.subJob.salaryMode || 'hour';
    if(mode === 'hour')       userData.subJob.salaryHour = val;
    else if(mode === 'day')   userData.subJob.salaryDay  = val;
    else                      userData.subJob.salary      = val;
  }
  saveUser();
}

// ── DAY DETAIL PANEL: jobType selector ──────────────────────────────────

/** Chọn jobType trong Day detail panel */
function selDayJobType(type){
  _dayJobType = type;
  const btnMain = document.getElementById('dayJobMain');
  const btnSub  = document.getElementById('dayJobSub');
  if(!btnMain || !btnSub) return;
  const isMain = type === 'main';
  // Main = màu xanh theme
  btnMain.style.background   = isMain ? 'var(--ac)' : 'white';
  btnMain.style.color        = isMain ? 'white' : 'var(--text2)';
  btnMain.style.borderColor  = isMain ? 'var(--ac)' : 'var(--border)';
  // Sub = màu tím
  btnSub.style.background    = !isMain ? '#7B5EA7' : 'white';
  btnSub.style.color         = !isMain ? 'white' : '#7B5EA7';
  btnSub.style.borderColor   = !isMain ? '#7B5EA7' : '#c8b4f0';
}

/** Hiển thị/ẩn jobType selector khi mở Day panel */
function updateDayJobTypeUI(rec){
  const row = document.getElementById('dayJobTypeRow');
  if(!row) return;
  const hasSub = userData.subJob && userData.subJob.active;
  row.style.display = hasSub ? 'block' : 'none';
  if(!hasSub) return;

  // Update sub job name label
  const nameLbl = document.getElementById('daySubJobName');
  if(nameLbl) nameLbl.textContent = '💼 ' + (userData.subJob.name || u('job.sub'));

  // Check if this day has sub data
  const hasDaySub = rec && rec.sub && rec.sub.in;
  const tog  = document.getElementById('togDaySub');
  const knob = document.getElementById('togDaySubKnob');
  const fields = document.getElementById('daySubFields');

  if(hasDaySub){
    // Sub data exists → show toggle ON + fill times
    if(tog) tog.style.background = '#7B5EA7';
    if(knob) knob.style.left = '21px';
    if(fields) fields.style.display = 'block';
    const inEl  = document.getElementById('daySubTimeIn');
    const outEl = document.getElementById('daySubTimeOut');
    if(inEl)  inEl.value  = rec.sub.in  || '';
    if(outEl) outEl.value = rec.sub.out || '';
  } else {
    // No sub data → toggle OFF
    if(tog) tog.style.background = '#ccc';
    if(knob) knob.style.left = '3px';
    if(fields) fields.style.display = 'none';
    const inEl  = document.getElementById('daySubTimeIn');
    const outEl = document.getElementById('daySubTimeOut');
    if(inEl)  inEl.value  = '';
    if(outEl) outEl.value = '';
  }
}

/** Toggle sub job fields trong day panel */
function toggleDaySub(){
  const tog    = document.getElementById('togDaySub');
  const knob   = document.getElementById('togDaySubKnob');
  const fields = document.getElementById('daySubFields');
  if(!tog || !fields) return;
  const isShowing = fields.style.display !== 'none';
  const nowOn = !isShowing;
  tog.style.background = nowOn ? '#7B5EA7' : '#ccc';
  if(knob) knob.style.left = nowOn ? '21px' : '3px';
  fields.style.display = nowOn ? 'block' : 'none';
}


// ── CALENDAR: hiển thị jobType trên lịch ────────────────────────────────

/** Trả về sub-label cho ô lịch nếu là job phụ */
function getJobTypeBadge(rec){
  if(!rec || !rec.jobType || rec.jobType === 'main') return '';
  if(!(userData.subJob && userData.subJob.active)) return '';
  const name = userData.subJob.name || u('job.sub');
  return `<div style="font-size:8px;background:#7B5EA7;color:white;border-radius:3px;padding:1px 3px;margin-top:1px;line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>`;
}

// ── SALARY: tính lương job phụ ────────────────────────────────────────────

/** Tính lương job phụ — đọc từ attData[k].sub */
function calcSubJobSalary(){
  const sj = userData.subJob;
  if(!sj || !sj.active) return { gross:0, net:0, days:0, hours:0 };
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const nd = new Date(y, m+1, 0).getDate();
  const ngc = userData.ngc || 26;
  const gioCA = userData.hoursPerShift || 8;

  let subDays = 0, subHours = 0;
  for(let d = 1; d <= nd; d++){
    const rec = getAttRecordByDateParts(y,m,d);
    if(!rec || !rec.sub || !rec.sub.in) continue;
    subDays++;
    if(rec.sub.in && rec.sub.out){
      subHours += ((timeToMin(rec.sub.out) - timeToMin(rec.sub.in) + 1440) % 1440) / 60;
    } else {
      subHours += gioCA;
    }
  }

  const mode = sj.salaryMode || 'hour';
  let gross = 0;
  if(mode === 'hour')       gross = (sj.salaryHour || 0) * subHours;
  else if(mode === 'day')   gross = (sj.salaryDay  || 0) * subDays;
  else                      gross = subDays > 0 ? ((sj.salary || 0) * subDays / ngc) : 0;

  return { gross: Math.round(gross), net: Math.round(gross), days: subDays, hours: Math.round(subHours*10)/10 };
}

/** Render sub job salary section vào cuối salary panel */
function renderSubJobSalary(){
  const sj = userData.subJob;
  const el = document.getElementById('subJobSalaryBlock');
  if(!el) return;
  if(!sj || !sj.active){ el.style.display='none'; return; }
  el.style.display = 'block';
  const result = calcSubJobSalary();
  const fmtN = n => fmtMoney(n, langCfg.payrollCountry||'VN');
  el.innerHTML = `
    <div style="font-size:12px;font-weight:800;color:#7B5EA7;margin-bottom:8px">
      💼 ${sj.name} <span style="font-weight:400;color:#999;font-size:11px">(${u('job.sub')})</span>
    </div>
    <div style="font-size:13px;color:var(--text);line-height:2">
      ${u('salary.present')}: <strong>${result.days}</strong> ${u('salary.days')} · ${result.hours}h<br>
      Gross: <strong style="color:#7B5EA7">${fmtN(result.gross)}</strong>
    </div>
    <div style="margin-top:10px;padding:12px 14px;background:linear-gradient(135deg,#7B5EA7,#5a3e8e);border-radius:12px;color:white">
      <div style="font-size:12px;font-weight:800;margin-bottom:8px">${u('setup.sub_total')}</div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
        <span>${u('job.main')}</span><span id="_subMain">—</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:8px">
        <span>${sj.name}</span><span>${fmtN(result.net)}</span>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,.3);padding-top:8px;display:flex;justify-content:space-between;font-size:16px;font-weight:900">
        <span>Tổng</span><span id="_subTotal">—</span>
      </div>
    </div>`;
  const mainNetEl = document.getElementById('salaryNet');
  const mainNum = parseFloat((mainNetEl?.textContent||'').replace(/[^\d.-]/g,''))||0;
  const mainFmt = mainNetEl?.textContent||'0';
  const m1 = el.querySelector('#_subMain');
  const m2 = el.querySelector('#_subTotal');
  if(m1) m1.textContent = mainFmt;
  if(m2) m2.textContent = fmtN(mainNum + result.net);
}
function selExportFilter(filter){
  _exportFilter = filter;
  ['all','main','sub'].forEach(f => {
    const btn = document.getElementById(`ef${f.charAt(0).toUpperCase()+f.slice(1)}`);
    if(!btn) return;
    const active = f === filter;
    btn.style.background  = active ? 'var(--ac)' : 'var(--card)';
    btn.style.color       = active ? 'white' : 'var(--text2)';
    btn.style.borderColor = active ? 'var(--ac)' : 'var(--border)';
  });
}

/** Hiển thị/ẩn export filter row + set default filename */
function updateExcelPanel(){
  const filterRow = document.getElementById('excelFilterRow');
  const filenameEl = document.getElementById('excelFilename');
  const hasSub = userData.subJob && userData.subJob.active;
  if(filterRow) filterRow.style.display = hasSub ? 'block' : 'none';
  if(!hasSub) _exportFilter = 'all';
  // Set default filename
  if(filenameEl && (!filenameEl.value || /^ChamCong_/i.test(filenameEl.value))){
    filenameEl.value = 'ChamCong';
  }
}

// ── Patch doExport to support filter + jobType column + custom filename ────

var _doExport_original = doExport;
doExport = function(){
  const {y,m} = calView;
  const nd = new Date(y, m+1, 0).getDate();
  const _t3 = getLang();
  const L = userData.lang || 'vi';
  const hasSub = userData.subJob && userData.subJob.active;

  const STATUS = {cm:_t3.coMat||'Có mặt',vang:_t3.vang||'Vắng',np:_t3.nghiPhep||'Nghỉ phép',ll:legacyHolidayLabel(_t3)};

  // CSV header — thêm cột Job nếu có sub job
  const jobColHdr = hasSub ? (','+u('job.main')+'/'+u('job.sub')) : '';
  const _csvHdr = {
    vi:'Ngày,Thứ,Trạng thái,Giờ vào,Giờ ra,Số giờ,Vị trí GPS',
    en:'Date,Day,Status,In,Out,Hours,GPS Location',
    ko:'날짜,요일,상태,출근,퇴근,시간,GPS 위치',
    ja:'日付,曜日,状態,出勤,退勤,時間,GPS位置',
    zh:'日期,星期,状态,上班,下班,时长,GPS位置',
    my:'ရက်,နေ့,အခြေ,တက်,ဆင်,ချိန်,GPS တည်နေရာ',
    th:'วันที่,วัน,สถานะ,เข้า,ออก,ชั่วโมง,GPS',
    id:'Tanggal,Hari,Status,Masuk,Keluar,Jam,GPS',
    ph:'Petsa,Araw,Katayuan,Pasok,Labas,Oras,GPS',
    ne:'मिति,बार,अवस्था,प्रवेश,निस्किने,घण्टा,GPS',
    hi:'तारीख,दिन,स्थिति,प्रवेश,प्रस्थान,घंटे,GPS'
  }[L] || 'Ngày,Thứ,Trạng thái,Giờ vào,Giờ ra,Số giờ,Vị trí GPS';

  let csv = _csvHdr + jobColHdr + '\n';

  const gpsCoord = (_gpsData && _gpsData.lat && _gpsData.lng)
    ? `${_gpsData.lat.toFixed(6)}, ${_gpsData.lng.toFixed(6)}` : '';

  for(let g = 1; g <= nd; g++){
    const k = dateKeyFromParts(y,m,g);
    const rec = attData[k];

    // Filter theo jobType
    if(_exportFilter !== 'all'){
      const recType = rec ? (rec.jobType || 'main') : null;
      if(!rec || recType !== _exportFilter) continue; // bỏ qua ngày không khớp
    }

    const thu  = DAYS[new Date(y, m, g).getDay()];
    const lbl  = rec ? STATUS[rec.type] || '' : '';
    const ins  = rec?.in  || '';
    const outs = rec?.out || '';
    let dur = '';
    if(ins && outs) dur = (((timeToMin(outs) - timeToMin(ins) + 1440) % 1440) / 60).toFixed(1);
    const loc = (ins || outs) ? `"${gpsCoord}"` : '';

    // Cột job type
    const jobCell = hasSub ? (','+((rec?.jobType === 'sub') ? (userData.subJob.name||u('job.sub')) : u('job.main'))) : '';

    csv += `${g}/${m+1}/${y},${thu},${lbl},${ins},${outs},${dur},${loc}${jobCell}\n`;
  }

  const blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;

  // Custom filename
  const filenameEl = document.getElementById('excelFilename');
  const rawName = filenameEl?.value.trim() || 'ChamCong';
  // Sanitize filename
  a.download = rawName.replace(/[\\/:*?"<>|]/g,'_') + '.csv';

  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  closePanel('panelExcel');
};



/* PATCH v2.2.1 — JOB PHỤ GPS + EXPORT PDF */
(function(){
  function escHtml(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function ensureGpsV221(){
    if(typeof _gpsData==='undefined') return;
    if(typeof gpsRepairLocationPersistence==='function'){gpsRepairLocationPersistence(); return;}
    // Lưu radius hiện tại (đã được user set trước đó) — KHÔNG để bị reset bởi loc.radius
    var savedRadius = (_gpsData.radius && _gpsData.radius > 0) ? _gpsData.radius : 15;
    if(!_gpsData.locations){_gpsData.locations={main:{lat:_gpsData.lat||null,lng:_gpsData.lng||null,radius:savedRadius},sub:{lat:null,lng:null,radius:savedRadius}};}
    if(!_gpsData.locations.main) _gpsData.locations.main={lat:_gpsData.lat||null,lng:_gpsData.lng||null,radius:savedRadius};
    if(!_gpsData.locations.sub) _gpsData.locations.sub={lat:null,lng:null,radius:savedRadius};
    if(!_gpsData.activeJob) _gpsData.activeJob='main';
    var loc=_gpsData.locations[_gpsData.activeJob]||_gpsData.locations.main;
    _gpsData.lat=loc.lat||null; _gpsData.lng=loc.lng||null;
    // QUAN TRỌNG: Chỉ dùng loc.radius nếu nó đã được set; ngược lại giữ savedRadius
    _gpsData.radius = (loc.radius && loc.radius > 0) ? loc.radius : savedRadius;
  }
  window.ensureGpsV221=ensureGpsV221;
  function activeGpsLoc(){ensureGpsV221();if(typeof gpsGetStoredCompanyLocation==='function')return gpsGetStoredCompanyLocation(_gpsData.activeJob||'main')||_gpsData.locations.main;return _gpsData.locations[_gpsData.activeJob||'main']||_gpsData.locations.main;}
  function gps221Pack(){
    var L=(window.userData&&userData.lang)||'vi';
    var packs={
      vi:{target:'🎯 GPS ÁP DỤNG CHO JOB',main:'Job chính',sub:'Job phụ',saved:'Đã lưu',notSaved:'Chưa lưu',hint:'Chọn job rồi bấm “Lấy vị trí hiện tại” để lưu GPS riêng cho job đó.',locating:'⏳ Đang lấy vị trí cho {job}...',savedFor:'✅ Đã lưu GPS cho {job}',denied:'GPS bị từ chối. Hãy bật quyền vị trí.',unavailable:'Không xác định được vị trí. Thử ở nơi thoáng hơn.',timeout:'Hết thời gian. Thử lại.',error:'Lỗi GPS: ',subGps:'Job phụ GPS',autoIn:'✅ GPS đã chấm vào Job phụ lúc {time}',autoOut:'✅ GPS đã chấm hết Job phụ lúc {time}',abort:'GPS chưa xác nhận rời vùng đủ chắc chắn - bỏ qua ra ca Job phụ',fileFormat:'ĐỊNH DẠNG FILE',csv:'📊 Xuất file Excel (.csv)',pdf:'📄 Xuất file PDF'},
      en:{target:'🎯 GPS TARGET JOB',main:'Main job',sub:'Sub job',saved:'Saved',notSaved:'Not saved',hint:'Select a job, then press “Get current location” to save GPS separately for that job.',locating:'⏳ Getting location for {job}...',savedFor:'✅ GPS saved for {job}',denied:'GPS permission was denied. Please enable location permission.',unavailable:'Could not determine location. Try again in a more open area.',timeout:'Timed out. Please try again.',error:'GPS error: ',subGps:'Sub job GPS',autoIn:'✅ GPS checked in sub job at {time}',autoOut:'✅ GPS checked out sub job at {time}',abort:'GPS has not confirmed leaving the area reliably - skipping sub job checkout',fileFormat:'FILE FORMAT',csv:'📊 Export Excel CSV',pdf:'📄 Export PDF'},
      ko:{target:'🎯 GPS 적용 작업',main:'주업',sub:'부업',saved:'저장됨',notSaved:'미저장',hint:'작업을 선택한 뒤 “현재 위치 가져오기”를 눌러 작업별 GPS를 저장하세요.',locating:'⏳ {job} 위치를 가져오는 중...',savedFor:'✅ {job} GPS 저장됨',denied:'GPS 권한이 거부되었습니다. 위치 권한을 켜세요.',unavailable:'위치를 확인할 수 없습니다. 더 트인 곳에서 다시 시도하세요.',timeout:'시간이 초과되었습니다. 다시 시도하세요.',error:'GPS 오류: ',subGps:'부업 GPS',autoIn:'✅ GPS가 {time}에 부업 출근을 기록했습니다',autoOut:'✅ GPS가 {time}에 부업 퇴근을 기록했습니다',abort:'GPS가 영역 이탈을 충분히 확인하지 못해 부업 퇴근을 건너뜁니다',fileFormat:'파일 형식',csv:'📊 Excel CSV 내보내기',pdf:'📄 PDF 내보내기'},
      ja:{target:'🎯 GPS適用ジョブ',main:'本業',sub:'副業',saved:'保存済み',notSaved:'未保存',hint:'ジョブを選択し「現在地を取得」でジョブ別GPSを保存します。',locating:'⏳ {job} の位置を取得中...',savedFor:'✅ {job} のGPSを保存しました',denied:'GPSが拒否されました。位置情報の権限を有効にしてください。',unavailable:'位置を特定できません。開けた場所で再試行してください。',timeout:'タイムアウトしました。もう一度お試しください。',error:'GPSエラー: ',subGps:'副業GPS',autoIn:'✅ GPSが{time}に副業の出勤を記録しました',autoOut:'✅ GPSが{time}に副業の退勤を記録しました',abort:'GPSがエリア離脱を十分確認できないため、副業の退勤をスキップします',fileFormat:'ファイル形式',csv:'📊 Excel CSV出力',pdf:'📄 PDF出力'},
      zh:{target:'🎯 GPS适用工作',main:'主业',sub:'副业',saved:'已保存',notSaved:'未保存',hint:'选择工作后点击“获取当前位置”分别保存GPS。',locating:'⏳ 正在获取 {job} 的位置...',savedFor:'✅ 已保存 {job} 的GPS',denied:'GPS权限被拒绝。请开启位置权限。',unavailable:'无法确定位置。请在开阔处重试。',timeout:'已超时。请重试。',error:'GPS错误: ',subGps:'副业GPS',autoIn:'✅ GPS已在{time}记录副业上班',autoOut:'✅ GPS已在{time}记录副业下班',abort:'GPS尚未可靠确认离开区域，跳过副业下班打卡',fileFormat:'文件格式',csv:'📊 导出 Excel CSV',pdf:'📄 导出 PDF'},
      my:{target:'🎯 GPS အလုပ်',main:'အဓိကအလုပ်',sub:'ဘေးအလုပ်',saved:'သိမ်းပြီး',notSaved:'မသိမ်းရသေး',hint:'အလုပ်ရွေးပြီး “လက်ရှိနေရာ” ကိုနှိပ်ကာ အလုပ်အလိုက် GPS သိမ်းပါ။',locating:'⏳ {job} အတွက် နေရာရယူနေသည်...',savedFor:'✅ {job} အတွက် GPS သိမ်းပြီး',denied:'GPS ခွင့်ပြုချက် ငြင်းထားသည်။ Location permission ကိုဖွင့်ပါ။',unavailable:'နေရာ မသတ်မှတ်နိုင်ပါ။ ပိုကျယ်သောနေရာတွင် ထပ်စမ်းပါ။',timeout:'အချိန်ကုန်သွားသည်။ ထပ်စမ်းပါ။',error:'GPS အမှား: ',subGps:'ဘေးအလုပ် GPS',autoIn:'✅ GPS သည် {time} တွင် ဘေးအလုပ် တက်ချိန် မှတ်ပြီး',autoOut:'✅ GPS သည် {time} တွင် ဘေးအလုပ် ဆင်းချိန် မှတ်ပြီး',abort:'GPS သည် ဧရိယာမှ ထွက်ခြင်းကို မသေချာသေးသဖြင့် ဘေးအလုပ် ဆင်းချိန်ကို ကျော်ထားသည်',fileFormat:'ဖိုင်ပုံစံ',csv:'📊 Excel CSV ထုတ်',pdf:'📄 PDF ထုတ်'},
      th:{target:'🎯 งานที่ใช้ GPS',main:'งานหลัก',sub:'งานเสริม',saved:'บันทึกแล้ว',notSaved:'ยังไม่บันทึก',hint:'เลือกงาน แล้วกด “รับตำแหน่งปัจจุบัน” เพื่อบันทึก GPS แยกตามงาน',locating:'⏳ กำลังรับตำแหน่งสำหรับ {job}...',savedFor:'✅ บันทึก GPS สำหรับ {job} แล้ว',denied:'GPS ถูกปฏิเสธ โปรดเปิดสิทธิ์ตำแหน่ง',unavailable:'ระบุตำแหน่งไม่ได้ ลองในพื้นที่เปิดกว่าเดิม',timeout:'หมดเวลา โปรดลองอีกครั้ง',error:'ข้อผิดพลาด GPS: ',subGps:'GPS งานเสริม',autoIn:'✅ GPS บันทึกเข้างานเสริมเวลา {time}',autoOut:'✅ GPS บันทึกออกงานเสริมเวลา {time}',abort:'GPS ยังยืนยันการออกจากพื้นที่ไม่ชัดเจน จึงข้ามการออกงานเสริม',fileFormat:'รูปแบบไฟล์',csv:'📊 ส่งออก Excel CSV',pdf:'📄 ส่งออก PDF'},
      id:{target:'🎯 PEKERJAAN TARGET GPS',main:'Pekerjaan utama',sub:'Pekerjaan sampingan',saved:'Tersimpan',notSaved:'Belum disimpan',hint:'Pilih pekerjaan, lalu tekan “Lokasi saat ini” untuk menyimpan GPS terpisah.',locating:'⏳ Mengambil lokasi untuk {job}...',savedFor:'✅ GPS tersimpan untuk {job}',denied:'GPS ditolak. Aktifkan izin lokasi.',unavailable:'Lokasi tidak dapat ditentukan. Coba di area lebih terbuka.',timeout:'Waktu habis. Coba lagi.',error:'Kesalahan GPS: ',subGps:'GPS pekerjaan sampingan',autoIn:'✅ GPS mencatat masuk pekerjaan sampingan pada {time}',autoOut:'✅ GPS mencatat keluar pekerjaan sampingan pada {time}',abort:'GPS belum memastikan keluar area, absen keluar pekerjaan sampingan dilewati',fileFormat:'FORMAT FILE',csv:'📊 Ekspor Excel CSV',pdf:'📄 Ekspor PDF'},
      ph:{target:'🎯 TRABAHONG NA-TARGET NG GPS',main:'Pangunahing trabaho',sub:'Sideline',saved:'Nai-save na',notSaved:'Hindi pa naka-save',hint:'Pumili ng trabaho, pindutin ang “Kunin ang kasalukuyang lokasyon” para i-save ang GPS.',locating:'⏳ Kinukuha ang lokasyon para sa {job}...',savedFor:'✅ Na-save ang GPS para sa {job}',denied:'Tinanggihan ang GPS. I-on ang location permission.',unavailable:'Hindi matukoy ang lokasyon. Subukan sa mas bukas na lugar.',timeout:'Nag-time out. Subukan muli.',error:'GPS error: ',subGps:'GPS ng sideline',autoIn:'✅ Naitala ng GPS ang pasok sa sideline nang {time}',autoOut:'✅ Naitala ng GPS ang labas sa sideline nang {time}',abort:'Hindi pa kumpirmado ng GPS na lumabas sa area - nilaktawan ang out ng sideline',fileFormat:'FORMAT NG FILE',csv:'📊 I-export ang Excel CSV',pdf:'📄 I-export ang PDF'},
      ne:{target:'🎯 GPS लक्षित काम',main:'मुख्य काम',sub:'सहायक काम',saved:'सुरक्षित',notSaved:'सुरक्षित छैन',hint:'काम छान्नुहोस्, “हालको स्थान” थिचेर GPS छुट्टै सुरक्षित गर्नुहोस्।',locating:'⏳ {job} को स्थान लिँदै...',savedFor:'✅ {job} का लागि GPS सुरक्षित भयो',denied:'GPS अस्वीकृत भयो। स्थान अनुमति खोल्नुहोस्।',unavailable:'स्थान पत्ता लागेन। खुला ठाउँमा फेरि प्रयास गर्नुहोस्।',timeout:'समय सकियो। फेरि प्रयास गर्नुहोस्।',error:'GPS त्रुटि: ',subGps:'सहायक काम GPS',autoIn:'✅ GPS ले {time} मा सहायक काम प्रवेश रेकर्ड गर्‍यो',autoOut:'✅ GPS ले {time} मा सहायक काम बाहिर रेकर्ड गर्‍यो',abort:'GPS ले क्षेत्र छोडेको पर्याप्त पुष्टि गरेन - सहायक काम बाहिर छोडियो',fileFormat:'फाइल ढाँचा',csv:'📊 Excel CSV निर्यात',pdf:'📄 PDF निर्यात'},
      hi:{target:'🎯 GPS लक्ष्य कार्य',main:'मुख्य नौकरी',sub:'अतिरिक्त नौकरी',saved:'सहेजा गया',notSaved:'सहेजा नहीं',hint:'कार्य चुनें, फिर “वर्तमान स्थान” दबाकर GPS अलग से सहेजें।',locating:'⏳ {job} के लिए स्थान मिल रहा है...',savedFor:'✅ {job} के लिए GPS सहेजा गया',denied:'GPS अस्वीकार हुआ। स्थान अनुमति चालू करें।',unavailable:'स्थान निर्धारित नहीं हो सका। खुले स्थान में फिर प्रयास करें।',timeout:'समय समाप्त। फिर प्रयास करें।',error:'GPS त्रुटि: ',subGps:'अतिरिक्त नौकरी GPS',autoIn:'✅ GPS ने {time} पर अतिरिक्त नौकरी प्रवेश दर्ज किया',autoOut:'✅ GPS ने {time} पर अतिरिक्त नौकरी प्रस्थान दर्ज किया',abort:'GPS ने क्षेत्र छोड़ना पर्याप्त रूप से पुष्टि नहीं किया - अतिरिक्त नौकरी प्रस्थान छोड़ा गया',fileFormat:'फ़ाइल प्रारूप',csv:'📊 Excel CSV निर्यात',pdf:'📄 PDF निर्यात'}
    };
    return packs[L]||packs.en||packs.vi;
  }
  function gps221Tpl(key, vars){
    var txt=(gps221Pack()[key]||'');
    vars=vars||{};
    Object.keys(vars).forEach(function(k){txt=txt.replace(new RegExp('\\{'+k+'\\}','g'),vars[k]);});
    return txt;
  }
  function gps221JobName(job){
    try{if(typeof u==='function')return u(job==='sub'?'job.sub':'job.main');}catch(e){}
    var p=gps221Pack();
    return job==='sub'?p.sub:p.main;
  }
  window.setActiveGpsJob=function(job){
    ensureGpsV221(); if(job!=='sub') job='main'; _gpsData.activeJob=job;
    var savedRadius = (_gpsData.radius && _gpsData.radius > 0) ? _gpsData.radius : 15;
    var loc=activeGpsLoc(); _gpsData.lat=loc.lat||null; _gpsData.lng=loc.lng||null;
    _gpsData.radius = (loc.radius && loc.radius > 0) ? loc.radius : savedRadius;
    if(typeof saveGpsData==='function') saveGpsData();
    if(typeof syncGpsSliders==='function') syncGpsSliders();
    if(typeof updateGpsStatus==='function') updateGpsStatus();
    renderGpsJobSwitch();
    if(_gpsData.enabled){ if(typeof stopGeofencing==='function') stopGeofencing(); if(_gpsData.lat && typeof startGeofencing==='function') startGeofencing(); }
  };
  function renderGpsJobSwitch(){
    ensureGpsV221(); var card=document.getElementById('gpsSetupCard'); if(!card) return;
    var box=document.getElementById('gpsJobSwitchBox');
    if(!box){box=document.createElement('div');box.id='gpsJobSwitchBox';box.style.cssText='background:#F4F7F6;border-radius:14px;padding:12px;margin-bottom:12px;border:1px solid var(--border)';card.insertBefore(box,card.firstChild);}
    var hasSub=!!(window.userData&&userData.subJob&&userData.subJob.active);
    var p=gps221Pack();
    var subName=(hasSub&&userData.subJob.name)?userData.subJob.name:gps221JobName('sub');
    var mainName=gps221JobName('main');
    var mainOn=(_gpsData.activeJob||'main')==='main', subOn=(_gpsData.activeJob||'main')==='sub';
    var mainLoc=_gpsData.locations.main||{}, subLoc=_gpsData.locations.sub||{};
    box.innerHTML='<div style="font-size:12px;font-weight:900;color:var(--text2);margin-bottom:8px">'+escHtml(p.target)+'</div><div style="display:flex;gap:8px;margin-bottom:8px"><button onclick="setActiveGpsJob(\'main\')" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid '+(mainOn?'var(--ac)':'var(--border)')+';background:'+(mainOn?'var(--ac)':'white')+';color:'+(mainOn?'white':'var(--text2)')+';font-size:12px;font-weight:900;font-family:Nunito,sans-serif">🏢 '+escHtml(mainName)+'</button><button onclick="setActiveGpsJob(\'sub\')" '+(!hasSub?'disabled':'')+' style="flex:1;padding:10px;border-radius:10px;border:1.5px solid '+(subOn?'#7B5EA7':'var(--border)')+';background:'+(subOn?'#7B5EA7':'white')+';color:'+(subOn?'white':'var(--text2)')+';opacity:'+(!hasSub?'.45':'1')+';font-size:12px;font-weight:900;font-family:Nunito,sans-serif">💼 '+escHtml(subName)+'</button></div><div style="font-size:11px;color:var(--text3);line-height:1.45">🏢 '+(mainLoc.lat?escHtml(p.saved):escHtml(p.notSaved))+' · 💼 '+(subLoc.lat?escHtml(p.saved):escHtml(p.notSaved))+'<br>'+escHtml(p.hint)+'</div>';
  }
  window.renderGpsJobSwitch=renderGpsJobSwitch;
  var oldOpenPanelGPS=window.openPanelGPS; window.openPanelGPS=function(){ensureGpsV221(); if(typeof oldOpenPanelGPS==='function') oldOpenPanelGPS(); setTimeout(renderGpsJobSwitch,120);};
  var oldGpsGetCurrentPos=window.gpsGetCurrentPos;
  window.gpsGetCurrentPos=function(){
    ensureGpsV221(); var statusTxt=document.getElementById('gpsStatusTxt'), statusDot=document.getElementById('gpsStatusDot'), permGuide=document.getElementById('gpsPermGuide');
    if(typeof gpsCurrentPosition!=='function'){return oldGpsGetCurrentPos&&oldGpsGetCurrentPos();}
    if(statusTxt) statusTxt.textContent=gps221Tpl('locating',{job:gps221JobName(_gpsData.activeJob==='sub'?'sub':'main')}); if(statusDot) statusDot.style.background='#F5A623';
    gpsCurrentPosition(function(pos){
      var job=_gpsData.activeJob||'main'; if(typeof gpsPersistCompanyLocation==='function')gpsPersistCompanyLocation(pos.coords.latitude,pos.coords.longitude,parseInt(document.getElementById('gpsRadius')?.value)||(_gpsData.radius||15),job);else{_gpsData.locations[job]={lat:pos.coords.latitude,lng:pos.coords.longitude,radius:parseInt(document.getElementById('gpsRadius')?.value)||(_gpsData.radius||15)};var loc=_gpsData.locations[job]; _gpsData.lat=loc.lat; _gpsData.lng=loc.lng; _gpsData.radius=loc.radius;}
      if(typeof saveGpsData==='function') saveGpsData(); if(typeof updateGpsStatus==='function') updateGpsStatus(); renderGpsJobSwitch(); if(typeof startGeofencing==='function') startGeofencing(); if(permGuide) permGuide.style.display='none'; if(typeof showGpsBanner==='function') showGpsBanner(gps221Tpl('savedFor',{job:gps221JobName(job)}),'#0D9E75');
    },function(err){var msgs={1:gps221Tpl('denied'),2:gps221Tpl('unavailable'),3:gps221Tpl('timeout')}; if(statusTxt) statusTxt.textContent=msgs[err.code]||(gps221Tpl('error')+(err.message||'')); if(statusDot) statusDot.style.background='#E8433A'; if(permGuide) permGuide.style.display='block';});
  };
  var oldGpsClear=window.gpsClear; window.gpsClear=function(){ensureGpsV221(); var job=_gpsData.activeJob||'main'; _gpsData.locations[job]={lat:null,lng:null,radius:_gpsData.radius||15}; _gpsData.lat=null; _gpsData.lng=null; var loc=(typeof gpsGetStoredCompanyLocation==='function')?gpsGetStoredCompanyLocation(job):activeGpsLoc(); if(loc&&loc.lat!=null&&loc.lng!=null){_gpsData.lat=loc.lat; _gpsData.lng=loc.lng; _gpsData.radius=loc.radius||15;} if(!_gpsData.locations.main.lat&&!_gpsData.locations.sub.lat){if(typeof oldGpsClear==='function') oldGpsClear();}else{if(typeof saveGpsData==='function') saveGpsData(); if(typeof stopGeofencing==='function') stopGeofencing(); if(_gpsData.enabled&&_gpsData.lat&&typeof startGeofencing==='function') startGeofencing(); if(typeof updateGpsStatus==='function') updateGpsStatus(); renderGpsJobSwitch();}};
  function getPosPromise(){return new Promise(function(resolve){if(typeof gpsCurrentPosition!=='function')return resolve(null);gpsCurrentPosition(function(pos){resolve(pos);},function(){resolve(null);});});}
  function distFromJob(job,pos){ensureGpsV221(); var loc=_gpsData.locations[job]; if(!loc||!loc.lat||!pos||typeof gpsDistance!=='function') return null; return gpsDistance(pos.coords.latitude,pos.coords.longitude,loc.lat,loc.lng);}
  async function markSubGps(type){var k=todayKey(); if(!attData[k])attData[k]={type:'cm'}; if(!attData[k].sub)attData[k].sub={type:'cm'}; var pos=await getPosPromise(); if(!pos)return; var d=distFromJob('sub',pos), loc=_gpsData.locations&&_gpsData.locations.sub; var obj={lat:pos.coords.latitude,lng:pos.coords.longitude,acc:pos.coords.accuracy||null,dist:d,inside:(d==null||!loc)?null:d<=((loc&&loc.radius)||_gpsData.radius||15),at:new Date().toISOString()}; if(type==='in')attData[k].sub.gpsIn=obj; else attData[k].sub.gpsOut=obj; saveAtt(); if(d!=null&&typeof showGpsBanner==='function')showGpsBanner((obj.inside?'✅':'⚠️')+' '+gps221Tpl('subGps')+': '+Math.round(d)+'m',obj.inside?'#0D9E75':'#F5A623');}
  /* [LEGACY_ATTENDANCE_SUBJOB_PATCH]
     Ghi chu: wrapper cu cho cham cong job phu va GPS rieng cua job phu.
     Khong xoa vi van bo sung gpsIn/gpsOut cho attData[k].sub.
  */
  var oldSubIn=window._doCheckinSub; window._doCheckinSub=function(){if(typeof oldSubIn==='function')oldSubIn(); markSubGps('in');};
  var oldSubOut=window._doCheckoutSub; window._doCheckoutSub=function(){if(typeof oldSubOut==='function')oldSubOut(); markSubGps('out');};
  var _exportFormat='csv'; window._exportFormat=_exportFormat;
  window.selExportFormat=function(fmt){_exportFormat=(fmt==='pdf')?'pdf':'csv';window._exportFormat=_exportFormat;['Csv','Pdf'].forEach(function(x){var b=document.getElementById('efmt'+x);if(!b)return;var on=(x.toLowerCase()===_exportFormat);b.style.background=on?'var(--ac)':'white';b.style.color=on?'white':'var(--text2)';b.style.borderColor=on?'var(--ac)':'var(--border)';});var ext=document.getElementById('excelFileExt');if(ext)ext.textContent=_exportFormat==='pdf'?'.html':'.csv';var btn=document.getElementById('excelExportBtn');if(btn)btn.textContent=_exportFormat==='pdf'?gps221Tpl('pdf'):gps221Tpl('csv');};
  function ensureExportFormatUi(){var nameBlock=document.getElementById('excelFilenameLbl');if(!nameBlock||document.getElementById('excelFormatRow'))return;var p=gps221Pack();var row=document.createElement('div');row.id='excelFormatRow';row.style.cssText='margin:12px 0';row.innerHTML='<div style="font-size:11px;font-weight:800;color:var(--text3);margin-bottom:8px">'+escHtml(p.fileFormat)+'</div><div style="display:flex;gap:6px"><button id="efmtCsv" onclick="selExportFormat(\'csv\')" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid var(--ac);background:var(--ac);color:white;font-size:12px;font-weight:900;font-family:Nunito,sans-serif">'+escHtml(p.csv)+'</button><button id="efmtPdf" onclick="selExportFormat(\'pdf\')" style="flex:1;padding:8px;border-radius:8px;border:1.5px solid var(--border);background:white;color:var(--text2);font-size:12px;font-weight:900;font-family:Nunito,sans-serif">'+escHtml(p.pdf)+'</button></div>';var parent=nameBlock.parentElement;parent.parentElement.insertBefore(row,parent);var span=parent.querySelector('span');if(span)span.id='excelFileExt';}
  var oldUpdateExcelPanel=window.updateExcelPanel; window.updateExcelPanel=function(){if(typeof oldUpdateExcelPanel==='function')oldUpdateExcelPanel();ensureExportFormatUi();window.selExportFormat(_exportFormat);};
  function legacyExportTypeLabel(auto){var L=(window.userData&&userData.lang)||'vi';var packs={vi:{auto:'Tự động',manual:'Thủ công'},en:{auto:'Auto',manual:'Manual'},ko:{auto:'자동',manual:'수동'},ja:{auto:'自動',manual:'手動'},zh:{auto:'自动',manual:'手动'},my:{auto:'အလိုအလျောက်',manual:'လက်ဖြင့်'},th:{auto:'อัตโนมัติ',manual:'ด้วยตนเอง'},id:{auto:'Otomatis',manual:'Manual'},ph:{auto:'Awtomatiko',manual:'Manual'},ne:{auto:'स्वचालित',manual:'म्यानुअल'},hi:{auto:'स्वचालित',manual:'मैनुअल'}};var p=packs[L]||packs.en;return auto?p.auto:p.manual;}
  function exportRows(){var y=calView.y,m=calView.m,nd=new Date(y,m+1,0).getDate(),rows=[],T=getLang(),STATUS={cm:T.coMat||'Có mặt',vang:T.vang||'Vắng',np:T.nghiPhep||'Nghỉ phép',ll:legacyHolidayLabel(T)};function add(g,rec,label){var ins=rec?.in||'',outs=rec?.out||'',dur='';if(ins&&outs)dur=(((timeToMin(outs)-timeToMin(ins)+1440)%1440)/60).toFixed(1)+'h';var gps='',gi=rec?.gpsIn,go=rec?.gpsOut;if(gi&&gi.lat)gps='IN '+gi.lat.toFixed(5)+','+gi.lng.toFixed(5);if(go&&go.lat)gps+=(gps?' | ':'')+'OUT '+go.lat.toFixed(5)+','+go.lng.toFixed(5);rows.push({date:g+'/'+(m+1)+'/'+y,day:DAYS[new Date(y,m,g).getDay()],job:label,status:STATUS[rec?.type]||'',in:ins,out:outs,hours:dur,type:legacyExportTypeLabel(!!(rec&&rec.auto)),note:rec?.note||'',gps:gps});}for(var g=1;g<=nd;g++){var rec=getAttRecordByDateParts(y,m,g);if(!rec)continue;if(_exportFilter!=='sub')add(g,rec,u('job.main'));if(rec.sub&&_exportFilter!=='main')add(g,rec.sub,userData.subJob?.name||u('job.sub'));}return rows;}
  
function downloadPdf(){
  /* SAFE PDF EXPORT: không tạo HTML mới chứa script để tránh lỗi code rơi ra màn hình. */
  var oldTitle=document.title;
  var name=(document.getElementById('excelFilename')?.value||'ChamCong').trim();
  document.title=name;
  try{ window.print(); }
  finally{ setTimeout(function(){ document.title=oldTitle; },500); }
}

/* PATCH v2.2.3 — Hard-text i18n deep sync for GPS / Sub job / Salary / Calendar / Export */
(function(){
  const PACK={
    vi:{main:'Công việc chính',mainShort:'CHÍNH',sub:'Việc phụ',subShort:'PHỤ',hasSub:'💼 Có job phụ không?',subHelp:'Freelance, part-time, làm thêm...',subName:'TÊN CÔNG VIỆC PHỤ',subNamePh:'Freelance / Gia sư / Part-time...',subSalary:'LƯƠNG VIỆC PHỤ',hour:'/ giờ',day:'/ ngày',month:'/ tháng',hintHour:'Nhập lương theo giờ — tự tính theo số giờ làm thực tế',hintDay:'Nhập lương theo ngày công thực tế',hintMonth:'Nhập lương tháng cố định cho việc này',gpsAuto:'GPS tự động 출퇴근',gpsAutoSub:'Tự động vào/ra ca khi đến/rời công ty',gpsTarget:'🎯 GPS ÁP DỤNG CHO VIỆC',gpsSaved:'Đã lưu',gpsNotSaved:'Chưa lưu',gpsHint:'Chọn việc rồi bấm “Lấy vị trí hiện tại” để lưu GPS riêng cho việc đó.',companyLocation:'📍 Vị trí công ty',companyNoLocation:'Chưa thiết lập vị trí công ty',radius:'Cảm biến khoảng cách',checkinMin:'⏱️ Xác nhận vào ca (phút)',checkoutMin:'⏱️ Xác nhận ra ca (phút)',getLocation:'📍 Lấy vị trí hiện tại',clearLocation:'✕ Xóa',calendarText:'🎨 MÀU CHỮ TRONG LỊCH',sun:'Chủ nhật (CN)',sunSub:'Màu chữ ngày Chủ nhật',sat:'Thứ 7 (T7)',satSub:'Màu chữ ngày Thứ 7',normal:'Ngày thường (T2–T6)',normalSub:'Màu chữ ngày trong tuần',resetColor:'↺ Đặt lại màu mặc định',saveAppearance:'✓ Lưu giao diện',estNet:'Ước tính thực nhận',gross:'Tổng trước khấu trừ',combined:'Hợp nhất thu nhập (chính + phụ)',total:'Tổng',saveSalary:'✓ Lưu thông tin lương',format:'ĐỊNH DẠNG FILE',csv:'📊 Xuất file Excel (.csv)',pdf:'📄 Xuất file PDF',filter:'CHẾ ĐỘ XUẤT',all:'Tất cả',filename:'TÊN FILE'},
    ko:{main:'주업무',mainShort:'주업',sub:'부업',subShort:'부업',hasSub:'💼 부업이 있나요?',subHelp:'프리랜서, 파트타임, 추가 근무...',subName:'부업 이름',subNamePh:'프리랜서 / 과외 / 파트타임...',subSalary:'부업 급여',hour:'/ 시간',day:'/ 일',month:'/ 월',hintHour:'시간급 입력 — 실제 근무시간 기준 자동 계산',hintDay:'일급 입력 — 실제 근무일 기준 계산',hintMonth:'이 작업의 고정 월급 입력',gpsAuto:'GPS 자동 출퇴근',gpsAutoSub:'회사 도착/이탈 시 자동 출퇴근 처리',gpsTarget:'🎯 GPS 적용 작업',gpsSaved:'저장됨',gpsNotSaved:'미저장',gpsHint:'작업을 선택한 뒤 “현재 위치 가져오기”를 눌러 작업별 GPS를 저장하세요.',companyLocation:'📍 회사 위치',companyNoLocation:'회사 위치가 설정되지 않음',radius:'감지 반경',checkinMin:'⏱️ 출근 확인 (분)',checkoutMin:'⏱️ 퇴근 확인 (분)',getLocation:'📍 현재 위치 가져오기',clearLocation:'✕ 삭제',calendarText:'🎨 달력 글자색',sun:'일요일 (일)',sunSub:'일요일 글자색',sat:'토요일 (토)',satSub:'토요일 글자색',normal:'평일 (월–금)',normalSub:'평일 글자색',resetColor:'↺ 기본 색상으로 재설정',saveAppearance:'✓ 저장',estNet:'예상 실수령액',gross:'총액',combined:'합산 수입 (주업+부업)',total:'합계',saveSalary:'✓ 급여 정보 저장',format:'파일 형식',csv:'📊 Excel CSV 내보내기',pdf:'📄 PDF 내보내기',filter:'내보내기 모드',all:'전체',filename:'파일 이름'},
    en:{main:'Main job',mainShort:'MAIN',sub:'Sub job',subShort:'SUB',hasSub:'💼 Do you have a sub job?',subHelp:'Freelance, part-time, extra work...',subName:'SUB JOB NAME',subNamePh:'Freelance / Tutoring / Part-time...',subSalary:'SUB JOB SALARY',hour:'/ hour',day:'/ day',month:'/ month',hintHour:'Enter hourly rate — auto calculated from actual hours',hintDay:'Enter daily rate',hintMonth:'Enter fixed monthly salary for this job',gpsAuto:'Automatic GPS attendance',gpsAutoSub:'Auto check in/out when arriving/leaving company',gpsTarget:'🎯 GPS TARGET JOB',gpsSaved:'Saved',gpsNotSaved:'Not saved',gpsHint:'Select a job, then press “Get current location” to save GPS separately.',companyLocation:'📍 Company location',companyNoLocation:'Company location not set',radius:'Detection radius',checkinMin:'⏱️ Check-in confirm (min)',checkoutMin:'⏱️ Check-out confirm (min)',getLocation:'📍 Get current location',clearLocation:'✕ Clear',calendarText:'🎨 Calendar text colors',sun:'Sunday (Sun)',sunSub:'Sunday text color',sat:'Saturday (Sat)',satSub:'Saturday text color',normal:'Weekdays (Mon–Fri)',normalSub:'Weekday text color',resetColor:'↺ Reset default colors',saveAppearance:'✓ Save appearance',estNet:'Estimated net pay',gross:'Gross',combined:'Combined income (main + sub)',total:'Total',saveSalary:'✓ Save salary info',format:'FILE FORMAT',csv:'📊 Export Excel CSV',pdf:'📄 Export PDF',filter:'EXPORT MODE',all:'All',filename:'FILE NAME'},
    ja:{main:'本業',mainShort:'本業',sub:'副業',subShort:'副業',hasSub:'💼 副業がありますか？',subHelp:'フリーランス、パート、追加勤務...',subName:'副業名',subNamePh:'フリーランス / 家庭教師 / パート...',subSalary:'副業給与',hour:'/ 時間',day:'/ 日',month:'/ 月',hintHour:'時給を入力 — 実働時間で自動計算',hintDay:'日給を入力',hintMonth:'固定月給を入力',gpsAuto:'GPS自動出退勤',gpsAutoSub:'会社到着/退出時に自動処理',gpsTarget:'🎯 GPS適用ジョブ',gpsSaved:'保存済み',gpsNotSaved:'未保存',gpsHint:'ジョブを選択し「現在地を取得」でジョブ別GPSを保存します。',companyLocation:'📍 会社位置',companyNoLocation:'会社位置未設定',radius:'検出半径',checkinMin:'⏱️ 出勤確認（分）',checkoutMin:'⏱️ 退勤確認（分）',getLocation:'📍 現在地を取得',clearLocation:'✕ 削除',calendarText:'🎨 カレンダー文字色',sun:'日曜日（日）',sunSub:'日曜日の文字色',sat:'土曜日（土）',satSub:'土曜日の文字色',normal:'平日（月–金）',normalSub:'平日の文字色',resetColor:'↺ 既定色に戻す',saveAppearance:'✓ 保存',estNet:'推定手取り',gross:'総支給',combined:'合算収入（本業＋副業）',total:'合計',saveSalary:'✓ 給与情報を保存',format:'ファイル形式',csv:'📊 Excel CSV出力',pdf:'📄 PDF出力',filter:'出力モード',all:'すべて',filename:'ファイル名'},
    zh:{main:'主业',mainShort:'主业',sub:'副业',subShort:'副业',hasSub:'💼 有副业吗？',subHelp:'自由职业、兼职、额外工作...',subName:'副业名称',subNamePh:'自由职业 / 家教 / 兼职...',subSalary:'副业工资',hour:'/ 小时',day:'/ 天',month:'/ 月',hintHour:'输入时薪 — 按实际工时自动计算',hintDay:'输入日薪',hintMonth:'输入固定月薪',gpsAuto:'GPS自动打卡',gpsAutoSub:'到达/离开公司时自动打卡',gpsTarget:'🎯 GPS适用工作',gpsSaved:'已保存',gpsNotSaved:'未保存',gpsHint:'选择工作后点击“获取当前位置”分别保存GPS。',companyLocation:'📍 公司位置',companyNoLocation:'未设置公司位置',radius:'检测半径',checkinMin:'⏱️ 上班确认（分）',checkoutMin:'⏱️ 下班确认（分）',getLocation:'📍 获取当前位置',clearLocation:'✕ 删除',calendarText:'🎨 日历文字颜色',sun:'星期日（日）',sunSub:'星期日文字颜色',sat:'星期六（六）',satSub:'星期六文字颜色',normal:'工作日（一–五）',normalSub:'工作日文字颜色',resetColor:'↺ 恢复默认颜色',saveAppearance:'✓ 保存',estNet:'预计实收',gross:'税前总额',combined:'合并收入（主业+副业）',total:'合计',saveSalary:'✓ 保存工资信息',format:'文件格式',csv:'📊 导出 Excel CSV',pdf:'📄 导出 PDF',filter:'导出模式',all:'全部',filename:'文件名'},
    my:{main:'အဓိကအလုပ်',mainShort:'အဓိက',sub:'ဘေးအလုပ်',subShort:'ဘေး',hasSub:'💼 ဘေးအလုပ်ရှိပါသလား？',subHelp:'Freelance, part-time, အပိုအလုပ်...',subName:'ဘေးအလုပ် အမည်',subNamePh:'Freelance / Part-time...',subSalary:'ဘေးအလုပ် လစာ',hour:'/ နာရီ',day:'/ ရက်',month:'/ လ',hintHour:'နာရီလစာ — အမှန်တကယ်နာရီအလိုက် တွက်',hintDay:'နေ့စဉ်လစာ',hintMonth:'ဤအလုပ်အတွက် လချုပ်',gpsAuto:'GPS အလိုအလျောက်',gpsAutoSub:'ကုမ္ပဏီ ရောက်/ထွက်ချိန် အလိုအလျောက်',gpsTarget:'🎯 GPS အလုပ်',gpsSaved:'သိမ်းပြီး',gpsNotSaved:'မသိမ်းရသေး',gpsHint:'အလုပ်ရွေးပြီး „လက်ရှိနေရာ‟ ကိုနှိပ်ပါ။',companyLocation:'📍 ကုမ္ပဏီနေရာ',companyNoLocation:'ကုမ္ပဏီနေရာ မသတ်မှတ်ရသေး',radius:'ဖော်ထုတ်ရန် အကွာအဝေး',checkinMin:'⏱️ တက်အတည်ပြု (မိနစ်)',checkoutMin:'⏱️ ဆင်းအတည်ပြု (မိနစ်)',getLocation:'📍 လက်ရှိနေရာ',clearLocation:'✕ ဖျက်',calendarText:'🎨 ပြက္ခဒိန် စာသား',sun:'တနင်္ဂနွေ',sunSub:'တနင်္ဂနွေ စာသား',sat:'စနေ',satSub:'စနေ စာသား',normal:'ပုံမှန် (တ–သော)',normalSub:'ပုံမှန် စာသား',resetColor:'↺ မူရင်းအရောင်',saveAppearance:'✓ သိမ်း',estNet:'ခန့်မှန်း လက်ခံငွေ',gross:'စုစုပေါင်း',combined:'စုပေါင်းဝင်ငွေ',total:'စုစုပေါင်း',saveSalary:'✓ လစာ သိမ်း',format:'ဖိုင်ပုံစံ',csv:'📊 Excel CSV ထုတ်',pdf:'📄 PDF ထုတ်',filter:'ထုတ်နည်း',all:'အားလုံး',filename:'ဖိုင်အမည်'},
    th:{main:'งานหลัก',mainShort:'หลัก',sub:'งานเสริม',subShort:'เสริม',hasSub:'💼 มีงานเสริมไหม?',subHelp:'ฟรีแลนซ์, พาร์ทไทม์, งานพิเศษ...',subName:'ชื่องานเสริม',subNamePh:'ฟรีแลนซ์ / สอนพิเศษ / พาร์ทไทม์...',subSalary:'เงินเดือนงานเสริม',hour:'/ ชั่วโมง',day:'/ วัน',month:'/ เดือน',hintHour:'ใส่ค่าจ้างต่อชั่วโมง — คำนวณอัตโนมัติ',hintDay:'ใส่ค่าจ้างรายวัน',hintMonth:'ใส่เงินเดือนคงที่ของงานนี้',gpsAuto:'ลงเวลาอัตโนมัติด้วย GPS',gpsAutoSub:'เข้า/ออกงานอัตโนมัติเมื่อถึง/ออกบริษัท',gpsTarget:'🎯 งานที่ใช้ GPS',gpsSaved:'บันทึกแล้ว',gpsNotSaved:'ยังไม่บันทึก',gpsHint:'เลือกงาน แล้วกด „รับตำแหน่งปัจจุบัน‟ เพื่อบันทึก GPS แยก',companyLocation:'📍 ตำแหน่งบริษัท',companyNoLocation:'ยังไม่ได้ตั้งตำแหน่งบริษัท',radius:'รัศมีตรวจจับ',checkinMin:'⏱️ ยืนยันเข้างาน (นาที)',checkoutMin:'⏱️ ยืนยันออกงาน (นาที)',getLocation:'📍 รับตำแหน่งปัจจุบัน',clearLocation:'✕ ลบ',calendarText:'🎨 สีตัวอักษรปฏิทิน',sun:'อาทิตย์',sunSub:'สีตัวอักษรอาทิตย์',sat:'เสาร์',satSub:'สีตัวอักษรเสาร์',normal:'วันธรรมดา (จ–ศ)',normalSub:'สีตัวอักษรวันธรรมดา',resetColor:'↺ รีเซ็ตเป็นค่าเริ่มต้น',saveAppearance:'✓ บันทึกธีม',estNet:'รายได้สุทธิประมาณ',gross:'รวมก่อนหัก',combined:'รายได้รวม (หลัก+เสริม)',total:'รวม',saveSalary:'✓ บันทึกเงินเดือน',format:'รูปแบบไฟล์',csv:'📊 ส่งออก Excel CSV',pdf:'📄 ส่งออก PDF',filter:'โหมดส่งออก',all:'ทั้งหมด',filename:'ชื่อไฟล์'},
    id:{main:'Pekerjaan utama',mainShort:'UTAMA',sub:'Pekerjaan sampingan',subShort:'SAMPING',hasSub:'💼 Punya kerja sampingan?',subHelp:'Freelance, paruh waktu, tambahan...',subName:'NAMA KERJA SAMPINGAN',subNamePh:'Freelance / Les / Paruh waktu...',subSalary:'GAJI SAMPINGAN',hour:'/ jam',day:'/ hari',month:'/ bulan',hintHour:'Masukkan tarif per jam — dihitung otomatis',hintDay:'Masukkan upah harian',hintMonth:'Masukkan gaji bulanan tetap',gpsAuto:'Absensi GPS otomatis',gpsAutoSub:'Auto masuk/keluar saat tiba/pergi dari kantor',gpsTarget:'🎯 PEKERJAAN TARGET GPS',gpsSaved:'Tersimpan',gpsNotSaved:'Belum disimpan',gpsHint:'Pilih pekerjaan, lalu tekan „Lokasi saat ini‟ untuk simpan GPS terpisah.',companyLocation:'📍 Lokasi kantor',companyNoLocation:'Lokasi kantor belum diatur',radius:'Radius deteksi',checkinMin:'⏱️ Konfirmasi masuk (menit)',checkoutMin:'⏱️ Konfirmasi keluar (menit)',getLocation:'📍 Lokasi saat ini',clearLocation:'✕ Hapus',calendarText:'🎨 Warna teks kalender',sun:'Minggu',sunSub:'Warna teks Minggu',sat:'Sabtu',satSub:'Warna teks Sabtu',normal:'Hari kerja (Sen–Jum)',normalSub:'Warna teks hari kerja',resetColor:'↺ Reset warna default',saveAppearance:'✓ Simpan tampilan',estNet:'Estimasi gaji bersih',gross:'Bruto',combined:'Pendapatan gabungan (utama+sampingan)',total:'Total',saveSalary:'✓ Simpan info gaji',format:'FORMAT FILE',csv:'📊 Ekspor Excel CSV',pdf:'📄 Ekspor PDF',filter:'MODE EKSPOR',all:'Semua',filename:'NAMA FILE'},
    ph:{main:'Pangunahing trabaho',mainShort:'PANGUNAHIN',sub:'Sideline',subShort:'SIDE',hasSub:'💼 May sideline ka ba?',subHelp:'Freelance, part-time, dagdag trabaho...',subName:'PANGALAN NG SIDELINE',subNamePh:'Freelance / Tutor / Part-time...',subSalary:'SAHOD NG SIDELINE',hour:'/ oras',day:'/ araw',month:'/ buwan',hintHour:'Ilagay ang oras-oras na rate — auto-compute',hintDay:'Ilagay ang araw-araw na rate',hintMonth:'Ilagay ang buwanang sahod ng trabahong ito',gpsAuto:'Awtomatikong GPS attendance',gpsAutoSub:'Auto-sign in/out kapag pumasok/lumabas',gpsTarget:'🎯 TRABAHONG NA-TARGET NG GPS',gpsSaved:'Nai-save na',gpsNotSaved:'Hindi pa naka-save',gpsHint:'Pumili ng trabaho, pindutin „Kunin ang kasalukuyang lokasyon‟.',companyLocation:'📍 Lokasyon ng kumpanya',companyNoLocation:'Hindi naka-set ang lokasyon ng kumpanya',radius:'Radius ng pagtukoy',checkinMin:'⏱️ Kumpirmahin ang pasok (min)',checkoutMin:'⏱️ Kumpirmahin ang labas (min)',getLocation:'📍 Kunin ang kasalukuyang lokasyon',clearLocation:'✕ I-clear',calendarText:'🎨 Mga kulay ng teksto sa kalendaryo',sun:'Linggo',sunSub:'Kulay ng Linggo',sat:'Sabado',satSub:'Kulay ng Sabado',normal:'Mga araw ng trabaho (Lun–Biy)',normalSub:'Kulay ng araw ng trabaho',resetColor:'↺ I-reset sa default',saveAppearance:'✓ I-save ang hitsura',estNet:'Tinatayang net pay',gross:'Gross',combined:'Pinagsamang kita (pangunahin+side)',total:'Kabuuan',saveSalary:'✓ I-save ang impormasyon ng sahod',format:'FORMAT NG FILE',csv:'📊 I-export ang Excel CSV',pdf:'📄 I-export ang PDF',filter:'MODE NG EXPORT',all:'Lahat',filename:'PANGALAN NG FILE'},
    ne:{main:'मुख्य काम',mainShort:'मुख्य',sub:'सहायक काम',subShort:'सहायक',hasSub:'💼 सहायक काम छ?',subHelp:'फ्रिल्यान्स, पार्ट-टाइम, अतिरिक्त काम...',subName:'सहायक काम नाम',subNamePh:'फ्रिल्यान्स / ट्युटर / पार्ट-टाइम...',subSalary:'सहायक काम तलब',hour:'/ घन्टा',day:'/ दिन',month:'/ महिना',hintHour:'घण्टाको दर — स्वत: गणना',hintDay:'दैनिक दर',hintMonth:'यो कामको स्थिर मासिक तलब',gpsAuto:'स्वत: GPS हाजिरी',gpsAutoSub:'कम्पनी पुग्दा/छोड्दा स्वत: हाजिर/बाहिर',gpsTarget:'🎯 GPS लक्षित काम',gpsSaved:'सुरक्षित',gpsNotSaved:'सुरक्षित छैन',gpsHint:'काम छान्नुहोस्, „हालको स्थान‟ थिच्नुहोस्।',companyLocation:'📍 कम्पनी स्थान',companyNoLocation:'कम्पनी स्थान सेट गरिएको छैन',radius:'पहिचान त्रिज्या',checkinMin:'⏱️ प्रवेश पुष्टि (मिनेट)',checkoutMin:'⏱️ बाहिर पुष्टि (मिनेट)',getLocation:'📍 हालको स्थान लिनुहोस्',clearLocation:'✕ हटाउनुहोस्',calendarText:'🎨 क्यालेन्डर पाठ रंग',sun:'आइतबार',sunSub:'आइतबार पाठ रंग',sat:'शनिबार',satSub:'शनिबार पाठ रंग',normal:'कार्यदिन (सोम–शुक्र)',normalSub:'कार्यदिन पाठ रंग',resetColor:'↺ डिफल्टमा रिसेट',saveAppearance:'✓ थिम सुरक्षित गर्नुहोस्',estNet:'अनुमानित नेट तलब',gross:'कुल',combined:'मिलाएको आम्दानी (मुख्य+सहायक)',total:'जम्मा',saveSalary:'✓ तलब जानकारी सुरक्षित गर्नुहोस्',format:'फाइल ढाँचा',csv:'📊 Excel CSV निर्यात',pdf:'📄 PDF निर्यात',filter:'निर्यात मोड',all:'सबै',filename:'फाइल नाम'},
    hi:{main:'मुख्य नौकरी',mainShort:'मुख्य',sub:'अतिरिक्त नौकरी',subShort:'अतिरिक्त',hasSub:'💼 क्या आपकी अतिरिक्त नौकरी है?',subHelp:'फ्रीलांस, पार्ट-टाइम, अतिरिक्त काम...',subName:'अतिरिक्त नौकरी का नाम',subNamePh:'फ्रीलांस / ट्यूटर / पार्ट-टाइम...',subSalary:'अतिरिक्त वेतन',hour:'/ घंटा',day:'/ दिन',month:'/ माह',hintHour:'प्रति घंटा दर — स्वचालित गणना',hintDay:'दैनिक दर दर्ज करें',hintMonth:'इस कार्य का निश्चित मासिक वेतन',gpsAuto:'स्वचालित GPS उपस्थिति',gpsAutoSub:'कंपनी पहुंचने/छोड़ने पर ऑटो',gpsTarget:'🎯 GPS लक्ष्य कार्य',gpsSaved:'सहेजा गया',gpsNotSaved:'सहेजा नहीं',gpsHint:'कार्य चुनें, फिर „वर्तमान स्थान‟ दबाएं।',companyLocation:'📍 कंपनी स्थान',companyNoLocation:'कंपनी स्थान सेट नहीं',radius:'पहचान त्रिज्या',checkinMin:'⏱️ प्रवेश पुष्टि (मिनट)',checkoutMin:'⏱️ निकास पुष्टि (मिनट)',getLocation:'📍 वर्तमान स्थान प्राप्त करें',clearLocation:'✕ साफ करें',calendarText:'🎨 कैलेंडर पाठ रंग',sun:'रविवार',sunSub:'रविवार पाठ रंग',sat:'शनिवार',satSub:'शनिवार पाठ रंग',normal:'कार्यदिवस (सोम–शुक्र)',normalSub:'कार्यदिवस पाठ रंग',resetColor:'↺ डिफ़ॉल्ट पर रीसेट',saveAppearance:'✓ थीम सहेजें',estNet:'अनुमानित शुद्ध वेतन',gross:'सकल',combined:'संयुक्त आय (मुख्य+अतिरिक्त)',total:'कुल',saveSalary:'✓ वेतन जानकारी सहेजें',format:'फ़ाइल प्रारूप',csv:'📊 Excel CSV निर्यात',pdf:'📄 PDF निर्यात',filter:'निर्यात मोड',all:'सभी',filename:'फ़ाइल नाम'}
  };
  const ALIAS={};
  function getLang2(){try{return (window.userData&&userData.lang)||localStorage.getItem('cc_lang')||localStorage.getItem('lang')||'vi'}catch(e){return 'vi'}}
  function P(){let l=getLang2();return PACK[l]||PACK[ALIAS[l]]||PACK.en}
  function safeText(s){return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function set(id,val,attr){const e=document.getElementById(id); if(!e)return; if(attr)e.setAttribute(attr,val); else e.textContent=val}
  function replaceTextNode(n){let s=n.nodeValue, p=P(); const pairs=[
    ['TÊN CÔNG VIỆC PHỤ',p.subName],['TÊN CÔNG 부업',p.subName],['TÊN CÔNG 副业',p.subName],['TÊN CÔNG 副業',p.subName],['TÊN CÔNG SUB JOB',p.subName],
    ['LƯƠNG JOB PHỤ',p.subSalary],['LƯƠNG VIỆC PHỤ',p.subSalary],['LƯƠNG JOB 부업',p.subSalary],['LƯƠNG JOB 副业',p.subSalary],['LƯƠNG JOB 副業',p.subSalary],
    ['💼 Có job phụ không?',p.hasSub],['Có job phụ không?',p.hasSub.replace(/^💼\s*/, '')],['Freelance, part-time, làm thêm...',p.subHelp],
    ['Job chính',p.main],['Công việc chính',p.main],['CÔNG VIỆC CHÍNH',p.main],['CHÍNH',p.mainShort],['주업',p.mainShort],
    ['Job phụ',p.sub],['Việc phụ',p.sub],['VIỆC PHỤ',p.sub],['VIEC PHU',p.sub],['PHỤ',p.subShort],
    ['GPS ÁP DỤNG CHO JOB',p.gpsTarget],['GPS áp dụng cho job',p.gpsTarget.replace(/^🎯\s*/, '')],['GPS tự động 출퇴근',p.gpsAuto],['Chấm công tự động GPS',p.gpsAuto],['Tự động vào/ra ca khi đến/rời công ty',p.gpsAutoSub],
    ['Vị trí công ty',p.companyLocation.replace(/^📍\s*/, '')],['회사 위치가 설정되지 않음',p.companyNoLocation],['Chưa thiết lập vị trí công ty',p.companyNoLocation],['Cảm biến khoảng cách',p.radius],['감지 반경',p.radius],
    ['출근 확인 (분)',p.checkinMin.replace(/^⏱️\s*/, '')],['퇴근 확인 (분)',p.checkoutMin.replace(/^⏱️\s*/, '')],['Phút xác nhận VÀO ca',p.checkinMin.replace(/^⏱️\s*/, '')],['Phút xác nhận HẾT ca',p.checkoutMin.replace(/^⏱️\s*/, '')],
    ['Lấy vị trí hiện tại',p.getLocation.replace(/^📍\s*/, '')],['Xóa',p.clearLocation.replace(/^✕\s*/, '')],['Đã lưu',p.gpsSaved],['Chưa lưu',p.gpsNotSaved],['Chọn job rồi bấm “Lấy vị trí hiện tại” để lưu GPS riêng cho job đó.',p.gpsHint],
    ['MÀU CHỮ TRONG LỊCH',p.calendarText],['Chủ nhật (CN)',p.sun],['Màu chữ ngày Chủ nhật',p.sunSub],['Thứ 7 (T7)',p.sat],['Màu chữ ngày Thứ 7',p.satSub],['Ngày thường (T2–T6)',p.normal],['Màu chữ ngày trong tuần',p.normalSub],['Đặt lại màu mặc định',p.resetColor.replace(/^↺\s*/, '')],['Lưu giao diện',p.saveAppearance.replace(/^✓\s*/, '')],
    ['Ước tính thực nhận',p.estNet],['예상 실수령액',p.estNet],['Gross',p.gross],['합산 수입 (주+부)',p.combined],['Hợp nhất thu nhập (chính + phụ)',p.combined],['Tổng',p.total],['Lưu thông tin lương',p.saveSalary.replace(/^✓\s*/, '')],
    ['ĐỊNH DẠNG FILE',p.format],['CHẾ ĐỘ XUẤT',p.filter],['TÊN FILE',p.filename],['Tất cả',p.all],['Xuất file Excel (.csv)',p.csv.replace(/^📊\s*/, '')],['Xuất file PDF',p.pdf.replace(/^📄\s*/, '')],
    ['/ giờ',p.hour],['/ ngày',p.day],['/ tháng',p.month]
  ];
  pairs.sort((a,b)=>b[0].length-a[0].length).forEach(([a,b])=>{s=s.split(a).join(b)}); if(s!==n.nodeValue)n.nodeValue=s;
  }
  function syncAttrs(){const p=P();
    set('setupSubNameLbl',p.subName); set('setupSubSalaryLbl',p.subSalary); set('setupSubJob',p.subNamePh,'placeholder'); set('setupSubSalaryHint',p.hintHour);
    set('btnResetColors',p.resetColor); set('btnSaveAppear',p.saveAppearance); set('apSecCalColor',p.calendarText);
    set('calColorSunLbl',p.sun); set('calColorSunSub',p.sunSub); set('calColorSatLbl',p.sat); set('calColorSatSub',p.satSub); set('calColorNormLbl',p.normal); set('calColorNormSub',p.normalSub);
    set('excelFilterLbl',p.filter); set('excelFilenameLbl',p.filename); set('efAll',p.all);
    const fmt=document.querySelector('#excelFormatRow > div:first-child'); if(fmt)fmt.textContent=p.format;
    const btn=document.getElementById('excelExportBtn'); if(btn)btn.textContent=(window._exportFormat==='pdf')?p.pdf:p.csv;
    const hint=document.getElementById('setupSubSalaryHint'); if(hint){const mode=(window._subSalaryMode||'hour'); hint.textContent=mode==='day'?p.hintDay:mode==='month'?p.hintMonth:p.hintHour;}
  }
  let busy=false;
  function syncAll(){if(busy)return; busy=true; try{syncAttrs(); const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(n){const e=n.parentElement;if(!e||!n.nodeValue.trim()||['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(e.tagName))return NodeFilter.FILTER_REJECT;if(e.isContentEditable||e.closest('input,textarea,[contenteditable="true"]'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}}); const arr=[]; while(w.nextNode())arr.push(w.currentNode); arr.forEach(replaceTextNode);}catch(e){} busy=false;}
  const oldApply=window.applyI18n; window.applyI18n=function(){const r=oldApply&&oldApply.apply(this,arguments); setTimeout(syncAll,20); return r;};
  const oldOpen=window.openPanel; window.openPanel=function(id){const r=oldOpen&&oldOpen.apply(this,arguments); setTimeout(syncAll,80); return r;};
  const oldGps=window.openPanelGPS; if(oldGps) window.openPanelGPS=function(){const r=oldGps.apply(this,arguments); setTimeout(syncAll,120); return r;};
  const oldRenderSetup=window.renderSetupSubJob; if(oldRenderSetup) window.renderSetupSubJob=function(){const r=oldRenderSetup.apply(this,arguments); setTimeout(syncAll,30); return r;};
  const oldSelSub=window.selSubMode; if(oldSelSub) window.selSubMode=function(mode){window._subSalaryMode=mode; const r=oldSelSub.apply(this,arguments); setTimeout(syncAll,20); return r;};
  // ═══ FIX LAG TIẾNG VIỆT v4 — DISCONNECT-RECONNECT approach ═══
  //
  // Vấn đề: MutationObserver vẫn trigger khi IME tạo popup → lag composition.
  // Giải pháp v4 (cuối cùng): DISCONNECT observer hoàn toàn khi user focus input.
  // Reconnect khi user blur hoặc 1 giây không gõ.
  let _syncTimer = null;
  let _observerActive = false;
  let _disconnectTimer = null;
  let _lastInputTime = 0;

  const mo = new MutationObserver(() => {
    // Khi observer chạy, debounce 500ms rồi sync
    if(_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(syncAll, 500);
  });

  function startObserver(){
    if(_observerActive || !document.body) return;
    try{ mo.observe(document.body, {childList:true, subtree:true}); _observerActive = true; }catch(e){}
  }
  function stopObserver(){
    if(!_observerActive) return;
    try{ mo.disconnect(); _observerActive = false; if(_syncTimer){clearTimeout(_syncTimer); _syncTimer=null;} }catch(e){}
  }

  // ═══ STOP OBSERVER NGAY KHI USER FOCUS VÀO INPUT ═══
  // Đây là approach triệt để nhất — không có observer nào chạy khi user gõ
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)){
      stopObserver();
      _lastInputTime = Date.now();
    }
  }, true);
  document.addEventListener('focusout', (e) => {
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)){
      // Đợi 800ms để chắc IME đã đóng → mới reconnect observer
      setTimeout(() => {
        // Nếu user lại focus input khác trong 800ms thì không cần start
        const active = document.activeElement;
        if(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)){
          return;
        }
        startObserver();
      }, 800);
    }
  }, true);

  // ═══ COMPOSITION EVENTS — đảm bảo dừng observer khi gõ tiếng Việt ═══
  document.addEventListener('compositionstart', () => {
    stopObserver();
    _lastInputTime = Date.now();
  }, true);
  document.addEventListener('compositionupdate', () => {
    _lastInputTime = Date.now();
  }, true);
  document.addEventListener('compositionend', () => {
    _lastInputTime = Date.now();
    // KHÔNG restart observer ngay — chờ đến khi blur input
  }, true);

  // ═══ INPUT/KEYDOWN — track activity, không restart observer ═══
  document.addEventListener('input', (e) => {
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)){
      _lastInputTime = Date.now();
      stopObserver();  // chắc chắn observer dừng
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => { syncAll(); startObserver(); });
  setTimeout(() => { syncAll(); startObserver(); }, 500);
  window.syncDeepI18n = syncAll;
  // Expose for debugging
  window._mo = { start: startObserver, stop: stopObserver, status: () => _observerActive };
})();

(function(){
  function textFrom(key, fallback){
    try{
      if(typeof u === 'function'){
        var v = u(key);
        if(v && v !== key) return v;
      }
    }catch(e){}
    return fallback;
  }
  function setText(id, value){
    var el = document.getElementById(id);
    if(el) el.textContent = value;
  }
  function applySmartAutoLabels(){
    var title = textFrom('sa.title', '🧠 Chấm công thông minh');
    var hint = textFrom('sa.hint', 'Wi-Fi + GPS — tự động phát hiện đi/về');
    var tip = textFrom('gps.tip', '💡 Chấm công tự động dùng Wi-Fi + GPS; GPS chỉ là một tín hiệu xác thực, không còn chấm độc lập.');
    setText('gpsPanelTitle', title);
    setText('gpsAutoTitle', title);
    setText('gpsAutoSub', hint);
    setText('gpsTip', tip);
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applySmartAutoLabels);
  } else {
    applySmartAutoLabels();
  }
  setTimeout(applySmartAutoLabels, 300);
  setTimeout(applySmartAutoLabels, 1200);
  window.gpsApplySmartAutoLabels = applySmartAutoLabels;
})();

/* PATCH v2.2.9 - show saved company GPS location from persisted store */
(function(){
  if(window.__gpsSavedLocationStatusPatchInstalled) return;
  window.__gpsSavedLocationStatusPatchInstalled = true;

  function toNumber(value){
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function validPair(lat, lng){
    return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  function radiusValue(value){
    var r = Number(value);
    if(Number.isFinite(r) && r > 0) return Math.round(r);
    if(window._gpsData && Number(_gpsData.radius) > 0) return Math.round(Number(_gpsData.radius));
    return 15;
  }

  function currentStoredLocation(){
    if(typeof _gpsData === 'undefined' || !_gpsData) return null;

    try{
      if(typeof gpsRepairLocationPersistence === 'function') gpsRepairLocationPersistence();
    }catch(e){}

    var loc = null;
    try{
      if(typeof gpsGetStoredCompanyLocation === 'function'){
        loc = gpsGetStoredCompanyLocation(_gpsData.activeJob || 'main');
      }
    }catch(e){}

    if(!loc && _gpsData.locations){
      var job = _gpsData.activeJob === 'sub' ? 'sub' : 'main';
      loc = _gpsData.locations[job] || _gpsData.locations.main || _gpsData.locations.sub || null;
    }

    if(!loc) loc = {lat:_gpsData.lat, lng:_gpsData.lng, radius:_gpsData.radius};

    var lat = toNumber(loc && loc.lat);
    var lng = toNumber(loc && loc.lng);
    if(!validPair(lat, lng)) return null;
    return {lat:lat, lng:lng, radius:radiusValue(loc.radius)};
  }

  function savedText(){
    try{
      if(typeof u === 'function') return u('gps.saved') || '✅ Đã lưu vị trí công ty. Đang chờ GPS xác nhận vị trí hiện tại.';
    }catch(e){}
    return '✅ Đã lưu vị trí công ty. Đang chờ GPS xác nhận vị trí hiện tại.';
  }

  function noSetupText(){
    try{
      if(typeof u === 'function') return u('gps.no_setup') || 'Chưa thiết lập vị trí công ty';
    }catch(e){}
    return 'Chưa thiết lập vị trí công ty';
  }

  function renderSavedLocationStatus(){
    var statusTxt = document.getElementById('gpsStatusTxt');
    var statusDot = document.getElementById('gpsStatusDot');
    var coordsBox = document.getElementById('gpsCoordsBox');
    var coordsTxt = document.getElementById('gpsCoordsText');
    if(!statusTxt) return false;

    var loc = currentStoredLocation();
    if(!loc){
      statusTxt.textContent = noSetupText();
      if(statusDot) statusDot.style.background = '#ccc';
      if(coordsBox) coordsBox.style.display = 'none';
      return false;
    }

    if(typeof _gpsData !== 'undefined' && _gpsData){
      _gpsData.lat = loc.lat;
      _gpsData.lng = loc.lng;
      _gpsData.radius = loc.radius;
    }

    var inside = (typeof _gpsWasInside !== 'undefined') ? _gpsWasInside : null;
    statusTxt.textContent = inside === true  ? u('gps.in_zone')
                          : inside === false ? u('gps.out_zone')
                          : savedText();
    if(statusDot) statusDot.style.background = inside === true ? '#0D9E75' : inside === false ? '#E8433A' : '#F5A623';
    if(coordsBox) coordsBox.style.display = 'block';
    if(coordsTxt){
      var polling = (typeof _gpsPollMs !== 'undefined' && _gpsPollMs) ? Math.round(_gpsPollMs / 1000) : null;
      coordsTxt.innerHTML =
        'Lat: ' + loc.lat.toFixed(6) + ' | Lng: ' + loc.lng.toFixed(6) +
        '<br>Bán kính: ' + loc.radius + 'm' + (polling ? ' | Polling: ' + polling + 's' : '');
    }
    return true;
  }

  var oldUpdateGpsStatus = window.updateGpsStatus;
  window.updateGpsStatus = function(){
    if(renderSavedLocationStatus()) return;
    if(typeof oldUpdateGpsStatus === 'function') return oldUpdateGpsStatus.apply(this, arguments);
  };
  try{ updateGpsStatus = window.updateGpsStatus; }catch(e){}

  var oldOpenPanelGPS = window.openPanelGPS;
  window.openPanelGPS = function(){
    var result;
    if(typeof oldOpenPanelGPS === 'function') result = oldOpenPanelGPS.apply(this, arguments);
    setTimeout(renderSavedLocationStatus, 120);
    setTimeout(renderSavedLocationStatus, 350);
    return result;
  };
  try{ openPanelGPS = window.openPanelGPS; }catch(e){}
})();

/* PATCH v2.2.6 - actual attendance hours for salary */
(function(){
  if(window.__actualSalaryPatchInstalled) return;
  window.__actualSalaryPatchInstalled = true;

  function actualBreakHours(){
    return (window.userData && userData.hasBreak && userData.breakMinutes) ? userData.breakMinutes / 60 : 0;
  }

  function actualWorkedHours(rec, dateKey){
    if(!rec || !rec.in || !rec.out) return null;
    let h = null;
    if(typeof attendanceWorkedHours === 'function') h = attendanceWorkedHours(rec, dateKey);
    if(h == null && typeof soGio === 'function') h = soGio(rec.in, rec.out);
    if(h == null && typeof timeToMin === 'function'){
      h = ((timeToMin(rec.out) - timeToMin(rec.in) + 1440) % 1440) / 60;
    }
    if(!isFinite(h)) return null;
    return Math.max(0, h - actualBreakHours());
  }

  /**
   * Làm tròn giờ trong ngày dùng cho tính lương:
   *   - phần lẻ ≥ 30 phút (0.5h) → làm tròn LÊN
   *   - phần lẻ < 30 phút        → làm tròn XUỐNG
   * Giờ vào/ra ca trong record vẫn giữ nguyên — chỉ giá trị tổng giờ/ngày được làm tròn.
   */
  function roundDailyHoursForSalary(h){
    if(h == null || !isFinite(h)) return h;
    const whole = Math.floor(h);
    const frac = h - whole;
    return frac >= 0.5 ? whole + 1 : whole;
  }

  function fmtActualMoney(n, country, pr){
    const v = Math.max(0, Number(n) || 0);
    if(typeof fmtMoney === 'function') return fmtMoney(v, country || 'VN');
    if(country === 'VN') return Math.round(v).toLocaleString('vi-VN') + '₫';
    return (pr && pr.currency ? pr.currency : '') + Math.round(v).toLocaleString();
  }

  function safeSetText(id, value){
    const el = document.getElementById(id);
    if(el) el.textContent = value;
  }

  function calcSalaryActual(){
    const salInp = document.getElementById('salaryInput');
    const mode = (typeof _salaryMode !== 'undefined' && _salaryMode) || userData.salaryMode || 'month';
    const saved = mode === 'month' ? (userData.salary || 0)
      : mode === 'day' ? (userData.salaryDay || 0)
      : (userData.salaryHour || 0);
    const inputVal = parseFloat(salInp && salInp.value) || saved || 0;
    const ngc = userData.ngc || 26;
    const gioCA = userData.hoursPerShift || 8;

    let raw = 0;
    if(mode === 'month'){
      raw = inputVal || userData.salary || 0;
      userData.salary = raw;
    }else if(mode === 'day'){
      userData.salaryDay = inputVal;
      raw = inputVal * ngc;
      userData.salary = raw;
    }else{
      userData.salaryHour = inputVal;
      raw = inputVal * gioCA * ngc;
      userData.salary = raw;
    }
    userData.salaryMode = mode;
    if(typeof saveUser === 'function') saveUser();

    window._cfg_shim = {luong:raw, ngayCong:ngc, gioNgay:gioCA, kieu:'thang', vung:5310000};
    if(typeof syncLangCfg === 'function') syncLangCfg();

    const rule = typeof getPayrollRule === 'function' ? getPayrollRule() : {otFactor:1.5, nightFactor:1.3, holidayFactor:4};
    const country = (window.langCfg && langCfg.payrollCountry) || 'VN';
    const pr = (typeof PAYROLL_RULES !== 'undefined' && PAYROLL_RULES[country]) ? PAYROLL_RULES[country] : (typeof PAYROLL_RULES !== 'undefined' ? PAYROLL_RULES.VN : {});
    const rateDay = mode === 'hour' ? inputVal * gioCA : mode === 'day' ? inputVal : (raw / ngc || 0);
    const rateHour = mode === 'hour' ? inputVal : (rateDay / gioCA || 0);
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    let cm = 0, np = 0, v = 0, ll = 0, nightDays = 0;
    let gross = 0, basePay = 0, leavePay = 0, absentDeduct = 0, holidayPay = 0, nightPay = 0, otPay = 0, actualHours = 0, baseHours = 0;

    for(let d = 1; d <= daysInMonth; d++){
      const rec = getAttRecordByDateParts(y,m,d);
      if(!rec) continue;

      if(rec.type === 'np'){
        np++;
        if(mode === 'month'){
          leavePay += rateDay;
          gross += rateDay;
        }
        continue;
      }
      if(rec.type === 'vang'){
        v++;
        if(mode === 'month'){
          absentDeduct += rateDay;
          gross -= rateDay;
        }
        continue;
      }
      if(rec.type !== 'cm' && rec.type !== 'll') continue;

      // Làm tròn giờ/ngày cho lương: ≥30p lên, <30p xuống. Giờ vào/ra ca trong record giữ nguyên.
      const recKey = dateKeyFromParts(y,m,d);
      const workedRaw = actualWorkedHours(rec, recKey);
      if(workedRaw == null) continue;
      const worked = roundDailyHoursForSalary(workedRaw);

      actualHours += worked;
      const otGio = Math.max(0, worked - gioCA);
      const normalGio = Math.min(worked, gioCA);
      const nightGio = (typeof attendanceNightHours === 'function') ? attendanceNightHours(rec, recKey, rule.nightStart, rule.nightEnd) : ((typeof calcNightHours === 'function') ? calcNightHours(rec.in, rec.out, rule.nightStart, rule.nightEnd) : 0);
      const nightPct = (rule.nightFactor || 1.3) - 1;
      const dayNightPay = rule.nightIsAdditive ? nightGio * rateHour * (rule.nightFactor || 1.3) : nightGio * rateHour * nightPct;
      let dayOtPay = 0;
      if(window.langCfg && langCfg.payrollCountry === 'TW'){
        const ot1 = Math.min(otGio, rule.ot1Hours || 2);
        const ot2 = Math.min(Math.max(0, otGio - (rule.ot1Hours || 2)), rule.ot2Hours || 2);
        dayOtPay = (ot1 * rateHour * (rule.ot1Factor || 1.33)) + (ot2 * rateHour * (rule.ot2Factor || 1.67));
      }else{
        dayOtPay = otGio * rateHour * (rule.otFactor || 1.5);
      }

      if(rec.type === 'll'){
        ll++;
        const hPay = mode === 'hour' ? worked * rateHour * (rule.holidayFactor || 4) : rateDay * (rule.holidayFactor || 4);
        holidayPay += hPay;
        nightPay += dayNightPay;
        otPay += dayOtPay;
        gross += hPay + dayNightPay + dayOtPay;
        if(nightGio > 1) nightDays++;
        continue;
      }

      cm++;
      const bPay = mode === 'hour' ? normalGio * rateHour : rateDay;
      baseHours += normalGio;
      basePay += bPay;
      nightPay += dayNightPay;
      otPay += dayOtPay;
      gross += bPay + dayNightPay + dayOtPay;
      if(nightGio > 1) nightDays++;
    }

    const taxResult = typeof taxEngineCalculate === 'function'
      ? taxEngineCalculate(country, Math.max(0, gross), userData.dependents || 0)
      : {insurance:0, tax:0, net:Math.max(0, gross), rule:{}};
    const bhTong = taxResult.insurance || 0;
    const thueTong = taxResult.tax || 0;
    const net = taxResult.net == null ? Math.max(0, gross - bhTong - thueTong) : taxResult.net;
    const fmtN = n => fmtActualMoney(n, country, pr);
    const ruleName = typeof cLang === 'function' ? cLang(pr.name || country) : (pr.name || country);
    const basis = typeof cLang === 'function' ? cLang(pr.basis || '') : (pr.basis || '');
    const paidDays = cm + ll;
    const hourTxt = (Math.round(actualHours * 10) / 10).toLocaleString('vi-VN') + 'h';
    const baseHourTxt = (Math.round(baseHours * 10) / 10).toLocaleString('vi-VN') + 'h';

    const labels = {
      vi:{present:'Có mặt đã tan ca',hour:'Giờ thực tế',day:'ngày',night:'Ca đêm',ot:'Tăng ca',leave:'Nghỉ phép',absent:'Vắng',holiday:'Làm ngày lễ',real:'theo dữ liệu thực tế'},
      en:{present:'Completed shifts',hour:'Actual hours',day:'days',night:'Night shift',ot:'Overtime',leave:'Leave',absent:'Absent',holiday:'Holiday work',real:'from actual attendance'}
    };
    const b = labels[userData.lang || 'vi'] || labels.vi;

    const bd = document.getElementById('salaryBreakdown');
    if(bd){
      const baseLine = mode === 'hour'
        ? `${b.hour}: ${baseHourTxt} × ${fmtN(rateHour)} = <strong>${fmtN(basePay)}</strong><br>`
        : `${b.present}: ${cm} ${b.day} × ${fmtN(rateDay)} = <strong>${fmtN(basePay)}</strong><br>`;
      bd.innerHTML =
        `<strong>${pr.flag || ''} ${ruleName}</strong>${basis ? ' · ' + basis : ''}<br>` +
        `<span style="color:#607080">${b.real}</span><br>` +
        baseLine +
        (nightPay > 0 ? `${b.night} (${nightDays} ${b.day}): <strong style="color:#7B5EA7">+${fmtN(nightPay)}</strong><br>` : '') +
        (otPay > 0 ? `${b.ot} (×${rule.otFactor || 1.5}): <strong style="color:#F5A623">+${fmtN(otPay)}</strong><br>` : '') +
        (leavePay > 0 ? `${b.leave}: ${np} ${b.day} = <strong>${fmtN(leavePay)}</strong><br>` : '') +
        (absentDeduct > 0 ? `${b.absent}: -${v} ${b.day} = <strong style="color:#E8433A">-${fmtN(absentDeduct)}</strong><br>` : '') +
        (holidayPay > 0 ? `${b.holiday}: ${ll} ${b.day} × ${rule.holidayFactor || 4} = <strong style="color:#2D7DD2">${fmtN(holidayPay)}</strong><br>` : '');

      const insLabel = typeof u === 'function' ? u('salary.insurance') : 'Bảo hiểm';
      const taxLabel = typeof u === 'function' ? u('salary.tax') : 'Thuế';
      const bhPct = bhTong > 0 && gross > 0 ? ' (' + (bhTong / gross * 100).toFixed(1) + '%)' : '';
      let insTxt = '';
      if(bhTong > 0) insTxt += `${insLabel}${bhPct}: <strong style="color:#E8433A">-${fmtN(bhTong)}</strong>`;
      if(thueTong > 0) insTxt += (insTxt ? '<br>' : '') + `${taxLabel}: <strong style="color:#E8433A">-${fmtN(thueTong)}</strong>`;
      if(insTxt) bd.innerHTML += insTxt;
    }

    safeSetText('salaryNet', fmtN(net));
    safeSetText('salaryAmount', fmtN(Math.max(0, gross)));
    const detEl = document.getElementById('salaryDetail');
    if(detEl){
      if(!raw) detEl.textContent = u('salary.detail_empty');
      else if(mode === 'hour') detEl.textContent = u('salary.detail_hour', {h:hourTxt, r:ruleName, n:fmtN(net)});
      else detEl.textContent = u('salary.detail_day', {d:paidDays, r:ruleName, n:fmtN(net)});
    }
    if(typeof saveUser === 'function') saveUser();
  }

  function renderHomeStatsActual(){
    const tl = typeof getLang === 'function' ? getLang() : {};
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let cm = 0, v = 0, np = 0, totalH = 0;
    for(let d = 1; d <= daysInMonth; d++){
      const rec = getAttRecordByDateParts(y,m,d);
      if(!rec) continue;
      if(rec.type === 'cm') cm++;
      else if(rec.type === 'vang') v++;
      else if(rec.type === 'np') np++;
      const h = actualWorkedHours(rec, dateKeyFromParts(y,m,d));
      // Cộng giờ đã làm tròn (≥30p lên, <30p xuống) để khớp với cách tính lương
      const hRounded = roundDailyHoursForSalary(h);
      if(hRounded != null) totalH += hRounded;
    }
    const ot = Math.max(0, totalH - 176);
    safeSetText('statCM', cm);
    safeSetText('statV', v);
    safeSetText('statNP', np);
    safeSetText('statOT', ot > 0 ? `${ot.toFixed(0)}h` : '0h');
    safeSetText('meterHours', `${totalH.toFixed(0)}h`);
    const fill = document.getElementById('meterFill');
    const mb = document.getElementById('meterBadge');
    const pct = Math.min(100, totalH / 260 * 100);
    let fillColor = 'linear-gradient(90deg,#0D9E75,#40E0D0)';
    let badgeTxt = tl.binhThuong || 'Bình thường', badgeBg = '#E0F5EE', badgeFg = '#0a7d5c';
    if(totalH > 220){
      fillColor = 'linear-gradient(90deg,#0D9E75,#F5A623,#E8433A)';
      badgeTxt = tl.quaSuc || 'Quá sức';
      badgeBg = '#FFF0EF';
      badgeFg = '#E8433A';
    }else if(totalH > 176){
      fillColor = 'linear-gradient(90deg,#0D9E75,#F5A623)';
      badgeTxt = tl.chamChi || 'Chăm chỉ';
      badgeBg = '#FFF8E8';
      badgeFg = '#cc8800';
    }
    if(fill){
      fill.style.width = `${Math.max(2, pct)}%`;
      fill.style.background = fillColor;
    }
    if(mb){
      mb.textContent = badgeTxt;
      mb.style.background = badgeBg;
      mb.style.color = badgeFg;
    }
    calcSalaryActual();
  }

  function renderHoursTableActual(){
    const now = new Date();
    const pr = typeof getPayrollRule === 'function' ? getPayrollRule() : {otFactor:1.5, nightFactor:1.3, holidayFactor:4};
    const shiftH = userData.hoursPerShift || 8;
    let days = [], label = '';

    if(typeof _salaryPeriod !== 'undefined' && _salaryPeriod === 'week'){
      const dow = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
      for(let i = 0; i < 7; i++){ const d = new Date(mon); d.setDate(mon.getDate() + i); days.push(d); }
      label = `${mon.getDate()}/${mon.getMonth()+1} - ${days[6].getDate()}/${days[6].getMonth()+1}/${now.getFullYear()}`;
    }else if(typeof _salaryPeriod === 'undefined' || _salaryPeriod === 'month'){
      const y = now.getFullYear(), m = now.getMonth(), nd = new Date(y, m + 1, 0).getDate();
      for(let g = 1; g <= nd; g++) days.push(new Date(y, m, g));
      const mn = (typeof getLang === 'function' && getLang().months) || ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
      label = mn[now.getMonth()] + ' ' + now.getFullYear();
    }else{
      const y = now.getFullYear();
      for(let m = 0; m < 12; m++){ const nd = new Date(y, m + 1, 0).getDate(); for(let g = 1; g <= nd; g++) days.push(new Date(y, m, g)); }
      label = ((typeof getLang === 'function' && getLang().year) || 'Năm') + ' ' + now.getFullYear();
    }

    let bH = 0, otH = 0, niH = 0, hoH = 0, bD = 0, otD = 0, niD = 0, hoD = 0;
    days.forEach(d => {
      const k = dateKeyFromDate(d);
      const rec = attData[k];
      if(!rec) return;
      const worked = actualWorkedHours(rec, k);
      if(worked == null) return;
      const nl = typeof gNL === 'function' ? gNL(d.getFullYear(), d.getMonth(), d.getDate()) : false;
      if(rec.type === 'll' || nl){
        hoH += worked;
        hoD++;
      }else if(rec.type === 'cm'){
        const basic = Math.min(worked, shiftH), ot = Math.max(0, worked - shiftH);
        bH += basic; if(basic > 0) bD++;
        otH += ot; if(ot > 0) otD++;
        const night = (typeof attendanceNightHours === 'function') ? attendanceNightHours(rec, k, pr.nightStart, pr.nightEnd) : ((typeof calcNightHours === 'function') ? calcNightHours(rec.in, rec.out, pr.nightStart, pr.nightEnd) : 0);
        niH += night; if(night > 0) niD++;
      }
    });

    const totH = bH + otH + niH + hoH, totD = bD + otD + niD + hoD;
    const wk = (typeof _salaryPeriod !== 'undefined' && _salaryPeriod === 'week') ? 1 : (typeof _salaryPeriod !== 'undefined' && _salaryPeriod === 'month') ? 4.33 : 52;
    const fn = v => v > 0 ? (Math.round(v * 10) / 10) + 'h' : '0h';
    const fd = v => v > 0 ? String(v) : '0';
    const fw = v => v > 0 ? (Math.round(v / wk * 10) / 10) + 'h' : '0h';
    const fm = v => {
      const period = typeof _salaryPeriod !== 'undefined' ? _salaryPeriod : 'month';
      const mv = period === 'month' ? v : period === 'week' ? v * 4.33 : v / 12;
      return mv > 0 ? (Math.round(mv * 10) / 10) + 'h' : '0h';
    };

    safeSetText('thTongGio', fn(totH)); safeSetText('thNgayCong', String(bD + hoD)); safeSetText('thTangCa', fn(otH));
    safeSetText('thBasicH', fn(bH)); safeSetText('thBasicD', fd(bD)); safeSetText('thBasicW', fw(bH)); safeSetText('thBasicM', fm(bH));
    safeSetText('thOTH', fn(otH)); safeSetText('thOTD', fd(otD)); safeSetText('thOTW', fw(otH)); safeSetText('thOTM', fm(otH));
    safeSetText('thNightH', fn(niH)); safeSetText('thNightD', fd(niD)); safeSetText('thNightW', fw(niH)); safeSetText('thNightM', fm(niH));
    safeSetText('thHolH', fn(hoH)); safeSetText('thHolD', fd(hoD)); safeSetText('thHolW', fw(hoH)); safeSetText('thHolM', fm(hoH));
    safeSetText('thTotalH', fn(totH)); safeSetText('thTotalD', fd(totD)); safeSetText('thTotalW', fw(totH)); safeSetText('thTotalM', fm(totH));
    safeSetText('thRowOTRate', '×' + (pr.otFactor || 1.5).toFixed(1));
    safeSetText('thRowNightRate', '+' + Math.round(((pr.nightFactor || 1.3) - 1) * 100) + '%');
    safeSetText('thRowHolRate', '×' + (pr.holidayFactor || 4).toFixed(1));
    safeSetText('thPeriodLabel', label);
    window._hoursData = {basicH:bH, otH, nightH:niH, holH:hoH, basicD:bD, totalD:totD};
  }

  window.calcSalary = calcSalaryActual;
  window.renderHomeStats = renderHomeStatsActual;
  window.renderHoursTable = renderHoursTableActual;
  try{ calcSalary = calcSalaryActual; }catch(e){}
  try{ renderHomeStats = renderHomeStatsActual; }catch(e){}
  try{ renderHoursTable = renderHoursTableActual; }catch(e){}
})();

/* PATCH v2.2.5 - Final hard-text i18n sweep for all 11 app languages */
(function(){
  const LANGS_11 = ['vi','en','ko','ja','zh','my','th','id','ph','ne','hi'];
  const HARD_TEXT = {
    heroTitle:{vi:'Chấm công đa quốc gia',en:'Multi-country attendance',ko:'다국가 출퇴근 관리',ja:'多国対応の勤怠管理',zh:'多国考勤管理',my:'နိုင်ငံစုံ အလုပ်ချိန်မှတ်တမ်း',th:'ลงเวลาหลายประเทศ',id:'Absensi multi-negara',ph:'Multi-country attendance',ne:'बहु-देशीय हाजिरी',hi:'बहु-देश उपस्थिति'},
    heroSub:{vi:'GPS, job phụ, lương, Excel/PDF và 11 ngôn ngữ trong một app.',en:'GPS, sub jobs, salary, Excel/PDF, and 11 languages in one app.',ko:'GPS, 부업, 급여, Excel/PDF, 11개 언어를 한 앱에서 관리합니다.',ja:'GPS、副業、給与、Excel/PDF、11言語を1つのアプリで管理します。',zh:'GPS、副业、工资、Excel/PDF 和 11 种语言集成在一个应用中。',my:'GPS၊ အပိုအလုပ်၊ လစာ၊ Excel/PDF နှင့် ဘာသာစကား ၁၁ မျိုးကို app တစ်ခုတည်းတွင် သုံးနိုင်သည်။',th:'GPS งานเสริม เงินเดือน Excel/PDF และ 11 ภาษาในแอปเดียว',id:'GPS, kerja sampingan, gaji, Excel/PDF, dan 11 bahasa dalam satu aplikasi.',ph:'GPS, sideline, sahod, Excel/PDF, at 11 wika sa iisang app.',ne:'GPS, सहायक काम, तलब, Excel/PDF र ११ भाषा एउटै app मा।',hi:'GPS, दूसरी नौकरी, वेतन, Excel/PDF और 11 भाषाएं एक ही app में।'},
    chooseLang:{vi:'Chọn ngôn ngữ bạn muốn dùng cho toàn bộ ứng dụng.',en:'Choose the language for the whole app.',ko:'앱 전체에서 사용할 언어를 선택하세요.',ja:'アプリ全体で使う言語を選択してください。',zh:'选择整个应用使用的语言。',my:'App တစ်ခုလုံးတွင် အသုံးပြုမည့် ဘာသာစကားကို ရွေးပါ။',th:'เลือกภาษาที่ต้องการใช้ทั้งแอป',id:'Pilih bahasa untuk seluruh aplikasi.',ph:'Piliin ang wikang gagamitin sa buong app.',ne:'पूरै app मा प्रयोग गर्ने भाषा छान्नुहोस्।',hi:'पूरे app के लिए भाषा चुनें।'},
    salaryTabHours:{vi:'⏱ Bảng giờ',en:'⏱ Hours',ko:'⏱ 근무시간',ja:'⏱ 時間表',zh:'⏱ 工时表',my:'⏱ နာရီဇယား',th:'⏱ ตารางชั่วโมง',id:'⏱ Jam kerja',ph:'⏱ Oras',ne:'⏱ घण्टा',hi:'⏱ घंटे'},
    salaryTabSalary:{vi:'💵 Bảng lương',en:'💵 Salary',ko:'💵 급여',ja:'💵 給与',zh:'💵 工资',my:'💵 လစာ',th:'💵 เงินเดือน',id:'💵 Gaji',ph:'💵 Sahod',ne:'💵 तलब',hi:'💵 वेतन'},
    periodWeek:{vi:'Tuần này',en:'This week',ko:'이번 주',ja:'今週',zh:'本周',my:'ဒီအပတ်',th:'สัปดาห์นี้',id:'Minggu ini',ph:'Linggong ito',ne:'यो हप्ता',hi:'इस सप्ताह'},
    periodMonth:{vi:'Tháng này',en:'This month',ko:'이번 달',ja:'今月',zh:'本月',my:'ဒီလ',th:'เดือนนี้',id:'Bulan ini',ph:'Buwang ito',ne:'यो महिना',hi:'इस महीने'},
    periodYear:{vi:'Năm nay',en:'This year',ko:'올해',ja:'今年',zh:'今年',my:'ဒီနှစ်',th:'ปีนี้',id:'Tahun ini',ph:'Taong ito',ne:'यो वर्ष',hi:'इस वर्ष'},
    totalHours:{vi:'Tổng giờ',en:'Total hours',ko:'총 시간',ja:'合計時間',zh:'总工时',my:'စုစုပေါင်းနာရီ',th:'ชั่วโมงรวม',id:'Total jam',ph:'Kabuuang oras',ne:'कुल घण्टा',hi:'कुल घंटे'},
    workDays:{vi:'Ngày công',en:'Workdays',ko:'근무일',ja:'勤務日',zh:'工作日',my:'အလုပ်ရက်',th:'วันทำงาน',id:'Hari kerja',ph:'Araw ng trabaho',ne:'काम दिन',hi:'कार्य दिवस'},
    overtime:{vi:'Tăng ca',en:'Overtime',ko:'초과근무',ja:'残業',zh:'加班',my:'အချိန်ပို',th:'ล่วงเวลา',id:'Lembur',ph:'Overtime',ne:'ओभरटाइम',hi:'ओवरटाइम'},
    hourType:{vi:'Loại giờ',en:'Hour type',ko:'시간 유형',ja:'時間区分',zh:'工时类型',my:'နာရီအမျိုးအစား',th:'ประเภทชั่วโมง',id:'Jenis jam',ph:'Uri ng oras',ne:'घण्टा प्रकार',hi:'घंटे का प्रकार'},
    hour:{vi:'Giờ',en:'Hours',ko:'시간',ja:'時間',zh:'小时',my:'နာရီ',th:'ชั่วโมง',id:'Jam',ph:'Oras',ne:'घण्टा',hi:'घंटे'},
    day:{vi:'Ngày',en:'Day',ko:'일',ja:'日',zh:'天',my:'ရက်',th:'วัน',id:'Hari',ph:'Araw',ne:'दिन',hi:'दिन'},
    week:{vi:'Tuần',en:'Week',ko:'주',ja:'週',zh:'周',my:'အပတ်',th:'สัปดาห์',id:'Minggu',ph:'Linggo',ne:'हप्ता',hi:'सप्ताह'},
    month:{vi:'Tháng',en:'Month',ko:'월',ja:'月',zh:'月',my:'လ',th:'เดือน',id:'Bulan',ph:'Buwan',ne:'महिना',hi:'माह'},
    basicHours:{vi:'🟢 Giờ cơ bản',en:'🟢 Basic hours',ko:'🟢 기본 시간',ja:'🟢 基本時間',zh:'🟢 基本工时',my:'🟢 အခြေခံနာရီ',th:'🟢 ชั่วโมงพื้นฐาน',id:'🟢 Jam dasar',ph:'🟢 Basic hours',ne:'🟢 आधारभूत घण्टा',hi:'🟢 मूल घंटे'},
    nightShift:{vi:'🌙 Ca đêm',en:'🌙 Night shift',ko:'🌙 야간',ja:'🌙 夜勤',zh:'🌙 夜班',my:'🌙 ညဆိုင်း',th:'🌙 กะกลางคืน',id:'🌙 Shift malam',ph:'🌙 Night shift',ne:'🌙 रात्री सिफ्ट',hi:'🌙 रात की शिफ्ट'},
    holidayWork:{vi:'🎌 Ngày lễ',en:'🎌 Holiday',ko:'🎌 공휴일',ja:'🎌 祝日',zh:'🎌 节假日',my:'🎌 ရုံးပိတ်ရက်',th:'🎌 วันหยุด',id:'🎌 Hari libur',ph:'🎌 Holiday',ne:'🎌 बिदा',hi:'🎌 अवकाश'},
    total:{vi:'📊 Tổng',en:'📊 Total',ko:'📊 합계',ja:'📊 合計',zh:'📊 合计',my:'📊 စုစုပေါင်း',th:'📊 รวม',id:'📊 Total',ph:'📊 Kabuuan',ne:'📊 कुल',hi:'📊 कुल'},
    salaryMode:{vi:'Cách trả lương',en:'Pay method',ko:'급여 방식',ja:'給与方式',zh:'工资方式',my:'လစာပေးချေမှု',th:'วิธีจ่ายเงิน',id:'Metode gaji',ph:'Paraan ng sahod',ne:'तलब विधि',hi:'वेतन विधि'},
    byMonth:{vi:'Theo tháng',en:'Monthly',ko:'월급',ja:'月給',zh:'按月',my:'လစဉ်',th:'รายเดือน',id:'Bulanan',ph:'Buwanang',ne:'मासिक',hi:'मासिक'},
    byDay:{vi:'Theo ngày',en:'Daily',ko:'일급',ja:'日給',zh:'按天',my:'နေ့စဉ်',th:'รายวัน',id:'Harian',ph:'Arawan',ne:'दैनिक',hi:'दैनिक'},
    byHour:{vi:'Theo giờ',en:'Hourly',ko:'시급',ja:'時給',zh:'按小时',my:'နာရီလိုက်',th:'รายชั่วโมง',id:'Per jam',ph:'Orasan',ne:'घण्टाको',hi:'प्रति घंटा'},
    estSalary:{vi:'Lương ước tính tháng này',en:'Estimated salary this month',ko:'이번 달 예상 급여',ja:'今月の推定給与',zh:'本月预计工资',my:'ဒီလ ခန့်မှန်းလစာ',th:'เงินเดือนประมาณเดือนนี้',id:'Estimasi gaji bulan ini',ph:'Tinatayang sahod ngayong buwan',ne:'यो महिनाको अनुमानित तलब',hi:'इस महीने का अनुमानित वेतन'},
    estNet:{vi:'Thực nhận ước tính',en:'Estimated net pay',ko:'예상 실수령액',ja:'推定手取り',zh:'预计实收',my:'ခန့်မှန်းလက်ခံငွေ',th:'รายได้สุทธิประมาณ',id:'Estimasi bersih',ph:'Tinatayang net pay',ne:'अनुमानित शुद्ध तलब',hi:'अनुमानित शुद्ध वेतन'},
    saveSalary:{vi:'✓ Lưu thông tin lương',en:'✓ Save salary info',ko:'✓ 급여 정보 저장',ja:'✓ 給与情報を保存',zh:'✓ 保存工资信息',my:'✓ လစာအချက်အလက် သိမ်း',th:'✓ บันทึกเงินเดือน',id:'✓ Simpan info gaji',ph:'✓ I-save ang sahod',ne:'✓ तलब जानकारी सुरक्षित',hi:'✓ वेतन जानकारी सहेजें'},
    saved:{vi:'✓ Đã lưu',en:'✓ Saved',ko:'✓ 저장됨',ja:'✓ 保存しました',zh:'✓ 已保存',my:'✓ သိမ်းပြီး',th:'✓ บันทึกแล้ว',id:'✓ Tersimpan',ph:'✓ Nai-save',ne:'✓ सुरक्षित भयो',hi:'✓ सहेजा गया'},
    excelPreview:{vi:'Xem trước dữ liệu xuất ra:',en:'Export preview:',ko:'내보내기 미리보기:',ja:'出力プレビュー:',zh:'导出预览：',my:'Export preview:',th:'ตัวอย่างข้อมูลส่งออก:',id:'Pratinjau ekspor:',ph:'Preview ng export:',ne:'निर्यात पूर्वावलोकन:',hi:'निर्यात पूर्वावलोकन:'},
    date:{vi:'Ngày',en:'Date',ko:'날짜',ja:'日付',zh:'日期',my:'ရက်',th:'วันที่',id:'Tanggal',ph:'Petsa',ne:'मिति',hi:'तारीख'},
    dow:{vi:'Thứ',en:'Day',ko:'요일',ja:'曜日',zh:'星期',my:'နေ့',th:'วัน',id:'Hari',ph:'Araw',ne:'बार',hi:'दिन'},
    status:{vi:'Trạng thái',en:'Status',ko:'상태',ja:'状態',zh:'状态',my:'အခြေအနေ',th:'สถานะ',id:'Status',ph:'Katayuan',ne:'अवस्था',hi:'स्थिति'},
    inTime:{vi:'Giờ vào',en:'In',ko:'출근',ja:'出勤',zh:'上班',my:'တက်',th:'เข้า',id:'Masuk',ph:'Pasok',ne:'प्रवेश',hi:'प्रवेश'},
    outTime:{vi:'Giờ ra',en:'Out',ko:'퇴근',ja:'退勤',zh:'下班',my:'ဆင်း',th:'ออก',id:'Keluar',ph:'Labas',ne:'निस्कने',hi:'प्रस्थान'},
    exportFilter:{vi:'LỌC DỮ LIỆU',en:'EXPORT FILTER',ko:'내보내기 필터',ja:'出力フィルター',zh:'导出筛选',my:'Export filter',th:'ตัวกรองส่งออก',id:'FILTER EKSPOR',ph:'EXPORT FILTER',ne:'निर्यात फिल्टर',hi:'निर्यात फ़िल्टर'},
    all:{vi:'Tất cả',en:'All',ko:'전체',ja:'すべて',zh:'全部',my:'အားလုံး',th:'ทั้งหมด',id:'Semua',ph:'Lahat',ne:'सबै',hi:'सभी'},
    mainJob:{vi:'Job chính',en:'Main job',ko:'주업무',ja:'本業',zh:'主业',my:'အဓိကအလုပ်',th:'งานหลัก',id:'Pekerjaan utama',ph:'Pangunahing trabaho',ne:'मुख्य काम',hi:'मुख्य नौकरी'},
    subJob:{vi:'Job phụ',en:'Sub job',ko:'부업',ja:'副業',zh:'副业',my:'အပိုအလုပ်',th:'งานเสริม',id:'Pekerjaan sampingan',ph:'Sideline',ne:'सहायक काम',hi:'दूसरी नौकरी'},
    fileName:{vi:'TÊN FILE',en:'FILE NAME',ko:'파일 이름',ja:'ファイル名',zh:'文件名',my:'ဖိုင်အမည်',th:'ชื่อไฟล์',id:'NAMA FILE',ph:'PANGALAN NG FILE',ne:'फाइल नाम',hi:'फ़ाइल नाम'},
    exportCsv:{vi:'📊 Xuất file Excel (.csv)',en:'📊 Export Excel (.csv)',ko:'📊 Excel CSV 내보내기',ja:'📊 Excel CSV出力',zh:'📊 导出 Excel CSV',my:'📊 Excel CSV ထုတ်',th:'📊 ส่งออก Excel CSV',id:'📊 Ekspor Excel CSV',ph:'📊 I-export Excel CSV',ne:'📊 Excel CSV निर्यात',hi:'📊 Excel CSV निर्यात'},
    exportPdf:{vi:'📄 Xuất file PDF',en:'📄 Export PDF',ko:'📄 PDF 내보내기',ja:'📄 PDF出力',zh:'📄 导出 PDF',my:'📄 PDF ထုတ်',th:'📄 ส่งออก PDF',id:'📄 Ekspor PDF',ph:'📄 I-export PDF',ne:'📄 PDF निर्यात',hi:'📄 PDF निर्यात'},
    dayResetShift:{vi:'Đặt lại theo ca',en:'Reset to shift',ko:'근무시간으로 재설정',ja:'シフトに戻す',zh:'按班次重置',my:'ဆိုင်းအတိုင်းပြန်ထား',th:'รีเซ็ตตามกะ',id:'Reset ke shift',ph:'I-reset sa shift',ne:'सिफ्ट अनुसार रिसेट',hi:'शिफ्ट के अनुसार रीसेट'},
    daySubTitle:{vi:'💼 Thêm ca job phụ',en:'💼 Add sub-job shift',ko:'💼 부업 근무 추가',ja:'💼 副業シフトを追加',zh:'💼 添加副业班次',my:'💼 အပိုအလုပ်ဆိုင်း ထည့်',th:'💼 เพิ่มกะงานเสริม',id:'💼 Tambah shift sampingan',ph:'💼 Magdagdag ng sideline shift',ne:'💼 सहायक काम सिफ्ट थप्नुहोस्',hi:'💼 दूसरी नौकरी की शिफ्ट जोड़ें'},
    daySubDesc:{vi:'Nhập giờ làm job phụ cùng ngày',en:'Enter sub-job hours for this day',ko:'이 날짜의 부업 시간을 입력하세요',ja:'この日の副業時間を入力',zh:'输入当天副业工时',my:'ဒီနေ့အပိုအလုပ်ချိန် ထည့်ပါ',th:'ใส่เวลางานเสริมของวันนี้',id:'Masukkan jam kerja sampingan hari ini',ph:'Ilagay ang oras ng sideline ngayong araw',ne:'आजको सहायक काम समय राख्नुहोस्',hi:'आज की दूसरी नौकरी का समय दर्ज करें'},
    subIn:{vi:'Giờ vào (phụ)',en:'In (sub)',ko:'출근 (부업)',ja:'出勤（副）',zh:'上班（副业）',my:'တက် (အပို)',th:'เข้า (เสริม)',id:'Masuk (sampingan)',ph:'Pasok (side)',ne:'प्रवेश (सहायक)',hi:'प्रवेश (दूसरी)'},
    subOut:{vi:'Giờ ra (phụ)',en:'Out (sub)',ko:'퇴근 (부업)',ja:'退勤（副）',zh:'下班（副业）',my:'ဆင်း (အပို)',th:'ออก (เสริม)',id:'Keluar (sampingan)',ph:'Labas (side)',ne:'निस्कने (सहायक)',hi:'प्रस्थान (दूसरी)'},
    cancel:{vi:'Hủy bỏ',en:'Cancel',ko:'취소',ja:'キャンセル',zh:'取消',my:'မလုပ်တော့ပါ',th:'ยกเลิก',id:'Batal',ph:'Kanselahin',ne:'रद्द',hi:'रद्द करें'},
    save:{vi:'Lưu lại',en:'Save',ko:'저장',ja:'保存',zh:'保存',my:'သိမ်း',th:'บันทึก',id:'Simpan',ph:'I-save',ne:'सुरक्षित',hi:'सहेजें'},
    deleteAll:{vi:'🗑 Xóa hết',en:'🗑 Delete all',ko:'🗑 모두 삭제',ja:'🗑 すべて削除',zh:'🗑 全部删除',my:'🗑 အားလုံးဖျက်',th:'🗑 ลบทั้งหมด',id:'🗑 Hapus semua',ph:'🗑 Burahin lahat',ne:'🗑 सबै मेटाउनुहोस्',hi:'🗑 सभी हटाएं'},
    resetTitle:{vi:'Xóa toàn bộ dữ liệu?',en:'Delete all data?',ko:'모든 데이터를 삭제할까요?',ja:'すべてのデータを削除しますか？',zh:'删除所有数据？',my:'ဒေတာအားလုံး ဖျက်မလား?',th:'ลบข้อมูลทั้งหมด?',id:'Hapus semua data?',ph:'Burahin lahat ng data?',ne:'सबै डेटा मेटाउने?',hi:'सभी डेटा हटाएं?'},
    aboutDesc:{vi:'App chấm công thông minh hỗ trợ 11 ngôn ngữ, GPS, job phụ, tính lương theo quốc gia và xuất Excel/PDF. Dữ liệu lưu trên thiết bị.',en:'Smart attendance app with 11 languages, GPS, sub jobs, country-based salary, and Excel/PDF export. Data stays on your device.',ko:'11개 언어, GPS, 부업, 국가별 급여 계산, Excel/PDF 내보내기를 지원하는 스마트 근태 앱입니다. 데이터는 기기에 저장됩니다.',ja:'11言語、GPS、副業、国別給与計算、Excel/PDF出力に対応した勤怠アプリです。データは端末に保存されます。',zh:'支持 11 种语言、GPS、副业、按国家计算工资和 Excel/PDF 导出的智能考勤应用。数据保存在设备上。',my:'ဘာသာစကား ၁၁ မျိုး၊ GPS၊ အပိုအလုပ်၊ နိုင်ငံအလိုက် လစာတွက်ချက်မှုနှင့် Excel/PDF export ပါသော app ဖြစ်သည်။ ဒေတာကို စက်ထဲတွင်သိမ်းသည်။',th:'แอปลงเวลาอัจฉริยะ รองรับ 11 ภาษา GPS งานเสริม คำนวณเงินเดือนตามประเทศ และส่งออก Excel/PDF ข้อมูลเก็บในอุปกรณ์',id:'Aplikasi absensi cerdas dengan 11 bahasa, GPS, pekerjaan sampingan, gaji berbasis negara, dan ekspor Excel/PDF. Data tersimpan di perangkat.',ph:'Smart attendance app na may 11 wika, GPS, sideline, salary per country, at Excel/PDF export. Nasa device ang data.',ne:'११ भाषा, GPS, सहायक काम, देश अनुसार तलब र Excel/PDF निर्यात भएको smart attendance app। डेटा तपाईंको device मै रहन्छ।',hi:'11 भाषाओं, GPS, दूसरी नौकरी, देश-आधारित वेतन और Excel/PDF export वाला smart attendance app। डेटा आपके device में रहता है।'},
    gpsTightTitle:{vi:'Ở công ty: GPS chặt',en:'At company: tight GPS',ko:'회사 근처: 정밀 GPS',ja:'会社付近: 厳密GPS',zh:'公司附近：严格 GPS',my:'ကုမ္ပဏီတွင်: GPS တင်းကျပ်',th:'ที่บริษัท: GPS เข้มงวด',id:'Di kantor: GPS ketat',ph:'Sa kumpanya: mahigpit na GPS',ne:'कम्पनीमा: कडा GPS',hi:'कंपनी में: सख्त GPS'},
    gpsTightHint:{vi:'Dùng bán kính 15m và vùng đệm 20m, vẫn chấm vào/ra bằng GPS.',en:'Use 15m radius and 20m buffer; GPS still clocks in/out.',ko:'15m 반경과 20m 버퍼를 사용하며 GPS 출퇴근은 계속 동작합니다.',ja:'半径15mと20mのバッファを使い、GPS打刻は維持します。',zh:'使用 15m 半径和 20m 缓冲区，仍通过 GPS 打卡。',my:'15m radius နှင့် 20m buffer သုံးပြီး GPS ဖြင့် ဆက်လက် မှတ်တမ်းတင်သည်။',th:'ใช้รัศมี 15m และ buffer 20m ยังลงเวลาเข้า/ออกด้วย GPS',id:'Gunakan radius 15m dan buffer 20m; GPS tetap absen masuk/keluar.',ph:'Gamit ang 15m radius at 20m buffer; GPS pa rin ang in/out.',ne:'१५m radius र २०m buffer प्रयोग हुन्छ; GPS ले नै प्रवेश/निस्कने गर्छ।',hi:'15m radius और 20m buffer का उपयोग; GPS से in/out जारी रहेगा।'},
    gpsPermTitle:{vi:'⚠️ Chưa cấp quyền vị trí',en:'⚠️ Location permission missing',ko:'⚠️ 위치 권한 없음',ja:'⚠️ 位置情報権限がありません',zh:'⚠️ 未授予位置权限',my:'⚠️ တည်နေရာခွင့်ပြုချက် မရှိသေး',th:'⚠️ ยังไม่ได้ให้สิทธิ์ตำแหน่ง',id:'⚠️ Izin lokasi belum ada',ph:'⚠️ Walang location permission',ne:'⚠️ स्थान अनुमति छैन',hi:'⚠️ स्थान अनुमति नहीं है'},
    gpsPermBody:{vi:'Vào <b>Cài đặt → Ứng dụng → Quyền</b> để bật vị trí.',en:'Open <b>Settings → Apps → Permissions</b> to enable Location.',ko:'<b>설정 → 앱 → 권한</b>에서 위치를 켜세요.',ja:'<b>設定 → アプリ → 権限</b>で位置情報を有効にしてください。',zh:'前往<b>设置 → 应用 → 权限</b>开启位置。',my:'<b>Settings → Apps → Permissions</b> တွင် Location ကို ဖွင့်ပါ။',th:'ไปที่ <b>ตั้งค่า → แอป → สิทธิ์</b> เพื่อเปิดตำแหน่ง',id:'Buka <b>Setelan → Aplikasi → Izin</b> untuk mengaktifkan Lokasi.',ph:'Buksan ang <b>Settings → Apps → Permissions</b> para i-on ang Location.',ne:'स्थान खोल्न <b>Settings → Apps → Permissions</b> मा जानुहोस्।',hi:'स्थान चालू करने के लिए <b>Settings → Apps → Permissions</b> खोलें।'},
    gpsHostTitle:{vi:'🌐 Cấp quyền GPS',en:'🌐 Enable GPS permission',ko:'🌐 GPS 권한 켜기',ja:'🌐 GPS権限を有効化',zh:'🌐 启用 GPS 权限',my:'🌐 GPS ခွင့်ပြုချက် ဖွင့်',th:'🌐 เปิดสิทธิ์ GPS',id:'🌐 Aktifkan izin GPS',ph:'🌐 I-enable GPS permission',ne:'🌐 GPS अनुमति खोल्नुहोस्',hi:'🌐 GPS अनुमति चालू करें'},
    gpsHostBody:{vi:'Upload lên <b>GitHub Pages</b> hoặc <b>Netlify</b> → mở HTTPS → GPS hoạt động.',en:'Upload to <b>GitHub Pages</b> or <b>Netlify</b> → open HTTPS → GPS works.',ko:'<b>GitHub Pages</b> 또는 <b>Netlify</b>에 업로드 → HTTPS로 열면 GPS가 동작합니다.',ja:'<b>GitHub Pages</b>または<b>Netlify</b>へアップロード → HTTPSで開くとGPSが動作します。',zh:'上传到 <b>GitHub Pages</b> 或 <b>Netlify</b> → 用 HTTPS 打开 → GPS 可用。',my:'<b>GitHub Pages</b> သို့မဟုတ် <b>Netlify</b> သို့ upload → HTTPS ဖြင့်ဖွင့် → GPS အသုံးပြုနိုင်သည်။',th:'อัปโหลดไป <b>GitHub Pages</b> หรือ <b>Netlify</b> → เปิดผ่าน HTTPS → GPS ใช้งานได้',id:'Upload ke <b>GitHub Pages</b> atau <b>Netlify</b> → buka HTTPS → GPS berfungsi.',ph:'I-upload sa <b>GitHub Pages</b> o <b>Netlify</b> → buksan HTTPS → gagana ang GPS.',ne:'<b>GitHub Pages</b> वा <b>Netlify</b> मा upload → HTTPS खोल्नुहोस् → GPS चल्छ।',hi:'<b>GitHub Pages</b> या <b>Netlify</b> पर upload → HTTPS खोलें → GPS चलेगा।'},
    gpsTip:{vi:'💡 Sau khi lưu vị trí, app dùng GPS để tự chấm công.',en:'💡 After saving location, the app uses GPS for automatic attendance.',ko:'💡 위치 저장 후 앱이 GPS로 자동 출퇴근을 기록합니다.',ja:'💡 位置を保存すると、GPSで自動打刻します。',zh:'💡 保存位置后，应用会用 GPS 自动打卡。',my:'💡 တည်နေရာသိမ်းပြီးပါက app သည် GPS ဖြင့် auto attendance လုပ်သည်။',th:'💡 หลังบันทึกตำแหน่ง แอปจะใช้ GPS ลงเวลาอัตโนมัติ',id:'💡 Setelah lokasi disimpan, aplikasi memakai GPS untuk absensi otomatis.',ph:'💡 Pag na-save ang lokasyon, GPS ang gagamitin para sa auto attendance.',ne:'💡 स्थान सुरक्षित भएपछि app ले GPS बाट auto attendance गर्छ।',hi:'💡 स्थान सहेजने के बाद app GPS से auto attendance करता है।'},
    splashQuote:{vi:'Chào buổi sáng! Chăm chỉ hôm nay, thanh thản ngày mai.',en:'Good morning! Work steadily today, breathe easier tomorrow.',ko:'좋은 아침입니다! 오늘의 성실함이 내일을 가볍게 합니다.',ja:'おはようございます。今日の積み重ねが明日の安心になります。',zh:'早上好！今天认真一点，明天轻松一点。',my:'မင်္ဂလာနံနက်ခင်းပါ။ ဒီနေ့ကြိုးစားမှုက မနက်ဖြန်ကို ပိုအေးချမ်းစေပါသည်။',th:'สวัสดีตอนเช้า! ตั้งใจวันนี้ พรุ่งนี้สบายใจขึ้น',id:'Selamat pagi! Tekun hari ini, lebih tenang esok hari.',ph:'Magandang umaga! Sipag ngayon, gaan bukas.',ne:'शुभ प्रभात! आजको मेहनतले भोलि सहज बनाउँछ।',hi:'सुप्रभात! आज मेहनत करें, कल सुकून मिलेगा।'},
    enterNameAlert:{vi:'Vui lòng nhập họ và tên!',en:'Please enter your full name!',ko:'이름을 입력하세요!',ja:'氏名を入力してください！',zh:'请输入姓名！',my:'အမည်အပြည့်အစုံ ထည့်ပါ။',th:'กรุณากรอกชื่อ-นามสกุล!',id:'Masukkan nama lengkap!',ph:'Ilagay ang buong pangalan!',ne:'कृपया पूरा नाम राख्नुहोस्!',hi:'कृपया पूरा नाम दर्ज करें!'},
    apkOnly:{vi:'⚠️ Chỉ hoạt động trong APK Android',en:'⚠️ Only works in the Android APK',ko:'⚠️ Android APK에서만 동작합니다',ja:'⚠️ Android APKでのみ動作します',zh:'⚠️ 仅在 Android APK 中可用',my:'⚠️ Android APK တွင်သာ အသုံးပြုနိုင်သည်',th:'⚠️ ใช้ได้เฉพาะ Android APK',id:'⚠️ Hanya berfungsi di APK Android',ph:'⚠️ Gumagana lang sa Android APK',ne:'⚠️ Android APK मा मात्र काम गर्छ',hi:'⚠️ केवल Android APK में काम करता है'},
    settingsOpenFail:{vi:'⚠️ Không mở được cài đặt: {err}',en:'⚠️ Could not open settings: {err}',ko:'⚠️ 설정을 열 수 없습니다: {err}',ja:'⚠️ 設定を開けません: {err}',zh:'⚠️ 无法打开设置：{err}',my:'⚠️ Settings ဖွင့်မရပါ: {err}',th:'⚠️ เปิดการตั้งค่าไม่ได้: {err}',id:'⚠️ Tidak bisa membuka setelan: {err}',ph:'⚠️ Hindi mabuksan ang settings: {err}',ne:'⚠️ Settings खोल्न सकिएन: {err}',hi:'⚠️ सेटिंग नहीं खुली: {err}'}
  };

  function lang(){
    try{
      const l = (window.userData && userData.lang) || localStorage.getItem('cp22_lang_ui') || localStorage.getItem('lang') || 'vi';
      return LANGS_11.includes(l) ? l : 'vi';
    }catch(e){ return 'vi'; }
  }
  function tr(key, subs){
    const L = lang();
    let txt;
    if(HARD_TEXT[key]) txt = HARD_TEXT[key][L] || HARD_TEXT[key].en || HARD_TEXT[key].vi;
    if(!txt && typeof u === 'function'){
      const v = u(key);
      if(v && v !== key) txt = v;
    }
    if(!txt && typeof TRAN !== 'undefined'){
      const pack = TRAN[L] || TRAN.vi || {};
      txt = pack[key];
    }
    txt = txt || key;
    if(subs) Object.keys(subs).forEach(k => { txt = txt.replace('{'+k+'}', subs[k]); });
    return txt;
  }
  function setText(id, key){
    const el = document.getElementById(id);
    if(el) el.textContent = tr(key);
  }
  function setHtml(id, key){
    const el = document.getElementById(id);
    if(el) el.innerHTML = tr(key);
  }
  function setAttr(id, attr, key){
    const el = document.getElementById(id);
    if(el) el.setAttribute(attr, tr(key));
  }
  function qText(sel, key){
    const el = document.querySelector(sel);
    if(el) el.textContent = tr(key);
  }
  function qHtml(sel, key){
    const el = document.querySelector(sel);
    if(el) el.innerHTML = tr(key);
  }

  function syncSalaryHardText(){
    setText('tabHours','salaryTabHours');
    setText('tabSalary','salaryTabSalary');
    setText('pbWeek','periodWeek');
    setText('pbMonth','periodMonth');
    setText('pbYear','periodYear');
    setText('thTongGioLbl','totalHours');
    setText('thNgayCongLbl','workDays');
    setText('thTangCaLbl','overtime');
    setText('thHLoai','hourType');
    setText('thHGio','hour');
    setText('thHNgay','day');
    setText('thHTuan','week');
    setText('thHThang','month');
    setText('thRowBasicLbl','basicHours');
    setText('thRowOTLbl','overtime');
    setText('thRowNightLbl','nightShift');
    setText('thRowHolLbl','holidayWork');
    setText('thRowTotalLbl','total');
    setText('salaryModeLbl','salaryMode');
    setText('smLblMonth','byMonth');
    setText('smLblDay','byDay');
    setText('smLblHour','byHour');
    setText('salaryEstTitle','estSalary');
    setText('salaryNetLabel','estNet');
    setText('btnSaveSalary','saveSalary');
    const btn = document.getElementById('btnSaveSalary');
    if(btn && !btn._i18nSaveHooked){
      btn.onclick = function(){
        if(typeof calcSalary === 'function') calcSalary();
        if(typeof showGpsBanner === 'function') showGpsBanner(tr('saved'), '#0D9E75');
      };
      btn._i18nSaveHooked = true;
    }
  }

  function syncExcelHardText(){
    setText('excelPreviewLbl','excelPreview');
    setText('excelFilterLbl','exportFilter');
    setText('efAll','all');
    setText('efMain','mainJob');
    setText('efSub','subJob');
    setText('excelFilenameLbl','fileName');
    const headers = ['date','dow','status','inTime','outTime'];
    document.querySelectorAll('#excelPreview .excel-row.head .excel-cell').forEach((el,i) => {
      if(headers[i]) el.textContent = tr(headers[i]);
    });
    const btn = document.getElementById('excelExportBtn');
    if(btn) btn.textContent = (window._exportFormat === 'pdf') ? tr('exportPdf') : tr('exportCsv');
    const fmt = document.querySelector('#excelFormatRow > div:first-child');
    if(fmt) fmt.textContent = tr('format');
  }

  function syncDayPanelHardText(){
    setText('dpStatusLbl','dpStatus');
    setText('dpActualLbl','dpActual');
    setText('dpInTimeLbl','inTime');
    setText('dpOutTimeLbl','outTime');
    setText('dpNoteLbl','dpNote');
    setAttr('dayNote','placeholder','dpNoteP');
    setText('dayCancelBtn','cancel');
    setText('daySaveBtn','save');
    qText('#dayTimeBlock span[onclick="dayResetTime()"]','dayResetShift');
    setText('daySubJobName','daySubTitle');
    qText('#dayJobTypeRow > div > div:nth-child(2)','daySubDesc');
    qText('#daySubFields > div:first-child > div','subIn');
    qText('#daySubFields > div:nth-child(2) > div','subOut');
  }

  function syncGpsHardText(){
    setText('gpsTightCompanyLbl','gpsTightTitle');
    setText('gpsTightCompanyHint','gpsTightHint');
    setText('gpsPermTitle','gpsPermTitle');
    setHtml('gpsPermBody','gpsPermBody');
    setText('gpsHostTitle','gpsHostTitle');
    qHtml('#gpsHostTitle + div','gpsHostBody');
    setText('gpsTip','gpsTip');
    setText('gpsV3StatsBtn','gpsv3.refresh');
    setText('gpsV3TrailBtn','gpsv3.trail_today');
    const status = document.getElementById('gpsStatusTxt');
    if(status){
      const raw = status.textContent || '';
      if(/Chưa thiết lập|Company location not set|회사|会社|公司|ကုမ္ပဏီ|ตำแหน่งบริษัท|kantor|कम्पनी|कंपनी/i.test(raw) && !/[()]/.test(raw)){
        status.textContent = tr('gps.no_setup');
      }
    }
  }

  function syncResetAndAbout(){
    qText('#panelConfirmReset [style*="E8433A"]','resetTitle');
    qText('#panelConfirmReset button:first-child','cancel');
    qText('#panelConfirmReset button:last-child','deleteAll');
    const aboutDesc = document.querySelector('#panelAbout [style*="line-height:1.6"]');
    if(aboutDesc) aboutDesc.textContent = tr('aboutDesc');
  }

  function syncOnboardingHardText(){
    const title = document.querySelector('.ob-hero-title');
    const sub = document.querySelector('.ob-hero-sub');
    if(title) title.textContent = tr('heroTitle');
    if(sub) sub.textContent = tr('heroSub');
    const obSub = document.querySelector('#obBody .ob-sub');
    if(obSub && /ngôn ngữ|language|언어|言語|语言|ဘာသာ|ภาษา|bahasa|wika|भाषा/i.test(obSub.textContent || '')){
      obSub.textContent = tr('chooseLang');
    }
  }

  function syncSplash(){
    setText('spDv','splash.days_present');
    setText('spNut','splash.start_btn');
    setText('spCau','splashQuote');
  }

  function syncStatic(){
    const L = lang();
    document.documentElement.lang = L;
    if(typeof getLang === 'function'){
      const pack = getLang();
      if(pack && pack.appName) document.title = pack.appName;
    }
    syncSalaryHardText();
    syncExcelHardText();
    syncDayPanelHardText();
    syncGpsHardText();
    syncResetAndAbout();
    syncOnboardingHardText();
    syncSplash();
  }

  function wrap(name){
    const fn = window[name];
    if(typeof fn !== 'function' || fn._hardI18nWrapped) return;
    const wrapped = function(){
      const result = fn.apply(this, arguments);
      setTimeout(syncStatic, 0);
      setTimeout(syncStatic, 80);
      return result;
    };
    wrapped._hardI18nWrapped = true;
    window[name] = wrapped;
  }

  function patchAlert(){
    if(window.alert && !window.alert._hardI18nWrapped){
      const rawAlert = window.alert;
      const patched = function(msg){
        let out = String(msg == null ? '' : msg);
        if(out === 'Vui lòng nhập họ và tên!') out = tr('enterNameAlert');
        else if(out === '⚠️ Chỉ hoạt động trong APK' || out === '⚠️ Chỉ hoạt động trong APK Android') out = tr('apkOnly');
        else if(out.indexOf('Không mở được cài đặt:') >= 0){
          out = tr('settingsOpenFail', {err: out.split('Không mở được cài đặt:').pop().trim()});
        }
        return rawAlert.call(this, out);
      };
      patched._hardI18nWrapped = true;
      window.alert = patched;
    }
  }

  function bootHardI18n(){
    patchAlert();
    ['applyI18n','renderOB','initHome','openPanel','openPanelGPS','renderCalBig','renderCalDayList','renderExcelPreview','updateExcelPanel','renderSetupSubJob','renderSubJobSalary','renderHoursTable','calcSalary','switchSalaryTab','setSalaryPeriod','setSalaryMode','openDayPanel','renderDayStatusGrid','updateDayJobTypeUI','refreshBgStatus','updateGpsStatus'].forEach(wrap);
    syncStatic();
  }

  document.addEventListener('DOMContentLoaded', () => {
    bootHardI18n();
    setTimeout(syncStatic, 250);
    setTimeout(syncStatic, 800);
  });
  setTimeout(bootHardI18n, 0);
  setTimeout(syncStatic, 1200);
  window.syncAllHardTextI18n = syncStatic;
})();

  var oldDoExport=window.doExport; window.doExport=function(){if(_exportFormat==='pdf')return downloadPdf();if(typeof oldDoExport==='function')return oldDoExport();};
  try{ensureGpsV221();}catch(e){}
})();


/* ═══════════════════════════════════════════════════════════════ */
/* PATCHES — v2.2.x */
/* ═══════════════════════════════════════════════════════════════ */


/* PATCH v2.2.2 — Calendar harmony + language sync for Sub Job / GPS / PDF */
(function(){
  const I18N2={
    vi:{filter:'LỌC DỮ LIỆU',all:'Tất cả',filename:'TÊN FILE',format:'ĐỊNH DẠNG FILE',csvBtn:'📊 Xuất file Excel (.csv)',pdfBtn:'📄 Xuất file PDF',gpsTarget:'🎯 GPS ÁP DỤNG CHO JOB',saved:'Đã lưu',notSaved:'Chưa lưu',gpsHint:'Chọn job rồi bấm “Lấy vị trí hiện tại” để lưu GPS riêng cho job đó.',print:'In / Lưu PDF',report:'Chấm Công Pro — Báo cáo chấm công',rows:'dòng dữ liệu',date:'Ngày',day:'Thứ',job:'Job',status:'Trạng thái',inn:'Vào',out:'Ra',hours:'Giờ',type:'Loại',note:'Ghi chú'},
    en:{filter:'DATA FILTER',all:'All',filename:'FILE NAME',format:'FILE FORMAT',csvBtn:'📊 Export Excel (.csv)',pdfBtn:'📄 Export PDF',gpsTarget:'🎯 GPS TARGET JOB',saved:'Saved',notSaved:'Not saved',gpsHint:'Choose a job, then tap “Get current location” to save GPS separately.',print:'Print / Save PDF',report:'Work Tracker Pro — Attendance report',rows:'data rows',date:'Date',day:'Day',job:'Job',status:'Status',inn:'In',out:'Out',hours:'Hours',type:'Type',note:'Note'},
    ko:{filter:'데이터 필터',all:'전체',filename:'파일 이름',format:'파일 형식',csvBtn:'📊 Excel 내보내기 (.csv)',pdfBtn:'📄 PDF 내보내기',gpsTarget:'🎯 GPS 적용 작업',saved:'저장됨',notSaved:'미저장',gpsHint:'작업을 선택한 뒤 “현재 위치 가져오기”를 눌러 GPS를 따로 저장하세요.',print:'인쇄 / PDF 저장',report:'근태 Pro — 근태 보고서',rows:'개 데이터',date:'날짜',day:'요일',job:'작업',status:'상태',inn:'출근',out:'퇴근',hours:'시간',type:'유형',note:'메모'},
    ja:{filter:'データフィルター',all:'すべて',filename:'ファイル名',format:'ファイル形式',csvBtn:'📊 Excel出力 (.csv)',pdfBtn:'📄 PDF出力',gpsTarget:'🎯 GPS対象ジョブ',saved:'保存済み',notSaved:'未保存',gpsHint:'ジョブを選び「現在地を取得」でGPSを個別保存します。',print:'印刷 / PDF保存',report:'勤怠Pro — 勤怠レポート',rows:'行のデータ',date:'日付',day:'曜日',job:'ジョブ',status:'状態',inn:'出勤',out:'退勤',hours:'時間',type:'種類',note:'メモ'},
    zh:{filter:'数据筛选',all:'全部',filename:'文件名',format:'文件格式',csvBtn:'📊 导出 Excel (.csv)',pdfBtn:'📄 导出 PDF',gpsTarget:'🎯 GPS适用工作',saved:'已保存',notSaved:'未保存',gpsHint:'选择工作后点击“获取当前位置”，分别保存GPS。',print:'打印 / 保存 PDF',report:'考勤Pro — 考勤报告',rows:'行数据',date:'日期',day:'星期',job:'工作',status:'状态',inn:'上班',out:'下班',hours:'小时',type:'类型',note:'备注'},
    my:{filter:'ဒေတာ စစ်ထုတ်',all:'အားလုံး',filename:'ဖိုင်အမည်',format:'ဖိုင်အမျိုးအစား',csvBtn:'📊 Excel ထုတ်ရန် (.csv)',pdfBtn:'📄 PDF ထုတ်ရန်',gpsTarget:'🎯 GPS အလုပ်ရွေးရန်',saved:'သိမ်းပြီး',notSaved:'မသိမ်းရသေး',gpsHint:'အလုပ်ရွေးပြီး လက်ရှိတည်နေရာကို သိမ်းပါ။',print:'Print / PDF သိမ်း',report:'Chấm Công Pro — Attendance report',rows:'ဒေတာတန်း',date:'ရက်စွဲ',day:'နေ့',job:'အလုပ်',status:'အခြေအနေ',inn:'ဝင်',out:'ထွက်',hours:'နာရီ',type:'အမျိုးအစား',note:'မှတ်ချက်'},
    th:{filter:'ตัวกรองข้อมูล',all:'ทั้งหมด',filename:'ชื่อไฟล์',format:'รูปแบบไฟล์',csvBtn:'📊 ส่งออก Excel (.csv)',pdfBtn:'📄 ส่งออก PDF',gpsTarget:'🎯 GPS สำหรับงาน',saved:'บันทึกแล้ว',notSaved:'ยังไม่บันทึก',gpsHint:'เลือกงานแล้วกด “รับตำแหน่งปัจจุบัน” เพื่อบันทึก GPS แยกกัน',print:'พิมพ์ / บันทึก PDF',report:'Work Tracker Pro — รายงานเข้างาน',rows:'แถวข้อมูล',date:'วันที่',day:'วัน',job:'งาน',status:'สถานะ',inn:'เข้า',out:'ออก',hours:'ชั่วโมง',type:'ประเภท',note:'หมายเหตุ'},
    id:{filter:'FILTER DATA',all:'Semua',filename:'NAMA FILE',format:'FORMAT FILE',csvBtn:'📊 Ekspor Excel (.csv)',pdfBtn:'📄 Ekspor PDF',gpsTarget:'🎯 GPS UNTUK PEKERJAAN',saved:'Tersimpan',notSaved:'Belum tersimpan',gpsHint:'Pilih pekerjaan lalu tekan “Ambil lokasi saat ini” untuk menyimpan GPS terpisah.',print:'Cetak / Simpan PDF',report:'Work Tracker Pro — Laporan absensi',rows:'baris data',date:'Tanggal',day:'Hari',job:'Pekerjaan',status:'Status',inn:'Masuk',out:'Keluar',hours:'Jam',type:'Jenis',note:'Catatan'},
    ph:{filter:'FILTER NG DATA',all:'Lahat',filename:'PANGALAN NG FILE',format:'FORMAT NG FILE',csvBtn:'📊 I-export Excel (.csv)',pdfBtn:'📄 I-export PDF',gpsTarget:'🎯 GPS PARA SA TRABAHO',saved:'Nai-save',notSaved:'Hindi pa save',gpsHint:'Pumili ng trabaho at pindutin ang “Kunin ang lokasyon” para i-save ang GPS.',print:'Print / Save PDF',report:'Work Tracker Pro — Ulat ng attendance',rows:'hanay ng data',date:'Petsa',day:'Araw',job:'Trabaho',status:'Katayuan',inn:'Pasok',out:'Labas',hours:'Oras',type:'Uri',note:'Tala'},
    ne:{filter:'डेटा फिल्टर',all:'सबै',filename:'फाइल नाम',format:'फाइल ढाँचा',csvBtn:'📊 Excel निर्यात (.csv)',pdfBtn:'📄 PDF निर्यात',gpsTarget:'🎯 GPS लागू हुने काम',saved:'सुरक्षित',notSaved:'सुरक्षित छैन',gpsHint:'काम छानेर “हालको स्थान लिनुहोस्” थिची GPS अलग सुरक्षित गर्नुहोस्।',print:'प्रिन्ट / PDF सुरक्षित',report:'Work Tracker Pro — हाजिरी रिपोर्ट',rows:'डेटा पंक्ति',date:'मिति',day:'बार',job:'काम',status:'अवस्था',inn:'प्रवेश',out:'निस्किने',hours:'घण्टा',type:'प्रकार',note:'नोट'},
    hi:{filter:'डेटा फ़िल्टर',all:'सभी',filename:'फ़ाइल नाम',format:'फ़ाइल फ़ॉर्मैट',csvBtn:'📊 Excel निर्यात करें (.csv)',pdfBtn:'📄 PDF निर्यात करें',gpsTarget:'🎯 GPS लागू नौकरी',saved:'सहेजा गया',notSaved:'सहेजा नहीं',gpsHint:'नौकरी चुनकर “वर्तमान स्थान लें” दबाएँ ताकि GPS अलग सेव हो।',print:'प्रिंट / PDF सेव',report:'Work Tracker Pro — उपस्थिति रिपोर्ट',rows:'डेटा पंक्तियाँ',date:'तारीख',day:'दिन',job:'नौकरी',status:'स्थिति',inn:'प्रवेश',out:'प्रस्थान',hours:'घंटे',type:'प्रकार',note:'नोट'}
  };
  function L2(){return (window.userData&&userData.lang)||'vi'}
  function i2(k){const L=L2(); return (I18N2[L]&&I18N2[L][k]) || I18N2.vi[k] || k}
  function exportType2(auto){const p=({vi:{auto:'Tự động',manual:'Thủ công'},en:{auto:'Auto',manual:'Manual'},ko:{auto:'자동',manual:'수동'},ja:{auto:'自動',manual:'手動'},zh:{auto:'自动',manual:'手动'},my:{auto:'အလိုအလျောက်',manual:'လက်ဖြင့်'},th:{auto:'อัตโนมัติ',manual:'ด้วยตนเอง'},id:{auto:'Otomatis',manual:'Manual'},ph:{auto:'Awtomatiko',manual:'Manual'},ne:{auto:'स्वचालित',manual:'म्यानुअल'},hi:{auto:'स्वचालित',manual:'मैनुअल'}}[L2()]||{auto:'Auto',manual:'Manual'});return auto?p.auto:p.manual;}
  function setTxt(id,txt){const el=document.getElementById(id); if(el) el.textContent=txt}

  const oldApply=window.applyI18n;
  window.applyI18n=function(){
    if(typeof oldApply==='function') oldApply.apply(this,arguments);
    syncNewFeatureLang();
  };

  window.syncNewFeatureLang=function(){
    setTxt('excelFilterLbl', i2('filter'));
    setTxt('efAll', i2('all'));
    setTxt('efMain', typeof u==='function'?u('job.main'):'Job chính');
    setTxt('efSub', typeof u==='function'?u('job.sub'):'Job phụ');
    setTxt('excelFilenameLbl', i2('filename'));
    const fmt=document.querySelector('#excelFormatRow > div:first-child'); if(fmt) fmt.textContent=i2('format');
    setTxt('efmtCsv','📊 Excel CSV'); setTxt('efmtPdf','📄 PDF');
    const btn=document.getElementById('excelExportBtn');
    if(btn) btn.textContent=(window._exportFormat==='pdf')?i2('pdfBtn'):i2('csvBtn');
    if(typeof window.renderGpsJobSwitch==='function') window.renderGpsJobSwitch();
  };

  window.renderGpsJobSwitch=function(){
    if(typeof ensureGpsV221==='function') ensureGpsV221();
    if(typeof _gpsData==='undefined') return;
    const card=document.getElementById('gpsSetupCard'); if(!card) return;
    let box=document.getElementById('gpsJobSwitchBox');
    if(!box){box=document.createElement('div');box.id='gpsJobSwitchBox';box.style.cssText='background:#F4F7F6;border-radius:14px;padding:12px;margin-bottom:12px;border:1px solid var(--border)';card.insertBefore(box,card.firstChild);}
    const hasSub=!!(window.userData&&userData.subJob&&userData.subJob.active);
    const subName=(hasSub&&userData.subJob.name)?userData.subJob.name:(typeof u==='function'?u('job.sub'):'Job phụ');
    const mainOn=(_gpsData.activeJob||'main')==='main', subOn=(_gpsData.activeJob||'main')==='sub';
    const mainLoc=(_gpsData.locations&&_gpsData.locations.main)||{}, subLoc=(_gpsData.locations&&_gpsData.locations.sub)||{};
    box.innerHTML=
      '<div style="font-size:12px;font-weight:900;color:var(--text2);margin-bottom:8px">'+i2('gpsTarget')+'</div>'+
      '<div style="display:flex;gap:8px;margin-bottom:8px">'+
      '<button onclick="setActiveGpsJob(\'main\')" style="flex:1;padding:10px;border-radius:10px;border:1.5px solid '+(mainOn?'var(--ac)':'var(--border)')+';background:'+(mainOn?'var(--ac)':'white')+';color:'+(mainOn?'white':'var(--text2)')+';font-size:12px;font-weight:900;font-family:Nunito,sans-serif">🏢 '+(typeof u==='function'?u('job.main'):'Job chính')+'</button>'+
      '<button onclick="setActiveGpsJob(\'sub\')" '+(!hasSub?'disabled':'')+' style="flex:1;padding:10px;border-radius:10px;border:1.5px solid '+(subOn?'#7B5EA7':'var(--border)')+';background:'+(subOn?'#7B5EA7':'white')+';color:'+(subOn?'white':'var(--text2)')+';opacity:'+(!hasSub?'.45':'1')+';font-size:12px;font-weight:900;font-family:Nunito,sans-serif">💼 '+String(subName).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))+'</button>'+
      '</div><div style="font-size:11px;color:var(--text3);line-height:1.45">🏢 '+(mainLoc.lat?i2('saved'):i2('notSaved'))+' · 💼 '+(subLoc.lat?i2('saved'):i2('notSaved'))+'<br>'+i2('gpsHint')+'</div>';
  };

  const oldSelExportFormat=window.selExportFormat;
  window.selExportFormat=function(fmt){
    if(typeof oldSelExportFormat==='function') oldSelExportFormat(fmt);
    const btn=document.getElementById('excelExportBtn');
    if(btn) btn.textContent=(window._exportFormat==='pdf')?i2('pdfBtn'):i2('csvBtn');
    const fmtLbl=document.querySelector('#excelFormatRow > div:first-child'); if(fmtLbl) fmtLbl.textContent=i2('format');
  };

  // Override PDF download through doExport so PDF header also follows language.
  const oldDoExport=window.doExport;
  window.doExport=function(){
    if(window._exportFormat!=='pdf') return oldDoExport && oldDoExport();
    const esc=v=>String(v==null?'':v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const y=calView.y,m=calView.m,nd=new Date(y,m+1,0).getDate(),rows=[],T=getLang();
    const STATUS={cm:T.coMat||'Có mặt',vang:T.vang||'Vắng',np:T.nghiPhep||'Nghỉ phép',ll:legacyHolidayLabel(T)};
    function add(g,rec,label){
      let ins=rec?.in||'', outs=rec?.out||'', dur='';
      if(ins&&outs)dur=(((timeToMin(outs)-timeToMin(ins)+1440)%1440)/60).toFixed(1)+'h';
      let gps='',gi=rec?.gpsIn,go=rec?.gpsOut;
      if(gi&&gi.lat)gps='IN '+gi.lat.toFixed(5)+','+gi.lng.toFixed(5);
      if(go&&go.lat)gps+=(gps?' | ':'')+'OUT '+go.lat.toFixed(5)+','+go.lng.toFixed(5);
      rows.push({date:g+'/'+(m+1)+'/'+y,day:DAYS[new Date(y,m,g).getDay()],job:label,status:STATUS[rec?.type]||'',in:ins,out:outs,hours:dur,type:exportType2(!!(rec&&rec.auto)),note:rec?.note||'',gps});
    }
    for(let g=1;g<=nd;g++){const rec=getAttRecordByDateParts(y,m,g); if(!rec)continue; if(_exportFilter!=='sub')add(g,rec,u('job.main')); if(rec.sub&&_exportFilter!=='main')add(g,rec.sub,userData.subJob?.name||u('job.sub'));}
    const rawName=document.getElementById('excelFilename')?.value.trim()||'ChamCong';
    const th=[i2('date'),i2('day'),i2('job'),i2('status'),i2('inn'),i2('out'),i2('hours'),i2('type'),i2('note'),'GPS'];
    const html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(rawName)+'</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1A2332}h1{font-size:20px;margin:0 0 6px}p{color:#667;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#0D9E75;color:white}th,td{border:1px solid #ddd;padding:6px;text-align:left}.sub{color:#7B5EA7;font-weight:bold}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="padding:10px 16px;border-radius:10px;border:0;background:#0D9E75;color:white;font-weight:bold;margin-bottom:14px">'+i2('print')+'</button><h1>'+i2('report')+'</h1><p>'+(MONTHS[calView.m]||('T'+(calView.m+1)))+' '+calView.y+' · '+rows.length+' '+i2('rows')+'</p><table><thead><tr>'+th.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.day)+'</td><td class="'+(r.job===u('job.main')?'':'sub')+'">'+esc(r.job)+'</td><td>'+esc(r.status)+'</td><td>'+esc(r.in)+'</td><td>'+esc(r.out)+'</td><td>'+esc(r.hours)+'</td><td>'+esc(r.type)+'</td><td>'+esc(r.note)+'</td><td>'+esc(r.gps)+'</td></tr>').join('')+'</tbody></table><\u0073cript>setTimeout(function(){window.print()},500)<\/\u0073cript></body></html>';
    const w=window.open('','_blank');
    if(w){ w.document.open(); w.document.write(html); w.document.close(); }
    else { showGpsBanner(u('export.popup_blocked'),'#E8433A'); }
  };
})();


/* PATCH v2.2.3 — Hard-text i18n deep sync for GPS / Sub job / Salary / Calendar / Export */
(function(){
  const PACK={
    vi:{main:'Công việc chính',mainShort:'CHÍNH',sub:'Việc phụ',subShort:'PHỤ',hasSub:'💼 Có job phụ không?',subHelp:'Freelance, part-time, làm thêm...',subName:'TÊN CÔNG VIỆC PHỤ',subNamePh:'Freelance / Gia sư / Part-time...',subSalary:'LƯƠNG VIỆC PHỤ',hour:'/ giờ',day:'/ ngày',month:'/ tháng',hintHour:'Nhập lương theo giờ — tự tính theo số giờ làm thực tế',hintDay:'Nhập lương theo ngày công thực tế',hintMonth:'Nhập lương tháng cố định cho việc này',gpsAuto:'GPS tự động 출퇴근',gpsAutoSub:'Tự động vào/ra ca khi đến/rời công ty',gpsTarget:'🎯 GPS ÁP DỤNG CHO VIỆC',gpsSaved:'Đã lưu',gpsNotSaved:'Chưa lưu',gpsHint:'Chọn việc rồi bấm “Lấy vị trí hiện tại” để lưu GPS riêng cho việc đó.',companyLocation:'📍 Vị trí công ty',companyNoLocation:'Chưa thiết lập vị trí công ty',radius:'Cảm biến khoảng cách',checkinMin:'⏱️ Xác nhận vào ca (phút)',checkoutMin:'⏱️ Xác nhận ra ca (phút)',getLocation:'📍 Lấy vị trí hiện tại',clearLocation:'✕ Xóa',calendarText:'🎨 MÀU CHỮ TRONG LỊCH',sun:'Chủ nhật (CN)',sunSub:'Màu chữ ngày Chủ nhật',sat:'Thứ 7 (T7)',satSub:'Màu chữ ngày Thứ 7',normal:'Ngày thường (T2–T6)',normalSub:'Màu chữ ngày trong tuần',resetColor:'↺ Đặt lại màu mặc định',saveAppearance:'✓ Lưu giao diện',estNet:'Ước tính thực nhận',gross:'Tổng trước khấu trừ',combined:'Hợp nhất thu nhập (chính + phụ)',total:'Tổng',saveSalary:'✓ Lưu thông tin lương',format:'ĐỊNH DẠNG FILE',csv:'📊 Xuất file Excel (.csv)',pdf:'📄 Xuất file PDF',filter:'CHẾ ĐỘ XUẤT',all:'Tất cả',filename:'TÊN FILE'},
    ko:{main:'주업무',mainShort:'주업',sub:'부업',subShort:'부업',hasSub:'💼 부업이 있나요?',subHelp:'프리랜서, 파트타임, 추가 근무...',subName:'부업 이름',subNamePh:'프리랜서 / 과외 / 파트타임...',subSalary:'부업 급여',hour:'/ 시간',day:'/ 일',month:'/ 월',hintHour:'시간급 입력 — 실제 근무시간 기준 자동 계산',hintDay:'일급 입력 — 실제 근무일 기준 계산',hintMonth:'이 작업의 고정 월급 입력',gpsAuto:'GPS 자동 출퇴근',gpsAutoSub:'회사 도착/이탈 시 자동 출퇴근 처리',gpsTarget:'🎯 GPS 적용 작업',gpsSaved:'저장됨',gpsNotSaved:'미저장',gpsHint:'작업을 선택한 뒤 “현재 위치 가져오기”를 눌러 작업별 GPS를 저장하세요.',companyLocation:'📍 회사 위치',companyNoLocation:'회사 위치가 설정되지 않음',radius:'감지 반경',checkinMin:'⏱️ 출근 확인 (분)',checkoutMin:'⏱️ 퇴근 확인 (분)',getLocation:'📍 현재 위치 가져오기',clearLocation:'✕ 삭제',calendarText:'🎨 달력 글자색',sun:'일요일 (일)',sunSub:'일요일 글자색',sat:'토요일 (토)',satSub:'토요일 글자색',normal:'평일 (월–금)',normalSub:'평일 글자색',resetColor:'↺ 기본 색상으로 재설정',saveAppearance:'✓ 저장',estNet:'예상 실수령액',gross:'총액',combined:'합산 수입 (주업+부업)',total:'합계',saveSalary:'✓ 급여 정보 저장',format:'파일 형식',csv:'📊 Excel CSV 내보내기',pdf:'📄 PDF 내보내기',filter:'내보내기 모드',all:'전체',filename:'파일 이름'},
    en:{main:'Main job',mainShort:'MAIN',sub:'Sub job',subShort:'SUB',hasSub:'💼 Do you have a sub job?',subHelp:'Freelance, part-time, extra work...',subName:'SUB JOB NAME',subNamePh:'Freelance / Tutoring / Part-time...',subSalary:'SUB JOB SALARY',hour:'/ hour',day:'/ day',month:'/ month',hintHour:'Enter hourly rate — auto calculated from actual hours',hintDay:'Enter daily rate',hintMonth:'Enter fixed monthly salary for this job',gpsAuto:'Automatic GPS attendance',gpsAutoSub:'Auto check in/out when arriving/leaving company',gpsTarget:'🎯 GPS TARGET JOB',gpsSaved:'Saved',gpsNotSaved:'Not saved',gpsHint:'Select a job, then press “Get current location” to save GPS separately.',companyLocation:'📍 Company location',companyNoLocation:'Company location not set',radius:'Detection radius',checkinMin:'⏱️ Check-in confirm (min)',checkoutMin:'⏱️ Check-out confirm (min)',getLocation:'📍 Get current location',clearLocation:'✕ Clear',calendarText:'🎨 Calendar text colors',sun:'Sunday (Sun)',sunSub:'Sunday text color',sat:'Saturday (Sat)',satSub:'Saturday text color',normal:'Weekdays (Mon–Fri)',normalSub:'Weekday text color',resetColor:'↺ Reset default colors',saveAppearance:'✓ Save appearance',estNet:'Estimated net pay',gross:'Gross',combined:'Combined income (main + sub)',total:'Total',saveSalary:'✓ Save salary info',format:'FILE FORMAT',csv:'📊 Export Excel CSV',pdf:'📄 Export PDF',filter:'EXPORT MODE',all:'All',filename:'FILE NAME'},
    ja:{main:'本業',mainShort:'本業',sub:'副業',subShort:'副業',hasSub:'💼 副業がありますか？',subHelp:'フリーランス、パート、追加勤務...',subName:'副業名',subNamePh:'フリーランス / 家庭教師 / パート...',subSalary:'副業給与',hour:'/ 時間',day:'/ 日',month:'/ 月',hintHour:'時給を入力 — 実働時間で自動計算',hintDay:'日給を入力',hintMonth:'固定月給を入力',gpsAuto:'GPS自動出退勤',gpsAutoSub:'会社到着/退出時に自動処理',gpsTarget:'🎯 GPS適用ジョブ',gpsSaved:'保存済み',gpsNotSaved:'未保存',gpsHint:'ジョブを選択し「現在地を取得」でジョブ別GPSを保存します。',companyLocation:'📍 会社位置',companyNoLocation:'会社位置未設定',radius:'検出半径',checkinMin:'⏱️ 出勤確認（分）',checkoutMin:'⏱️ 退勤確認（分）',getLocation:'📍 現在地を取得',clearLocation:'✕ 削除',calendarText:'🎨 カレンダー文字色',sun:'日曜日（日）',sunSub:'日曜日の文字色',sat:'土曜日（土）',satSub:'土曜日の文字色',normal:'平日（月–金）',normalSub:'平日の文字色',resetColor:'↺ 既定色に戻す',saveAppearance:'✓ 保存',estNet:'推定手取り',gross:'総支給',combined:'合算収入（本業＋副業）',total:'合計',saveSalary:'✓ 給与情報を保存',format:'ファイル形式',csv:'📊 Excel CSV出力',pdf:'📄 PDF出力',filter:'出力モード',all:'すべて',filename:'ファイル名'},
    zh:{main:'主业',mainShort:'主业',sub:'副业',subShort:'副业',hasSub:'💼 有副业吗？',subHelp:'自由职业、兼职、额外工作...',subName:'副业名称',subNamePh:'自由职业 / 家教 / 兼职...',subSalary:'副业工资',hour:'/ 小时',day:'/ 天',month:'/ 月',hintHour:'输入时薪 — 按实际工时自动计算',hintDay:'输入日薪',hintMonth:'输入固定月薪',gpsAuto:'GPS自动打卡',gpsAutoSub:'到达/离开公司时自动打卡',gpsTarget:'🎯 GPS适用工作',gpsSaved:'已保存',gpsNotSaved:'未保存',gpsHint:'选择工作后点击“获取当前位置”分别保存GPS。',companyLocation:'📍 公司位置',companyNoLocation:'未设置公司位置',radius:'检测半径',checkinMin:'⏱️ 上班确认（分）',checkoutMin:'⏱️ 下班确认（分）',getLocation:'📍 获取当前位置',clearLocation:'✕ 删除',calendarText:'🎨 日历文字颜色',sun:'星期日（日）',sunSub:'星期日文字颜色',sat:'星期六（六）',satSub:'星期六文字颜色',normal:'工作日（一–五）',normalSub:'工作日文字颜色',resetColor:'↺ 恢复默认颜色',saveAppearance:'✓ 保存',estNet:'预计实收',gross:'税前总额',combined:'合并收入（主业+副业）',total:'合计',saveSalary:'✓ 保存工资信息',format:'文件格式',csv:'📊 导出 Excel CSV',pdf:'📄 导出 PDF',filter:'导出模式',all:'全部',filename:'文件名'},
    my:{main:'အဓိကအလုပ်',mainShort:'အဓိက',sub:'ဘေးအလုပ်',subShort:'ဘေး',hasSub:'💼 ဘေးအလုပ်ရှိပါသလား？',subHelp:'Freelance, part-time, အပိုအလုပ်...',subName:'ဘေးအလုပ် အမည်',subNamePh:'Freelance / Part-time...',subSalary:'ဘေးအလုပ် လစာ',hour:'/ နာရီ',day:'/ ရက်',month:'/ လ',hintHour:'နာရီလစာ — အမှန်တကယ်နာရီအလိုက် တွက်',hintDay:'နေ့စဉ်လစာ',hintMonth:'ဤအလုပ်အတွက် လချုပ်',gpsAuto:'GPS အလိုအလျောက်',gpsAutoSub:'ကုမ္ပဏီ ရောက်/ထွက်ချိန် အလိုအလျောက်',gpsTarget:'🎯 GPS အလုပ်',gpsSaved:'သိမ်းပြီး',gpsNotSaved:'မသိမ်းရသေး',gpsHint:'အလုပ်ရွေးပြီး „လက်ရှိနေရာ‟ ကိုနှိပ်ပါ။',companyLocation:'📍 ကုမ္ပဏီနေရာ',companyNoLocation:'ကုမ္ပဏီနေရာ မသတ်မှတ်ရသေး',radius:'ဖော်ထုတ်ရန် အကွာအဝေး',checkinMin:'⏱️ တက်အတည်ပြု (မိနစ်)',checkoutMin:'⏱️ ဆင်းအတည်ပြု (မိနစ်)',getLocation:'📍 လက်ရှိနေရာ',clearLocation:'✕ ဖျက်',calendarText:'🎨 ပြက္ခဒိန် စာသား',sun:'တနင်္ဂနွေ',sunSub:'တနင်္ဂနွေ စာသား',sat:'စနေ',satSub:'စနေ စာသား',normal:'ပုံမှန် (တ–သော)',normalSub:'ပုံမှန် စာသား',resetColor:'↺ မူရင်းအရောင်',saveAppearance:'✓ သိမ်း',estNet:'ခန့်မှန်း လက်ခံငွေ',gross:'စုစုပေါင်း',combined:'စုပေါင်းဝင်ငွေ',total:'စုစုပေါင်း',saveSalary:'✓ လစာ သိမ်း',format:'ဖိုင်ပုံစံ',csv:'📊 Excel CSV ထုတ်',pdf:'📄 PDF ထုတ်',filter:'ထုတ်နည်း',all:'အားလုံး',filename:'ဖိုင်အမည်'},
    th:{main:'งานหลัก',mainShort:'หลัก',sub:'งานเสริม',subShort:'เสริม',hasSub:'💼 มีงานเสริมไหม?',subHelp:'ฟรีแลนซ์, พาร์ทไทม์, งานพิเศษ...',subName:'ชื่องานเสริม',subNamePh:'ฟรีแลนซ์ / สอนพิเศษ / พาร์ทไทม์...',subSalary:'เงินเดือนงานเสริม',hour:'/ ชั่วโมง',day:'/ วัน',month:'/ เดือน',hintHour:'ใส่ค่าจ้างต่อชั่วโมง — คำนวณอัตโนมัติ',hintDay:'ใส่ค่าจ้างรายวัน',hintMonth:'ใส่เงินเดือนคงที่ของงานนี้',gpsAuto:'ลงเวลาอัตโนมัติด้วย GPS',gpsAutoSub:'เข้า/ออกงานอัตโนมัติเมื่อถึง/ออกบริษัท',gpsTarget:'🎯 งานที่ใช้ GPS',gpsSaved:'บันทึกแล้ว',gpsNotSaved:'ยังไม่บันทึก',gpsHint:'เลือกงาน แล้วกด „รับตำแหน่งปัจจุบัน‟ เพื่อบันทึก GPS แยก',companyLocation:'📍 ตำแหน่งบริษัท',companyNoLocation:'ยังไม่ได้ตั้งตำแหน่งบริษัท',radius:'รัศมีตรวจจับ',checkinMin:'⏱️ ยืนยันเข้างาน (นาที)',checkoutMin:'⏱️ ยืนยันออกงาน (นาที)',getLocation:'📍 รับตำแหน่งปัจจุบัน',clearLocation:'✕ ลบ',calendarText:'🎨 สีตัวอักษรปฏิทิน',sun:'อาทิตย์',sunSub:'สีตัวอักษรอาทิตย์',sat:'เสาร์',satSub:'สีตัวอักษรเสาร์',normal:'วันธรรมดา (จ–ศ)',normalSub:'สีตัวอักษรวันธรรมดา',resetColor:'↺ รีเซ็ตเป็นค่าเริ่มต้น',saveAppearance:'✓ บันทึกธีม',estNet:'รายได้สุทธิประมาณ',gross:'รวมก่อนหัก',combined:'รายได้รวม (หลัก+เสริม)',total:'รวม',saveSalary:'✓ บันทึกเงินเดือน',format:'รูปแบบไฟล์',csv:'📊 ส่งออก Excel CSV',pdf:'📄 ส่งออก PDF',filter:'โหมดส่งออก',all:'ทั้งหมด',filename:'ชื่อไฟล์'},
    id:{main:'Pekerjaan utama',mainShort:'UTAMA',sub:'Pekerjaan sampingan',subShort:'SAMPING',hasSub:'💼 Punya kerja sampingan?',subHelp:'Freelance, paruh waktu, tambahan...',subName:'NAMA KERJA SAMPINGAN',subNamePh:'Freelance / Les / Paruh waktu...',subSalary:'GAJI SAMPINGAN',hour:'/ jam',day:'/ hari',month:'/ bulan',hintHour:'Masukkan tarif per jam — dihitung otomatis',hintDay:'Masukkan upah harian',hintMonth:'Masukkan gaji bulanan tetap',gpsAuto:'Absensi GPS otomatis',gpsAutoSub:'Auto masuk/keluar saat tiba/pergi dari kantor',gpsTarget:'🎯 PEKERJAAN TARGET GPS',gpsSaved:'Tersimpan',gpsNotSaved:'Belum disimpan',gpsHint:'Pilih pekerjaan, lalu tekan „Lokasi saat ini‟ untuk simpan GPS terpisah.',companyLocation:'📍 Lokasi kantor',companyNoLocation:'Lokasi kantor belum diatur',radius:'Radius deteksi',checkinMin:'⏱️ Konfirmasi masuk (menit)',checkoutMin:'⏱️ Konfirmasi keluar (menit)',getLocation:'📍 Lokasi saat ini',clearLocation:'✕ Hapus',calendarText:'🎨 Warna teks kalender',sun:'Minggu',sunSub:'Warna teks Minggu',sat:'Sabtu',satSub:'Warna teks Sabtu',normal:'Hari kerja (Sen–Jum)',normalSub:'Warna teks hari kerja',resetColor:'↺ Reset warna default',saveAppearance:'✓ Simpan tampilan',estNet:'Estimasi gaji bersih',gross:'Bruto',combined:'Pendapatan gabungan (utama+sampingan)',total:'Total',saveSalary:'✓ Simpan info gaji',format:'FORMAT FILE',csv:'📊 Ekspor Excel CSV',pdf:'📄 Ekspor PDF',filter:'MODE EKSPOR',all:'Semua',filename:'NAMA FILE'},
    ph:{main:'Pangunahing trabaho',mainShort:'PANGUNAHIN',sub:'Sideline',subShort:'SIDE',hasSub:'💼 May sideline ka ba?',subHelp:'Freelance, part-time, dagdag trabaho...',subName:'PANGALAN NG SIDELINE',subNamePh:'Freelance / Tutor / Part-time...',subSalary:'SAHOD NG SIDELINE',hour:'/ oras',day:'/ araw',month:'/ buwan',hintHour:'Ilagay ang oras-oras na rate — auto-compute',hintDay:'Ilagay ang araw-araw na rate',hintMonth:'Ilagay ang buwanang sahod ng trabahong ito',gpsAuto:'Awtomatikong GPS attendance',gpsAutoSub:'Auto-sign in/out kapag pumasok/lumabas',gpsTarget:'🎯 TRABAHONG NA-TARGET NG GPS',gpsSaved:'Nai-save na',gpsNotSaved:'Hindi pa naka-save',gpsHint:'Pumili ng trabaho, pindutin „Kunin ang kasalukuyang lokasyon‟.',companyLocation:'📍 Lokasyon ng kumpanya',companyNoLocation:'Hindi naka-set ang lokasyon ng kumpanya',radius:'Radius ng pagtukoy',checkinMin:'⏱️ Kumpirmahin ang pasok (min)',checkoutMin:'⏱️ Kumpirmahin ang labas (min)',getLocation:'📍 Kunin ang kasalukuyang lokasyon',clearLocation:'✕ I-clear',calendarText:'🎨 Mga kulay ng teksto sa kalendaryo',sun:'Linggo',sunSub:'Kulay ng Linggo',sat:'Sabado',satSub:'Kulay ng Sabado',normal:'Mga araw ng trabaho (Lun–Biy)',normalSub:'Kulay ng araw ng trabaho',resetColor:'↺ I-reset sa default',saveAppearance:'✓ I-save ang hitsura',estNet:'Tinatayang net pay',gross:'Gross',combined:'Pinagsamang kita (pangunahin+side)',total:'Kabuuan',saveSalary:'✓ I-save ang impormasyon ng sahod',format:'FORMAT NG FILE',csv:'📊 I-export ang Excel CSV',pdf:'📄 I-export ang PDF',filter:'MODE NG EXPORT',all:'Lahat',filename:'PANGALAN NG FILE'},
    ne:{main:'मुख्य काम',mainShort:'मुख्य',sub:'सहायक काम',subShort:'सहायक',hasSub:'💼 सहायक काम छ?',subHelp:'फ्रिल्यान्स, पार्ट-टाइम, अतिरिक्त काम...',subName:'सहायक काम नाम',subNamePh:'फ्रिल्यान्स / ट्युटर / पार्ट-टाइम...',subSalary:'सहायक काम तलब',hour:'/ घन्टा',day:'/ दिन',month:'/ महिना',hintHour:'घण्टाको दर — स्वत: गणना',hintDay:'दैनिक दर',hintMonth:'यो कामको स्थिर मासिक तलब',gpsAuto:'स्वत: GPS हाजिरी',gpsAutoSub:'कम्पनी पुग्दा/छोड्दा स्वत: हाजिर/बाहिर',gpsTarget:'🎯 GPS लक्षित काम',gpsSaved:'सुरक्षित',gpsNotSaved:'सुरक्षित छैन',gpsHint:'काम छान्नुहोस्, „हालको स्थान‟ थिच्नुहोस्।',companyLocation:'📍 कम्पनी स्थान',companyNoLocation:'कम्पनी स्थान सेट गरिएको छैन',radius:'पहिचान त्रिज्या',checkinMin:'⏱️ प्रवेश पुष्टि (मिनेट)',checkoutMin:'⏱️ बाहिर पुष्टि (मिनेट)',getLocation:'📍 हालको स्थान लिनुहोस्',clearLocation:'✕ हटाउनुहोस्',calendarText:'🎨 क्यालेन्डर पाठ रंग',sun:'आइतबार',sunSub:'आइतबार पाठ रंग',sat:'शनिबार',satSub:'शनिबार पाठ रंग',normal:'कार्यदिन (सोम–शुक्र)',normalSub:'कार्यदिन पाठ रंग',resetColor:'↺ डिफल्टमा रिसेट',saveAppearance:'✓ थिम सुरक्षित गर्नुहोस्',estNet:'अनुमानित नेट तलब',gross:'कुल',combined:'मिलाएको आम्दानी (मुख्य+सहायक)',total:'जम्मा',saveSalary:'✓ तलब जानकारी सुरक्षित गर्नुहोस्',format:'फाइल ढाँचा',csv:'📊 Excel CSV निर्यात',pdf:'📄 PDF निर्यात',filter:'निर्यात मोड',all:'सबै',filename:'फाइल नाम'},
    hi:{main:'मुख्य नौकरी',mainShort:'मुख्य',sub:'अतिरिक्त नौकरी',subShort:'अतिरिक्त',hasSub:'💼 क्या आपकी अतिरिक्त नौकरी है?',subHelp:'फ्रीलांस, पार्ट-टाइम, अतिरिक्त काम...',subName:'अतिरिक्त नौकरी का नाम',subNamePh:'फ्रीलांस / ट्यूटर / पार्ट-टाइम...',subSalary:'अतिरिक्त वेतन',hour:'/ घंटा',day:'/ दिन',month:'/ माह',hintHour:'प्रति घंटा दर — स्वचालित गणना',hintDay:'दैनिक दर दर्ज करें',hintMonth:'इस कार्य का निश्चित मासिक वेतन',gpsAuto:'स्वचालित GPS उपस्थिति',gpsAutoSub:'कंपनी पहुंचने/छोड़ने पर ऑटो',gpsTarget:'🎯 GPS लक्ष्य कार्य',gpsSaved:'सहेजा गया',gpsNotSaved:'सहेजा नहीं',gpsHint:'कार्य चुनें, फिर „वर्तमान स्थान‟ दबाएं।',companyLocation:'📍 कंपनी स्थान',companyNoLocation:'कंपनी स्थान सेट नहीं',radius:'पहचान त्रिज्या',checkinMin:'⏱️ प्रवेश पुष्टि (मिनट)',checkoutMin:'⏱️ निकास पुष्टि (मिनट)',getLocation:'📍 वर्तमान स्थान प्राप्त करें',clearLocation:'✕ साफ करें',calendarText:'🎨 कैलेंडर पाठ रंग',sun:'रविवार',sunSub:'रविवार पाठ रंग',sat:'शनिवार',satSub:'शनिवार पाठ रंग',normal:'कार्यदिवस (सोम–शुक्र)',normalSub:'कार्यदिवस पाठ रंग',resetColor:'↺ डिफ़ॉल्ट पर रीसेट',saveAppearance:'✓ थीम सहेजें',estNet:'अनुमानित शुद्ध वेतन',gross:'सकल',combined:'संयुक्त आय (मुख्य+अतिरिक्त)',total:'कुल',saveSalary:'✓ वेतन जानकारी सहेजें',format:'फ़ाइल प्रारूप',csv:'📊 Excel CSV निर्यात',pdf:'📄 PDF निर्यात',filter:'निर्यात मोड',all:'सभी',filename:'फ़ाइल नाम'}
  };
  const ALIAS={};
  function getLang2(){try{return (window.userData&&userData.lang)||localStorage.getItem('cc_lang')||localStorage.getItem('lang')||'vi'}catch(e){return 'vi'}}
  function P(){let l=getLang2();return PACK[l]||PACK[ALIAS[l]]||PACK.en}
  function safeText(s){return String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
  function set(id,val,attr){const e=document.getElementById(id); if(!e)return; if(attr)e.setAttribute(attr,val); else e.textContent=val}
  function replaceTextNode(n){let s=n.nodeValue, p=P(); const pairs=[
    ['TÊN CÔNG VIỆC PHỤ',p.subName],['TÊN CÔNG 부업',p.subName],['TÊN CÔNG 副业',p.subName],['TÊN CÔNG 副業',p.subName],['TÊN CÔNG SUB JOB',p.subName],
    ['LƯƠNG JOB PHỤ',p.subSalary],['LƯƠNG VIỆC PHỤ',p.subSalary],['LƯƠNG JOB 부업',p.subSalary],['LƯƠNG JOB 副业',p.subSalary],['LƯƠNG JOB 副業',p.subSalary],
    ['💼 Có job phụ không?',p.hasSub],['Có job phụ không?',p.hasSub.replace(/^💼\s*/, '')],['Freelance, part-time, làm thêm...',p.subHelp],
    ['Job chính',p.main],['Công việc chính',p.main],['CÔNG VIỆC CHÍNH',p.main],['CHÍNH',p.mainShort],['주업',p.mainShort],
    ['Job phụ',p.sub],['Việc phụ',p.sub],['VIỆC PHỤ',p.sub],['VIEC PHU',p.sub],['PHỤ',p.subShort],
    ['GPS ÁP DỤNG CHO JOB',p.gpsTarget],['GPS áp dụng cho job',p.gpsTarget.replace(/^🎯\s*/, '')],['GPS tự động 출퇴근',p.gpsAuto],['Chấm công tự động GPS',p.gpsAuto],['Tự động vào/ra ca khi đến/rời công ty',p.gpsAutoSub],
    ['Vị trí công ty',p.companyLocation.replace(/^📍\s*/, '')],['회사 위치가 설정되지 않음',p.companyNoLocation],['Chưa thiết lập vị trí công ty',p.companyNoLocation],['Cảm biến khoảng cách',p.radius],['감지 반경',p.radius],
    ['출근 확인 (분)',p.checkinMin.replace(/^⏱️\s*/, '')],['퇴근 확인 (분)',p.checkoutMin.replace(/^⏱️\s*/, '')],['Phút xác nhận VÀO ca',p.checkinMin.replace(/^⏱️\s*/, '')],['Phút xác nhận HẾT ca',p.checkoutMin.replace(/^⏱️\s*/, '')],
    ['Lấy vị trí hiện tại',p.getLocation.replace(/^📍\s*/, '')],['Xóa',p.clearLocation.replace(/^✕\s*/, '')],['Đã lưu',p.gpsSaved],['Chưa lưu',p.gpsNotSaved],['Chọn job rồi bấm “Lấy vị trí hiện tại” để lưu GPS riêng cho job đó.',p.gpsHint],
    ['MÀU CHỮ TRONG LỊCH',p.calendarText],['Chủ nhật (CN)',p.sun],['Màu chữ ngày Chủ nhật',p.sunSub],['Thứ 7 (T7)',p.sat],['Màu chữ ngày Thứ 7',p.satSub],['Ngày thường (T2–T6)',p.normal],['Màu chữ ngày trong tuần',p.normalSub],['Đặt lại màu mặc định',p.resetColor.replace(/^↺\s*/, '')],['Lưu giao diện',p.saveAppearance.replace(/^✓\s*/, '')],
    ['Ước tính thực nhận',p.estNet],['예상 실수령액',p.estNet],['Gross',p.gross],['합산 수입 (주+부)',p.combined],['Hợp nhất thu nhập (chính + phụ)',p.combined],['Tổng',p.total],['Lưu thông tin lương',p.saveSalary.replace(/^✓\s*/, '')],
    ['ĐỊNH DẠNG FILE',p.format],['CHẾ ĐỘ XUẤT',p.filter],['TÊN FILE',p.filename],['Tất cả',p.all],['Xuất file Excel (.csv)',p.csv.replace(/^📊\s*/, '')],['Xuất file PDF',p.pdf.replace(/^📄\s*/, '')],
    ['/ giờ',p.hour],['/ ngày',p.day],['/ tháng',p.month]
  ];
  pairs.sort((a,b)=>b[0].length-a[0].length).forEach(([a,b])=>{s=s.split(a).join(b)}); if(s!==n.nodeValue)n.nodeValue=s;
  }
  function syncAttrs(){const p=P();
    set('setupSubNameLbl',p.subName); set('setupSubSalaryLbl',p.subSalary); set('setupSubJob',p.subNamePh,'placeholder'); set('setupSubSalaryHint',p.hintHour);
    set('btnResetColors',p.resetColor); set('btnSaveAppear',p.saveAppearance); set('apSecCalColor',p.calendarText);
    set('calColorSunLbl',p.sun); set('calColorSunSub',p.sunSub); set('calColorSatLbl',p.sat); set('calColorSatSub',p.satSub); set('calColorNormLbl',p.normal); set('calColorNormSub',p.normalSub);
    set('excelFilterLbl',p.filter); set('excelFilenameLbl',p.filename); set('efAll',p.all);
    const fmt=document.querySelector('#excelFormatRow > div:first-child'); if(fmt)fmt.textContent=p.format;
    const btn=document.getElementById('excelExportBtn'); if(btn)btn.textContent=(window._exportFormat==='pdf')?p.pdf:p.csv;
    const hint=document.getElementById('setupSubSalaryHint'); if(hint){const mode=(window._subSalaryMode||'hour'); hint.textContent=mode==='day'?p.hintDay:mode==='month'?p.hintMonth:p.hintHour;}
  }
  let busy=false;
  function syncAll(){if(busy)return; busy=true; try{syncAttrs(); const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(n){const e=n.parentElement;if(!e||!n.nodeValue.trim()||['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(e.tagName))return NodeFilter.FILTER_REJECT;if(e.isContentEditable||e.closest('input,textarea,[contenteditable="true"]'))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT;}}); const arr=[]; while(w.nextNode())arr.push(w.currentNode); arr.forEach(replaceTextNode);}catch(e){} busy=false;}
  const oldApply=window.applyI18n; window.applyI18n=function(){const r=oldApply&&oldApply.apply(this,arguments); setTimeout(syncAll,20); return r;};
  const oldOpen=window.openPanel; window.openPanel=function(id){const r=oldOpen&&oldOpen.apply(this,arguments); setTimeout(syncAll,80); return r;};
  const oldGps=window.openPanelGPS; if(oldGps) window.openPanelGPS=function(){const r=oldGps.apply(this,arguments); setTimeout(syncAll,120); return r;};
  const oldRenderSetup=window.renderSetupSubJob; if(oldRenderSetup) window.renderSetupSubJob=function(){const r=oldRenderSetup.apply(this,arguments); setTimeout(syncAll,30); return r;};
  const oldSelSub=window.selSubMode; if(oldSelSub) window.selSubMode=function(mode){window._subSalaryMode=mode; const r=oldSelSub.apply(this,arguments); setTimeout(syncAll,20); return r;};
  // ═══ FIX LAG TIẾNG VIỆT v4 — DISCONNECT-RECONNECT approach ═══
  //
  // Vấn đề: MutationObserver vẫn trigger khi IME tạo popup → lag composition.
  // Giải pháp v4 (cuối cùng): DISCONNECT observer hoàn toàn khi user focus input.
  // Reconnect khi user blur hoặc 1 giây không gõ.
  let _syncTimer = null;
  let _observerActive = false;
  let _disconnectTimer = null;
  let _lastInputTime = 0;

  const mo = new MutationObserver(() => {
    // Khi observer chạy, debounce 500ms rồi sync
    if(_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(syncAll, 500);
  });

  function startObserver(){
    if(_observerActive || !document.body) return;
    try{ mo.observe(document.body, {childList:true, subtree:true}); _observerActive = true; }catch(e){}
  }
  function stopObserver(){
    if(!_observerActive) return;
    try{ mo.disconnect(); _observerActive = false; if(_syncTimer){clearTimeout(_syncTimer); _syncTimer=null;} }catch(e){}
  }

  // ═══ STOP OBSERVER NGAY KHI USER FOCUS VÀO INPUT ═══
  // Đây là approach triệt để nhất — không có observer nào chạy khi user gõ
  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)){
      stopObserver();
      _lastInputTime = Date.now();
    }
  }, true);
  document.addEventListener('focusout', (e) => {
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)){
      // Đợi 800ms để chắc IME đã đóng → mới reconnect observer
      setTimeout(() => {
        // Nếu user lại focus input khác trong 800ms thì không cần start
        const active = document.activeElement;
        if(active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)){
          return;
        }
        startObserver();
      }, 800);
    }
  }, true);

  // ═══ COMPOSITION EVENTS — đảm bảo dừng observer khi gõ tiếng Việt ═══
  document.addEventListener('compositionstart', () => {
    stopObserver();
    _lastInputTime = Date.now();
  }, true);
  document.addEventListener('compositionupdate', () => {
    _lastInputTime = Date.now();
  }, true);
  document.addEventListener('compositionend', () => {
    _lastInputTime = Date.now();
    // KHÔNG restart observer ngay — chờ đến khi blur input
  }, true);

  // ═══ INPUT/KEYDOWN — track activity, không restart observer ═══
  document.addEventListener('input', (e) => {
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)){
      _lastInputTime = Date.now();
      stopObserver();  // chắc chắn observer dừng
    }
  }, true);

  document.addEventListener('DOMContentLoaded', () => { syncAll(); startObserver(); });
  setTimeout(() => { syncAll(); startObserver(); }, 500);
  window.syncDeepI18n = syncAll;
  // Expose for debugging
  window._mo = { start: startObserver, stop: stopObserver, status: () => _observerActive };
})();


/* PATCH v2.2.4 — App-level onboarding/language selector polish */
(function(){
  var css = `
  #screenOB{background:linear-gradient(160deg,#F1FFFB 0%,#FFFFFF 45%,#EEF4FF 100%);}
  #screenOB .ob-wrap{min-height:100vh;position:relative;overflow:hidden;}
  #screenOB .ob-wrap:before{content:"";position:absolute;width:240px;height:240px;border-radius:50%;background:rgba(13,158,117,.12);top:-80px;right:-80px;}
  #screenOB .ob-wrap:after{content:"";position:absolute;width:200px;height:200px;border-radius:50%;background:rgba(123,94,167,.10);bottom:70px;left:-70px;}
  #screenOB .ob-header,#screenOB .ob-progress,#screenOB .ob-body,#screenOB .ob-footer{position:relative;z-index:1;}
  #screenOB .ob-header{padding:24px 20px 0;}
  #screenOB .ob-logo{font-size:23px;letter-spacing:.2px;}
  #screenOB .ob-skip{background:rgba(255,255,255,.82);backdrop-filter:blur(10px);box-shadow:0 6px 18px rgba(0,0,0,.05);}
  #screenOB .ob-progress{gap:8px;padding-top:20px;}
  #screenOB .ob-dot{height:5px;background:rgba(26,35,50,.08);}
  #screenOB .ob-dot.done,#screenOB .ob-dot.active{background:linear-gradient(90deg,var(--ac),#40E0D0);}
  #screenOB .ob-body{padding:28px 20px 12px;}
  #screenOB .ob-title{font-size:29px;line-height:1.15;letter-spacing:-.5px;}
  #screenOB .ob-sub{font-size:15px;color:#6B7B8D;line-height:1.65;max-width:330px;}
  #screenOB .lang-grid{grid-template-columns:repeat(2,1fr);gap:12px;margin-top:8px;}
  #screenOB .lang-item{border-radius:20px;padding:16px 10px;background:rgba(255,255,255,.9);box-shadow:0 10px 28px rgba(0,0,0,.06);border:2px solid rgba(232,236,240,.9);}
  #screenOB .lang-item .flag{font-size:32px;margin-bottom:6px;}
  #screenOB .lang-item .lname{font-size:13px;color:#546274;}
  #screenOB .lang-item.sel{background:linear-gradient(135deg,var(--ac-lt),#fff);border-color:var(--ac);transform:translateY(-2px);box-shadow:0 12px 30px rgba(13,158,117,.20);}
  #screenOB .country-grid{gap:12px;}
  #screenOB .country-item{border-radius:18px;background:rgba(255,255,255,.92);box-shadow:0 8px 24px rgba(0,0,0,.045);}
  #screenOB .field-input{border-radius:16px;padding:16px;background:rgba(255,255,255,.92);box-shadow:0 8px 20px rgba(0,0,0,.035);}
  #screenOB .ob-footer{padding:18px 20px 24px;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.75));}
  #screenOB .ob-btn-back{box-shadow:0 10px 24px rgba(0,0,0,.06);background:white;}
  #screenOB .ob-btn-next{height:56px;border-radius:28px;background:linear-gradient(135deg,var(--ac),var(--ac2));box-shadow:0 12px 28px rgba(13,158,117,.30);}
  .ob-hero-card{background:rgba(255,255,255,.82);border:1px solid rgba(232,236,240,.85);box-shadow:0 16px 42px rgba(13,158,117,.11);border-radius:26px;padding:18px;margin:4px 0 6px;display:flex;align-items:center;gap:14px;}
  .ob-hero-icon{width:56px;height:56px;border-radius:18px;background:linear-gradient(135deg,var(--ac),#40E0D0);display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 10px 22px rgba(13,158,117,.25);}
  .ob-hero-title{font-size:15px;font-weight:900;color:#1A2332;}
  .ob-hero-sub{font-size:12px;color:#6B7B8D;margin-top:3px;line-height:1.35;}
  `;
  var style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
  var EXTRA={
    vi:{heroTitle:'Chấm công đa quốc gia',heroSub:'GPS, job phụ, lương, Excel/PDF và đa ngôn ngữ trong một app.',chooseLang:'Chọn ngôn ngữ bạn muốn dùng cho toàn bộ ứng dụng.'},
    ko:{heroTitle:'다국가 출퇴근 관리',heroSub:'GPS, 부업, 급여, Excel/PDF, 다국어를 하나의 앱에서 관리합니다.',chooseLang:'앱 전체에서 사용할 언어를 선택하세요.'},
    en:{heroTitle:'Multi-country attendance',heroSub:'GPS, side job, salary, Excel/PDF and multilingual support in one app.',chooseLang:'Choose the language for the whole app.'},
    ja:{heroTitle:'多国対応の勤怠管理',heroSub:'GPS、副業、給与、Excel/PDF、多言語を1つのアプリで管理します。',chooseLang:'アプリ全体で使う言語を選択してください。'},
    zh:{heroTitle:'多国考勤管理',heroSub:'GPS、副业、工资、Excel/PDF 和多语言集成在一个应用中。',chooseLang:'选择整个应用使用的语言。'},
    my:{heroTitle:'နိုင်ငံစုံ အလုပ်ချိန်မှတ်တမ်း',heroSub:'GPS၊ အပိုအလုပ်၊ လစာ၊ Excel/PDF နှင့် ဘာသာစကားစုံကို app တစ်ခုတည်းတွင် သုံးနိုင်သည်။',chooseLang:'App တစ်ခုလုံးတွင် အသုံးပြုမည့် ဘာသာစကားကို ရွေးပါ။'},
    th:{heroTitle:'ลงเวลาหลายประเทศ',heroSub:'GPS งานเสริม เงินเดือน Excel/PDF และหลายภาษาในแอปเดียว',chooseLang:'เลือกภาษาที่ต้องการใช้ทั้งแอป'},
    id:{heroTitle:'Absensi multi-negara',heroSub:'GPS, kerja sampingan, gaji, Excel/PDF, dan dukungan banyak bahasa dalam satu aplikasi.',chooseLang:'Pilih bahasa untuk seluruh aplikasi.'},
    ph:{heroTitle:'Multi-country attendance',heroSub:'GPS, sideline, sahod, Excel/PDF, at maraming wika sa iisang app.',chooseLang:'Piliin ang wikang gagamitin sa buong app.'},
    ne:{heroTitle:'बहु-देशीय हाजिरी',heroSub:'GPS, सहायक काम, तलब, Excel/PDF र बहुभाषा एउटै app मा।',chooseLang:'पूरै app मा प्रयोग गर्ने भाषा छान्नुहोस्।'},
    hi:{heroTitle:'बहु-देश उपस्थिति',heroSub:'GPS, दूसरी नौकरी, वेतन, Excel/PDF और कई भाषाएं एक ही app में।',chooseLang:'पूरे app के लिए भाषा चुनें।'}
  };
  function lang(){try{return userData?.lang||localStorage.getItem('lang')||'vi'}catch(e){return localStorage.getItem('lang')||'vi'}}
  function msg(k){var l=lang();return (EXTRA[l]&&EXTRA[l][k])||EXTRA.vi[k]||k}
  function enhanceOnboarding(){
    var body=document.getElementById('obBody'); if(!body) return;
    var title=body.querySelector('.ob-title');
    var sub=body.querySelector('.ob-sub');
    if(sub && /ngôn ngữ|언어|language/i.test(sub.textContent||'')) sub.textContent=msg('chooseLang');
    if(!body.querySelector('.ob-hero-card')){
      var card=document.createElement('div');card.className='ob-hero-card pop-in';
      card.innerHTML='<div class="ob-hero-icon">🌍</div><div><div class="ob-hero-title">'+msg('heroTitle')+'</div><div class="ob-hero-sub">'+msg('heroSub')+'</div></div>';
      if(title && title.parentNode) title.insertAdjacentElement('afterend',card); else body.prepend(card);
    }else{
      var ht=body.querySelector('.ob-hero-title'), hs=body.querySelector('.ob-hero-sub');
      if(ht) ht.textContent=msg('heroTitle'); if(hs) hs.textContent=msg('heroSub');
    }
  }
  var oldRender=window.renderOB;
  if(typeof oldRender==='function') window.renderOB=function(){var r=oldRender.apply(this,arguments);setTimeout(enhanceOnboarding,0);return r;};
  var oldSetLang=window.setLang;
  if(typeof oldSetLang==='function') window.setLang=function(l){var r=oldSetLang.apply(this,arguments);setTimeout(function(){try{applyI18n&&applyI18n()}catch(e){} enhanceOnboarding();},0);return r;};
  document.addEventListener('DOMContentLoaded',function(){setTimeout(enhanceOnboarding,80);});
  setTimeout(enhanceOnboarding,200);
})();

/* PATCH v2.2.5 — GPS permission guard, native attendance sync, professional permission fallback */
(function(){
  if(window.__gpsPermissionAndSyncPatchInstalled) return;
  window.__gpsPermissionAndSyncPatchInstalled = true;

  function isNativeRuntime(){
    try{
      return !!((window.Capacitor && (!Capacitor.isNativePlatform || Capacitor.isNativePlatform())) ||
        (window.ccNative && window.ccNative.isNative));
    }catch(e){ return false; }
  }

  function nativePlugin(){
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ChamCongNative;
  }

  function showPermissionNotice(kind, openFail){
    const L = (window.userData && userData.lang) || 'vi';
    const all = {
      vi:{
        openFailTitle:'Không mở được cài đặt tự động', openFailBody:'Bạn vẫn có thể cấp quyền thủ công theo các bước bên dưới.', closeBtn:'Đã hiểu', openBtn:'Mở cài đặt',
        notification:{icon:'🔔',title:'Cần bật quyền thông báo',body:'Chấm Công Pro dùng thông báo để nhắc vào ca, xác nhận tan ca và báo khi GPS tự chấm công.',steps:['Mở Cài đặt > Ứng dụng > Chấm Công Pro.','Vào Thông báo.','Bật Cho phép thông báo và các kênh nhắc ca.']},
        location:{icon:'📍',title:'Cần bật quyền vị trí',body:'GPS tự động cần quyền Vị trí để lưu nơi làm việc và chấm vào/ra ca ổn định.',steps:['Mở Cài đặt > Ứng dụng > Chấm Công Pro.','Vào Quyền > Vị trí.','Chọn Luôn cho phép hoặc Cho phép mọi lúc, bật Vị trí chính xác nếu có.']},
        battery:{icon:'🔋',title:'Cần chỉnh quyền pin',body:'Để GPS chạy nền ổn định, hãy đặt pin của ứng dụng sang Không hạn chế.',steps:['Mở Cài đặt > Ứng dụng > Chấm Công Pro.','Vào Pin hoặc Sử dụng pin.','Chọn Không hạn chế / Unrestricted. Nếu app nằm trong Ngủ hoặc Ngủ sâu, hãy bỏ khỏi danh sách đó.']}
      },
      en:{
        openFailTitle:'Could not open settings automatically', openFailBody:'You can still grant permission manually by following the steps below.', closeBtn:'Got it', openBtn:'Open settings',
        notification:{icon:'🔔',title:'Enable notification permission',body:'Chấm Công Pro uses notifications for shift reminders and GPS attendance results.',steps:['Open Settings > Apps > Chấm Công Pro.','Open Notifications.','Allow notifications and shift reminder channels.']},
        location:{icon:'📍',title:'Enable location permission',body:'Automatic GPS needs Location permission to save your workplace and clock in/out reliably.',steps:['Open Settings > Apps > Chấm Công Pro.','Open Permissions > Location.','Choose Allow all the time and enable Precise location if available.']},
        battery:{icon:'🔋',title:'Adjust battery permission',body:'For reliable background GPS, set this app battery mode to Unrestricted.',steps:['Open Settings > Apps > Chấm Công Pro.','Open Battery or Battery usage.','Choose Unrestricted. Remove the app from Sleeping or Deep sleeping apps if present.']}
      },
      ko:{
        openFailTitle:'설정을 자동으로 열 수 없습니다', openFailBody:'아래 단계에 따라 수동으로 권한을 허용할 수 있습니다.', closeBtn:'확인', openBtn:'설정 열기',
        notification:{icon:'🔔',title:'알림 권한을 켜세요',body:'Chấm Công Pro는 출근 알림, 퇴근 확인, GPS 자동 기록 결과 알림에 사용됩니다.',steps:['설정 > 앱 > Chấm Công Pro를 엽니다.','알림을 엽니다.','알림 허용과 근무 알림 채널을 켭니다.']},
        location:{icon:'📍',title:'위치 권한을 켜세요',body:'GPS 자동 출퇴근은 근무지를 저장하고 안정적으로 출퇴근을 기록하기 위해 위치 권한이 필요합니다.',steps:['설정 > 앱 > Chấm Công Pro를 엽니다.','권한 > 위치를 엽니다.','항상 허용을 선택하고 가능한 경우 정확한 위치를 켭니다.']},
        battery:{icon:'🔋',title:'배터리 권한을 조정하세요',body:'백그라운드 GPS가 안정적으로 동작하려면 앱 배터리를 제한 없음으로 설정하세요.',steps:['설정 > 앱 > Chấm Công Pro를 엽니다.','배터리 또는 배터리 사용량을 엽니다.','제한 없음을 선택합니다. 절전/초절전 앱 목록에 있으면 제거합니다.']}
      },
      ja:{
        openFailTitle:'設定を自動で開けません', openFailBody:'下の手順で手動でも権限を許可できます。', closeBtn:'了解', openBtn:'設定を開く',
        notification:{icon:'🔔',title:'通知権限を有効にしてください',body:'Chấm Công Proはシフト通知、退勤確認、GPS自動打刻の結果通知に使います。',steps:['設定 > アプリ > Chấm Công Pro を開きます。','通知を開きます。','通知許可とシフト通知チャンネルを有効にします。']},
        location:{icon:'📍',title:'位置情報権限を有効にしてください',body:'GPS自動打刻には、勤務先の保存と安定した出退勤記録のため位置情報権限が必要です。',steps:['設定 > アプリ > Chấm Công Pro を開きます。','権限 > 位置情報を開きます。','常に許可を選び、可能なら正確な位置情報を有効にします。']},
        battery:{icon:'🔋',title:'バッテリー権限を調整してください',body:'バックグラウンドGPSを安定させるには、アプリのバッテリー設定を無制限にしてください。',steps:['設定 > アプリ > Chấm Công Pro を開きます。','バッテリーまたはバッテリー使用量を開きます。','無制限を選びます。スリープ中のアプリにある場合は削除してください。']}
      },
      zh:{
        openFailTitle:'无法自动打开设置', openFailBody:'你仍可按以下步骤手动授予权限。', closeBtn:'知道了', openBtn:'打开设置',
        notification:{icon:'🔔',title:'请开启通知权限',body:'Chấm Công Pro 使用通知来提醒上班、确认下班，并提示 GPS 自动打卡结果。',steps:['打开 设置 > 应用 > Chấm Công Pro。','进入 通知。','允许通知并开启班次提醒频道。']},
        location:{icon:'📍',title:'请开启位置权限',body:'GPS 自动打卡需要位置权限，以保存工作地点并稳定记录上下班。',steps:['打开 设置 > 应用 > Chấm Công Pro。','进入 权限 > 位置。','选择始终允许，并在可用时开启精确位置。']},
        battery:{icon:'🔋',title:'请调整电池权限',body:'为保证后台 GPS 稳定运行，请将应用电池设置为不受限制。',steps:['打开 设置 > 应用 > Chấm Công Pro。','进入 电池 或 电池使用情况。','选择不受限制。若应用在睡眠/深度睡眠列表中，请移除。']}
      },
      my:{
        openFailTitle:'Settings ကို အလိုအလျောက် မဖွင့်နိုင်ပါ', openFailBody:'အောက်ပါအဆင့်များအတိုင်း လက်ဖြင့် ခွင့်ပြုနိုင်ပါသည်။', closeBtn:'နားလည်ပါပြီ', openBtn:'Settings ဖွင့်ရန်',
        notification:{icon:'🔔',title:'အသိပေးချက် ခွင့်ပြုချက် ဖွင့်ပါ',body:'Chấm Công Pro သည် shift သတိပေးချက်၊ ဆင်းချိန်အတည်ပြုချက်နှင့် GPS auto attendance ရလဒ်များအတွက် notification ကို အသုံးပြုသည်။',steps:['Settings > Apps > Chấm Công Pro ကို ဖွင့်ပါ။','Notifications ကို ဖွင့်ပါ။','Notifications နှင့် shift reminder channels ကို ခွင့်ပြုပါ။']},
        location:{icon:'📍',title:'တည်နေရာ ခွင့်ပြုချက် ဖွင့်ပါ',body:'GPS auto attendance သည် အလုပ်နေရာ သိမ်းရန်နှင့် ဝင်/ထွက် မှတ်တမ်းတင်ရန် Location permission လိုအပ်သည်။',steps:['Settings > Apps > Chấm Công Pro ကို ဖွင့်ပါ။','Permissions > Location ကို ဖွင့်ပါ။','Allow all the time ကို ရွေးပြီး ရှိပါက Precise location ကို ဖွင့်ပါ။']},
        battery:{icon:'🔋',title:'Battery permission ပြင်ပါ',body:'Background GPS တည်ငြိမ်ရန် app battery mode ကို Unrestricted သို့ ပြောင်းပါ။',steps:['Settings > Apps > Chấm Công Pro ကို ဖွင့်ပါ။','Battery သို့မဟုတ် Battery usage ကို ဖွင့်ပါ။','Unrestricted ကို ရွေးပါ။ Sleeping/Deep sleeping apps ထဲရှိပါက ဖယ်ရှားပါ။']}
      },
      th:{
        openFailTitle:'เปิดการตั้งค่าอัตโนมัติไม่ได้', openFailBody:'คุณยังสามารถให้สิทธิ์ด้วยตนเองตามขั้นตอนด้านล่าง', closeBtn:'เข้าใจแล้ว', openBtn:'เปิดการตั้งค่า',
        notification:{icon:'🔔',title:'เปิดสิทธิ์การแจ้งเตือน',body:'Chấm Công Pro ใช้การแจ้งเตือนเพื่อเตือนกะ ยืนยันเวลาออก และแจ้งผล GPS อัตโนมัติ',steps:['เปิด ตั้งค่า > แอป > Chấm Công Pro','เข้า การแจ้งเตือน','อนุญาตการแจ้งเตือนและช่องเตือนกะ']},
        location:{icon:'📍',title:'เปิดสิทธิ์ตำแหน่ง',body:'GPS อัตโนมัติต้องใช้ตำแหน่งเพื่อบันทึกที่ทำงานและลงเวลาเข้า/ออกอย่างเสถียร',steps:['เปิด ตั้งค่า > แอป > Chấm Công Pro','เข้า สิทธิ์ > ตำแหน่ง','เลือก อนุญาตตลอดเวลา และเปิดตำแหน่งที่แม่นยำถ้ามี']},
        battery:{icon:'🔋',title:'ปรับสิทธิ์แบตเตอรี่',body:'เพื่อให้ GPS ทำงานเบื้องหลังได้เสถียร ให้ตั้งค่าแบตเตอรี่ของแอปเป็นไม่จำกัด',steps:['เปิด ตั้งค่า > แอป > Chấm Công Pro','เข้า แบตเตอรี่ หรือ การใช้แบตเตอรี่','เลือก ไม่จำกัด และนำแอปออกจากรายการพัก/หลับลึกถ้ามี']}
      },
      id:{
        openFailTitle:'Setelan tidak bisa dibuka otomatis', openFailBody:'Anda tetap bisa memberi izin manual dengan langkah berikut.', closeBtn:'Mengerti', openBtn:'Buka setelan',
        notification:{icon:'🔔',title:'Aktifkan izin notifikasi',body:'Chấm Công Pro memakai notifikasi untuk pengingat shift, konfirmasi pulang, dan hasil absensi GPS.',steps:['Buka Setelan > Aplikasi > Chấm Công Pro.','Buka Notifikasi.','Izinkan notifikasi dan kanal pengingat shift.']},
        location:{icon:'📍',title:'Aktifkan izin lokasi',body:'GPS otomatis membutuhkan izin Lokasi untuk menyimpan tempat kerja dan mencatat masuk/keluar dengan stabil.',steps:['Buka Setelan > Aplikasi > Chấm Công Pro.','Buka Izin > Lokasi.','Pilih Izinkan sepanjang waktu dan aktifkan lokasi presisi jika tersedia.']},
        battery:{icon:'🔋',title:'Sesuaikan izin baterai',body:'Agar GPS latar belakang stabil, atur baterai aplikasi ke Tidak dibatasi.',steps:['Buka Setelan > Aplikasi > Chấm Công Pro.','Buka Baterai atau Penggunaan baterai.','Pilih Tidak dibatasi. Jika ada di aplikasi tidur/tidur nyenyak, hapus dari daftar.']}
      },
      ph:{
        openFailTitle:'Hindi mabuksan ang settings nang awtomatiko', openFailBody:'Maaari mo pa ring payagan ito nang manual gamit ang mga hakbang sa ibaba.', closeBtn:'Nakuha ko', openBtn:'Buksan settings',
        notification:{icon:'🔔',title:'I-enable ang notification permission',body:'Ginagamit ng Chấm Công Pro ang notifications para sa shift reminders, checkout confirmation, at GPS attendance results.',steps:['Buksan Settings > Apps > Chấm Công Pro.','Buksan Notifications.','Payagan ang notifications at shift reminder channels.']},
        location:{icon:'📍',title:'I-enable ang location permission',body:'Kailangan ng automatic GPS ang Location permission para i-save ang workplace at mag-clock in/out nang maayos.',steps:['Buksan Settings > Apps > Chấm Công Pro.','Buksan Permissions > Location.','Piliin ang Allow all the time at i-on ang Precise location kung meron.']},
        battery:{icon:'🔋',title:'Ayusin ang battery permission',body:'Para sa maaasahang background GPS, gawing Unrestricted ang battery mode ng app.',steps:['Buksan Settings > Apps > Chấm Công Pro.','Buksan Battery o Battery usage.','Piliin ang Unrestricted. Alisin sa Sleeping/Deep sleeping apps kung naroon.']}
      },
      ne:{
        openFailTitle:'Settings आफैं खुल्न सकेन', openFailBody:'तलका चरण पालना गरेर अनुमति हातैले दिन सक्नुहुन्छ।', closeBtn:'बुझेँ', openBtn:'Settings खोल्नुहोस्',
        notification:{icon:'🔔',title:'सूचना अनुमति खोल्नुहोस्',body:'Chấm Công Pro ले shift reminder, बाहिर पुष्टि र GPS attendance नतिजाका लागि सूचना प्रयोग गर्छ।',steps:['Settings > Apps > Chấm Công Pro खोल्नुहोस्।','Notifications खोल्नुहोस्।','Notifications र shift reminder channels अनुमति दिनुहोस्।']},
        location:{icon:'📍',title:'स्थान अनुमति खोल्नुहोस्',body:'Automatic GPS लाई कार्यस्थल सुरक्षित गर्न र प्रवेश/बाहिर स्थिर रूपमा रेकर्ड गर्न Location permission चाहिन्छ।',steps:['Settings > Apps > Chấm Công Pro खोल्नुहोस्।','Permissions > Location खोल्नुहोस्।','Allow all the time छान्नुहोस् र उपलब्ध भए Precise location खोल्नुहोस्।']},
        battery:{icon:'🔋',title:'ब्याट्री अनुमति मिलाउनुहोस्',body:'Background GPS स्थिर राख्न app battery mode लाई Unrestricted राख्नुहोस्।',steps:['Settings > Apps > Chấm Công Pro खोल्नुहोस्।','Battery वा Battery usage खोल्नुहोस्।','Unrestricted छान्नुहोस्। Sleeping/Deep sleeping apps मा भए हटाउनुहोस्।']}
      },
      hi:{
        openFailTitle:'Settings अपने आप नहीं खुली', openFailBody:'आप नीचे दिए चरणों से अनुमति मैन्युअल रूप से दे सकते हैं।', closeBtn:'समझ गया', openBtn:'Settings खोलें',
        notification:{icon:'🔔',title:'Notification permission चालू करें',body:'Chấm Công Pro shift reminders, checkout confirmation और GPS attendance results के लिए notifications का उपयोग करता है।',steps:['Settings > Apps > Chấm Công Pro खोलें।','Notifications खोलें।','Notifications और shift reminder channels अनुमति दें।']},
        location:{icon:'📍',title:'Location permission चालू करें',body:'Automatic GPS को workplace save करने और clock in/out स्थिर रूप से रिकॉर्ड करने के लिए Location permission चाहिए।',steps:['Settings > Apps > Chấm Công Pro खोलें।','Permissions > Location खोलें।','Allow all the time चुनें और उपलब्ध हो तो Precise location चालू करें।']},
        battery:{icon:'🔋',title:'Battery permission समायोजित करें',body:'Background GPS स्थिर रखने के लिए app battery mode को Unrestricted करें।',steps:['Settings > Apps > Chấm Công Pro खोलें।','Battery या Battery usage खोलें।','Unrestricted चुनें। Sleeping/Deep sleeping apps में हो तो हटाएं।']}
      }
    };
    const pack = all[L] || all.en;
    const set = (pack[kind]) || all.vi.location;
    const esc = typeof permEscHtml === 'function' ? permEscHtml : function(s){
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
    };
    let ov = document.getElementById('permissionGuideOv');
    if(ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'permissionGuideOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,16,28,.62);z-index:32000;display:flex;align-items:center;justify-content:center;padding:18px;backdrop-filter:blur(6px)';
    ov.innerHTML =
      '<div style="width:100%;max-width:390px;background:white;border-radius:22px;padding:22px 18px;box-shadow:0 24px 80px rgba(0,0,0,.35);font-family:Nunito,sans-serif;color:var(--text)">'+
        '<div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">'+
          '<div style="width:42px;height:42px;border-radius:14px;background:#EEF4FF;color:#2D7DD2;display:flex;align-items:center;justify-content:center;font-size:22px">'+esc(set.icon)+'</div>'+
          '<div style="font-size:18px;font-weight:900;line-height:1.2">'+esc(openFail ? pack.openFailTitle : set.title)+'</div>'+
        '</div>'+
        '<div style="font-size:13px;color:var(--text2);line-height:1.55;margin-bottom:12px">'+esc(openFail ? pack.openFailBody : set.body)+'</div>'+
        '<div style="display:flex;flex-direction:column;gap:8px;margin:12px 0 16px">'+
          set.steps.map(function(s,i){return '<div style="background:#F4F7F6;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.45"><b>'+(i+1)+'.</b> '+esc(s)+'</div>';}).join('')+
        '</div>'+
        '<div style="display:flex;gap:10px">'+
          '<button id="permissionGuideClose" style="flex:1;padding:13px;border-radius:12px;border:1.5px solid var(--border);background:white;color:var(--text2);font-size:13px;font-weight:800;font-family:Nunito,sans-serif">'+esc(pack.closeBtn)+'</button>'+
          '<button id="permissionGuideOpen" style="flex:1.45;padding:13px;border-radius:12px;border:none;background:var(--ac);color:white;font-size:13px;font-weight:900;font-family:Nunito,sans-serif">'+esc(pack.openBtn)+'</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(ov);
    document.getElementById('permissionGuideClose').onclick = function(){ ov.remove(); };
    document.getElementById('permissionGuideOpen').onclick = function(){
      ov.remove();
      window.openNativePermissionSetting(kind);
    };
  }

  async function ensureLocationPermissionForGps(){
    if(isNativeRuntime() && typeof gpsEnsureNativeLocationPermission === 'function'){
      return await gpsEnsureNativeLocationPermission();
    }
    const geo = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Geolocation;
    if(!geo || !isNativeRuntime()) return true;
    try{
      if(geo.checkPermissions){
        const cur = await geo.checkPermissions();
        if(cur && (cur.location === 'granted' || cur.coarseLocation === 'granted')) return true;
      }
      if(geo.requestPermissions){
        const res = await geo.requestPermissions();
        return !!(res && (res.location === 'granted' || res.coarseLocation === 'granted'));
      }
    }catch(e){ console.warn('[GPS Permission] request/check failed:', e); }
    return false;
  }

  /* [ATTENDANCE_NATIVE_QUEUE_MERGE]
     Ghi chu: day la cau noi dua record native ve so cham cong chinh attData.
     NativeGpsService chi ghi queue; app merge vao cp22_att roi moi hien tren UI.
  */
  async function mergeNativeAttendanceRecords(records){
    let merged = 0;
    if(!window.attData) window.attData = {};
    (records || []).forEach(function(rec){
      const key = (typeof normalizeDateKey === 'function') ? normalizeDateKey(rec && rec.date) : (rec && rec.date);
      const type = rec && rec.type;
      const time = rec && rec.time;
      if(!key || !time) return;
      if(!attData[key]) attData[key] = {type:'cm'};
      attData[key].type = attData[key].type || 'cm';
      if(type === 'IN' && !attData[key].in){
        if(typeof attendanceSetIn === 'function') attendanceSetIn(attData[key], key, time, rec.ts);
        else { attData[key].in = time; if(rec.ts) attData[key].checkInAt = rec.ts; }
        attData[key].auto = true;
        if(rec.ts) attData[key].gpsInTs = rec.ts;
        merged++;
      }else if(type === 'OUT' && !attData[key].out){
        if(typeof attendanceSetOut === 'function') attendanceSetOut(attData[key], key, time, rec.ts);
        else { attData[key].out = time; if(rec.ts) attData[key].checkOutAt = rec.ts; }
        attData[key].auto = true;
        if(rec.ts) attData[key].gpsOutTs = rec.ts;
        merged++;
      }
    });
    if(merged > 0){
      if(typeof saveAtt === 'function') saveAtt();
      else if(typeof lsSet === 'function') lsSet('cp22_att', attData);
      if(typeof renderHomeStats === 'function') renderHomeStats();
      if(typeof updateTodayStatusTime === 'function') updateTodayStatusTime();
      if(typeof renderCalBig === 'function') renderCalBig();
      if(typeof renderExcelPreview === 'function') renderExcelPreview();
      if(typeof updateExcelPanel === 'function') updateExcelPanel();
    }
    return merged;
  }

  window.pullNativeAttendanceNow = async function(){
    const plugin = nativePlugin();
    if(!plugin || !plugin.getNativeAttendance) return {merged:0, skipped:true};
    try{
      const res = await plugin.getNativeAttendance();
      const records = (res && res.records) || [];
      const merged = await mergeNativeAttendanceRecords(records);
      if(records.length && plugin.clearNativeAttendance){
        if(window.ccNative && window.ccNative.syncNativeAttendanceState){
          try{ await window.ccNative.syncNativeAttendanceState(); }catch(e){}
        }
        try{ await plugin.clearNativeAttendance({clearAll:true}); }catch(e){ console.warn('[NativeAtt] clear failed:', e); }
      }
      return {merged, records:records.length};
    }catch(e){
      console.warn('[NativeAtt] pull failed:', e);
      return {merged:0, error:String(e && e.message || e)};
    }
  };

  const oldOpenNativePermissionSetting = window.openNativePermissionSetting;
  window.openNativePermissionSetting = async function(kind){
    const plugin = nativePlugin();
    const nativeOk = isNativeRuntime() || !!plugin;
    if(!nativeOk){
      showPermissionNotice(kind, true);
      return;
    }
    try{
      let result = null;
      if(kind === 'notification'){
        if(window.ccNative && window.ccNative.openNotificationSettings) result = await window.ccNative.openNotificationSettings();
        else if(plugin && plugin.openNotificationSettings) result = await plugin.openNotificationSettings();
        else throw new Error('notification settings bridge unavailable');
      }else if(kind === 'location'){
        if(window.ccNative && window.ccNative.openLocationSettings) result = await window.ccNative.openLocationSettings();
        else if(plugin && plugin.openLocationSettings) result = await plugin.openLocationSettings();
        else throw new Error('location settings bridge unavailable');
      }else if(kind === 'battery'){
        if(window.ccNative && window.ccNative.requestIgnoreBatteryOptimization) result = await window.ccNative.requestIgnoreBatteryOptimization();
        else if(plugin && plugin.requestIgnoreBatteryOptimization) result = await plugin.requestIgnoreBatteryOptimization();
        else throw new Error('battery settings bridge unavailable');
        if(typeof scheduleBatteryPermissionCheck === 'function') scheduleBatteryPermissionCheck(result);
        else if(!(result && (result.granted || result.ignoringBatteryOptimizations))) showPermissionNotice('battery', !(result && result.openedSettings));
        return;
      }
      if(!result || result.openedSettings === false) showPermissionNotice(kind, true);
    }catch(e){
      console.warn('[PermissionSettings] robust open failed:', kind, e);
      if(typeof oldOpenNativePermissionSetting === 'function' && kind === 'battery'){
        try{ return await oldOpenNativePermissionSetting(kind); }catch(_){}
      }
      showPermissionNotice(kind, true);
    }
  };

  const oldGpsRequestPermission = window.gpsRequestPermission;
  window.gpsRequestPermission = async function(){
    const permGuide = document.getElementById('gpsPermGuide');
    const manualBox = document.getElementById('gpsManualBox');
    const ok = await ensureLocationPermissionForGps();
    if(!ok){
      if(permGuide) permGuide.style.display = 'block';
      if(manualBox) manualBox.style.display = 'block';
      showPermissionNotice('location', false);
      return;
    }
    if(typeof gpsGetCurrentPos === 'function') return gpsGetCurrentPos();
    if(typeof oldGpsRequestPermission === 'function') return oldGpsRequestPermission.apply(this, arguments);
  };

  const oldTogGPS = window.togGPS;
  window.togGPS = async function(btn){
    const willEnable = btn && !btn.classList.contains('on');
    if(willEnable){
      const ok = await ensureLocationPermissionForGps();
      if(!ok){
        if(btn) btn.classList.remove('on');
        if(window._gpsData) _gpsData.enabled = false;
        if(window.notifCfg) notifCfg.n3 = false;
        try{ if(typeof saveNotif === 'function') saveNotif(); if(typeof saveGpsData === 'function') saveGpsData(); }catch(e){}
        const card = document.getElementById('gpsSetupCard');
        if(card) card.style.display = 'block';
        showPermissionNotice('location', false);
        return;
      }
    }
    if(typeof oldTogGPS === 'function') return oldTogGPS.apply(this, arguments);
  };

  setTimeout(window.pullNativeAttendanceNow, 1200);
  setInterval(window.pullNativeAttendanceNow, 10000);
  window.addEventListener('focus', function(){ setTimeout(window.pullNativeAttendanceNow, 300); });
  document.addEventListener('visibilitychange', function(){
    if(!document.hidden) setTimeout(window.pullNativeAttendanceNow, 300);
  });
})();

/* PATCH v2.2.7 - net worked hours after break for sub salary and exports */
(function(){
  if(window.__netWorkedHoursEverywherePatchInstalled) return;
  window.__netWorkedHoursEverywherePatchInstalled = true;

  function breakHours(){
    var mins = (window.userData && userData.hasBreak && userData.breakMinutes) ? Number(userData.breakMinutes) : 0;
    return isFinite(mins) && mins > 0 ? mins / 60 : 0;
  }

  function parseHM(value){
    var m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if(!m) return null;
    var h = Number(m[1]), min = Number(m[2]);
    if(!isFinite(h) || !isFinite(min) || h < 0 || h > 47 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  function rawHoursBetween(ins, outs){
    var a = parseHM(ins), b = parseHM(outs);
    if(a == null || b == null) return null;
    return ((b - a + 1440) % 1440) / 60;
  }

  function netHoursBetween(ins, outs){
    var h = rawHoursBetween(ins, outs);
    if(h == null || !isFinite(h)) return null;
    return Math.max(0, h - breakHours());
  }

  function netHoursFromRec(rec, dateKey){
    if(!rec || !rec.in || !rec.out) return null;
    if(typeof attendanceWorkedHours === 'function'){
      var exact = attendanceWorkedHours(rec, dateKey);
      if(exact != null && isFinite(exact)) return Math.max(0, exact - breakHours());
    }
    return netHoursBetween(rec.in, rec.out);
  }

  function oneDecimal(value){
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function fmtHoursNumber(value){
    if(value == null || !isFinite(value)) return '';
    return oneDecimal(value).toFixed(1);
  }

  function fmtHoursText(value){
    var n = fmtHoursNumber(value);
    return n ? n + 'h' : '';
  }

  window.ccBreakHours = breakHours;
  window.ccRawHoursBetween = rawHoursBetween;
  window.ccNetHoursBetween = netHoursBetween;
  window.ccNetWorkedHours = netHoursFromRec;

  function calcSubJobSalaryNet(){
    var sj = window.userData && userData.subJob;
    if(!sj || !sj.active) return {gross:0, net:0, days:0, hours:0};
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth();
    var nd = new Date(y, m + 1, 0).getDate();
    var ngc = userData.ngc || 26;
    var subDays = 0, subHours = 0;

    for(var d = 1; d <= nd; d++){
      var rec = window.attData && getAttRecordByDateParts(y,m,d);
      var h = rec && rec.sub ? netHoursFromRec(rec.sub, dateKeyFromParts(y,m,d)) : null;
      if(h == null) continue;
      subDays++;
      subHours += h;
    }

    var mode = sj.salaryMode || 'hour';
    var gross = 0;
    if(mode === 'hour') gross = (Number(sj.salaryHour) || 0) * subHours;
    else if(mode === 'day') gross = (Number(sj.salaryDay) || 0) * subDays;
    else gross = subDays > 0 ? ((Number(sj.salary) || 0) * subDays / ngc) : 0;

    return {gross:Math.round(gross), net:Math.round(gross), days:subDays, hours:oneDecimal(subHours)};
  }

  window.calcSubJobSalary = calcSubJobSalaryNet;
  try{ calcSubJobSalary = calcSubJobSalaryNet; }catch(e){}

  function currentLang(){
    try{ return (window.userData && userData.lang) || 'vi'; }catch(e){ return 'vi'; }
  }

  function labels(){
    var packs = {
      vi:{date:'Ng\u00e0y',day:'Th\u1ee9',job:'C\u00f4ng vi\u1ec7c',status:'Tr\u1ea1ng th\u00e1i',inn:'V\u00e0o',out:'Ra',hours:'Gi\u1edd',type:'Lo\u1ea1i',note:'Ghi ch\u00fa',gps:'GPS',report:'Ch\u1ea5m C\u00f4ng Pro - B\u00e1o c\u00e1o ch\u1ea5m c\u00f4ng',rows:'d\u00f2ng d\u1eef li\u1ec7u',print:'In / L\u01b0u PDF',manual:'Th\u1ee7 c\u00f4ng',auto:'Tự động',popupBlocked:'Không thể mở cửa sổ PDF. Hãy cho phép pop-up để xuất PDF.'},
      en:{date:'Date',day:'Day',job:'Job',status:'Status',inn:'In',out:'Out',hours:'Hours',type:'Type',note:'Note',gps:'GPS',report:'Work Tracker Pro - Attendance report',rows:'data rows',print:'Print / Save PDF',manual:'Manual',auto:'Auto',popupBlocked:'Could not open the PDF window. Please allow pop-ups to export PDF.'},
      ko:{date:'날짜',day:'요일',job:'업무',status:'상태',inn:'출근',out:'퇴근',hours:'시간',type:'유형',note:'메모',gps:'GPS',report:'근태 Pro - 근태 보고서',rows:'개 데이터',print:'인쇄 / PDF 저장',manual:'수동',auto:'자동',popupBlocked:'PDF 창을 열 수 없습니다. PDF 내보내기를 위해 팝업을 허용하세요.'},
      ja:{date:'日付',day:'曜日',job:'ジョブ',status:'状態',inn:'出勤',out:'退勤',hours:'時間',type:'種類',note:'メモ',gps:'GPS',report:'勤怠Pro - 勤怠レポート',rows:'行のデータ',print:'印刷 / PDF保存',manual:'手動',auto:'自動',popupBlocked:'PDFウィンドウを開けません。PDF出力のためポップアップを許可してください。'},
      zh:{date:'日期',day:'星期',job:'工作',status:'状态',inn:'上班',out:'下班',hours:'小时',type:'类型',note:'备注',gps:'GPS',report:'考勤Pro - 考勤报告',rows:'行数据',print:'打印 / 保存 PDF',manual:'手动',auto:'自动',popupBlocked:'无法打开 PDF 窗口。请允许弹窗以导出 PDF。'},
      my:{date:'ရက်စွဲ',day:'နေ့',job:'အလုပ်',status:'အခြေအနေ',inn:'ဝင်',out:'ထွက်',hours:'နာရီ',type:'အမျိုးအစား',note:'မှတ်စု',gps:'GPS',report:'Chấm Công Pro - Attendance report',rows:'ကြောင်း ဒေတာ',print:'Print / PDF သိမ်း',manual:'လက်ဖြင့်',auto:'အလိုအလျောက်',popupBlocked:'PDF window ကို မဖွင့်နိုင်ပါ။ PDF ထုတ်ရန် pop-up ခွင့်ပြုပါ။'},
      th:{date:'วันที่',day:'วัน',job:'งาน',status:'สถานะ',inn:'เข้า',out:'ออก',hours:'ชั่วโมง',type:'ประเภท',note:'หมายเหตุ',gps:'GPS',report:'Work Tracker Pro - รายงานการลงเวลา',rows:'แถวข้อมูล',print:'พิมพ์ / บันทึก PDF',manual:'ด้วยตนเอง',auto:'อัตโนมัติ',popupBlocked:'เปิดหน้าต่าง PDF ไม่ได้ กรุณาอนุญาต pop-up เพื่อส่งออก PDF'},
      id:{date:'Tanggal',day:'Hari',job:'Pekerjaan',status:'Status',inn:'Masuk',out:'Keluar',hours:'Jam',type:'Jenis',note:'Catatan',gps:'GPS',report:'Work Tracker Pro - Laporan absensi',rows:'baris data',print:'Cetak / Simpan PDF',manual:'Manual',auto:'Otomatis',popupBlocked:'Tidak dapat membuka jendela PDF. Izinkan pop-up untuk mengekspor PDF.'},
      ph:{date:'Petsa',day:'Araw',job:'Trabaho',status:'Katayuan',inn:'Pasok',out:'Labas',hours:'Oras',type:'Uri',note:'Tala',gps:'GPS',report:'Work Tracker Pro - Ulat ng attendance',rows:'hanay ng data',print:'I-print / I-save PDF',manual:'Manual',auto:'Awtomatiko',popupBlocked:'Hindi mabuksan ang PDF window. Payagan ang pop-up para makapag-export ng PDF.'},
      ne:{date:'मिति',day:'बार',job:'काम',status:'अवस्था',inn:'प्रवेश',out:'बाहिर',hours:'घण्टा',type:'प्रकार',note:'नोट',gps:'GPS',report:'Chấm Công Pro - हाजिरी रिपोर्ट',rows:'डाटा पङ्क्ति',print:'प्रिन्ट / PDF सुरक्षित',manual:'म्यानुअल',auto:'स्वचालित',popupBlocked:'PDF window खोल्न सकिएन। PDF निर्यात गर्न pop-up अनुमति दिनुहोस्।'},
      hi:{date:'तारीख',day:'दिन',job:'नौकरी',status:'स्थिति',inn:'प्रवेश',out:'प्रस्थान',hours:'घंटे',type:'प्रकार',note:'नोट',gps:'GPS',report:'Chấm Công Pro - उपस्थिति रिपोर्ट',rows:'डेटा पंक्तियां',print:'प्रिंट / PDF सहेजें',manual:'मैनुअल',auto:'स्वचालित',popupBlocked:'PDF window नहीं खुली। PDF export करने के लिए pop-up की अनुमति दें।'}
    };
    return packs[currentLang()] || packs.en;
  }

  function statusLabels(){
    var t = {};
    try{ if(typeof getLang === 'function') t = getLang() || {}; }catch(e){}
    return {
      cm:t.coMat || 'Present',
      vang:t.vang || 'Absent',
      np:t.nghiPhep || 'Leave',
      ll:t.lamLe || t.chipLL || 'Holiday work'
    };
  }

  function dayName(y, m, g){
    try{
      if(typeof DAYS !== 'undefined' && DAYS[new Date(y, m, g).getDay()]) return DAYS[new Date(y, m, g).getDay()];
    }catch(e){}
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(y, m, g).getDay()];
  }

  function mainJobLabel(){
    try{ if(typeof u === 'function') return u('job.main'); }catch(e){}
    return 'Main job';
  }

  function subJobLabel(){
    try{ return (window.userData && userData.subJob && userData.subJob.name) || (typeof u === 'function' ? u('job.sub') : 'Sub job'); }catch(e){}
    return 'Sub job';
  }

  function gpsText(rec){
    function point(label, p){
      var lat = p && Number(p.lat), lng = p && Number(p.lng);
      if(!isFinite(lat) || !isFinite(lng)) return '';
      var extra = '';
      if(isFinite(Number(p.acc))) extra += ' +' + Math.round(Number(p.acc)) + 'm';
      if(isFinite(Number(p.dist))) extra += ' / ' + Math.round(Number(p.dist)) + 'm';
      return label + ' ' + lat.toFixed(5) + ',' + lng.toFixed(5) + extra;
    }
    var a = point('IN', rec && rec.gpsIn);
    var b = point('OUT', rec && rec.gpsOut);
    return a && b ? a + ' | ' + b : (a || b || '');
  }

  function exportBaseName(){
    var raw = '';
    try{ raw = (document.getElementById('excelFilename') && document.getElementById('excelFilename').value) || ''; }catch(e){}
    raw = String(raw || 'ChamCong').trim().replace(/[\\/:*?"<>|]+/g, '_');
    return raw || 'ChamCong';
  }

  function buildExportRows(){
    var y = calView.y, m = calView.m;
    var nd = new Date(y, m + 1, 0).getDate();
    var filter = (typeof _exportFilter !== 'undefined' && _exportFilter) || window._exportFilter || 'all';
    var st = statusLabels();
    var rows = [];

    function add(g, rec, label){
      var h = netHoursFromRec(rec, dateKeyFromParts(y,m,g));
      rows.push({
        date:g + '/' + (m + 1) + '/' + y,
        day:dayName(y, m, g),
        job:label,
        status:st[(rec && rec.type) || 'cm'] || '',
        inTime:(rec && rec.in) || '',
        outTime:(rec && rec.out) || '',
        hoursNumber:fmtHoursNumber(h),
        hoursText:fmtHoursText(h),
        type:(rec && rec.auto) ? labels().auto : labels().manual,
        note:(rec && rec.note) || '',
        gps:gpsText(rec)
      });
    }

    for(var g = 1; g <= nd; g++){
      var rec = window.attData && getAttRecordByDateParts(y,m,g);
      if(!rec) continue;
      if(filter !== 'sub') add(g, rec, mainJobLabel());
      if(rec.sub && filter !== 'main') add(g, rec.sub, subJobLabel());
    }
    return rows;
  }

  function csvCell(value){
    var s = String(value == null ? '' : value);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv(rows){
    var L = labels();
    var header = [L.date, L.day, L.job, L.status, L.inn, L.out, L.hours, L.type, L.note, L.gps];
    var csv = header.map(csvCell).join(',') + '\n' + rows.map(function(r){
      return [r.date, r.day, r.job, r.status, r.inTime, r.outTime, r.hoursNumber, r.type, r.note, r.gps].map(csvCell).join(',');
    }).join('\n');
    var blob = new Blob(['\uFEFF' + csv], {type:'text/csv;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = exportBaseName() + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      if(a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
    if(typeof closePanel === 'function') closePanel('panelExcel');
  }

  function escHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  function exportPdf(rows){
    var L = labels();
    var monthTitle = '';
    try{ monthTitle = (typeof MONTHS !== 'undefined' && MONTHS[calView.m]) ? MONTHS[calView.m] : ('T' + (calView.m + 1)); }catch(e){ monthTitle = 'T' + (calView.m + 1); }
    var th = [L.date, L.day, L.job, L.status, L.inn, L.out, L.hours, L.type, L.note, L.gps];
    var html = '<!doctype html><html><head><meta charset="utf-8"><title>' + escHtml(exportBaseName()) + '</title>' +
      '<style>body{font-family:Arial,sans-serif;padding:24px;color:#1A2332}h1{font-size:20px;margin:0 0 6px}p{color:#667;margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#0D9E75;color:white}th,td{border:1px solid #ddd;padding:6px;text-align:left;vertical-align:top}.sub{color:#7B5EA7;font-weight:bold}@media print{button{display:none}}</style>' +
      '</head><body><button onclick="window.print()" style="padding:10px 16px;border-radius:10px;border:0;background:#0D9E75;color:white;font-weight:bold;margin-bottom:14px">' + escHtml(L.print) + '</button>' +
      '<h1>' + escHtml(L.report) + '</h1><p>' + escHtml(monthTitle) + ' ' + escHtml(calView.y) + ' - ' + rows.length + ' ' + escHtml(L.rows) + '</p>' +
      '<table><thead><tr>' + th.map(function(x){ return '<th>' + escHtml(x) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function(r){
        return '<tr><td>' + escHtml(r.date) + '</td><td>' + escHtml(r.day) + '</td><td class="' + (r.job === mainJobLabel() ? '' : 'sub') + '">' + escHtml(r.job) + '</td><td>' + escHtml(r.status) + '</td><td>' + escHtml(r.inTime) + '</td><td>' + escHtml(r.outTime) + '</td><td>' + escHtml(r.hoursText) + '</td><td>' + escHtml(r.type) + '</td><td>' + escHtml(r.note) + '</td><td>' + escHtml(r.gps) + '</td></tr>';
      }).join('') +
      '</tbody></table><script>setTimeout(function(){window.print()},500)<\/script></body></html>';
    var w = window.open('', '_blank');
    if(w){
      w.document.open();
      w.document.write(html);
      w.document.close();
    }else if(typeof showGpsBanner === 'function'){
      showGpsBanner(L.popupBlocked, '#E8433A');
    }
  }

  function doExportNet(){
    var rows = buildExportRows();
    if((window._exportFormat || (typeof _exportFormat !== 'undefined' ? _exportFormat : 'csv')) === 'pdf') return exportPdf(rows);
    return exportCsv(rows);
  }

  window.doExport = doExportNet;
  try{ doExport = doExportNet; }catch(e){}
  window.downloadPdf = function(){
    window._exportFormat = 'pdf';
    try{ _exportFormat = 'pdf'; }catch(e){}
    return doExportNet();
  };
  try{ downloadPdf = window.downloadPdf; }catch(e){}

  setTimeout(function(){
    try{ if(typeof renderSubJobSalary === 'function') renderSubJobSalary(); }catch(e){}
    try{ if(typeof renderHomeStats === 'function') renderHomeStats(); }catch(e){}
    try{ if(typeof renderHoursTable === 'function') renderHoursTable(); }catch(e){}
  }, 0);
})();
