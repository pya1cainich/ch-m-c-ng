/*
   debug-monitor.js - realtime debug + audit monitor
   Load last, after all app scripts.
   Captures console logs, JS errors, Smart Attendance logs, UI activity,
   screen/panel changes, and local/session storage changes.
*/

(function(){
'use strict';

var MAX_ENTRIES = 10000;
var AUTO_SCROLL = true;
var STORAGE_KEY = 'chamcongpro.debug.audit.v2';
var INPUT_AUDIT_THROTTLE_MS = 200;
var FULL_TRACE_KEY = 'cp22_debug_full_trace';
var FULL_TRACE_DEFAULT = true;

function _readFullTracePref(){
  try{
    var store = window.localStorage;
    if(!store) return FULL_TRACE_DEFAULT;
    var raw = store.getItem(FULL_TRACE_KEY);
    if(raw == null || raw === '') return FULL_TRACE_DEFAULT;
    return raw === '1' || raw === 'true';
  }catch(e){
    return FULL_TRACE_DEFAULT;
  }
}

var FULL_TRACE = _readFullTracePref();

var _logs = [];
var _filter = 'ALL';
var _search = '';
var _newCount = 0;
var _panelOpen = false;
var _pendingEntries = [];
var _flushTimer = null;
var _persistTimer = null;
var _nextSeq = 0;
var _lastInputAudit = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
var _lastUiStateKey = '';
var _uiScanTimer = null;
var _fullTraceInitDone = false;

var _storageProto = window.Storage && window.Storage.prototype;
var _rawStorage = {
  getItem: _storageProto && _storageProto.getItem,
  setItem: _storageProto && _storageProto.setItem,
  removeItem: _storageProto && _storageProto.removeItem,
  clear: _storageProto && _storageProto.clear
};

var COLORS = {
  ERROR:  {bg:'#FFF0F0', border:'#FECACA', color:'#B42318', dot:'#E8433A'},
  WARN:   {bg:'#FFF8E8', border:'#FDE68A', color:'#854F0B', dot:'#F5A623'},
  GPS:    {bg:'#E8F7EF', border:'#A7F3D0', color:'#0D6E3F', dot:'#0D9E75'},
  SA:     {bg:'#EEF4FF', border:'#BFDBFE', color:'#1F4F8F', dot:'#2D7DD2'},
  BANNER: {bg:'#F8F4FF', border:'#DDD6FE', color:'#5B21B6', dot:'#7C3AED'},
  NATIVE: {bg:'#FFF4ED', border:'#FED7AA', color:'#92400E', dot:'#F97316'},
  ACT:    {bg:'#F0FDFA', border:'#99F6E4', color:'#115E59', dot:'#14B8A6'},
  DATA:   {bg:'#F5F3FF', border:'#C4B5FD', color:'#5B21B6', dot:'#8B5CF6'},
  NAV:    {bg:'#EFF6FF', border:'#BFDBFE', color:'#1D4ED8', dot:'#3B82F6'},
  INFO:   {bg:'#F9FAFB', border:'#E5E7EB', color:'#374151', dot:'#9CA3AF'}
};

function _pad(n){ return n < 10 ? '0' + n : String(n); }

function _dateStamp(d){
  return d.getFullYear() + '-' + _pad(d.getMonth() + 1) + '-' + _pad(d.getDate());
}

function _timeStamp(d){
  return _pad(d.getHours()) + ':' + _pad(d.getMinutes()) + ':' + _pad(d.getSeconds()) + '.' +
    String(d.getMilliseconds()).padStart(3, '0').slice(0, 2);
}

function _compact(value, limit){
  var text = String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim();
  limit = limit || 180;
  if(text.length > limit) return text.slice(0, limit - 1) + '...';
  return text;
}

function _esc(s){
  return String(s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function _localStore(){
  try{ return window.localStorage; }catch(e){ return null; }
}

function _sessionStore(){
  try{ return window.sessionStorage; }catch(e){ return null; }
}

function _safeStorageGet(store, key){
  try{
    if(!_rawStorage.getItem || !store) return null;
    return _rawStorage.getItem.call(store, key);
  }catch(e){ return null; }
}

function _safeStorageSet(store, key, value){
  try{
    if(_rawStorage.setItem && store) _rawStorage.setItem.call(store, key, value);
  }catch(e){}
}

function _safeStorageRemove(store, key){
  try{
    if(_rawStorage.removeItem && store) _rawStorage.removeItem.call(store, key);
  }catch(e){}
}

function _loadStoredLogs(){
  var raw = _safeStorageGet(_localStore(), STORAGE_KEY);
  if(!raw) return;
  try{
    var saved = JSON.parse(raw);
    if(!Array.isArray(saved)) return;
    _logs = saved.slice(-MAX_ENTRIES).map(function(entry, idx){
      return {
        type: entry.type || 'INFO',
        tag: entry.tag || 'LOG',
        msg: String(entry.msg || ''),
        detail: String(entry.detail || ''),
        ts: entry.ts || '',
        date: entry.date || '',
        at: entry.at || '',
        n: typeof entry.n === 'number' ? entry.n : idx
      };
    });
    for(var i = 0; i < _logs.length; i++){
      if(_logs[i].n >= _nextSeq) _nextSeq = _logs[i].n + 1;
    }
  }catch(e){
    _logs = [];
  }
}

function _schedulePersist(){
  if(_persistTimer) return;
  _persistTimer = setTimeout(_persistLogs, 250);
}

function _persistLogs(){
  _persistTimer = null;
  try{
    var payload = _logs.slice(-MAX_ENTRIES).map(function(entry){
      return {
        type: entry.type,
        tag: entry.tag,
        msg: entry.msg,
        detail: entry.detail || '',
        ts: entry.ts,
        date: entry.date || '',
        at: entry.at || '',
        n: entry.n
      };
    });
    _safeStorageSet(_localStore(), STORAGE_KEY, JSON.stringify(payload));
  }catch(e){}
}

function _add(type, tag, msg, detail){
  var now = new Date();
  type = COLORS[type] ? type : 'INFO';
  var entry = {
    type: type,
    tag: _compact(tag || 'LOG', 24),
    msg: _compact(msg || '', 500),
    detail: detail ? _compact(detail, 700) : '',
    ts: _timeStamp(now),
    date: _dateStamp(now),
    at: now.toISOString(),
    n: _nextSeq++
  };

  _logs.push(entry);
  while(_logs.length > MAX_ENTRIES) _logs.shift();

  if(type === 'ERROR' || type === 'WARN'){
    _newCount++;
    _updateBadge();
  }
  if(_panelOpen) _queueEntry(entry);
  _schedulePersist();
}

function _argsToStr(args){
  var parts = [];
  for(var i = 0; i < args.length; i++){
    var a = args[i];
    if(typeof a === 'object' && a !== null){
      try{ parts.push(JSON.stringify(a)); }catch(e){ parts.push(String(a)); }
    } else {
      parts.push(String(a));
    }
  }
  return parts.join(' ');
}

var _c = {log: console.log, warn: console.warn, error: console.error};

console.log = function(){
  _c.log.apply(console, arguments);
  var msg = _argsToStr(arguments);
  var type = 'INFO', tag = 'LOG';
  if(msg.indexOf('[SA]') >= 0)         { type = 'SA';     tag = 'SA';  }
  else if(msg.indexOf('[GPS]') >= 0)   { type = 'GPS';    tag = 'GPS'; }
  else if(msg.indexOf('[BG]') >= 0)    { type = 'GPS';    tag = 'BG';  }
  else if(msg.indexOf('[Native]') >= 0){ type = 'NATIVE'; tag = 'NAT'; }
  else if(msg.indexOf('[CC]') >= 0)    { type = 'NATIVE'; tag = 'CC';  }
  else if(msg.indexOf('[cc-') >= 0)    { type = 'NATIVE'; tag = 'CC';  }
  _add(type, tag, msg);
};

console.warn = function(){
  _c.warn.apply(console, arguments);
  _add('WARN', 'WARN', _argsToStr(arguments));
};

console.error = function(){
  _c.error.apply(console, arguments);
  _add('ERROR', 'ERR', _argsToStr(arguments));
};

window.addEventListener('error', function(e){
  var where = '';
  if(e.filename) where = ' @ ' + e.filename.split('/').pop().split('?')[0];
  if(e.lineno) where += ':' + e.lineno;
  _add('ERROR', 'JS ERR', (e.message || 'Unknown error') + where);
}, true);

window.addEventListener('unhandledrejection', function(e){
  _add('ERROR', 'PROMISE', String(e.reason || 'Unhandled rejection'));
});

var _hooked = {saLog: false, banner: false};

function _tryHooks(){
  if(!_hooked.saLog && typeof window.saLog === 'function'){
    var orig = window.saLog;
    window.saLog = function(type, msg){
      orig.apply(this, arguments);
      _add('SA', 'SA:' + String(type).slice(0, 10), String(msg || ''));
    };
    _hooked.saLog = true;
  }
  if(!_hooked.banner && typeof window.showGpsBanner === 'function'){
    var origB = window.showGpsBanner;
    window.showGpsBanner = function(msg, color){
      origB.apply(this, arguments);
      _add('BANNER', 'BANNER', String(msg || ''), color ? 'color=' + color : '');
    };
    _hooked.banner = true;
  }
  if(_hooked.saLog && _hooked.banner) clearInterval(_hookTimer);
}

var _hookTimer = setInterval(_tryHooks, 400);
setTimeout(function(){ clearInterval(_hookTimer); }, 15000);

function _targetElement(target){
  if(!target || target === window || target === document) return null;
  if(target.nodeType === 3) return target.parentElement;
  return target.closest && target.closest('button,a,input,select,textarea,label,[role="button"],[onclick],.btn,.tab,.nav-item,.panel-overlay,.card') || target;
}

function _isInsideDebug(target){
  return !!(target && target.closest && target.closest('#panelDebug'));
}

function _elText(el){
  if(!el) return '';
  var value = el.getAttribute && (
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.getAttribute('placeholder') ||
    el.getAttribute('data-label')
  );
  if(!value && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || '')) value = el.name || el.id || el.type;
  if(!value) value = el.innerText || el.textContent || '';
  return _compact(value, 90);
}

function _describeElement(el){
  if(!el) return 'document';
  var tag = (el.tagName || 'node').toLowerCase();
  var out = tag;
  if(el.id) out += '#' + el.id;
  if(el.name) out += '[name="' + el.name + '"]';
  if(el.classList && el.classList.length){
    var classes = Array.prototype.slice.call(el.classList, 0, 3).join('.');
    if(classes) out += '.' + classes;
  }
  var text = _elText(el);
  if(text) out += ' "' + text + '"';
  return _compact(out, 180);
}

function _isSensitiveElement(el){
  if(!el) return false;
  var hint = ((el.type || '') + ' ' + (el.name || '') + ' ' + (el.id || '') + ' ' + (el.autocomplete || '')).toLowerCase();
  return /password|pass|token|secret|auth|credential|otp|pin/.test(hint);
}

function _controlValue(el){
  if(!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || '')) return '';
  if(_isSensitiveElement(el)) return '[hidden]';
  if(el.type === 'checkbox' || el.type === 'radio') return el.checked ? 'checked' : 'unchecked';
  if(el.tagName === 'SELECT'){
    var selected = Array.prototype.slice.call(el.selectedOptions || []).map(function(o){
      return _compact(o.text || o.value, 60);
    });
    return selected.join(', ');
  }
  return _compact(el.value, 140);
}

function _eventDetail(e, el){
  var parts = [];
  if(e && e.type) parts.push('event=' + e.type);
  if(el && el.tagName) parts.push('tag=' + el.tagName.toLowerCase());
  if(el && el.id) parts.push('id=' + el.id);
  if(el && el.name) parts.push('name=' + el.name);
  if(el && el.type) parts.push('type=' + el.type);
  if(e && typeof e.clientX === 'number') parts.push('xy=' + e.clientX + ',' + e.clientY);
  return parts.join(' | ');
}

function _onClick(e){
  var el = _targetElement(e.target);
  if(_isInsideDebug(el)) return;
  _add('ACT', 'CLICK', _describeElement(el), _eventDetail(e, el));
}

function _onChange(e){
  var el = _targetElement(e.target);
  if(_isInsideDebug(el)) return;
  var value = _controlValue(e.target);
  var msg = _describeElement(el);
  if(value) msg += ' => ' + value;
  _add('ACT', 'CHANGE', msg, _eventDetail(e, e.target));
}

function _onInput(e){
  var el = _targetElement(e.target);
  if(_isInsideDebug(el)) return;
  var now = Date.now();
  if(_lastInputAudit){
    var last = _lastInputAudit.get(e.target) || 0;
    if(now - last < INPUT_AUDIT_THROTTLE_MS) return;
    _lastInputAudit.set(e.target, now);
  }
  var value = _controlValue(e.target);
  var msg = _describeElement(el);
  if(value) msg += ' => ' + value;
  _add('ACT', 'INPUT', msg, _eventDetail(e, e.target));
}

function _keyLabel(e){
  var keys = [];
  if(e.ctrlKey) keys.push('Ctrl');
  if(e.metaKey) keys.push('Meta');
  if(e.altKey) keys.push('Alt');
  if(e.shiftKey) keys.push('Shift');
  keys.push(e.key || e.code || 'Key');
  return keys.join('+');
}

function _onKeydown(e){
  if(_isInsideDebug(e.target)) return;
  var special = e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab' || e.ctrlKey || e.metaKey || e.altKey;
  if(!special) return;
  var el = _targetElement(e.target);
  _add('ACT', 'KEY', _keyLabel(e) + ' on ' + _describeElement(el), _eventDetail(e, e.target));
}

function _onSubmit(e){
  var el = _targetElement(e.target);
  if(_isInsideDebug(el)) return;
  _add('ACT', 'SUBMIT', _describeElement(el), _eventDetail(e, e.target));
}

function _installActivityAudit(){
  document.addEventListener('click', _onClick, true);
  document.addEventListener('change', _onChange, true);
  document.addEventListener('input', _onInput, true);
  document.addEventListener('keydown', _onKeydown, true);
  document.addEventListener('submit', _onSubmit, true);
  document.addEventListener('touchstart', function(e){
    if(!FULL_TRACE) return;
    if(_isInsideDebug(e.target)) return;
    var t = e.touches && e.touches[0];
    var detail = t ? ('xy=' + Math.round(t.clientX) + ',' + Math.round(t.clientY)) : '';
    _add('ACT', 'TOUCH', _describeElement(_targetElement(e.target)), detail);
  }, true);
  document.addEventListener('touchend', function(e){
    if(!FULL_TRACE) return;
    if(_isInsideDebug(e.target)) return;
    _add('ACT', 'TOUCH', 'touchend ' + _describeElement(_targetElement(e.target)));
  }, true);
  document.addEventListener('pointerdown', function(e){
    if(!FULL_TRACE) return;
    if(_isInsideDebug(e.target)) return;
    var ptype = e.pointerType || 'pointer';
    _add('ACT', 'PTR', ptype + ' down ' + _describeElement(_targetElement(e.target)), 'xy=' + Math.round(e.clientX||0) + ',' + Math.round(e.clientY||0));
  }, true);
  document.addEventListener('pointerup', function(e){
    if(!FULL_TRACE) return;
    if(_isInsideDebug(e.target)) return;
    var ptype = e.pointerType || 'pointer';
    _add('ACT', 'PTR', ptype + ' up ' + _describeElement(_targetElement(e.target)));
  }, true);

  document.addEventListener('visibilitychange', function(){
    _add('NAV', 'VIS', 'document.visibilityState => ' + document.visibilityState);
  });
  window.addEventListener('focus', function(){ _add('NAV', 'FOCUS', 'window focus'); });
  window.addEventListener('blur', function(){ _add('NAV', 'FOCUS', 'window blur'); });
  window.addEventListener('resize', function(){ if(FULL_TRACE) _add('NAV', 'RESIZE', window.innerWidth + 'x' + window.innerHeight); });
  window.addEventListener('orientationchange', function(){ if(FULL_TRACE) _add('NAV', 'ORIENT', String(window.orientation || 0)); });
  window.addEventListener('online', function(){ _add('NAV', 'NET', 'online'); });
  window.addEventListener('offline', function(){ _add('NAV', 'NET', 'offline'); });
  window.addEventListener('hashchange', function(){
    _add('NAV', 'HASH', (location.hash || '#') + ' ' + location.href);
  });
  window.addEventListener('popstate', function(){
    _add('NAV', 'POP', location.href);
  });
}

function _installHistoryAudit(){
  if(!window.history || window.history.__dbgAuditWrapped) return;
  var rawPush = history.pushState;
  var rawReplace = history.replaceState;
  if(typeof rawPush === 'function'){
    history.pushState = function(state, title, url){
      var r = rawPush.apply(this, arguments);
      _add('NAV', 'PUSH', String(url || location.href));
      return r;
    };
  }
  if(typeof rawReplace === 'function'){
    history.replaceState = function(state, title, url){
      var r = rawReplace.apply(this, arguments);
      if(FULL_TRACE) _add('NAV', 'REPLACE', String(url || location.href));
      return r;
    };
  }
  window.history.__dbgAuditWrapped = true;
}

function _storageName(store){
  try{
    if(store === _localStore()) return 'localStorage';
    if(store === _sessionStore()) return 'sessionStorage';
  }catch(e){}
  return 'Storage';
}

function _isInternalStorageKey(key){
  return String(key || '') === STORAGE_KEY;
}

function _isSensitiveKey(key){
  return /password|pass|token|secret|auth|credential|otp|pin/i.test(String(key || ''));
}

function _jsonSummary(raw){
  if(raw == null) return 'null';
  if(_compact(raw, 1) === '') return 'empty';
  try{
    var parsed = JSON.parse(raw);
    if(Array.isArray(parsed)) return 'array[' + parsed.length + ']';
    if(parsed && typeof parsed === 'object') return 'object{' + Object.keys(parsed).slice(0, 8).join(',') + '}';
    return typeof parsed + ':' + _compact(parsed, 60);
  }catch(e){
    return 'text(' + String(raw).length + ')';
  }
}

function _changedJsonKeys(before, after){
  try{
    var a = before == null ? null : JSON.parse(before);
    var b = after == null ? null : JSON.parse(after);
    if(!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) || Array.isArray(b)) return '';
    var seen = {};
    Object.keys(a).concat(Object.keys(b)).forEach(function(k){ seen[k] = true; });
    var changed = Object.keys(seen).filter(function(k){
      try{ return JSON.stringify(a[k]) !== JSON.stringify(b[k]); }
      catch(e){ return true; }
    });
    return changed.slice(0, 10).join(', ');
  }catch(e){ return ''; }
}

function _storageDetail(key, before, after){
  if(_isSensitiveKey(key)) return 'value hidden';
  var detail = 'before=' + _jsonSummary(before) + ' | after=' + _jsonSummary(after);
  var changed = _changedJsonKeys(before, after);
  if(changed) detail += ' | changed=' + changed;
  return detail;
}

function _auditStorage(action, store, key, before, after){
  key = String(key || '');
  if(_isInternalStorageKey(key)) return;
  var scope = _storageName(store);
  var msg = scope + '.' + action.toLowerCase() + '(' + key + ')';
  _add('DATA', action, msg, _storageDetail(key, before, after));
}

function _installStorageAudit(){
  if(!_storageProto || !_rawStorage.setItem || _storageProto.__dbgAuditWrapped) return;
  _storageProto.setItem = function(key, value){
    var before = _safeStorageGet(this, key);
    var result = _rawStorage.setItem.apply(this, arguments);
    _auditStorage('SET', this, key, before, String(value));
    return result;
  };
  _storageProto.removeItem = function(key){
    var before = _safeStorageGet(this, key);
    var result = _rawStorage.removeItem.apply(this, arguments);
    _auditStorage('REMOVE', this, key, before, null);
    return result;
  };
  _storageProto.clear = function(){
    var scope = _storageName(this);
    var result = _rawStorage.clear.apply(this, arguments);
    _add('DATA', 'CLEAR', scope + '.clear()', 'all keys removed');
    return result;
  };
  _storageProto.__dbgAuditWrapped = true;
}

function _installNetworkAudit(){
  // fetch
  if(window.fetch && !window.fetch.__dbgAuditWrapped){
    var rawFetch = window.fetch;
    window.fetch = function(input, init){
      var method = (init && init.method) ? String(init.method).toUpperCase() : 'GET';
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var started = Date.now();
      if(FULL_TRACE) _add('NATIVE', 'FETCH', method + ' ' + _compact(url, 140));
      return rawFetch.apply(this, arguments).then(function(res){
        _add('NATIVE', 'FETCH', method + ' ' + _compact(url, 120) + ' => ' + res.status, 'time=' + (Date.now() - started) + 'ms');
        return res;
      }).catch(function(err){
        _add('ERROR', 'FETCH', method + ' ' + _compact(url, 120) + ' FAILED', String(err && err.message || err));
        throw err;
      });
    };
    window.fetch.__dbgAuditWrapped = true;
  }

  // XHR
  if(window.XMLHttpRequest && !window.XMLHttpRequest.__dbgAuditWrapped){
    var XHR = window.XMLHttpRequest;
    var rawOpen = XHR.prototype.open;
    var rawSend = XHR.prototype.send;
    XHR.prototype.open = function(method, url){
      this.__dbgMethod = String(method || 'GET').toUpperCase();
      this.__dbgUrl = String(url || '');
      this.__dbgStartedAt = 0;
      return rawOpen.apply(this, arguments);
    };
    XHR.prototype.send = function(){
      var self = this;
      self.__dbgStartedAt = Date.now();
      if(FULL_TRACE) _add('NATIVE', 'XHR', (self.__dbgMethod || 'GET') + ' ' + _compact(self.__dbgUrl || '', 140));
      self.addEventListener('loadend', function(){
        var dt = self.__dbgStartedAt ? (Date.now() - self.__dbgStartedAt) : 0;
        _add('NATIVE', 'XHR', (self.__dbgMethod || 'GET') + ' ' + _compact(self.__dbgUrl || '', 120) + ' => ' + self.status, 'time=' + dt + 'ms');
      }, { once:true });
      return rawSend.apply(this, arguments);
    };
    window.XMLHttpRequest.__dbgAuditWrapped = true;
  }
}

function _installTimerAudit(){
  if(window.__dbgTimerAuditInstalled) return;
  var rawTimeout = window.setTimeout;
  var rawInterval = window.setInterval;
  if(typeof rawTimeout === 'function'){
    window.setTimeout = function(fn, delay){
      var ms = Number(delay) || 0;
      if(FULL_TRACE && ms >= 1000){
        var name = (typeof fn === 'function' && fn.name) ? fn.name : 'anonymous';
        _add('INFO', 'TIMER', 'setTimeout ' + name + ' +' + ms + 'ms');
      }
      return rawTimeout.apply(this, arguments);
    };
  }
  if(typeof rawInterval === 'function'){
    window.setInterval = function(fn, delay){
      var ms = Number(delay) || 0;
      if(FULL_TRACE && ms >= 1000){
        var name = (typeof fn === 'function' && fn.name) ? fn.name : 'anonymous';
        _add('INFO', 'TIMER', 'setInterval ' + name + ' @' + ms + 'ms');
      }
      return rawInterval.apply(this, arguments);
    };
  }
  window.__dbgTimerAuditInstalled = true;
}

function _readUiState(){
  var active = document.querySelector('.screen.active');
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel-overlay.open')).map(function(el){
    return el.id || _describeElement(el);
  });
  return {
    screen: active ? active.id : '',
    panels: panels,
    key: (active ? active.id : '') + '|' + panels.join(',')
  };
}

function _scanUiState(reason){
  var state = _readUiState();
  if(state.key === _lastUiStateKey) return;
  var prev = _lastUiStateKey || '(initial)';
  _lastUiStateKey = state.key;
  _add('NAV', 'UI', 'screen=' + (state.screen || '-') + ' panels=' + (state.panels.join(',') || '-'), 'from=' + prev + ' | reason=' + (reason || 'change'));
}

function _queueUiScan(reason){
  clearTimeout(_uiScanTimer);
  _uiScanTimer = setTimeout(function(){ _scanUiState(reason); }, 60);
}

function _installUiAudit(){
  _lastUiStateKey = _readUiState().key;
  if(typeof MutationObserver === 'undefined') return;
  var observer = new MutationObserver(function(mutations){
    for(var i = 0; i < mutations.length; i++){
      var target = mutations[i].target;
      if(target && target.matches && (target.matches('.screen,.panel-overlay,body') || target.closest('.screen,.panel-overlay'))){
        _queueUiScan('class mutation');
        return;
      }
    }
  });
  observer.observe(document.documentElement, {subtree:true, attributes:true, attributeFilter:['class']});
  setTimeout(function(){ _scanUiState('startup'); }, 0);
}

function _matchFilter(entry){
  if(_filter !== 'ALL' && entry.type !== _filter) return false;
  if(_search){
    var hay = (entry.tag + ' ' + entry.msg + ' ' + (entry.detail || '') + ' ' + (entry.date || '')).toLowerCase();
    if(hay.indexOf(_search) < 0) return false;
  }
  return true;
}

function _queueEntry(entry){
  _pendingEntries.push(entry);
  if(_flushTimer) return;
  _flushTimer = setTimeout(_flushPending, 120);
}

function _flushPending(){
  _flushTimer = null;
  if(!_panelOpen){ _pendingEntries = []; return; }
  var body = document.getElementById('dbgBody');
  if(!body){ _pendingEntries = []; return; }
  var list = _pendingEntries.splice(0, _pendingEntries.length);
  for(var i = 0; i < list.length; i++) _appendEntry(list[i], true);
  if(AUTO_SCROLL) body.scrollTop = body.scrollHeight;
}

function _appendEntry(entry, skipScroll){
  if(!_matchFilter(entry)) return;
  var body = document.getElementById('dbgBody');
  if(!body) return;
  var c = COLORS[entry.type] || COLORS.INFO;
  var div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:5px;align-items:flex-start;padding:3px 6px;border-radius:5px;margin-bottom:2px;background:' + c.bg + ';border:1px solid ' + c.border;
  var date = entry.date ? entry.date + ' ' : '';
  var detail = entry.detail ? '<div style="font-size:9px;color:#6B7280;line-height:1.35;margin-top:1px">' + _esc(entry.detail) + '</div>' : '';
  div.innerHTML =
    '<span style="flex-shrink:0;width:5px;height:5px;border-radius:50%;background:' + c.dot + ';margin-top:5px"></span>' +
    '<span style="flex-shrink:0;font-size:9px;color:#9CA3AF;padding-top:2px;min-width:54px">' + _esc(entry.ts) + '</span>' +
    '<span style="flex-shrink:0;font-size:9px;font-weight:900;color:' + c.color + ';min-width:48px;padding-top:2px">' + _esc(entry.tag) + '</span>' +
    '<span style="font-size:10.5px;color:' + c.color + ';word-break:break-word;line-height:1.45">' +
      '<span>' + _esc(entry.msg) + '</span>' + detail +
      (date ? '<div style="font-size:8.5px;color:#9CA3AF;line-height:1.2">' + _esc(date) + '#' + entry.n + '</div>' : '') +
    '</span>';
  body.appendChild(div);
  if(AUTO_SCROLL && !skipScroll) body.scrollTop = body.scrollHeight;
}

function _rerender(){
  var body = document.getElementById('dbgBody');
  if(!body) return;
  body.innerHTML = '';
  var shown = 0;
  for(var i = 0; i < _logs.length; i++){
    if(_matchFilter(_logs[i])){ _appendEntry(_logs[i], true); shown++; }
  }
  if(shown === 0){
    body.innerHTML = '<div style="text-align:center;padding:20px;color:#9CA3AF;font-size:12px">Khong co log phu hop</div>';
  }
  body.scrollTop = body.scrollHeight;
}

function _updateStatus(){
  var bar = document.getElementById('dbgStatus');
  if(!bar) return;
  var parts = [];
  try{
    parts.push('<b>LOG:</b> ' + _logs.length + '/' + MAX_ENTRIES);
    if(window._sa){
      parts.push('<b>SA:</b> ' + _esc(_sa.state || '?'));
      parts.push(_sa.enabled ? '<span style="color:#0D9E75">ON</span>' : '<span style="color:#9CA3AF">OFF</span>');
      parts.push('GPS:' + (_sa.gpsActive ? '<span style="color:#0D9E75">UP</span>' : '<span style="color:#9CA3AF">DOWN</span>'));
    }
    if(window._gpsData){
      parts.push('<b>GEO:</b> ' + (_gpsData.enabled ? '<span style="color:#0D9E75">ON</span>' : '<span style="color:#9CA3AF">OFF</span>'));
      if(_gpsData.lat) parts.push(_gpsData.lat.toFixed(4) + ',' + _gpsData.lng.toFixed(4));
    }
    if(window.userData){
      parts.push('<b>LANG:</b>' + (userData.lang || 'vi'));
    }
  }catch(e){}
  bar.innerHTML = parts.join(' &nbsp;|&nbsp; ') || '-';
}

function _updateBadge(){
  var badge = document.getElementById('dbgBadge');
  if(!badge) return;
  if(_newCount > 0){
    badge.textContent = _newCount > 99 ? '99+' : String(_newCount);
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

window.dbgOpen = function(){
  _newCount = 0;
  _updateBadge();
  _panelOpen = true;
  var panel = document.getElementById('panelDebug');
  if(panel) panel.classList.add('open');
  _rerender();
  _updateStatus();
  _add('ACT', 'DEBUG', 'open debug monitor');
  clearInterval(window._dbgStatusTimer);
  window._dbgStatusTimer = setInterval(function(){
    if(_panelOpen) _updateStatus();
    else clearInterval(window._dbgStatusTimer);
  }, 2000);
};

window.dbgClose = function(){
  _panelOpen = false;
  clearTimeout(_flushTimer);
  _flushTimer = null;
  _pendingEntries = [];
  clearInterval(window._dbgStatusTimer);
  var panel = document.getElementById('panelDebug');
  if(panel) panel.classList.remove('open');
  _add('ACT', 'DEBUG', 'close debug monitor');
};

window.dbgClear = function(){
  _logs = [];
  _nextSeq = 0;
  _safeStorageRemove(_localStore(), STORAGE_KEY);
  var body = document.getElementById('dbgBody');
  if(body) body.innerHTML = '<div style="text-align:center;padding:20px;color:#9CA3AF;font-size:12px">Log da duoc xoa</div>';
  _updateStatus();
};

window.dbgSetFilter = function(f){
  _filter = f;
  document.querySelectorAll('.dbg-tab').forEach(function(el){
    var active = el.dataset.f === f;
    el.style.background = active ? '#1F2937' : 'white';
    el.style.color = active ? 'white' : '#374151';
    el.style.borderColor = active ? '#1F2937' : '#D1D5DB';
  });
  _rerender();
};

window.dbgSearch = function(val){
  _search = (val || '').trim().toLowerCase();
  _rerender();
};

window.dbgCopy = function(){
  var filtered = _logs.filter(_matchFilter);
  var lines = filtered
    .map(function(e){
      var head = '[' + (e.date ? e.date + ' ' : '') + e.ts + '] [' + e.type + '/' + e.tag + '] ';
      return head + e.msg + (e.detail ? ' | ' + e.detail : '');
    })
    .join('\n');
  try{
    navigator.clipboard.writeText(lines).then(function(){
      _add('INFO', 'SYS', 'Copied ' + filtered.length + ' debug rows to clipboard');
    });
  }catch(e){
    var ta = document.createElement('textarea');
    ta.value = lines;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try{ document.execCommand('copy'); }catch(ex){}
    document.body.removeChild(ta);
    _add('INFO', 'SYS', 'Copied ' + filtered.length + ' debug rows to clipboard (fallback)');
  }
};

window.dbgToggleScroll = function(){
  AUTO_SCROLL = !AUTO_SCROLL;
  var btn = document.getElementById('dbgScrollBtn');
  if(btn) btn.textContent = AUTO_SCROLL ? 'Auto' : 'Pause';
};

window.dbgSetFullTrace = function(on){
  FULL_TRACE = !!on;
  try{
    var store = window.localStorage;
    if(store) store.setItem(FULL_TRACE_KEY, FULL_TRACE ? '1' : '0');
  }catch(e){}
  _add('INFO', 'TRACE', 'Full trace ' + (FULL_TRACE ? 'ON' : 'OFF'));
};

window.dbgAudit = function(tag, msg, detail){
  _add('ACT', tag || 'APP', msg || '', detail || '');
};

window.dbgGetLogs = function(){
  return _logs.slice();
};

_loadStoredLogs();
_installActivityAudit();
_installStorageAudit();
_installHistoryAudit();
_installNetworkAudit();
_installTimerAudit();
_installUiAudit();
_tryHooks();
_add('INFO', 'SYS', 'Debug Monitor ready - app-wide audit enabled' + (FULL_TRACE ? ' (FULL)' : ''));

if(FULL_TRACE && !_fullTraceInitDone){
  _fullTraceInitDone = true;
  setTimeout(function(){
    try{
      window.dbgSetFilter('ALL');
      window.dbgOpen();
      _add('INFO', 'TRACE', 'FULL TRACE MODE ACTIVE');
    }catch(e){}
  }, 800);
}

})();
