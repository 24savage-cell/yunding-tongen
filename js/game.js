
'use strict';
/* =====================================================================
 * 《云顶道庭·彤恩卷》 双人联机修仙放置 H5
 * 为 邓恩和 与 朱婉彤 而作 · 一封可以玩的"情书"
 * 架构：单文件前端 + Supabase 后端（Auth / Postgres / Realtime）
 * ===================================================================== */

/* ---------------- 全局配置（部署前填入） ---------------- */
var CONFIG = {
  SUPABASE_URL: 'https://njrnwdcdkzhceonaguok.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qcm53ZGNka3poY2VvbmFndW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5OTQ1NTIsImV4cCI6MjEwMTU3MDU1Mn0.gplyDb2hbeayxN7muqQCp3qyax0MbF7ekdKEbHs1S1w',
  DEVELOPER_NAME: '邓恩和',
  DEVELOPER_EMAIL: '2791351309@qq.com',
  PARTNER_NAME: '朱婉彤',
  PARTNER_EMAIL: '3853397427@qq.com',
  ANNIVERSARY: '11-12',                    // 纪念日：彤华节
  GREETINGS: [
    '今天也是被恩和宠爱的一天！在我们的修仙世界里，你永远是最美的仙子～',
    '修炼辛苦了，记得休息。恩和在现实世界也很想你。',
    '婉彤仙子驾到，宗门上下喜气洋洋！',
    '你看，连这个世界的灵气都在说想你。',
    '欢迎回到我们的世界，我的掌门夫人'
  ],
  LOVE_LETTER: [
    '这个修仙世界，是我为你写的一封情书。',
    '代码会报错，灵气会枯竭，宗门会被灭，',
    '但我对你的喜欢，是这个世界上唯一不需要服务器也能运行的东西。',
    '婉彤，谢谢你出现在我的生命里。',
    '—— 邓恩和'
  ].join('\n'),
  WATERMARK: '为邓恩和与朱婉彤而作 · 云顶道庭·彤恩卷'
};
/* v5.6 更新检查：启动时从云端拉版本号，有新版本自动弹窗提示下载（方案B） */
var GAME_VERSION='v5.6.1';
var UPDATE_JSON_URL='https://njrnwdcdkzhceonaguok.supabase.co/storage/v1/object/public/game/version.json';
function checkUpdate(){
  try{
    fetch(UPDATE_JSON_URL,{cache:'no-store'}).then(function(r){ return r.json(); }).then(function(d){
      if(!d||!d.version) return;
      if(d.version===GAME_VERSION) return;
      // 同一版本只提示一次（localStorage 记录）
      var seen=false;
      try{ seen=localStorage.getItem('tyj_upd_'+d.version)==='1'; }catch(e){}
      if(seen) return;
      try{ localStorage.setItem('tyj_upd_'+d.version,'1'); }catch(e){}
      var noteTxt=d.note?'<div class="sub" style="margin-top:6px">更新内容：'+d.note+'</div>':'';
      var url=d.url||'';
      window.__updateUrl=url;
      showModal('<h2>✨ 云顶道庭有新版本</h2>'+
        '<div class="mdesc">当前版本 <b>'+GAME_VERSION+'</b>，发现新版 <b class="num-up">'+d.version+'</b>'+(d.time?('（'+d.time+'）'):'')+noteTxt+'</div>'+
        '<div class="close-row"><button class="btn gold" data-act="openUpdate"'+(url?'':' disabled')+'>去下载新版</button><button class="btn ghost" data-act="closeModal">稍后再说</button></div>');
    }).catch(function(){ /* 网络失败静默 */ });
  }catch(e){}
}

/* =====================================================================
 * 【Supabase 建表 SQL】—— 玩家需在 Supabase SQL Editor 中执行：
 * 1. 创建 Supabase 项目，复制 URL 与 anon key 填入上方 CONFIG
 * 2. 打开 SQL Editor 粘贴以下 SQL 执行
 * 3. 在 Authentication > Settings 中开启 Email 登录
 * 4. 将前端部署到 Vercel（静态托管 index.html 即可）
 * =====================================================================
 *
-- 1. 用户宗门表
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  sect_name TEXT UNIQUE NOT NULL,
  master_title TEXT DEFAULT '掌门',
  role TEXT DEFAULT 'cultivator',
  resources JSONB DEFAULT '{"spirit_stones":0,"reputation":0,"pills":{},"ores":0,"immortal_jade":0,"beast_material":0}',
  facilities JSONB DEFAULT '{}',
  sect_level INT DEFAULT 1,
  karma INT DEFAULT 0,
  sect_motto TEXT DEFAULT '',
  history JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 2. 弟子表
CREATE TABLE disciples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  spirit_root TEXT,
  comprehension INT,
  fortune INT,
  traits JSONB DEFAULT '[]',
  realm TEXT DEFAULT '炼气期',
  realm_progress INT DEFAULT 0,
  status TEXT DEFAULT '空闲',
  equipment JSONB DEFAULT '{}',
  skills JSONB DEFAULT '{}',
  is_elder BOOLEAN DEFAULT false,
  past_life_bonus JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 3. 互动记录表（交易/切磋/赠礼/结盟）
CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_profile_id UUID REFERENCES profiles(id),
  to_profile_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 4. 聊天消息表
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 5. 世界状态表
CREATE TABLE world_state (
  id INT PRIMARY KEY DEFAULT 1,
  state JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- 开启实时
ALTER PUBLICATION supabase_realtime ADD TABLE profiles, disciples, interactions, messages;
 *
 * ===================================================================== */

/* ---------------- 全局工具 ---------------- */
function irand(min,max){ return min+Math.floor(Math.random()*(max-min+1)); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function fmt(n){ n=Math.floor(n); if(n>=1e8) return (n/1e8).toFixed(1)+'亿'; if(n>=1e4) return (n/1e4).toFixed(1)+'万'; return ''+n; }
function formatDur(s){ s=Math.max(0,Math.ceil(s)); var h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=s%60; if(h) return h+'时'+m+'分'; if(m) return m+'分'+ss+'秒'; return ss+'秒'; }
function timeStr(t){ var d=new Date(t),p=function(n){return ('0'+n).slice(-2);}; return p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds()); }
function dayStart(){ var d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
function weekStart(){ var d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-(d.getDay()+6)%7); return d.getTime(); }
function todayMMDD(){ var d=new Date(),p=function(n){return ('0'+n).slice(-2);}; return p(d.getMonth()+1)+'-'+p(d.getDate()); }
function isPartnerEmail(email){ return email===CONFIG.PARTNER_EMAIL; }

/* =====================================================================
 * Canvas 美术库（Art）—— 全部美术程序化绘制，无任何外部资源
 * 图标经离屏 Canvas 绘制后缓存为 dataURL，供 UI 复用
 * ===================================================================== */
var Art={
  cache:{},
  /** 创建离屏画布 */
  make:function(w,h){ var c=document.createElement('canvas'); c.width=w; c.height=h; return c; },
  /** 获取 2d 上下文 */
  g:function(c){ return c.getContext('2d'); },
  /** 绘制并缓存 dataURL */
  url:function(key,fn,w,h){
    if(Art.cache[key]) return Art.cache[key];
    var c=Art.make(w||64,h||64); fn(Art.g(c),w||64,h||64);
    Art.cache[key]=c.toDataURL('image/png');
    return Art.cache[key];
  },
  /* ---------- 通用绘制工具 ---------- */
  /** 渐变填充圆（玉石质感） */
  orb:function(ctx,x,y,r,c1,c2,c3){
    var g=ctx.createRadialGradient(x-r*.4,y-r*.4,r*.1,x,y,r);
    g.addColorStop(0,c1); g.addColorStop(.55,c2); g.addColorStop(1,c3);
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(x-r*.32,y-r*.36,r*.28,0,Math.PI*2); ctx.fill();
  },
  /** 噪点（仿古材质） */
  noise:function(ctx,w,h,n,alpha){
    ctx.save(); ctx.globalAlpha=alpha||.06;
    for(var i=0;i<n;i++){ ctx.fillStyle=Math.random()<.5?'#3a2a14':'#f5eccf';
      ctx.fillRect(Math.random()*w,Math.random()*h,1,1); }
    ctx.restore();
  },
  /** 圆角矩形 */
  rrect:function(ctx,x,y,w,h,r){
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  },
  /* ---------- 资源图标（64x64） ---------- */
  /** 灵石：青白玉石 */
  icoLingShi:function(ctx,w,h){ Art.orb(ctx,32,32,24,'#f8ffe8','#cfe8c8','#8ab58a'); ctx.fillStyle='#4a7a5a';
    ctx.beginPath(); ctx.moveTo(18,30); ctx.lineTo(46,30); ctx.lineTo(44,36); ctx.lineTo(20,36); ctx.closePath(); ctx.globalAlpha=.4; ctx.fill(); ctx.globalAlpha=1; },
  /** 丹药：珠圆玉润，按类型着色 */
  icoPill:function(ctx,w,h,color){ Art.orb(ctx,32,32,20,color.light,color.mid,color.dark); },
  /** 矿石：棱角矿晶 */
  icoOre:function(ctx,w,h){ ctx.save();
    ctx.fillStyle='#6a6f7a'; ctx.beginPath();
    ctx.moveTo(20,42); ctx.lineTo(14,26); ctx.lineTo(30,16); ctx.lineTo(46,24); ctx.lineTo(48,38); ctx.lineTo(34,46); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#9aa2b0'; ctx.beginPath(); ctx.moveTo(30,16); ctx.lineTo(38,22); ctx.lineTo(46,24); ctx.lineTo(48,38); ctx.lineTo(34,46); ctx.lineTo(28,38); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#cfd6e0'; ctx.beginPath(); ctx.moveTo(28,22); ctx.lineTo(34,18); ctx.lineTo(38,24); ctx.closePath(); ctx.fill();
    ctx.restore(); },
  /** 仙玉：翠绿通透 */
  icoJade:function(ctx,w,h){ ctx.save(); ctx.translate(32,32); ctx.rotate(Math.PI/4);
    Art.rrect(ctx,-18,-18,36,36,6); ctx.fillStyle='#b8e8c8'; ctx.fill();
    var g=ctx.createLinearGradient(-18,-18,18,18); g.addColorStop(0,'rgba(255,255,255,.65)'); g.addColorStop(.5,'rgba(140,220,170,.25)'); g.addColorStop(1,'rgba(60,140,95,.5)');
    ctx.fillStyle=g; Art.rrect(ctx,-18,-18,36,36,6); ctx.fill();
    ctx.strokeStyle='#2f7a52'; ctx.lineWidth=2; Art.rrect(ctx,-18,-18,36,36,6); ctx.stroke();
    ctx.restore(); },
  /** 灵兽材料：绒羽 */
  icoBeast:function(ctx,w,h){ ctx.save();
    ctx.fillStyle='#c9a06a'; ctx.beginPath(); ctx.ellipse(32,34,18,22,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#e8cd9a'; ctx.beginPath(); ctx.ellipse(30,30,12,15,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#8a5a2b'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(24,20); ctx.quadraticCurveTo(28,14,34,16); ctx.stroke();
    ctx.restore(); },
  /** 声望：祥云 */
  icoRep:function(ctx,w,h){ ctx.save();
    ctx.fillStyle='#e8d9a0';
    function cloud(cx,cy,r){ ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.arc(cx+r,cy-r*.4,r*.7,0,Math.PI*2); ctx.arc(cx+r*1.8,cy,r*.6,0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=.85; cloud(20,34,11); cloud(38,28,13); ctx.globalAlpha=1;
    ctx.restore(); },
  /** 获取丹药图标 url */
  pillURL:function(kind){
    var col={guyuan:{light:'#f8e8b0',mid:'#d8b45a',dark:'#a8842a'},peiyuan:{light:'#c8f0e0',mid:'#6fc9a0',dark:'#3f8a5c'},
      ningshen:{light:'#c8dcff',mid:'#6f9adf',dark:'#3a5a9a'},xugudan:{light:'#ffd9c8',mid:'#e08a6a',dark:'#a05a3a'},zhuyan:{light:'#ffd8e8',mid:'#e88aaa',dark:'#b05f75'}}[kind]||{light:'#fff',mid:'#ccc',dark:'#999'};
    return Art.url('pill_'+kind,function(ctx,w,h){ Art.icoPill(ctx,w,h,col); });
  },
  /** 获取资源图标 url */
  resURL:function(key){
    if(key==='lingShi') return Art.url('res_ls',Art.icoLingShi);
    if(key==='rep') return Art.url('res_rep',Art.icoRep);
    if(key==='ore') return Art.url('res_ore',Art.icoOre);
    if(key==='jade') return Art.url('res_jade',Art.icoJade);
    if(key==='beast') return Art.url('res_beast',Art.icoBeast);
    return '';
  },
  /* ---------- 灵田作物图标（程序化绘制） ---------- */
  /** 灵植图标：按 id 返回 dataURL（草/花/参/果形态） */
  ltCropURL:function(id){
    var col={juqicao:{l:'#b8e8a0',m:'#5fbf6a',d:'#2f7a3f'},
      zhuyanhua:{l:'#ffd8e8',m:'#e88aaa',d:'#b05f75'},
      guyuancao:{l:'#e8f0c8',m:'#a8cf6a',d:'#6a8f3a'},
      peiyuanshen:{l:'#ffe8c8',m:'#e8a85f',d:'#a86a2f'},
      ningshenhua:{l:'#c8dcff',m:'#6f9adf',d:'#3a5a9a'},
      xianyunguo:{l:'#ffe8b8',m:'#f0c05f',d:'#b08a2f'}}[id]||{l:'#eee',m:'#aaa',d:'#666'};
    return Art.url('lt_'+id,function(ctx,w,h){
      ctx.clearRect(0,0,w,h);
      // 根部土丘
      ctx.fillStyle='rgba(122,90,60,.55)'; ctx.beginPath(); ctx.ellipse(w/2,h-6,w/2-4,6,0,0,Math.PI*2); ctx.fill();
      if(id==='juqicao'){ // 三叶草
        for(var i=0;i<3;i++){ ctx.save(); ctx.translate(w/2,h-8); ctx.rotate((i-1)*.7); ctx.strokeStyle=col.m; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(2,-10,8,-16); ctx.stroke(); ctx.fillStyle=col.l; ctx.beginPath(); ctx.ellipse(9,-17,7,4,.3,0,Math.PI*2); ctx.fill(); ctx.restore(); }
      }else if(id==='zhuyanhua'){ Art.zhuyanFlower(ctx,w/2,h-12,9); ctx.strokeStyle=col.d; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(w/2,h-12); ctx.lineTo(w/2,h-5); ctx.stroke();
      }else if(id==='guyuancao'){ ctx.strokeStyle=col.d; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(w/2,h-6); ctx.lineTo(w/2-2,-6+6); ctx.stroke(); ctx.fillStyle=col.m; ctx.beginPath(); ctx.ellipse(w/2,h-12,5,9,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle=col.l; ctx.beginPath(); ctx.ellipse(w/2,h-15,3,5,0,0,Math.PI*2); ctx.fill();
      }else if(id==='peiyuanshen'){ ctx.strokeStyle=col.d; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(w/2,h-5); ctx.lineTo(w/2,h-16); ctx.stroke(); ctx.fillStyle=col.m; ctx.beginPath(); ctx.ellipse(w/2,h-18,6,9,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(w/2-2,h-21,2,4,.4,0,Math.PI*2); ctx.fill();
      }else if(id==='ningshenhua'){ ctx.fillStyle=col.m; for(var j=0;j<6;j++){ ctx.save(); ctx.translate(w/2,h-12); ctx.rotate(j*Math.PI/3); ctx.beginPath(); ctx.ellipse(0,-7,4,7,0,0,Math.PI*2); ctx.fill(); ctx.restore(); } ctx.fillStyle=col.l; ctx.beginPath(); ctx.arc(w/2,h-12,3.5,0,Math.PI*2); ctx.fill();
      }else{ // 仙缘果（果+叶）
        ctx.fillStyle=col.d; ctx.beginPath(); ctx.arc(w/2,h-13,7,0,Math.PI*2); ctx.fill(); ctx.fillStyle=col.m; ctx.beginPath(); ctx.arc(w/2-1,h-14,5,0,Math.PI*2); ctx.fill(); ctx.fillStyle=col.l; ctx.beginPath(); ctx.arc(w/2-2,h-15,2.5,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#5fbf6a'; ctx.beginPath(); ctx.ellipse(w/2+5,h-19,4,2,.6,0,Math.PI*2); ctx.fill(); }
    },48,48);
  },
  /** 灵田地块背景（土/灵泉质感） */
  ltPlotURL:function(){
    return Art.url('lt_plot',function(ctx,w,h){
      var g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#8a6a3a'); g.addColorStop(.55,'#6f5230'); g.addColorStop(1,'#4a3418');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      ctx.fillStyle='rgba(255,255,255,.06)';
      for(var i=0;i<6;i++){ ctx.beginPath(); ctx.arc(8+Math.random()*(w-16),8+Math.random()*(h-16),2+Math.random()*3,0,Math.PI*2); ctx.fill(); }
      ctx.strokeStyle='rgba(60,40,15,.5)'; ctx.lineWidth=2; Art.rrect(ctx,1,1,w-2,h-2,6); ctx.stroke();
    },64,64);
  },
  /* ---------- 装备图标（按部位+品质） ---------- */
  /** 绘制装备轮廓（部位形状） */
  equipShape:function(ctx,part){
    ctx.save(); ctx.translate(32,32);
    ctx.fillStyle='rgba(60,50,30,.92)';
    if(part==='wuqi'){ ctx.beginPath(); ctx.moveTo(-4,22); ctx.lineTo(2,-20); ctx.lineTo(7,-22); ctx.lineTo(10,-18); ctx.lineTo(4,24); ctx.closePath(); ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(3,-20); ctx.lineTo(7,-22); ctx.stroke(); }
    else if(part==='fangju'){ Art.rrect(ctx,-16,-16,32,32,6); ctx.fill(); ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=1.5; Art.rrect(ctx,-16,-16,32,32,6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10,-6); ctx.lineTo(10,-6); ctx.stroke(); }
    else if(part==='shishi'){ ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fillStyle='rgba(240,220,160,.9)'; ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(14,0); ctx.lineTo(0,18); ctx.lineTo(-14,0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fillStyle='rgba(240,220,160,.9)'; ctx.fill(); }
    ctx.restore();
  },
  /** 装备图标（含品质边框与光效） */
  equipURL:function(part,qIdx){
    var qn=['fan','ling','xian','houtian','xiantian'][qIdx||0];
    var qc={fan:'#9a9a9a',ling:'#3f9a5c',xian:'#3a6ac9',houtian:'#8a4ac9',xiantian:'#c9a227'}[qn];
    var key='eq_'+part+'_'+qn;
    return Art.url(key,function(ctx,w,h){
      // 品质底光
      ctx.save();
      if(qn==='fan'){ ctx.strokeStyle='rgba(154,154,154,.8)'; ctx.lineWidth=2; }
      else if(qn==='ling'){ var g=ctx.createRadialGradient(32,32,8,32,32,30); g.addColorStop(0,'rgba(63,154,92,0)'); g.addColorStop(1,'rgba(63,154,92,.55)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(32,32,30,0,Math.PI*2); ctx.fill(); }
      else if(qn==='xian'){ ctx.fillStyle='rgba(58,106,201,.3)'; for(var i=0;i<6;i++){ ctx.beginPath(); ctx.arc(32+Math.cos(i*Math.PI/3)*22,32+Math.sin(i*Math.PI/3)*22,2.4,0,Math.PI*2); ctx.fill(); } }
      else if(qn==='houtian'){ ctx.strokeStyle='rgba(138,74,201,.8)'; ctx.lineWidth=2; ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(32,32,26,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); }
      else { ctx.strokeStyle='rgba(201,162,39,.9)'; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(32,32,26,0,Math.PI*2); ctx.stroke();
        ctx.strokeStyle='rgba(244,227,168,.7)'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(32,32,22,0,Math.PI*2); ctx.stroke(); }
      Art.equipShape(ctx,part);
      ctx.restore();
    });
  },
  /* ---------- 弟子头像（程序化绘制面容） ---------- */
  avatarURL:function(d){
    var elc={金:'#f2ead8',木:'#b8e0c8',水:'#c8dcf2',火:'#f2c8b0',土:'#e0c8a0'}[d.lingGen.type]||'#e8e0c8';
    var key='av_'+d.id+'_'+d.realm+'_'+d.traits.length+'_'+d.lingGen.type+'_'+d.wuXing;
    return Art.url(key,function(ctx,w,h){
      // 底色（灵根）
      var g=ctx.createRadialGradient(23,20,4,32,32,30); g.addColorStop(0,'#fff8ea'); g.addColorStop(1,elc);
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(32,32,30,0,Math.PI*2); ctx.fill();
      // 发型
      ctx.fillStyle='#2a2018'; ctx.beginPath(); ctx.arc(32,24,20,Math.PI,0); ctx.fill();
      ctx.fillStyle='#3a2c20'; ctx.beginPath(); ctx.arc(32,20,20,Math.PI*1.05,Math.PI*1.95); ctx.fill();
      // 发髻
      ctx.fillStyle='#241a12'; ctx.beginPath(); ctx.arc(32,8,7,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#d8b45a'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(32,1); ctx.lineTo(32,15); ctx.stroke();
      // 脸
      ctx.fillStyle='#f2dcc0'; ctx.beginPath(); ctx.ellipse(32,38,13,14,0,0,Math.PI*2); ctx.fill();
      // 眉
      ctx.strokeStyle='#3a2a18'; ctx.lineWidth=1.8; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(24,33); ctx.quadraticCurveTo(28,30,32,32); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(40,33); ctx.quadraticCurveTo(36,30,32,32); ctx.stroke();
      // 眼（福缘决定眼神）
      ctx.fillStyle='#22180e';
      ctx.beginPath(); ctx.arc(27,38,2.2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(37,38,2.2,0,Math.PI*2); ctx.fill();
      // 表情（词条影响：丹痴/医仙微笑，战狂/天魔凌厉）
      var smile=d.traits.some(function(t){return t==='danchi'||t==='yixian'||t==='shangjia';});
      var fierce=d.traits.some(function(t){return t==='zhanhuang'||t==='tianmo';});
      ctx.strokeStyle=fierce?'#7a2e1d':'#b06050'; ctx.lineWidth=1.6;
      if(fierce){ ctx.beginPath(); ctx.moveTo(27,45); ctx.lineTo(37,45); ctx.stroke(); }
      else if(smile){ ctx.beginPath(); ctx.arc(32,44,6,Math.PI*.15,Math.PI*.85); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(29,45); ctx.lineTo(35,45); ctx.stroke(); }
      // 境界光环
      if(d.realm>0){ var rc=d.realm>=7?'#d8b45a':d.realm>=4?'#8a6ab8':'#6fc9a0';
        ctx.strokeStyle=rc; ctx.lineWidth=2; ctx.globalAlpha=.7; ctx.beginPath(); ctx.arc(32,32,31,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1; }
    },64,64);
  },
  /* ---------- 底纹（面板材质） ---------- */
  /** 仿古绢布 */
  silkURL:function(){
    return Art.url('tex_silk',function(ctx,w,h){
      ctx.fillStyle='#f0e6c4'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(138,90,43,.18)';
      for(var x=0;x<w;x+=6){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      for(var y=0;y<h;y+=6){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      Art.noise(ctx,w,h,600,.05);
    },64,64);
  },
  /** 仿竹简 */
  bambooURL:function(){
    return Art.url('tex_bamboo',function(ctx,w,h){
      ctx.fillStyle='#d8c090'; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(90,60,25,.4)'; ctx.lineWidth=2;
      for(var x=0;x<w;x+=12){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      ctx.strokeStyle='rgba(90,60,25,.25)'; for(var x=6;x<w;x+=12){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      Art.noise(ctx,w,h,400,.06);
    },64,64);
  },
  /** 仿玉石 */
  jadeURL:function(){
    return Art.url('tex_jade',function(ctx,w,h){
      ctx.fillStyle='#e8f0e0'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle='rgba(120,190,150,.25)';
      for(var i=0;i<8;i++){ ctx.beginPath(); ctx.ellipse(Math.random()*w,Math.random()*h,Math.random()*18+6,Math.random()*8+3,Math.random()*3,0,Math.PI*2); ctx.fill(); }
      ctx.fillStyle='rgba(255,255,255,.5)';
      ctx.beginPath(); ctx.ellipse(w*.3,h*.3,w*.3,h*.2,.4,0,Math.PI*2); ctx.fill();
      Art.noise(ctx,w,h,300,.04);
    },64,64);
  },
  /* ---------- 纹样 ---------- */
  /** 朱颜花（专属纹样） */
  zhuyanFlower:function(ctx,x,y,r){
    ctx.save(); ctx.translate(x,y);
    for(var i=0;i<5;i++){ ctx.rotate(Math.PI*2/5);
      var g=ctx.createRadialGradient(0,r*.4,r*.1,0,r*.4,r);
      g.addColorStop(0,'#ffd8e8'); g.addColorStop(1,'#e88aaa');
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(0,r*.5,r*.55,r*.95,0,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#f8e8c8'; ctx.beginPath(); ctx.arc(0,0,r*.3,0,Math.PI*2); ctx.fill();
    ctx.restore();
  },
  /** 云纹（横幅装饰） */
  cloudBand:function(ctx,w,h,color){
    ctx.save(); ctx.fillStyle=color||'rgba(216,180,90,.5)';
    function cl(cx,cy,r){ ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.arc(cx+r,cy-r*.5,r*.7,0,Math.PI*2); ctx.arc(cx+r*1.7,cy,r*.55,0,Math.PI*2); ctx.fill(); }
    cl(14,12,8); cl(30,8,10); cl(46,12,7); cl(58,9,8); cl(26,18,6); cl(44,18,6);
    ctx.restore();
  },
  /* ---------- 世界地图（羊皮纸古风） ---------- */
  /** 绘制世界地图：canvas 需已设置尺寸 */
  drawWorldMap:function(canvas,state){
    var ctx=Art.g(canvas), w=canvas.width, h=canvas.height;
    // 羊皮纸底
    var g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'#e8d8a8'); g.addColorStop(1,'#d8c088');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    Art.noise(ctx,w,h,900,.07);
    // 边缘墨染
    ctx.strokeStyle='rgba(60,40,20,.4)'; ctx.lineWidth=3;
    ctx.strokeRect(4,4,w-8,h-8);
    // 区域（REGIONS 由调用方传入 state.regions）
    state.regions.forEach(function(r,i){
      var x=20+r.pos[0]*(w-40), y=20+r.pos[1]*(h-40);
      var locked=r.unlock>state.maxRealm;
      if(r.special==='tongyun'){ // 彤云谷：霞光
        var rg=ctx.createRadialGradient(x,y,6,x,y,26); rg.addColorStop(0,'rgba(255,180,190,.85)'); rg.addColorStop(1,'rgba(255,180,190,0)');
        ctx.fillStyle=rg; ctx.beginPath(); ctx.arc(x,y,26,0,Math.PI*2); ctx.fill();
      }
      if(r.special==='nianen'){ // 念恩峰：山峰
        ctx.fillStyle='rgba(60,90,60,.85)';
        ctx.beginPath(); ctx.moveTo(x-10,y+12); ctx.lineTo(x,y-14); ctx.lineTo(x+10,y+12); ctx.closePath(); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,.7)';
        ctx.beginPath(); ctx.moveTo(x,y-14); ctx.lineTo(x+2,y-4); ctx.lineTo(x-2,y-4); ctx.closePath(); ctx.fill();
      }
      if(locked){ ctx.fillStyle='rgba(40,50,45,.55)'; ctx.beginPath(); ctx.arc(x,y,15,0,Math.PI*2); ctx.fill(); }
      else {
        ctx.fillStyle='#7a2e1d'; ctx.beginPath(); ctx.arc(x,y,13,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#f5e9c8'; ctx.beginPath(); ctx.arc(x-3,y-3,5,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle='#3a2a14'; ctx.font='11px "Noto Serif SC",serif'; ctx.textAlign='center';
      ctx.fillText(r.name,x,y+26);
      if(r.special==='tongyun'){ Art.zhuyanFlower(ctx,x,y-22,7); }
    });
  },
  /* ---------- 粒子层 ---------- */
  ParticleLayer:{
    canvas:null,ctx:null,parts:[],running:false,last:0,lastFx:0,
    /** 初始化粒子层 */
    init:function(canvas){
      this.canvas=canvas; this.ctx=Art.g(canvas); this.resize();
      var self=this;
      window.addEventListener('resize',function(){ self.resize(); });
    },
    resize:function(){
      var c=this.canvas; c.width=window.innerWidth; c.height=window.innerHeight;
    },
    /** 环境灵气光点 */
    ambient:function(){
      if(this.parts.length<12){ this.parts.push({t:'spark',x:Math.random()*this.canvas.width,y:this.canvas.height+10,v:.3+Math.random()*.6,r:.8+Math.random()*1.8,a:.3+Math.random()*.4,hue:Math.random()<.5?'#d8b45a':'#9ad8b0'}); }
    },
    /** 花瓣雨（朱颜花瓣） */
    petals:function(n){
      n=n||40;
      for(var i=0;i<n;i++) this.parts.push({t:'petal',x:Math.random()*this.canvas.width,y:-20-Math.random()*this.canvas.height*.5,
        v:.4+Math.random()*.8,dr:Math.random()*2-1,rot:Math.random()*6,r:3+Math.random()*3});
    },
    /** 金色粒子爆发（突破/飞升） */
    burst:function(x,y,n){
      x=x||this.canvas.width/2; y=y||this.canvas.height/3; n=n||50;
      for(var i=0;i<n;i++){ var a=Math.random()*Math.PI*2, sp=.6+Math.random()*3;
        this.parts.push({t:'spark',x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-1,r:1+Math.random()*2.5,a:.9,hue:'#ffe9a8',life:60}); }
    },
    /** 光柱（飞升） */
    pillar:function(x,y){
      this.parts.push({t:'pillar',x:x||this.canvas.width/2,y:y||this.canvas.height,life:90,a:0});
    },
    /** 每帧更新+绘制（30fps 限帧，移动端减半） */
    frame:function(ts){
      if(!this.running) return;
      if(ts-this.last<33) return; this.last=ts;
      var mobile=window.innerWidth<480, c=this.canvas, ctx=this.ctx;
      ctx.clearRect(0,0,c.width,c.height);
      for(var i=this.parts.length-1;i>=0;i--){
        var p=this.parts[i];
        if(p.t==='spark'){
          p.y-=(p.vy||p.v); if(p.vx) p.x+=p.vx;
          if(p.life!==undefined){ p.life--; p.a-=.015; }
          ctx.fillStyle=p.hue; ctx.globalAlpha=Math.max(0,p.a);
          ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
          if(p.y<-10||p.a<=0||p.x<-10||p.x>c.width+10) this.parts.splice(i,1);
        }else if(p.t==='petal'){
          p.y+=p.v; p.x+=p.dr*.5; p.rot+=.05;
          ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
          ctx.fillStyle='rgba(232,138,170,.85)';
          ctx.beginPath(); ctx.ellipse(0,0,p.r,p.r*.55,0,0,Math.PI*2); ctx.fill(); ctx.restore();
          if(p.y>c.height+10) this.parts.splice(i,1);
        }else if(p.t==='pillar'){
          p.life--; p.a+=.04;
          var pg=ctx.createLinearGradient(p.x-10,0,p.x+10,0);
          pg.addColorStop(0,'rgba(255,233,168,0)'); pg.addColorStop(.5,'rgba(255,233,168,'+(p.a*.6)+')'); pg.addColorStop(1,'rgba(255,233,168,0)');
          ctx.fillStyle=pg; ctx.fillRect(p.x-10,0,20,p.y);
          if(p.life<=0) this.parts.splice(i,1);
        }
      }
      ctx.globalAlpha=1;
      // 环境灵气（移动端减半）
      if(mobile){ if(Math.random()<.25) this.ambient(); } else if(Math.random()<.5) this.ambient();
      requestAnimationFrame(function(t){ Art.ParticleLayer.frame(t); });
    },
    start:function(){ if(this.running) return; this.running=true; var self=this; requestAnimationFrame(function(t){ self.frame(t); }); }
  },
  /* ---------- 水墨开场动画（约10秒，可跳过） ---------- */
  /** 播放水墨开场：introCanvas 显示，结束后 onDone 回调 */
  playIntro:function(canvas,onDone){
    var ctx=Art.g(canvas);
    canvas.style.display='block';
    canvas.width=window.innerWidth; canvas.height=window.innerHeight;
    var w=canvas.width,h=canvas.height,t=0,max=600;  // ~10s @60fps
    function frame(){
      ctx.clearRect(0,0,w,h);
      // 天空渐变
      var g=ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,'#0d1512'); g.addColorStop(.6,'#1a2a24'); g.addColorStop(1,'#2c3a30');
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // 远山
      ctx.fillStyle='rgba(30,50,42,.9)';
      ctx.beginPath(); ctx.moveTo(0,h*.62);
      for(var x=0;x<=w;x+=10) ctx.lineTo(x,h*.62-Math.sin(x*.008+t*.001)*18-Math.abs(Math.sin(x*.02))*26);
      ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fill();
      // 中景山
      ctx.fillStyle='rgba(22,38,32,.95)';
      ctx.beginPath(); ctx.moveTo(0,h*.78);
      for(x=0;x<=w;x+=10) ctx.lineTo(x,h*.78-Math.sin(x*.012+2)*14-Math.abs(Math.sin(x*.03+1))*20);
      ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fill();
      // 双人剪影（恩和与婉彤，携手飞升）
      var px=w*.5, py=h*.4 - t*.05;
      ctx.strokeStyle='#0a120e'; ctx.lineWidth=3; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(px-26,py+30); ctx.quadraticCurveTo(px-30,py+8,px-16,py+6); ctx.stroke();   // 左人
      ctx.beginPath(); ctx.moveTo(px+26,py+30); ctx.quadraticCurveTo(px+30,py+8,px+16,py+6); ctx.stroke();   // 右人
      ctx.beginPath(); ctx.moveTo(px-16,py+6); ctx.lineTo(px+16,py+6); ctx.stroke();                          // 携手
      ctx.beginPath(); ctx.moveTo(px-12,py+2); ctx.quadraticCurveTo(px-16,py-12,px-6,py-14); ctx.stroke();    // 左袖
      ctx.beginPath(); ctx.moveTo(px+12,py+2); ctx.quadraticCurveTo(px+16,py-12,px+6,py-14); ctx.stroke();    // 右袖
      // 上升光点
      ctx.fillStyle='rgba(216,180,90,.8)';
      for(var i=0;i<8;i++){ var sy=(py+40-(t*.3+i*18))%h; ctx.globalAlpha=.6; ctx.beginPath(); ctx.arc(px+(i%3-1)*40, sy, 2, 0, Math.PI*2); ctx.fill(); }
      ctx.globalAlpha=1;
      // 题字（淡入）
      if(t>30){ var a=Math.min(1,(t-30)/60);
        ctx.fillStyle='rgba(232,220,180,'+a+')'; ctx.font='15px "Noto Serif SC",serif'; ctx.textAlign='center';
        ctx.fillText('上古道侣 恩和真人 与 婉彤仙子 携手飞升',w/2,h*.3);
        ctx.fillText('一缕情思，遗落人间，化为云顶道庭',w/2,h*.3+24); }
      t++;
      if(t>=max){ canvas.style.display='none'; if(onDone) onDone(); return; }
      setTimeout(frame,1000/30);
    }
    frame();
  }
};

/* =====================================================================
 * 音频系统（Web Audio API 全程序化生成）
 * 五声音阶随机漫步 BGM；朱婉彤客户端 20:00-22:00 自动切换柔美变奏
 * ===================================================================== */
var PENTA_SCALE=[220,247,277,330,370,440,494,554,660,740,880];       // A 羽调式
var PENTA_SCALE_LOW=[110,123,139,165,185,220];
var AudioSys=function(){
  this.ctx=null; this.musicOn=true; this.sfxOn=true; this.musicVol=.45; this.sfxVol=.8;
  this.mode='normal'; this.bgmTimer=null; this.step=0; this.note=4; this.envs={}; this.noiseBuf=null;
  this.isPartner=false; this.lastSoftCheck=0;
};
AudioSys.prototype={
  /** 初始化/恢复 AudioContext（需用户手势） */
  ensure:function(){
    if(!this.ctx){ try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ this.ctx=null; } }
    if(this.ctx&&this.ctx.state==='suspended'){ try{ this.ctx.resume(); }catch(e){} }
    return !!this.ctx;
  },
  noiseBufGet:function(){
    if(!this.noiseBuf){ var len=this.ctx.sampleRate*2,b=this.ctx.createBuffer(1,len,this.ctx.sampleRate),d=b.getChannelData(0);
      for(var i=0;i<len;i++) d[i]=Math.random()*2-1; this.noiseBuf=b; }
    return this.noiseBuf;
  },
  /** 单音：cat='music'|'sfx' 分别受开关控制 */
  tone:function(freq,dur,vol,type,delay,cat,attack){
    if(!this.ensure()) return;
    if(cat==='music'&&!this.musicOn) return;
    if(cat==='sfx'&&!this.sfxOn) return;
    var t=this.ctx.currentTime+(delay||0), o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(freq,t);
    var v=(cat==='music'?this.musicVol:this.sfxVol)*vol;
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+(attack||.01));
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t+dur+.05);
  },
  /** 扫频音（剑鸣） */
  sweep:function(f1,f2,dur,vol,delay,type){
    if(!this.ensure()||!this.sfxOn) return;
    var t=this.ctx.currentTime+(delay||0), o=this.ctx.createOscillator(), g=this.ctx.createGain();
    o.type=type||'sine'; o.frequency.setValueAtTime(f1,t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+dur);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(this.sfxVol*vol,t+.02);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t+dur+.05);
  },
  /** 噪声 */
  noise:function(dur,vol,freq,type,delay){
    if(!this.ensure()||!this.sfxOn) return;
    var t=this.ctx.currentTime+(delay||0);
    var src=this.ctx.createBufferSource(); src.buffer=this.noiseBufGet(); src.loop=true;
    var f=this.ctx.createBiquadFilter(); f.type=type||'bandpass'; f.frequency.value=freq||800; f.Q.value=.8;
    var g=this.ctx.createGain();
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(this.sfxVol*vol,t+.05);
    g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    src.connect(f).connect(g).connect(this.ctx.destination); src.start(t); src.stop(t+dur+.05);
  },
  /* ---------- 音效 ---------- */
  click:function(){ this.tone(880,.08,.5,'sine',0,'sfx',.002); this.tone(1320,.05,.2,'sine',.01,'sfx'); },
  recruit:function(){ this.tone(523,1.2,.5,'sine',0,'sfx',.01); this.tone(659,1.2,.4,'sine',.18,'sfx'); this.tone(784,1.2,.3,'sine',.36,'sfx'); },
  breakOk:function(){ this.noise(.6,.5,180,'lowpass',0); this.sweep(180,880,.8,.6,'sine',.1); this.tone(440,.9,.3,'sine',.15,'sfx'); },
  breakFail:function(){ this.tone(110,.6,.6,'sawtooth',0,'sfx'); this.tone(82,.7,.4,'sawtooth',.08,'sfx'); },
  alchemy:function(){ this.noise(.12,.35,320,'bandpass',0); this.tone(1568,.18,.4,'sine',.12,'sfx'); this.tone(2093,.12,.25,'sine',.15,'sfx'); },
  forge:function(){ this.noise(.3,.4,1500,'highpass',0); this.tone(1200,.15,.2,'square',.1,'sfx'); },
  travelGo:function(){ this.noise(1.2,.5,700,'bandpass',0); },
  travelBack:function(){ for(var i=0;i<4;i++) this.noise(.08,.3,500,'bandpass',i*.12); },
  ascend:function(){ var fs=[523,659,784,1046,1318]; for(var i=0;i<5;i++) this.tone(fs[i],2,.4,'sine',i*.22,'sfx',.05); this.tone(261,2.5,.3,'triangle',.3,'sfx'); },
  upgrade:function(){ this.tone(660,.1,.4,'sine',0,'sfx'); this.tone(990,.15,.35,'sine',.08,'sfx'); },
  equip:function(){ this.tone(1879,.2,.3,'sine',0,'sfx'); this.tone(2500,.25,.2,'sine',.05,'sfx'); },
  coin:function(){ this.tone(1318,.07,.3,'sine',0,'sfx'); this.tone(1760,.1,.3,'sine',.06,'sfx'); },
  injury:function(){ this.tone(196,.4,.4,'sawtooth',0,'sfx'); this.sweep(300,150,.3,.3,'sine',.05); },
  event:function(){ this.tone(1046,.25,.35,'sine',0,'sfx'); this.tone(784,.25,.3,'sine',.12,'sfx'); this.tone(1318,.35,.3,'sine',.24,'sfx'); },
  gift:function(){ this.tone(1318,.3,.3,'sine',0,'sfx'); this.tone(1760,.4,.25,'sine',.15,'sfx'); this.tone(2093,.5,.2,'sine',.3,'sfx'); },
  warp:function(){ this.noise(.8,.6,400,'lowpass',0); },
  /* ---------- BGM ---------- */
  /** 检测是否应使用柔美变奏（朱婉彤 20:00-22:00） */
  softMode:function(){
    if(!this.isPartner) return false;
    var h=new Date().getHours();
    return h>=20&&h<22;
  },
  /** 启动 BGM */
  startBGM:function(){
    if(this.bgmTimer) return;
    this.note=4; this.step=0;
    var self=this;
    function tick(){
      if(!self.ensure()) return;
      if(!self.musicOn) return;
      var soft=self.softMode();
      var p=PENTA_SCALE, oct=self.mode==='battle'?1:self.mode==='glory'?2:0;
      self.note=Math.max(1,Math.min(p.length-2,self.note+irand(-2,2)));
      var dur=self.mode==='battle'?1.1:self.mode==='glory'?2.4:2.4;
      self.tone(p[self.note]*Math.pow(2,oct),dur,.26,'sine',0,'music',.02);
      if(soft){ self.tone(p[self.note]*1.5,dur*.7,.14,'sine',.12,'music'); }   // 柔美泛音
      else if(Math.random()<.25){ self.tone(p[self.note+irand(1,3)]*Math.pow(2,oct),dur*.6,.12,'sine',.18,'music'); }
      if(self.step%8===0) self.tone(pick(PENTA_SCALE_LOW),4.5,.22,'triangle',0,'music',.1);
      if(self.mode==='battle') self.noise(.06,.18,180,'lowpass',0);
      if(self.mode==='glory') self.tone(p[self.note]*2,2.6,.14,'sine',.4,'music');
      self.step++;
    }
    tick();
    this.bgmTimer=setInterval(tick,this.mode==='battle'?1400:this.mode==='glory'?2600:2800);
  },
  setMusicMode:function(mode){
    if(this.mode===mode) return;
    this.mode=mode;
    if(this.bgmTimer){ clearInterval(this.bgmTimer); this.bgmTimer=null; this.startBGM(); }
  },
  stopBGM:function(){ if(this.bgmTimer){ clearInterval(this.bgmTimer); this.bgmTimer=null; } },
  /* ---------- 环境音 ---------- */
  env:function(name,on){
    if(!this.ensure()) return;
    if(!on){ if(this.envs[name]){ if(this.envs[name].timer) clearInterval(this.envs[name].timer);
      try{ this.envs[name].stop&&this.envs[name].stop(); }catch(e){} delete this.envs[name]; } return; }
    if(this.envs[name]) return;
    if(name==='xiushen'){
      var t=this.ctx.currentTime, self=this;
      var src=this.ctx.createBufferSource(); src.buffer=this.noiseBufGet(); src.loop=true;
      var f=this.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=600; f.Q.value=1.2;
      var g=this.ctx.createGain(); g.gain.value=0; g.gain.linearRampToValueAtTime(.05*this.musicVol,t+2);
      src.connect(f).connect(g).connect(this.ctx.destination); src.start(t);
      var lfo=this.ctx.createOscillator(); lfo.frequency.value=.15; var lg=this.ctx.createGain(); lg.gain.value=.025;
      lfo.connect(lg).connect(g.gain); lfo.start(t);
      var cicada=setInterval(function(){ if(self.musicOn) self.tone(4200,.12,.03,'sine',0,'music'); },irand(1800,4000));
      this.envs.xiushen={stop:function(){ try{src.stop();lfo.stop();g.gain.exponentialRampToValueAtTime(.0001,self.ctx.currentTime+.5);}catch(e){} },timer:cicada};
    }
    if(name==='fangshi'){
      var t2=this.ctx.currentTime, self2=this;
      var src2=this.ctx.createBufferSource(); src2.buffer=this.noiseBufGet(); src2.loop=true;
      var f2=this.ctx.createBiquadFilter(); f2.type='lowpass'; f2.frequency.value=500;
      var g2=this.ctx.createGain(); g2.gain.value=0; g2.gain.linearRampToValueAtTime(.045*this.musicVol,t2+1.5);
      src2.connect(f2).connect(g2).connect(this.ctx.destination); src2.start(t2);
      this.envs.fangshi={stop:function(){ try{src2.stop();g2.gain.exponentialRampToValueAtTime(.0001,self2.ctx.currentTime+.4);}catch(e){} }};
    }
    if(name==='tongyun'){ // 彤云谷：鸟语花香（高频短音序列）
      var self3=this, timer=setInterval(function(){ if(self3.musicOn){ self3.tone(irand(2000,3200),.15,.04,'sine',0,'music'); if(Math.random()<.3) self3.tone(irand(2400,3600),.2,.03,'sine',.1,'music'); } },irand(900,1600));
      this.envs.tongyun={stop:function(){ clearInterval(timer); },timer:timer};
    }
  },
  stopAllEnv:function(){ for(var k in this.envs){ if(this.envs[k].timer) clearInterval(this.envs[k].timer); try{this.envs[k].stop&&this.envs[k].stop();}catch(e){} } this.envs={}; }
};
/** v5.3 程序化古风 BGM（Web Audio 五声音阶合成，零体积零外部依赖）
 *  模式：login 悠远 | normal 舒缓 | battle 急促 | farm 清新
 *  受 musicOn/musicVol 控制（设置面板开关） */
AudioSys.prototype.bgm=function(mode){
  if(!this.ensure()) return;
  if(this.bgmTimer) return;
  var self=this;
  this.bgmMode=mode||'normal';
  var PENTA=[261.63,293.66,329.63,392.00,440.00,523.25,587.33,659.25,783.99];
  var BASS=[130.81,146.83,164.81,196.00,220.00,261.63];
  var tempo={login:900,normal:640,battle:340,farm:500}[this.bgmMode]||640;
  this.step=0;
  this.bgmTimer=setInterval(function(){
    if(!self.musicOn||!self.ctx) return;
    var i=self.step++;
    // 低音铺底（每 4 拍，长音）
    if(i%4===0){
      var b=BASS[Math.floor(Math.random()*BASS.length)];
      self.tone(b,1.4,.09,'sine',0,'music');
      self.tone(b*2,1.4,.045,'triangle',0,'music');
    }
    // 主旋律（五声音阶随机游走）
    var f=PENTA[Math.floor(Math.random()*PENTA.length)];
    var dur=(self.bgmMode==='battle')?.16:.42;
    self.tone(f,dur,.10,'triangle',0,'music');
    // 战斗模式：密集装饰音
    if(self.bgmMode==='battle'&&Math.random()<.6) self.tone(f*1.5,.1,.06,'sine',0,'music');
    // 登录模式：空灵八度泛音
    if(self.bgmMode==='login'&&i%2===0) self.tone(f*2,.7,.03,'sine',0,'music');
    // 灵田模式：高音鸟鸣点缀
    if(self.bgmMode==='farm'&&Math.random()<.25) self.tone(PENTA[6+Math.floor(Math.random()*3)],.2,.05,'sine',0,'music');
  },tempo);
};
AudioSys.prototype.stopBgm=function(){
  if(this.bgmTimer){ clearInterval(this.bgmTimer); this.bgmTimer=null; }
};
var audio=new AudioSys();

/* =====================================================================
 * 全局配置表（境界/灵根/词条/丹药/装备/功法/设施/流派/区域/NPC/事件/任务/成就）
 * ===================================================================== */
/* ---------- 境界表（含称呼与基础突破率） ---------- */
var REALMS=[
  {name:'炼气期',need:100,  br:.80,title:'道童',power:60},
  {name:'筑基期',need:500,  br:.65,title:'修士',power:180},
  {name:'金丹期',need:2000, br:.50,title:'真人',power:600},
  {name:'元婴期',need:8000, br:.35,title:'真君',power:1800},
  {name:'化神期',need:30000, br:.25,title:'仙尊',power:6000},
  {name:'炼虚期',need:100000, br:.18,title:'仙尊',power:18000},
  {name:'合体期',need:350000, br:.12,title:'仙尊',power:60000},
  {name:'大乘期',need:1200000, br:.08,title:'仙尊',power:180000},
  {name:'渡劫期',need:5000000, br:.05,title:'仙尊',power:600000},
];
var REALM_NAMES=REALMS.map(function(r){return r.name;});

/* ---------- 五行与灵根 ---------- */
var ELEMENTS=['金','木','水','火','土'];
var EL_COLOR={'金':'#f2ead8','木':'#b8e0c8','水':'#c8dcf2','火':'#f2c8b0','土':'#e0c8a0'};
var LINGGEN=[
  {quality:'天灵根',mult:1.3,prob:.10},
  {quality:'单灵根',mult:1.0,prob:.60},
  {quality:'伪灵根',mult:0.8,prob:.30},
];
/* ---------- 词条池（12+） ---------- */
var TRAITS=[
  {id:'danchi',name:'丹痴',desc:'炼丹产量+25%'},
  {id:'jianghun',name:'匠魂',desc:'炼器速度+20%'},
  {id:'jianxin',name:'剑心',desc:'剑系功法效果翻倍'},
  {id:'conghui',name:'聪慧',desc:'修炼速度+15%'},
  {id:'hongyun',name:'鸿运',desc:'福缘+30'},
  {id:'yixian',name:'医仙',desc:'恢复速度翻倍'},
  {id:'zhanhuang',name:'战狂',desc:'战斗属性+20%'},
  {id:'tuling',name:'土灵体',desc:'土系功法威力+25%'},
  {id:'huoling',name:'火灵体',desc:'火系功法威力+25%'},
  {id:'muling',name:'木灵体',desc:'木系功法威力+25%'},
  {id:'shuiling',name:'水灵体',desc:'水系功法威力+25%'},
  {id:'jinling',name:'金灵体',desc:'金系功法威力+25%'},
  {id:'yinleiti',name:'引雷体',desc:'雷系词缀「余雷」效果翻倍'},
  {id:'tiegu',name:'铁骨',desc:'突破受伤概率减半'},
  {id:'lingmou',name:'灵眸',desc:'游历收益+20%'},
  {id:'shangjia',name:'商贾',desc:'游历灵石收益+30%'},
  {id:'tianjuan',name:'天眷',desc:'突破成功率+5%'},
  {id:'jingdu',name:'静笃',desc:'突破失败修为损失减半'},
  {id:'xunjie',name:'迅捷',desc:'游历耗时-15%'},
  {id:'tianmo',name:'天魔体',desc:'战斗+35%，受伤概率+10%'},
  {id:'zhuanShi',name:'转世灵童',desc:'修炼+20%，突破+10%'},
];
var EL_BODY_TRAIT={'金':'jinling','木':'muling','水':'shuiling','火':'huoling','土':'tuling'};
/* ---------- 丹药 ---------- */
var PILLS={
  guyuan:{name:'固元丹',desc:'服用后增加修为'},
  peiyuan:{name:'培元丹',desc:'修炼速度+50%，持续120秒'},
  ningshen:{name:'凝神丹',desc:'下一次突破成功率+15%'},
  xugudan:{name:'续骨丹',desc:'立即治愈伤势'},
  zhuyan:{name:'朱颜丹',desc:'修炼速度+30%，持续2小时（彤云谷朱颜花炼制）'},
};
/* ---------- 灵田系统（灵植图鉴） ---------- */
/* 灵植：lv=灵田等级解锁; time=生长秒数; cost=种子价; yield=成熟产出(资源:数量);
   yield 键: lingShi/zhuyanFlower/pill_固元丹/.../xianYu */
var LT_CROPS=[
  {id:'juqicao',  name:'聚气草',   lv:1,  time:60,    cost:{lingShi:20},  yield:{lingShi:60},       desc:'吸纳天地灵气凝叶，售价可观'},
  {id:'zhuyanhua',name:'朱颜花',   lv:3,  time:300,   cost:{lingShi:150}, yield:{zhuyanFlower:1},   desc:'彤云谷灵种，可炼朱颜丹赠佳人'},
  {id:'guyuancao',name:'固元灵药', lv:5,  time:600,   cost:{lingShi:400}, yield:{pill_guyuan:3},     desc:'丹房上等原料，可炼固元丹'},
  {id:'peiyuanshen',name:'培元参', lv:7,  time:1200,  cost:{lingShi:1000},yield:{pill_peiyuan:2},    desc:'参须泛灵光，可炼培元丹'},
  {id:'ningshenhua',name:'凝神花', lv:9,  time:2400,  cost:{lingShi:2500},yield:{pill_ningshen:1},   desc:'凝神静气，可炼凝神丹'},
  {id:'xianyunguo',name:'仙缘果',  lv:12, time:4800,  cost:{lingShi:6000},yield:{xianYu:3},          desc:'百年一熟，蕴含一缕仙缘'}
];
function LT_cropById(id){ for(var i=0;i<LT_CROPS.length;i++) if(LT_CROPS[i].id===id) return LT_CROPS[i]; return null; }
/* ---------- 装备系统 ---------- */
var EQUIP_PARTS=[
  {key:'wuqi',name:'武器'},{key:'fangju',name:'防具'},{key:'shishi',name:'饰品'},{key:'fabao',name:'法宝'}
];
var QUALITIES=[
  {key:'fan',name:'凡品',affix:1,base:1},
  {key:'ling',name:'灵品',affix:2,base:1.6},
  {key:'xian',name:'仙品',affix:3,base:2.5},
  {key:'houtian',name:'后天灵宝',affix:4,base:4},
  {key:'xiantian',name:'先天至宝',affix:4,base:6.5,special:true},
];
var EQUIP_BASES={wuqi:['青锋剑','玄铁重剑','碧水刀','紫电长枪','彤霞剑','落英弓'],fangju:['玄铁甲','青云袍','金丝软甲','彤霞裳','玄武盾'],shishi:['护心镜','玉佩','乾坤袋','聚灵珠','彤霞簪','天机罗盘'],fabao:['紫金葫芦','玄铁拂尘','灵光宝珠','定风珠','彤霞佩','七星剑匣']};
/* 词缀池（30+）：stat 为加成键；thunder 与「引雷体」联动 */
var AFFIXES=[
  {id:'fengrui',name:'锋锐',stat:'atk',v:.15,desc:'攻击+15%'},
  {id:'jianbi',name:'坚壁',stat:'def',v:.15,desc:'防御+15%'},
  {id:'lingyun',name:'灵蕴',stat:'speed',v:.08,desc:'修炼速度+8%'},
  {id:'wudao',name:'悟道',stat:'breakRate',v:.04,desc:'突破成功率+4%'},
  {id:'xunjie',name:'迅捷',stat:'travelSpeed',v:.05,desc:'游历时间-5%'},
  {id:'jubao',name:'聚宝',stat:'travelGain',v:.10,desc:'游历收益+10%'},
  {id:'danhuo',name:'丹火',stat:'alchemy',v:.10,desc:'炼丹产量+10%'},
  {id:'bailian',name:'百炼',stat:'forge',v:.10,desc:'炼器速度+10%'},
  {id:'ruimu',name:'锐目',stat:'crit',v:.05,desc:'暴击率+5%'},
  {id:'houtu',name:'厚土',stat:'hp',v:.10,desc:'生命+10%'},
  {id:'yulei',name:'余雷',stat:'thunder',v:.20,desc:'雷系伤害+20%（引雷体翻倍）'},
  {id:'xuanbing',name:'玄冰',stat:'defResist',v:.10,desc:'防御+10%，受伤-5%'},
  {id:'lieyan',name:'烈焰',stat:'atkBurn',v:.10,desc:'攻击+10%，武技附灼烧'},
  {id:'qingmu',name:'青木',stat:'alchSpeed',v:.08,desc:'炼丹+8%，修炼+3%'},
  {id:'jingang',name:'金刚',stat:'defHp',v:.12,desc:'防御+12%，生命+8%'},
  {id:'huanying',name:'幻影',stat:'speedDodge',v:.08,desc:'游历速度+8%，受伤-8%'},
  {id:'dingshen',name:'定神',stat:'breakWX',v:.03,desc:'突破率+3%，悟性+2'},
  {id:'yannian',name:'延年',stat:'hp',v:.15,desc:'生命+15%'},
  {id:'tanlan',name:'贪婪',stat:'travelLS',v:.15,desc:'游历灵石+15%'},
  {id:'jianyi',name:'剑意',stat:'sword',v:.20,desc:'剑系武技威力+20%'},
  {id:'danxin',name:'丹心',stat:'pillEff',v:.10,desc:'丹药效果+10%'},
  {id:'shouhu',name:'守护',stat:'resist',v:.10,desc:'受伤概率-10%'},
  {id:'longwei',name:'龙威',stat:'atkTravel',v:.12,desc:'攻击+12%，游历成功率+5%'},
  {id:'fengming',name:'凤鸣',stat:'speedBreak',v:.08,desc:'修炼+8%，突破+2%'},
  {id:'tianyan',name:'天眼',stat:'chest',v:.10,desc:'宝箱发现率+10%'},
  {id:'jifeng',name:'疾风',stat:'travelSpeed',v:.08,desc:'游历时间-8%'},
  {id:'panshi',name:'磐石',stat:'defResist',v:.15,desc:'防御+15%，受伤-5%'},
  {id:'xingchen',name:'星辰',stat:'allAtk',v:.03,desc:'攻防生+3%'},
  {id:'youhun',name:'幽魂',stat:'travelWin',v:.08,desc:'游历战斗成功率+8%'},
  {id:'fuxing',name:'福星',stat:'lucky',v:5,desc:'福缘+5'},
  {id:'lingxi',name:'灵犀',stat:'breakRate',v:.05,desc:'突破成功率+5%'},
  {id:'taixu',name:'太虚',stat:'speed',v:.10,desc:'修炼速度+10%'},
  {id:'guiyuan',name:'归元',stat:'heal',v:.15,desc:'恢复速度+15%'},
  {id:'hongxia',name:'彤霞',stat:'zhuyan',v:.30,desc:'朱颜丹效果+30%'},
  /* v5 深度词缀：王者式五维 */
  {id:'huixin',name:'会心',stat:'critDmg',v:.30,desc:'暴击伤害+30%'},
  {id:'pojia',name:'破甲',stat:'penetrate',v:.10,desc:'无视护甲10%'},
  {id:'xixue',name:'嗜血',stat:'lifesteal',v:.08,desc:'吸血8%（造成伤害回复生命）'},
  {id:'shunying',name:'瞬影',stat:'dodge',v:.08,desc:'闪避+8%'},
  {id:'tiejin',name:'铁壁',stat:'block',v:.12,desc:'格挡+12%（伤害减半）'},
];
/* 套装 */
var SETS={
  qingyun:{name:'青云套装',parts:{wuqi:'青云剑',fangju:'青云袍',shishi:'青云冠',fabao:'青云佩'},two:'游历速度+20%',four:'剑系武技威力+50%'},
  tongxia:{name:'彤霞套装',parts:{wuqi:'彤霞剑',fangju:'彤霞裳',shishi:'彤霞簪',fabao:'彤霞佩'},two:'炼丹产量+20%',four:'朱颜丹效果翻倍，修炼+10%'},
  xuanming:{name:'玄冥套装',parts:{wuqi:'玄冥幡',fangju:'玄冥铠',shishi:'玄冥镜',fabao:'玄冥铃'},two:'防御+20%',four:'受伤概率-30%'},
};
/* ---------- 装备系统·深度扩展（v5 王者出装×传奇数值） ---------- */
var ARMOR_K=500;    // 护甲减伤公式：减伤率=护甲/(护甲+500)，上限60%
var ARMOR_CAP=.60;  // 护甲减伤上限
var EQUIP_ADVANCE=[ // 装备进阶表（凡→灵→仙→后天→先天）
  {from:0,to:1,cost:{lingShi:1000,kuangShi:100},rate:.70,desc:'凡品→灵品'},
  {from:1,to:2,cost:{lingShi:5000,kuangShi:300,jinghua:1},rate:.50,desc:'灵品→仙品'},
  {from:2,to:3,cost:{lingShi:20000,kuangShi:800,jinghua:3,xianYu:2},rate:.30,desc:'仙品→后天灵宝'},
  {from:3,to:4,cost:{lingShi:80000,kuangShi:2000,jinghua:8,xianYu:5},rate:.15,desc:'后天灵宝→先天至宝'}
];
var EQUIP_REFINE=[{kuang:2,jh:0},{kuang:8,jh:1},{kuang:30,jh:3},{kuang:100,jh:10},{kuang:300,jh:30}]; // 分解产出（按品质索引）
var ARENA_LEVELS=[{need:0,mult:1.0,name:'一星·初试锋芒'},{need:3,mult:1.25,name:'二星·小有所成'},{need:6,mult:1.55,name:'三星·声名鹊起'},{need:10,mult:1.9,name:'四星·名震一方'},{need:15,mult:2.3,name:'五星·登峰造极'}]; // 演武场五层（敌方战力=我方×mult）
var ARENA_DAILY=3;  // 每日挑战次数
/* 护甲减伤率 */
function armorReduce(def){ return Math.min(ARMOR_CAP,def/(def+ARMOR_K)); }
/* ---------- 功法 ---------- */
var GONGFA={
  xinfa:[
    {id:'taixu',name:'太虚心经',elem:null,desc:'修炼+10%',need:1,cost:function(l){return {lingShi:300*Math.pow(1.8,l)};}},
    {id:'hundun',name:'混元功',elem:null,desc:'修炼+15%',need:3,cost:function(l){return {lingShi:600*Math.pow(1.8,l)};}},
    {id:'changchun',name:'长春诀',elem:'木',desc:'修炼+8%，恢复+20%',need:5,cost:function(l){return {lingShi:1200*Math.pow(1.7,l)};}},
    {id:'zixiao',name:'紫霄心法',elem:null,desc:'修炼+20%，突破+3%',need:7,resonance:true,cost:function(l){return {lingShi:1500*Math.pow(1.8,l),shengWang:200*Math.pow(1.9,l)};}},
    {id:'tongen',name:'彤恩双修诀',elem:null,desc:'双方弟子修炼+10%，同时在线翻倍（结盟解锁）',need:6,alliance:true,cost:function(l){return {lingShi:1000*Math.pow(1.8,l)};}},
    {id:'xingchen',name:'星辰诀',elem:null,desc:'修炼+25%',need:9,resonance:true,juan:'xingchen',juanNeed:5,cost:function(l){return {lingShi:3000*Math.pow(1.8,l),shengWang:500*Math.pow(1.8,l)};}},
  ],
  wuji:[
    {id:'qingyun',name:'青云剑诀',elem:'金',desc:'剑系伤害+30%，剑心翻倍',need:2,cost:function(l){return {lingShi:400*Math.pow(1.8,l)};}},
    {id:'fenhuang',name:'焚天诀',elem:'火',desc:'火系伤害+35%，火灵体附灼烧',need:4,juan:'fenhuang',juanNeed:3,cost:function(l){return {lingShi:800*Math.pow(1.8,l)};}},
    {id:'wanmu',name:'万木逢春',elem:'木',desc:'受伤-10%，木灵体治疗翻倍',need:4,juan:'wanmu',juanNeed:3,cost:function(l){return {lingShi:800*Math.pow(1.8,l)};}},
    {id:'jinglei',name:'惊雷掌',elem:'金',desc:'伤害+25%，余雷词缀联动',need:6,cost:function(l){return {lingShi:1200*Math.pow(1.7,l)};}},
    {id:'xuanbing',name:'玄冰剑气',elem:'水',desc:'伤害+40%，游历时间-10%',need:8,resonance:true,cost:function(l){return {lingShi:2000*Math.pow(1.8,l),shengWang:300*Math.pow(1.8,l)};}},
  ],
};
/* ---------- 设施 ---------- */
var FACILITIES={
  juling:{name:'聚灵阵',desc:function(l){return '修炼速度+'+l*10+'%';}},
  cangjing:{name:'藏经阁',desc:function(l){return '突破率+'+l*2+'%，解锁功法';}},
  liandan:{name:'炼丹房',desc:function(l){return '容纳'+Math.min(l,5)+'人，产量+'+l*15+'%';}},
  qishi:{name:'器室',desc:function(l){return '容纳'+Math.min(l,5)+'人，周期-'+l*8+'%';}},
  fangshi:{name:'坊市',desc:function(l){return '灵石产出'+(1+l*.8).toFixed(1)+'/秒';}},
  lingshou:{name:'灵兽园',desc:function(l){return '灵兽材料'+(l*.012).toFixed(3)+'/秒';},adv:true},
  yaotao:{name:'炼妖塔',desc:function(l){return '挑战层数上限+'+l;},adv:true},
  wudao:{name:'悟道崖',desc:function(l){return '顿悟效果+'+l*10+'%';},adv:true},
  dazhen:{name:'护山大阵',desc:function(l){return '防御战力+'+l*2000;},adv:true},
};
var FAC_COST={
  juling:function(l){return {lingShi:Math.round(200*Math.pow(1.7,l))};},
  cangjing:function(l){return {lingShi:Math.round(150*Math.pow(1.8,l)),shengWang:Math.round(40*Math.pow(2,l))};},
  liandan:function(l){return {lingShi:Math.round(300*Math.pow(1.7,l))};},
  qishi:function(l){return {lingShi:Math.round(250*Math.pow(1.75,l)),kuangShi:Math.round(8*Math.pow(1.5,l))};},
  fangshi:function(l){return {lingShi:Math.round(400*Math.pow(1.6,l))};},
  lingshou:function(l){return {lingShi:Math.round(500*Math.pow(1.8,l)),shengWang:Math.round(60*Math.pow(1.7,l))};},
  yaotao:function(l){return {lingShi:Math.round(600*Math.pow(1.8,l)),kuangShi:Math.round(20*Math.pow(1.6,l))};},
  wudao:function(l){return {lingShi:Math.round(450*Math.pow(1.8,l)),shengWang:Math.round(80*Math.pow(1.7,l))};},
  dazhen:function(l){return {lingShi:Math.round(700*Math.pow(1.75,l)),kuangShi:Math.round(30*Math.pow(1.6,l))};},
};
/* ---------- v4.2 星象观测（观星台） ---------- */
var STARS=[
  {id:'ziwei', name:'紫微帝星', type:'cult', mult:.5,  dur:1800, text:'帝星临位，紫气东来，全宗修炼+50%（30分钟）'},
  {id:'wenqu', name:'文曲星',  type:'earn', mult:1.0, dur:1800, text:'文曲高照，商路通泰，坊市产出翻倍（30分钟）'},
  {id:'lücun', name:'禄存星',  type:'ore',  mult:1.0, dur:1800, text:'禄存入财帛宫，矿石收获翻倍（30分钟）'},
  {id:'hongluan',name:'红鸾星', type:'love', mult:0,   dur:0,    text:'红鸾星动，情缘缱绻——今日给道侣传书，情缘翻倍'},
  {id:'tianyao',name:'天曜星', type:'cult', mult:.8,  dur:900,  text:'天曜冲斗，灵机喷薄，全宗修炼+80%（15分钟）'},
  {id:'yueji', name:'月孛星',  type:'lt',   mult:1.0, dur:1800, text:'月孛照灵田，灵植疯长，灵田生长翻倍（30分钟）'},
  {id:'chong', name:'荧惑守心',type:'cult', mult:1.2, dur:600,  text:'荧惑守心，火德大兴，全宗修炼+120%（10分钟）'},
];
/* ---------- v4.2 悟道碑（道偈收集图鉴） ---------- */
var DAOJI=[
  {id:'dao1', txt:'大道至简，悟在天成', love:'可你我之间，偏要绕许多弯'},
  {id:'dao2', txt:'上善若水，水利万物而不争', love:'我只争朝夕，争一个与你同在'},
  {id:'dao3', txt:'道法自然，顺其自然', love:'顺其自然，是走向你'},
  {id:'dao4', txt:'天地不仁，以万物为刍狗', love:'唯你是我眼中唯一的例外'},
  {id:'dao5', txt:'一生二，二生三，三生万物', love:'而你，是我万物之上的圆满'},
  {id:'dao6', txt:'心若冰清，天塌不惊', love:'但见你时，心湖便起了涟漪'},
  {id:'dao7', txt:'不争不抢，无欲则刚', love:'偏偏见你，就什么也放不下'},
  {id:'dao8', txt:'道可道，非常道', love:'情可情，非常情'},
  {id:'dao9', txt:'夫唯不争，故天下莫能与之争', love:'与你相争的，只有时间'},
  {id:'dao10', txt:'大音希声，大象无形', love:'最深的话，都藏在心里'},
  {id:'dao11', txt:'千里之行，始于足下', love:'我们的每一步，都算数'},
  {id:'dao12', txt:'执子之手，与子偕老', love:'这便是人间最长的道'},
];
/* ---------- v4.3 契缘阶段（双人结契体系） ---------- */
var QIYUAN_LEVELS=[
  {name:'初识', need:0,    buff:'结为道友'},
  {name:'相知', need:80,   buff:'双人秘境奖励+20%'},
  {name:'相守', need:200,  buff:'双方弟子修炼+10%'},
  {name:'同心', need:400,  buff:'传书契缘每日上限20'},
  {name:'白首', need:700,  buff:'每日情缘获取+50%'},
  {name:'飞升', need:1100, buff:'同时在线全宗修炼翻倍'},
];
/* ============ v4.4 双人斗地主（纯逻辑，可测试） ============ */
var CARD_SUIT_NAME=['♠','♥','♣','♦'];
var CARD_RANK_NAME=['','','','3','4','5','6','7','8','9','10','J','Q','K','A','2','小王','大王'];
function cardStr(c){ return CARD_RANK_NAME[c.r]+(c.r>=16?'':CARD_SUIT_NAME[c.s]); }
function newDeck(){ var d=[]; for(var r=3;r<=15;r++) for(var s=0;s<4;s++) d.push({r:r,s:s}); d.push({r:16,s:0},{r:17,s:0}); return d; }
function shuffleArr(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
/** 牌型判定：single/pair/triple/triple1/straight/pairSeq/bomb/rocket，非法返回 null */
function cardTypeOf(cards){
  var n=cards.length;
  if(n<1) return null;
  var rs=cards.map(function(c){return c.r;}).sort(function(a,b){return a-b;});
  if(n===2&&rs[0]===16&&rs[1]===17) return {type:'rocket',rank:17,len:2};
  if(n===4&&rs[0]===rs[3]) return {type:'bomb',rank:rs[0],len:4};
  var cnt={},uniq=[];
  for(var i=0;i<n;i++){ cnt[rs[i]]=(cnt[rs[i]]||0)+1; if(uniq.indexOf(rs[i])<0) uniq.push(rs[i]); }
  uniq.sort(function(a,b){return a-b;});
  if(n===1) return {type:'single',rank:rs[0],len:1};
  if(n===2&&uniq.length===1) return {type:'pair',rank:rs[0],len:2};
  if(n===3&&uniq.length===1) return {type:'triple',rank:rs[0],len:3};
  if(n===4&&uniq.length===2){ var r3=cnt[uniq[0]]===3?uniq[0]:uniq[1]; return {type:'triple1',rank:r3,len:4}; }
  if(n>=5&&uniq.length===n&&rs[n-1]<=14&&rs[n-1]-rs[0]===n-1) return {type:'straight',rank:rs[n-1],len:n};
  if(n>=6&&n%2===0&&uniq.length===n/2&&rs[n-1]<=14&&rs[n-1]-rs[0]===n/2-1){
    var allPair=true;
    for(var j=0;j<uniq.length;j++) if(cnt[uniq[j]]!==2){ allPair=false; break; }
    if(allPair) return {type:'pairSeq',rank:rs[n-1],len:n};
  }
  return null;
}
/** next 能否压过 prev（prev 为空=自由出） */
function cardBeats(prev,next){
  if(!prev||!prev.type) return true;
  if(next.type==='rocket') return true;
  if(next.type==='bomb') return prev.type==='bomb'?next.rank>prev.rank:true;
  if(prev.type==='bomb') return false;
  if(next.type!==prev.type||next.len!==prev.len) return false;
  return next.rank>prev.rank;
}
/* ============ v4.4 双人台球（canvas 确定性物理） ============ */
var POOL_W=320,POOL_H=160,POOL_R=6,POOL_POCKET_R=11;
var POOL_POCKETS=[[0,0],[160,0],[320,0],[0,160],[160,160],[320,160]];
/** 初始布局：红(我方3)+蓝(她方3)+黑8 三角阵，白球左下 */
function poolLayout(){
  var balls=[];
  balls.push({id:'cue',x:60,y:130,color:'#f5efe0',vx:0,vy:0,pocketed:false});
  var tri=[
    ['black',250,80],['red',262,73.4],['blue',262,86.6],
    ['red',274,66.8],['blue',274,80],['red',274,93.2],
    ['blue',286,73.4]
  ];
  for(var i=0;i<tri.length;i++){
    var c=tri[i][0]==='red'?'#c0392b':tri[i][0]==='blue'?'#2471a3':'#1c1c1c';
    balls.push({id:tri[i][0]+i,x:tri[i][1],y:tri[i][2],color:c,vx:0,vy:0,pocketed:false,group:tri[i][0]});
  }
  return balls;
}
/** 单步物理：移动/摩擦/库壁/进袋/球球碰撞（纯计算，无随机 → 双端重放一致） */
function poolStep(balls,dt){
  var i,j;
  for(i=0;i<balls.length;i++){
    var b=balls[i];
    if(b.pocketed) continue;
    b.x+=b.vx*dt; b.y+=b.vy*dt;
    b.vx*=.992; b.vy*=.992;
    if(Math.abs(b.vx)<.5&&Math.abs(b.vy)<.5){ b.vx=0; b.vy=0; }
    if(b.x<POOL_R){ b.x=POOL_R; b.vx=-b.vx*.7; }
    if(b.x>POOL_W-POOL_R){ b.x=POOL_W-POOL_R; b.vx=-b.vx*.7; }
    if(b.y<POOL_R){ b.y=POOL_R; b.vy=-b.vy*.7; }
    if(b.y>POOL_H-POOL_R){ b.y=POOL_H-POOL_R; b.vy=-b.vy*.7; }
    for(j=0;j<POOL_POCKETS.length;j++){
      var pk=POOL_POCKETS[j],dx=b.x-pk[0],dy=b.y-pk[1];
      if(dx*dx+dy*dy<POOL_POCKET_R*POOL_POCKET_R){ b.pocketed=true; b.vx=0; b.vy=0; break; }
    }
  }
  for(i=0;i<balls.length;i++){
    var a1=balls[i];
    if(a1.pocketed) continue;
    for(j=i+1;j<balls.length;j++){
      var b2=balls[j];
      if(b2.pocketed) continue;
      var dx=b2.x-a1.x,dy=b2.y-a1.y,dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<POOL_R*2&&dist>0){
        var nx=dx/dist,ny=dy/dist,overlap=POOL_R*2-dist;
        a1.x-=nx*overlap/2; a1.y-=ny*overlap/2;
        b2.x+=nx*overlap/2; b2.y+=ny*overlap/2;
        var va=a1.vx*nx+a1.vy*ny, vb=b2.vx*nx+b2.vy*ny;
        if(va>vb){ a1.vx+=(vb-va)*nx; a1.vy+=(vb-va)*ny; b2.vx+=(va-vb)*nx; b2.vy+=(va-vb)*ny; }
      }
    }
  }
}
function poolAllStill(balls){
  for(var i=0;i<balls.length;i++) if(!balls[i].pocketed&&(balls[i].vx||balls[i].vy)) return false;
  return true;
}
/** 完整击球模拟（角度0-360°/力度0-100），返回 {pockets, cueDown} */
function poolSimulate(balls,angle,power){
  var cue=null;
  for(var i=0;i<balls.length;i++) if(balls[i].id==='cue'){ cue=balls[i]; break; }
  if(cue.pocketed){ cue.pocketed=false; cue.x=60; cue.y=130; cue.vx=0; cue.vy=0; }
  var a=angle*Math.PI/180;
  cue.vx=Math.cos(a)*power*1.2; cue.vy=Math.sin(a)*power*1.2;
  var pockets=[];
  for(var step=0;step<1500;step++){
    if(poolAllStill(balls)) break;
    poolStep(balls,0.016);
  }
  for(var j=0;j<balls.length;j++){ var b=balls[j]; if(b.pocketed&&b.id!=='cue') pockets.push(b); }
  var cueDown=!!cue.pocketed;
  return {pockets:pockets,cueDown:cueDown};
}
/* ---------- 流派 ---------- */
var LIUPAI={
  jian:{name:'剑修宗门',desc:'战斗伤害+50%，武技效果+30%，炼丹产量-40%'},
  dan:{name:'丹修宗门',desc:'丹药效果翻倍，产量+100%，可售丹换声望，战斗-20%'},
  zhen:{name:'阵修宗门',desc:'护山大阵效果+200%，自动反击，设施建造速度+30%'},
  qi:{name:'器修宗门',desc:'炼器品质提升，强化成功率+20%，修炼-15%'},
};
/* ---------- 游历区域（含情感地点） ---------- */
var REGIONS=[
  {id:'tongyun',name:'彤云谷',special:'tongyun',unlock:0,dur:35,power:[40,150],bossPower:200,bossDrop:'qingyun-wuqi',bossCool:600,desc:'终年霞光笼罩，特产朱颜花'},
  {id:'nianen',name:'念恩峰',special:'nianen',unlock:1,dur:45,power:[250,700],bossPower:900,bossDrop:'qingyun-fangju',bossCool:900,desc:'峰顶有和合石，恩和与婉彤定情之处'},
  {id:'forest',name:'妖兽森林',unlock:2,dur:50,power:[800,2100],bossPower:2800,bossDrop:'qingyun-shishi',bossCool:1100,desc:'灵气初聚之地，妖兽横行'},
  {id:'marsh',name:'幽冥沼泽',unlock:3,dur:65,power:[2300,6000],bossPower:8500,bossDrop:'qingyun-fabao',bossCool:1400,desc:'瘴气弥漫，幽魂出没'},
  {id:'ruins',name:'上古遗迹',unlock:4,dur:80,power:[6500,15000],bossPower:21000,bossDrop:'tongxia-wuqi',bossCool:1700,desc:'仙人遗迹，机关重重'},
  {id:'rift',name:'魔界裂缝',unlock:5,dur:95,power:[17000,38000],bossPower:55000,bossDrop:'tongxia-fangju',bossCool:2000,desc:'魔气喷涌，凶险万分'},
  {id:'abyss',name:'玄冥深渊',unlock:6,dur:110,power:[42000,90000],bossPower:130000,bossDrop:'xuanming-wuqi',bossCool:2300,desc:'幽冥之主沉眠之地'},
  {id:'kunlun',name:'昆仑秘境',unlock:7,dur:130,power:[100000,220000],bossPower:320000,bossDrop:'xuanming-shishi',bossCool:2600,desc:'仙山福地，藏宝无数'},
];
var NODE_TYPES={battle:'战斗',chest:'宝箱',trader:'商人',trap:'陷阱',wonder:'奇遇'};
var FORMATIONS={
  qianfeng:{name:'前锋',desc:'攻击+25%，防御-10%',atk:.25,def:-.10},
  ceyi:{name:'侧翼',desc:'速度+15%，暴击+10%',spd:.15,crit:.10},
  houwei:{name:'后卫',desc:'防御+25%，治疗+15%',def:.25,heal:.15},
};
/* ---------- NPC 宗门（含性格） ---------- */
var NPC_CLANS=[
  {id:'lieyan',name:'烈焰谷',power:1600,rel:15,personality:'commercial',desc:'行事张扬的炼器宗门'},
  {id:'shuiyue',name:'水月宫',power:900,rel:50,personality:'defensive',desc:'清幽避世的女修宗门'},
  {id:'tianjian',name:'天剑门',power:5500,rel:45,personality:'aggressive',desc:'剑修圣地，傲气凌人'},
  {id:'wangu',name:'万蛊教',power:3200,rel:12,personality:'aggressive',desc:'御蛊之术令人闻风丧胆'},
  {id:'taiyi',name:'太一宗',power:13000,rel:70,personality:'defensive',desc:'底蕴深厚的第一大宗'},
  {id:'youming',name:'幽冥殿',power:22000,rel:8,personality:'aggressive',desc:'魔道巨擘，虎视眈眈'},
];
/* ---------- 红娘仙姑 ---------- */
var HONGNIANG_LINES=[
  '八百年了，我又看到了一对像恩和与婉彤那样的道侣。',
  '你们知道吗？恩和真人当年为了婉彤仙子，在念恩峰等了七七四十九天。',
  '拿着这个吧，算是我给你们的贺礼。',
  '情之一字，最是难解。愿你们此生此世，都能执手同行。',
];
/* ---------- 任务与成就 ---------- */
var DAILY_POOL=[
  {id:'break',name:'突破弟子 1 次',target:1,reward:{lingShi:300}},
  {id:'recruit',name:'收纳弟子 1 名',target:1,reward:{lingShi:200}},
  {id:'pill',name:'炼制丹药 3 枚',target:3,reward:{lingShi:300,guyuan:2}},
  {id:'travel',name:'完成游历 1 次',target:1,reward:{lingShi:400,kuangShi:5}},
  {id:'upgrade',name:'祭炼设施 1 次',target:1,reward:{lingShi:400}},
  {id:'earn',name:'累计获得 800 灵石',target:800,reward:{guyuan:3}},
  {id:'strengthen',name:'强化装备 1 次',target:1,reward:{lingShi:300}},
  {id:'combine',name:'装备合成 1 次',target:1,reward:{lingShi:300,kuangShi:8}},
  {id:'boss',name:'挑战任意首领 1 次',target:1,reward:{shengWang:80}},
];
/* ---------- 世界天气（每日自动轮换） ---------- */
var WEATHER_TYPES=[
  {id:'sunny', name:'晴',       cult:1,   earn:1,    desc:'风和日丽，万物照常'},
  {id:'lingyu',name:'灵雨',     cult:1,   earn:1.10, desc:'灵雨润泽，坊市收益+10%'},
  {id:'chao',  name:'灵气潮汐', cult:1.15,earn:1,    desc:'灵气翻涌，修炼速度+15%'},
  {id:'ku',    name:'灵气枯竭', cult:.95, earn:.90,  desc:'灵气稀薄，坊市收益-10%'},
  {id:'ji',    name:'吉日',     cult:1,   earn:1.05, desc:'黄道吉日，收获+5%，宜结盟'},
  {id:'aurora',name:'极光',     cult:1.20,earn:1,    desc:'极光漫天，修炼+20%，灵植有概率变异'},
  {id:'liuxing',name:'流星夜',   cult:1.10,earn:1,    desc:'流星划过夜空，许愿有好运'}
];
function WEATHER_byId(id){ for(var i=0;i<WEATHER_TYPES.length;i++) if(WEATHER_TYPES[i].id===id) return WEATHER_TYPES[i]; return null; }
/* ---------- 默契问答题库（情侣专属） ---------- */
var QUIZ_POOL=[
  {q:'恩和的专属昵称是？',opts:['K歌之王','麦霸','歌神'],ans:0,why:'你让他备注的，他记了一辈子'},
  {q:'婉彤的专属昵称是？',opts:['四喜婉子','小仙女','宝宝'],ans:0,why:'四喜：久旱逢甘霖、他乡遇故知、洞房花烛夜、金榜题名时'},
  {q:'彤华节是哪一天？',opts:['11月12日','10月1日','12月24日'],ans:0,why:'我们的专属纪念日'},
  {q:'恩和最常唱谁的歌？',opts:['陈奕迅','周杰伦','林俊杰'],ans:0,why:'K歌之王的看家本领'},
  {q:'游戏里偷采灵药最多能偷几颗？',opts:['3颗','1颗','5颗'],ans:0,why:'点到为止，是情分'},
  {q:'道庭的掌门夫人是谁？',opts:['四喜婉子','花仙子','云梦仙子'],ans:0,why:'宗门上下都认的'},
  {q:'灵田第几级解锁新地块？',opts:['3级','2级','5级'],ans:0,why:'好好经营灵田'},
  {q:'恩和最喜欢的颜色？',opts:['藏青墨绿','粉色','金色'],ans:0,why:'整个游戏的底色'},
  {q:'婉彤专属的落款印章是？',opts:['K歌之王之印','婉子之印','同心印'],ans:0,why:'每一封信都盖上'},
  {q:'双修成功一次加多少情缘？',opts:['10点','5点','20点'],ans:0,why:'同心同修，情缘渐深'},
  {q:'签到连续多少天有额外奖励？',opts:['7天','3天','30天'],ans:0,why:'坚持就是情意'},
  {q:'云顶道庭的门派宗旨是？',opts:['守护婉彤','称霸修仙界','收集灵石'],ans:0,why:'创派初心'},
  {q:'传书给对方一次加多少情缘？',opts:['1点','3点','5点'],ans:0,why:'一字一句都是心意'},
  {q:'灵雨天的坊市收益加成是？',opts:['+10%','+5%','+20%'],ans:0,why:'灵雨润泽万物'},
  {q:'极光天收获灵植会怎样？',opts:['有概率变异','没变化','枯萎'],ans:0,why:'极光下的奇迹'},
  {q:'气运商店里「设施奠基」要多少气运？',opts:['5点','3点','8点'],ans:0,why:'宗门福祉'},
  {q:'婉彤第一次进游戏时是什么身份？',opts:['掌门夫人','普通弟子','长老'],ans:0,why:'专属引导为她而设'},
  {q:'恩和现实中让婉彤备注的昵称是？',opts:['K歌之王','恩和','男朋友'],ans:0,why:'独一无二的备注'},
  {q:'同心锁「三生」需要多少情缘？',opts:['400点','300点','500点'],ans:0,why:'三生三世'},
  {q:'灵田被偷采后心情会？',opts:['有点小气但很快原谅','生气一整天','无所谓'],ans:0,why:'偷采是情调，不是仇'},
];
/* ---------- 每日运势签（日期种子，同一天稳定） ---------- */
var FATE_POOL=[
  {lv:3,name:'上上签',text:'今日诸事顺遂，宜传书，宜并肩修炼，宜大胆说爱。'},
  {lv:2,name:'上签',  text:'气象一新，灵田丰收在望，记得去收获。'},
  {lv:2,name:'吉签',  text:'有人今日格外想你——记得回信。'},
  {lv:1,name:'中签',  text:'平平无奇的一天，但和TA一起就值得。'},
  {lv:1,name:'平签',  text:'无风无浪，适合慢慢种田，慢慢喜欢。'},
  {lv:0,name:'小憩签',text:'今天适合休息——修炼不差这一时半刻。'}
];
/* ---------- 婉彤专属日常任务（情侣向） ---------- */
var PARTNER_DAILY_POOL=[
  {id:'msg',     name:'给恩和传书 1 次', target:1, reward:{lingShi:300,peiyuan:1}},
  {id:'ltHarvest',name:'收获灵田 2 次',  target:2, reward:{lingShi:300}},
  {id:'checkin', name:'今日签到',        target:1, reward:{lingShi:200}},
  {id:'fate',    name:'查看今日运势',    target:1, reward:{lingShi:150}},
  {id:'water',   name:'为恩和灵田浇水 1 次', target:1, reward:{lingShi:250,guyuan:2}},
];
var WEEKLY_POOL=[
  {id:'ascend',name:'飞升弟子 1 名',target:1,reward:{xianYu:3}},
  {id:'boss2',name:'击败首领 2 次',target:2,reward:{xianYu:4}},
  {id:'warwin',name:'宣战胜利 1 次',target:1,reward:{xianYu:5}},
  {id:'shengwang',name:'累计获得 2000 声望',target:2000,reward:{xianYu:3}},
  {id:'pill20',name:'炼制丹药 20 枚',target:20,reward:{xianYu:4}},
  {id:'tower',name:'炼妖塔挑战 5 层',target:5,reward:{xianYu:3}},
];
var ACHIEVEMENTS=[
  {id:'disciples20',name:'桃李满园',desc:'拥有 20 名弟子',cond:function(s){return s.disciples.length>=20;},reward:{xianYu:3}},
  {id:'realm3',name:'小有所成',desc:'拥有金丹期弟子',cond:function(s){return s.disciples.some(function(d){return d.realm>=2;});},reward:{xianYu:2}},
  {id:'realm7',name:'大乘真仙',desc:'拥有大乘期弟子',cond:function(s){return s.disciples.some(function(d){return d.realm>=7;});},reward:{xianYu:8}},
  {id:'ascend1',name:'初窥仙途',desc:'飞升 1 名弟子',cond:function(s){return s.stats.ascend>=1;},reward:{xianYu:5}},
  {id:'annihilate3',name:'灭门专业户',desc:'灭掉 3 个 NPC 宗门',cond:function(s){return s.stats.annihilate>=3;},reward:{xianYu:10}},
  {id:'rich',name:'富甲一方',desc:'累计获得 100000 灵石',cond:function(s){return s.stats.earnLS>=100000;},reward:{xianYu:5}},
  {id:'smith10',name:'炼器大师',desc:'强化装备 10 次',cond:function(s){return s.stats.strengthen>=10;},reward:{xianYu:4}},
  {id:'gongfa5',name:'博采众长',desc:'参悟 5 本功法',cond:function(s){return s.stats.gongfa>=5;},reward:{xianYu:6}},
  {id:'zhuanShi1',name:'轮回重生',desc:'完成 1 次转世重修',cond:function(s){return s.stats.zhuanShi>=1;},reward:{xianYu:6}},
  {id:'zhongsheng1',name:'气运轮回',desc:'完成 1 次气运重聚',cond:function(s){return s.stats.zhongsheng>=1;},reward:{xianYu:10}},
  {id:'boss10',name:'屠龙者',desc:'击败首领 10 次',cond:function(s){return s.stats.bossKill>=10;},reward:{xianYu:6}},
  {id:'sect3',name:'名门大派',desc:'宗门等级达到 3 级',cond:function(s){return s.sectLv>=3;},reward:{xianYu:4}},
  /* —— 神仙眷侣（双人专属成就） —— */
  {id:'xlyx',name:'心有灵犀',desc:'累计同时在线 1 小时',cond:function(s){return (s.stats.parallelTime||0)>=3600;},reward:{xianYu:5},couple:true},
  {id:'qbjh',name:'情比金坚',desc:'结盟后完成 10 次贸易',cond:function(s){return (s.stats.allianceTrades||0)>=10;},reward:{xianYu:5},couple:true},
  {id:'byfs',name:'比翼双飞',desc:'共同击败世界 Boss 3 次',cond:function(s){return (s.stats.duoBossKill||0)>=3;},reward:{xianYu:8},couple:true},
  {id:'smhs',name:'山盟海誓',desc:'双方宗门均达到 10 级',cond:function(s){return s.sectLv>=10&&(s.otherSectLv||0)>=10;},reward:{xianYu:8},couple:true},
  {id:'thyz',name:'彤华永驻',desc:'在彤华节当天同时在线',cond:function(s){return !!s.stats.tonghuaTogether;},reward:{xianYu:10},couple:true},
  {id:'lcq',name:'灵田初垦',desc:'收获灵田作物 10 次',cond:function(s){return (s.lingTian&&s.lingTian.stats.harvest||0)>=10;},reward:{lingShi:500}},
  {id:'tlf',name:'偷得浮生',desc:'偷采道侣灵药 5 次',cond:function(s){return (s.lingTian&&s.lingTian.stats.steal||0)>=5;},reward:{xianYu:3},couple:true},
  /* —— v5 装备深度（出装/演武/图鉴） —— */
  {id:'codex12',name:'鉴宝宗师',desc:'装备图鉴收集 12 种',cond:function(s){ var seen={},i,j; function scan(list){ for(var x=0;x<list.length;x++){ var e=list[x]; if(e&&e.base) seen[e.base]=1; } } scan(s.res.equipBank); for(j=0;j<s.disciples.length;j++){ var d=s.disciples[j]; for(i=0;i<EQUIP_PARTS.length;i++) scan([d.equipment[EQUIP_PARTS[i].key]]); } return Object.keys(seen).length>=12; },reward:{xianYu:4}},
  {id:'xiantian1',name:'先天至宝',desc:'拥有 1 件先天至宝',cond:function(s){ var has=false,i; for(i=0;i<s.res.equipBank.length;i++) if(s.res.equipBank[i]&&s.res.equipBank[i].quality>=4) has=true; for(i=0;i<s.disciples.length;i++){ var d=s.disciples[i]; for(var k in d.equipment){ if(d.equipment[k]&&d.equipment[k].quality>=4) has=true; } } return has; },reward:{xianYu:6}},
  {id:'arena10',name:'演武称雄',desc:'演武场胜利 10 场',cond:function(s){return (s.arena&&s.arena.wins||0)>=10;},reward:{xianYu:5}},
  /* —— v5.3 装备合成 —— */
  {id:'combine3',name:'三宝合一',desc:'装备合成 3 次',cond:function(s){return (s.stats.combine||0)>=3;},reward:{xianYu:3}},
  {id:'combineHt',name:'炼宝宗师',desc:'合成出 1 件后天灵宝',cond:function(s){return (s.stats.combineTop||0)>=3;},reward:{xianYu:6}},
];
/* ---------- 气运商店 ---------- */
var QIYUN_SHOP=[
  {id:'linggen',name:'灵根优化',desc:'天灵根概率+5%',cost:3,apply:function(g){g.state.unlock.lingGenBonus=(g.state.unlock.lingGenBonus||0)+5;}},
  {id:'facility',name:'设施奠基',desc:'设施基础等级+1',cost:5,once:true,apply:function(g){for(var k in g.state.facilities) if(g.state.facilities[k]<2) g.state.facilities[k]=1; g.state.unlock.facilityBase=true;}},
  {id:'breakBase',name:'突破根基',desc:'突破基础成功率+5%',cost:4,apply:function(g){g.state.unlock.breakBonus=(g.state.unlock.breakBonus||0)+.05;}},
  {id:'hard',name:'炼狱难度',desc:'敌人+60%，收益+100%',cost:8,once:true,apply:function(g){g.state.unlock.hard=true;}},
];
/* ---------- 文言文案 ---------- */
var BTN_TXT={recruit:'收纳',upgrade:'祭炼',breakthrough:'叩关',travel:'派遣',cultivate:'修炼',alchemy:'炼丹',forge:'炼器',stop:'召回',detail:'观览',gift:'赠予佳人'};
var SYSTEM_MSGS={
  breakOk:'道心通明，境界突破！',
  breakFail:'心魔反噬，修为受损...',
  recruit:'有缘人叩响山门',
  travelBack:'闭关归来，道行精进',
};

/* =====================================================================
 * 数据层（DB）：Supabase 真实连接 + 本地 Mock 双人演示模式
 * - 若 CONFIG 已填入有效的 Supabase URL/Key 且 SDK 加载成功 → real 模式
 * - 否则 → mock 模式：localStorage 模拟双人账号与实时通信（开箱可玩可测）
 * 所有异步操作均 try-catch，网络异常时 UI 显示重连提示
 * ===================================================================== */
var DB={
  client:null, real:false, mode:'mock', online:false, profile:null, session:null,
  _throttle:{}, _subs:{},
  /** 初始化：判断 real/mock（支持 TYJ_MOCK=1 或 ?mode=mock 强制演示模式） */
  init:function(){
    var forceMock=window.TYJ_MOCK===1||(window.location&&window.location.search&&window.location.search.indexOf('mode=mock')>=0);
    var ok=!forceMock&&CONFIG.SUPABASE_URL.indexOf('YOUR_')!==0&&CONFIG.SUPABASE_ANON_KEY.indexOf('YOUR_')!==0;
    if(ok&&window.supabase){
      try{
        this.client=window.supabase.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY);
        this.real=true; this.mode='real';
      }catch(e){ this.real=false; this.mode='mock'; }
    }
    return this;
  },
  /** 写操作防抖（0.5 秒冷却） */
  throttle:function(key){
    var now=Date.now();
    if(this._throttle[key]&&now-this._throttle[key]<500) return true;
    this._throttle[key]=now; return false;
  },
  /** 异步重试（网络波动降级：失败重试 times 次，间隔 800ms） */
  _retry:function(fn,times,cb){
    var n=0;
    function attempt(){
      fn(function(ok){
        if(ok){ if(cb) cb(true); }
        else if(n<times){ n++; setTimeout(attempt,800); }
        else { if(cb) cb(false); }
      });
    }
    attempt();
  },
  /* ============ 本地 Mock 存储 ============ */
  /** 读取本地 Mock 数据库（隐私模式/存储异常时容错） */
  mockDB:function(){
    var raw=null;
    try{ raw=localStorage.getItem('tyj_mock_db'); }catch(e){}
    if(raw){ try{ return JSON.parse(raw); }catch(e){} }
    var db={users:{},messages:[],interactions:[],world:{brief:[],regions:[]}};
    try{ localStorage.setItem('tyj_mock_db',JSON.stringify(db)); }catch(e){}
    return db;
  },
  mockSave:function(db){ try{ localStorage.setItem('tyj_mock_db',JSON.stringify(db)); }catch(e){} },
  /** Mock 演示账号（朱婉彤），便于无后端时体验双人玩法 */
  ensureDemoPartner:function(db){
    if(!db.users[CONFIG.PARTNER_EMAIL]){
      var now=new Date().getTime();
      db.users[CONFIG.PARTNER_EMAIL]={pass:'wantong123',profile:{id:'mock-partner',email:CONFIG.PARTNER_EMAIL,
        sect_name:'彤云谷',master_title:'宗主夫人',role:'matron',resources:{spirit_stones:600,reputation:60,pills:{guyuan:3,peiyuan:1,ningshen:0,xugudan:0,zhuyan:0},ores:10,immortal_jade:2,beast_material:5,zhuyan_flower:1,juan:{fenhuang:0,wanmu:0,xingchen:0},equipBank:[]},
        facilities:{juling:2,cangjing:2,liandan:1,qishi:1,fangshi:2,lingshou:1,yaotao:1,wudao:1,dazhen:1},
        sect_level:2,karma:10,motto:'婉彤在此，恩和心安',history:[],created_at:now},
        disciples:[
          {id:'mock-d1',name:'婉彤 仙子',spirit_root:'天灵根',comprehension:90,fortune:85,traits:['zhuanShi','hongyun'],realm:'金丹期',realm_progress:800,status:'空闲',equipment:{},skills:{},is_elder:false,past_life_bonus:{}},
          {id:'mock-d2',name:'朱颜 仙子',spirit_root:'单灵根',comprehension:70,fortune:60,traits:['danchi'],realm:'筑基期',realm_progress:300,status:'空闲',equipment:{},skills:{},is_elder:false,past_life_bonus:{}}
        ]};
    }
    return db;
  },
  /* ============ 认证 ============ */
  /** 注册 */
  signUp:function(email,pass,sectName,title,cb){
    var self=this;
    if(this.throttle('authSignup')){ if(cb) cb(false,'操作过于频繁'); return; }
    if(this.real){
      this.client.auth.signUp({email:email,password:pass}).then(function(r){
        if(r.error){ if(cb) cb(false,r.error.message); return; }
        var uid=r.data.user?r.data.user.id:'';
        self.client.from('profiles').insert({id:uid,email:email,sect_name:sectName,master_title:title,
          resources:{spirit_stones:800,reputation:0,pills:{guyuan:0,peiyuan:0,ningshen:0,xugudan:0,zhuyan:0},ores:0,immortal_jade:0,beast_material:0,zhuyan_flower:0,juan:{fenhuang:0,wanmu:0,xingchen:0},equipBank:[]},
          facilities:{juling:0,cangjing:0,liandan:0,qishi:0,fangshi:0,lingshou:0,yaotao:0,wudao:0,dazhen:0}}).then(function(){
          if(cb) cb(true,'');
        }).catch(function(e){ if(cb) cb(false,'账号已创建，但宗门档案同步失败（'+(e.message||'')+'）。若需邮箱确认请先查收确认邮件，再登录；否则请重试注册'); });
      }).catch(function(e){ if(cb) cb(false,e.message); });
    }else{
      var db=this.mockDB();
      this.ensureDemoPartner(db);
      if(db.users[email]){ if(cb) cb(false,'该邮箱已注册'); return; }
      var now=new Date().getTime();
      db.users[email]={pass:pass,profile:{id:'mock-'+email,email:email,sect_name:sectName,master_title:title,
        role:isPartnerEmail(email)?'matron':'cultivator',resources:{spirit_stones:800,reputation:0,pills:{guyuan:0,peiyuan:0,ningshen:0,xugudan:0,zhuyan:0},ores:0,immortal_jade:0,beast_material:0,zhuyan_flower:0,juan:{fenhuang:0,wanmu:0,xingchen:0},equipBank:[]},
        facilities:{juling:0,cangjing:0,liandan:0,qishi:0,fangshi:0,lingshou:0,yaotao:0,wudao:0,dazhen:0},
        sect_level:1,karma:0,motto:'',history:[],created_at:now},
        disciples:[]};
      this.mockSave(db);
      if(cb) cb(true,'');
    }
  },
  /** 登录 */
  signIn:function(email,pass,cb){
    var self=this;
    if(this.throttle('authSignin')){ if(cb) cb(false,'操作过于频繁'); return; }
    if(this.real){
      this.client.auth.signInWithPassword({email:email,password:pass}).then(function(r){
        if(r.error){ if(cb) cb(false,r.error.message); return; }
        self.session=r.data.session;
        // 档案读取带重试：网络抖动时自动恢复，避免误报「档案缺失」
        self._retry(function(retryCb){
          self.loadProfile(r.data.user.id,function(p){
            if(p){ retryCb(true); }
            else{ retryCb(false); }
          });
        },2,function(ok){
          if(!ok){ if(cb) cb(false,'宗门档案读取失败（网络波动或未注册），请重试'); return; }
          self.profile=self._lastProfile; self.online=true;
          self._subscribeAll();
          if(cb) cb(true,'');
        });
      }).catch(function(e){ if(cb) cb(false,e.message); });
    }else{
      var db=this.mockDB();
      this.ensureDemoPartner(db);
      var u=db.users[email];
      if(!u||u.pass!==pass){ if(cb) cb(false,'邮箱或密码有误（演示模式可注册新账号，或用 '+CONFIG.PARTNER_EMAIL+' / wantong123 体验夫人账号）'); return; }
      this.profile=u.profile; this.online=true;
      this.mockUser=email;
      this._subscribeAll();
      if(cb) cb(true,'');
    }
  },
  signOut:function(){
    if(this.real){ try{ this.client.auth.signOut(); }catch(e){} }
    this.profile=null; this.online=false;
    if(this._subs.channel){ try{ this._subs.channel.unsubscribe(); }catch(e){} }
    this._subs={};
  },
  /* ============ 数据读取 ============ */
  /** 加载档案（real 从 profiles 表，mock 从本地） */
  loadProfile:function(id,cb){
    var self=this;
    if(this.real){
      this.client.from('profiles').select('*').eq('id',id).single().then(function(r){
        if(r.error||!r.data){ if(cb) cb(null); return; }
        self._lastProfile=r.data;
        if(cb) cb(r.data);
      }).catch(function(){ if(cb) cb(null); });
    }else{
      var db=this.mockDB();
      for(var k in db.users){ if(db.users[k].profile.id===id){ if(cb) cb(db.users[k].profile); return; } }
      if(cb) cb(null);
    }
  },
  /** 根据邮箱找对方档案（优先配对账号，避免多用户取错） */
  loadPartnerProfile:function(cb){
    var self=this;
    if(!this.profile){ if(cb) cb(null); return; }
    // 对方邮箱 = 与当前用户配对的账号（matron 配 DEVELOPER_EMAIL，其余配 PARTNER_EMAIL）
    var mine=this.profile.email;
    var target=isPartnerEmail(mine)?CONFIG.DEVELOPER_EMAIL:CONFIG.PARTNER_EMAIL;
    if(this.real){
      this.client.from('profiles').select('*').eq('email',target).limit(1).then(function(r){
        if(cb) cb(r.error||!r.data.length?null:r.data[0]);
      }).catch(function(){ if(cb) cb(null); });
    }else{
      var db=this.mockDB();
      this.ensureDemoPartner(db);
      var other=null;
      if(db.users[target]){ other=db.users[target].profile; }
      else {
        // 回退：取第一个非当前用户
        for(var k in db.users){ if(k!==mine){ other=db.users[k].profile; break; } }
      }
      if(other){
        // mock 演示：为道侣补一份灵田状态（含成熟作物，便于体验偷采）
        if(!other.resources) other.resources={};
        if(!other.resources.__state) other.resources.__state={};
        if(!other.resources.__state.lingTian){
          var now=Date.now(),mplots=[];
          for(var mi=0;mi<12;mi++) mplots.push({seed:null,grown:0,water:0});
          mplots[0]={seed:'zhuyanhua',grown:999,water:1};
          mplots[1]={seed:'juqicao',grown:999,water:0};
          other.resources.__state.lingTian={lv:3,exp:60,plots:mplots,seeds:{juqicao:1},today:{date:dayStart(),steal:0,stealed:0,water:0},stats:{plant:3,harvest:2,steal:0,stealed:0,water:0},rain:0,logs:[],_ripe:[]};
        }
      }
      if(cb) cb(other||null);
    }
  },
  /** 保存档案（real 模式带重试，网络波动自动降级） */
  saveProfile:function(cb){
    var p=this.profile;
    if(!p){ if(cb) cb(false); return; }
    if(this.real){
      var self=this;
      this._retry(function(done){
        self.client.from('profiles').update({resources:p.resources,facilities:p.facilities,sect_level:p.sect_level,
          karma:p.karma,motto:p.motto,history:p.history,updated_at:new Date().toISOString()}).eq('id',p.id).then(function(){
          done(true);
        }).catch(function(){ done(false); });
      },2,function(ok){
        if(!ok) self.online=false;   // 重试耗尽 → 标记离线（UI 显示重连提示）
        if(cb) cb(ok);
      });
    }else{
      var db=this.mockDB();
      var u=db.users[p.email];
      if(u){ u.profile=p; this.mockSave(db); }
      if(cb) cb(true);
    }
  },
  /** 加载弟子列表 */
  loadDisciples:function(cb){
    var self=this;
    if(!this.profile){ if(cb) cb([]); return; }
    if(this.real){
      this.client.from('disciples').select('*').eq('profile_id',this.profile.id).order('created_at').then(function(r){
        if(cb) cb(r.error?[]:r.data);
      }).catch(function(){ if(cb) cb([]); });
    }else{
      var db=this.mockDB();
      var u=db.users[this.profile.email];
      if(cb) cb(u?u.disciples:[]);
    }
  },
  /** 保存弟子列表（real 模式带重试） */
  saveDisciples:function(list,cb){
    var self=this;
    if(!this.profile){ if(cb) cb(false); return; }
    if(this.real){
      this._retry(function(done){
        self.client.from('disciples').delete().eq('profile_id',self.profile.id).then(function(){
          var rows=list.map(function(d){ return {profile_id:self.profile.id,name:d.name,spirit_root:d.lingGen?d.lingGen.quality:'',
            comprehension:d.wuXing||d.comprehension||0,fortune:d.fuYuan||d.fortune||0,traits:d.traits||[],
            realm:REALMS[d.realm]?REALMS[d.realm].name:(d.realmName||'炼气期'),realm_progress:Math.floor(d.exp||0),status:d.status||'空闲',
            equipment:d.equipment||{},skills:d.gongfa||{},is_elder:false,past_life_bonus:{}}; });
          self.client.from('disciples').insert(rows).then(function(){ done(true); }).catch(function(){ done(false); });
        }).catch(function(){ done(false); });
      },2,function(ok){ if(cb) cb(ok); });
    }else{
      var db=this.mockDB();
      var u=db.users[this.profile.email];
      if(u){ u.disciples=list; this.mockSave(db); }
      if(cb) cb(true);
    }
  },
  /* ============ 实时消息与互动 ============ */
  /** 订阅所有实时通道 */
  _subscribeAll:function(){
    var self=this;
    if(this.real){
      try{
        var ch=this.client.channel('realtime-db');
        ch.on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},function(payload){
          if(self.onMessage) self.onMessage(payload.new);
        }).on('postgres_changes',{event:'INSERT',schema:'public',table:'interactions'},function(payload){
          if(self.onInteraction) self.onInteraction(payload.new);
        }).subscribe(function(status){ self.onStatus&&self.onStatus(status==='SUBSCRIBED'); });
        this._subs.channel=ch;
      }catch(e){}
    }else{
      // Mock：即时回调
      var db=this.mockDB();
      this.online=true;
      if(this.onStatus) this.onStatus(true);
    }
  },
  /** 发送消息 */
  sendMessage:function(content,cb){
    if(this.throttle('msg')) return;
    if(!this.profile){ if(cb) cb(false); return; }
    if(this.real){
      this.client.from('messages').insert({profile_id:this.profile.id,content:content}).then(function(r){
        if(cb) cb(!r.error);
      }).catch(function(){ if(cb) cb(false); });
    }else{
      var db=this.mockDB();
      db.messages.push({id:'m'+Date.now(),profile_id:this.profile.id,content:content,created_at:new Date().toISOString()});
      this.mockSave(db);
      if(this.onMessage) this.onMessage(db.messages[db.messages.length-1]);
      if(cb) cb(true);
    }
  },
  /** 拉取历史消息 */
  loadMessages:function(cb){
    if(this.real){
      this.client.from('messages').select('*').order('created_at').limit(100).then(function(r){
        if(cb) cb(r.error?[]:r.data);
      }).catch(function(){ if(cb) cb([]); });
    }else{
      var db=this.mockDB();
      if(cb) cb(db.messages);
    }
  },
  /** 发送互动（trade/spar/gift/alliance_request） */
  sendInteraction:function(toId,type,details,cb){
    if(this.throttle('iact')) return;
    if(!this.profile){ if(cb) cb(false); return; }
    if(this.real){
      this.client.from('interactions').insert({from_profile_id:this.profile.id,to_profile_id:toId,type:type,status:'pending',details:details}).then(function(r){
        if(cb) cb(!r.error);
      }).catch(function(){ if(cb) cb(false); });
    }else{
      var db=this.mockDB();
      var it={id:'i'+Date.now(),from_profile_id:this.profile.id,to_profile_id:toId,type:type,status:'pending',details:details,created_at:new Date().toISOString()};
      db.interactions.push(it);
      this.mockSave(db);
      if(this.onInteraction) this.onInteraction(it);
      if(cb) cb(true);
    }
  },
  /** 拉取互动列表 */
  loadInteractions:function(cb){
    if(this.real){
      this.client.from('interactions').select('*').order('created_at',{ascending:false}).limit(50).then(function(r){
        if(cb) cb(r.error?[]:r.data);
      }).catch(function(){ if(cb) cb([]); });
    }else{
      var db=this.mockDB();
      if(cb) cb(db.interactions.slice().reverse());
    }
  },
  /** 处理互动（接受/拒绝） */
  respondInteraction:function(id,accept,cb){
    if(this.real){
      this.client.from('interactions').update({status:accept?'accepted':'rejected'}).eq('id',id).then(function(){
        if(cb) cb(true);
      }).catch(function(){ if(cb) cb(false); });
    }else{
      var db=this.mockDB();
      for(var i=0;i<db.interactions.length;i++) if(db.interactions[i].id===id){ db.interactions[i].status=accept?'accepted':'rejected'; break; }
      this.mockSave(db);
      if(cb) cb(true);
    }
  },
  /* ============ 签到（云端 checkins 表） ============ */
  loadCheckins:function(cb){
    if(this.real){
      this.client.from('checkins').select('*').then(function(r){ if(cb) cb(r.error?[]:r.data); }).catch(function(){ if(cb) cb([]); });
    }else{
      var db=this.mockDB(); if(cb) cb(db.checkins||[]);
    }
  },
  doCheckin:function(cb){
    var self=this;
    if(!this.profile){ if(cb) cb(false); return; }
    var d=new Date();
    var day=d.getFullYear()+'-'+((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();
    if(this.real){
      // v4.4 幂等：先查今日记录，已有 → 直接成功（防重复点击/竞态导致唯一约束报错）
      this.client.from('checkins').select('id').eq('profile_id',this.profile.id).eq('day',day).then(function(r){
        if(r.error){ if(cb) cb(false); return; }
        if(r.data&&r.data.length){ if(cb) cb(true); return; }
        self.client.from('checkins').insert({profile_id:self.profile.id,day:day}).then(function(r2){
          if(cb) cb(!r2.error);
        }).catch(function(){ if(cb) cb(false); });
      }).catch(function(){ if(cb) cb(false); });
    }else{
      var db=this.mockDB(); if(!db.checkins) db.checkins=[];
      var exists=db.checkins.some(function(c){return c.profile_id===self.profile.id&&c.day===day;});
      if(exists){ if(cb) cb(true); return; }
      db.checkins.push({id:'c'+Date.now(),profile_id:this.profile.id,day:day,created_at:new Date().toISOString()});
      this.mockSave(db); if(cb) cb(true);
    }
  },
  partnerCheckinToday:function(cb){
    var self=this;
    this.loadPartnerProfile(function(partner){
      if(!partner){ if(cb) cb(false); return; }
      var d=new Date();
      var day=d.getFullYear()+'-'+((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();
      if(self.real){
        self.client.from('checkins').select('id').eq('profile_id',partner.id).eq('day',day).then(function(r){
          if(cb) cb(!r.error&&r.data&&r.data.length>0);
        }).catch(function(){ if(cb) cb(false); });
      }else{
        var db=self.mockDB(),arr=db.checkins||[];
        if(cb) cb(arr.some(function(c){return c.profile_id===partner.id&&c.day===day;}));
      }
    });
  },
  /* ============ 云相册（Storage 私有桶） ============ */
  albumList:function(cb){
    var self=this;
    if(!this.real){ if(cb) cb([]); return; }
    this.client.storage.from('album').list('',{limit:60,sortBy:{column:'created_at',order:'desc'}}).then(function(r){
      if(r.error||!r.data){ if(cb) cb([]); return; }
      var files=(r.data||[]).filter(function(f){return f.id;});
      if(!files.length){ if(cb) cb([]); return; }
      self.client.storage.from('album').createSignedUrls(files.map(function(f){return f.name;}),3600).then(function(r2){
        var out=[];
        (r2.data||[]).forEach(function(s,i){ if(s&&files[i]) out.push({name:files[i].name,signedUrl:s.signedUrl,created_at:files[i].created_at}); });
        if(cb) cb(out);
      }).catch(function(){ if(cb) cb([]); });
    }).catch(function(){ if(cb) cb([]); });
  },
  albumUpload:function(file,cb){
    if(!this.real){ if(cb) cb(false,'演示模式无云端相册'); return; }
    var name='a'+Date.now()+'_'+String(file.name||'photo').replace(/[^\w.\-]/g,'');
    this.client.storage.from('album').upload(name,file,{contentType:file.type||'image/jpeg'}).then(function(r){
      if(cb) cb(!r.error,r.error?r.error.message:null);
    }).catch(function(e){ if(cb) cb(false,e.message); });
  },
  albumDelete:function(name,cb){
    if(!this.real){ if(cb) cb(false); return; }
    this.client.storage.from('album').remove([name]).then(function(r){ if(cb) cb(!r.error); }).catch(function(){ if(cb) cb(false); });
  },
  /* ============ 世界状态 ============ */
  loadWorld:function(cb){
    if(this.real){
      this.client.from('world_state').select('*').eq('id',1).single().then(function(r){
        if(cb) cb(r.error||!r.data?null:r.data.state);
      }).catch(function(){ if(cb) cb(null); });
    }else{
      var db=this.mockDB();
      if(cb) cb(db.world||null);
    }
  },
  saveWorld:function(state,cb){
    if(this.real){
      this.client.from('world_state').upsert({id:1,state:state,updated_at:new Date().toISOString()}).then(function(){
        if(cb) cb(true);
      }).catch(function(){ if(cb) cb(false); });
    }else{
      var db=this.mockDB();
      db.world=state; this.mockSave(db);
      if(cb) cb(true);
    }
  }
};

/* =====================================================================
 * 战斗引擎（BattleEngine）与修炼引擎（CultivationEngine）
 * 纯逻辑模块：不持有状态，所有数据经 game 参数传入，便于独立测试与复用
 * ===================================================================== */
var BattleEngine={
  /** 胜率判定（hard 为炼狱难度加成） */
  battleWin:function(my,ene,hard){
    var p=my/(my+ene*1.05*(hard?1.6:1));
    return Math.random()<clamp(p,.05,.95);
  },
  /** v5 演武场：真实回合制模拟（护甲减伤/暴击/闪避/格挡/吸血全参与） */
  simulateDuel:function(me,foe,maxRounds){
    maxRounds=maxRounds||30;
    var logs=[],mhp=me.hp,fhp=foe.hp,r;
    function hit(att,def){
      if(Math.random()<(def.dodge||0)) return {dmg:0,dodged:true,crit:false,blocked:false,life:0};
      var red=armorReduce(def.def||0)*(1-(att.penetrate||0));
      var dmg=Math.max(1,(att.atk||1)*(1-red));
      var crit=Math.random()<(att.crit||0);
      if(crit) dmg*=1.5+(att.critDmg||0);
      var blocked=Math.random()<(def.block||0);
      if(blocked) dmg*=.5;
      var life=(att.lifesteal||0)*dmg;
      return {dmg:Math.round(dmg),dodged:false,crit:crit,blocked:blocked,life:Math.round(life)};
    }
    for(r=0;r<maxRounds;r++){
      var a=hit(me,foe); fhp-=a.dmg;
      if(a.life) mhp=Math.min(me.hp,mhp+a.life);
      logs.push('你'+(a.dodged?'的攻击被闪避！':((a.crit?'暴击':'攻击')+'造成 '+a.dmg+' 伤害'+(a.blocked?'（被格挡减半）':'')+(a.life?'，吸血+'+a.life:''))));
      if(fhp<=0) return {win:true,rounds:r+1,mhp:mhp,fhp:0,logs:logs};
      var b=hit(foe,me); mhp-=b.dmg;
      if(b.life) fhp=Math.min(foe.hp,fhp+b.life);
      logs.push('对方'+(b.dodged?'的攻击被你闪避！':((b.crit?'暴击':'攻击')+'造成 '+b.dmg+' 伤害'+(b.blocked?'（被你格挡减半）':'')+(b.life?'，吸血+'+b.life:''))));
      if(mhp<=0) return {win:false,rounds:r+1,mhp:0,fhp:fhp,logs:logs};
    }
    return {win:mhp>fhp,rounds:maxRounds,mhp:mhp,fhp:fhp,logs:logs};
  },
  /** 弟子战斗力：境界系数×词条/装备/功法/流派/宿命综合 */
  disciplePower:function(g,d){
    var p=REALMS[d.realm].power;
    var es=g.equipStats(d);
    p*=1+(es.atk||0)*.03+(es.def||0)*.02+(es.hp||0)*.001+(es.crit||0)*.05+(es.critDmg||0)*.025+(es.penetrate||0)*.04+(es.lifesteal||0)*.03+(es.dodge||0)*.05+(es.block||0)*.025;
    var gf=BattleEngine.gongfaAtk(g,d);
    p*=1+gf.atk+gf.sword;
    if(g.hasTrait(d,'zhanhuang')) p*=1.2;
    if(g.hasTrait(d,'tianmo')) p*=1.35;
    if(g.hasTrait(d,'zhuanShi')) p*=1+d.zhuanShi*.05;
    if(d.fate==='tianming') p*=1.15;
    if(g.state.liupai==='jian') p*=1.5;
    if(g.state.liupai==='dan') p*=.8;
    if(g.state.liupai==='zhen') p*=.9;
    return Math.round(p);
  },
  /** 队伍战力（含阵型修正） */
  partyPower:function(g,p){
    var sum=0,i,d;
    for(i=0;i<p.members.length;i++){ d=g.findDisciple(p.members[i]); if(d) sum+=BattleEngine.disciplePower(g,d); }
    var f=FORMATIONS[p.formation];
    sum*=1+(f.atk||0);
    return Math.round(sum);
  },
  /** 武技/词缀/装备对战斗力的加成聚合 */
  gongfaAtk:function(g,d){
    var atk=0,sword=0,burn=false,resist=0,travelSpeed=0,thunder=0;
    if(d.gongfa.wuji){ var e=g.gongfaEffect(d.gongfa.wuji.id,d.gongfa.wuji.lv); atk+=e.atk||0; sword+=e.sword||0; if(e.burn) burn=true; resist+=e.resist||0; travelSpeed+=e.travelSpeed||0; }
    if(d.gongfa.xinfa){ var e2=g.gongfaEffect(d.gongfa.xinfa.id,d.gongfa.xinfa.lv); resist+=e2.resist||0; travelSpeed+=e2.travelSpeed||0; }
    var es=g.equipStats(d); sword+=es.sword||0; if(es.burn) burn=true; thunder=es.thunder||0;
    if(sword>0&&g.hasTrait(d,'jianxin')) sword*=2;
    if(d.gongfa.wuji&&d.gongfa.wuji.id==='jinglei'&&thunder>0) atk+=thunder;
    var wj=null,i,all=GONGFA.wuji;
    for(i=0;i<all.length;i++) if(d.gongfa.wuji&&all[i].id===d.gongfa.wuji.id){ wj=all[i]; break; }
    if(wj&&wj.elem){ var bt=EL_BODY_TRAIT[wj.elem]; if(g.hasTrait(d,bt)) atk+=.25; }
    return {atk:atk,sword:sword,burn:burn,resist:resist,travelSpeed:travelSpeed};
  },
};
var CultivationEngine={
  /** 修炼速度（修为/秒）：灵根/设施/功法/长老/丹药/道侣/业力/增益聚合 */
  rate:function(g,d){
    var s=g.state,r=2;
    r*=1+.1*s.facilities.juling;
    r*=d.lingGen.mult;
    if(g.hasTrait(d,'conghui')) r*=1.15;
    if(g.hasTrait(d,'zhuanShi')) r*=1.2;
    for(var i=0;i<s.elders.length;i++) r*=1+.05*s.elders[i].times;
    if(d.gongfa.xinfa){ var eff=g.gongfaEffect(d.gongfa.xinfa.id,d.gongfa.xinfa.lv); r*=1+(eff.speed||0); }
    if(d.gongfa.xinfa&&d.gongfa.xinfa.id==='tongen'){ r*=1.10; if(g.tongenActive()) r*=2; }
    var es=g.equipStats(d); r*=1+(es.speed||0);
    if(g.hasTongxin()&&g.otherOnline&&g.otherHasTongxin()) r*=1.2;
    if(d.buffs.peiyuan>0) r*=1.5;
    if(d.buffs.zhuyan>0) r*=1.3;
    if(s.liupai==='qi') r*=.85;
    if(g.relationshipDaoLv(d)) r*=1.3;
    if(s.karma>0) r*=1.05;
    // v4.3 契缘 buff：相守(修炼+10%) / 飞升(同时在线翻倍)
    if(g.qiLv()>=2) r*=1.1;
    if(g.qiLv()>=5&&g.otherOnline) r*=2;
    for(i=0;i<s.buffs.length;i++) if(s.buffs[i].type==='cult') r*=1+s.buffs[i].mult;
    return r;
  },
  /** 炼丹周期（秒/颗） */
  alchemyCycle:function(g,d){
    var s=g.state,c=10/(1+.15*s.facilities.liandan);
    if(g.hasTrait(d,'danchi')) c/=1.25;
    var es=g.equipStats(d); if(es.alchemy) c/=1+es.alchemy;
    if(s.liupai==='dan') c/=2;
    for(var i=0;i<s.buffs.length;i++) if(s.buffs[i].type==='alch') c/=1+s.buffs[i].mult;
    return c;
  },
  /** 炼器周期（秒/件） */
  forgeCycle:function(g,d){
    var s=g.state,c=120*(1-.08*s.facilities.qishi);
    if(g.hasTrait(d,'jianghun')) c/=1.2;
    var es=g.equipStats(d); if(es.forge) c/=1+es.forge;
    return c;
  },
  /** 突破成功率：境界基础+藏经阁/悟性/丹药/功法/装备/道侣/功德，上限 90% */
  breakRate:function(g,d){
    var s=g.state;
    var r=REALMS[d.realm].br+(s.unlock.breakBonus||0)+.02*s.facilities.cangjing+d.wuXing*.003;
    if(g.hasTrait(d,'tianjuan')) r+=.05;
    if(g.hasTrait(d,'zhuanShi')) r+=.10;
    var es=g.equipStats(d); r+=es.breakRate||0;
    if(d.gongfa.xinfa){ var eff=g.gongfaEffect(d.gongfa.xinfa.id,d.gongfa.xinfa.lv); r+=eff.breakRate||0; }
    r+=d.breakBonus||0;
    for(var i=0;i<s.buffs.length;i++) if(s.buffs[i].type==='break') r+=s.buffs[i].mult;
    if(g.setCount(d,'zixiao')>=4) r+=.10;
    if(s.karma>0) r+=.05;
    return clamp(r,.03,.90);
  },
};

/* =====================================================================
 * Game 类：封装全部游戏状态与逻辑
 * ===================================================================== */
function Game(){
  this.state=null; this.isNew=false; this.lastTick=Date.now();
  this.otherOnline=false; this.otherSectLv=0; this.otherSectName='';
}
Game.prototype={
  /* ---------------- 初始化 ---------------- */
  newGame:function(sectName,masterTitle,motto){
    var st={
      version:4,lastTime:Date.now(),sectName:sectName,masterTitle:masterTitle||'掌门',motto:motto||'',theme:(function(){try{return localStorage.getItem('ytdt_theme')||'jin';}catch(e){return 'jin';}})(),
      beastName:'',               // 灵兽园灵兽的专属名字
      qingYuan:0,                  // 情缘值（互动积累）
      qyLog:0,                     // 情缘里程碑记录
      xiuDate:'',                  // 双修注入日期（每日一次）
      xiuDone:false,               // 今日是否已注入灵力
      xiuSettled:false,            // 今日双修是否已结算
      quizDate:'',                 // 默契问答日期
      quizAns:{},                  // 我的答案 {qIdx:ansIdx}
      quizCorrect:0,               // 今日答对数
      wish:'',                     // 流星夜许愿内容
      wishDate:'',                 // 许愿日期
      createdAt:Date.now(),        // 建宗时间（成长树基准）
      karma:0,history:[],
      res:{lingShi:800,shengWang:0,kuangShi:0,xianYu:0,beastMaterial:0,zhuyanFlower:0,jinghua:0,
        pills:{guyuan:0,peiyuan:0,ningshen:0,xugudan:0,zhuyan:0},
        juan:{fenhuang:0,wanmu:0,xingchen:0},equipBank:[]},
      diyun:0,
      lingTian:{lv:1,exp:0,plots:[],seeds:{juqicao:2},today:{date:0,steal:0,stealed:0,water:0},stats:{plant:0,harvest:0,steal:0,stealed:0,water:0},rain:0,event:null},
      facilities:{juling:0,cangjing:0,liandan:0,qishi:0,fangshi:0,lingshou:0,yaotao:0,wudao:0,dazhen:0},
      disciples:[],elders:[],liupai:null,sectLv:1,
      buffs:[],eventTimer:irand(60,150),npcAtkTimer:irand(900,1800),
      npcs:NPC_CLANS.map(function(c){return {id:c.id,name:c.name,power:c.power,rel:c.rel,personality:c.personality,desc:c.desc,cd:0,annihilated:false};}),
      parties:[],tower:{lv:0,cd:0},wudaoCd:0,
      logs:[],travelLogs:[],
      stats:{recruit:0,ascend:0,breakOk:0,breakFail:0,event:0,annihilate:0,earnLS:0,strengthen:0,gongfa:0,zhuanShi:0,zhongsheng:0,bossKill:0,warWin:0,towerLv:0,parallelTime:0,allianceTrades:0,duoBossKill:0,tonghuaTogether:false},
      dailyEarn:0,daily:{date:0,list:[],claimed:[]},weekly:{date:0,list:[],claimed:[]},
      achievements:{},unlock:{lingGenBonus:0,facilityBase:false,breakBonus:0,hard:false},
      qiYun:0,counts:{},
      alliance:null,relationship:{masterId:null,studentId:null,daoLvId:null,friends:[],rivals:[]},
      greeted:0,introShown:true,
      checkin:{day:0,streak:0,total:0},   // 签到缓存（云端 checkins 表为权威）
      weather:null,                        // 今日天气 {type,day}
      fate:null,                           // 今日运势 {lv,name,text,day}
      tutorialDone:false,                  // 新手引导是否完成（婉彤专属）
      // ===== v4.2 新玩法字段 =====
      starDate:'',                         // 今日观星日期（每日一次）
      starBuff:null,                       // 当前星象 buff {type,mult,left}
      daojiDate:'',                        // 今日悟道日期（每日一次）
      daoji:[],                            // 已收集道偈 id 数组（图鉴）
      noteDate:'',                         // 心意笺日期（每日一次）
      noteText:'',                         // 我写给道侣的话
      noteReply:'',                        // 道侣给我的回复
      noteReplyDate:'',                    // 回复日期
      // ===== v4.3 契缘·行迹·卷宗 =====
      trails:[],                           // 行迹流水 [{t,kind,detail}]（对方可查阅）
      qiyuan:0,                            // 契缘值（双人互动累计）
      qiyuanLv:0,                          // 当前结契阶段 index（里程碑防重复）
      qiyuanMsgDate:'',                    // 传书契缘计数日期
      qiyuanMsgCount:0,                    // 今日传书契缘计数（每日上限）
      lastOnline:Date.now(),               // 最后活动时间
      onlineMinutes:0,                     // 累计在线分钟
    };
    this.state=st;
    var i;
    for(i=0;i<3;i++) st.disciples.push(this.genDisciple());
    this.refreshTasks(true);
    this.addLog('「'+sectName+'」开山立派！此乃恩和真人与婉彤仙子道统之继。');
    this.addLog('提示：游历「彤云谷」可得朱颜花，炼成朱颜丹以赠佳人。',true);
    this.historyPush('开山立派','『'+sectName+'』立宗，掌门'+masterTitle+'受恩和真人道统');
    return st;
  },
  /** 宗门史书（编年体） */
  historyPush:function(title,desc){
    this.state.history.unshift({t:Date.now(),title:title,desc:desc});
    if(this.state.history.length>60) this.state.history.length=60;
  },
  addLog:function(text,imp){ this.state.logs.unshift({t:Date.now(),s:text,imp:!!imp}); if(this.state.logs.length>150) this.state.logs.length=150; },
  addTravelLog:function(text){ this.state.travelLogs.unshift({t:Date.now(),s:text}); if(this.state.travelLogs.length>60) this.state.travelLogs.length=60; },
  hasTrait:function(d,id){ return d.traits.indexOf(id)>=0; },
  findDisciple:function(id){ for(var i=0;i<this.state.disciples.length;i++) if(this.state.disciples[i].id===id) return this.state.disciples[i]; return null; },
  maxLevel:function(){ return Math.min(20,10+Math.floor(this.state.diyun/200)); },
  calcSectLv:function(){
    var total=0,k; for(k in this.state.facilities) total+=this.state.facilities[k];
    return Math.min(20,1+Math.floor(total/8)+Math.floor(this.state.diyun/100));
  },
  expNeed:function(d){ return d.realm<REALMS.length?REALMS[d.realm].need:0; },
  recruitCost:function(){ return Math.round(100*Math.pow(1.16,this.state.stats.recruit)); },
  /* ---------------- 资源 ---------------- */
  addLingShi:function(n){ this.state.res.lingShi+=n; if(n>0){ this.state.stats.earnLS+=n; this.state.dailyEarn+=n; } },
  addShengWang:function(n){ this.state.res.shengWang+=n; this.state.counts.shengwang=(this.state.counts.shengwang||0)+(n>0?n:0); },
  addKuangShi:function(n){ this.state.res.kuangShi+=n*this.starOreMult(); },
  addXianYu:function(n){ this.state.res.xianYu+=n; },
  addBeast:function(n){ this.state.res.beastMaterial+=n; },
  addZhuyan:function(n){ this.state.res.zhuyanFlower+=n; },
  addPill:function(k,n){ this.state.res.pills[k]=(this.state.res.pills[k]||0)+n; },
  addJuan:function(k,n){ this.state.res.juan[k]=(this.state.res.juan[k]||0)+n; },
  totalPills:function(){ var p=this.state.res.pills; return p.guyuan+p.peiyuan+p.ningshen+p.xugudan+p.zhuyan; },
  canAfford:function(cost){ var r=this.state.res; return r.lingShi>=(cost.lingShi||0)&&r.shengWang>=(cost.shengWang||0)&&r.kuangShi>=(cost.kuangShi||0)&&r.xianYu>=(cost.xianYu||0)&&(r.jinghua||0)>=(cost.jinghua||0); },
  pay:function(cost){ var r=this.state.res; r.lingShi-=(cost.lingShi||0); r.shengWang-=(cost.shengWang||0); r.kuangShi-=(cost.kuangShi||0); r.xianYu-=(cost.xianYu||0); r.jinghua=(r.jinghua||0)-(cost.jinghua||0); },
  /* ---------------- 弟子生成 ---------------- */
  genDisciple:function(zhuanShi){
    var u=this.state.unlock;
    var r=Math.random(),pSum=0,lg=LINGGEN[0],i;
    for(i=0;i<LINGGEN.length;i++){ var p=LINGGEN[i].quality==='天灵根'?LINGGEN[i].prob+(u.lingGenBonus||0)/100:LINGGEN[i].prob;
      if(r<pSum+p){ lg=LINGGEN[i]; break; } pSum+=p; }
    var pool=TRAITS.slice(),traits=[],nTraits=irand(0,2);
    for(i=0;i<nTraits&&pool.length;i++) traits.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0].id);
    var fu=irand(10,100);
    if(traits.indexOf('hongyun')>=0) fu=Math.min(100,fu+30);
    if(zhuanShi){ fu=Math.min(100,Math.round(fu/2)+30); traits.push('zhuanShi'); }
    var d={ id:'d'+Date.now()+'_'+Math.floor(Math.random()*99999),
      name:pick(DAO_NAMES)+' '+pick(DAO_TITLES),
      lingGen:{type:pick(ELEMENTS),quality:lg.quality,mult:lg.mult},
      wuXing:irand(30,100),fuYuan:fu,traits:traits,
      realm:0,exp:0,state:'idle',workProg:0,
      travelTask:null,travelLeft:0,injury:{left:0,total:0},
      equipment:{wuqi:null,fangju:null,shishi:null,fabao:null},
      gongfa:{xinfa:null,wuji:null},
      zhuanShi:zhuanShi||0,buffs:{peiyuan:0},breakBonus:0,
      fate:Math.random()<.03?'tianming':null,   // 宿命弟子（3%）
      story:''
    };
    return d;
  },
  recruit:function(){
    var g=this.state,cost=this.recruitCost();
    if(g.res.lingShi<cost){ toast('灵石不足'); return; }
    g.res.lingShi-=cost;
    var d=this.genDisciple();
    g.disciples.push(d); g.stats.recruit++;
    this.count('recruit',1);
    audio.recruit();
    this.addLog('有缘人叩响山门：'+d.name+'拜入「'+g.sectName+'」（'+d.lingGen.quality+'·'+d.lingGen.type+'灵根）'+(d.fate?'【宿命弟子】':''));
    if(d.fate) this.historyPush('宿命降世',d.name+'身负宿命印记，拜入宗门');
  },
  recruitElite:function(){
    var g=this.state;
    if(g.res.xianYu<10){ toast('仙玉不足（需10）'); return; }
    g.res.xianYu-=10;
    var d=this.genDisciple();
    if(d.lingGen.quality!=='天灵根'&&d.traits.length<2){ var pool=TRAITS.filter(function(t){return d.traits.indexOf(t.id)<0;}); d.traits.push(pick(pool).id); }
    g.disciples.push(d); g.stats.recruit++; this.count('recruit',1);
    audio.ascend();
    this.addLog('仙玉招募：'+d.name+'天资不凡（'+d.lingGen.quality+'·词条'+d.traits.length+'个）',true);
  },
  /* ---------------- 产出计算 ---------------- */
  /** 对方是否在线（双人协同） */
  otherIsOnline:function(){ return this.otherOnline; },
  /** 彤恩双修诀是否生效翻倍 */
  tongenActive:function(){ return this.state.alliance&&this.otherIsOnline(); },
  /** 修炼速度（委托 CultivationEngine） */
  cultivateRate:function(d){ return CultivationEngine.rate(this,d); },
  /** 道侣关系检测（同修弟子） */
  relationshipDaoLv:function(d){ return this.state.relationship.daoLvId===d.id; },
  hasTongxin:function(){ return this.state.disciples.some(function(d){ return d.equipment&&d.equipment.shishi&&d.equipment.shishi.special==='tongxin'; }); },
  otherHasTongxin:function(){ return !!this.otherTongxin; },
  /** 炼丹周期（委托 CultivationEngine） */
  alchemyCycle:function(d){ return CultivationEngine.alchemyCycle(this,d); },
  /** 炼器周期（委托 CultivationEngine） */
  forgeCycle:function(d){ return CultivationEngine.forgeCycle(this,d); },
  alchemyCount:function(){ return this.state.disciples.filter(function(d){return d.state==='alchemy';}).length; },
  forgeCount:function(){ return this.state.disciples.filter(function(d){return d.state==='forge';}).length; },
  facilityFree:function(key){
    var lv=this.state.facilities[key];
    if(lv<1) return false;
    var cap=Math.min(lv,5);
    return key==='liandan'?this.alchemyCount()<cap:this.forgeCount()<cap;
  },
  /** 突破成功率（委托 CultivationEngine） */
  breakthroughRate:function(d){ return CultivationEngine.breakRate(this,d); },
  /* ---------------- 装备 ---------------- */
  qualityRoll:function(forge){
    var g=this.state,pLing=.10+g.facilities.qishi*.05,pXian=g.facilities.qishi*.015,pHt=.004,pXt=.0008;
    if(forge&&this.hasTrait(forge,'jianghun')){ pLing+=.08;pXian+=.03; }
    if(g.liupai==='qi'){ pLing+=.10;pXian+=.05;pHt+=.02;pXt+=.003; }
    var r=Math.random();
    if(r<pXt) return 4; if(r<pXt+pHt) return 3; if(r<pXt+pHt+pXian) return 2; if(r<pXt+pHt+pXian+pLing) return 1; return 0;
  },
  /** 生成装备（含背景故事与出处） */
  genEquip:function(partKey,qualityIdx,setKey,source){
    var part=partKey||pick(EQUIP_PARTS).key,q=qualityIdx!==undefined?qualityIdx:this.qualityRoll(null),Q=QUALITIES[q];
    var basePool=EQUIP_BASES[part],base=pick(basePool),set=null,i;
    if(setKey){ var s=SETS[setKey]; base=s.parts[part]; set=setKey; }
    else{ for(var sk in SETS){ if(Math.random()<.03){ base=SETS[sk].parts[part]; set=sk; break; } } }
    var nAffix=Q.affix,affixes=[],pool=AFFIXES.slice();
    for(i=0;i<nAffix&&pool.length;i++){ var a=pool.splice(Math.floor(Math.random()*pool.length),1)[0]; affixes.push({id:a.id,name:a.name,stat:a.stat,v:a.v,desc:a.desc}); }
    // 先天至宝必含特殊词缀
    if(Q.special&&affixes.length&&Math.random()<.5){ var sp=AFFIXES.filter(function(a){return a.stat==='thunder'||a.stat==='zhuyan';}); if(sp.length) affixes[affixes.length-1]={id:sp[0].id,name:sp[0].name,stat:sp[0].stat,v:sp[0].v,desc:sp[0].desc}; }
    var baseAtk=part==='wuqi'?Math.round(12*Q.base):part==='fangju'?Math.round(6*Q.base):Math.round(3*Q.base);
    var baseDef=part==='fangju'?Math.round(12*Q.base):part==='wuqi'?Math.round(4*Q.base):Math.round(2*Q.base);
    var baseHp=Math.round(30*Q.base);
    return { id:'e'+Date.now()+'_'+Math.floor(Math.random()*99999),part:part,base:base,quality:q,qualityName:Q.name,
      affixes:affixes,set:set,lv:0,baseAtk:baseAtk,baseDef:baseDef,baseHp:baseHp,
      story:this.equipStory(base,q,source),source:source||'',special:null,awaken:0,bloodBound:false,infuse:null };
  },
  /** 装备背景故事 */
  equipStory:function(base,q,source){
    var tales=['此器随主人征战多年，剑身犹带余温','出自无名铸师之手，却暗含天道之机','相传为上古仙人随身之器','器中有灵，择主而鸣','曾在雷劫中淬炼，锋锐无匹'];
    var tail=source?('（'+source+'）'):'';
    return base+'：'+pick(tales)+'，品质'+QUALITIES[q].name+'。'+tail;
  },
  /** 聚合装备属性 */
  equipStats:function(d){
    var out={},i,p;
    if(!d.equipment) return out;
    function add(k,v){ if(v) out[k]=(out[k]||0)+v; }
    for(i=0;i<EQUIP_PARTS.length;i++){
      var e=d.equipment[EQUIP_PARTS[i].key];
      if(!e) continue;
      var mult=1+e.lv*.06; if(e.bloodBound) mult*=1.3;
      add('atk',e.baseAtk*mult); add('def',e.baseDef*mult); add('hp',e.baseHp*mult);
      for(var j=0;j<e.affixes.length;j++) this.applyAffix(out,e.affixes[j],e,d);
      if(e.awaken>0){ add('speed',.03*e.awaken); }
      if(e.infuse){ var f=e.infuse; if(f.type==='speed') add('speed',f.v); else if(f.type==='break') add('breakRate',f.v); else if(f.type==='atk') add('atk',f.v*e.baseAtk); }
    }
    // v5 套装效果实装（2件/4件）
    var sc=this.setCountAll(d);
    if(sc.qingyun>=2) add('travelSpeed',.20);
    if(sc.qingyun>=4) add('sword',.50);
    if(sc.tongxia>=2) add('alchemy',.20);
    if(sc.tongxia>=4){ add('zhuyanDouble',1); add('speed',.10); }
    if(sc.xuanming>=2){ var fang=d.equipment.fangju; add('def',(fang?fang.baseDef:10)*.20); }
    if(sc.xuanming>=4) add('resist',.30);
    return out;
  },
  /** 各套装已穿件数（v5） */
  setCountAll:function(d){
    var out={},i;
    for(var sk in SETS) out[sk]=0;
    if(!d||!d.equipment) return out;
    for(i=0;i<EQUIP_PARTS.length;i++){ var e=d.equipment[EQUIP_PARTS[i].key]; if(e&&e.set&&out[e.set]!==undefined) out[e.set]++; }
    return out;
  },
  applyAffix:function(out,a,e,d){
    var sv=a.stat,v=a.v;
    // 余雷联动：引雷体翻倍
    if(sv==='thunder'){ v*= (d&&this.hasTrait(d,'yinleiti'))?2:1; out.thunder=(out.thunder||0)+v; }
    else if(sv==='zhuyan'){ out.zhuyanEff=(out.zhuyanEff||0)+v; }
    else if(sv==='atk') out.atk=(out.atk||0)+e.baseAtk*v;
    else if(sv==='def') out.def=(out.def||0)+e.baseDef*v;
    else if(sv==='hp') out.hp=(out.hp||0)+e.baseHp*v;
    else if(sv==='defResist'){ out.def=(out.def||0)+e.baseDef*v; out.resist=(out.resist||0)+.05; }
    else if(sv==='atkBurn'){ out.atk=(out.atk||0)+e.baseAtk*v; out.burn=true; }
    else if(sv==='alchSpeed'){ out.alchemy=(out.alchemy||0)+v; out.speed=(out.speed||0)+.03; }
    else if(sv==='defHp'){ out.def=(out.def||0)+e.baseDef*v; out.hp=(out.hp||0)+e.baseHp*v*.6; }
    else if(sv==='speedDodge'){ out.speed=(out.speed||0)+v; out.resist=(out.resist||0)+.08; }
    else if(sv==='speedBreak'){ out.speed=(out.speed||0)+v; out.breakRate=(out.breakRate||0)+.02; }
    else if(sv==='atkTravel'){ out.atk=(out.atk||0)+e.baseAtk*v; out.travelWin=(out.travelWin||0)+.05; }
    else if(sv==='travelLS'){ out.travelGain=(out.travelGain||0)+v; }
    else if(sv==='breakWX'){ out.breakRate=(out.breakRate||0)+v; }
    else if(sv==='lucky'){ out.lucky=(out.lucky||0)+v; }
    else if(sv==='allAtk'){ out.atk=(out.atk||0)+e.baseAtk*v; out.def=(out.def||0)+e.baseDef*v; out.hp=(out.hp||0)+e.baseHp*v; }
    else if(sv==='travelWin'){ out.travelWin=(out.travelWin||0)+v; }
    else if(sv==='sword'){ out.sword=(out.sword||0)+v; }
    else if(sv==='pillEff'){ out.pillEff=(out.pillEff||0)+v; }
    else if(sv==='heal'){ out.heal=(out.heal||0)+v; }
    else out[sv]=(out[sv]||0)+v;
  },
  equipItem:function(d,eid){
    var g=this.state,idx=-1,i;
    for(i=0;i<g.res.equipBank.length;i++) if(g.res.equipBank[i].id===eid){ idx=i; break; }
    if(idx<0) return;
    var e=g.res.equipBank.splice(idx,1)[0];
    var old=d.equipment[e.part];
    if(old) g.res.equipBank.push(old);
    d.equipment[e.part]=e;
    audio.equip();
    this.addLog(d.name+'祭炼了'+e.qualityName+'·'+e.base);
  },
  unequipItem:function(d,partKey){
    var e=d.equipment[partKey];
    if(!e) return;
    this.state.res.equipBank.push(e);
    d.equipment[partKey]=null;
    this.addLog(d.name+'卸下了'+e.qualityName+'·'+e.base);
  },
  strengthenEquip:function(d,partKey){
    var g=this.state,e=d.equipment[partKey];
    if(!e){ toast('该部位无装备'); return; }
    if(e.lv>=15){ toast('已满强化'); return; }
    var cost={lingShi:Math.round(100*Math.pow(2,e.lv)),kuangShi:5+e.lv};
    if(!this.canAfford(cost)){ toast('强化资源不足'); return; }
    var rate=clamp(.95-e.lv*.045,.2,.95);
    if(g.liupai==='qi') rate=Math.min(.95,rate+.2);
    this.pay(cost);
    if(Math.random()<rate){
      e.lv++; g.stats.strengthen++; this.count('strengthen',1);
      audio.upgrade();
      this.addLog(d.name+'将'+e.qualityName+'·'+e.base+'强化至+'+e.lv+'！');
    }else{ audio.breakFail(); this.addLog(d.name+'强化'+e.qualityName+'·'+e.base+'失败（材料已耗）'); }
  },
  setCount:function(d,setKey){
    var n=0,i;
    for(i=0;i<EQUIP_PARTS.length;i++){ var e=d.equipment[EQUIP_PARTS[i].key]; if(e&&e.set===setKey) n++; }
    return n;
  },
  produceEquip:function(d){
    var g=this.state,q=this.qualityRoll(d),e=this.genEquip(pick(EQUIP_PARTS).key,q,null,d.name+'于器室所炼');
    g.res.equipBank.push(e);
    audio.forge();
    this.addLog(d.name+'炼制出'+e.qualityName+'·'+e.base+(e.set?'（'+SETS[e.set].name+'部件）':''));
  },
  equipDesc:function(e){
    var aff=e.affixes.map(function(a){return a.desc;}).join('，');
    var str=e.lv>0?'强化+'+e.lv+' ':'';
    var extra='';
    if(e.awaken>0) extra+='器灵觉醒+'+e.awaken+' ';
    if(e.bloodBound) extra+='血炼绑定 ';
    if(e.infuse) extra+='注灵 ';
    return e.qualityName+'·'+e.base+' '+str+extra+'（攻'+e.baseAtk+' 防'+e.baseDef+' 生'+e.baseHp+(aff?'；'+aff:'')+'）'+(e.set?'【'+SETS[e.set].name+'】':'');
  },
  /** 器灵觉醒：使用次数达成 → 额外词缀 */
  awakenEquip:function(d,partKey){
    var e=d.equipment[partKey];
    if(!e||e.awaken>=3){ toast('不可觉醒'); return; }
    if(this.state.res.xianYu<2){ toast('需 2 仙玉'); return; }
    this.state.res.xianYu-=2;
    e.awaken++;
    audio.upgrade();
    this.addLog(d.name+'的'+e.qualityName+'·'+e.base+'器灵觉醒（+'+e.awaken+'）！修炼速度+'+e.awaken*3+'%');
  },
  /** 血炼绑定：属性+30%，弟子陨落则碎裂 */
  bloodBind:function(d,partKey){
    var e=d.equipment[partKey];
    if(!e||e.bloodBound){ toast('不可血炼'); return; }
    if(this.state.res.xianYu<3){ toast('需 3 仙玉'); return; }
    this.state.res.xianYu-=3;
    e.bloodBound=true;
    audio.ascend();
    this.addLog(d.name+'与'+e.qualityName+'·'+e.base+'血炼绑定，属性+30%');
  },
  /** 附魔注灵 */
  infuseEquip:function(d,partKey,type){
    var e=d.equipment[partKey];
    if(!e){ toast('无装备'); return; }
    var cost={lingShi:300};
    if(!this.canAfford(cost)){ toast('灵石不足'); return; }
    this.pay(cost);
    e.infuse={type:type,v:type==='speed'?.10:type==='break'?.05:.10};
    audio.upgrade();
    this.addLog(d.name+'为'+e.qualityName+'·'+e.base+'注入灵力（'+(type==='speed'?'修炼':type==='break'?'突破':'攻击')+'）');
  },
  /* ---------------- 装备·深度玩法（v5 王者出装×传奇数值） ---------------- */
  /** 单件装备战力分（千分之一战力为单位） */
  equipPower:function(e){
    if(!e) return 0;
    var es={},i;
    function add(k,v){ if(v) es[k]=(es[k]||0)+v; }
    var mult=1+e.lv*.06; if(e.bloodBound) mult*=1.3;
    add('atk',e.baseAtk*mult); add('def',e.baseDef*mult); add('hp',e.baseHp*mult);
    for(i=0;i<e.affixes.length;i++) this.applyAffix(es,e.affixes[i],e,null);
    if(e.awaken>0) add('speed',.03*e.awaken);
    if(e.infuse){ var f=e.infuse; if(f.type==='speed') add('speed',f.v); else if(f.type==='break') add('breakRate',f.v); else if(f.type==='atk') add('atk',f.v*e.baseAtk); }
    var p=1+es.atk*.03+es.def*.02+es.hp*.001+(es.crit||0)*.05+(es.critDmg||0)*.025+(es.penetrate||0)*.04+(es.lifesteal||0)*.03+(es.dodge||0)*.05+(es.block||0)*.025;
    return Math.round((p-1)*1000);
  },
  /** 装备穿上前后对比（王者式出装预览） */
  equipCompare:function(d,e){
    var cur=this.equipStats(d),curP=this.disciplePower(d),backup=d.equipment[e.part];
    d.equipment[e.part]=e;
    var next=this.equipStats(d),nextP=this.disciplePower(d);
    d.equipment[e.part]=backup;
    var out={power:nextP-curP};
    ['atk','def','hp','crit','critDmg','penetrate','lifesteal','dodge','block','speed'].forEach(function(k){ out[k]=((next[k]||0)-(cur[k]||0)); });
    return out;
  },
  /** 推荐出装提示（按弟子特质） */
  recommendEquip:function(d){
    var tips=[];
    if(this.hasTrait(d,'zhanhuang')||this.hasTrait(d,'tianmo')) tips.push('⚔️ 战斗型：优先【攻击·破甲】，词缀选锋锐/破甲/会心');
    if(this.hasTrait(d,'yinleiti')) tips.push('⚡ 引雷体：必选【余雷】词缀（效果翻倍）联动惊雷掌');
    if(this.hasTrait(d,'danchi')) tips.push('🧪 丹痴：堆【炼丹】词缀（丹火/青木）+ 彤霞套装炼丹+20%');
    if(this.hasTrait(d,'jianxin')) tips.push('🗡️ 剑修：青云套装 4 件剑系威力+50%');
    if(this.hasTrait(d,'hongyun')) tips.push('🍀 福缘型：堆【聚宝/福星】游历收益更高');
    if(!tips.length) tips.push('⚖️ 均衡出装：攻防并重，词缀选锋锐/坚壁/厚土');
    return tips;
  },
  /** 分解装备 → 矿石+器灵精华 */
  decomposeEquip:function(eid){
    var g=this.state,i;
    for(i=0;i<g.res.equipBank.length;i++) if(g.res.equipBank[i].id===eid) break;
    if(i>=g.res.equipBank.length){ toast('装备不存在'); return; }
    var e=g.res.equipBank.splice(i,1)[0],r=EQUIP_REFINE[e.quality];
    g.res.kuangShi+=r.kuang; g.res.jinghua=(g.res.jinghua||0)+r.jh;
    this.addLog('分解'+e.qualityName+'·'+e.base+'：矿石+'+r.kuang+(r.jh?'、器灵精华+'+r.jh:''),true);
    toast('分解成功：矿石+'+r.kuang+(r.jh?'、精华+'+r.jh:''));
    this.count('decompose',1);
  },
  /** v5.3 装备合成：3 件同品质 → 高一级（同部位=定向合成；不同部位=随机） */
  combineEquip:function(ids){
    var g=this.state,i,j,list=[];
    if(!ids||ids.length!==3){ toast('请选择 3 件装备'); return; }
    for(i=0;i<ids.length;i++){
      for(j=0;j<g.res.equipBank.length;j++){
        if(g.res.equipBank[j].id===ids[i]){ list.push(g.res.equipBank[j]); break; }
      }
    }
    if(list.length!==3){ toast('装备不存在或已被使用'); return; }
    var q=list[0].quality;
    for(i=1;i<3;i++) if(list[i].quality!==q){ toast('三件装备品质必须相同'); return; }
    if(q>=4){ toast('先天至宝已是顶级，无法合成'); return; }
    if(g.res.lingShi<100){ toast('合成需 100 灵石'); return; }
    g.res.lingShi-=100;
    for(i=0;i<list.length;i++){
      for(j=0;j<g.res.equipBank.length;j++) if(g.res.equipBank[j].id===list[i].id){ g.res.equipBank.splice(j,1); break; }
    }
    // 同部位三件 = 定向合成（保住部位）；否则随机部位
    var samePart=list[0].part===list[1].part&&list[1].part===list[2].part;
    var part=samePart?list[0].part:pick(EQUIP_PARTS).key;
    var e=this.genEquip(part,q+1,null,'三宝合一');
    g.res.equipBank.push(e);
    audio.upgrade();
    this.addLog('三宝合一：'+QUALITIES[q].name+'×3 合成 '+e.qualityName+'·'+e.base+'！',true);
    toast('🎉 合成成功！'+e.qualityName+'·'+e.base);
    this.count('combine',1);
    g.stats.combine=(g.stats.combine||0)+1;
    if(e.quality>=3) g.stats.combineTop=Math.max(g.stats.combineTop||0,e.quality);
    this.checkAchievements();
  },
  /** 装备进阶（传奇式武器升级，品质+1） */
  advanceEquip:function(d,partKey){
    var g=this.state,e=d.equipment[partKey];
    if(!e){ toast('该部位无装备'); return; }
    if(e.quality>=4){ toast('已至先天至宝，无法再进阶'); return; }
    var step=EQUIP_ADVANCE[e.quality],Q=QUALITIES[e.quality+1],oldQ=QUALITIES[e.quality];
    if(!this.canAfford(step.cost)){ toast('进阶资源不足（'+step.desc+'）'); return; }
    this.pay(step.cost);
    var rate=step.rate; if(g.liupai==='qi') rate=Math.min(.9,rate+.15);
    if(Math.random()<rate){
      var f=Q.base/oldQ.base;
      e.quality++; e.qualityName=Q.name;
      e.baseAtk=Math.round(e.baseAtk*f); e.baseDef=Math.round(e.baseDef*f); e.baseHp=Math.round(e.baseHp*f);
      if(e.quality===4&&e.affixes.length<4) e.affixes.push({id:'xiantian',name:'先天',stat:'allAtk',v:.05,desc:'攻防生+5%'});
      audio.ascend();
      this.addLog(d.name+'将'+oldQ.name+'·'+e.base+'进阶为【'+Q.name+'】！',true);
      toast('🎉 进阶成功！'+Q.name);
    }else{ audio.breakFail(); this.addLog(d.name+'进阶'+oldQ.name+'·'+e.base+'失败（材料已耗）'); toast('进阶失败，材料已耗'); }
    this.count('advance',1);
  },
  /** 演武场：今日剩余次数（旧档兼容自动初始化） */
  arenaLeft:function(){
    var g=this.state;
    if(!g.arena) g.arena={date:'',left:ARENA_DAILY,level:0,wins:0};
    var today=new Date().toDateString();
    if(g.arena.date!==today){ g.arena.date=today; g.arena.left=ARENA_DAILY; }
    return g.arena.left;
  },
  /** 演武场挑战：真实回合制（护甲减伤/暴击/闪避/格挡/吸血全参与） */
  arenaChallenge:function(){
    var g=this.state,left=this.arenaLeft();
    if(left<=0){ toast('今日挑战次数已用完'); return; }
    var d=this.strongestDisciple();
    if(!d){ toast('先招募一名弟子'); return; }
    if(!g.arena) g.arena={date:new Date().toDateString(),left:ARENA_DAILY,level:0,wins:0};
    g.arena.left--;
    var lv=ARENA_LEVELS[g.arena.level]||ARENA_LEVELS[ARENA_LEVELS.length-1];
    var es=this.equipStats(d),myPower=this.disciplePower(d);
    var me={atk:Math.round(myPower*.28)+(es.atk||0),def:Math.round(myPower*.12)+(es.def||0),hp:Math.round(2000+myPower*2)+(es.hp||0),crit:es.crit||0,critDmg:es.critDmg||0,penetrate:es.penetrate||0,dodge:es.dodge||0,block:es.block||0,lifesteal:es.lifesteal||0};
    var foe={atk:Math.round(myPower*lv.mult*.28),def:Math.round(myPower*lv.mult*.12),hp:Math.round(2000+myPower*lv.mult*2),crit:.08,critDmg:0,penetrate:0,dodge:.04,block:0,lifesteal:0};
    var res=BattleEngine.simulateDuel(me,foe);
    var logHtml=res.logs.slice(0,8).map(function(s){return '<div class="sub" style="font-size:11px">'+s+'</div>';}).join('');
    if(res.win){
      g.arena.wins=(g.arena.wins||0)+1;
      var gains=[],kuang=20+g.arena.level*15,jh=1+g.arena.level;
      g.res.kuangShi+=kuang; g.res.jinghua=(g.res.jinghua||0)+jh;
      gains.push('矿石+'+kuang,'精华+'+jh);
      if(Math.random()<.5||g.arena.level>=3){ var e=this.genEquip(pick(EQUIP_PARTS).key,Math.min(2,1+Math.floor(g.arena.level/2)),null,'演武场第'+(g.arena.level+1)+'层'); g.res.equipBank.push(e); gains.push(e.qualityName+'·'+e.base); }
      this.addLog('演武场第'+(g.arena.level+1)+'层挑战成功！'+(gains.join('、')),true);
      this.checkAchievements();
      if(g.arena.level<ARENA_LEVELS.length-1) g.arena.level++;
      showModal('<h2>⚔️ 演武场·'+lv.name+'</h2><div class="mdesc">挑战成功！'+d.name+'剩余生命 '+res.mhp+'/'+me.hp+'</div>'+logHtml+'<div class="sub" style="color:var(--ok)">🎁 奖励：'+gains.join('、')+'</div><div class="close-row"><button class="btn gold" data-act="arena">继续挑战</button><button class="btn" data-act="closeModal">收下</button></div>');
    }else{
      this.addLog('演武场第'+(g.arena.level+1)+'层挑战失败（'+d.name+'负伤）');
      showModal('<h2>⚔️ 演武场·'+lv.name+'</h2><div class="mdesc">挑战失败……对方剩余生命 '+res.fhp+'</div>'+logHtml+'<div class="sub" style="color:var(--bad)">建议：强化装备/提升护甲与攻击后再战（今日剩 '+(g.arena.left)+' 次）</div><div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>');
    }
    this.saveProfile(function(){});
  },
  /** 赠送装备给伴侣（[gift] 消息，离线可领） */
  giftEquip:function(eid,note){
    var g=this.state,i;
    if(!g.alliance){ toast('需先结盟才能赠礼'); return; }
    for(i=0;i<g.res.equipBank.length;i++) if(g.res.equipBank[i].id===eid) break;
    if(i>=g.res.equipBank.length){ toast('装备不存在'); return; }
    var e=g.res.equipBank.splice(i,1)[0];
    var sender=this.profile?this.profile.name:'道侣';
    var payload={id:e.id,part:e.part,base:e.base,quality:e.quality,qualityName:e.qualityName,affixes:e.affixes,set:e.set||null,lv:e.lv||0,baseAtk:e.baseAtk,baseDef:e.baseDef,baseHp:e.baseHp,source:'赠礼·'+sender,story:e.story||'',awaken:e.awaken||0,bloodBound:e.bloodBound||false,infuse:e.infuse||null,note:(note||'').slice(0,30)};
    DB.sendMessage('[gift]'+JSON.stringify(payload),function(ok){
      if(!ok){ g.res.equipBank.push(e); toast('传书失败，装备已退回'); return; }
      game.addQiyuan(10);
      game.addLog('将'+e.qualityName+'·'+e.base+'赠予'+CONFIG.PARTNER_NAME+(payload.note?'（留言：'+payload.note+'）':'')+'（契缘+10）',true);
      toast('🎁 已送出！对方上线即可在传书页领取');
    });
  },
  /** 领取赠礼装备 */
  claimGift:function(gid){
    var g=this.state;
    if(!g.gifts) g.gifts={};
    var gift=g.gifts[gid];
    if(!gift||gift.claimed){ toast('已领取或不存在'); return; }
    gift.claimed=true;
    var e={id:'g'+Date.now()+'_'+Math.floor(Math.random()*99999),part:gift.part,base:gift.base,quality:gift.quality,qualityName:gift.qualityName,affixes:gift.affixes||[],set:gift.set||null,lv:gift.lv||0,baseAtk:gift.baseAtk,baseDef:gift.baseDef,baseHp:gift.baseHp,source:gift.source||'赠礼',story:gift.story||'',special:null,awaken:gift.awaken||0,bloodBound:gift.bloodBound||false,infuse:gift.infuse||null};
    g.res.equipBank.push(e);
    this.addQiyuan(10);
    this.addLog('收下'+CONFIG.PARTNER_NAME+'赠予的'+e.qualityName+'·'+e.base+'（契缘+10）',true);
    toast('🎁 收下 '+e.qualityName+'·'+e.base+(gift.note?('：'+gift.note):''));
    this.checkAchievements();
    this.saveProfile(function(){});
  },
  /** v5.4 师徒任务：布置任务给伴侣（[quest] 消息，离线可见） */
  sendQuest:function(qid){
    var q=questById(qid);
    if(!q){ toast('未知任务'); return; }
    var sender=this.profile?this.profile.name:'道侣';
    DB.sendMessage('[quest]'+JSON.stringify({id:q.id,name:q.name,tab:q.tab,act:q.act,sender:sender}),function(ok){
      if(!ok){ toast('传书失败，请重试'); return; }
      game.addQiyuan(5);
      game.addLog('给'+CONFIG.PARTNER_NAME+'布置了任务：'+q.name+'（契缘+5）',true);
      toast('🎯 已布置！她打开游戏就能看到');
    });
  },
  /** 完成任务后回执（[quest_done] 消息） */
  questDone:function(qid,msgId){
    var g=this.state;
    if(!g.quests) g.quests={};
    if(g.quests[qid+'_'+msgId]) return;
    g.quests[qid+'_'+msgId]=true;
    var q=questById(qid)||{name:'任务'};
    DB.sendMessage('[quest_done]'+JSON.stringify({id:qid,name:q.name}),function(){
      game.addQiyuan(5);
      game.addLog('完成了'+CONFIG.PARTNER_NAME+'布置的任务：'+q.name+'（契缘+5）',true);
      toast('✅ 任务完成！他那边会收到通知');
      game.saveProfile(function(){});
    });
  },
  /** 收到对方任务完成回执（发方调用） */
  onQuestDone:function(q,msgId){
    var g=this.state;
    if(!g.quests) g.quests={};
    if(g.quests['done_'+msgId]) return;
    g.quests['done_'+msgId]=true;
    this.addQiyuan(10);
    this.addLog('🎉 '+CONFIG.PARTNER_NAME+'完成了你布置的任务：'+(q.name||'任务')+'（契缘+10）',true);
    toast('🎉 '+CONFIG.PARTNER_NAME+'完成了你布置的任务！');
    this.saveProfile(function(){});
  },
  /** 装备图鉴进度 */
  equipCodex:function(){
    var g=this.state,seen={},i,j;
    function scan(list){ for(var x=0;x<list.length;x++){ var e=list[x]; if(e&&e.base) seen[e.base]=1; } }
    scan(g.res.equipBank);
    for(j=0;j<g.disciples.length;j++){ var d=g.disciples[j]; for(i=0;i<EQUIP_PARTS.length;i++) scan([d.equipment[EQUIP_PARTS[i].key]]); }
    var all=0;
    for(var sk in SETS){ var s=SETS[sk]; for(var pk in s.parts) all++; }
    for(var bk in EQUIP_BASES){ all+=EQUIP_BASES[bk].length; }
    return {count:Object.keys(seen).length,total:all};
  },
  /** 最强弟子（按战力） */
  strongestDisciple:function(){
    var best=null,bp=0,i,d,p;
    for(i=0;i<this.state.disciples.length;i++){ d=this.state.disciples[i]; p=this.disciplePower(d); if(p>bp){ bp=p; best=d; } }
    return best;
  },
  /* ---------------- 功法 ---------------- */
  gongfaEffect:function(id,lv){
    lv=lv||1;
    switch(id){
      case 'taixu': return {speed:(10+lv*5)/100};
      case 'hundun': return {speed:(15+lv*5)/100};
      case 'changchun': return {speed:(8+lv*4)/100,heal:(20+lv*5)/100};
      case 'zixiao': return {speed:(20+lv*4)/100,breakRate:(3+lv)/100};
      case 'tongen': return {speed:0};   // 效果在 cultivateRate 单独计算
      case 'xingchen': return {speed:(25+lv*5)/100};
      case 'qingyun': return {sword:(30+lv*10)/100};
      case 'fenhuang': return {atk:(35+lv*10)/100,burn:true};
      case 'wanmu': return {resist:(10+lv*3)/100};
      case 'jinglei': return {atk:(25+lv*8)/100};
      case 'xuanbing': return {atk:(40+lv*8)/100,travelSpeed:.10};
    }
    return {};
  },
  learnGongfa:function(d,gfId){
    var g=this.state,all=GONGFA.xinfa.concat(GONGFA.wuji),gf=null,i;
    for(i=0;i<all.length;i++) if(all[i].id===gfId){ gf=all[i]; break; }
    if(!gf){ toast('功法不存在'); return; }
    if(g.facilities.cangjing<gf.need){ toast('藏经阁需 '+gf.need+' 级'); return; }
    if(gf.alliance&&!g.alliance){ toast('需与婉彤结盟后解锁'); return; }
    if(gf.juan){ if(g.res.juan[gf.juan]<gf.juanNeed){ toast('需《'+gf.name+'》残卷 '+gf.juanNeed+' 片'); return; }
      g.res.juan[gf.juan]-=gf.juanNeed; }
    else if(gf.resonance){ var cost=gf.cost(0); if(!this.canAfford(cost)){ toast('声望/灵石不足'); return; } this.pay(cost); }
    var slot=gf.elem===null&&GONGFA.xinfa.indexOf(gf)>=0?'xinfa':GONGFA.wuji.indexOf(gf)>=0?'wuji':'xinfa';
    var old=d.gongfa[slot];
    d.gongfa[slot]={id:gfId,lv:1};
    g.stats.gongfa++;
    this.checkAchievements();
    audio.upgrade();
    this.addLog(d.name+'参悟了《'+gf.name+'》'+(old?'（替换旧功法）':''),true);
  },
  upgradeGongfa:function(d,slot){
    var g=this.state,gf=d.gongfa[slot];
    if(!gf){ toast('该槽位无功法'); return; }
    if(gf.lv>=5){ toast('功法已满阶'); return; }
    var meta=null,i,all=GONGFA.xinfa.concat(GONGFA.wuji);
    for(i=0;i<all.length;i++) if(all[i].id===gf.id){ meta=all[i]; break; }
    var cost=meta.cost(gf.lv);
    if(!this.canAfford(cost)){ toast('资源不足'); return; }
    this.pay(cost); gf.lv++;
    audio.upgrade();
    this.addLog(d.name+'将《'+meta.name+'》参悟至 '+gf.lv+' 阶');
  },
  /** 武技战斗加成聚合（委托 BattleEngine） */
  gongfaAtkBonus:function(d){ return BattleEngine.gongfaAtk(this,d); },
  /* ---------------- 战斗力 ---------------- */
  /** 弟子战斗力（委托 BattleEngine） */
  disciplePower:function(d){ return BattleEngine.disciplePower(this,d); },
  /** 胜率判定（委托 BattleEngine） */
  battleWin:function(my,ene){ return BattleEngine.battleWin(my,ene,this.state.unlock.hard); },
  /** 队伍战力（委托 BattleEngine） */
  partyPower:function(p){ return BattleEngine.partyPower(this,p); },
  /* ---------------- 任务分配 ---------------- */
  assignCultivate:function(d){ if(d.state!=='idle') return; if(d.injury.left>0){ toast('弟子受伤中'); return; } d.state='cultivate'; d.workProg=0; },
  assignAlchemy:function(d){ if(d.state!=='idle') return; if(this.state.facilities.liandan<1){ toast('炼丹房未建造'); return; } if(!this.facilityFree('liandan')){ toast('炼丹房已满'); return; } d.state='alchemy'; d.workProg=0; },
  assignForge:function(d){ if(d.state!=='idle') return; if(this.state.facilities.qishi<1){ toast('器室未建造'); return; } if(!this.facilityFree('qishi')){ toast('器室已满'); return; } d.state='forge'; d.workProg=0; },
  assignWudao:function(d){ if(d.state!=='idle') return; if(this.state.facilities.wudao<1){ toast('悟道崖未建造'); return; } if(this.state.wudaoCd>0){ toast('悟道崖冷却中'); return; } d.state='wudao'; d.workProg=0; this.state.wudaoCd=60; this.addLog(d.name+'登上悟道崖静坐参悟'); },
  stopAction:function(d){
    var names={cultivate:'修炼',alchemy:'炼丹',forge:'炼器',travel:'游历',wudao:'悟道'};
    if(names[d.state]) this.addLog(d.name+'停止了'+names[d.state]);
    d.state='idle'; d.workProg=0;
  },
  autoAssign:function(){
    var pool=this.state.disciples.filter(function(d){return d.state==='idle';});
    if(ui.selected.size) pool=pool.filter(function(d){return ui.selected.has(d.id);});
    if(!pool.length){ toast('没有可安排的弟子'); return; }
    var n=0,i,d;
    for(i=0;i<pool.length;i++){ d=pool[i];
      if(this.hasTrait(d,'danchi')&&this.facilityFree('liandan')){ this.assignAlchemy(d); n++; }
      else if(this.hasTrait(d,'jianghun')&&this.facilityFree('qishi')){ this.assignForge(d); n++; }
      else { this.assignCultivate(d); n++; } }
    toast('已安排 '+n+' 名弟子');
  },
  stopAll:function(){
    for(var i=0;i<this.state.disciples.length;i++){ var d=this.state.disciples[i]; if(d.state!=='idle'&&d.state!=='injured') this.stopAction(d); }
    this.addLog('掌门下令，全员停止当前事务');
  },
  /* ---------------- 丹药 ---------------- */
  usePill:function(d,type){
    var g=this.state;
    if(g.res.pills[type]<1){ toast('丹药不足'); return; }
    var eff=this.hasTrait(d,'danxin')?1.1:1, lp=g.liupai==='dan'?2:1, mult=eff*lp;
    var es=this.equipStats(d);
    if(type==='zhuyan'&&es.zhuyanEff) mult*=1+es.zhuyanEff;   // 彤霞词缀强化朱颜丹
    switch(type){
      case 'guyuan': { var n=Math.round((80+d.realm*60)*mult); d.exp+=n; g.res.pills.guyuan--; this.addLog(d.name+'服用固元丹，修为+'+n); break; }
      case 'peiyuan': { d.buffs.peiyuan=120; g.res.pills.peiyuan--; this.addLog(d.name+'服用培元丹，修炼加速'); break; }
      case 'ningshen': { d.breakBonus=Math.max(d.breakBonus||0,.15*mult); g.res.pills.ningshen--; this.addLog(d.name+'服用凝神丹，突破率提升'); break; }
      case 'xugudan': { if(d.injury.left<=0){ toast('弟子并未受伤'); return; } d.injury.left=0; d.injury.total=0; d.state='idle'; g.res.pills.xugudan--; this.addLog(d.name+'服用续骨丹，伤势痊愈'); break; }
      case 'zhuyan': { d.buffs.zhuyan=7200; g.res.pills.zhuyan--; this.addLog(d.name+'服用朱颜丹，修炼速度+30%（2小时）',true); break; }
    }
    audio.coin();
    toast('丹药生效');
  },
  /* ---------------- 设施/流派 ---------------- */
  upgradeFacility:function(key){
    var g=this.state,lv=g.facilities[key];
    if(lv>=this.maxLevel()){ toast('已达当前上限（底蕴可提升）'); return; }
    var cost=FAC_COST[key](lv);
    var c2=g.liupai==='zhen'?this.scaleCost(cost,.7):cost;
    if(!this.canAfford(c2)){ toast('资源不足'); return; }
    this.pay(c2);
    g.facilities[key]++;
    g.sectLv=this.calcSectLv();
    this.count('upgrade',1);
    audio.upgrade();
    this.addLog(FACILITIES[key].name+'祭炼至 '+lv+' 级');
  },
  scaleCost:function(cost,f){ var o={},k; for(k in cost) o[k]=Math.round((cost[k]||0)*f); return o; },
  chooseLiupai:function(key){
    var g=this.state;
    if(g.sectLv<3){ toast('宗门需达 3 级'); return; }
    if(g.liupai&&g.liupai!==key){ if(g.res.xianYu<20){ toast('更换流派需 20 仙玉'); return; } g.res.xianYu-=20; }
    g.liupai=key;
    audio.ascend();
    this.addLog('宗门确立流派：'+LIUPAI[key].name,true);
  },
  /* ---------------- 突破/飞升/长老/转世 ---------------- */
  breakthrough:function(d){
    var g=this.state,need=this.expNeed(d);
    if(d.exp<need){ toast('修为未满'); return; }
    if(d.injury.left>0){ toast('受伤中无法突破'); return; }
    var rate=this.breakthroughRate(d);
    d.breakBonus=0;
    if(Math.random()<rate){
      if(d.realm>=REALMS.length-1){ this.ascend(d); return; }
      var overflow=d.exp-need;
      d.realm++; d.exp=overflow*.10;
      d.wuXing=Math.min(100,d.wuXing+irand(1,2)); d.fuYuan=Math.min(100,d.fuYuan+irand(0,2));
      g.stats.breakOk++; this.count('break',1);
      audio.breakOk();
      this.addLog('道心通明：'+d.name+'突破至'+REALMS[d.realm].name+'（'+REALMS[d.realm].title+'，成功率'+Math.round(rate*100)+'%）',true);
      this.historyPush('弟子突破',d.name+'晋升'+REALMS[d.realm].name);
      this.trail('break','弟子「'+d.name+'」突破至'+REALMS[d.realm].name);
      this.addQiyuan(2,'突破');
    }else{
      var loss=.20+Math.random()*.40;
      if(this.hasTrait(d,'jingdu')) loss/=2;
      d.exp-=need*loss; if(d.exp<0) d.exp=0;
      var injChance=d.fate==='tianming'?.05:.2;
      if(this.hasTrait(d,'tiegu')) injChance/=2;
      g.stats.breakFail++;
      if(Math.random()<injChance){
        d.injury={left:300,total:300}; d.state='injured';
        audio.injury();
        this.addLog('心魔反噬：'+d.name+'突破失败受伤300秒',true);
      }else{ audio.breakFail(); this.addLog('心魔反噬，'+d.name+'突破失败，损失'+Math.round(loss*100)+'%修为'); }
    }
    this.checkTasks();
  },
  ascend:function(d){
    var g=this.state,idx=g.disciples.indexOf(d);
    if(idx<0) return;
    var sw=300+g.facilities.cangjing*50+d.realm*150, ls=2000+d.realm*600;
    this.addShengWang(sw); this.addLingShi(ls); this.addXianYu(1);
    // 血炼装备随弟子碎裂；其余回库
    for(var i=0;i<EQUIP_PARTS.length;i++){ var e=d.equipment[EQUIP_PARTS[i].key];
      if(e&&e.bloodBound){ this.addLog('血炼之器随'+d.name+'一同碎裂（'+(e.qualityName+'·'+e.base)+'）'); }
      else if(e){ g.res.equipBank.push(e); e.source=e.source||('遗宝·'+d.name); } }
    g.elders.push({name:d.name,realm:d.realm,times:(d.zhuanShi||0)+1,wuXing:d.wuXing,fuYuan:d.fuYuan});
    g.diyun+=d.realm*20;
    g.stats.ascend++; this.count('ascend',1);
    g.sectLv=this.calcSectLv();
    g.disciples.splice(idx,1);
    audio.ascend();
    this.state.musicGloryUntil=Date.now()+6000;
    this.addLog('道冲霄汉：'+d.name+'飞升仙界！转为镇派长老，声望+'+sw+'、灵石+'+ls+'、底蕴+'+d.realm*20,true);
    this.historyPush('长老飞升',d.name+'渡劫飞升，入长老堂');
    this.checkAchievements(); this.checkTasks();
  },
  zhuanShiElder:function(ei){
    var g=this.state,e=g.elders[ei];
    if(!e) return;
    var d=this.genDisciple(e.times);
    d.wuXing=Math.min(100,Math.round(e.wuXing/2)+30);
    d.fuYuan=Math.min(100,Math.round(e.fuYuan/2)+30);
    g.disciples.push(d); g.elders.splice(ei,1);
    g.stats.zhuanShi++;
    this.checkAchievements();
    audio.ascend();
    this.addLog(e.name+'转世重修，化为一世灵童「'+d.name+'」',true);
  },
  /* ---------------- 任务/成就 ---------------- */
  /** 任务进度实时计算，领取时校验；此处为兼容占位（进度由 taskProgress 实时读取） */
  checkTasks:function(){},
  count:function(key,n){ this.state.counts[key]=(this.state.counts[key]||0)+n; this.checkTasks(); },
  refreshTasks:function(force){
    var g=this.state,ds=dayStart(),ws=weekStart(),i;
    if(force||g.daily.date!==ds){
      g.daily.date=ds; g.daily.claimed=[];
      var pool=DAILY_POOL.slice(); g.daily.list=[];
      for(i=0;i<5&&pool.length;i++) g.daily.list.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
      // 婉彤专属：额外追加 2 个情侣任务（传书/灵田/签到/运势/浇水）
      if(isPartnerEmail(DB.profile.email)){
        var pp=PARTNER_DAILY_POOL.slice();
        for(var pi=0;pi<2&&pp.length;pi++) g.daily.list.push(pp.splice(Math.floor(Math.random()*pp.length),1)[0]);
      }
      g.counts={}; g.dailyEarn=0;
      g.daily.list.forEach(function(t){ g.counts[t.id]=0; });
    }
    if(force||g.weekly.date!==ws){
      g.weekly.date=ws; g.weekly.claimed=[];
      var pool2=WEEKLY_POOL.slice(); g.weekly.list=[];
      for(i=0;i<3&&pool2.length;i++) g.weekly.list.push(pool2.splice(Math.floor(Math.random()*pool2.length),1)[0]);
      g.weekly.list.forEach(function(t){ g.counts[t.id]=0; });
    }
  },
  taskProgress:function(t){
    var g=this.state,c=0;
    switch(t.id){
      case 'earn': c=g.dailyEarn; break;
      case 'shengwang': c=g.counts.shengwang||0; break;
      case 'boss2': c=g.counts.boss||0; break;
      case 'pill20': c=g.counts.pill||0; break;
      default: c=g.counts[t.id]||0;
    }
    return Math.min(c,t.target);
  },
  claimTask:function(type,idx){
    var g=this.state,box=type==='daily'?g.daily:g.weekly,t=box.list[idx];
    if(!t||box.claimed.indexOf(t.id)>=0) return;
    if(this.taskProgress(t)<t.target){ toast('任务未完成'); return; }
    box.claimed.push(t.id);
    for(var k in t.reward){
      if(k==='lingShi') this.addLingShi(t.reward[k]);
      else if(k==='shengWang') this.addShengWang(t.reward[k]);
      else if(k==='xianYu') this.addXianYu(t.reward[k]);
      else if(k==='kuangShi') this.addKuangShi(t.reward[k]);
      else this.addPill(k,t.reward[k]);
    }
    audio.coin();
    this.addLog('完成【'+t.name+'】，领取奖励');
  },
  /* ---------------- 情缘系统 ---------------- */
  addQingYuan:function(n){
    var g=this.state;
    if(this.qiLv()>=4) n=Math.round(n*1.5);   // v4.3 白首：每日情缘获取+50%
    g.qingYuan=(g.qingYuan||0)+n;
    if(g.qingYuan<0) g.qingYuan=0;
    // 里程碑
    var lv=Math.floor(g.qingYuan/100);
    if(lv>(g.qyLog||0)){
      g.qyLog=lv;
      var names=['初识','知心','同修','连理','三生'];
      var nm=names[Math.min(lv,names.length)-1];
      this.addLog('情缘进阶：同心锁升至「'+nm+'」！（情缘值 '+g.qingYuan+'）',true);
      this.historyPush('同心锁','情缘值达 '+g.qingYuan+'，同心锁「'+nm+'」点亮');
      toast('✨ 情缘进阶 · '+nm+'！');
      this.checkAchievements();
    }
  },
  qingYuanLevel:function(){
    var q=(this.state.qingYuan||0),names=['初识','知心','同修','连理','三生'];
    var lv=Math.min(names.length-1,Math.floor(q/100));
    var cur=names[lv],next=lv<names.length-1?names[lv+1]:(q%100)+'/∞';
    return {lv:lv,name:cur,next:next,progress:q%100};
  },
  /* ---------------- 默契问答 ---------------- */
  quizOfToday:function(){
    var g=this.state,today=this.todayStr();
    if(g.quizDate===today) return g.quizDateCache||null;
    // 日期种子选 3 题
    var h=0; for(var i=0;i<today.length;i++) h=(h*31+today.charCodeAt(i))>>>0;
    var pool=QUIZ_POOL.slice(),out=[];
    for(var i2=0;i2<3&&pool.length;i2++){ out.push(pool[(h+i2*7)%pool.length]); }
    g.quizDate=today; g.quizDateCache=out; g.quizAns={};
    return out;
  },
  /* ---------------- 双修（每日灵力注入） ---------------- */
  xiuInject:function(){
    var g=this.state,today=this.todayStr();
    if(g.xiuDate!==today){ g.xiuDate=today; g.xiuDone=false; }
    if(g.xiuDone){ toast('今日灵力已注入'); return; }
    g.xiuDone=true;
    this.addLog('你向同心阵注入灵力，等待道侣呼应…');
    toast('✨ 灵力已注入，等待道侣呼应');
    this.saveProfile(function(){});
    render();
  },
  xiuBothDone:function(){ var g=this.state; return g.xiuDone&&g.xiuDate===this.todayStr()&&this.otherXiuDone; },
  /** 默契问答作答 */
  quizAnswer:function(qIdx,aIdx){
    var g=this.state,quiz=this.quizOfToday();
    if(!g.quizAns) g.quizAns={};
    if(!g.quizCorrect) g.quizCorrect=0;
    if(!quiz||qIdx<0||qIdx>=quiz.length) return;
    var item=quiz[qIdx];
    if(g.quizAns[qIdx]!==undefined){ toast('这题已答过啦'); return; }
    g.quizAns[qIdx]=aIdx;
    if(aIdx===item.ans){
      g.quizCorrect=(g.quizCorrect||0)+1;
      this.addQingYuan(5);
      g.res.lingShi+=200;
      this.addLog('默契问答答对：「'+item.q+'」情缘+5，灵石+200',true);
      toast('✨ 心有灵犀！答对了');
      if(audio.gift) audio.gift();
    } else {
      this.addLog('默契问答答错：「'+item.q+'」正确答案：'+item.opts[item.ans]);
      toast('再想想？正确答案是「'+item.opts[item.ans]+'」');
    }
    this.saveProfile(function(){});
    this.checkAchievements();
    render();
  },
  /* ---------------- 节日与许愿 ---------------- */
  festivalOf:function(){
    var md=this.todayMMDD(), full=this.todayStr();
    /* v5.6 农历节日公历映射表（2026-2027，覆盖到明年后需续表） */
    var MAP={
      '2026-09-25':{name:'中秋 · 月圆夜',emoji:'🌕',note:'海上生明月，天涯共此时——广寒仙子特赐月饼礼盒',double:true,gift:'moon2026'},
      '2026-10-01':{name:'国庆 · 家国同庆',emoji:'🇨🇳',note:'山河无恙，人间皆安——宗门特备国庆礼盒',double:true,gift:'guoqing2026'},
      '2027-02-06':{name:'春节 · 开岁朝贺',emoji:'🧨',note:'爆竹声中一岁除，仙门贺岁',double:true},
      '2027-02-20':{name:'上元 · 花灯节',emoji:'🏮',note:'花灯如昼，人间共赏',double:true},
      '2027-06-09':{name:'端午 · 龙舟渡',emoji:'🚣',note:'粽叶飘香，邪祟不侵',double:true},
      '2027-08-08':{name:'七夕 · 鹊桥会',emoji:'🌙',note:'牛郎织女相会之日，愿有情人终成眷属',double:true},
      '2027-09-15':{name:'中秋 · 月圆夜',emoji:'🌕',note:'海上生明月，天涯共此时',double:true}
    };
    if(MAP[full]) return MAP[full];
    /* 兼容：七夕按公历近似保留 */
    if(md==='07-07') return {name:'七夕 · 鹊桥会',emoji:'🌙',note:'牛郎织女相会之日，愿有情人终成眷属',double:true};
    return null;
  },
  /* v5.6 下一个节日倒计时 */
  nextFestival:function(){
    var MAP={
      '2026-09-25':{name:'中秋 · 月圆夜',emoji:'🌕'},
      '2026-10-01':{name:'国庆 · 家国同庆',emoji:'🇨🇳'},
      '2027-02-06':{name:'春节 · 开岁朝贺',emoji:'🧨'},
      '2027-02-20':{name:'上元 · 花灯节',emoji:'🏮'},
      '2027-06-09':{name:'端午 · 龙舟渡',emoji:'🚣'},
      '2027-08-08':{name:'七夕 · 鹊桥会',emoji:'🌙'},
      '2027-09-15':{name:'中秋 · 月圆夜',emoji:'🌕'}
    };
    var today=this.todayStr(), best=null;
    for(var k in MAP){ if(k>=today && (!best || k<best)) best=k; }
    if(!best) return null;
    var days=Math.ceil((new Date(best+'T00:00:00')-new Date(today+'T00:00:00'))/86400000);
    return {date:best, name:MAP[best].name, emoji:MAP[best].emoji, days:days};
  },
  todayMMDD:function(){ var d=new Date(),p=function(n){return ('0'+n).slice(-2);}; return p(d.getMonth()+1)+'-'+p(d.getDate()); },
  /** 在一起天数（自建宗起） */
  daysTogether:function(){
    var t=(this.state&&this.state.createdAt)||Date.now();
    return Math.max(0,Math.floor((Date.now()-t)/86400000))+1;
  },
  /** 成长树年轮：每 100 天一片新叶 */
  treeLeafCount:function(){ return Math.floor(this.daysTogether()/100); },
  /** 许愿（流星夜专属） */
  makeWish:function(text){
    var g=this.state;
    g.wish=text; g.wishDate=this.todayStr();
    this.addQingYuan(5);
    g.res.lingShi+=300;
    this.addLog('🌠 流星夜许愿：「'+text+'」情缘+5，灵石+300',true);
    this.historyPush('流星许愿','于流星夜许下心愿：「'+text+'」');
    this.trail('wish','于流星夜许愿：「'+text+'」');
    this.addQiyuan(3,'许愿');
    toast('🌠 愿望已寄往星河');
    this.saveProfile(function(){});
    this.checkAchievements();
    render();
  },

  /** 双修结算（双方都注入时） */
  xiuSettle:function(){
    var g=this.state;
    if(!this.xiuBothDone()||g.xiuSettled) return;
    g.xiuSettled=true;
    this.addQingYuan(10);
    g.res.lingShi+=500; g.res.xianYu=(g.res.xianYu||0)+1;
    this.addLog('✨ 双修圆满：同心阵灵光大盛！情缘+10，灵石+500，仙玉+1',true);
    this.historyPush('双修','与道侣同心双修，情缘+10');
    toast('💫 双修圆满！');
    this.saveProfile(function(){});
    this.checkAchievements();
    render();
  },

  /** 保存档案（委托 DB 层） */
  saveProfile:function(cb){ DB.saveProfile(cb||function(){}); },
  checkAchievements:function(){
    var g=this.state,i;
    for(i=0;i<ACHIEVEMENTS.length;i++){ var a=ACHIEVEMENTS[i];
      if(g.achievements[a.id]) continue;
      if(a.cond(g)){
        g.achievements[a.id]=true;
        for(var k in a.reward){ if(k==='xianYu') this.addXianYu(a.reward[k]); else if(k==='lingShi') this.addLingShi(a.reward[k]); else if(k==='shengWang') this.addShengWang(a.reward[k]); }
        audio.ascend();
        this.addLog('达成成就【'+a.name+'】'+(a.couple?'（神仙眷侣）':''),true);
        if(a.couple) this.historyPush('佳偶天成','达成双人成就【'+a.name+'】');
      }
    }
  },
  /* ---------------- 气运重聚 ---------------- */
  zhongsheng:function(){
    var g=this.state;
    if(g.sectLv<3){ toast('宗门等级需达 3 级'); return; }
    var highest=0,i;
    for(i=0;i<g.disciples.length;i++) if(g.disciples[i].realm>highest) highest=g.disciples[i].realm;
    var qi=5+g.stats.ascend*2+g.stats.annihilate*3+g.stats.bossKill+highest+g.elders.length;
    var self=this;
    showConfirm('气运重聚','将重置弟子、设施与资源（保留：仙玉、成就、底蕴、流派、气运增益）。本轮气运点数：'+qi+'。确定开启新轮回吗？',function(){
      var keep={xianYu:g.res.xianYu,diyun:g.diyun,achievements:g.achievements,unlock:g.unlock,liupai:g.liupai,qiYun:g.qiYun+qi,stats:g.stats};
      g.stats.zhongsheng++;
      var st=self.newGame(g.sectName,g.masterTitle,g.motto);
      st.res.xianYu=keep.xianYu; st.diyun=keep.diyun; st.achievements=keep.achievements;
      st.unlock=keep.unlock; st.liupai=keep.liupai; st.qiYun=keep.qiYun; st.stats=keep.stats;
      if(st.unlock.facilityBase){ for(var k in st.facilities) if(st.facilities[k]<1) st.facilities[k]=1; }
      self.state=st; self.lastTick=Date.now();
      self.state.profileId=DB.profile.id;   // 修复：转生后保留玩家身份（双人互动/收礼依赖）
      audio.ascend();
      self.addLog('气运重聚完成！宗门在废墟中重生，气运+'+qi,true);
      self.checkAchievements();
    });
  },
  buyQiYun:function(id){
    var g=this.state,item=null,i;
    for(i=0;i<QIYUN_SHOP.length;i++) if(QIYUN_SHOP[i].id===id){ item=QIYUN_SHOP[i]; break; }
    if(!item) return;
    if(g.qiYun<item.cost){ toast('气运点不足'); return; }
    if(item.once&&g.unlock[id]){ toast('已兑换'); return; }
    g.qiYun-=item.cost;
    item.apply(this);
    if(item.once) g.unlock[id]=true;
    audio.upgrade();
    this.addLog('兑换气运增益：【'+item.name+'】');
  },
  hasIdle:function(){ return this.state.disciples.some(function(d){return d.state==='idle';}); },
  randomIdle:function(){ var p=this.state.disciples.filter(function(d){return d.state==='idle';}); return p.length?pick(p):null; },
  bestIdle:function(){
    var p=this.state.disciples.filter(function(d){return d.state==='idle';});
    if(!p.length) return null;
    p.sort(function(a,b){ return this.disciplePower(b)-this.disciplePower(a); }.bind(this));
    return p[0];
  },
  eventChoose:function(idx){
    var ev=ui.curEvent;
    if(!ev) return;
    var o=ev.options[idx];
    if(o.needIdle&&!this.hasIdle()) return;
    if(o.need&&!o.need(this)) return;
    closeModal();
    o.effect(this);
  },

  /* ---------------- 游历组队 ---------------- */
  createParty:function(regionId,memberIds,formation){
    var g=this.state,i;
    if(memberIds.length<1||memberIds.length>3){ toast('需选 1-3 名弟子'); return; }
    for(i=0;i<memberIds.length;i++){ var d=this.findDisciple(memberIds[i]); if(!d||d.state!=='idle'){ toast('存在不可派遣的弟子'); return; } }
    var region=null; for(i=0;i<REGIONS.length;i++) if(REGIONS[i].id===regionId){ region=REGIONS[i]; break; }
    if(!region) return;
    var maxR=0; for(i=0;i<g.disciples.length;i++) if(g.disciples[i].realm>maxR) maxR=g.disciples[i].realm;
    if(maxR<region.unlock){ toast('境界不足'); return; }
    var nodes=[],types=['battle','battle','battle','chest','trader','trap','wonder'];
    for(i=0;i<3;i++) nodes.push(pick(types));
    nodes.push('boss');
    var p={id:'p'+Date.now(),region:regionId,members:memberIds,formation:formation,nodes:nodes,nodeIdx:0,timer:region.dur,state:'march',power:0};
    p.power=this.partyPower(p);
    for(i=0;i<memberIds.length;i++){ var d2=this.findDisciple(memberIds[i]); if(d2) d2.state='travel'; }
    g.parties.push(p);
    audio.travelGo();
    this.addLog('队伍出发探索【'+region.name+'】（'+memberIds.length+'人·'+FORMATIONS[formation].name+'）');
    this.addTravelLog('【'+region.name+'】队伍启程，战力 '+p.power);
    // 念恩峰：情侣组队特殊事件
    if(region.special==='nianen'&&g.alliance){ this.addTravelLog('【念恩峰】和合石前，道侣同游，天地为证'); }
  },
  advanceParty:function(p,dt){
    var region=null,i;
    for(i=0;i<REGIONS.length;i++) if(REGIONS[i].id===p.region){ region=REGIONS[i]; break; }
    p.timer-=dt;
    if(p.timer>0) return;
    p.timer=region?region.dur:35;
    if(p.nodeIdx>=p.nodes.length){ this.finishParty(p,true); return; }
    var type=p.nodes[p.nodeIdx];
    if(type==='boss'){ p.state='boss'; this.bossBattle(p); }
    else { p.state='event'; this.nodeEvent(p,type); }
  },
  nodeEvent:function(p,type,auto){
    var region=null,i;
    for(i=0;i<REGIONS.length;i++) if(REGIONS[i].id===p.region){ region=REGIONS[i]; break; }
    var my=p.power;
    if(type==='battle'){
      var ene=irand(region.power[0],region.power[1]);
      p.cur={type:'battle',ene:ene};
      if(!ui.modal&&!auto){
        audio.event();
        showModal('<h2>遭遇战</h2><div class="mdesc">队伍在【'+region.name+'】遭遇妖兽（战力 '+ene+'）<br>我方战力 '+my+'</div><div class="close-row"><button class="btn gold" data-act="nodeChoice" data-choice="fight">迎战</button><button class="btn ghost" data-act="nodeChoice" data-choice="flee">撤退</button></div>');
      } else this.autoNode(p,'fight');
    }else if(type==='chest'){
      var gains=this.chestGain(p);
      if(!ui.modal&&!auto){ audio.coin(); showModal('<h2>宝箱</h2><div class="mdesc">队伍发现一只尘封宝箱，获得：'+gains.join('、')+'</div><div class="close-row"><button class="btn gold" data-act="nodeChoice" data-choice="ok">收下</button></div>'); }
      this.addTravelLog('【'+region.name+'】开启宝箱：'+gains.join('、'));
    }else if(type==='trader'){
      var cost=Math.round(200*(1+p.nodeIdx*.5)),gain=irand(60,140);
      p.cur={type:'trader',cost:cost,gain:gain};
      if(!ui.modal&&!auto){ audio.coin(); showModal('<h2>云游商人</h2><div class="mdesc">商人愿以 '+cost+' 灵石出售矿石（'+gain+'）</div><div class="close-row"><button class="btn gold" data-act="nodeChoice" data-choice="buy">购买</button><button class="btn ghost" data-act="nodeChoice" data-choice="pass">不买</button></div>'); }
      else this.autoNode(p,'pass');
    }else if(type==='trap'){
      var danger=Math.random()<.55;
      if(!ui.modal&&!auto){ audio.injury(); showModal('<h2>陷阱</h2><div class="mdesc">前方瘴气弥漫、机关暗布'+(danger?'，队伍中招受伤！':'，队伍小心避过')+'</div><div class="close-row"><button class="btn" data-act="nodeChoice" data-choice="ok">继续</button></div>'); }
      if(danger){ for(i=0;i<p.members.length;i++){ var d=this.findDisciple(p.members[i]); if(d){ d.injury={left:irand(120,240),total:240}; d.state='injured'; } } this.addTravelLog('【'+region.name+'】误中陷阱，全员受伤'); }
      else this.addTravelLog('【'+region.name+'】队伍机警避过陷阱');
    }else if(type==='wonder'){
      var gains2=this.wonderGain(p);
      if(!ui.modal&&!auto){ audio.event(); showModal('<h2>奇遇</h2><div class="mdesc">队伍遇上机缘，获得：'+gains2.join('、')+'</div><div class="close-row"><button class="btn gold" data-act="nodeChoice" data-choice="ok">收下</button></div>'); }
      this.addTravelLog('【'+region.name+'】奇遇：'+gains2.join('、'));
    }
    // 红娘仙姑：彤云谷/念恩峰概率触发
    if((region.special==='tongyun'||region.special==='nianen')&&Math.random()<.12&&!p._hongniang){
      p._hongniang=true;
      this.hongniangEncounter(p);
    }
    if(auto||!ui.modal) this.advanceNode(p);
  },
  /** 红娘仙姑奇遇 */
  hongniangEncounter:function(p){
    var line=pick(HONGNIANG_LINES);
    var self=this;
    if(!ui.modal){
      audio.event();
      showModal('<h2>红娘仙姑</h2><div class="mdesc">一位仙姑拦住队伍：<br>「'+line+'」</div><div class="close-row"><button class="btn gold" data-act="nodeChoice" data-choice="ok">聆听仙缘</button></div>');
    }
    this.addLog('红娘仙姑：「'+line+'」',true);
    // 隐藏任务「情比金坚」：奖励一念永恒（双方双倍修炼24小时）
    if(!this.state.stats.hongniang){
      this.state.stats.hongniang=true;
      this.state.buffs.push({id:'ynyh',label:'一念永恒',type:'cult',mult:1,left:86400});
      this.addLog('红娘仙姑赠予【一念永恒】：24小时内双方修炼速度翻倍！',true);
      this.historyPush('仙缘',CONFIG.DEVELOPER_NAME+'与'+CONFIG.PARTNER_NAME+'之宗门得红娘仙姑赐福');
    }
  },
  chestGain:function(p){
    var d=this.findDisciple(p.members[0]),lucky=d?d.fuYuan:50;
    var es=d?this.equipStats(d):{}; if(es.chest) lucky+=30;
    var gains=[];
    if(Math.random()<.4){ var n=irand(100,300)+Math.round(lucky); this.addLingShi(n); gains.push('灵石+'+n); }
    if(Math.random()<.3){ var n=irand(5,15); this.addKuangShi(n); gains.push('矿石+'+n); }
    if(Math.random()<.2){ this.addPill('guyuan',2); gains.push('固元丹×2'); }
    if(Math.random()<.12){ var e=this.genEquip(pick(EQUIP_PARTS).key,1,null,'游历宝箱'); this.state.res.equipBank.push(e); gains.push(e.qualityName+'·'+e.base); }
    if(!gains.length){ this.addShengWang(30); gains.push('声望+30'); }
    // 彤云谷特产：朱颜花
    if(p.region==='tongyun'&&Math.random()<.35){ this.addZhuyan(1); gains.push('朱颜花×1'); }
    return gains;
  },
  wonderGain:function(p){
    var gains=[];
    var r=Math.random();
    if(r<.3){ var sw=irand(40,120); this.addShengWang(sw); gains.push('声望+'+sw); }
    else if(r<.5){ var jn=pick(['fenhuang','wanmu','xingchen']); this.addJuan(jn,1); gains.push(this.juanName(jn)+'残卷×1'); }
    else if(r<.75){ this.addXianYu(1); gains.push('仙玉+1'); }
    else { var e=this.genEquip(pick(EQUIP_PARTS).key,2,null,'游历奇遇'); this.state.res.equipBank.push(e); gains.push(e.qualityName+'·'+e.base); }
    return gains;
  },
  juanName:function(jn){ return jn==='fenhuang'?'焚天诀':jn==='wanmu'?'万木逢春':'星辰诀'; },
  nodeChoose:function(choice){
    var p=null,i;
    for(i=0;i<this.state.parties.length;i++) if(this.state.parties[i].state==='event'||this.state.parties[i].state==='boss'){ p=this.state.parties[i]; break; }
    if(!p) return;
    closeModal();
    if(p.state==='boss'){ if(choice==='fight') this.bossBattle(p,true); else { this.addTravelLog('队伍在首领前撤退'); this.finishParty(p,false); } return; }
    var cur=p.cur||{},region=null;
    for(i=0;i<REGIONS.length;i++) if(REGIONS[i].id===p.region){ region=REGIONS[i]; break; }
    if(cur.type==='battle'){
      if(choice==='fight'){
        if(this.battleWin(p.power,cur.ene)){
          var ls=irand(80,240),ks=irand(5,15);
          this.addLingShi(ls); this.addKuangShi(ks);
          this.addTravelLog('【'+region.name+'】战胜妖兽：灵石+'+ls+'、矿石+'+ks);
        }else{
          for(i=0;i<p.members.length;i++){ var d=this.findDisciple(p.members[i]); if(d){ d.injury={left:irand(180,300),total:300}; d.state='injured'; } }
          this.addTravelLog('【'+region.name+'】不敌妖兽，全员受伤！');
        }
      }else this.addTravelLog('队伍避开了妖兽');
    }else if(cur.type==='trader'){
      if(choice==='buy'&&this.state.res.lingShi>=cur.cost){ this.state.res.lingShi-=cur.cost; this.addKuangShi(cur.gain); this.addTravelLog('商人交易：矿石+'+cur.gain); }
      else this.addTravelLog('队伍未与商人交易');
    }
    this.advanceNode(p);
  },
  autoNode:function(p,choice){ this.nodeChoose(choice); },
  advanceNode:function(p){
    p.nodeIdx++;
    p.state='march';
    var region=null,i;
    for(i=0;i<REGIONS.length;i++) if(REGIONS[i].id===p.region){ region=REGIONS[i]; break; }
    p.timer=region?region.dur:35;
    if(p.nodeIdx>=p.nodes.length) this.finishParty(p,true);
  },
  bossBattle:function(p,manual){
    var region=null,i;
    for(i=0;i<REGIONS.length;i++) if(REGIONS[i].id===p.region){ region=REGIONS[i]; break; }
    var my=p.power,ene=region.bossPower;
    if(!manual){
      if(!ui.modal){
        audio.event();
        showModal('<h2>首领 · '+region.name+'之主</h2><div class="mdesc">首领战力 '+ene+'，我方 '+my+'</div><div class="close-row"><button class="btn gold" data-act="nodeChoice" data-choice="fight">发起挑战</button><button class="btn ghost" data-act="nodeChoice" data-choice="flee">撤退</button></div>');
      }else{ this.finishParty(p,false); }
      return;
    }
    if(this.battleWin(my,ene)){
      var g=this.state,sp=region.bossDrop.split('-');
      var e=this.genEquip(sp[1],4,sp[0],'【'+region.name+'】首领');
      g.res.equipBank.push(e);
      var sw=irand(150,400);
      this.addShengWang(sw);
      if(Math.random()<.5){ this.addJuan(pick(['fenhuang','wanmu','xingchen']),1); }
      g.stats.bossKill++; this.count('boss',1);
      if(Math.random()<.3) this.addXianYu(1);
      region._cd=(region._cd||0)+region.bossCool;
      g.sectLv=this.calcSectLv();
      audio.ascend();
      this.addLog('队伍击败【'+region.name+'】首领！获得 '+e.qualityName+'·'+e.base+'、声望+'+sw,true);
      this.addTravelLog('【'+region.name+'】首领战大捷！');
      this.checkTasks(); this.checkAchievements();
      this.finishParty(p,true);
    }else{
      for(i=0;i<p.members.length;i++){ var d=this.findDisciple(p.members[i]); if(d){ d.injury={left:irand(300,600),total:600}; d.state='injured'; } }
      this.addTravelLog('【'+region.name+'】首领战败北，全员重伤！');
      audio.injury();
      this.finishParty(p,false);
    }
  },
  finishParty:function(p,win){
    var g=this.state,idx=g.parties.indexOf(p);
    if(idx<0) return;
    for(var i=0;i<p.members.length;i++){ var d=this.findDisciple(p.members[i]); if(d&&d.state==='travel'){ d.state='idle'; d.travelTask=null; d.travelLeft=0; } }
    g.parties.splice(idx,1);
    this.count('travel',1);
    audio.travelBack();
    if(win) this.addLog(SYSTEM_MSGS.travelBack+'：队伍结束探索，凯旋而归');
  },
  /* ---------------- 双人 Boss（结盟后） ---------------- */
  duoBoss:function(){
    var g=this.state;
    if(!g.alliance){ toast('需先与'+CONFIG.PARTNER_NAME+'结盟'); return; }
    var idle=g.disciples.filter(function(d){return d.state==='idle';}).sort(function(a,b){ return b.realm-a.realm; });
    if(!idle.length){ toast('没有空闲弟子'); return; }
    var members=idle.slice(0,3).map(function(d){return d.id;});
    var my=0,i;
    for(i=0;i<members.length;i++) my+=this.disciplePower(this.findDisciple(members[i]));
    var ene=Math.round(8000*(1+this.otherSectLv*.3));
    var self=this;
    for(i=0;i<members.length;i++){ var d=this.findDisciple(members[i]); if(d) d.state='travel'; }
    if(this.battleWin(my,ene)){
      g.stats.duoBossKill++;
      var qm=this.qiLv()>=1?1.2:1;   // v4.3 相知：双人秘境奖励+20%
      var ls=Math.round(ene*1.2*qm),sw=Math.round(irand(200,500)*qm),jy=Math.random()<.5?1:0;
      this.addLingShi(ls); this.addShengWang(sw); if(jy) this.addXianYu(1);
      if(Math.random()<.4){ var e=this.genEquip('shishi',2,'tongxia','双人秘境首领'); g.res.equipBank.push(e); }
      audio.ascend();
      this.addLog('与'+CONFIG.PARTNER_NAME+'并肩击破双人秘境！灵石+'+ls+'、声望+'+sw+(jy?'、仙玉+1':''),true);
      this.checkAchievements();
      this.historyPush('比翼双飞','双人秘境告破，'+CONFIG.DEVELOPER_NAME+'与'+CONFIG.PARTNER_NAME+'之宗门同心协力');
      this.trail('boss','与'+CONFIG.PARTNER_NAME+'并肩击破双人秘境');
      this.addQiyuan(5,'双人秘境');
    }else{
      for(i=0;i<members.length;i++){ var d2=this.findDisciple(members[i]); if(d2){ d2.injury={left:600,total:600}; d2.state='injured'; } }
      audio.injury();
      this.addLog('双人秘境挑战失败，弟子重伤',true);
    }
    for(i=0;i<members.length;i++){ var d3=this.findDisciple(members[i]); if(d3&&d3.state==='travel') d3.state='idle'; }
    this.checkTasks();
  },
  /* ---------------- NPC 宗门与世界引擎 ---------------- */
  relRank:function(rel){ return rel>=80?'盟友':rel>=60?'友善':rel>=25?'中立':'敌对'; },
  npcTrade:function(id){
    var g=this.state,n=null,i;
    for(i=0;i<g.npcs.length;i++) if(g.npcs[i].id===id){ n=g.npcs[i]; break; }
    if(!n||n.annihilated) return;
    if(n.cd>0){ toast('该宗门尚在休整'); return; }
    var t={'lieyan':{cost:300,item:'kuangShi',n:25,name:'矿石×25'},'shuiyue':{cost:250,item:'guyuan',n:5,name:'固元丹×5'},
      'tianjian':{cost:500,item:'juanF',n:1,name:'焚天诀残卷×1'},'wangu':{cost:400,item:'ningshen',n:2,name:'凝神丹×2'},
      'taiyi':{cost:800,item:'mixed',n:0,name:'灵兽材料×10+矿石×10'},'youming':{cost:0,item:null,n:0,name:'幽冥殿不屑贸易'}}[id];
    if(!t.item){ toast(t.name); return; }
    if(g.res.lingShi<t.cost){ toast('灵石不足'); return; }
    g.res.lingShi-=t.cost; n.cd=600;
    if(t.item==='kuangShi') this.addKuangShi(t.n);
    else if(t.item==='guyuan') this.addPill('guyuan',t.n);
    else if(t.item==='juanF') this.addJuan('fenhuang',1);
    else if(t.item==='ningshen') this.addPill('ningshen',t.n);
    else { this.addBeast(10); this.addKuangShi(10); }
    // 结盟后贸易计数（双人成就）
    if(g.alliance){ g.stats.allianceTrades++; this.checkAchievements(); }
    audio.coin();
    this.addLog('与'+n.name+'完成贸易，获得'+t.name);
  },
  npcAlly:function(id){
    var g=this.state,n=null,i;
    for(i=0;i<g.npcs.length;i++) if(g.npcs[i].id===id){ n=g.npcs[i]; break; }
    if(!n||n.annihilated) return;
    if(n.rel<60){ toast('关系不足 60'); return; }
    if(g.res.shengWang<200){ toast('声望不足'); return; }
    g.res.shengWang-=200; n.rel=Math.min(100,n.rel+20);
    audio.recruit();
    this.addLog('与'+n.name+'缔结盟约',true);
  },
  npcWar:function(id){
    var g=this.state,n=null,i;
    for(i=0;i<g.npcs.length;i++) if(g.npcs[i].id===id){ n=g.npcs[i]; break; }
    if(!n||n.annihilated) return;
    var idle=g.disciples.filter(function(d){return d.state==='idle';}).sort(function(a,b){ return b.realm-a.realm; });
    if(!idle.length){ toast('没有空闲弟子'); return; }
    var members=idle.slice(0,3).map(function(d){return d.id;});
    var my=0;
    for(i=0;i<members.length;i++) my+=this.disciplePower(this.findDisciple(members[i]));
    var self=this;
    showConfirm('讨伐【'+n.name+'】','敌方战力 '+n.power+'，我方出战战力 '+my+(my>n.power*1.5?'（实力碾压，可灭门！）':'')+'\n\n胜利：掠夺资源+声望；失败：弟子重伤。是否宣战？',function(){
      for(i=0;i<members.length;i++){ var d=this.findDisciple(members[i]); if(d) d.state='travel'; }
      if(self.battleWin(my,n.power)){
        var ls=Math.round(n.power*1.5),sw=irand(100,300);
        self.addLingShi(ls); self.addShengWang(sw);
        g.stats.warWin++; self.count('warwin',1);
        n.rel=Math.max(0,n.rel-30);
        var extra='';
        if(my>n.power*3){ n.annihilated=true; g.stats.annihilate++; extra='！宗门覆灭（灭门+1）'; self.addXianYu(3); }
        audio.ascend();
        self.addLog('讨伐'+n.name+'大胜！掠夺灵石+'+ls+'、声望+'+sw+extra,true);
        self.historyPush('扬威',self.state.sectName+'讨平'+n.name);
      }else{
        for(i=0;i<members.length;i++){ var d2=this.findDisciple(members[i]); if(d2){ d2.injury={left:600,total:600}; d2.state='injured'; } }
        self.addShengWang(-50); n.rel=Math.max(0,n.rel-10);
        audio.injury();
        self.addLog('讨伐'+n.name+'失败，弟子重伤，声望-50',true);
      }
      self.checkTasks(); self.checkAchievements();
    });
  },
  npcAttack:function(){
    var g=this.state,alive=g.npcs.filter(function(n){return !n.annihilated&&n.rel<70;});
    if(!alive.length) return;
    var n=pick(alive);
    var def=g.facilities.dazhen*2000*(g.liupai==='zhen'?3:1);
    var atk=n.power*(g.liupai==='zhen'?.8:1);
    var allies=g.npcs.filter(function(x){return x.rel>=80&&!x.annihilated;}).length;
    if(allies) atk*=(1-.1*allies);
    var self=this;
    if(!ui.modal){
      audio.warp();
      showModal('<h2>'+n.name+'来袭！</h2><div class="mdesc">'+n.name+'率众攻打山门！<br>护山大阵战力 '+def+'，敌方战力 '+atk+'</div><div class="close-row"><button class="btn gold" data-act="defendDone" data-win="'+(def>atk?1:0)+'" data-npc="'+n.id+'">应战</button></div>');
    }else this.defendResolve(n,def>atk);
  },
  defendResolve:function(n,win){
    var g=this.state;
    if(win){
      var sw=irand(60,150),ls=irand(200,500);
      this.addShengWang(sw); this.addLingShi(ls);
      this.addLog('护山大阵击退'+n.name+'！声望+'+sw+'、灵石+'+ls,true);
    }else{
      var loss=Math.round(g.res.lingShi*.1);
      g.res.lingShi=Math.max(0,g.res.lingShi-loss);
      this.addLog(n.name+'攻破大阵，损失灵石'+loss,true);
    }
    n.rel=Math.max(0,n.rel-5);
  },
  /** 修真界简报（离线世界模拟） */
  worldBrief:function(){
    var g=this.state,news=[];
    var pool=g.npcs.filter(function(n){return !n.annihilated;});
    var n1=pick(pool),n2=pick(pool);
    if(n1&&n2&&n1.id!==n2.id){
      var t=Math.random();
      if(t<.4) news.push('修真界传闻：'+n1.name+'与'+n2.name+'因矿脉之争交恶');
      else if(t<.7) news.push('修真界传闻：'+n1.name+'近日广收门徒，势力渐长');
      else news.push('修真界传闻：'+n2.name+'宣布封山闭门，暂不问世事');
    }
    if(Math.random()<.5) news.push('修真界传闻：魔界裂缝又见异动，各派人心惶惶');
    if(Math.random()<.3) news.push('修真界传闻：有人目睹'+CONFIG.DEVELOPER_NAME+'真人与'+CONFIG.PARTNER_NAME+'仙子并肩游历彤云谷');
    for(var i=0;i<news.length;i++){ this.addLog('修真界简报：'+news[i],true); this.addTravelLog('简报：'+news[i]); }
  },
  /* ---------------- 业力 ---------------- */
  /** 业力调整：正=功德，负=杀业 */
  addKarma:function(n){
    this.state.karma+=n;
    if(n>0) this.addLog('行善积德，功德+'+n,true);
    else this.addLog('杀业缠身，业力'+n,true);
    this.historyPush(n>0?'功德':'杀业','宗门业力'+(this.state.karma>0?'（功德'+this.state.karma+'）':'（杀业'+(-this.state.karma)+'）'));
  },
  /* ---------------- 炼妖塔/悟道 ---------------- */
  towerChallenge:function(){
    var g=this.state;
    if(g.tower.cd>0){ toast('冷却中'); return; }
    if(g.facilities.yaotao<1){ toast('炼妖塔未建造'); return; }
    var lv=g.tower.lv+1,maxLv=5+g.facilities.yaotao;
    if(lv>maxLv){ toast('已达挑战上限'); return; }
    var idle=g.disciples.filter(function(d){return d.state==='idle';}).sort(function(a,b){ return b.realm-a.realm; });
    if(!idle.length){ toast('没有空闲弟子'); return; }
    var members=idle.slice(0,3).map(function(d){return d.id;});
    var my=0,i;
    for(i=0;i<members.length;i++) my+=this.disciplePower(this.findDisciple(members[i]));
    var ene=500*Math.pow(1.7,lv);
    for(i=0;i<members.length;i++){ var d=this.findDisciple(members[i]); if(d) d.state='travel'; }
    g.tower.cd=60;
    if(this.battleWin(my,ene)){
      g.tower.lv=lv; g.stats.towerLv=lv; this.count('tower',1);
      var ks=irand(10,20)+lv*2,sw=irand(30,80)+lv*10;
      this.addKuangShi(ks); this.addShengWang(sw);
      if(Math.random()<.4) this.addJuan(pick(['fenhuang','wanmu','xingchen']),1);
      audio.ascend();
      this.addLog('炼妖塔第 '+lv+' 层攻克！矿石+'+ks+'、声望+'+sw,true);
      this.trail('tower','炼妖塔攻克第 '+lv+' 层');
    }else{
      for(i=0;i<members.length;i++){ var d2=this.findDisciple(members[i]); if(d2){ d2.injury={left:300,total:300}; d2.state='injured'; } }
      audio.injury();
      this.addLog('炼妖塔第 '+lv+' 层挑战失败',true);
    }
    for(i=0;i<members.length;i++){ var d3=this.findDisciple(members[i]); if(d3&&d3.state==='travel') d3.state='idle'; }
    this.checkTasks();
  },
  finishWudao:function(d){
    var g=this.state,bonus=1+g.facilities.wudao*.10;
    if(Math.random()<.15*bonus){ this.addJuan(pick(['fenhuang','wanmu','xingchen']),1); this.addLog(d.name+'于悟道崖顿悟，悟出功法残卷！',true); }
    else{ var n=Math.round(irand(1,2)*bonus); d.wuXing=Math.min(100,d.wuXing+n); this.addLog(d.name+'于悟道崖参悟，悟性+'+n); }
    d.state='idle';
  },
  /* ---------------- 双人互动 ---------------- */
  /** 发起赠礼（情感化日志） */
  sendGift:function(type,amount,note){
    var g=this.state,self=this;
    if(!g.alliance){ toast('需先结盟'); return; }
    if(type==='lingShi'&&g.res.lingShi<amount){ toast('灵石不足'); return; }
    if(type==='guyuan'&&g.res.pills.guyuan<amount){ toast('丹药不足'); return; }
    if(type==='lingShi') g.res.lingShi-=amount; else if(type==='guyuan') g.res.pills.guyuan-=amount;
    var noteTxt=note||pick(['修炼别太累了，记得吃饭','愿这心意随灵气抵达你身边','此物虽轻，情意万钧','等闲变却故人心，却道故人心易变']);
    DB.loadPartnerProfile(function(partner){
      if(!partner){ toast('对方宗门不存在'); return; }
      DB.sendInteraction(partner.id,'gift',{type:type,amount:amount,note:noteTxt},function(){
        self.addLog(CONFIG.PARTNER_NAME+'赠你'+(type==='lingShi'?'灵石'+amount:type==='guyuan'?'固元丹'+amount+'枚':'')+'，附言：'+noteTxt+'',true);
        self.addLog('你赠予'+CONFIG.PARTNER_NAME+(type==='lingShi'?'灵石'+amount:type==='guyuan'?'固元丹'+amount+'枚':'')+'，附言：'+noteTxt);
        self.trail('gift','赠予'+CONFIG.PARTNER_NAME+(type==='lingShi'?'灵石'+amount:type==='guyuan'?'固元丹'+amount+'枚':''));
        self.addQiyuan(2,'赠礼');
      });
    });
  },
  /** 发起切磋（模拟战斗，胜方获声望） */
  sendSpar:function(){
    var g=this.state,self=this;
    if(!g.alliance){ toast('需先结盟'); return; }
    var my=g.disciples.length?Math.max.apply(null,g.disciples.map(function(d){return self.disciplePower(d);})):0;
    if(!my){ toast('无弟子'); return; }
    DB.loadPartnerProfile(function(partner){
      if(!partner){ toast('对方宗门不存在'); return; }
      DB.sendInteraction(partner.id,'spar',{power:my},function(){});
      // 本地即时模拟结果（对方战力按炼气基准 60/人估算，与弟子战力基数一致）
      var partnerPower=(partner.disciples&&partner.disciples.length)?partner.disciples.length*60:180;
      var win=my>partnerPower;
      if(win){ self.addShengWang(60); self.addLog('与'+CONFIG.PARTNER_NAME+'切磋论道，情意绵绵，旁观弟子纷纷表示学到了（胜）',true); }
      else self.addLog('与'+CONFIG.PARTNER_NAME+'切磋论道，点到即止（负）');
      self.addLog('切磋结果：我方战力 '+my+' vs '+partnerPower+(win?'，小胜':'，惜败'));
      self.trail('spar','邀'+CONFIG.PARTNER_NAME+'切磋论道'+(win?'，小胜':'，惜败'));
      self.addQiyuan(1,'切磋');
    });
  },
  /** 发起结盟 */
  sendAlliance:function(){
    var g=this.state,self=this;
    if(g.alliance){ toast('已结盟'); return; }
    if(g.res.xianYu<5){ toast('需 5 仙玉作为盟誓之资'); return; }
    g.res.xianYu-=5;
    DB.loadPartnerProfile(function(partner){
      if(!partner){ toast('对方宗门不存在'); return; }
      DB.sendInteraction(partner.id,'alliance_request',{sect:g.sectName},function(){});
      self.addLog('已向'+CONFIG.PARTNER_NAME+'的宗门递上结盟金书，静候佳音',true);
      // Mock 模式即时结盟
      if(DB.mode==='mock'){ self.acceptAlliance(true); }
    });
  },
  /** 接受结盟 */
  acceptAlliance:function(accept){
    var g=this.state;
    if(accept){
      g.alliance={since:Date.now()};
      audio.ascend();
      this.addLog('两宗结盟！修真界传为佳话：'+CONFIG.DEVELOPER_NAME+'与'+CONFIG.PARTNER_NAME+'的宗门今日结盟',true);
      this.historyPush('结盟','与'+CONFIG.PARTNER_NAME+'之宗门缔结盟约，共参大道');
      this.addLog('解锁：双人秘境、彤恩双修诀、赠礼、切磋',true);
      this.trail('alliance','与'+CONFIG.PARTNER_NAME+'之宗门缔结盟约');
      this.addQiyuan(10,'结盟');
    }
  },
  /** 处理收到的互动 */
  handleInteraction:function(it){
    var self=this;
    if(!it||it.status!=='pending') return;
    if(it.to_profile_id!==this.state.profileId) return;
    if(it.type==='gift'){
      // 收礼
      var det=it.details||{};
      if(det.type==='lingShi') this.addLingShi(det.amount);
      else if(det.type==='guyuan') this.addPill('guyuan',det.amount);
      var note=det.note||'';
      this.addLog(CONFIG.PARTNER_NAME+'赠你'+(det.type==='lingShi'?'灵石'+det.amount:det.type==='guyuan'?'固元丹'+det.amount+'枚':'')+'，附言：'+note,true);
      audio.gift();
      if(!ui.modal){ showModal('<h2>缱绻之礼</h2><div class="mdesc">'+CONFIG.PARTNER_NAME+'赠你'+(det.type==='lingShi'?'灵石'+det.amount:det.type==='guyuan'?'固元丹'+det.amount+'枚':'')+'<br>「'+note+'」</div><div class="close-row"><button class="btn rose" data-act="closeModal">收下心意</button></div>'); }
      DB.respondInteraction(it.id,true,function(){});
    }else if(it.type==='spar'){
      this.addLog(CONFIG.PARTNER_NAME+'邀你切磋论道');
      DB.respondInteraction(it.id,true,function(){});
    }else if(it.type==='alliance_request'){
      var self2=this;
      showConfirm('结盟之邀',''+CONFIG.PARTNER_NAME+'的宗门递来金书，愿与你结为盟友，共参大道。是否应允？',function(){
        self2.acceptAlliance(true);
        DB.respondInteraction(it.id,true,function(){});
      });
    }else if(it.type==='steal'){
      // 灵田被偷
      var det=it.details||{};
      this.lingTianLog(CONFIG.PARTNER_NAME+'偷采了你的「'+(det.crop||'灵药')+'」'+(det.detail?('（'+det.detail+'）'):''));
      this.addLog(CONFIG.PARTNER_NAME+'偷偷采走了你的「'+(det.crop||'灵药')+'」…',true);
      this.state.karma=Math.min(30,(this.state.karma||0)+1);
      if(audio.warn) audio.warn();
      if(!ui.modal){ showModal('<h2>灵田失窃</h2><div class="mdesc">'+CONFIG.PARTNER_NAME+'悄悄潜入你的灵田，采走了「'+(det.crop||'灵药')+'」'+(det.detail?('（'+det.detail+'）'):'')+'<br>你心境豁达，功德+1</div><div class="close-row"><button class="btn gold" data-act="closeModal">无妨</button></div>'); }
      DB.respondInteraction(it.id,true,function(){});
    }else if(it.type==='water'){
      // 道侣浇水：全田生长加速（每格浇灌次数+1，上限3）
      var lt=this.state.lingTian;
      if(!lt){ this.initLingTian(); lt=this.state.lingTian; }
      for(var wi=0;wi<lt.plots.length;wi++){ var wp=lt.plots[wi]; if(wp.seed&&(wp.water||0)<3) wp.water=(wp.water||0)+1; }
      this.lingTianLog(CONFIG.PARTNER_NAME+'为你的灵田浇灌灵气，灵植生长加速');
      this.addLog(CONFIG.PARTNER_NAME+'为灵田浇灌灵气，灵植生长加速',true);
      if(audio.gift) audio.gift();
      if(!ui.modal){ showModal('<h2>灵雨之恩</h2><div class="mdesc">'+CONFIG.PARTNER_NAME+'为你的灵田浇灌了灵气，所有灵植生长加速！</div><div class="close-row"><button class="btn rose" data-act="closeModal">多谢</button></div>'); }
      DB.respondInteraction(it.id,true,function(){});
    }else if(it.type==='cardgame'){
      // v4.4 双人斗地主消息（deal/play/pass/end）
      this.cardOnMsg(it.details||{});
      DB.respondInteraction(it.id,true,function(){});
    }else if(it.type==='poolgame'){
      // v4.4 双人台球消息（deal/shot）
      this.poolOnMsg(it.details||{});
      DB.respondInteraction(it.id,true,function(){});
    }
  },
  /* ---------------- 情感系统 ---------------- */
  /** 每日问候（朱婉彤客户端） */
  checkGreeting:function(){
    var g=this.state;
    if(!isPartnerEmail(DB.profile.email)) return;
    var ds=dayStart();
    if(g.greeted===ds) return;
    g.greeted=ds;
    var msg=pick(CONFIG.GREETINGS);
    showModal('<div class="greeting-card"><div class="g-title">欢迎回来，婉彤</div><div class="g-body">'+msg+'</div><div class="close-row"><button class="btn rose" data-act="closeModal">开始修炼</button></div></div>');
    audio.gift();
  },
  /** 彤华节检测（纪念日 11-12） */
  isTonghuaFestival:function(){ return todayMMDD()===CONFIG.ANNIVERSARY; },
  /** 彤华节处理：节日增益+贺卡 */
  applyTonghua:function(){
    var g=this.state;
    if(!this.isTonghuaFestival()) return;
    // 节日 buff（50% 修炼）
    var has=g.buffs.some(function(b){return b.id==='tonghua';});
    if(!has){ g.buffs.push({id:'tonghua',label:'彤华节',type:'cult',mult:.5,left:86400}); this.addLog('彤华节至！全宗弟子修炼速度+50%，张灯结彩',true); }
    // 贺卡（每日一次）
    if(g.greeted!==dayStart()){
      g.greeted=dayStart();
      showModal('<div class="greeting-card"><div class="g-title">彤华节快乐</div><div class="g-body">亲爱的'+CONFIG.PARTNER_NAME+'，今天是我们的纪念日。\n在这个我们共同的世界里，每一天都是彤华节。\n—— '+CONFIG.DEVELOPER_NAME+'</div><div class="close-row"><button class="btn rose" data-act="closeModal">共度佳节</button></div></div>');
      audio.ascend();
    }
    // 双方同时在线 → 双人成就
    if(this.otherOnline&&!g.stats.tonghuaTogether){ g.stats.tonghuaTogether=true; this.checkAchievements(); }
  },
  /* ============ v4.2 星象观测 ============ */
  /** 观星（每日一次）：获得星象 buff，情缘加成 */
  observeStars:function(){
    var g=this.state,today=this.todayStr();
    if(g.starDate===today){ toast('今夜星象已观测过了，明日再来'); return; }
    g.starDate=today;
    var s=STARS[Math.floor(Math.random()*STARS.length)];
    if(s.type==='cult'){
      g.buffs.push({id:'star_'+s.id,label:s.name,type:'cult',mult:s.mult,left:s.dur});
    }else if(s.type==='lt'){
      g.starLtUntil=Date.now()+s.dur*1000;
    }else if(s.type==='ore'){
      g.starOreUntil=Date.now()+s.dur*1000;
    }else if(s.type==='earn'){
      g.starEarnUntil=Date.now()+s.dur*1000;
    }
    // 红鸾星：今日传书情缘翻倍
    if(s.type==='love') g.starLoveDate=today;
    this.addLog('夜观天象，见「'+s.name+'」：'+s.text,true);
    this.historyPush('观星','夜观天象得「'+s.name+'」');
    this.trail('star','夜观天象，见「'+s.name+'」');
    this.addQiyuan(1,'观星');
    var extra='';
    if(s.type==='love'){ this.addQingYuan(5); extra='<div class="mdesc" style="color:var(--rose);margin-top:6px">红鸾星动，情缘+5</div>'; }
    showModal('<div class="star-card"><div class="star-emoji">✦</div><div class="g-title">'+s.name+'</div><div class="mdesc">'+s.text+'</div>'+extra+'<div class="close-row"><button class="btn gold" data-act="closeModal">记下星象</button></div></div>');
    audio.gift();
  },
  /** 星象加成倍率（坊市产出） */
  starEarnMult:function(){
    var g=this.state;
    if(g.starEarnUntil&&Date.now()<g.starEarnUntil) return 2;
    if(g.starEarnUntil&&Date.now()>=g.starEarnUntil) g.starEarnUntil=0;
    return 1;
  },
  /** 星象加成倍率（矿石） */
  starOreMult:function(){
    var g=this.state;
    if(g.starOreUntil&&Date.now()<g.starOreUntil) return 2;
    if(g.starOreUntil&&Date.now()>=g.starOreUntil) g.starOreUntil=0;
    return 1;
  },
  /** 星象加成倍率（灵田） */
  starLtMult:function(){
    var g=this.state;
    if(g.starLtUntil&&Date.now()<g.starLtUntil) return 2;
    if(g.starLtUntil&&Date.now()>=g.starLtUntil) g.starLtUntil=0;
    return 1;
  },
  /** 当前星象名（用于 UI 展示） */
  starNow:function(){
    var g=this.state;
    var i;
    for(i=0;i<g.buffs.length;i++){ if(g.buffs[i].id&&g.buffs[i].id.indexOf('star_')===0) return g.buffs[i]; }
    if(g.starEarnUntil&&Date.now()<g.starEarnUntil) return {name:'禄存星',label:'禄存星'};
    if(g.starOreUntil&&Date.now()<g.starOreUntil) return {name:'禄存星',label:'禄存星'};
    if(g.starLtUntil&&Date.now()<g.starLtUntil) return {name:'月孛星',label:'月孛星'};
    if(g.starLoveDate===this.todayStr()) return {name:'红鸾星',label:'红鸾星'};
    return null;
  },
  /* ============ v4.2 悟道碑 ============ */
  /** 悟道（每日一次）：收集道偈图鉴，集齐有加成 */
  wudaoStone:function(){
    var g=this.state,today=this.todayStr();
    if(g.daojiDate===today){ toast('今日已悟道，道偈玄妙需细品，明日再来'); return; }
    g.daojiDate=today;
    var unowned=DAOJI.filter(function(d){ return g.daoji.indexOf(d.id)<0; });
    var pick;
    if(unowned.length===0){ pick=DAOJI[Math.floor(Math.random()*DAOJI.length)]; }
    else{ pick=unowned[Math.floor(Math.random()*unowned.length)]; g.daoji.push(pick.id); }
    var total=DAOJI.length,got=g.daoji.length;
    var done=got>=total;
    var buffTxt=done?'集齐十二道偈！悟道通明：全宗修炼+20%永久':'';
    if(done&&!g.daojiDone){ g.daojiDone=true; g.buffs.push({id:'daojiAll',label:'悟道通明',type:'cult',mult:.2,left:86400*365}); this.checkAchievements(); }
    if(!done) g.res.xianYu+=1;
    this.addLog('于悟道碑前顿悟：「'+pick.txt+'」',true);
    this.historyPush('悟道','得道偈「'+pick.txt+'」'+(done?'，十二偈圆满！':''));
    this.trail('wudao','于悟道碑顿悟「'+pick.txt+'」'+(done?'，十二偈圆满':''));
    this.addQiyuan(1,'悟道');
    showModal('<div class="star-card"><div class="star-emoji">🪨</div><div class="g-title">悟道碑 · 顿悟</div>'+
      '<div class="mdesc" style="line-height:1.7">道偈：<b class="num-gold">「'+pick.txt+'」</b><br><span style="color:var(--rose)">『'+pick.love+'』</span></div>'+
      '<div class="mdesc" style="margin-top:6px">已悟 <b class="num-gold">'+got+'</b>/'+total+' 偈'+(done?'，十二偈圆满，悟道通明！':'（集齐十二偈解锁全宗修炼+20%）')+(done?'':'，参悟仙玉+1')+'</div>'+
      (done?buffTxt:'')+
      '<div class="close-row"><button class="btn gold" data-act="closeModal">收下</button></div></div>');
    audio.ascend();
  },
  /* ============ v4.2 心意笺（每日碎片） ============ */
  /** 写心意笺（每日一次）：写给道侣的话，对方可回 */
  writeNote:function(text){
    var g=this.state,today=this.todayStr();
    g.noteDate=today; g.noteText=text;
    this.addLog('写下心意笺：「'+text+'」',true);
    this.historyPush('心意笺','写给'+CONFIG.PARTNER_NAME+'：「'+text+'」');
    this.trail('note','写下心意笺：「'+text+'」');
    this.addQiyuan(2,'写笺');
    this.addQingYuan(2);
    this.saveProfile(function(){});
    toast('💌 心意笺已送达');
    render();
  },
  /** 回复心意笺（每日一次） */
  replyNote:function(text){
    var g=this.state,today=this.todayStr();
    if(g.noteReplyDate===today){ toast('今日已回复过'); return; }
    g.noteReplyDate=today; g.noteReply=text;
    this.addLog('回复心意笺：「'+text+'」',true);
    this.addQiyuan(2,'回笺');
    this.trail('note','回复心意笺：「'+text+'」');
    this.addQingYuan(2);
    this.saveProfile(function(){});
    toast('💌 回笺已送达');
    render();
  },
  /** 对方是否今日写了笺（通过轮询到的 partner state 判断） */
  otherNoteToday:function(){
    return this.otherNoteDate===this.todayStr();
  },
  /* ============ v4.3 行迹系统 ============ */
  /** 记录行迹（写入 state.trails，随存档保存；对方经 loadPartnerProfile 可查阅） */
  trail:function(kind,detail){
    var g=this.state;
    if(!g) return;
    if(!g.trails) g.trails=[];   // 旧存档兼容：自动初始化
    g.trails.unshift({t:Date.now(),kind:kind,detail:detail});
    if(g.trails.length>120) g.trails.length=120;
    g.lastOnline=Date.now();
    this.saveToDB(true);   // 静默保存，行迹及时可见
  },
  /** 行迹图标 */
  trailIcon:function(kind){
    var m={online:'☁️',checkin:'⏰',star:'✦',wudao:'🪨',note:'💌',break:'⚡',gift:'🎁',spar:'⚔️',alliance:'🤝',wish:'🌠',tower:'🗼',boss:'🐉',achieve:'🏆',card:'🃏',pool:'🎱'};
    return m[kind]||'·';
  },
  /* ============ v4.3 契缘体系 ============ */
  /** 增加契缘值；触发结契阶段里程碑 */
  addQiyuan:function(n,tag){
    var g=this.state;
    g.qiyuan=(g.qiyuan||0)+n;
    this.checkQiyuanLv();
    return g.qiyuan;
  },
  /** 契缘阶段升级检查（升级时写日志/史书/行迹，仅一次） */
  checkQiyuanLv:function(){
    var g=this.state,lv=this.qiLv();
    if(lv>g.qiyuanLv){
      g.qiyuanLv=lv;
      var L=QIYUAN_LEVELS[lv];
      this.addLog('💞 契缘升华：与'+CONFIG.PARTNER_NAME+'结契「'+L.name+'」（'+L.buff+'）',true);
      this.historyPush('结契'+L.name,'契缘值达 '+g.qiyuan+'，与'+CONFIG.PARTNER_NAME+'结为「'+L.name+'」');
      this.trail('achieve','契缘升华，与道侣结契「'+L.name+'」');
    }
  },
  /** 传书契缘（每日上限 10 次；同心契缘 20 次） */
  addMsgQiyuan:function(){
    var g=this.state,today=this.todayStr();
    if(g.qiyuanMsgDate!==today){ g.qiyuanMsgDate=today; g.qiyuanMsgCount=0; }
    var cap=this.qiLv()>=3?20:10;
    if((g.qiyuanMsgCount||0)>=cap) return;
    g.qiyuanMsgCount=(g.qiyuanMsgCount||0)+1;
    this.addQiyuan(1,'传书');
  },
  /* ============ v4.4 双人斗地主（异步回合制） ============ */
  /** 发起牌局：发 17 张给我，17 张经消息发给对方，我先手 */
  cardStart:function(){
    var g=this.state;
    if(g.cardGame&&g.cardGame.status==='playing'){ toast('牌局进行中'); return; }
    if(!this.otherOnline&&DB.mode!=='mock'){ toast(CONFIG.PARTNER_NAME+'不在线，先传书约她吧'); return; }
    var deck=shuffleArr(newDeck());
    var myHand=deck.slice(0,17),theirHand=deck.slice(17,34);
    g.cardGame={id:'cg'+Date.now(),status:'playing',myHand:myHand,theirCount:17,cur:null,turn:'me',over:false,winner:null};
    var self=this;
    DB.loadPartnerProfile(function(partner){
      if(!partner){ toast('对方宗门不存在'); return; }
      DB.sendInteraction(partner.id,'cardgame',{step:'deal',hand:theirHand,id:g.cardGame.id},function(){});
    });
    this.addLog('🃏 发起斗地主牌局，与'+CONFIG.PARTNER_NAME+'对弈',true);
    showCardGame();
  },
  /** 收到对方发牌 */
  cardDeal:function(msg){
    var g=this.state;
    g.cardGame={id:msg.id||('cg'+Date.now()),status:'playing',myHand:msg.hand||[],theirCount:17,cur:null,turn:'them',over:false,winner:null};
    this.addLog('🃏 '+CONFIG.PARTNER_NAME+'邀你对弈斗地主，牌已发好',true);
    showCardGame();
  },
  /** 出牌（sel=选中的牌对象数组） */
  cardPlay:function(sel){
    var g=this.state,cg=g.cardGame;
    if(!cg||cg.status!=='playing'||cg.turn!=='me'){ toast('还没轮到你'); return; }
    if(!sel||!sel.length){ toast('请先选牌'); return; }
    var type=cardTypeOf(sel);
    if(!type){ toast('牌型不合法'); return; }
    if(cg.cur&&cg.cur.who==='them'&&!cardBeats(cg.cur.type,type)){ toast('压不过上家的牌'); return; }
    // 从手牌移除（按 r+s 匹配，兼容显示排序）
    for(var i=0;i<sel.length;i++){
      for(var j=0;j<cg.myHand.length;j++){
        if(cg.myHand[j].r===sel[i].r&&cg.myHand[j].s===sel[i].s){ cg.myHand.splice(j,1); break; }
      }
    }
    cg.cur={type:type,cards:sel,who:'me'};
    cg.turn='them';
    var self=this;
    DB.loadPartnerProfile(function(partner){
      if(partner) DB.sendInteraction(partner.id,'cardgame',{step:'play',cards:sel,id:cg.id},function(){});
    });
    this.addLog('🃏 你打出：'+sel.map(cardStr).join(' '));
    if(cg.myHand.length===0){
      cg.status='ended'; cg.over=true; cg.winner='me';
      this.cardSettle(true);
    }
    renderCardGame();
  },
  /** 不出（仅当上家出牌后可 pass） */
  cardPass:function(){
    var g=this.state,cg=g.cardGame;
    if(!cg||cg.status!=='playing'||cg.turn!=='me') return;
    if(!cg.cur||cg.cur.who!=='them'){ toast('你先手，必须出牌'); return; }
    cg.cur=null; cg.turn='them';
    var self=this;
    DB.loadPartnerProfile(function(partner){
      if(partner) DB.sendInteraction(partner.id,'cardgame',{step:'pass',id:cg.id},function(){});
    });
    this.addLog('🃏 你选择不出');
    renderCardGame();
  },
  /** 处理对方发来的牌局消息（经 handleInteraction 路由） */
  cardOnMsg:function(msg){
    if(!msg||!msg.step) return;
    var g=this.state,cg=g.cardGame;
    if(!cg||cg.id!==msg.id){
      if(msg.step==='deal'){ this.cardDeal(msg); }
      return;
    }
    if(msg.step==='play'){
      cg.cur={type:cardTypeOf(msg.cards),cards:msg.cards,who:'them'};
      cg.theirCount=Math.max(0,(cg.theirCount||0)-msg.cards.length);
      cg.turn='me';
      this.addLog('🃏 '+CONFIG.PARTNER_NAME+'打出：'+msg.cards.map(cardStr).join(' '));
      if(cg.theirCount===0){ cg.status='ended'; cg.over=true; cg.winner='them'; this.cardSettle(false); }
      renderCardGame();
    }else if(msg.step==='pass'){
      cg.cur=null; cg.turn='me';
      this.addLog('🃏 '+CONFIG.PARTNER_NAME+'选择不出');
      renderCardGame();
    }else if(msg.step==='end'){
      cg.status='ended'; cg.over=true; cg.winner=msg.winner;
      this.cardSettle(msg.winner==='me');
      renderCardGame();
    }
  },
  /** 对局结算 */
  cardSettle:function(win){
    var g=this.state;
    if(win){ this.addLingShi(500); this.addQiyuan(5,'斗地主'); this.addLog('🃏 斗地主胜！灵石+500，契缘+5',true); this.historyPush('牌局','斗地主对弈胜'+CONFIG.PARTNER_NAME); }
    else{ this.addLingShi(100); this.addLog('🃏 斗地主惜败，灵石+100',true); }
    this.trail('card','斗地主对局'+(win?'取胜':'落败'));
    this.saveProfile(function(){});
    if(win) this.checkAchievements();
  },
  /* ============ v4.4 双人台球（异步回合） ============ */
  /** 发起台球局：我先手（红球） */
  poolStart:function(){
    var g=this.state;
    if(g.poolGame&&g.poolGame.status==='playing'){ toast('球局进行中'); return; }
    if(!this.otherOnline&&DB.mode!=='mock'){ toast(CONFIG.PARTNER_NAME+'不在线，先传书约她吧'); return; }
    g.poolGame={id:'pg'+Date.now(),status:'playing',balls:poolLayout(),turn:'me',myScore:0,theirScore:0,animating:false,ended:false,winner:null};
    var self=this;
    DB.loadPartnerProfile(function(partner){
      if(partner) DB.sendInteraction(partner.id,'poolgame',{step:'deal',id:g.poolGame.id},function(){});
    });
    this.addLog('🎱 摆好球台，邀'+CONFIG.PARTNER_NAME+'打一局台球',true);
    showPoolGame();
  },
  /** 收到开球 */
  poolDeal:function(msg){
    var g=this.state;
    g.poolGame={id:msg.id||('pg'+Date.now()),status:'playing',balls:poolLayout(),turn:'them',myScore:0,theirScore:0,animating:false,ended:false,winner:null};
    this.addLog('🎱 '+CONFIG.PARTNER_NAME+'邀你打台球，她先开球（她的球为红色）',true);
    showPoolGame();
  },
  /** 我的击球（angle 0-360，power 0-100） */
  poolShotDo:function(angle,power){
    var g=this.state,pg=g.poolGame;
    if(!pg||pg.status!=='playing'||pg.turn!=='me'||pg.animating){ toast('还没轮到你'); return; }
    if(!power||power<5){ toast('力度太小'); return; }
    pg.animating=true;
    // 深拷贝球局模拟（避免影响真实状态）
    var balls=JSON.parse(JSON.stringify(pg.balls));
    var res=poolSimulate(balls,angle,power);
    this.poolApplyResult(balls,res,angle,power);
    // 动画重放（本地同参数）
    this.poolAnimate(balls,angle,power);
    var self=this;
    DB.loadPartnerProfile(function(partner){
      if(partner) DB.sendInteraction(partner.id,'poolgame',{step:'shot',angle:angle,power:power,id:pg.id,
        myScore:pg.myScore,theirScore:pg.theirScore,ended:pg.ended,winner:pg.winner,turn:pg.turn},function(){});
    });
  },
  /** 结算一次击球结果（双方共用，保证一致） */
  poolApplyResult:function(balls,res,angle,power){
    var g=this.state,pg=g.poolGame;
    var meIn=res.pockets.filter(function(b){return b.group==='red';}).length;
    var herIn=res.pockets.filter(function(b){return b.group==='blue';}).length;
    var blackIn=res.pockets.some(function(b){return b.group==='black';});
    pg.myScore+=meIn; pg.theirScore+=herIn;
    var desc='你击球：';
    if(blackIn){
      if(pg.myScore>=3){ pg.ended=true; pg.winner='me'; desc+='黑8 入袋，你赢了！🎉'; }
      else{ pg.ended=true; pg.winner='them'; desc+='黑8 提前入袋，你输了…'; }
    }else if(res.cueDown){
      pg.turn='them'; desc+='白球落袋犯规，换她击球';
    }else if(meIn>0){
      pg.turn='me'; desc+='红球×'+meIn+' 入袋，继续击球！';
    }else if(herIn>0){
      pg.turn='them'; desc+='（蓝球×'+herIn+' 为她得分）换她击球';
    }else{
      pg.turn='them'; desc+='未进球，换她击球';
    }
    this.addLog('🎱 '+desc);
    if(pg.ended) this.poolSettle();
  },
  /** 处理对方击球消息 */
  poolOnMsg:function(msg){
    var g=this.state,pg=g.poolGame;
    if(!pg||pg.id!==msg.id){ if(msg.step==='deal'){ this.poolDeal(msg); } return; }
    if(msg.step==='shot'){
      pg.animating=true;
      var balls=JSON.parse(JSON.stringify(pg.balls));
      poolSimulate(balls,msg.angle,msg.power);
      // 采用对方结算结果（防浮点差异）
      pg.balls=balls;
      pg.myScore=msg.myScore; pg.theirScore=msg.theirScore;
      if(msg.ended){ pg.ended=true; pg.winner=msg.winner; this.poolSettle(); }
      else{
        var cue=null;
        for(var i=0;i<balls.length;i++) if(balls[i].id==='cue'){ cue=balls[i]; break; }
        pg.turn=(pg.turn==='me')?'them':'me';   // 对方击球后轮到我，反之亦然
        if(cue.pocketed){ cue.pocketed=false; cue.x=60; cue.y=130; cue.vx=0; cue.vy=0; }
      }
      pg.animating=false;
      this.addLog('🎱 '+CONFIG.PARTNER_NAME+'完成击球');
      renderPoolGame();
    }
  },
  /** 动画重放（与对方端同参数、同物理 → 画面一致） */
  poolAnimate:function(balls,angle,power){
    var g=this.state,pg=g.poolGame;
    // 动画期间用副本渲染；结束后把副本写回
    pg.animBalls=balls;
    var frames=0;
    var iv=setInterval(function(){
      if(poolAllStill(balls)||frames>1500){ clearInterval(iv); pg.animating=false; pg.balls=balls; pg.animBalls=null; drawPool(); renderPoolGame(); return; }
      poolStep(balls,0.016); frames++;
      drawPool();
    },16);
  },
  /** 台球结算 */
  poolSettle:function(){
    var g=this.state,pg=g.poolGame;
    var win=pg.winner==='me';
    if(win){ this.addLingShi(600); this.addQiyuan(6,'台球'); this.addLog('🎱 台球胜！灵石+600，契缘+6',true); this.historyPush('球局','台球对局胜'+CONFIG.PARTNER_NAME); }
    else{ this.addLingShi(120); this.addLog('🎱 台球惜败，灵石+120',true); }
    this.trail('pool','台球对局'+(win?'取胜':'落败'));
    this.saveProfile(function(){});
    if(win) this.checkAchievements();
  },
  /** 当前结契阶段 index */
  qiLv:function(){
    var v=this.state.qiyuan||0,i;
    for(i=QIYUAN_LEVELS.length-1;i>=0;i--) if(v>=QIYUAN_LEVELS[i].need) return i;
    return 0;
  },
  /** 结契进度信息 {lv,name,next,ratio,need} */
  qiLvInfo:function(){
    var v=this.state.qiyuan||0,lv=this.qiLv(),cur=QIYUAN_LEVELS[lv];
    var nxt=QIYUAN_LEVELS[lv+1];
    return {lv:lv,name:cur.name,buff:cur.buff,next:nxt?nxt.name:null,
      need:nxt?nxt.need:cur.need,ratio:nxt?Math.min(100,Math.round((v-cur.need)/(nxt.need-cur.need)*100)):100,qiyuan:v};
  },
  /* ---------------- 主循环 ---------------- */
  tick:function(){
    var now=Date.now(),dt=(now-this.lastTick)/1000;
    this.lastTick=now;
    if(dt<=0) return;
    if(dt>60) dt=60;
    var g=this.state,i;
    // 灵田生长（在线）
    this.tickLingTian(dt);
    // 坊市 + 灵兽园（含今日天气加成 + 星象加成）
    g.res.lingShi+=(1+g.facilities.fangshi*.8)*this.weatherEarnMult()*this.starEarnMult()*(this.festivalOf()?2:1)*dt;
    g.res.beastMaterial+=g.facilities.lingshou*.012*dt;
    // 弟子
    for(i=0;i<g.disciples.length;i++){
      var d=g.disciples[i];
      if(d.injury.left>0){
        d.injury.left-=dt*(this.hasTrait(d,'yixian')?2:1);
        if(d.injury.left<=0){ d.injury.left=0; d.injury.total=0; d.state='idle'; this.addLog(d.name+'伤势痊愈'); }
      }
      if(d.buffs.peiyuan>0) d.buffs.peiyuan-=dt;
      if(d.buffs.zhuyan>0) d.buffs.zhuyan-=dt;
      if(d.state==='cultivate'){ d.exp+=this.cultivateRate(d)*this.weatherCultMult()*dt; }
      else if(d.state==='alchemy'){
        d.workProg+=dt/this.alchemyCycle(d);
        if(d.workProg>=1){ d.workProg-=1; this.producePill(d); this.count('pill',1); }
      }else if(d.state==='forge'){
        d.workProg+=dt/this.forgeCycle(d);
        if(d.workProg>=1){ d.workProg-=1; this.produceEquip(d); }
      }else if(d.state==='wudao'){
        d.workProg+=dt/60;
        if(d.workProg>=1) this.finishWudao(d);
      }
    }
    // 关系网：同修结道侣
    if(g.relationship.daoLvId===null&&Math.random()<.0002){
      var cults=g.disciples.filter(function(x){return x.state==='cultivate'&&x.gender!==undefined;});
      if(cults.length>=2){ g.relationship.daoLvId=cults[0].id; this.addLog('日久生情：'+cults[0].name+'与'+cults[1].name+'结为道侣，双修+30%',true); }
    }
    // 队伍
    for(i=g.parties.length-1;i>=0;i--) if(g.parties[i].state==='march') this.advanceParty(g.parties[i],dt);
    // 全局增益
    for(i=g.buffs.length-1;i>=0;i--){ g.buffs[i].left-=dt; if(g.buffs[i].left<=0){ this.addLog(g.buffs[i].label+'的效果消散了'); g.buffs.splice(i,1); } }
    // 冷却
    if(g.tower.cd>0) g.tower.cd-=dt;
    if(g.wudaoCd>0) g.wudaoCd-=dt;
    for(i=0;i<g.npcs.length;i++) if(g.npcs[i].cd>0) g.npcs[i].cd-=dt;
    // NPC 进攻
    g.npcAtkTimer-=dt;
    if(g.npcAtkTimer<=0){ g.npcAtkTimer=irand(900,1800); this.npcAttack(); }
    // 随机事件
    g.eventTimer-=dt;
    if(g.eventTimer<=0&&!ui.modal){ g.eventTimer=irand(60,150); this.triggerRandomEvent(); }
    // 任务刷新
    this.refreshTasks();
    // 宗门等级
    var sl=this.calcSectLv();
    if(sl!==g.sectLv){ g.sectLv=sl; if(sl>=3) this.addLog('宗门晋升 '+sl+' 级，解锁流派与高级建筑！',true); }
    // 同时在线计时（双人成就）+ v4.3 契缘在线累加
    if(this.otherOnline&&g.alliance){ g.stats.parallelTime+=dt; if(g.stats.parallelTime>=3600) this.checkAchievements(); }
    g.onlineMinutes=(g.onlineMinutes||0)+dt/60;
    // v4.4 契缘在线累加：每日在线上限 50（防挂机刷契缘，互动才是主渠道）
    if(g._qyOnlineDate!==this.todayStr()){ g._qyOnlineDate=this.todayStr(); g._qyOnlineDay=0; }
    if(this.otherOnline&&(g._qyOnlineDay||0)<50){ g._qyOnlineDay=(g._qyOnlineDay||0)+dt*.02; this.addQiyuan(dt*.02,'在线'); }
    // v5.4 婉彤未签到提醒（每 5 分钟轻提醒一次，不打断操作）
    if(DB.profile&&isPartnerEmail(DB.profile.email)){
      if(!g._ckRemind) g._ckRemind=0;
      g._ckRemind+=dt;
      var ck=g.checkin||{};
      if(g._ckRemind>=300&&!ck.done&&ck.day===this.todayStr()){
        g._ckRemind=0;
        toast('☀️ 今天还没签到哦～点宗门页「签到领奖」，恩和在等你的同心加成');
      }
    }
    // 反作弊：每 60 秒一次状态体检
    if(!this._sanityT) this._sanityT=0;
    this._sanityT+=dt;
    if(this._sanityT>=60){ this._sanityT=0; this.checkSanity(); }
    // 音乐
    if(ui.modal) audio.setMusicMode('battle');
    else if(g.musicGloryUntil&&Date.now()<g.musicGloryUntil) audio.setMusicMode('glory');
    else audio.setMusicMode('normal');
    // 定期存档（15 秒）
    if(!this._saveTimer) this._saveTimer=0;
    this._saveTimer+=dt;
    if(this._saveTimer>=15){ this._saveTimer=0; this.saveToDB(false); }
  },
  /** 炼丹完成 */
  producePill:function(d){
    var g=this.state,lv=g.facilities.liandan,r=Math.random(),key='guyuan';
    if(lv>=7){ key=r<.15?'xugudan':r<.45?'ningshen':r<.80?'peiyuan':'guyuan'; }
    else if(lv>=5){ key=r<.20?'ningshen':r<.60?'peiyuan':'guyuan'; }
    else if(lv>=3){ key=r<.30?'peiyuan':'guyuan'; }
    // 朱颜丹：需朱颜花
    if(key!=='zhuyan'&&g.res.zhuyanFlower>0&&Math.random()<.08){ this.addZhuyan(-1); key='zhuyan'; }
    this.addPill(key,1);
    audio.alchemy();
  },
  /** 离线收益 */
  applyOffline:function(delta){
    if(delta<10) return;
    var g=this.state,out=[],i;
    // 灵田离线结算（成熟自动入账）
    this.offlineLingTian(delta);
    var ling=Math.floor((1+g.facilities.fangshi*.8)*this.weatherEarnMult()*(this.festivalOf()?2:1)*delta);
    if(ling>0){ g.res.lingShi+=ling; g.stats.earnLS+=ling; out.push(['灵石',ling]); }
    var lsMat=Math.floor(g.facilities.lingshou*.012*delta);
    if(lsMat>0){ g.res.beastMaterial+=lsMat; out.push(['灵兽材料',lsMat]); }
    var pillRate=0;
    for(i=0;i<g.disciples.length;i++) if(g.disciples[i].state==='alchemy') pillRate+=1/this.alchemyCycle(g.disciples[i]);
    var pills=Math.floor(pillRate*delta);
    if(pills>0){ g.res.pills.guyuan+=pills; out.push(['固元丹',pills]); }
    var forgeRate=0;
    for(i=0;i<g.disciples.length;i++) if(g.disciples[i].state==='forge') forgeRate+=1/this.forgeCycle(g.disciples[i]);
    var eqs=Math.floor(forgeRate*delta);
    for(i=0;i<eqs;i++) g.res.equipBank.push(this.genEquip(null,this.qualityRoll(null),null,'离线炼制'));
    if(eqs>0) out.push(['装备',eqs]);
    var expTotal=0;
    for(i=0;i<g.disciples.length;i++){ var d=g.disciples[i]; if(d.state==='cultivate'){ var add=this.cultivateRate(d)*delta; d.exp+=add; expTotal+=add; } }
    if(expTotal>0) out.push(['修为',Math.round(expTotal)]);
    // 队伍离线推进
    for(i=g.parties.length-1;i>=0;i--){
      var p=g.parties[i],remain=delta,guard=0;
      while(remain>0&&p.state==='march'&&guard++<60){
        if(p.timer>remain){ p.timer-=remain; remain=0; break; }
        remain-=p.timer;
        if(p.nodeIdx>=p.nodes.length){ this.finishParty(p,true); break; }
        var type=p.nodes[p.nodeIdx];
        if(type==='boss'){ this.bossBattle(p,true); break; }
        this.nodeEvent(p,type,true);
      }
    }
    // 伤势/增益/悟道
    for(i=0;i<g.disciples.length;i++){ var d2=g.disciples[i];
      if(d2.injury.left>0){ d2.injury.left-=delta*(this.hasTrait(d2,'yixian')?2:1); if(d2.injury.left<=0){ d2.injury.left=0; d2.injury.total=0; d2.state='idle'; } }
      if(d2.buffs.peiyuan>0) d2.buffs.peiyuan-=delta;
      if(d2.buffs.zhuyan>0) d2.buffs.zhuyan-=delta;
      if(d2.state==='wudao'){ d2.workProg+=delta/60; if(d2.workProg>=1) this.finishWudao(d2); }
    }
    // 离线 NPC 来袭一次
    var alive=g.npcs.filter(function(n){return !n.annihilated&&n.rel<70;});
    if(alive.length){
      var n=pick(alive),def=g.facilities.dazhen*2000*(g.liupai==='zhen'?3:1);
      if(def<n.power){ var loss=Math.round(g.res.lingShi*.05); g.res.lingShi=Math.max(0,g.res.lingShi-loss); this.addLog('离线期间'+n.name+'来袭，损失灵石'+loss); }
    }
    // 修真界简报
    this.worldBrief();
    if(out.length){
      var rows=out.map(function(o){return '<div class="m-row"><span>'+o[0]+'</span><b>+'+o[1]+'</b></div>';}).join('');
      showModal('<h2>闭关归来</h2><div class="mdesc">离线 '+formatDur(delta)+'，宗门自行运转收获（已入账，日志可查）：</div>'+rows+
        '<div class="close-row"><button class="btn gold" data-act="closeModal">收下</button><button class="btn ghost" data-act="closeModal">稍后查看</button></div>');
      // 30 秒未操作自动收下
      clearTimeout(this._autoCloseTimer);
      this._autoCloseTimer=setTimeout(function(){ closeModal(); },30000);
      this.addLog('闭关归来：'+out.map(function(o){return o[0]+'+'+o[1];}).join('，'),true);
    }
  },
  /* ---------------- 灵田系统（修仙农场） ---------------- */
  /** 灵田状态补丁（幂等：新号/旧存档/加载后统一补全） */
  initLingTian:function(){
    var g=this.state;
    if(!g) return null;
    if(!g.lingTian) g.lingTian={};
    var lt=g.lingTian;
    if(typeof lt.lv!=='number') lt.lv=1;
    if(typeof lt.exp!=='number') lt.exp=0;
    if(!lt.plots||!lt.plots.length){ lt.plots=[]; for(var i=0;i<12;i++) lt.plots.push({seed:null,grown:0,water:0}); }
    if(!lt.seeds) lt.seeds={};
    if(!lt.today||typeof lt.today!=='object') lt.today={date:0,steal:0,stealed:0,water:0};
    if(!lt.stats) lt.stats={plant:0,harvest:0,steal:0,stealed:0,water:0};
    if(!lt.logs) lt.logs=[];
    if(typeof lt.rain!=='number') lt.rain=0;
    if(!lt._ripe) lt._ripe=[];
    while(lt.plots.length<12) lt.plots.push({seed:null,grown:0,water:0});
    while(lt._ripe.length<12) lt._ripe.push(false);
    var ds=dayStart();
    if(lt.today.date!==ds){ lt.today={date:ds,steal:0,stealed:0,water:0}; }
    return lt;
  },
  /** 灵田已开垦地块数（Lv1=3，每级+1，上限12） */
  lingTianMaxPlots:function(){ var lt=this.state.lingTian; return Math.min(12,2+(lt?lt.lv:1)); },
  /** 灵田升级所需经验 */
  lingTianExpNeed:function(){ var lt=this.state.lingTian; return Math.round((lt?lt.lv:1)*120); },
  /** 灵田札记 */
  lingTianLog:function(msg){ var lt=this.initLingTian(); lt.logs.unshift({t:Date.now(),s:msg}); if(lt.logs.length>40) lt.logs.length=40; },
  /** 灵田剩余生长秒数 */
  lingTianRemain:function(p){
    if(!p||!p.seed) return 0;
    var c=LT_cropById(p.seed);
    if(!c) return 0;
    var need=c.time*Math.pow(.9,p.water||0);
    return Math.max(0,need-(p.grown||0));
  },
  /** 灵田生长进度 0-1 */
  lingTianProgress:function(p){
    if(!p||!p.seed) return 0;
    var c=LT_cropById(p.seed);
    if(!c) return 0;
    var need=c.time*Math.pow(.9,p.water||0);
    return Math.min(1,(p.grown||0)/need);
  },
  /** 应用产出（yield 键: lingShi/zhuyanFlower/xianYu/pill_xxx） */
  lingTianApplyYield:function(yieldMap,mult){
    for(var k in yieldMap){
      var n=yieldMap[k]*(mult||1);
      if(k==='lingShi') this.addLingShi(n);
      else if(k==='zhuyanFlower') this.addZhuyan(n);
      else if(k==='xianYu') this.addXianYu(n);
      else if(k.indexOf('pill_')===0) this.addPill(k.slice(5),n);
    }
  },
  /** 产出文字描述 */
  lingTianYieldText:function(yieldMap,mult){
    var parts=[];
    for(var k in yieldMap){
      var n=yieldMap[k]*(mult||1);
      var nm=k==='lingShi'?'灵石':k==='zhuyanFlower'?'朱颜花':k==='xianYu'?'仙玉':(k.indexOf('pill_')===0&&PILLS[k.slice(5)]?PILLS[k.slice(5)].name:k);
      parts.push(nm+'×'+n);
    }
    return parts.join('、');
  },
  /** 种植（idx 可选：指定地块；缺省自动找第一块空地） */
  lingTianPlant:function(seedId,idx){
    var lt=this.initLingTian(),c=LT_cropById(seedId);
    if(!c){ toast('未知灵种'); return; }
    if(lt.lv<c.lv){ toast('灵田 '+c.lv+' 级解锁「'+c.name+'」'); return; }
    if(!lt.seeds[seedId]){ toast('灵种不足，请先到灵种阁购买'); return; }
    var target=idx;
    if(typeof target!=='number'||!isFinite(target)||target<0){
      target=-1;
      var maxPlots=this.lingTianMaxPlots();
      for(var i=0;i<maxPlots;i++){ if(!lt.plots[i].seed){ target=i; break; } }
    }
    if(target<0||target>=lt.plots.length||lt.plots[target].seed){ toast('该地块不可种植'); return; }
    lt.seeds[seedId]--;
    lt.plots[target]={seed:seedId,grown:0,water:0};
    lt._ripe[target]=false;
    lt.stats.plant++;
    this.lingTianLog('种下「'+c.name+'」（第'+(target+1)+'块灵田）');
    this.addLog('在灵田种下「'+c.name+'」');
    if(audio.plant) audio.plant();
    render();
  },
  /** 收获指定地块 */
  lingTianHarvest:function(idx){
    var lt=this.initLingTian(),p=lt.plots[idx];
    if(!p||!p.seed) return;
    var c=LT_cropById(p.seed);
    if(!c) return;
    if((p.grown||0)<c.time*Math.pow(.9,p.water||0)){ toast('尚未成熟'); return; }
    p.seed=null; p.grown=0; p.water=0; lt._ripe[idx]=false;
    lt.stats.harvest++;
    this.count('ltHarvest',1);
    var variant=this.isAuroraDay()&&Math.random()<.15;
    this.lingTianApplyYield(c.yield,variant?2:1);
    var yt=this.lingTianYieldText(c.yield,variant?2:1);
    this.lingTianLog((variant?'极光变异「':'收获「')+c.name+(variant?'」灵气四溢，得 '+yt+'！':'」得 '+yt));
    this.addLog((variant?'✨极光下「'+c.name+'」发生变异，':('灵田收获「'+c.name+'」+'))+(variant?yt+'（双倍）':yt));
    this.lingTianAddExp(Math.round(c.time/60)*(variant?2:1));
    if(variant){ this.count('ltVariant',1); this.checkAchievements(); }
    if(Math.random()<.2){ lt.seeds[c.id]=(lt.seeds[c.id]||0)+1; this.lingTianLog('收获时留下一颗「'+c.name+'」灵种'); }
    if(audio.harvest) audio.harvest();
    this.checkAchievements();
    render();
  },
  /** 一键收获全部成熟作物 */
  lingTianHarvestAll:function(){
    var lt=this.initLingTian(),n=0,expGain=0;
    for(var i=0;i<lt.plots.length;i++){
      var p=lt.plots[i];
      if(p&&p.seed){
        var c=LT_cropById(p.seed);
        if(c&&(p.grown||0)>=c.time*Math.pow(.9,p.water||0)){
          p.seed=null; p.grown=0; p.water=0; lt._ripe[i]=false;
          lt.stats.harvest++;
          this.count('ltHarvest',1);
          var v2=this.isAuroraDay()&&Math.random()<.15;
          this.lingTianApplyYield(c.yield,v2?2:1);
          expGain+=Math.round(c.time/60)*(v2?2:1);
          if(v2){ this.count('ltVariant',1); }
          if(Math.random()<.2) lt.seeds[c.id]=(lt.seeds[c.id]||0)+1;
          n++;
        }
      }
    }
    if(n){ this.lingTianLog('一键收获 '+n+' 处灵田'); this.addLog('灵田收获 '+n+' 处作物'); this.lingTianAddExp(expGain); if(audio.harvest) audio.harvest(); this.checkAchievements(); }
    else toast('没有成熟的作物');
    render();
  },
  /** 购买灵种 */
  lingTianBuySeed:function(id){
    var lt=this.initLingTian(),c=LT_cropById(id);
    if(!c) return;
    if(lt.lv<c.lv){ toast('灵田 '+c.lv+' 级解锁「'+c.name+'」'); return; }
    if(!this.canAfford(c.cost)){ toast('灵石不足'); return; }
    this.pay(c.cost);
    lt.seeds[id]=(lt.seeds[id]||0)+1;
    this.lingTianLog('购得「'+c.name+'」灵种');
    if(audio.buy) audio.buy();
    render();
  },
  /** 灵田升级（经验满自动晋升） */
  lingTianAddExp:function(n){
    var lt=this.initLingTian();
    lt.exp+=n;
    var guard=0;
    while(lt.exp>=this.lingTianExpNeed()&&guard++<10){
      lt.exp-=this.lingTianExpNeed();
      lt.lv++;
      this.lingTianLog('灵田晋升 Lv.'+lt.lv+'，灵气愈发充沛');
      this.addLog('灵田晋升 Lv.'+lt.lv+'，开垦新地块、解锁新灵种！',true);
    }
  },
  /** 在线推进（每秒）：生长 + 灵雨 + 成熟提示 + 事件概率 */
  tickLingTian:function(dt){
    var lt=this.initLingTian();
    if(lt.rain>0) lt.rain-=dt;
    var mult=(lt.rain>0)?1.5:1;
    mult*=this.weatherLtMult();
    mult*=this.starLtMult();
    var ripe=[];
    for(var i=0;i<lt.plots.length;i++){
      var p=lt.plots[i];
      if(p&&p.seed){
        p.grown=(p.grown||0)+dt*mult;
        var c=LT_cropById(p.seed);
        if(c&&(p.grown||0)>=c.time*Math.pow(.9,p.water||0)&&!lt._ripe[i]){
          lt._ripe[i]=true; ripe.push(c.name);
        }
      }
    }
    if(ripe.length){ this.lingTianLog('灵田作物成熟：'+ripe.join('、')); this.addLog('灵田作物成熟：'+ripe.join('、')+'，速去收获！',true); if(audio.ripe) audio.ripe(); }
    if(Math.random()<dt/300) this.lingTianEvent();
  },
  /** 离线结算：成熟作物自动入账 */
  offlineLingTian:function(delta){
    var lt=this.initLingTian(),out=[];
    for(var i=0;i<lt.plots.length;i++){
      var p=lt.plots[i];
      if(!p||!p.seed) continue;
      p.grown=(p.grown||0)+delta*this.weatherLtMult();
      var c=LT_cropById(p.seed);
      if(c&&(p.grown||0)>=c.time*Math.pow(.9,p.water||0)){
        p.seed=null; p.grown=0; p.water=0; lt._ripe[i]=false;
        lt.stats.harvest++;
        this.lingTianApplyYield(c.yield,1);
        out.push('「'+c.name+'」+'+this.lingTianYieldText(c.yield,1));
        lt.exp+=Math.round(c.time/60);
        if(Math.random()<.2) lt.seeds[c.id]=(lt.seeds[c.id]||0)+1;
      }
    }
    if(out.length){ this.lingTianLog('闭关期间灵田自动收获：'+out.join('、')); this.addLog('闭关归来，灵田成熟作物已自动入账：'+out.join('、'),true); }
  },
  /** 灵田随机事件 */
  lingTianEvent:function(){
    var lt=this.initLingTian();
    if(ui.modal) return;
    var r=Math.random();
    if(r<.5){
      lt.rain=Math.max(lt.rain||0,1800);
      this.lingTianLog('天降灵雨，灵植生长速度+50%（30分钟）');
      this.addLog('天降灵雨！灵田生长加速',true);
      if(audio.rain) audio.rain();
      showModal('<h2>灵雨</h2><div class="mdesc">天降灵雨，滋润灵田——<b>30 分钟内灵植生长速度 +50%</b>，雨露可提升收获灵气。</div><div class="close-row"><button class="btn gold" data-act="closeModal">承接雨露</button></div>');
    }else if(r<.85){
      var planted=[];
      for(var i=0;i<lt.plots.length;i++) if(lt.plots[i].seed) planted.push(i);
      if(!planted.length) return;
      var idx=planted[Math.floor(Math.random()*planted.length)];
      lt.event={type:'bug',idx:idx};
      var cp=LT_cropById(lt.plots[idx].seed);
      showModal('<h2>灵田虫灾</h2><div class="mdesc">第'+(idx+1)+'块灵田遭噬灵虫啃食，「'+(cp?cp.name:'灵植')+'」进度受损 15%。是否除虫？</div>'+
        '<div class="btn-row"><button class="btn gold" data-act="ltDeBug">除虫（100灵石）</button><button class="btn ghost" data-act="ltAbandon">忍痛放弃</button></div>');
    }else{
      this.addLingShi(80);
      this.lingTianLog('一只仙鹤衔来灵石 80 相赠');
      if(audio.gift) audio.gift();
      showModal('<h2>仙鹤衔礼</h2><div class="mdesc">一只仙鹤落在灵田边，衔来灵石 80 相赠，似有灵性。</div><div class="close-row"><button class="btn gold" data-act="closeModal">谢过仙鹤</button></div>');
    }
  },
  /** 除虫（花灵石，保留进度） */
  lingTianDeBug:function(){
    var lt=this.initLingTian();
    if(lt.event&&lt.event.type==='bug'){
      if(this.state.res.lingShi<100){ toast('灵石不足'); return; }
      this.state.res.lingShi-=100;
      this.lingTianLog('花费 100 灵石除尽噬灵虫');
      lt.event=null;
      closeModal();
      render();
    }
  },
  /** 放弃被虫害作物（进度-15%） */
  lingTianAbandon:function(){
    var lt=this.initLingTian();
    if(lt.event&&lt.event.type==='bug'){
      var p=lt.plots[lt.event.idx];
      if(p&&p.seed){ p.grown=Math.max(0,(p.grown||0)-LT_cropById(p.seed).time*.15); }
      this.lingTianLog('忍痛放弃除虫，作物受损');
      lt.event=null;
      closeModal();
      render();
    }
  },
  /** 道侣灵田可偷列表 */
  lingTianStealTargets:function(partner){
    if(!partner) return [];
    var ps=(partner.resources&&partner.resources.__state&&partner.resources.__state.lingTian)||null;
    if(!ps||!ps.plots) return [];
    var out=[];
    for(var i=0;i<ps.plots.length;i++){
      var p=ps.plots[i];
      if(p&&p.seed){ var c=LT_cropById(p.seed); if(c&&(p.grown||0)>=c.time*Math.pow(.9,p.water||0)) out.push({idx:i,crop:c}); }
    }
    return out;
  },
  /** 偷采道侣灵田（每日3次，偷50%产出） */
  lingTianStealFromPartner:function(idx){
    var lt=this.initLingTian(),self=this;
    this.initLingTian();
    if(lt.today.steal>=3){ toast('今日已偷采 3 次，明日再来'); return; }
    DB.loadPartnerProfile(function(partner){
      if(!partner){ toast('对方宗门不存在'); return; }
      var ps=(partner.resources&&partner.resources.__state&&partner.resources.__state.lingTian)||null;
      if(!ps||!ps.plots||!ps.plots[idx]){ toast('对方灵田未开垦'); return; }
      var p=ps.plots[idx];
      if(!p||!p.seed){ toast('该地块没有作物'); return; }
      var c=LT_cropById(p.seed);
      if(!c||(p.grown||0)<c.time*Math.pow(.9,p.water||0)){ toast('尚未成熟，偷不得'); return; }
      var yld={};
      for(var k in c.yield) yld[k]=Math.max(1,Math.floor(c.yield[k]*.5));
      lt.today.steal++; lt.stats.steal++;
      self.lingTianApplyYield(yld,1);
      self.state.karma=Math.max(-30,(self.state.karma||0)-1);
      self.lingTianLog('偷采了道侣的「'+c.name+'」：'+self.lingTianYieldText(yld,1)+'（业力-1）');
      self.addLog('潜入道侣灵田，偷采「'+c.name+'」'+self.lingTianYieldText(yld,1)+'，业力微损',true);
      DB.sendInteraction(partner.id,'steal',{crop:c.name,detail:self.lingTianYieldText(yld,1)},function(){});
      if(audio.steal) audio.steal();
      self.checkAchievements();
      render();
    });
  },
  /** 为道侣灵田浇灌灵气（每日5次，功德+1） */
  lingTianWaterPartner:function(){
    var lt=this.initLingTian(),self=this;
    if(lt.today.water>=5){ toast('今日已浇灌 5 次，明日再来'); return; }
    DB.loadPartnerProfile(function(partner){
      if(!partner){ toast('对方宗门不存在'); return; }
      lt.today.water++; lt.stats.water++;
      self.count('water',1);
      self.state.karma=Math.min(30,(self.state.karma||0)+1);
      self.lingTianLog('为道侣灵田浇灌灵气（功德+1）');
      DB.sendInteraction(partner.id,'water',{},function(){});
      if(audio.water) audio.water();
      render();
    });
  },
  /* ---------------- 情侣签到系统 ---------------- */
  todayStr:function(){ var d=new Date(); return d.getFullYear()+'-'+((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate(); },
  /** 计算连续签到天数（含今天） */
  streakOf:function(records,today){
    var days={},i,d=new Date(today+'T00:00:00');
    for(i=0;i<records.length;i++) if(records[i].day) days[records[i].day]=true;
    var streak=0,cur=today;
    if(!days[cur]) return 0;
    while(days[cur]){
      streak++;
      d.setDate(d.getDate()-1);
      cur=d.getFullYear()+'-'+((d.getMonth()+1)<10?'0':'')+(d.getMonth()+1)+'-'+(d.getDate()<10?'0':'')+d.getDate();
    }
    return streak;
  },
  /** 拉取云端签到记录 → 更新 state.checkin */
  checkinStatus:function(cb){
    var self=this,today=this.todayStr();
    DB.loadCheckins(function(records){
      var streak=self.streakOf(records,today);
      var done=records.some(function(r){return r.day===today;});
      self.state.checkin={day:today,streak:streak,total:records.length,done:done};
      if(cb) cb(done,streak);
    });
  },
  /** 签到奖励（按连续天数） */
  checkinReward:function(streak){
    if(streak>=7) return {xianYu:3,lingShi:500,peiyuan:2};
    if(streak>=5) return {xianYu:1,lingShi:400};
    if(streak>=3) return {lingShi:300,peiyuan:1};
    if(streak>=2) return {lingShi:200};
    return {lingShi:100};
  },
  applyReward:function(r){ for(var k in r){ if(k==='lingShi') this.addLingShi(r[k]); else if(k==='xianYu') this.addXianYu(r[k]); else if(k==='shengWang') this.addShengWang(r[k]); else if(k==='kuangShi') this.addKuangShi(r[k]); else this.addPill(k,r[k]); } },
  rewardText:function(r){ var parts=[]; for(var k in r){ var nm=k==='lingShi'?'灵石':k==='xianYu'?'仙玉':k==='shengWang'?'声望':k==='kuangShi'?'矿石':(PILLS[k]?PILLS[k].name:k); parts.push(nm+'×'+r[k]); } return parts.join('、'); },
  /** 执行签到 */
  doCheckin:function(){
    var g=this.state,self=this;
    // v4.4 修复竞态：checkinStatus 是异步的，旧代码未加载完就判定 done，
    // 登录后立刻点击会绕过"今日已签"检查 → 重复入库（云端唯一约束报错=签到不了）。
    if(!g.checkin||!g.checkin.day){
      this.checkinStatus(function(done){
        if(done){ toast('今日已签到'); return; }
        self._doCheckin();
      });
      return;
    }
    if(g.checkin.done){ toast('今日已签到'); return; }
    this._doCheckin();
  },
  /** 实际执行签到（内部方法，先经 doCheckin 状态判定） */
  _doCheckin:function(){
    var self=this;
    DB.doCheckin(function(ok){
      if(!ok){ toast('签到失败，请重试'); return; }
      self.checkinStatus(function(done,streak){
        var reward=self.checkinReward(streak);
        self.applyReward(reward);
        self.count('checkin',1);
        self.addLog('今日签到成功！连续 '+streak+' 天，获 '+self.rewardText(reward),true);
        self.historyPush('晨钟签到','连续第 '+streak+' 天签到');
        self.trail('checkin','完成每日签到，连续 '+streak+' 天');
        self.addQiyuan(1,'签到');
        if(audio.recruit) audio.recruit();
        DB.partnerCheckinToday(function(pdone){
          var extra=pdone?'<div class="m-row"><span>道侣今日也已签到</span><b class="num-up">同心如意</b></div>':'<div class="m-row"><span>道侣今日未签到</span><b>去提醒TA</b></div>';
          showModal('<h2>晨钟签到</h2><div class="mdesc">连续签到 <b>'+streak+'</b> 天，道心愈坚！</div>'+
            '<div class="m-row"><span>奖励</span><b class="num-gold">'+self.rewardText(reward)+'</b></div>'+extra+
            '<div class="close-row"><button class="btn gold" data-act="closeModal">收下</button></div>');
        });
        self.checkAchievements();
        render();
      });
    });
  },
  /* ---------------- 世界天气 ---------------- */
  syncWeather:function(cb){
    var g=this.state,today=this.todayStr(),self=this;
    if(g.weather&&g.weather.day===today){ if(cb) cb(); return; }
    DB.loadWorld(function(w){
      var wt=(w&&w.weather&&w.weather.day===today)?w.weather:null;
      if(wt){ g.weather=wt; }
      else{
        var pickW=WEATHER_TYPES[Math.floor(Math.random()*WEATHER_TYPES.length)];
        g.weather={type:pickW.id,day:today};
        var ns={}; for(var k in (w||{})) ns[k]=w[k];
        ns.weather=g.weather;
        DB.saveWorld(ns,function(){});
      }
      if(cb) cb();
    });
  },
  weatherDef:function(){ var t=this.state.weather; return t?WEATHER_byId(t.type):null; },
  weatherCultMult:function(){ var w=this.weatherDef(); return w?w.cult:1; },
  weatherEarnMult:function(){ var w=this.weatherDef(); return w?w.earn:1; },
  /** 灵田天气生长系数 */
  weatherLtMult:function(){
    var w=this.weatherDef(); if(!w) return 1;
    if(w.id==='lingyu') return 1.25;
    if(w.id==='chao') return 1.20;
    if(w.id==='aurora') return 1.30;
    if(w.id==='liuxing') return 1.10;
    return 1;
  },
  /** 是否极光天（收获变异判定） */
  isAuroraDay:function(){ var w=this.weatherDef(); return !!(w&&w.id==='aurora'); },
  /* ---------------- 每日运势（日期+账号种子，当日稳定） ---------------- */
  fateOfToday:function(){
    var g=this.state,today=this.todayStr();
    if(g.fate&&g.fate.day===today) return g.fate;
    var seedStr=today+'|'+(DB.profile?DB.profile.email:''),h=0,i;
    for(i=0;i<seedStr.length;i++){ h=(h*31+seedStr.charCodeAt(i))>>>0; }
    var f=FATE_POOL[h%FATE_POOL.length];
    g.fate={lv:f.lv,name:f.name,text:f.text,day:today};
    return g.fate;
  },
  fateShow:function(){
    var f=this.fateOfToday();
    this.count('fate',1);
    showModal('<h2>今日运势 · '+f.name+'</h2><div class="mdesc">'+f.text+'</div><div class="close-row"><button class="btn gold" data-act="closeModal">收下</button></div>');
    audio.gift?audio.gift():null;
  },
  /* ---------------- 彤华节倒计时 ---------------- */
  daysToTonghua:function(){
    var now=new Date(),y=now.getFullYear();
    if(now.getMonth()===10&&now.getDate()===12) return 0;   // 彤华节当天
    var target=new Date(y,10,12);
    if(now>target) target=new Date(y+1,10,12);
    return Math.ceil((target-now)/86400000);
  },
  /* ---------------- 云相册（UI 见 showAlbum） ---------------- */
  albumRefresh:function(boxEl){
    var box=boxEl||document.getElementById('albumBox');
    if(!box) return;
    box.innerHTML='<span style="opacity:.7">正在翻开相册……</span>';
    DB.albumList(function(items){
      if(!items||!items.length){ box.innerHTML='<div class="empty">相册还空着——点「存入一张」放进第一张回忆吧</div>'; return; }
      box.innerHTML=items.map(function(it){
        return '<div style="position:relative;display:inline-block;margin:4px;vertical-align:top"><img src="'+it.signedUrl+'" style="width:86px;height:86px;object-fit:cover;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.25)">'+
          '<button class="btn tiny" data-act="albumDel" data-id="'+it.name+'" style="position:absolute;right:2px;bottom:2px;font-size:9px;padding:1px 5px">删</button></div>';
      }).join('');
    });
  },
  albumUpload:function(file){
    if(!file){ toast('未选择图片'); return; }
    if(!/image\//.test(file.type)){ toast('只能传图片哦'); return; }
    if(file.size>5*1024*1024){ toast('图片不能超过 5MB'); return; }
    var self=this;
    DB.albumUpload(file,function(ok,err){
      if(!ok){ toast(err||'上传失败'); return; }
      toast('已存入云端相册');
      self.albumRefresh();
    });
  },
  albumDelete:function(name){
    var self=this;
    showConfirm('删除照片','确定删除这张回忆吗？',function(){
      DB.albumDelete(name,function(ok){ if(ok){ toast('已删除'); self.albumRefresh(); } else toast('删除失败'); });
    });
  },
  /* ---------------- 随机事件 ---------------- */
  triggerRandomEvent:function(){
    var g=this.state,pool=EVENTS.slice();
    if(this.state.karma<0&&Math.random()<.3){ pool=EVENTS.filter(function(e){return e.karma<0;}); if(!pool.length) pool=EVENTS; }
    else if(this.state.karma>0&&Math.random()<.3){ pool=EVENTS.filter(function(e){return e.karma>0;}); if(!pool.length) pool=EVENTS; }
    var ev=pick(pool);
    ui.curEvent=ev;
    this.state.stats.event++;
    audio.event();
    var opts=ev.options.map(function(o,i){
      var dis='';
      if(o.needIdle&&!this.hasIdle()) dis='disabled';
      if(o.need&&!o.need(this)) dis='disabled';
      return '<button class="btn opt" data-act="eventOpt" data-idx="'+i+'" '+dis+'><div class="opt-t">'+o.text+'</div><div class="opt-d">'+(o.hint||'')+'</div></button>';
    }.bind(this)).join('');
    showModal('<h2>'+ev.title+'</h2><div class="mdesc">'+ev.desc+'</div>'+opts);
  },
  /* ---------------- 反作弊：校验和 / 运行时检查 / 道心惩罚 ---------------- */
  /** 状态校验和（FNV-1a）：资源/设施/弟子关键字段的轻量指纹 */
  checksum:function(){
    var s=this.state,str=''+s.sectName+'|'+s.res.lingShi+'|'+s.res.shengWang+'|'+s.res.kuangShi+'|'+s.res.xianYu+'|'+s.facilities.juling+'|'+s.facilities.liandan+'|'+s.sectLv+'|'+s.disciples.length,i,d;
    for(i=0;i<s.disciples.length;i++){ d=s.disciples[i]; str+='|'+d.id+'|'+d.realm+'|'+Math.floor(d.exp); }
    var h=2166136261;
    for(i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
    return (h>>>0).toString(36);
  },
  /** 道心惩罚：检测到异常篡改时施加（业力-10 + 修炼-30% 30分钟） */
  daoxinPunish:function(reason){
    var s=this.state;
    s.karma-=10;
    s.buffs.push({id:'daoxin',label:'道心蒙尘',type:'cult',mult:-.3,left:1800});
    this.addLog('【道心警钟】检测到异常：'+reason+'。业力-10，修炼速度-30%持续30分钟',true);
    this.historyPush('道心警钟',reason);
  },
  /** 运行时状态检查（每 60 秒由 tick 调用）：纠正非法值并惩罚 */
  checkSanity:function(){
    var s=this.state,issues=[],i,d;
    if(s.res.lingShi<0||s.res.shengWang<0||s.res.kuangShi<0||s.res.xianYu<0) issues.push('资源出现负值');
    if(s.res.lingShi>1e12||s.res.xianYu>1e6||s.diyun<0) issues.push('资源数值异常');
    for(i=0;i<s.disciples.length;i++){ d=s.disciples[i];
      if(!d||!d.id||typeof d.realm!=='number'||d.realm<0||d.realm>REALMS.length) issues.push('弟子数据异常');
      if(d.exp<0) issues.push('弟子修为为负');
    }
    if(issues.length){
      if(s.res.lingShi<0) s.res.lingShi=0;
      if(s.res.shengWang<0) s.res.shengWang=0;
      if(s.res.kuangShi<0) s.res.kuangShi=0;
      if(s.res.xianYu<0) s.res.xianYu=0;
      this.daoxinPunish(issues[0]);
    }
  },
  /* ---------------- 存档（本地备份 + 云端同步） ---------------- */
  /** 保存到 DB：profile 字段 + 弟子表；本地备份 localStorage */
  saveToDB:function(silent){
    var self=this;
    if(!DB.profile) return;
    self._saveSilent=silent;
    // v5 修复：串行化保存。在途时只标记待保存，完成后用最新状态补发，杜绝旧快照覆盖新数据（资源回滚）
    if(self._saving){ self._savePending=true; return; }
    self._flushSave();
  },
  /** v5 串行保存实现（同一时刻最多一个云端请求） */
  _flushSave:function(){
    var self=this,g=this.state;
    if(!DB.profile) return;
    self._saving=true;
    self._savePending=false;
    var silent=self._saveSilent;
    DB.profile.resources={spirit_stones:Math.floor(g.res.lingShi),reputation:Math.floor(g.res.shengWang),pills:g.res.pills,ores:Math.floor(g.res.kuangShi),immortal_jade:g.res.xianYu,beast_material:Math.floor(g.res.beastMaterial),zhuyan_flower:g.res.zhuyanFlower,juan:g.res.juan,equipBank:g.res.equipBank};
    DB.profile.facilities=g.facilities;
    DB.profile.sect_level=g.sectLv;
    DB.profile.karma=g.karma;
    DB.profile.motto=g.motto;
    DB.profile.history=g.history;
    // 完整状态备份到 resources.__state（resources 为 JSONB 可容纳，无需额外表列）
    var st=JSON.parse(JSON.stringify(g));
    delete st.disciples;
    if(!DB.profile.resources) DB.profile.resources={};
    DB.profile.resources.__state=st;
    DB.profile.resources.__checksum=this.checksum();   // 反作弊校验和
    // 本地备份（离线容灾）
    try{ localStorage.setItem('tyj_backup_'+DB.profile.email,JSON.stringify({profile:DB.profile,disciples:g.disciples})); }catch(e){}
    DB.saveProfile(function(ok){
      self._saving=false;
      if(!silent&&!ok) toast('云端保存失败，已保留本地备份');
      // 保存状态指示
      var cbEl=document.getElementById('connBar');
      if(cbEl&&DB.online) cbEl.textContent=(DB.mode==='real'?'已连通仙界（Supabase）':'本地双人演示模式')+' · 已保存 '+timeStr(Date.now());
      // 在途期间有新保存请求 → 用最新状态补发
      if(self._savePending) self._flushSave();
    });
    DB.saveDisciples(g.disciples,function(){});
  },
  /** 从 DB 加载状态 */
  loadFromDB:function(cb){
    var self=this;
    var email=DB.profile.email;
    var backup=null;
    try{ var raw=localStorage.getItem('tyj_backup_'+email); if(raw) backup=JSON.parse(raw); }catch(e){}
    // 优先云端 __state，其次本地备份（__state 存于 resources JSONB 中）
    var st=DB.profile.__state||(DB.profile.resources&&DB.profile.resources.__state)||(backup&&backup.profile.__state);
    // v4.4 修复：新档 version=4，旧代码只认 version===3 导致 v4 存档无法加载（每次刷新=开新档）。
    // 改为 >=3：兼容 v3 旧档与 v4/v5 新档；低版本缺字段由各系统 || 兜底。
    if(st&&st.version>=3){
      self.state=st;
      self.state.profileId=DB.profile.id;
      self.initLingTian();   // 兼容旧存档：无灵田状态时初始化
      if(backup&&backup.disciples&&backup.disciples.length) self.state.disciples=backup.disciples;
      // v5 修复：旧档弟子补默认字段（旧版本弟子可能无 equipment/traits/gongfa，会导致装备/修炼链路崩溃）
      if(self.state.disciples){
        for(var di=0;di<self.state.disciples.length;di++){
          var dd=self.state.disciples[di];
          if(dd&&typeof dd==='object'){
            if(!dd.equipment||typeof dd.equipment!=='object') dd.equipment={wuqi:null,fangju:null,shishi:null,fabao:null};
            if(!dd.traits||!dd.traits.length) dd.traits=[];
            if(!dd.gongfa||typeof dd.gongfa!=='object') dd.gongfa={};
            if(typeof dd.realm!=='number') dd.realm=0;
            if(typeof dd.exp!=='number') dd.exp=0;
            if(typeof dd.wuXing!=='number') dd.wuXing=50;
            if(typeof dd.fuYuan!=='number') dd.fuYuan=50;
          }
        }
      }
      self.isNew=false;
      self.lastTick=Date.now();
      // 反作弊：校验和验证（在离线结算之前，状态尚未变动）
      var cs=DB.profile.__checksum||(DB.profile.resources&&DB.profile.resources.__checksum)||(backup&&backup.profile.__checksum);
      if(cs&&cs!==self.checksum()){
        self.daoxinPunish('存档校验和不匹配');
        self.state.lastTime=Date.now();   // 跳过离线结算，先让玩家面对惩罚
      }else{
        // 离线结算
        var delta=Math.min(Math.max(0,(Date.now()-st.lastTime)/1000),86400);
        self.applyOffline(delta);
        self.state.lastTime=Date.now();
      }
      if(cb) cb();
    }else{
      // 无存档 → 新游戏
      self.state=self.newGame(DB.profile.sect_name,DB.profile.master_title,DB.profile.motto||'');
      self.state.profileId=DB.profile.id;
      self.isNew=true;
      if(cb) cb();
    }
    // 读取对方宗门等级
    DB.loadPartnerProfile(function(partner){
      if(partner){ self.otherSectLv=partner.sect_level||1; self.otherSectName=partner.sect_name||''; self.otherBeastName=(partner.resources&&partner.resources.__state&&partner.resources.__state.beastName)||''; self.otherXiuDone=!!(partner.resources&&partner.resources.__state&&partner.resources.__state.xiuDone&&partner.resources.__state.xiuDate===self.todayStr()); if(self.xiuBothDone&&self.xiuBothDone()) self.xiuSettle(); self.otherNoteDate=(partner.resources&&partner.resources.__state&&partner.resources.__state.noteDate)||''; self.otherNoteText=(partner.resources&&partner.resources.__state&&partner.resources.__state.noteText)||''; }
    });
  },
};

/* 道号池 */
var DAO_NAMES=['云鹤','青玄','玄机','紫阳','玉衡','清虚','凌云','太虚','苍梧','明心','孤鸿','白鹿','赤松','听雪','观澜','漱玉','含章','抱朴','守拙','惊鸿','知微','望舒','归藏','闻道','青鸾','丹朱','彤儿'];
var DAO_TITLES=['真人','子','道人','居士','散人','上人','仙长'];

/* =====================================================================
 * 随机事件库（30+，含情感与业力事件）
 * karma: 1=功德事件 -1=杀业事件 0=中性
 * ===================================================================== */
var EVENTS=[
  {title:'灵泉喷涌',karma:0,desc:'后山灵泉突然喷涌而出，灵气四溢。',options:[
    {text:'引灵泉入聚灵阵',hint:'修炼+50%持续120秒',effect:function(g){g.state.buffs.push({id:'lq',label:'灵泉灌注',type:'cult',mult:.5,left:120});g.addLog('灵泉灌注聚灵阵，全宗修炼速度+50%！',true);}},
    {text:'取水贩卖',hint:'获得500灵石',effect:function(g){g.addLingShi(500);g.addLog('取灵泉水贩卖，获得500灵石');}}]},
  {title:'灵脉异动',karma:0,desc:'宗门下灵脉涌动，地气翻腾。',options:[
    {text:'强行开采',hint:'灵石+3000，聚灵阵受损3小时',effect:function(g){g.addLingShi(3000);g.state.buffs.push({id:'lmy',label:'灵脉反噬',type:'cult',mult:-.5,left:10800});g.addKarma(-5);g.addLog('强行开采获3000灵石，但灵脉反噬！',true);}},
    {text:'疏导灵脉',hint:'修炼+30%持续600秒',effect:function(g){g.state.buffs.push({id:'lms',label:'灵脉疏导',type:'cult',mult:.3,left:600});g.addKarma(5);g.addLog('疏导灵脉，全宗修炼+30%！',true);}}]},
  {title:'上古洞府现世',karma:0,desc:'山中浮现一座上古洞府，霞光冲天。',options:[
    {text:'派遣弟子探索',hint:'80%获得法宝，20%受伤',needIdle:true,effect:function(g){var d=g.randomIdle();if(!d)return;if(Math.random()<.8){var e=g.genEquip('fabao',2,null,'上古洞府');g.state.res.equipBank.push(e);g.addLog(d.name+'探索洞府，获得'+e.qualityName+'·'+e.base+'！',true);}else{d.injury={left:300,total:300};d.state='injured';g.addLog(d.name+'在洞府中遇险受伤！',true);}}},
    {text:'视而不见',hint:'相安无事',effect:function(g){g.addLog('掌门选择无视洞府');}}]},
  {title:'魔修来袭',karma:0,desc:'一股魔修势力逼近山门。',options:[
    {text:'开启护山大阵',hint:'消耗800灵石，无损失',need:function(g){return g.state.res.lingShi>=800;},effect:function(g){g.state.res.lingShi-=800;g.addLog('护山大阵开启，魔修无功而返！');}},
    {text:'弟子迎战',hint:'胜得声望败受伤',needIdle:true,effect:function(g){var d=g.bestIdle();if(!d)return;if(Math.random()<.5+d.realm*.06){var sw=irand(80,140);g.addShengWang(sw);g.addLog(d.name+'击退魔修，声望+'+sw+'！',true);}else{d.injury={left:300,total:300};d.state='injured';g.addLog(d.name+'不敌魔修受伤！',true);}}}]},
  {title:'散修挑战',karma:0,desc:'一名散修上门，扬言要挑战贵宗。',options:[
    {text:'派最强弟子迎战',hint:'胜得法宝，败则受伤',needIdle:true,effect:function(g){var d=g.bestIdle();if(!d)return;if(Math.random()<.55+d.realm*.05){var e=g.genEquip('shishi',2,null,'散修战利');g.state.res.equipBank.push(e);g.addLog(d.name+'击败散修，赢得'+e.qualityName+'·'+e.base+'！',true);}else{d.injury={left:300,total:300};d.state='injured';g.addLog(d.name+'不敌散修受伤！',true);}}},
    {text:'婉言谢绝',hint:'声望-10',effect:function(g){g.addShengWang(-10);g.addLog('婉拒散修挑战，声望-10');}}]},
  {title:'天降陨石',karma:0,desc:'陨石坠落宗门后山，火光冲天。',options:[
    {text:'全力开采',hint:'矿石+50，可能引来妖兽',effect:function(g){g.addKuangShi(50);if(Math.random()<.4){var d=g.randomIdle();if(d){d.injury={left:240,total:240};d.state='injured';g.addLog('开采时妖兽突袭，弟子受伤！',true);}else g.addLog('矿石+50');}}},
    {text:'整块售出',hint:'获得800灵石',effect:function(g){g.addLingShi(800);g.addLog('将陨石售出，获得800灵石');}}]},
  {title:'神秘商人',karma:0,desc:'一名来历不明的商人登门兜售灵光法宝。',options:[
    {text:'购置法宝',hint:'消耗800灵石，得灵品法宝',need:function(g){return g.state.res.lingShi>=800;},effect:function(g){g.state.res.lingShi-=800;var e=g.genEquip('fabao',1,null,'神秘商人');g.state.res.equipBank.push(e);g.addLog('购得'+e.qualityName+'·'+e.base+'！',true);}},
    {text:'婉言谢绝',hint:'无',effect:function(g){g.addLog('掌门婉拒了神秘商人');}}]},
  {title:'古籍残卷',karma:0,desc:'弟子在藏经阁角落发现一卷残破古籍。',options:[
    {text:'参悟研读',hint:'全体弟子悟性+3',effect:function(g){for(var i=0;i<g.state.disciples.length;i++) g.state.disciples[i].wuXing=Math.min(100,g.state.disciples[i].wuXing+3);g.addLog('参悟古籍，全体弟子悟性+3！',true);}},
    {text:'转手出售',hint:'获得500灵石',effect:function(g){g.addLingShi(500);g.addLog('古籍售出，获得500灵石');}}]},
  {title:'弟子顿悟',karma:0,desc:'一名弟子在修行中突然顿悟。',options:[
    {text:'全宗传道',hint:'修炼+20%持续300秒',effect:function(g){g.state.buffs.push({id:'dw',label:'顿悟传道',type:'cult',mult:.2,left:300});g.addLog('顿悟弟子开坛传道，全宗修炼+20%！',true);}},
    {text:'单独点化',hint:'声望+60',effect:function(g){g.addShengWang(60);g.addLog('单独点化顿悟弟子，声望+60');}}]},
  {title:'矿脉塌方',karma:1,desc:'山下矿脉塌方，矿工被困。',options:[
    {text:'组织救援',hint:'消耗200灵石，矿石+30，功德+3',need:function(g){return g.state.res.lingShi>=200;},effect:function(g){g.state.res.lingShi-=200;g.addKuangShi(30);g.addKarma(3);g.addLog('组织救援矿工，获得30矿石');}},
    {text:'坐视不理',hint:'无损失',effect:function(g){g.addKarma(-2);g.addLog('掌门选择不理会矿难，弟子们心有戚戚');}}]},
  {title:'丹炉异火',karma:0,desc:'炼丹房炉火异变，燃起青色异火。',options:[
    {text:'借势炼丹',hint:'炼丹产量+50%持续180秒',effect:function(g){g.state.buffs.push({id:'yh',label:'异火炼丹',type:'alch',mult:.5,left:180});g.addLog('异火炼丹，产量大增！',true);}},
    {text:'取火售予坊市',hint:'获得400灵石',effect:function(g){g.addLingShi(400);g.addLog('收取一缕异火售出，获得400灵石');}}]},
  {title:'邪修偷袭药园',karma:0,desc:'数名邪修趁夜偷袭灵药园！',options:[
    {text:'设伏反击',hint:'胜得声望败受伤',needIdle:true,effect:function(g){var d=g.bestIdle();if(!d)return;if(Math.random()<.5+d.realm*.05){var sw=irand(60,120);g.addShengWang(sw);g.addLog(d.name+'击退邪修，声望+'+sw+'！',true);}else{d.injury={left:240,total:240};d.state='injured';g.addLog(d.name+'被邪修所伤！',true);}}},
    {text:'加固阵法',hint:'消耗300灵石',need:function(g){return g.state.res.lingShi>=300;},effect:function(g){g.state.res.lingShi-=300;g.addLog('加固护园阵法，邪修无功而返');}}]},
  {title:'灵鹤衔书',karma:0,desc:'一只灵鹤衔着金色信笺落在山门前。',options:[
    {text:'收下信笺',hint:'声望+120',effect:function(g){g.addShengWang(120);g.addLog('信笺乃上宗贺帖，声望+120！',true);}},
    {text:'放飞灵鹤',hint:'获得100灵石',effect:function(g){g.addLingShi(100);g.addLog('放飞灵鹤，发现谢礼100灵石');}}]},
  {title:'秘境灵气潮汐',karma:0,desc:'千里外秘境开启，灵气潮汐涌向山门。',options:[
    {text:'抓紧修炼',hint:'修炼+40%持续150秒',effect:function(g){g.state.buffs.push({id:'cx',label:'潮汐灵气',type:'cult',mult:.4,left:150});g.addLog('灵气潮汐涌来，全宗修炼+40%！',true);}},
    {text:'遣弟子探秘',hint:'随机弟子即刻探得法宝',needIdle:true,effect:function(g){var d=g.randomIdle();if(!d)return;var e=g.genEquip('wuqi',2,null,'秘境探秘');g.state.res.equipBank.push(e);g.addShengWang(80);g.addLingShi(300);g.addLog(d.name+'赶赴秘境，夺得'+e.qualityName+'·'+e.base+'、灵石300、声望80！',true);}}]},
  {title:'比武大会',karma:0,desc:'山下举办修仙界比武大会。',options:[
    {text:'举办门派大比',hint:'声望+150',effect:function(g){g.addShengWang(150);g.addLog('举办门派大比，声望+150！',true);}},
    {text:'闭门苦修',hint:'全体修为+8%',effect:function(g){for(var i=0;i<g.state.disciples.length;i++){g.state.disciples[i].exp+=g.expNeed(g.state.disciples[i])*.08;}g.addLog('闭门苦修，全体修为+8%');}}]},
  {title:'心魔劫',karma:0,desc:'一场无形心魔席卷全宗。',options:[
    {text:'静心打坐',hint:'突破率+10%持续300秒',effect:function(g){g.state.buffs.push({id:'xm',label:'静心凝神',type:'break',mult:.10,left:300});g.addLog('全宗静心打坐，突破率+10%！',true);}},
    {text:'以劫炼心',hint:'随机弟子50%悟性+5，50%受伤',effect:function(g){var pool=g.state.disciples.filter(function(d){return d.injury.left<=0;});if(!pool.length)return;var d=pick(pool);if(Math.random()<.5){d.wuXing=Math.min(100,d.wuXing+5);g.addLog(d.name+'渡过心魔，悟性+5！',true);}else{d.injury={left:240,total:240};d.state='injured';g.addLog(d.name+'被心魔所困，受伤240秒',true);}}}]},
  {title:'妖兽潮',karma:1,desc:'大批妖兽自深山涌出逼近山门！',options:[
    {text:'率众抵御',hint:'消耗500灵石，声望+150',need:function(g){return g.state.res.lingShi>=500;},effect:function(g){g.state.res.lingShi-=500;g.addShengWang(150);g.addKarma(2);g.addLog('率众抵御妖兽潮，声望+150！',true);}},
    {text:'闭门不出',hint:'无损失',effect:function(g){g.addLog('紧闭山门，妖兽潮自行散去');}}]},
  {title:'论道大会',karma:0,desc:'各大宗门联办论道大会。',options:[
    {text:'亲自赴会',hint:'声望+200',effect:function(g){g.addShengWang(200);g.addLog('掌门赴论道大会，声望+200！',true);}},
    {text:'携弟子旁听',hint:'全体悟性+2',effect:function(g){for(var i=0;i<g.state.disciples.length;i++) g.state.disciples[i].wuXing=Math.min(100,g.state.disciples[i].wuXing+2);g.addLog('携弟子旁听论道，全体悟性+2');}}]},
  {title:'福地显现',karma:0,desc:'宗门外发现灵气盎然的洞天福地。',options:[
    {text:'开放修炼',hint:'修炼+25%持续240秒',effect:function(g){g.state.buffs.push({id:'fd',label:'福地灵气',type:'cult',mult:.25,left:240});g.addLog('开放福地，全宗修炼+25%！',true);}},
    {text:'圈地收租',hint:'获得800灵石',effect:function(g){g.addLingShi(800);g.addLog('圈定福地收租，获得800灵石');}}]},
  {title:'灵兽暴走',karma:0,desc:'灵兽园中灵兽突然狂躁暴走！',options:[
    {text:'安抚灵兽',hint:'消耗200灵石，灵兽材料+30',need:function(g){return g.state.res.lingShi>=200;},effect:function(g){g.state.res.lingShi-=200;g.addBeast(30);g.addLog('安抚灵兽，获得灵兽材料30');}},
    {text:'强行镇压',hint:'胜得材料，败受伤',needIdle:true,effect:function(g){var d=g.bestIdle();if(!d)return;if(Math.random()<.6){g.addBeast(50);g.addLog(d.name+'镇压灵兽，获得灵兽材料50！',true);}else{d.injury={left:240,total:240};d.state='injured';g.addLog(d.name+'被灵兽所伤！',true);}}}]},
  {title:'功法残卷出世',karma:0,desc:'坊间流传一本残缺上古功法。',options:[
    {text:'出手争夺',hint:'战斗，赢得残卷',needIdle:true,effect:function(g){var d=g.bestIdle();if(!d)return;if(Math.random()<.7){var jn=pick(['fenhuang','wanmu','xingchen']);g.addJuan(jn,1);g.addLog(d.name+'夺回'+g.juanName(jn)+'残卷×1！',true);}else{d.injury={left:240,total:240};d.state='injured';g.addLog(d.name+'争夺失败受伤',true);}}},
    {text:'围观即可',hint:'声望+50',effect:function(g){g.addShengWang(50);g.addLog('围观争夺，声望+50');}}]},
  {title:'仙人托梦',karma:1,desc:'掌门夜梦仙人指点。',options:[
    {text:'参悟梦境',hint:'全体弟子悟性+2',effect:function(g){for(var i=0;i<g.state.disciples.length;i++) g.state.disciples[i].wuXing=Math.min(100,g.state.disciples[i].wuXing+2);g.addLog('参悟仙人梦境，全体悟性+2！',true);}},
    {text:'焚香祭天',hint:'声望+100，功德+2',effect:function(g){g.addShengWang(100);g.addKarma(2);g.addLog('焚香祭天，声望+100');}}]},
  {title:'弟子叛逃',karma:-1,desc:'一名弟子心生去意，欲叛出宗门。',options:[
    {text:'追回弟子',hint:'战斗，赢则归心输声望受损',needIdle:true,effect:function(g){var d=g.randomIdle();if(!d)return;if(Math.random()<.75){g.addLog(d.name+'追回叛逃弟子，弟子归心',true);}else{g.addShengWang(-50);d.injury={left:240,total:240};d.state='injured';g.addLog('追捕失败，声望-50',true);}}},
    {text:'放其离去',hint:'损失1名弟子，声望+30',effect:function(g){var pool=g.state.disciples.filter(function(x){return x.state==='idle';});if(pool.length){var d=pick(pool);g.state.disciples.splice(g.state.disciples.indexOf(d),1);g.addShengWang(30);g.addLog('放走'+d.name+'，声望+30');}else g.addLog('无弟子可放行');}}]},
  {title:'除魔卫道',karma:1,desc:'一伙邪修在附近村庄作恶。',options:[
    {text:'遣弟子除魔',hint:'战斗，功德+5，声望+80',needIdle:true,effect:function(g){var d=g.bestIdle();if(!d)return;if(Math.random()<.6+d.realm*.05){g.addShengWang(80);g.addKarma(5);g.addLog(d.name+'除魔卫道，功德+5，声望+80！',true);}else{d.injury={left:300,total:300};d.state='injured';g.addLog(d.name+'除魔负伤',true);}}},
    {text:'事不关己',hint:'杀业+3',effect:function(g){g.addKarma(-3);g.addLog('掌门选择不闻不问，业力+3');}}]},
  {title:'朱颜花开',karma:0,desc:'彤云谷传来消息：朱颜花开了。',options:[
    {text:'遣弟子采撷',hint:'朱颜花+2',needIdle:true,effect:function(g){var d=g.randomIdle();if(!d)return;g.addZhuyan(2);g.addLog(d.name+'采得朱颜花×2，其花如霞，经年不谢',true);}},
    {text:'移栽宗门',hint:'消耗500灵石，朱颜花+1且宗门氛围提升',need:function(g){return g.state.res.lingShi>=500;},effect:function(g){g.state.res.lingShi-=500;g.addZhuyan(1);g.addLog('移栽朱颜花入宗门，霞光满园',true);}}]},
  {title:'和合石之约',karma:0,desc:'弟子游历念恩峰，见和合石前一对璧人焚香盟誓。',options:[
    {text:'感悟情缘',hint:'全体弟子好感+，修炼+15%持续300秒',effect:function(g){g.state.buffs.push({id:'hh',label:'和合石祝福',type:'cult',mult:.15,left:300});g.addLog('和合石前感悟情缘，全宗修炼+15%！',true);}},
    {text:'为婉彤祈福',hint:'声望+100（若已结盟，婉彤收到祝福）',effect:function(g){g.addShengWang(100);g.addLog('为'+CONFIG.PARTNER_NAME+'在念恩峰祈福，山风亦传情',true);}}]},
  {title:'红娘传书',karma:0,desc:'红娘仙姑托灵鹤送来一封红帖。',options:[
    {text:'收下红帖',hint:'声望+80，若已结盟双方各得灵石',effect:function(g){g.addShengWang(80);g.addLingShi(200);g.addLog('红帖乃仙姑贺礼，声望+80、灵石+200',true);}},
    {text:'焚香回礼',hint:'功德+2',effect:function(g){g.addKarma(2);g.addLog('焚香回礼，仙姑欣然',true);}}]},
  {title:'天梯论道',karma:0,desc:'传闻天梯顶端有仙人论道，各派争相前往。',options:[
    {text:'遣最强弟子应战',hint:'胜则声望+300',needIdle:true,effect:function(g){var d=g.bestIdle();if(!d)return;if(Math.random()<.4+d.realm*.06){g.addShengWang(300);g.addLog(d.name+'在天梯论道中折服群修，声望+300！',true);}else{d.injury={left:300,total:300};d.state='injured';g.addLog(d.name+'论道落败受伤',true);}}},
    {text:'避而不战',hint:'声望-20',effect:function(g){g.addShengWang(-20);g.addLog('避而不战，声望-20');}}]},
  {title:'丰收祭典',karma:0,desc:'宗门举办丰收祭典，万民同乐。',options:[
    {text:'大操大办',hint:'消耗500灵石，声望+200',need:function(g){return g.state.res.lingShi>=500;},effect:function(g){g.state.res.lingShi-=500;g.addShengWang(200);g.addLog('大办祭典，声望+200！',true);}},
    {text:'从简操办',hint:'灵石+300',effect:function(g){g.addLingShi(300);g.addLog('祭典从简，省下300灵石');}}]},
  {title:'同心结缘',karma:0,desc:'念恩峰和合石发出微光，似有仙缘感应。',options:[
    {text:'遣道侣弟子参拜',hint:'获得「同心结」饰品（双方同时在线修炼+20%）',needIdle:true,effect:function(g){
      var d=g.bestIdle(); if(!d) return;
      var e={id:'e'+Date.now()+'_'+Math.floor(Math.random()*99999),part:'shishi',base:'同心结',quality:4,qualityName:'先天至宝',affixes:[],set:null,lv:0,baseAtk:2,baseDef:2,baseHp:20,special:'tongxin',story:'恩和真人与婉彤仙子定情之物，一结同心，万古不渝',source:'念恩峰和合石',awaken:0,bloodBound:false,infuse:null};
      g.state.res.equipBank.push(e);
      g.addLog('和合石前得【同心结】！此乃恩和与婉彤定情之物，双方同时在线时修炼+20%',true);
      g.historyPush('同心',CONFIG.DEVELOPER_NAME+'与'+CONFIG.PARTNER_NAME+'同心结缘');
    }},
    {text:'焚香致意',hint:'声望+60',effect:function(g){g.addShengWang(60);g.addLog('焚香致意和合石，声望+60');}}]},
];

/* =====================================================================
 * 渲染模块
 * ===================================================================== */
var topbar=document.getElementById('topbar');
var tabsEl=document.getElementById('tabs');
var contentEl=document.getElementById('content');
var bottomEl=document.getElementById('bottombar');
var mroot=document.getElementById('modal-root');
var mbox=document.getElementById('modal-box');
var ui={tab:'zongmen',selected:new Set(),modal:false,curEvent:null,confirmCb:null,partySel:[],partyFormation:'qianfeng',regionSel:null,detailDisciple:null,envTab:null,opsCollapsed:false,chatUnread:0};

function showModal(html){ ui.modal=true; mbox.innerHTML='<div class="modal-top"></div>'+html; mroot.classList.add('show'); }
function closeModal(){ ui.modal=false; mbox.innerHTML=''; mroot.classList.remove('show'); ui.confirmCb=null; ui.curEvent=null; }
function toast(msg){ var t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove('show'); },1800); }
function showConfirm(title,text,onOk){ ui.confirmCb=onOk; showModal('<h2>'+title+'</h2><div class="mdesc">'+text+'</div><div class="close-row"><button class="btn" data-act="confirmYes">应允</button><button class="btn ghost" data-act="closeModal">再议</button></div>'); }
function confirmYes(){ var cb=ui.confirmCb; closeModal(); if(cb) cb(); }

/* ---------- 顶部 / Tab / 底部 ---------- */
function resIcon(key){ return '<img src="'+Art.resURL(key)+'" alt="">'; }
function renderTop(){
  var g=game.state;
  var mk=function(key,val){ return '<span class="res-badge" data-act="resInfo" data-id="'+key+'"><img src="'+Art.resURL(key)+'" alt=""><b>'+fmt(val)+'</b></span>'; };
  topbar.innerHTML='<div class="gamename">云顶道庭·彤恩卷<small>'+g.sectName+' · '+DB.profile.master_title+' · 宗'+g.sectLv+'级</small></div>'+
    '<button class="gear" data-act="settings">设</button>'+
    '<div class="res-row">'+
    mk('lingShi',g.res.lingShi)+mk('rep',g.res.shengWang)+mk('beast',game.totalPills())+mk('ore',g.res.kuangShi)+mk('jade',g.res.xianYu)+
    '</div>';
}
function renderTabs(){
  var tabs=[['zongmen','宗门'],['dizi','弟子'],['youlv','游历'],['lingtian','灵田'],['shijie','世界'],['chat','传书']];
  var g=game.state;
  tabsEl.innerHTML=tabs.map(function(t){
    var dot='';
    // v5.5 红点引导：传书未读 / 宗门未签到 / 灵田有成熟作物
    if(t[0]==='chat'&&ui.chatUnread>0) dot='<span class="dot show"></span>';
    else if(t[0]==='zongmen'&&g&&g.checkin&&!g.checkin.done) dot='<span class="dot show"></span>';
    else if(t[0]==='lingtian'&&g&&g.lingTian&&g.lingTian._ripe&&g.lingTian._ripe.indexOf(true)>=0) dot='<span class="dot show"></span>';
    var ltLock=t[0]==='lingtian'&&g&&g.sectLv<2;
    return '<button class="tab '+(ui.tab===t[0]?'on':'')+'" data-act="switchTab" data-id="'+t[0]+'"><i></i>'+t[1]+(ltLock?'<small style="opacity:.6;font-size:9px">2级</small>':'')+dot+'</button>';
  }).join('');
}
function renderBottom(){
  bottomEl.innerHTML='<button class="btn gold" data-act="recruit">'+BTN_TXT.recruit+' '+game.recruitCost()+'灵石</button>'+
    '<button class="btn" data-act="autoAssign">一键安排</button>'+
    '<button class="btn ghost" data-act="stopAll">全停</button>';
}

/* ---------- 宗门页 ---------- */
function renderZongmen(){
  var g=game.state;
  var html='';
  // 山门 + 等级铭牌
  html+='<div class="mountain" id="mountainWrap"><div class="lv-plate" style="position:absolute;left:8px;top:8px">宗 '+g.sectLv+' 级</div></div>';
  // 概况（信息网格）
  var karmaTxt=g.karma>0?'功德 <b class="num-gold">'+g.karma+'</b>':g.karma<0?'杀业 <b class="num-down">'+(-g.karma)+'</b>':'无';
  html+='<div class="card dark"><div class="card-title">山门概况</div>'+
    '<div class="sub" style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;margin-top:6px">'+
    '<span>坊市产出 <b class="num-gold">'+(1+g.facilities.fangshi*.8).toFixed(1)+'/秒</b></span>'+
    '<span>长老 <b class="num-gold">'+g.elders.length+'</b> 位（+'+g.elders.reduce(function(s,e){return s+e.times;},0)*5+'%）</span>'+
    '<span>修炼加成 <b class="num-up">+'+g.facilities.juling*10+'%</b></span>'+
    '<span>突破基础 <b class="num-up">'+Math.round((REALMS[0].br+g.facilities.cangjing*.02+(g.unlock.breakBonus||0))*100)+'%</b></span>'+
    '<span>业力：'+karmaTxt+'</span>'+
    '<span>宗训「'+((g.motto||'未立'))+'」</span>'+
    '</div>'+
    (g.alliance?'<div class="sub" style="margin-top:6px;border-top:1px dashed rgba(216,180,90,.25);padding-top:5px">道侣宗门：'+CONFIG.PARTNER_NAME+'之「'+((game.otherSectName||'?'))+'」<span class="'+(game.otherOnline?'num-up':'')+'">'+(game.otherOnline?'· 在线':'· 离线')+'</span> 对方 '+game.otherSectLv+' 级</div>':'')+
    '<div class="sub" style="margin-top:5px">'+(g.buffs.length?g.buffs.map(function(b){return '<span class="buff-chip">'+b.label+' '+formatDur(b.left)+'</span>';}).join(''):'')+'</div></div>';
  // 今日吉凶（天气/运势/倒计时/签到/相册入口）
  var wd=game.weatherDef();
  var ck=g.checkin||{};
  var fate=g.fate||game.fateOfToday();
  html+='<div class="card dark"><div class="card-title">今日吉凶</div>'+
    '<div class="sub" style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;margin-top:6px">'+
    '<span>天气 <b class="'+(wd&&wd.earn>1?'num-up':wd&&wd.earn<1?'num-down':'')+'">'+(wd?wd.name:'—')+'</b> '+(wd?wd.desc:'')+'</span>'+
    '<span>运势 <b class="num-gold">'+(fate?fate.name:'—')+'</b></span>'+
    '<span>彤华节 <b class="num-gold">'+game.daysToTonghua()+' 天后</b></span>'+
    '<span>道侣签到 '+(game.otherOnline?'<span class="num-up">可查</span>':'—')+'</span>'+
    '</div>'+
    '<div class="btn-row" style="margin-top:6px">'+
    '<button class="btn small gold" data-act="checkin" '+(ck.done?'disabled':'')+'>'+(ck.done?'已签到·连'+ck.streak+'天':'今日签到')+'</button>'+
    '<button class="btn small" data-act="fateShow">今日运势</button>'+
    '<button class="btn small" data-act="showAlbum">云相册</button>'+
    '</div></div>';
  // 节日横幅 + 流星夜许愿
  var fest=game.festivalOf();
  if(fest){
    var giftBtn='';
    if(fest.gift && !g['gift_'+fest.gift]) giftBtn='<button class="btn small gold" data-act="festGift">🥮 领取月饼礼盒</button>';
    else if(fest.gift) giftBtn='<span class="sub">🥮 月饼礼盒已领取</span>';
    html+='<div class="card dark" style="border:1px solid var(--gold)"><div class="card-title">'+fest.emoji+' '+fest.name+'</div><div class="sub">'+fest.note+(fest.double?'<br><b class="num-gold">今日全宗门收益翻倍！</b>':'')+'</div>'+
      '<div class="btn-row" style="margin-top:6px"><button class="btn small gold" data-act="festLamp">放一盏花灯</button>'+giftBtn+'</div></div>';
  } else {
    var nf=game.nextFestival();
    if(nf && nf.days<=7){
      html+='<div class="card dark" style="border:1px dashed var(--gold)"><div class="sub">🏮 '+nf.emoji+' '+nf.name+' 还有 <b class="num-gold">'+nf.days+'</b> 天，届时全宗门收益翻倍</div></div>';
    }
  }
  // v4.2 观星台
  var starNow=game.starNow();
  var starDone=g.starDate===game.todayStr();
  html+='<div class="card dark star-card">'+
    '<div class="card-title">✦ 观星台</div>'+
    '<div class="sub" style="margin-top:6px">'+(starNow?'星象加持中：<b class="num-gold">「'+starNow.label+'」</b>':'今夜天清气朗，正是观星好时机（每日一次，得星象加持）')+'</div>'+
    (starDone?'':'<div class="btn-row" style="margin-top:6px"><button class="btn small gold" data-act="starShow">夜观天象</button></div>')+
    '</div>';
  if(wd&&wd.id==='liuxing'){
    html+='<div class="card dark" style="border:1px solid rgba(150,140,220,.5)"><div class="card-title">🌠 流星夜</div>'+
      '<div class="sub">'+(g.wish&&g.wishDate===game.todayStr()?'你已许愿：「<b class="num-gold">'+g.wish+'</b>」——愿望正在飞往星河':'今夜流星划过，快许个愿吧（情缘+5，灵石+300）')+'</div>'+
      (g.wish&&g.wishDate===game.todayStr()?'':'<div class="btn-row" style="margin-top:6px"><button class="btn small gold" data-act="wishShow">🌠 许愿</button></div>')+'</div>';
  }
  // 成长树（岁月年轮）
  var dT=game.daysTogether(),leafN=game.treeLeafCount();
  html+='<div class="card dark"><div class="card-title">岁月树 · 年轮</div>'+
    '<div class="sub" style="margin-top:6px">我们相识 <b class="num-gold">'+dT+'</b> 天，岁月树已长出 <b class="num-rose">'+leafN+'</b> 片叶子</div>'+
    '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:8px">'+
    (function(){ var h=''; for(var li=0;li<Math.min(20,leafN);li++) h+='<span style="font-size:14px">🍃</span>'; if(leafN>20) h+='<span style="font-size:11px;color:var(--muted)">+'+ (leafN-20) +'</span>'; return h||'<span style="font-size:12px;color:var(--muted)">幼芽初生</span>'; })()+
    '</div>'+(leafN>=1?'<div class="sub" style="margin-top:6px;color:var(--rose)">每 100 天长一片叶子，长满 10 片就是十年之约 🌳</div>':'')+'</div>';
  // 情缘同心锁
  var qy=game.qingYuanLevel(),isP=isPartnerEmail(DB.profile.email);
  html+='<div class="card dark"><div class="card-title">同心锁 · 情缘</div>'+
    '<div class="sub" style="margin-top:6px">情缘值 <b class="num-rose">'+(g.qingYuan||0)+'</b> ｜ 同心锁「<b class="num-gold">'+qy.name+'</b>」'+(qy.lv<4?'（距「'+qy.next+'」还差 '+(100-qy.progress)+'）':'')+'</div>'+
    '<div style="height:6px;background:rgba(180,120,130,.2);border-radius:3px;margin:8px 0;overflow:hidden"><div style="height:100%;width:'+Math.min(100,qy.progress)+'%;background:linear-gradient(90deg,#b05f75,#e8a0b8);border-radius:3px;transition:width .5s"></div></div>'+
    '<div class="btn-row" style="margin-top:6px">'+
    '<button class="btn small gold" data-act="quizShow">默契问答'+((g.quizCorrect||0)>0?'（今日答对'+(g.quizCorrect||0)+'）':'')+'</button>'+
    '<button class="btn small rose" data-act="xiuShow">双修</button>'+
    '</div></div>';
  // v4.2 悟道碑（道偈图鉴）
  var daoGot=(g.daoji||[]).length,daoAll=DAOJI.length,daoDone=g.daojiDate===game.todayStr();
  html+='<div class="card dark">'+
    '<div class="card-title">🪨 悟道碑 <span class="realm">道偈 '+daoGot+'/'+daoAll+'</span></div>'+
    '<div class="dao-grid">'+
    DAOJI.map(function(d){ return '<span class="dao-cell '+(g.daoji.indexOf(d.id)>=0?'lit':'')+'" title="'+d.txt+'">'+(g.daoji.indexOf(d.id)>=0?'悟':'？')+'</span>'; }).join('')+
    '</div>'+
    '<div class="sub" style="margin-top:6px">'+(daoDone?'今日已悟道，明日再来参悟':'每日一悟，集齐十二道偈解锁全宗修炼+20%')+'</div>'+
    (daoDone?'':'<div class="btn-row" style="margin-top:6px"><button class="btn small gold" data-act="wudaoStone">碑前悟道</button></div>')+
    '</div>';
  // v4.2 心意笺（每日碎片·写给道侣）
  var myNote=g.noteDate===game.todayStr();
  var otherNote=game.otherNoteToday();
  var otherNoteTxt=game.otherNoteText||'';
  html+='<div class="card dark note-card">'+
    '<div class="card-title">💌 心意笺 <span class="realm">每日碎片</span></div>'+
    (g.noteText?'<div class="note-mine">'+(isP?'我（宗主夫人）':'我')+'：<b>'+g.noteText+'</b></div>':'')+
    (otherNote&&otherNoteTxt?'<div class="note-theirs">'+CONFIG.PARTNER_NAME+'：<b>'+otherNoteTxt+'</b></div>':'')+
    ((g.noteReply&&g.noteReplyDate===game.todayStr())?'<div class="note-reply">道侣回笺：<b>'+g.noteReply+'</b></div>':'')+
    '<div class="btn-row" style="margin-top:6px">'+
    (myNote?'':'<button class="btn small rose" data-act="noteShow">写笺</button>')+
    (otherNote&&g.noteReplyDate!==game.todayStr()?'<button class="btn small gold" data-act="noteReply">回笺</button>':'')+
    '</div>'+
    '<div class="sub" style="margin-top:4px;font-size:10px;color:var(--muted)">每天写一句心里话，对方登录即可见 · 情缘+2</div>'+
    '</div>';
  // 设施
  html+='<h3>设施</h3>';
  if(g.beastName||game.otherBeastName){
    html+='<div class="card dark" style="margin-bottom:8px"><div class="card-title">灵兽</div><div class="sub">'+(g.beastName?'吾宗灵兽「<b class="num-gold">'+g.beastName+'</b>」':'')+(g.beastName&&game.otherBeastName?'　｜　':'')+(game.otherBeastName?'道侣灵兽「<b class="num-rose">'+game.otherBeastName+'</b>」':'')+'</div></div>';
  }
  var keys=['juling','cangjing','liandan','qishi','fangshi','lingshou','yaotao','wudao','dazhen'];
  for(var i=0;i<keys.length;i++){
    var key=keys[i],f=FACILITIES[key],lv=g.facilities[key],maxLv=game.maxLevel();
    var locked=f.adv&&g.sectLv<3;
    var cost=FAC_COST[key](lv);
    var costHtml='';
    for(var k in cost){ var nm=k==='lingShi'?'灵石':k==='shengWang'?'声望':k==='xianYu'?'仙玉':'矿石'; costHtml+='<span class="trait">'+nm+' '+fmt(cost[k])+'</span>'; }
    if(locked){ html+='<div class="card dark"><div class="card-title">'+f.name+' <span class="realm">宗门3级解锁</span></div><div class="sub">'+f.desc(0)+'</div></div>'; continue; }
    var dots='';
    for(var j=0;j<maxLv;j++) dots+='<i style="display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:2px;background:'+(j<lv?'linear-gradient(180deg,#f4e3a8,#c9a227)':'rgba(138,90,43,.22)')+'"></i>';
    var effNow=lv>0?f.desc(lv):'未建造';
    var effNext=lv<maxLv?f.desc(lv+1):'已达上限';
    html+='<div class="card fac-card"><div class="card-title">'+f.name+' <span class="lv-badge">Lv.'+lv+'</span></div>'+
      '<div class="lv-dots" style="margin-top:6px">'+dots+'</div>'+
      '<div class="fac-eff"><span class="now">'+effNow+'</span>'+(lv<maxLv?'<span class="arr">→</span><span class="next">'+effNext+'</span>':'<span class="next">已达上限</span>')+'</div>'+
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:7px">'+
      '<div style="font-size:11px;color:var(--ink2)">祭炼耗资：'+costHtml+'</div>'+
      '<div style="display:flex;gap:6px">'+(key==='lingshou'&&lv>=1?('<button class="btn small" data-act="beastName">'+(g.beastName?('改名「'+g.beastName+'」'):'灵兽命名')+'</button>'):'')+'<button class="btn small gold" data-act="upgrade" data-id="'+key+'" '+(lv>=maxLv||!game.canAfford(cost)?'disabled':'')+'>'+BTN_TXT.upgrade+'</button></div></div></div>';
  }
  // 流派
  if(g.sectLv>=3){
    html+='<h3>流派</h3><div class="card dark"><div class="sub">当前：'+(g.liupai?LIUPAI[g.liupai].name:'未选')+(g.liupai?'（更易需20仙玉）':'')+'</div><div class="btn-row">';
    for(var lp in LIUPAI) html+='<button class="btn small '+(g.liupai===lp?'gold':'')+'" data-act="liupai" data-id="'+lp+'">'+LIUPAI[lp].name+'</button>';
    html+='</div></div>';
  }
  // 长老堂
  html+='<h3>长老堂（'+g.elders.length+'）</h3>';
  if(g.elders.length){
    html+=g.elders.map(function(e,i){ return '<div class="card dark" style="display:flex;gap:10px;align-items:center"><img src="'+Art.url('elder_'+i,function(ctx,w,h){ ctx.fillStyle='#d8b45a'; ctx.beginPath(); ctx.arc(w/2,h/2,w/2-2,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#7a2e1d'; ctx.lineWidth=3; ctx.strokeRect(6,6,w-12,h-12); ctx.fillStyle='#3a2a14'; ctx.font='13px serif'; ctx.textAlign='center'; ctx.fillText('长',w/2,h/2+5); },40,40)+'" style="width:40px;height:40px;border-radius:10px;box-shadow:0 0 8px rgba(216,180,90,.4)">'+
      '<div style="flex:1"><div class="card-title">'+e.name+' <span class="realm">'+REALMS[e.realm].name+'飞升</span></div>'+
      '<div class="sub">转世'+e.times+'次 · 光环：修炼+'+e.times*5+'%</div></div>'+
      '<button class="btn small gold" data-act="elderZhuanShi" data-id="'+i+'">转世</button></div>'; }).join('');
  }else html+='<div class="empty">暂无镇派长老</div>';
  // 史书
  html+='<h3>宗门史书</h3><div class="card">'+(g.history.slice(0,10).map(function(h){ return '<div class="log-item"><span class="lt">'+timeStr(h.t)+'</span>【'+h.title+'】'+h.desc+'</div>'; }).join('')||'<div class="empty">史书尚新</div>')+'</div>';
  // 仓库
  var p=g.res.pills,j=g.res.juan;
  html+='<h3>仓库</h3>'+
    '<div class="card"><div class="card-title">丹药</div><div class="sub">'+
    Object.keys(PILLS).map(function(k){ return '<span class="trait" style="display:inline-flex;align-items:center;gap:4px"><img src="'+Art.pillURL(k)+'" style="width:16px;height:16px">'+PILLS[k].name+'×'+p[k]+'</span>'; }).join(' ')+'</div></div>'+
    '<div class="card"><div class="card-title">材料</div><div class="sub">矿石×'+fmt(g.res.kuangShi)+' · 灵兽材料×'+fmt(g.res.beastMaterial)+' · 朱颜花×'+g.res.zhuyanFlower+' · 仙玉×'+g.res.xianYu+'<br>残卷：焚天诀×'+j.fenhuang+' · 万木逢春×'+j.wanmu+' · 星辰诀×'+j.xingchen+'</div></div>'+
    '<div class="card"><div class="card-title">装备（'+g.res.equipBank.length+'）</div><div class="sub">'+(g.res.equipBank.slice(0,8).map(function(e){ return '<span class="trait q-'+QUALITIES[e.quality].key+'">'+e.qualityName+'·'+e.base+'</span>'; }).join('')+(g.res.equipBank.length>8?' …':''))||'暂无' +'</div></div>';
  // 日志
  html+='<h3>宗门日志</h3>'+(g.logs.slice(0,40).map(function(l){ return '<div class="log-item '+(l.imp?'imp':'')+'"><span class="lt">'+timeStr(l.t)+'</span>'+l.s+'</div>'; }).join(''));
  contentEl.innerHTML=html;
  drawMountain();
}
/** 程序化山门背景 */
function drawMountain(){
  var wrap=document.getElementById('mountainWrap');
  if(!wrap) return;
  var c=Art.make(wrap.clientWidth||320,110),ctx=Art.g(c);
  var g=ctx.createLinearGradient(0,0,0,110); g.addColorStop(0,'#1c3a44'); g.addColorStop(1,'#10281f');
  ctx.fillStyle=g; ctx.fillRect(0,0,c.width,110);
  ctx.fillStyle='rgba(232,217,160,.5)'; ctx.beginPath(); ctx.arc(c.width-24,18,10,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(235,235,215,.14)'; ctx.beginPath(); ctx.ellipse(60,30,40,6,0,0,Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.ellipse(200,44,55,7,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#2c5a48'; ctx.beginPath(); ctx.moveTo(0,110); ctx.lineTo(c.width*.45,30); ctx.lineTo(c.width,110); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#1c3a30'; ctx.beginPath(); ctx.moveTo(0,110); ctx.lineTo(c.width*.3,55); ctx.lineTo(c.width*.8,110); ctx.closePath(); ctx.fill();
  // 山门
  ctx.fillStyle='#4a3220'; ctx.fillRect(c.width/2-28,60,56,50);
  ctx.fillStyle='#7c2a18'; ctx.beginPath(); ctx.moveTo(c.width/2-36,62); ctx.lineTo(c.width/2-26,50); ctx.lineTo(c.width/2+26,50); ctx.lineTo(c.width/2+36,62); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(216,180,90,.8)'; ctx.fillRect(c.width/2-2,50,4,60);
  // 宗训匾额
  ctx.fillStyle='rgba(244,227,168,.9)'; ctx.font='10px serif'; ctx.textAlign='center';
  ctx.fillText(game.state.motto||'大道无情',c.width/2,46);
  Art.zhuyanFlower(ctx,20,90,8);
  wrap.innerHTML='<img src="'+c.toDataURL('image/png')+'" style="width:100%;display:block;border-radius:12px">';
}
/* ---------- 弟子页 ---------- */
function renderDizi(){
  var g=game.state;
  if(!g.disciples.length){ contentEl.innerHTML='<div class="empty">暂无弟子，点击下方「收纳」</div>'; return; }
  var stMap={idle:'空闲',cultivate:'修炼中',alchemy:'炼丹中',forge:'炼器中',travel:'游历中',injured:'受伤中',wudao:'悟道中'};
  var opsHidden=ui.opsCollapsed?'none':'';
  var html='<h3>弟子（'+g.disciples.length+'） <button class="btn tiny ghost" data-act="toggleOps">'+(ui.opsCollapsed?'展开操作':'收起操作')+'</button></h3>';
  html+=g.disciples.map(function(d){
    var need=game.expNeed(d),full=d.exp>=need,pct=Math.min(100,Math.round(d.exp/need*100));
    var traits=d.traits.map(function(t){ var tr=TRAITS.filter(function(x){return x.id===t;})[0]; return '<span class="trait '+(t==='zhuanShi'?'gold':'')+'" title="'+tr.desc+'">'+tr.name+'</span>'; }).join('');
    var equips='';
    EQUIP_PARTS.forEach(function(p){ var e=d.equipment[p.key]; if(e) equips+='<span class="trait q-'+QUALITIES[e.quality].key+'" title="'+game.equipDesc(e)+'">'+p.name+'·'+e.base+(e.special==='tongxin'?'(同心结)':'')+(e.lv>0?'+'+e.lv:'')+'</span>'; });
    var gfs='';
    if(d.gongfa.xinfa){ var mx=GONGFA.xinfa.filter(function(x){return x.id===d.gongfa.xinfa.id;})[0]; gfs+='<span class="trait gold">心·'+mx.name+'</span>'; }
    if(d.gongfa.wuji){ var mw=GONGFA.wuji.filter(function(x){return x.id===d.gongfa.wuji.id;})[0]; gfs+='<span class="trait gold">武·'+mw.name+'</span>'; }
    var buffs='';
    if(d.buffs.peiyuan>0) buffs+='<span class="buff-chip">培元</span>';
    if(d.buffs.zhuyan>0) buffs+='<span class="buff-chip">朱颜丹</span>';
    if(d.breakBonus>0) buffs+='<span class="buff-chip">凝神</span>';
    var acts='';
    if(d.state==='injured'){
      acts='<span class="badge st-injured">伤势 '+formatDur(d.injury.left)+'</span><button class="btn small" data-act="usePill" data-id="'+d.id+'" data-pill="xugudan" '+(g.res.pills.xugudan<1?'disabled':'')+'>服续骨丹</button><button class="btn small ghost" data-act="detail" data-id="'+d.id+'">'+BTN_TXT.detail+'</button>';
    }else if(d.state==='travel'){
      acts='<span class="badge st-travel">游历中</span><button class="btn small ghost" data-act="detail" data-id="'+d.id+'">'+BTN_TXT.detail+'</button>';
    }else if(d.state!=='idle'){
      acts='<span class="badge st-'+d.state+'">'+stMap[d.state]+'</span>'+(full?'<button class="btn small gold hl" data-act="break" data-id="'+d.id+'">'+BTN_TXT.breakthrough+' '+Math.round(game.breakthroughRate(d)*100)+'%</button>':'')+'<button class="btn small" data-act="stop" data-id="'+d.id+'">召回</button><button class="btn small ghost" data-act="detail" data-id="'+d.id+'">'+BTN_TXT.detail+'</button>';
    }else{
      acts='<button class="btn small" data-act="assign" data-id="'+d.id+'" data-job="cultivate">'+BTN_TXT.cultivate+'</button>'+
        '<button class="btn small" data-act="assign" data-id="'+d.id+'" data-job="alchemy" '+(g.facilities.liandan<1||!game.facilityFree('liandan')?'disabled':'')+'>'+BTN_TXT.alchemy+'</button>'+
        '<button class="btn small" data-act="assign" data-id="'+d.id+'" data-job="forge" '+(g.facilities.qishi<1||!game.facilityFree('qishi')?'disabled':'')+'>'+BTN_TXT.forge+'</button>'+
        '<button class="btn small" data-act="travelGo2" data-id="'+d.id+'">'+BTN_TXT.travel+'</button>'+
        (full?'<button class="btn small gold hl" data-act="break" data-id="'+d.id+'">'+BTN_TXT.breakthrough+' '+Math.round(game.breakthroughRate(d)*100)+'%</button>':'')+
        '<button class="btn small ghost" data-act="detail" data-id="'+d.id+'">'+BTN_TXT.detail+'</button>';
    }
    var checked=ui.selected.has(d.id)?'checked':'';
    return '<div class="card disc-card2"><div class="disc-top">'+
      '<input type="checkbox" class="chk" data-act="toggleSel" data-id="'+d.id+'" '+checked+' style="width:20px;height:20px;accent-color:#a03a24;flex:none">'+
      '<img class="avatar" src="'+Art.avatarURL(d)+'" alt="">'+
      '<div class="disc-info"><div class="disc-name">'+d.name+
        '<span class="realm">'+REALMS[d.realm].name+'·'+REALMS[d.realm].title+'</span>'+
        '<span class="badge st-'+d.state+'">'+stMap[d.state]+'</span>'+
        (d.fate==='tianming'?'<span class="trait gold">宿命</span>':'')+(d.zhuanShi?'<span class="trait">转世'+d.zhuanShi+'</span>':'')+'</div>'+
      '<div class="disc-stats"><span class="power-chip">战力 '+fmt(game.disciplePower(d))+'</span>'+
        '<span><b>'+d.lingGen.quality+'</b>·'+d.lingGen.type+'</span>'+
        '<span>悟 <b>'+d.wuXing+'</b></span><span>福 <b>'+d.fuYuan+'</b></span></div></div></div>'+
      '<div class="sub" style="margin-top:6px">'+equips+'</div>'+
      '<div class="sub">'+gfs+'</div>'+
      '<div class="sub">'+traits+buffs+'</div>'+
      '<div class="bar"><i style="width:'+pct+'%"></i><span>'+fmt(d.exp)+'/'+fmt(need)+'</span></div>'+
      '<div class="ops-group"><div class="ops-main" style="display:'+opsHidden+'">'+acts+'</div></div></div>';
  }).join('');
  contentEl.innerHTML=html;
}
/* ---------- 游历页 ---------- */
function renderYouli(){
  var g=game.state;
  var html='<h3>组队探索</h3>';
  var maxRealm=0,i;
  for(i=0;i<g.disciples.length;i++) if(g.disciples[i].realm>maxRealm) maxRealm=g.disciples[i].realm;
  // 世界地图（Canvas）
  html+='<div class="mapCanvasWrap"><canvas id="worldMap" width="440" height="240"></canvas></div>';
  // 区域选择（卡片网格）
  html+='<div class="card dark"><div class="card-title">选择区域</div><div class="region-grid" style="margin-top:8px">';
  REGIONS.forEach(function(r){
    var locked=maxRealm<r.unlock;
    var tag=r.special==='tongyun'?'彤':r.special==='nianen'?'念':r.name.charAt(0);
    html+='<button class="region-cell '+(ui.regionSel===r.id?'sel':'')+(locked?' locked':'')+'" data-act="regionSel" data-id="'+r.id+'" '+(locked?'disabled':'')+'>'+
      '<span class="r-ic">'+tag+'</span><span>'+r.name+'</span><span class="r-lv">'+(locked?'需'+REALMS[r.unlock].name:'难度'+(r.unlock+1))+'</span></button>';
  });
  html+='</div></div>';
  if(!ui.regionSel){ var r0=null; for(i=0;i<REGIONS.length;i++) if(maxRealm>=REGIONS[i].unlock){ r0=REGIONS[i]; } ui.regionSel=(r0?r0.id:REGIONS[0].id); }
  // 弟子选择
  var idle=g.disciples.filter(function(d){return d.state==='idle';});
  html+='<div class="card dark"><div class="card-title">选择弟子（1-3名）</div><div class="btn-row">';
  if(!idle.length) html+='<div class="sub">无空闲弟子</div>';
  idle.forEach(function(d){ var on=ui.partySel.indexOf(d.id)>=0; html+='<button class="btn small '+(on?'gold':'')+'" data-act="memberSel" data-id="'+d.id+'">'+d.name+(on?'已选':'')+'</button>'; });
  html+='</div><div class="card-title" style="margin-top:8px">阵型</div><div class="btn-row">';
  for(var fk in FORMATIONS) html+='<button class="btn small '+(ui.partyFormation===fk?'gold':'')+'" data-act="formationSel" data-id="'+fk+'">'+FORMATIONS[fk].name+'</button>';
  html+='</div><div class="btn-row"><button class="btn gold" data-act="startParty" '+(ui.partySel.length<1?'disabled':'')+'>'+BTN_TXT.travel+'</button></div></div>';
  // 进行中
  html+='<h3>进行中（'+g.parties.length+'）</h3>';
  if(g.parties.length){
    html+=g.parties.map(function(p){
      var r=null; REGIONS.forEach(function(x){ if(x.id===p.region) r=x; });
      var prog=Math.max(0,1-p.timer/(r?r.dur:35));
      return '<div class="card dark"><div class="card-title">'+r.name+' <span class="badge st-travel">'+(p.state==='march'?'行进':'事件')+'</span></div>'+
        '<div class="sub">成员：'+p.members.map(function(id){var d=game.findDisciple(id);return d?d.name:'';}).join('、')+' · 战力 '+p.power+' · 节点 '+p.nodeIdx+'/'+p.nodes.length+'</div>'+
        '<div class="bar"><i style="width:'+Math.round(prog*100)+'%"></i><span>'+formatDur(p.timer)+'</span></div></div>';
    }).join('');
  }else html+='<div class="empty">无队伍在外</div>';
  // 首领冷却
  var cds=REGIONS.filter(function(r){return r._cd>0;});
  if(cds.length){ html+='<h3>首领</h3>'+cds.map(function(r){return '<div class="card dark"><div class="card-title">'+r.name+'之主</div><div class="sub">冷却 '+formatDur(r._cd)+'</div></div>';}).join(''); }
  // 游历日志
  html+='<h3>游历日志</h3>'+(g.travelLogs.slice(0,20).map(function(l){return '<div class="log-item"><span class="lt">'+timeStr(l.t)+'</span>'+l.s+'</div>';}).join('')||'<div class="empty">暂无记录</div>');
  contentEl.innerHTML=html;
  // 绘制世界地图
  try{
    var mc=document.getElementById('worldMap');
    if(mc) Art.drawWorldMap(mc,{regions:REGIONS,maxRealm:maxRealm});
  }catch(e){}
}
/* ---------- 世界页 ---------- */
function renderShijie(){
  var g=game.state;
  var html='<h3>天下宗门</h3>';
  html+=g.npcs.map(function(n){
    var rank=game.relRank(n.rel);
    var rankCls=n.rel>=80?'#d8b45a':n.rel>=60?'#9fc98f':n.rel>=25?'#8fa39a':'#c9552a';
    var relW=Math.max(6,n.rel);
    var btns='<button class="btn small" data-act="npcTrade" data-id="'+n.id+'" '+(n.cd>0?'disabled':'')+'>贸易'+(n.cd>0?'('+formatDur(n.cd)+')':'')+'</button>'+
      '<button class="btn small" data-act="npcAlly" data-id="'+n.id+'" '+(n.rel<60?'disabled':'')+'>结盟</button>'+
      '<button class="btn small gold" data-act="npcWar" data-id="'+n.id+'">宣战</button>';
    return '<div class="card npc-card '+(n.annihilated?'dark':'')+'">'+
      '<div class="rel-bar" style="background:'+rankCls+'"></div>'+
      '<div class="card-title" style="padding-left:6px">'+n.name+' <span style="color:'+rankCls+';font-size:11px">'+(n.annihilated?'已覆灭':rank)+'</span> <span class="lv-badge" style="font-size:10px">战力 '+fmt(n.power)+'</span></div>'+
      '<div style="padding-left:6px;margin-top:5px"><div style="height:5px;border-radius:3px;background:rgba(51,36,15,.12);overflow:hidden"><div style="width:'+relW+'%;height:100%;background:linear-gradient(90deg,'+rankCls+',transparent)"></div></div>'+
      '<div class="sub" style="margin-top:3px">'+n.desc+' · 关系 '+n.rel+'/100 · '+(n.personality==='aggressive'?'侵略型':n.personality==='defensive'?'防守型':'商业型')+'</div></div>'+
      (n.annihilated?'':'<div class="btn-row" style="padding-left:6px">'+btns+'</div>')+'</div>';
  }).join('');
  // 炼妖塔
  html+='<h3>炼妖塔</h3><div class="card dark"><div class="card-title">炼妖塔 <span class="realm">第 '+g.tower.lv+' 层</span></div>'+
    '<div class="sub">挑战需冷却，掉落矿石/残卷/声望。下一层战力约 '+fmt(500*Math.pow(1.7,g.tower.lv+1))+'</div>'+
    '<div class="btn-row"><button class="btn gold" data-act="tower" '+(g.facilities.yaotao<1||g.tower.cd>0||g.tower.lv>=5+g.facilities.yaotao?'disabled':'')+'>挑战第 '+(g.tower.lv+1)+' 层'+(g.tower.cd>0?'('+formatDur(g.tower.cd)+')':'')+'</button></div></div>';
  // 悟道崖
  html+='<h3>悟道崖</h3><div class="card dark"><div class="card-title">悟道崖 <span class="realm">'+(g.facilities.wudao>0?'Lv.'+g.facilities.wudao:'未建')+'</span></div>'+
    '<div class="sub">派遣弟子顿悟，提升悟性或领悟残卷</div>'+
    '<div class="btn-row"><button class="btn gold" data-act="wudaoSend" '+(g.facilities.wudao<1||g.wudaoCd>0||!game.hasIdle()?'disabled':'')+'>派遣悟道'+(g.wudaoCd>0?'('+formatDur(g.wudaoCd)+')':'')+'</button></div></div>';
  // 双人秘境与互动
  html+='<h3>双修秘境</h3><div class="card dark"><div class="card-title">'+CONFIG.PARTNER_NAME+'之宗门：'+(game.otherSectName||'未知')+'（'+(game.otherOnline?'<span style="color:#7fae5f">在线</span>':'离线')+'）</div>'+
    '<div class="sub">'+(g.alliance?'已结盟 · 对方宗门 '+game.otherSectLv+' 级':'未结盟（结盟需 5 仙玉，可解锁双人秘境/彤恩双修诀/赠礼）')+'</div>'+
    // v4.3 契缘进度
    '<div class="sub" style="margin-top:4px">结契 · <span class="qy-lv">'+QIYUAN_LEVELS[game.qiLv()].name+'</span>'+(QIYUAN_LEVELS[game.qiLv()].buff?'<span class="qy-tag">'+QIYUAN_LEVELS[game.qiLv()].buff+'</span>':'')+'</div>'+
    '<div class="qy-bar" style="margin:4px 0 2px"><i style="width:'+(game.qiLvInfo().ratio)+'%"></i></div>'+
    '<div class="sub" style="font-size:11px">契缘 '+fmt(g.qiyuan||0)+(game.qiLvInfo().next?' / '+QIYUAN_LEVELS[game.qiLv()].need+' 达「'+game.qiLvInfo().next+'」':' · 已至「'+QIYUAN_LEVELS[game.qiLv()].name+'」圆满')+'（传书·赠礼·写笺·同在皆可积）</div>'+
    '<div class="btn-row">'+
    '<button class="btn small rose" data-act="sendGift" '+(g.alliance?'':'disabled')+'>'+BTN_TXT.gift+'</button>'+
    '<button class="btn small" data-act="sendSpar" '+(g.alliance?'':'disabled')+'>切磋</button>'+
    '<button class="btn small gold" data-act="sendAlliance" '+(g.alliance?'disabled':'')+'>结盟</button>'+
    '<button class="btn small gold" data-act="duoBoss" '+(g.alliance?'':'disabled')+'>双人秘境</button>'+
    '<button class="btn small" data-act="trailsShow">📔 行迹</button>'+
    '<button class="btn small" data-act="scrollShow">📜 卷宗</button>'+
    '<button class="btn small gold" data-act="cardGameShow">🃏 斗地主</button>'+
    '<button class="btn small gold" data-act="poolGameShow">🎱 台球</button>'+
    '<button class="btn small gold" data-act="arena">⚔️ 演武场</button>'+
    '<button class="btn small gold" data-act="armory">🎒 装备库</button>'+
    '<button class="btn small rose" data-act="questPick" '+(g.alliance?'':'disabled')+'>🎯 布置任务</button>'+
    '</div></div>';
  contentEl.innerHTML=html;
}
/* ---------- 灵田页（修仙农场） ---------- */
function renderLingTian(){
  var g=game.state;
  game.initLingTian();   // 幂等补丁：确保 plots/today 等完整
  var lt=g.lingTian;
  if(g.sectLv<2){
    contentEl.innerHTML='<div class="empty">灵田尚未开垦……<br>宗门 2 级后可开辟灵田，种灵药、偷仙果。<br><br><button class="btn gold" data-act="switchTab" data-id="zongmen">返回宗门</button></div>';
    return;
  }
  var html='';
  var need=game.lingTianExpNeed(),maxP=game.lingTianMaxPlots();
  var expW=Math.min(100,Math.round(lt.exp/need*100));
  html+='<div class="card dark"><div class="card-title">灵田 <span class="lv-badge">Lv.'+lt.lv+'</span> <span style="float:right;font-size:11px;color:var(--ink2)">已开垦 '+maxP+'/12 块</span></div>'+
    '<div style="height:7px;border-radius:4px;background:rgba(51,36,15,.15);margin-top:6px;overflow:hidden"><div style="width:'+expW+'%;height:100%;background:linear-gradient(90deg,#7fae5f,#cfe8a0)"></div></div>'+
    '<div class="sub" style="margin-top:5px">灵田经验 '+lt.exp+'/'+need+(lt.rain>0?' · <b class="num-up">灵雨中（生长+50%）</b>':'')+'</div>'+
    '<div class="sub">今日：偷采 '+lt.today.steal+'/3 · 浇灌 '+lt.today.water+'/5 · 业力 '+(g.karma>0?'+'+g.karma:g.karma)+'</div></div>';
  html+='<h3>灵田（'+maxP+' 块）</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">';
  for(var i=0;i<12;i++){
    var p=lt.plots[i];
    if(i>=maxP){ html+='<div class="card dark" style="min-height:122px;display:flex;align-items:center;justify-content:center;flex-direction:column;opacity:.5"><div style="font-size:20px;color:#c9b47c">▦</div><div class="sub" style="text-align:center">Lv.'+(i+1-2)+' 开垦</div></div>'; continue; }
    if(!p.seed){
      html+='<div class="card" style="min-height:122px;display:flex;align-items:center;justify-content:center;flex-direction:column;background:repeating-linear-gradient(45deg,rgba(122,90,60,.14),rgba(122,90,60,.14) 6px,rgba(122,90,60,.04) 6px,rgba(122,90,60,.04) 12px)">'+
        '<img src="'+Art.ltPlotURL()+'" style="position:absolute;opacity:.2;width:64px;height:64px;border-radius:8px">'+
        '<button class="btn small" data-act="ltPlant" data-id="'+i+'" style="position:relative">种植</button></div>';
      continue;
    }
    var c=LT_cropById(p.seed),prog=game.lingTianProgress(p),rem=game.lingTianRemain(p),ripe=prog>=1;
    html+='<div class="card '+(ripe?'':'dark')+'" style="min-height:122px;text-align:center;position:relative">'+
      '<img src="'+Art.ltCropURL(p.seed)+'" style="width:42px;height:42px;display:block;margin:3px auto 0">'+
      '<div class="card-title" style="font-size:12px">'+c.name+'</div>'+
      '<div style="height:5px;border-radius:3px;background:rgba(51,36,15,.12);margin:3px 8px;overflow:hidden"><div style="width:'+Math.round(prog*100)+'%;height:100%;background:linear-gradient(90deg,#7fae5f,#cfe8a0)"></div></div>'+
      '<div class="sub" style="font-size:10px">'+(ripe?'<b class="num-gold">已成熟</b>':'剩 '+formatDur(rem))+'</div>'+
      (p.water>0?'<div class="sub" style="font-size:9px">浇灌×'+p.water+'</div>':'')+
      (ripe?'<button class="btn small gold" data-act="ltHarvest" data-id="'+i+'" style="margin-top:3px">收获</button>':'');
  }
  html+='</div><div class="btn-row"><button class="btn gold" data-act="ltHarvestAll">一键收获</button></div>';
  html+='<h3>灵种阁</h3>';
  for(var j=0;j<LT_CROPS.length;j++){
    var c2=LT_CROPS[j],locked2=lt.lv<c2.lv,costTxt='';
    for(var k in c2.cost) costTxt+=c2.cost[k]+'灵石';
    var yt2=game.lingTianYieldText(c2.yield,1);
    html+='<div class="card '+(locked2?'dark':'')+'" style="display:flex;gap:8px;align-items:center"><img src="'+Art.ltCropURL(c2.id)+'" style="width:36px;height:36px;border-radius:8px;background:rgba(122,90,60,.15)">'+
      '<div style="flex:1"><div class="card-title" style="font-size:12px">'+c2.name+(locked2?' <span class="realm">灵田'+c2.lv+'级解锁</span>':' <span class="lv-badge">'+formatDur(c2.time)+'</span>')+'</div>'+
      '<div class="sub" style="font-size:10px">产出 '+yt2+' · 种价 '+costTxt+' · 库存 <b>'+(lt.seeds[c2.id]||0)+'</b></div></div>'+
      (locked2?'':'<button class="btn small" data-act="ltBuySeed" data-id="'+c2.id+'">买种</button><button class="btn small gold" data-act="ltPlantSeed" data-id="'+c2.id+'" '+(lt.seeds[c2.id]>0?'':'disabled')+'>种植</button>')+'</div>';
  }
  html+='<h3>道侣灵田</h3><div class="card dark"><div class="card-title">'+CONFIG.PARTNER_NAME+'之灵田（'+(game.otherOnline?'<span class="num-up">在线</span>':'离线')+'）</div>'+
    '<div class="btn-row" style="margin-top:6px"><button class="btn small rose" data-act="ltWater" '+(lt.today.water>=5?'disabled':'')+'>浇灌灵气（今日'+lt.today.water+'/5）</button>'+
    '<button class="btn small gold" data-act="ltRefreshPartner" '+(lt.today.steal>=3?'disabled':'')+'>窥探灵田（今日偷采'+lt.today.steal+'/3）</button></div>'+
    '<div id="ltPartnerBox" class="sub" style="margin-top:6px">点击「窥探灵田」查看道侣药圃……</div></div>';
  html+='<h3>灵田札记</h3><div class="card">'+(lt.logs.slice(0,12).map(function(l){ return '<div class="log-item"><span class="lt">'+timeStr(l.t)+'</span>'+l.s+'</div>'; }).join('')||'<div class="empty">灵田尚静，静待开垦</div>')+'</div>';
  contentEl.innerHTML=html;
}
/** 空地种植弹窗：列出可种灵种 */
function showLingTianPlantModal(idx){
  var lt=game.state.lingTian,opts='';
  for(var i=0;i<LT_CROPS.length;i++){
    var c=LT_CROPS[i];
    if(lt.lv<c.lv) continue;
    var stock=lt.seeds[c.id]||0;
    opts+='<button class="btn opt" data-act="ltPlantDo" data-idx="'+idx+'" data-seed="'+c.id+'" '+(stock>0?'':'disabled')+'><div class="opt-t">'+c.name+'（库存'+stock+'）</div><div class="opt-d">'+formatDur(c.time)+' → '+game.lingTianYieldText(c.yield,1)+'</div></button>';
  }
  showModal('<h2>种植灵种</h2><div class="mdesc">选择要种下的灵种：</div>'+opts+'<div class="close-row"><button class="btn ghost" data-act="closeModal">算了</button></div>');
}
/** 窥探道侣灵田：加载对方可偷列表 */
function refreshLingTianPartner(){
  var lt=game.state.lingTian,box=document.getElementById('ltPartnerBox');
  if(!box) return;
  box.innerHTML='<span style="opacity:.7">正在窥探……</span>';
  DB.loadPartnerProfile(function(partner){
    if(!partner){ box.innerHTML='<span style="opacity:.7">对方宗门不存在</span>'; return; }
    var targets=game.lingTianStealTargets(partner);
    if(!targets.length){
      box.innerHTML='<span style="opacity:.7">对方灵田空空如也，或无成熟作物可偷</span>';
      return;
    }
    box.innerHTML=targets.map(function(t){
      return '<div style="display:flex;align-items:center;gap:6px;margin-top:5px"><img src="'+Art.ltCropURL(t.crop.id)+'" style="width:26px;height:26px;border-radius:6px">'+
        '<span style="flex:1">第'+(t.idx+1)+'块 · '+t.crop.name+'（已成熟）</span>'+
        '<button class="btn tiny gold" data-act="ltSteal" data-idx="'+t.idx+'">偷采</button></div>';
    }).join('');
  });
}
/* ---------- 晨报（每日登录弹窗：天气+运势+签到+今日指南） ---------- */
function showMorningBrief(){
  var g=game.state,isP=isPartnerEmail(DB.profile.email);
  var wd=game.weatherDef(),fate=g.fate||game.fateOfToday(),ck=g.checkin||{};
  var title=isP?'晨安，婉彤仙子':'晨安，'+CONFIG.DEVELOPER_NAME;
  var html='<h2>'+title+'</h2><div class="mdesc">'+
    (wd?'今日天象：<b class="'+(wd.earn>1?'num-up':wd.earn<1?'num-down':'')+'">'+wd.name+'</b>（'+wd.desc+'）<br>':'')+
    '今日运势：<b class="num-gold">'+fate.name+'</b>——'+fate.text+'<br>'+
    (isP?'今日别忘了：传书给恩和、去灵田收药、签个到——他都在等你。<br>':'今日别忘了：签个到、看看灵田、给婉彤传书。')+
    '</div><div class="btn-row">'+
    '<button class="btn gold" data-act="checkin" '+(ck.done?'disabled':'')+'>'+(ck.done?'已签到':'签到领奖')+'</button>'+
    '<button class="btn" data-act="fateShow">看运势</button>'+
    '<button class="btn rose" data-act="closeModal">开始修炼</button></div>';
  showModal(html);
  if(isP&&!g.tutorialDone) setTimeout(showTutorial,1500);
}
/* ---------- 婉彤专属新手引导（首登 5 步） ---------- */
var TUTORIAL_STEPS=[
  {t:'欢迎来到你的世界', d:'婉彤，这里是恩和为你写的修仙世界——宗门、灵田、传书，都只属于你们俩。'},
  {t:'宗门', d:'点下方「宗门」页签：收纳弟子、祭炼设施，还有每天的签到和运势都在这里。'},
  {t:'灵田', d:'点「灵田」：买种子、种灵药、收灵果——小心，恩和可能会来偷你的药。'},
  {t:'传书', d:'点「传书」：随时给恩和发消息，他那边会实时收到，还会亮红点。'},
  {t:'每日签到', d:'每天记得签到领奖，连续签到奖励越来越丰厚；你们俩都签到还有同心加成。'}
];
function showTutorial(){
  var g=game.state,i=(g._tutIdx||0);
  if(i>=TUTORIAL_STEPS.length){
    g.tutorialDone=true; g._tutIdx=0;
    closeModal();
    toast('开始你的修仙之旅吧');    render();
    return;
  }
  var s=TUTORIAL_STEPS[i];
  g._tutIdx=i;
  showModal('<h2>'+s.t+'</h2><div class="mdesc">'+s.d+'</div><div class="close-row"><button class="btn" data-act="tutSkip">跳过</button><button class="btn gold" data-act="tutNext">'+(i===TUTORIAL_STEPS.length-1?'开始修炼':'下一步')+'</button></div>');
}
/* ---------- v5.4 婉彤无操作引导：3 分钟没点任何东西 → 弹三个大按钮 ---------- */
function wanderGuide(){
  if(!DB.profile||!isPartnerEmail(DB.profile.email)) return;
  var g=game.state;
  try{ if(localStorage.getItem('tyj_guide_v2')) return; }catch(e){}
  var guided=false,timer=null;
  function cancel(){
    if(guided) return;
    try{ localStorage.setItem('tyj_guide_v2','1'); }catch(e){}
    if(timer) clearTimeout(timer);
    document.removeEventListener('click',cancel,true);
  }
  document.addEventListener('click',cancel,true);
  timer=setTimeout(function(){
    guided=true;
    document.removeEventListener('click',cancel,true);
    if(ui.modal) return;
    showModal('<h2>🥰 婉彤，不知道玩什么？</h2><div class="mdesc">试试这三个，恩和都在等你哦～</div>'+
      '<div class="btn-row" style="flex-direction:column;gap:8px;align-items:stretch">'+
      '<button class="btn gold" data-act="guideGo" data-go="arena">⚔️ 去打一次演武场（掉装备）</button>'+
      '<button class="btn" data-act="guideGo" data-go="farm">🌾 去灵田收收菜（他浇过水）</button>'+
      '<button class="btn rose" data-act="guideGo" data-go="chat">💌 给恩和传个话</button></div>'+
      '<div class="sub" style="text-align:center;margin-top:4px">点上面任意一个，恩和那边都能看到你的动静</div>');
  },3*60*1000);
}
/* ---------- 云端相册 ---------- */
/* v5.4 师徒任务（恩和布置 → 婉彤完成 → 双向通知） */
var QUEST_TYPES=[
  {id:'farm',name:'🌾 去灵田收一次菜',tab:'lingtian',act:'farm'},
  {id:'arena',name:'⚔️ 打一次演武场',tab:'zongmen',act:'arena'},
  {id:'checkin',name:'☀️ 签一次到',tab:'zongmen',act:'checkin'},
  {id:'chat',name:'💌 传一句心里话给恩和',tab:'chat',act:'chat'}
];
function questById(id){ for(var i=0;i<QUEST_TYPES.length;i++) if(QUEST_TYPES[i].id===id) return QUEST_TYPES[i]; return null; }
function showAlbum(){
  showModal('<h2>云相册</h2><div class="mdesc">只有你俩能看的私密相册，照片存云端，永不丢失。</div>'+
    '<div class="btn-row"><button class="btn gold" data-act="albumPick">存入一张</button></div>'+
    '<div id="albumBox" style="margin-top:6px"><span style="opacity:.7">正在翻开相册……</span></div>'+
    '<div class="close-row"><button class="btn ghost" data-act="closeModal">合上</button></div>');
  game.albumRefresh(document.getElementById('albumBox'));
}
/* ---------- 传书（聊天）页 ---------- */
function renderChat(){
  var g=game.state;
  contentEl.innerHTML='<div class="chat-wrap"><div class="chat-list" id="chatList"></div>'+
    '<div class="chat-input"><input id="chatInput" placeholder="传书给'+CONFIG.PARTNER_NAME+'…" maxlength="100"><button class="btn rose" data-act="sendMsg">传书</button></div></div>';
  DB.loadMessages(function(msgs){
    var list=document.getElementById('chatList');
    if(!list) return;
    list.innerHTML=(msgs||[]).map(function(m){
      var isM=DB.profile&&m.profile_id===DB.profile.id;
      var matron=isM&&isPartnerEmail(DB.profile.email);
      var body=m.content,extra='';
      // v5 赠礼消息 [gift]{json}
      if(body&&body.indexOf('[gift]')===0){
        try{
          var gift=JSON.parse(body.slice(6));
          if(isM){ body='🎁 赠出装备：<b class="q-'+QUALITIES[gift.quality].key+'">'+gift.qualityName+'·'+gift.base+'</b>'+(gift.set?'【'+SETS[gift.set].name+'】':'')+'<br><small style="font-size:10px;color:var(--ink2)">等待对方领取</small>'; }
          else{
            if(!g.gifts) g.gifts={};
            var gk=m.id,gd=g.gifts[gk];
            body='🎁 '+CONFIG.PARTNER_NAME+' 赠你装备：<b class="q-'+QUALITIES[gift.quality].key+'">'+gift.qualityName+'·'+gift.base+'</b>'+(gift.set?'【'+SETS[gift.set].name+'】':'')+(gift.lv>0?'+'+gift.lv:'')+'<br><small style="font-size:10px;color:var(--ink2)">'+(gift.source||'')+'</small>'+(gift.note?'<div class="sub" style="font-size:11px;color:var(--rose);margin-top:2px">💌 '+gift.note+'</div>':'');
            if(gd&&gd.claimed){ body+='<div class="sub" style="color:var(--ok);font-size:11px">✅ 已领取</div>'; }
            else{
              g.gifts[gk]={id:gk,part:gift.part,base:gift.base,quality:gift.quality,qualityName:gift.qualityName,affixes:gift.affixes||[],set:gift.set||null,lv:gift.lv||0,baseAtk:gift.baseAtk,baseDef:gift.baseDef,baseHp:gift.baseHp,source:gift.source||'',story:gift.story||'',awaken:gift.awaken||0,bloodBound:gift.bloodBound||false,infuse:gift.infuse||null,note:gift.note||'',claimed:false};
              body+='<div class="btn-row" style="margin-top:4px"><button class="btn tiny gold" data-act="claimGift" data-gid="'+gk+'">🎁 领取</button></div>';
            }
          }
        }catch(err){ body='🎁 赠礼消息'; }
      }
      // v5.4 师徒任务 [quest]（对方布置的任务）
      if(body&&body.indexOf('[quest]')===0){
        try{
          var q=JSON.parse(body.slice(7));
          if(isM){ body='🎯 布置任务：'+q.name+'<br><small style="font-size:10px;color:var(--ink2)">等待她完成</small>'; }
          else{
            if(!g.quests) g.quests={};
            var qk=m.id;
            if(g.quests['done_'+qk]){ body='🎯 '+CONFIG.PARTNER_NAME+' 布置任务：'+q.name+'<div class="sub" style="color:var(--ok);font-size:11px">✅ 已完成并回执</div>'; }
            else{
              body='🎯 '+CONFIG.PARTNER_NAME+' 给你布置了任务：<b>'+q.name+'</b><br><small style="font-size:10px;color:var(--ink2)">完成它，他能看到你的动静</small>'+
                '<div class="btn-row" style="margin-top:4px"><button class="btn tiny gold" data-act="questGo" data-qid="'+q.id+'" data-mid="'+qk+'">去完成 →</button></div>';
            }
          }
        }catch(err){ body='🎯 任务消息'; }
      }
      // v5.4 任务完成回执 [quest_done]（她完成了我的任务）
      if(body&&body.indexOf('[quest_done]')===0){
        try{
          var qd=JSON.parse(body.slice(12));
          if(!isM){
            game.onQuestDone(qd,m.id);
            body='🎉 '+CONFIG.PARTNER_NAME+' 完成了你布置的任务：<b>'+(qd.name||'任务')+'</b><div class="sub" style="color:var(--ok);font-size:11px">契缘+10</div>';
          }else{
            body='✅ 已回执任务：'+(qd.name||'任务');
          }
        }catch(err){ body='🎯 任务回执'; }
      }
      return '<div class="msg '+(isM?'mine':'')+(matron?' matron':'')+'"><div class="bubble"><div class="who">'+(isM?'我':CONFIG.PARTNER_NAME)+(matron?'(宗主夫人)':'')+'</div>'+body+'<span class="tm">'+timeStr(new Date(m.created_at).getTime())+'</span></div></div>';
    }).join('')||'<div class="empty">尚未互通音讯</div>';
    list.scrollTop=list.scrollHeight;
  });
}
/* ---------- 弹窗 ---------- */
function showResInfo(id){
  var g=game.state;
  var nm={lingShi:'灵石',rep:'声望',ore:'矿石',jade:'仙玉'}[id];
  var hint={lingShi:'收纳弟子、祭炼设施、贸易',rep:'祭炼藏经阁、参悟功法、结盟',ore:'祭炼器室、强化装备',jade:'高级招募、气运兑换、结盟'}[id];
  showModal('<h2>'+nm+'</h2><div class="mdesc">当前：'+fmt(g.res[id])+'<br>用途：'+hint+'</div><div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>');
}
function showDiscipleDetail(id){
  var g=game.state,d=game.findDisciple(id);
  if(!d) return;
  var need=game.expNeed(d),full=d.exp>=need;
  var traits=d.traits.map(function(t){var tr=TRAITS.filter(function(x){return x.id===t;})[0];return '<span class="trait '+(t==='zhuanShi'?'gold':'')+'">'+tr.name+'</span>';}).join('')||'无';
  var eq='';
  EQUIP_PARTS.forEach(function(p){
    var e=d.equipment[p.key];
    eq+='<div class="m-row"><span>'+p.name+'：'+(e?'<span class="q-'+QUALITIES[e.quality].key+'">'+e.qualityName+'·'+e.base+(e.lv>0?'+'+e.lv:'')+(e.special==='tongxin'?'(同心结)':'')+'</span>':'（空）')+'</span>'+
      '<span style="display:flex;gap:4px;flex-wrap:wrap">'+(e?'<button class="btn tiny" data-act="strengthen" data-id="'+d.id+'" data-part="'+p.key+'">强化</button><button class="btn tiny" data-act="advanceEquip" data-id="'+d.id+'" data-part="'+p.key+'">进阶</button><button class="btn tiny" data-act="unequip" data-id="'+d.id+'" data-part="'+p.key+'">卸下</button><button class="btn tiny" data-act="awaken" data-id="'+d.id+'" data-part="'+p.key+'">觉醒</button><button class="btn tiny" data-act="bloodBind" data-id="'+d.id+'" data-part="'+p.key+'">血炼</button>':'')+
      '<button class="btn tiny gold" data-act="equipPick" data-id="'+d.id+'" data-part="'+p.key+'">'+(e?'更换':'装备')+'</button></span></div>';
  });
  var gf='<div class="m-row"><span>心法：'+(d.gongfa.xinfa?GONGFA.xinfa.filter(function(x){return x.id===d.gongfa.xinfa.id;})[0].name+'（'+d.gongfa.xinfa.lv+'阶）':'无')+'</span><span style="display:flex;gap:4px">'+(d.gongfa.xinfa?'<button class="btn tiny" data-act="upgradeGf" data-id="'+d.id+'" data-slot="xinfa">升阶</button>':'')+'<button class="btn tiny gold" data-act="gongfaPick" data-id="'+d.id+'" data-slot="xinfa">参悟</button></span></div>'+
    '<div class="m-row"><span>武技：'+(d.gongfa.wuji?GONGFA.wuji.filter(function(x){return x.id===d.gongfa.wuji.id;})[0].name+'（'+d.gongfa.wuji.lv+'阶）':'无')+'</span><span style="display:flex;gap:4px">'+(d.gongfa.wuji?'<button class="btn tiny" data-act="upgradeGf" data-id="'+d.id+'" data-slot="wuji">升阶</button>':'')+'<button class="btn tiny gold" data-act="gongfaPick" data-id="'+d.id+'" data-slot="wuji">参悟</button></span></div>';
  var pills=Object.keys(PILLS).map(function(k){return '<button class="btn tiny" data-act="usePill" data-id="'+d.id+'" data-pill="'+k+'" '+(g.res.pills[k]<1?'disabled':'')+'>'+PILLS[k].name+'('+g.res.pills[k]+')</button>';}).join('');
  // v5 属性总览（王者式出装面板）
  var es2=game.equipStats(d);
  function pct(v){ return Math.round((v||0)*100)+'%'; }
  var st='<div class="m-row"><span>攻击</span><b>'+fmt(es2.atk||0)+'</b></div>'+
    '<div class="m-row"><span>护甲（减伤'+Math.round(armorReduce(es2.def||0)*100)+'%）</span><b>'+fmt(es2.def||0)+'</b></div>'+
    '<div class="m-row"><span>生命</span><b>'+fmt(es2.hp||0)+'</b></div>'+
    '<div class="m-row"><span>暴击 / 暴伤</span><b>'+pct(es2.crit)+' / '+(150+Math.round((es2.critDmg||0)*100))+'%</b></div>'+
    '<div class="m-row"><span>破甲 / 吸血</span><b>'+pct(es2.penetrate)+' / '+pct(es2.lifesteal)+'</b></div>'+
    '<div class="m-row"><span>闪避 / 格挡</span><b>'+pct(es2.dodge)+' / '+pct(es2.block)+'</b></div>'+
    '<div class="m-row"><span>修炼速度</span><b>+'+pct(es2.speed)+'</b></div>';
  var sets=game.setCountAll(d),setTxt='';
  for(var sk in SETS){ if(sets[sk]>0) setTxt+='<div class="sub" style="font-size:11px">【'+SETS[sk].name+'】'+sets[sk]+'/4 件'+(sets[sk]>=2?'（已激活：'+(sets[sk]>=4?SETS[sk].four:SETS[sk].two)+'）':'（还差 '+(2-sets[sk])+' 件激活）')+'</div>'; }
  showModal('<h2>'+d.name+'</h2>'+
    '<div class="m-row"><span>境界</span><b>'+REALMS[d.realm].name+'（'+REALMS[d.realm].title+'）</b></div>'+
    '<div class="m-row"><span>战斗力</span><b>'+fmt(game.disciplePower(d))+'</b></div>'+
    '<div class="m-row"><span>灵根</span><b>'+d.lingGen.quality+'·'+d.lingGen.type+'</b></div>'+
    '<div class="m-row"><span>悟性/福缘</span><b>'+d.wuXing+'/'+d.fuYuan+'</b></div>'+
    '<div class="m-row"><span>修为</span><b>'+fmt(d.exp)+'/'+fmt(need)+'</b></div>'+
    '<div class="m-row"><span>突破成功率</span><b>'+Math.round(game.breakthroughRate(d)*100)+'%</b></div>'+
    '<div class="sub">词条：'+traits+'</div>'+(d.story?'<div class="sub" style="margin-top:4px">经历：'+d.story+'</div>':'')+
    '<div class="m-sec">装备</div>'+eq+setTxt+
    '<div class="m-sec">属性总览</div>'+st+
    '<div class="m-sec">功法</div>'+gf+
    '<div class="m-sec">丹药</div><div class="btn-row">'+pills+'</div>'+
    '<div class="close-row">'+(full&&d.state!=='injured'?'<button class="btn gold hl" data-act="break" data-id="'+d.id+'">'+BTN_TXT.breakthrough+'</button>':'')+'<button class="btn" data-act="closeModal">收下</button></div>');
}
function showEquipPick(did,part){
  var g=game.state,list=g.res.equipBank.filter(function(e){return e.part===part;});
  if(!list.length){ toast('仓库无此部位装备'); return; }
  list.sort(function(a,b){return b.quality-a.quality;});
  var d=game.findDisciple(did);
  var partName=null; EQUIP_PARTS.forEach(function(p){ if(p.key===part) partName=p.name; });
  var rows=list.map(function(e){
    var c=game.equipCompare(d,e),cTxt='';
    function dTxt(k,n,fmtF){ var v=c[k]; if(v) cTxt+='<span style="color:'+(v>0?'var(--ok)':'var(--bad)')+'">'+n+(fmtF?fmtF(v):(v>0?'+':'')+Math.round(v))+'</span> '; }
    dTxt('power','战力',function(v){return (v>0?'+':'')+fmt(v);});
    dTxt('atk','攻'); dTxt('def','防'); dTxt('hp','血');
    dTxt('crit','暴击',function(v){return (v>0?'+':'')+Math.round(v*100)+'%';});
    dTxt('critDmg','暴伤',function(v){return (v>0?'+':'')+Math.round(v*100)+'%';});
    dTxt('penetrate','破甲',function(v){return (v>0?'+':'')+Math.round(v*100)+'%';});
    dTxt('lifesteal','吸血',function(v){return (v>0?'+':'')+Math.round(v*100)+'%';});
    dTxt('dodge','闪避',function(v){return (v>0?'+':'')+Math.round(v*100)+'%';});
    dTxt('block','格挡',function(v){return (v>0?'+':'')+Math.round(v*100)+'%';});
    return '<div class="m-row" style="align-items:flex-start"><span class="q-'+QUALITIES[e.quality].key+'">'+e.qualityName+'·'+e.base+(e.lv>0?'+'+e.lv:'')+(e.set?'【'+SETS[e.set].name+'】':'')+'<br><small style="color:var(--ink2)">攻'+e.baseAtk+' 防'+e.baseDef+' 生'+e.baseHp+(e.affixes.length?'｜'+e.affixes.map(function(a){return a.desc;}).join('、'):'')+'</small>'+(cTxt?'<br><small style="font-size:10px">'+cTxt+'</small>':'')+'</span><button class="btn tiny gold" data-act="equipConfirm" data-id="'+did+'" data-part="'+part+'" data-eid="'+e.id+'">装备</button></div>';
  }).join('');
  var rec='';
  if(d) rec='<div class="sub" style="font-size:11px;margin-bottom:6px">💡 '+game.recommendEquip(d).join('<br>💡 ')+'</div>';
  showModal('<h2>选择'+partName+'</h2>'+rec+rows+'<div class="close-row"><button class="btn ghost" data-act="closeModal">再议</button></div>');
}
/* ---------- v5 装备库（背包管理：分解/赠礼/图鉴） ---------- */
function showArmory(){
  var g=game.state,list=g.res.equipBank;
  var codex=game.equipCodex();
  if(!list.length){
    showModal('<h2>🎒 装备库</h2><div class="mdesc">仓库空空如也……<br>游历宝箱、首领掉落、器室炼器、演武场都可获得装备。</div>'+
      '<div class="sub">矿石 '+fmt(g.res.kuangShi)+'｜器灵精华 '+fmt(g.res.jinghua||0)+'</div>'+
      '<div class="sub">图鉴 '+codex.count+'/'+codex.total+'</div>'+
      '<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>');
    return;
  }
  list.sort(function(a,b){ return b.quality-a.quality||b.lv-a.lv; });
  var rows=list.map(function(e){
    return '<div class="m-row" style="align-items:flex-start"><span class="q-'+QUALITIES[e.quality].key+'">'+e.qualityName+'·'+e.base+(e.lv>0?'+'+e.lv:'')+(e.set?'【'+SETS[e.set].name+'】':'')+(e.source?'<br><small style="color:var(--ink2)">'+e.source+'</small>':'')+'</span>'+
      '<span style="display:flex;gap:4px;flex-wrap:wrap"><button class="btn tiny" data-act="decomposeEquip" data-eid="'+e.id+'">分解</button>'+
      (g.alliance?'<button class="btn tiny rose" data-act="giftEquip" data-eid="'+e.id+'">赠礼</button>':'')+
      '</span></div>';
  }).join('');
  showModal('<h2>🎒 装备库（'+list.length+'）</h2>'+
    '<div class="sub">矿石 '+fmt(g.res.kuangShi)+'｜器灵精华 '+fmt(g.res.jinghua||0)+'｜图鉴 '+codex.count+'/'+codex.total+(codex.count>=codex.total?'（集齐！）':'')+'</div>'+
    '<div class="sub" style="font-size:11px">分解得矿石+精华；精华用于进阶；结盟后可赠礼给'+CONFIG.PARTNER_NAME+'；3 件同品质可「三宝合一」升品质</div>'+
    '<div class="btn-row" style="margin-bottom:4px"><button class="btn gold" data-act="combineMode">⚒️ 装备合成</button></div>'+
    rows+'<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>');
}
/* ---------- v5.3 装备合成：三宝合一（3 件同品质 → 高一级） ---------- */
function showCombinePick(){
  var g=game.state,list=g.res.equipBank;
  if(!ui.combineSel) ui.combineSel=[];
  var rows=list.map(function(e){
    var sel=ui.combineSel.indexOf(e.id)>=0;
    return '<div class="m-row" style="align-items:flex-start;cursor:pointer" data-act="combinePick" data-eid="'+e.id+'">'+
      '<span class="q-'+QUALITIES[e.quality].key+'">'+(sel?'☑':'☐')+' '+e.qualityName+'·'+e.base+(e.lv>0?'+'+e.lv:'')+(e.set?'【'+SETS[e.set].name+'】':'')+'</span></div>';
  }).join('');
  var hint='<div class="sub">已选 '+ui.combineSel.length+'/3 · 选 3 件同品质装备合成高一级（消耗 100 灵石）</div>';
  if(ui.combineSel.length===3){
    var qs=[],parts=[],i;
    for(i=0;i<ui.combineSel.length;i++){
      for(var j=0;j<g.res.equipBank.length;j++) if(g.res.equipBank[j].id===ui.combineSel[i]){ qs.push(g.res.equipBank[j].quality); parts.push(g.res.equipBank[j].part); }
    }
    if(qs[0]===qs[1]&&qs[1]===qs[2]&&qs[0]<4){
      var sameP=parts[0]===parts[1]&&parts[1]===parts[2];
      hint='<div class="sub" style="color:var(--ok)">✨ 可合成 <b>'+QUALITIES[qs[0]+1].name+'</b>（'+(sameP?'定向·同部位':'随机部位')+'）</div>'+
        '<div class="btn-row" style="margin-bottom:4px"><button class="btn gold" data-act="combineDo">三宝合一（100灵石）</button></div>';
    }else{
      hint='<div class="sub" style="color:var(--bad)">三件装备品质必须相同（先天至宝已是顶级，不可合成）</div>';
    }
  }
  showModal('<h2>⚒️ 装备合成</h2>'+hint+rows+
    '<div class="close-row"><button class="btn ghost" data-act="combineCancel">取消</button></div>');
}
/* ---------- v5 演武场（真实回合制·护甲减伤体验） ---------- */
function showArena(){
  var g=game.state,d=game.strongestDisciple();
  var lv=ARENA_LEVELS[g.arena?g.arena.level:0]||ARENA_LEVELS[0];
  var left=game.arenaLeft();
  var html='<h2>⚔️ 演武场</h2>'+
    '<div class="mdesc">宗门演武场，挑战守关镜像，体验真实攻防！<br>护甲减伤：减伤率=护甲/(护甲+500)，暴击/破甲/吸血/闪避/格挡全部生效。</div>'+
    '<div class="m-row"><span>当前层</span><b>'+lv.name+'</b></div>'+
    '<div class="m-row"><span>今日剩余</span><b>'+left+'/'+ARENA_DAILY+' 次</b></div>'+
    '<div class="m-row"><span>最强弟子</span><b>'+(d?d.name+'（战力 '+fmt(game.disciplePower(d))+'）':'无')+'</b></div>'+
    '<div class="m-row"><span>通关记录</span><b>胜 '+(g.arena?(g.arena.wins||0):0)+' 场</b></div>'+
    '<div class="sub" style="font-size:11px">对手战力约为你的 '+(lv.mult*100)+'%，胜利奖励矿石/精华，高层必掉装备</div>'+
    '<div class="close-row"><button class="btn gold" data-act="arenaFight" '+(left<=0||!d?'disabled':'')+'>⚔️ 挑战</button><button class="btn" data-act="closeModal">收下</button></div>';
  showModal(html);
}
/* ---------- v5.4 布置任务（带她玩） ---------- */
function showQuestPick(){
  var g=game.state;
  if(!g.alliance){ toast('需先结盟才能布置任务'); return; }
  var rows=QUEST_TYPES.map(function(q){
    return '<div class="m-row"><span>'+q.name+'</span><button class="btn tiny gold" data-act="questSend" data-qid="'+q.id+'">布置</button></div>';
  }).join('');
  showModal('<h2>🎯 布置任务</h2><div class="mdesc">给'+CONFIG.PARTNER_NAME+'布置一个小任务，她完成时你会收到通知（契缘+10）</div>'+
    rows+'<div class="sub" style="font-size:11px">任务会出现在她的传书页，打开即可看到</div>'+
    '<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>');
}
function showGongfaPick(did,slot){
  var g=game.state,d=game.findDisciple(did);
  if(!d) return;
  var list=slot==='xinfa'?GONGFA.xinfa:GONGFA.wuji;
  var rows=list.map(function(x){
    var owned=d.gongfa[slot]&&d.gongfa[slot].id===x.id;
    var req='';
    if(x.juan){ req='残卷 '+g.res.juan[x.juan]+'/'+x.juanNeed; }
    else if(x.resonance){ var c=x.cost(0); req='声望'+c.shengWang; }
    var locked=g.facilities.cangjing<x.need||(x.alliance&&!g.alliance);
    return '<button class="btn opt" data-act="learnGf" data-id="'+did+'" data-slot="'+slot+'" data-gf="'+x.id+'" '+(locked||owned?'disabled':'')+'>'+
      '<div class="opt-t">《'+x.name+'》'+(owned?'（已习得）':'')+(x.alliance?'【双修】':'')+(x.elem?'【'+x.elem+'系】':'')+'</div>'+
      '<div class="opt-d">'+x.desc+' · 藏经阁'+x.need+'级'+(req?' · 需'+req:'')+'</div></button>';
  }).join('');
  showModal('<h2>'+(slot==='xinfa'?'参悟心法':'参悟武技')+'</h2>'+rows+'<div class="close-row"><button class="btn ghost" data-act="closeModal">再议</button></div>');
}
function showTasks(){
  var g=game.state;
  var html='<h2>任务</h2><div class="m-sec">日常任务</div>';
  g.daily.list.forEach(function(t,i){
    var prog=game.taskProgress(t),done=prog>=t.target,claimed=g.daily.claimed.indexOf(t.id)>=0;
    html+='<div class="m-row"><span>'+t.name+'（'+prog+'/'+t.target+'）</span>'+(claimed?'<b style="color:#3f9a5c">已领</b>':'<button class="btn tiny gold" data-act="claimTask" data-type="daily" data-idx="'+i+'" '+(done?'':'disabled')+'>领取</button>')+'</div>';
  });
  html+='<div class="m-sec">周常任务（奖仙玉）</div>';
  g.weekly.list.forEach(function(t,i){
    var prog=game.taskProgress(t),done=prog>=t.target,claimed=g.weekly.claimed.indexOf(t.id)>=0;
    html+='<div class="m-row"><span>'+t.name+'（'+prog+'/'+t.target+'）</span>'+(claimed?'<b style="color:#3f9a5c">已领</b>':'<button class="btn tiny gold" data-act="claimTask" data-type="weekly" data-idx="'+i+'" '+(done?'':'disabled')+'>仙玉×'+t.reward.xianYu+'</button>')+'</div>';
  });
  html+='<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>';
  showModal(html);
}
function showAch(){
  var g=game.state;
  var html='<h2>成就</h2>';
  ACHIEVEMENTS.forEach(function(a){
    var done=!!g.achievements[a.id];
    html+='<div class="ach-item '+(done?'done':'')+'"><span class="ach-ic"><img src="'+Art.resURL(a.couple?'beast':'jade')+'" alt=""></span><span style="flex:1"><b>'+a.name+'</b>'+(a.couple?'<span class="trait gold">神仙眷侣</span>':'')+'<br><small style="color:#8a7a4a">'+a.desc+'</small></span>'+(done?'<b style="color:#c9a227">已达成</b>':'<b style="color:#8a8a8a">未达成</b>')+'</div>';
  });
  html+='<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>';
  showModal(html);
}
function showQiYun(){
  var g=game.state;
  var html='<h2>气运商店</h2><div class="mdesc">当前气运点：'+g.qiYun+'（通过「气运重聚」获得）</div>';
  QIYUN_SHOP.forEach(function(x){
    var owned=x.once&&g.unlock[x.id];
    html+='<div class="m-row"><span>'+x.name+'<br><small style="color:#8a7a4a">'+x.desc+'</small></span>'+(owned?'<b style="color:#3f9a5c">已拥有</b>':'<button class="btn tiny gold" data-act="buyQiYun" data-id="'+x.id+'" '+(g.qiYun<x.cost?'disabled':'')+'>'+x.cost+'点</button>')+'</div>';
  });
  html+='<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>';
  showModal(html);
}
function showQuiz(){
  var g=game.state,quiz=game.quizOfToday();
  var html='<h2>默契问答</h2><div class="mdesc">每日 3 题，双方答对越多情缘越深（答对+5情缘/+200灵石）</div>';
  for(var i=0;i<quiz.length;i++){
    var it=quiz[i],done=g.quizAns[i]!==undefined;
    html+='<div class="m-sec" style="margin-top:10px">'+(i+1)+'. '+it.q+(done?' <span class="'+(g.quizAns[i]===it.ans?'num-up':'num-down')+'">'+(g.quizAns[i]===it.ans?'✓':'✗')+'</span>':'')+'</div>';
    html+='<div class="btn-row">';
    for(var j=0;j<it.opts.length;j++){
      html+='<button class="btn small '+(done?(g.quizAns[i]===j?(g.quizAns[i]===it.ans?'gold':'down'):''):'')+'" data-act="quizAnswer" data-q="'+i+'" data-a="'+j+'" '+(done?'disabled':'')+'>'+it.opts[j]+'</button>';
    }
    html+='</div>'+(done&&g.quizAns[i]!==it.ans?'<div class="sub" style="color:var(--cinnabar)">正确答案：'+it.opts[it.ans]+'</div>':'');
  }
  if(g.quizCorrect>=3) html+='<div class="mdesc" style="color:var(--rose);margin-top:8px">🎉 今日全对！果然是心有灵犀的一对</div>';
  html+='<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>';
  showModal(html);
}
function showXiu(){
  var g=game.state;
  var myDone=g.xiuDone&&g.xiuDate===game.todayStr();
  var both=game.xiuBothDone();
  var html='<h2>同心双修</h2><div class="mdesc">每日一次：双方各自向同心阵注入灵力，都注入则双修圆满（情缘+10，灵石+500，仙玉+1）</div>';
  html+='<div class="m-row"><span>我的灵力</span><b class="'+(myDone?'num-up':'')+'">'+(myDone?'已注入 ✓':'未注入')+'</b></div>';
  html+='<div class="m-row"><span>道侣灵力</span><b class="'+(game.otherXiuDone?'num-up':'')+'">'+(game.otherXiuDone?'已呼应 ✓':'未呼应')+'</b></div>';
  if(both){ html+='<div class="mdesc" style="color:var(--rose);margin-top:8px">💫 双修圆满！同心阵灵光大盛</div>'; }
  else { html+='<div class="btn-row" style="margin-top:8px"><button class="btn gold" data-act="xiuInject" '+(myDone?'disabled':'')+'>'+(myDone?'今日已注入':'注入灵力')+'</button></div>'; }
  html+='<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>';
  showModal(html);
}
function showWish(){
  showModal('<h2>🌠 流星夜许愿</h2><div class="mdesc">对着流星说出心愿，它会替你把愿望带给星河（情缘+5，灵石+300）</div><input id="wishInput" maxlength="30" placeholder="写下你的心愿…" style="width:100%;padding:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:6px;font-size:15px"><div class="close-row"><button class="btn" data-act="closeModal">再想想</button><button class="btn gold" data-act="wishDo">许愿</button></div>');
  setTimeout(function(){ var inp=document.getElementById('wishInput'); if(inp){ inp.focus(); } },50);
}
/* v4.2 心意笺弹窗 */
function showNote(){
  showModal('<div class="star-card"><div class="star-emoji">💌</div><div class="g-title">心意笺 · 写给'+CONFIG.PARTNER_NAME+'</div>'+
    '<div class="mdesc">每天一句心里话（10~30字），她登录宗门时就能看到。她会收到你的心意，也会悄悄回你。</div>'+
    '<input id="noteInput" maxlength="30" placeholder="今天想对她说…" style="width:100%;padding:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:6px;font-size:15px">'+
    '<div class="close-row"><button class="btn" data-act="closeModal">再想想</button><button class="btn rose" data-act="noteDo">寄出</button></div></div>');
  setTimeout(function(){ var inp=document.getElementById('noteInput'); if(inp){ inp.focus(); } },50);
}
function showNoteReply(){
  showModal('<div class="star-card"><div class="star-emoji">💌</div><div class="g-title">回笺 · 给'+CONFIG.PARTNER_NAME+'</div>'+
    '<div class="mdesc">他今天给你留了话，回一句吧（10~30字）</div>'+
    '<input id="noteReplyInput" maxlength="30" placeholder="回复他…" style="width:100%;padding:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:6px;font-size:15px">'+
    '<div class="close-row"><button class="btn" data-act="closeModal">再想想</button><button class="btn rose" data-act="noteReplyDo">寄出</button></div></div>');
  setTimeout(function(){ var inp=document.getElementById('noteReplyInput'); if(inp){ inp.focus(); } },50);
}
/* ============ v4.3 道侣行迹 ============ */
/* ============ v4.3 道侣行迹 ============ */
/** 行迹列表 → 按天分组 HTML（今天/昨天/日期）——showTrails/showTrailsMine 共用 */
function trailGroupHtml(list){
  if(!list||!list.length) return null;
  var groups={};
  for(var i=0;i<list.length;i++){
    var it=list[i],d=new Date(it.t||Date.now());
    var n=new Date(),a=new Date(n.getFullYear(),n.getMonth(),n.getDate()),b=new Date(d.getFullYear(),d.getMonth(),d.getDate());
    var key=Math.round((a-b)/86400000);
    var dayKey=key===0?'今天':key===1?'昨天':(d.getMonth()+1)+'月'+d.getDate()+'日';
    if(!groups[dayKey]) groups[dayKey]=[];
    groups[dayKey].push(it);
  }
  var html='';
  var dayOrder=['今天','昨天'].concat(Object.keys(groups).filter(function(k){return k!=='今天'&&k!=='昨天';}));
  for(var j=0;j<dayOrder.length;j++){
    var dk=dayOrder[j];
    if(!groups[dk]) continue;
    html+='<div class="trail-day">— '+dk+' —</div>';
    for(var k=0;k<groups[dk].length;k++){
      var x=groups[dk][k];
      var ts=new Date(x.t||Date.now());
      var hh=('0'+ts.getHours()).slice(-2),mm=('0'+ts.getMinutes()).slice(-2);
      html+='<div class="trail-item'+(x.kind==='online'?' trail-online':'')+'"><span class="ticon">'+game.trailIcon(x.kind)+'</span><span class="td">'+x.detail+'</span><span class="tt">'+hh+':'+mm+'</span></div>';
    }
  }
  return html;
}
function showTrails(){
  var boxId='trailBox';
  showModal('<div class="star-card" style="text-align:left"><div class="star-emoji" style="font-size:30px">📔</div>'+
    '<div class="g-title">道侣行迹</div>'+
    '<div class="mdesc" style="font-size:12px">'+CONFIG.PARTNER_NAME+'何时上线、都做了些什么，尽在此卷。'+(game.otherOnline?'<b style="color:#7fae5f"> · 她此刻在线</b>':'<b style="color:var(--muted)"> · 她此刻离线</b>')+'</div>'+
    '<div class="btn-row"><button class="btn tiny gold" data-act="trailMine">我的行迹</button><button class="btn tiny" data-act="trailsShow">她的行迹</button></div>'+
    '<div id="trailBox" class="trail-list"><span style="opacity:.6;font-size:12px">正在翻阅行迹卷宗…</span></div>'+
    '<div class="close-row"><button class="btn ghost" data-act="closeModal">合上</button></div></div>');
  function renderTrailList(list){
    var box=document.getElementById(boxId);
    if(!box) return;   // 弹窗已关闭 → 丢弃
    var html=trailGroupHtml(list);
    box.innerHTML=html||'<div class="empty" style="padding:14px 0">尚无形迹记录……</div>';
  }
  DB.loadPartnerProfile(function(p){
    var os=(p&&p.resources&&p.resources.__state)||game.otherState||null;
    if(os&&os.trails) renderTrailList(os.trails);
    else if(game.otherState&&game.otherState.trails) renderTrailList(game.otherState.trails);
    else renderTrailList([]);
  });
}
/* 我的行迹（弹窗内切换） */
function showTrailsMine(){
  var me=game.state;
  var list=(me.trails||[]).slice();
  var box=document.getElementById('trailBox');
  if(!box) return;
  var html=trailGroupHtml(list);
  box.innerHTML=html||'<div class="empty" style="padding:14px 0">你还没有留下行迹……<br>上线、签到、观星、写笺都会记录。</div>';
}
/* ============ v4.4 双人斗地主 UI ============ */
function showCardGame(){
  if(!ui.cardSel) ui.cardSel=[];
  showModal('<div class="star-card" style="text-align:left"><div class="star-emoji" style="font-size:28px">🃏</div>'+
    '<div class="g-title">斗地主 · 与'+CONFIG.PARTNER_NAME+'对弈</div>'+
    '<div id="cardGameBox"></div>'+
    '<div class="close-row"><button class="btn ghost" data-act="closeModal">收牌</button></div></div>');
  renderCardGame();
}
function renderCardGame(){
  var box=document.getElementById('cardGameBox');
  if(!box) return;
  var g=game.state,cg=g.cardGame;
  if(!cg){
    box.innerHTML='<div class="mdesc" style="padding:10px 0">双人斗地主：回合制对弈，谁先出完 17 张谁赢（单/对/三带一/顺子/连对/炸弹/王炸）。赢家灵石+500、契缘+5。</div>'+
      '<div class="btn-row"><button class="btn gold" data-act="cardStart">发起牌局</button></div>';
    return;
  }
  if(cg.status==='ended'){
    box.innerHTML='<div class="mdesc" style="padding:10px 0">对局结束：<b class="num-gold">'+(cg.winner==='me'?'你赢了！🎉 灵石+500':'她赢了，灵石+100')+'</b></div>'+
      '<div class="btn-row"><button class="btn gold" data-act="cardStart">再来一局</button></div>';
    return;
  }
  var turnTxt=cg.turn==='me'?'<b class="num-up">轮到你了</b>':'<span style="color:var(--muted)">等待'+CONFIG.PARTNER_NAME+'出牌…</span>';
  var curTxt='';
  if(cg.cur&&cg.cur.cards){ curTxt='<div class="sub" style="margin:6px 0">上家出：<b>'+cg.cur.cards.map(cardStr).join(' ')+'</b></div>'; }
  var sorted=cg.myHand.slice().sort(function(a,b){return a.r-b.r||a.s-b.s;});
  var cardsHtml='<div style="display:flex;flex-wrap:wrap;gap:3px;margin:8px 0">'+sorted.map(function(c,i){
    var sel=ui.cardSel&&ui.cardSel.indexOf(i)>=0;
    return '<div class="card-tile'+(sel?' sel':'')+'" data-idx="'+i+'" data-act="cardSel" style="animation-delay:'+Math.min(i*.03,.5)+'s;width:34px;height:48px;border-radius:5px;background:linear-gradient(160deg,#fdf6e3,#f5e6c4);border:1px solid '+(c.r>=16?'#b05f75':'#d8b45a')+';color:'+(c.r>=16?'#b05f75':'#5a3a1a')+';font-size:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,.3)">'+cardStr(c)+'</div>';
  }).join('')+'</div>';
  box.innerHTML='<div class="sub">'+turnTxt+' · 对方余牌 <b class="num-gold">'+cg.theirCount+'</b> 张</div>'+curTxt+cardsHtml+
    '<div class="btn-row"><button class="btn gold" data-act="cardDo" '+(cg.turn==='me'?'':'disabled')+'>出牌</button>'+
    '<button class="btn" data-act="cardPassDo" '+(cg.turn==='me'&&cg.cur&&cg.cur.who==='them'?'':'disabled')+'>不出</button></div>';
}
/* ============ v4.4 双人台球 UI ============ */
function showPoolGame(){
  showModal('<div class="star-card" style="text-align:left"><div class="star-emoji" style="font-size:28px">🎱</div>'+
    '<div class="g-title">台球 · 与'+CONFIG.PARTNER_NAME+'对局</div>'+
    '<canvas id="poolCanvas" width="640" height="320" style="width:100%;border-radius:10px;border:1px solid rgba(216,180,90,.3);background:#0b5d3b"></canvas>'+
    '<div id="poolBox"></div>'+
    '<div class="close-row"><button class="btn ghost" data-act="closeModal">收杆</button></div></div>');
  renderPoolGame();
}
function drawPool(){
  var cv=document.getElementById('poolCanvas');
  if(!cv) return;
  var ctx=cv.getContext('2d');
  var g=game.state,pg=g.poolGame;
  if(!pg) return;
  ctx.clearRect(0,0,640,320);
  // 桌呢
  ctx.fillStyle='#0b5d3b';
  ctx.fillRect(0,0,640,320);
  ctx.strokeStyle='rgba(216,180,90,.5)';
  ctx.lineWidth=3;
  ctx.strokeRect(3,3,634,314);
  // 袋口
  ctx.fillStyle='#111';
  for(var p=0;p<POOL_POCKETS.length;p++){
    ctx.beginPath();
    ctx.arc(POOL_POCKETS[p][0]*2,POOL_POCKETS[p][1]*2,POOL_POCKET_R*2,0,Math.PI*2);
    ctx.fill();
  }
  // 球
  var balls=pg.animBalls||pg.balls;
  for(var i=0;i<balls.length;i++){
    var b=balls[i];
    if(b.pocketed) continue;
    ctx.beginPath();
    ctx.arc(b.x*2,b.y*2,POOL_R*2-1,0,Math.PI*2);
    ctx.fillStyle=b.color;
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.35)';
    ctx.lineWidth=1;
    ctx.stroke();
    // 高光
    ctx.beginPath();
    ctx.arc(b.x*2-2,b.y*2-2,2,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,.6)';
    ctx.fill();
  }
}
function renderPoolGame(){
  drawPool();
  var box=document.getElementById('poolBox');
  if(!box) return;
  var g=game.state,pg=g.poolGame;
  if(!pg){
    box.innerHTML='<div class="mdesc" style="padding:10px 0">双人台球：红蓝各 3 球，打进己方全部 3 球后进黑 8 获胜。白球落袋犯规换边。回合制，画面双方一致。</div>'+
      '<div class="btn-row"><button class="btn gold" data-act="poolStart">摆球开局</button></div>';
    return;
  }
  if(pg.ended){
    box.innerHTML='<div class="mdesc" style="padding:10px 0">球局结束：<b class="num-gold">'+(pg.winner==='me'?'你赢了！🎉 灵石+600':'她赢了，灵石+120')+'</b></div>'+
      '<div class="btn-row"><button class="btn gold" data-act="poolStart">再来一局</button></div>';
    return;
  }
  var turnTxt=pg.turn==='me'?'<b class="num-up">轮到你了（红球）</b>':'<span style="color:var(--muted)">等待'+CONFIG.PARTNER_NAME+'击球…</span>';
  if(pg.turn!=='me'||pg.animating){
    box.innerHTML='<div class="sub">'+turnTxt+' · 你 <b class="num-gold">'+pg.myScore+'</b> : '+pg.theirScore+' <b class="num-gold">她</b></div>';
    return;
  }
  var ang=ui.poolAngle||0,power=ui.poolPower||50;
  box.innerHTML='<div class="sub">'+turnTxt+' · 你 <b class="num-gold">'+pg.myScore+'</b> : '+pg.theirScore+' <b class="num-gold">她</b></div>'+
    '<div class="sub" style="margin-top:6px">角度 <b class="num-gold">'+ang+'°</b></div>'+
    '<input type="range" min="0" max="360" value="'+ang+'" data-act="poolAngle" style="width:100%">'+
    '<div class="sub" style="margin-top:4px">力度 <b class="num-gold">'+power+'</b></div>'+
    '<input type="range" min="5" max="100" value="'+power+'" data-act="poolPower" style="width:100%">'+
    '<div class="btn-row"><button class="btn gold" data-act="poolShootDo">出杆</button></div>';
}
/* ============ v4.3 云卷宗（查阅对方账户） ============ */
function showScroll(){
  var boxId='scrollBox';
  showModal('<div class="star-card" style="text-align:left"><div class="star-emoji" style="font-size:30px">📜</div>'+
    '<div class="g-title">云卷宗 · '+CONFIG.PARTNER_NAME+'之档案</div>'+
    '<div id="scrollBox"><span style="opacity:.6;font-size:12px">正在调阅宗门卷宗…</span></div>'+
    '<div class="close-row"><button class="btn ghost" data-act="closeModal">合上</button></div></div>');
  DB.loadPartnerProfile(function(p){
    var box=document.getElementById(boxId);
    if(!box) return;
    var os=(p&&p.resources&&p.resources.__state)||game.otherState||null;
    if(!p&&!os){ box.innerHTML='<div class="empty" style="padding:14px 0">对方宗门尚未传讯，卷宗为空。</div>'; return; }
    var st=os||{};
    var qy=st.qingYuan||0,qi=(st.qiyuan||0);
    var qiLvIdx=0; for(var i2=QIYUAN_LEVELS.length-1;i2>=0;i2--) if(qi>=QIYUAN_LEVELS[i2].need){ qiLvIdx=i2; break; }
    var daoN=(st.daoji&&st.daoji.length)||0;
    var res=st.res||{};
    var check=st.checkin||{};
    var sectName=st.sectName||(p&&p.sect_name)||'未知';
    var html='';
    html+='<div class="scroll-grid">'+
      '<div class="scroll-cell"><div class="k">宗门</div><div class="v">'+sectName+'</div></div>'+
      '<div class="scroll-cell"><div class="k">称号</div><div class="v">'+(st.masterTitle||'掌门')+'</div></div>'+
      '<div class="scroll-cell"><div class="k">道行</div><div class="v">'+(st.sectLv||1)+' 级</div></div>'+
      '<div class="scroll-cell"><div class="k">契缘</div><div class="v"><span class="qy-lv">'+QIYUAN_LEVELS[qiLvIdx].name+'</span></div></div>'+
      '<div class="scroll-cell"><div class="k">宗训</div><div class="v" style="font-size:12px">'+(st.motto||'（未立宗训）')+'</div></div>'+
      '<div class="scroll-cell"><div class="k">在线</div><div class="v" style="font-size:12px">'+(game.otherOnline?'<b style="color:#7fae5f">此刻在线</b>':'离线 · 累计 '+((st.onlineMinutes||0)>=60?fmt((st.onlineMinutes||0)/60)+' 小时':Math.round(st.onlineMinutes||0)+' 分钟'))+'</div></div>'+
      '<div class="scroll-cell"><div class="k">灵石</div><div class="v num-gold">'+fmt(res.lingShi||0)+'</div></div>'+
      '<div class="scroll-cell"><div class="k">仙玉</div><div class="v num-gold">'+(res.xianYu||0)+'</div></div>'+
      '</div>';
    html+='<div class="scroll-sec">💞 情感</div>'+
      '<div class="scroll-grid">'+
      '<div class="scroll-cell"><div class="k">情缘值</div><div class="v" style="color:var(--rose)">'+fmt(qy)+'</div></div>'+
      '<div class="scroll-cell"><div class="k">签到天数</div><div class="v">'+(check.total||0)+' 天</div></div>'+
      '<div class="scroll-cell"><div class="k">道偈图鉴</div><div class="v">'+daoN+'/12</div></div>'+
      '<div class="scroll-cell"><div class="k">心意笺</div><div class="v">'+(st.noteText?'今日已写':'今日未写')+'</div></div>'+
      '</div>';
    var logs=(st.logs||[]).slice(0,15);
    if(logs.length){
      html+='<div class="scroll-sec">✍️ 修行日志（最近）</div><div class="scroll-log">'+logs.map(function(l){
        var t=new Date(l.t||Date.now()); var hh=('0'+t.getHours()).slice(-2),mm=('0'+t.getMinutes()).slice(-2);
        return '<div class="log-item"><span style="color:var(--muted)">'+hh+':'+mm+'</span> '+l.s+'</div>';
      }).join('')+'</div>';
    }
    var his=(st.history||[]).slice(0,12);
    if(his.length){
      html+='<div class="scroll-sec">📖 宗门史书（最近）</div><div class="scroll-log">'+his.map(function(h){
        var t=new Date(h.t||Date.now()); var m=(t.getMonth()+1)+'月'+t.getDate()+'日';
        return '<div class="log-item"><span style="color:var(--muted)">'+m+'</span> <b>'+h.title+'</b> — '+h.desc+'</div>';
      }).join('')+'</div>';
    }
    box.innerHTML=html;
  });
}
function showFestLamp(){
  showModal('<h2>🏮 放一盏花灯</h2><div class="mdesc">写下心愿放进花灯，让它顺流而下（情缘+3，灵石+200）</div><input id="lampInput" maxlength="30" placeholder="花灯寄语…" style="width:100%;padding:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:6px;font-size:15px"><div class="close-row"><button class="btn" data-act="closeModal">再想想</button><button class="btn gold" data-act="lampDo">放灯</button></div>');
  setTimeout(function(){ var inp=document.getElementById('lampInput'); if(inp){ inp.focus(); } },50);
}
function showSettings(){
  var g=game.state;
  showModal('<h2>设置</h2>'+
    '<div class="m-sec">音频</div>'+
    '<div class="set-row"><span>背景音乐</span><button class="switch '+(audio.musicOn?'on':'')+'" data-act="musicToggle"></button></div>'+
    '<div class="set-row"><span>音乐音量</span><input type="range" min="0" max="100" value="'+Math.round(audio.musicVol*100)+'" data-act="musicVol"></div>'+
    '<div class="set-row"><span>音效</span><button class="switch '+(audio.sfxOn?'on':'')+'" data-act="sfxToggle"></button></div>'+
    '<div class="set-row"><span>音效音量</span><input type="range" min="0" max="100" value="'+Math.round(audio.sfxVol*100)+'" data-act="sfxVol"></div>'+
    '<div class="m-sec">主题</div>'+
    '<div class="set-row"><span>鎏金（默认）</span><button class="btn tiny '+(g.theme==='jin'?'gold':'')+'" data-act="themeSet" data-theme="jin">选用</button></div>'+
    '<div class="set-row"><span>水墨</span><button class="btn tiny '+(g.theme==='shuimo'?'gold':'')+'" data-act="themeSet" data-theme="shuimo">选用</button></div>'+
    '<div class="set-row"><span>桃花（婉子专属）</span><button class="btn tiny rose '+(g.theme==='taohua'?'gold':'')+'" data-act="themeSet" data-theme="taohua">选用</button></div>'+
    '<div class="m-sec">宗门</div>'+
    '<div class="set-row"><span>任务</span><button class="btn tiny" data-act="showTasks">查看</button></div>'+
    '<div class="set-row"><span>成就</span><button class="btn tiny" data-act="showAch">查看</button></div>'+
    '<div class="set-row"><span>气运商店</span><button class="btn tiny" data-act="showQiYun">打开</button></div>'+
    '<div class="set-row"><span>气运重聚（宗门3级）</span><button class="btn tiny gold" data-act="zhongsheng" '+(g.sectLv<3?'disabled':'')+'>轮回</button></div>'+
    '<div class="set-row"><span>宗门史书</span><button class="btn tiny" data-act="showHistory">翻阅</button></div>'+
    '<div class="set-row"><span>改宗训</span><button class="btn tiny" data-act="editMotto">立匾</button></div>'+
    '<div class="set-row"><span>新手引导</span><button class="btn tiny" data-act="welcome">重看</button></div>'+
    '<div class="m-sec">情书</div>'+
    '<div class="set-row"><span>卷轴（恩和写给你的话）</span><button class="btn tiny rose" data-act="showLetter">展开</button></div>'+
    '<div class="m-sec">存档</div>'+
    '<div class="set-row"><span>登出</span><button class="btn tiny" data-act="logout">退出</button></div>'+
    '<div class="set-row"><span>重置游戏</span><button class="btn tiny" data-act="resetGame">重置</button></div>'+
    '<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>');
}
function showLetter(){
  audio.gift();
  if(isPartnerEmail(DB.profile.email)) Art.ParticleLayer.petals(60);   // 夫人看情书 → 花瓣
  showModal('<div class="scroll">'+CONFIG.LOVE_LETTER+'</div><div class="close-row"><button class="btn rose" data-act="closeModal">收下心意</button></div>');
}
function showHistory(){
  var g=game.state;
  showModal('<h2>宗门史书</h2>'+(g.history.map(function(h){return '<div class="log-item"><span class="lt">'+timeStr(h.t)+'</span>【'+h.title+'】'+h.desc+'</div>';}).join('')||'<div class="empty">史书尚新</div>')+'<div class="close-row"><button class="btn" data-act="closeModal">收下</button></div>');
}
function editMotto(){
  showModal('<h2>立宗训</h2><div class="mdesc">为山门题写匾额文字：</div><input id="mottoInput" maxlength="12" style="width:100%;min-height:44px;font-size:14px;border:1px solid #c9b47c;border-radius:8px;padding:0 10px;font-family:inherit;background:rgba(255,255,255,.6)" value="'+game.state.motto+'"><div class="close-row"><button class="btn gold" data-act="doMotto">立匾</button><button class="btn ghost" data-act="closeModal">再议</button></div>');
}
function sendGiftModal(){
  var g=game.state;
  showModal('<h2>赠予佳人</h2><div class="mdesc">选择要赠予'+CONFIG.PARTNER_NAME+'的物品：</div>'+
    '<div class="m-row"><span>灵石 ×100</span><button class="btn tiny rose" data-act="giftDo" data-type="lingShi" data-n="100" '+(g.res.lingShi<100?'disabled':'')+'>赠予</button></div>'+
    '<div class="m-row"><span>灵石 ×500</span><button class="btn tiny rose" data-act="giftDo" data-type="lingShi" data-n="500" '+(g.res.lingShi<500?'disabled':'')+'>赠予</button></div>'+
    '<div class="m-row"><span>固元丹 ×3</span><button class="btn tiny rose" data-act="giftDo" data-type="guyuan" data-n="3" '+(g.res.pills.guyuan<3?'disabled':'')+'>赠予</button></div>'+
    '<div class="close-row"><button class="btn ghost" data-act="closeModal">再议</button></div>');
}
/* ---------- 登录界面 ---------- */
function renderLogin(){
  var box=document.getElementById('loginBox');
  box.innerHTML='<h1>云顶道庭</h1><div class="sub-l">彤恩卷 · '+CONFIG.WATERMARK+'</div>'+
    '<input id="lgEmail" placeholder="邮箱" type="email">'+
    '<input id="lgPass" placeholder="密码" type="password">'+
    '<button class="btn gold" data-act="loginDo">登入仙界</button>'+
    '<div class="login-row"><button class="btn ghost" data-act="gotoSignup">注册宗门</button></div>'+
    '<div class="login-tip">演示提示：未配置 Supabase 时使用本地双人模式。可注册任意账号，或使用 '+CONFIG.PARTNER_EMAIL+' / wantong123 体验「宗主夫人」账号。<br>部署方法见代码顶部注释。</div>';
}
function renderSignup(){
  var box=document.getElementById('loginBox');
  box.innerHTML='<h1>创立宗门</h1><div class="sub-l">彤恩卷 · 续写恩和与婉彤的道统</div>'+
    '<input id="sgEmail" placeholder="邮箱" type="email">'+
    '<input id="sgPass" placeholder="密码" type="password">'+
    '<input id="sgName" placeholder="宗门名称" maxlength="12">'+
    '<input id="sgTitle" placeholder="道号（如：掌门）" maxlength="8">'+
    '<button class="btn gold" data-act="signupDo">开山立派</button>'+
    '<div class="login-row"><button class="btn ghost" data-act="gotoLogin">返回登录</button></div>'+
    '<div class="login-tip">若使用 '+CONFIG.PARTNER_EMAIL+' 注册，将自动成为「宗主夫人」。</div>';
}
/* ---------- 主渲染 ---------- */
function render(){
  if(!DB.profile||!game.state) return;   // 未登录/未初始化时安全返回
  var st=contentEl.scrollTop;
  renderTop(); renderTabs(); renderBottom();
  if(ui.tab==='zongmen') renderZongmen();
  else if(ui.tab==='dizi') renderDizi();
  else if(ui.tab==='lingtian') renderLingTian();
  else if(ui.tab==='youlv') renderYouli();
  else if(ui.tab==='shijie') renderShijie();
  else renderChat();
  contentEl.scrollTop=st;
  // 环境音仅在切页时切换（避免每帧重复调用）
  if(ui.envTab!==ui.tab){
    ui.envTab=ui.tab;
    audio.env('xiushen',ui.tab==='dizi'||ui.tab==='youlv');
    audio.env('fangshi',ui.tab==='shijie');
  }
  // 连接状态栏
  var cb=document.getElementById('connBar');
  if(cb){ cb.className=DB.online?'on':'off'; cb.textContent=DB.online?(DB.mode==='real'?'已连通仙界（Supabase）':'本地双人演示模式'):'与仙界的连接已断开，正尝试重连...'; }
}

/* =====================================================================
 * 事件绑定与启动
 * ===================================================================== */
var audioBooted=false;
function bootAudio(){ if(!audioBooted){ audioBooted=true; audio.ensure(); audio.startBGM(); } }

document.addEventListener('click',function(e){
  bootAudio();
  var el=e.target.closest('[data-act]');
  if(!el) return;
  var act=el.dataset.act,id=el.dataset.id;
  switch(act){
    case 'switchTab': ui.tab=id; ui.selected.clear(); ui.partySel=[]; if(id==='chat') ui.chatUnread=0; render(); break;
    case 'toggleOps': ui.opsCollapsed=!ui.opsCollapsed; render(); break;
    case 'welcome': showWelcome(); break;
    case 'settings': audio.click(); showSettings(); break;
    case 'openUpdate': { if(window.__updateUrl) window.open(window.__updateUrl,'_blank'); closeModal(); break; }
    case 'recruit': game.recruit(); break;
    case 'recruitElite': game.recruitElite(); break;
    case 'autoAssign': game.autoAssign(); break;
    case 'stopAll': game.stopAll(); break;
    case 'upgrade': game.upgradeFacility(id); break;
    case 'liupai': game.chooseLiupai(id); break;
    case 'ltPlant': showLingTianPlantModal(parseInt(id,10)); break;
    case 'ltPlantDo': game.lingTianPlant(el.dataset.seed,parseInt(el.dataset.idx,10)); break;
    case 'ltPlantSeed': game.lingTianPlant(id); break;
    case 'ltBuySeed': game.lingTianBuySeed(id); break;
    case 'ltHarvest': game.lingTianHarvest(parseInt(id,10)); break;
    case 'ltHarvestAll': game.lingTianHarvestAll(); break;
    case 'ltSteal': game.lingTianStealFromPartner(parseInt(id,10)); break;
    case 'ltWater': game.lingTianWaterPartner(); break;
    case 'ltRefreshPartner': refreshLingTianPartner(); break;
    case 'ltDeBug': game.lingTianDeBug(); break;
    case 'ltAbandon': game.lingTianAbandon(); break;
    case 'checkin': game.doCheckin(); break;
    case 'fateShow': game.fateShow(); break;
    case 'showAlbum': showAlbum(); break;
    case 'albumPick': (function(){
      var inp=document.getElementById('albumFile');
      if(!inp){ inp=document.createElement('input'); inp.id='albumFile'; inp.type='file'; inp.accept='image/*'; inp.style.display='none'; document.body.appendChild(inp); inp.addEventListener('change',function(){ if(inp.files&&inp.files[0]) game.albumUpload(inp.files[0]); inp.value=''; }); }
      inp.click();
    })(); break;
    case 'albumDel': game.albumDelete(id); break;
    case 'tutNext': (function(){ var g=game.state; g._tutIdx=(g._tutIdx||0)+1; showTutorial(); })(); break;
    case 'tutSkip': (function(){ var g=game.state; g.tutorialDone=true; g._tutIdx=0; closeModal(); toast('已跳过引导，随时可在设置里重看'); render(); })(); break;
    case 'themeSet': { var g2=game.state; g2.theme=el.dataset.theme||'jin'; try{ localStorage.setItem('ytdt_theme',g2.theme); }catch(e){}; applyTheme(); showSettings(); break; }
    case 'beastName': { var bn=game.state.beastName||''; showModal('<h2>灵兽命名</h2><div class="mdesc">给灵兽园的守护灵兽取个名字吧（对方也能看到）</div><input id="beastNameInput" maxlength="8" value="'+bn+'" style="width:100%;padding:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:6px;font-size:15px"><div class="close-row"><button class="btn" data-act="closeModal">再议</button><button class="btn gold" data-act="beastNameDo">定名</button></div>'); setTimeout(function(){ var inp=document.getElementById('beastNameInput'); if(inp){ inp.focus(); inp.select(); } },50); break; }
    case 'beastNameDo': { var inp2=document.getElementById('beastNameInput'); var nm=(inp2?inp2.value:'').trim(); if(!nm){ toast('名字不能为空'); break; } game.state.beastName=nm; game.addLog('灵兽定名「'+nm+'」，自此守护宗门',true); game.historyPush('灵兽定名','为灵兽园灵兽命名「'+nm+'」'); toast('灵兽定名「'+nm+'」'); closeModal(); game.saveProfile(function(){}); render(); break; }
    case 'quizShow': showQuiz(); break;
    case 'quizAnswer': game.quizAnswer(parseInt(el.dataset.q,10),parseInt(el.dataset.a,10)); showQuiz(); break;
    case 'xiuShow': showXiu(); break;
    case 'xiuInject': game.xiuInject(); showXiu(); game.xiuSettle(); break;
    case 'wishShow': showWish(); break;
    case 'starShow': game.observeStars(); break;
    case 'wudaoStone': game.wudaoStone(); break;
    case 'noteShow': showNote(); break;
    case 'noteDo': { var ni=document.getElementById('noteInput'); var nt=(ni?ni.value:'').trim(); if(!nt){ toast('写点什么吧'); break; } closeModal(); game.writeNote(nt); break; }
    case 'noteReply': showNoteReply(); break;
    case 'noteReplyDo': { var ri=document.getElementById('noteReplyInput'); var rt=(ri?ri.value:'').trim(); if(!rt){ toast('写点什么吧'); break; } closeModal(); game.replyNote(rt); break; }
    case 'trailsShow': showTrails(); break;
    case 'trailMine': showTrailsMine(); break;
    case 'scrollShow': showScroll(); break;
    case 'cardGameShow': showCardGame(); break;
    case 'cardStart': game.cardStart(); break;
    case 'cardSel': { var i2=parseInt(el.dataset.idx,10); if(!ui.cardSel) ui.cardSel=[]; var p=ui.cardSel.indexOf(i2); if(p>=0) ui.cardSel.splice(p,1); else ui.cardSel.push(i2); renderCardGame(); break; }
    case 'cardDo': { var arr=ui.cardSel||[]; if(arr.length){ var disp=game.state.cardGame.myHand.slice().sort(function(a,b){return a.r-b.r||a.s-b.s;}); var sel=arr.map(function(i3){return disp[i3];}); } else { var sel=[]; } ui.cardSel=[]; game.cardPlay(sel); break; }
    case 'cardPassDo': ui.cardSel=[]; game.cardPass(); break;
    case 'poolGameShow': showPoolGame(); break;
    case 'poolStart': game.poolStart(); break;
    case 'poolShootDo': game.poolShotDo(ui.poolAngle||0,ui.poolPower||50); break;
    case 'wishDo': { var wi=document.getElementById('wishInput'); var wt=(wi?wi.value:'').trim(); if(!wt){ toast('写下心愿才能许愿哦'); break; } closeModal(); game.makeWish(wt); break; }
    case 'festLamp': showFestLamp(); break;
    case 'festGift': {
      var festG=game.festivalOf();
      if(!festG||!festG.gift){ toast('当前没有节日礼包'); break; }
      var gk='gift_'+festG.gift;
      if(g[gk]){ toast('这份礼盒你已经领过啦'); break; }
      g[gk]=1;
      var giftName = festG.gift==='moon2026' ? '月饼礼盒' : '国庆礼盒';
      var giftLs = festG.gift==='moon2026' ? 888 : 1010;
      var giftQy = festG.gift==='moon2026' ? 15 : 10;
      g.res.lingShi+=giftLs;
      game.addQingYuan(giftQy);
      game.addLog('🎁 领取'+festG.name+giftName+'：灵石+'+giftLs+'，情缘+'+giftQy,true);
      game.historyPush(festG.name,'领取节日'+giftName+'（灵石+'+giftLs+'，情缘+'+giftQy+'）');
      toast('🎁 '+giftName+'已领取：灵石+'+giftLs+'，情缘+'+giftQy);
      game.saveProfile(function(){});
      game.checkAchievements();
      render();
      break;
    }
    case 'lampDo': { var li2=document.getElementById('lampInput'); var lt2=(li2?li2.value:'').trim(); if(!lt2){ toast('写句寄语再放灯吧'); break; } closeModal(); game.addQingYuan(3); game.state.res.lingShi+=200; game.addLog('🏮 放出一盏花灯：「'+lt2+'」情缘+3，灵石+200',true); game.historyPush('花灯寄语','于'+game.festivalOf().name+'放花灯：「'+lt2+'」'); toast('🏮 花灯顺流而下，愿你所愿皆成'); game.saveProfile(function(){}); game.checkAchievements(); render(); break; }
    case 'claimTask': game.claimTask(el.dataset.type||'daily',parseInt(el.dataset.idx||'0',10)); break;
    case 'elderZhuanShi': game.zhuanShiElder(parseInt(id,10)); break;
    case 'tower': game.towerChallenge(); break;
    case 'wudaoSend': { var wd=game.state.disciples.filter(function(d){return d.state==='idle';})[0]; if(wd) game.assignWudao(wd); break; }
    case 'assign': { var d=game.findDisciple(id); if(!d) break;
      if(el.dataset.job==='cultivate') game.assignCultivate(d);
      else if(el.dataset.job==='alchemy') game.assignAlchemy(d);
      else if(el.dataset.job==='forge') game.assignForge(d);
      else if(el.dataset.job==='wudao') game.assignWudao(d);
      break; }
    case 'stop': { var d2=game.findDisciple(id); if(d2) game.stopAction(d2); break; }
    case 'break': { var d3=game.findDisciple(id); if(d3) game.breakthrough(d3); break; }
    case 'usePill': { var d4=game.findDisciple(id); if(d4){ game.usePill(d4,el.dataset.pill); if(ui.detailDisciple) showDiscipleDetail(id); } break; }
    case 'detail': ui.detailDisciple=id; showDiscipleDetail(id); break;
    case 'toggleSel': if(e.target.checked) ui.selected.add(id); else ui.selected.delete(id); break;
    case 'strengthen': { var d5=game.findDisciple(id); if(d5) game.strengthenEquip(d5,el.dataset.part); showDiscipleDetail(id); break; }
    case 'unequip': { var d6=game.findDisciple(id); if(d6) game.unequipItem(d6,el.dataset.part); showDiscipleDetail(id); break; }
    case 'awaken': { var d7=game.findDisciple(id); if(d7) game.awakenEquip(d7,el.dataset.part); showDiscipleDetail(id); break; }
    case 'bloodBind': { var d8=game.findDisciple(id); if(d8) game.bloodBind(d8,el.dataset.part); showDiscipleDetail(id); break; }
    case 'equipPick': showEquipPick(id,el.dataset.part); break;
    case 'equipConfirm': { var d9=game.findDisciple(id); if(d9) game.equipItem(d9,el.dataset.eid); showDiscipleDetail(id); break; }
    case 'armory': showArmory(); break;
    case 'arena': showArena(); break;
    case 'arenaFight': game.arenaChallenge(); audio.stopBgm(); audio.bgm('battle'); setTimeout(function(){ if(audio.bgmMode==='battle'){ audio.stopBgm(); audio.bgm('normal'); } },8000); break;
    case 'decomposeEquip': { var eid2=el.dataset.eid; var it2=null; for(var gi2=0;gi2<game.state.res.equipBank.length;gi2++) if(game.state.res.equipBank[gi2].id===eid2){ it2=game.state.res.equipBank[gi2]; break; } if(it2){ showModal('<h2>分解确认</h2><div class="mdesc">分解 '+it2.qualityName+'·'+it2.base+'？<br>获得：矿石+'+EQUIP_REFINE[it2.quality].kuang+(EQUIP_REFINE[it2.quality].jh?'、器灵精华+'+EQUIP_REFINE[it2.quality].jh:'')+'<br><span style="font-size:11px">分解不可恢复</span></div><div class="close-row"><button class="btn gold" data-act="decomposeDo" data-eid="'+eid2+'">分解</button><button class="btn" data-act="closeModal">再想想</button></div>'); } break; }
    case 'decomposeDo': game.decomposeEquip(el.dataset.eid); showArmory(); break;
    case 'combineMode': ui.combineSel=[]; showCombinePick(); break;
    case 'combinePick': { if(!ui.combineSel) ui.combineSel=[]; var ce=el.dataset.eid,cp=ui.combineSel.indexOf(ce); if(cp>=0) ui.combineSel.splice(cp,1); else { if(ui.combineSel.length>=3){ toast('最多选 3 件'); } else ui.combineSel.push(ce); } showCombinePick(); break; }
    case 'combineDo': { if(ui.combineSel&&ui.combineSel.length===3){ game.combineEquip(ui.combineSel.slice()); ui.combineSel=[]; showArmory(); } break; }
    case 'combineCancel': ui.combineSel=[]; closeModal(); break;
    case 'guideGo': { var go=el.dataset.go; closeModal(); if(go==='arena'){ showArena(); } else if(go==='farm'){ ui.tab='lingtian'; render(); game.lingTianHarvestAll(); } else if(go==='chat'){ ui.tab='chat'; render(); } break; }
    case 'questPick': showQuestPick(); break;
    case 'questSend': game.sendQuest(el.dataset.qid); showQuestPick(); break;
    case 'questGo': { var qid=el.dataset.qid,mid=el.dataset.mid||''; closeModal(); var q=questById(qid); if(q){ if(q.act==='arena'){ showArena(); } else if(q.act==='farm'){ ui.tab='lingtian'; render(); game.lingTianHarvestAll(); } else if(q.act==='checkin'){ ui.tab='zongmen'; render(); game.doCheckin(); } else if(q.act==='chat'){ ui.tab='chat'; render(); } game.questDone(qid,mid); } break; }
    case 'giftEquip': { var eid3=el.dataset.eid; var it3=null; for(var gi3=0;gi3<game.state.res.equipBank.length;gi3++) if(game.state.res.equipBank[gi3].id===eid3){ it3=game.state.res.equipBank[gi3]; break; } if(it3){ showModal('<h2>🎁 赠礼</h2><div class="mdesc">将 '+it3.qualityName+'·'+it3.base+' 赠予 '+CONFIG.PARTNER_NAME+'？<br><span style="font-size:11px">对方上线后可在传书页领取，契缘+10</span></div><input id="giftNote" maxlength="30" placeholder="附一句想说的话（选填）" style="width:100%;padding:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:6px;font-size:14px;margin:6px 0;box-sizing:border-box"><div class="close-row"><button class="btn gold" data-act="giftDo" data-eid="'+eid3+'">送出</button><button class="btn" data-act="closeModal">再想想</button></div>'); setTimeout(function(){ var gn=document.getElementById('giftNote'); if(gn) gn.focus(); },60); } break; }
    case 'giftDo': { var gn2=document.getElementById('giftNote'); var nv=gn2?gn2.value:''; game.giftEquip(el.dataset.eid,nv); showArmory(); break; }
    case 'claimGift': game.claimGift(el.dataset.gid); renderChat(); break;
    case 'advanceEquip': { var d10=game.findDisciple(id); if(d10){ var ee=d10.equipment[el.dataset.part]; if(ee&&ee.quality<4){ var step=EQUIP_ADVANCE[ee.quality]; showModal('<h2>⚒️ 装备进阶</h2><div class="mdesc">'+ee.qualityName+'·'+ee.base+' → '+QUALITIES[ee.quality+1].name+'<br>消耗：'+(step.cost.lingShi?('灵石'+fmt(step.cost.lingShi)+' '):'')+(step.cost.kuangShi?('矿石'+step.cost.kuangShi+' '):'')+(step.cost.jinghua?('精华'+step.cost.jinghua+' '):'')+(step.cost.xianYu?('仙玉'+step.cost.xianYu+' '):'')+'<br>成功率 '+Math.round(step.rate*100)+'%</div><div class="close-row"><button class="btn gold" data-act="advanceDo" data-id="'+d10.id+'" data-part="'+el.dataset.part+'">进阶</button><button class="btn" data-act="closeModal">再想想</button></div>'); } else { showDiscipleDetail(id); } } break; }
    case 'advanceDo': { var d11=game.findDisciple(id); if(d11) game.advanceEquip(d11,el.dataset.part); showDiscipleDetail(id); break; }
    case 'gongfaPick': showGongfaPick(id,el.dataset.slot); break;
    case 'learnGf': { var d10=game.findDisciple(id); if(d10) game.learnGongfa(d10,el.dataset.gf); showDiscipleDetail(id); break; }
    case 'upgradeGf': { var d11=game.findDisciple(id); if(d11) game.upgradeGongfa(d11,el.dataset.slot); showDiscipleDetail(id); break; }
    case 'travelGo2': ui.tab='youlv'; ui.regionSel=null; ui.partySel=[id]; render(); break;
    case 'regionSel': ui.regionSel=id; break;
    case 'memberSel': {
      if(ui.partySel.indexOf(id)>=0) ui.partySel=ui.partySel.filter(function(x){return x!==id;});
      else { if(ui.partySel.length>=3){ toast('最多3名弟子'); break; } ui.partySel.push(id); }
      render();
      break;
    }
    case 'formationSel': ui.partyFormation=id; break;
    case 'startParty': game.createParty(ui.regionSel,ui.partySel,ui.partyFormation); ui.partySel=[]; render(); break;
    case 'nodeChoice': game.nodeChoose(el.dataset.choice); break;
    case 'defendDone': { var n=game.state.npcs.filter(function(x){return x.id===el.dataset.npc;})[0]; if(n) game.defendResolve(n,el.dataset.win==='1'); closeModal(); break; }
    case 'npcTrade': game.npcTrade(id); break;
    case 'npcAlly': game.npcAlly(id); break;
    case 'npcWar': game.npcWar(id); break;
    case 'duoBoss': game.duoBoss(); break;
    case 'sendGift': sendGiftModal(); break;
    case 'giftDo': game.sendGift(el.dataset.type,parseInt(el.dataset.n,10),''); break;
    case 'sendSpar': game.sendSpar(); break;
    case 'sendAlliance': game.sendAlliance(); break;
    case 'sendLove': { var inpL=document.getElementById('chatInput'); if(inpL&&inpL.value.trim()){ var love='[love]'+inpL.value.trim(); DB.sendMessage(love,function(){ game.count('msg',1); game.addQingYuan(3); game.addMsgQiyuan(); }); game.addLog('寄出一封情书给'+CONFIG.PARTNER_NAME,true); inpL.value=''; setTimeout(function(){ renderChat(); },200); } break; }
    case 'sendMsg': {
      var inp=document.getElementById('chatInput');
      if(inp&&inp.value.trim()){ DB.sendMessage(inp.value.trim(),function(){ game.count('msg',1); game.addQingYuan(1); game.addMsgQiyuan(); }); inp.value=''; setTimeout(function(){ renderChat(); },200); }
      break;
    }
    case 'showTasks': showTasks(); break;
    case 'showAch': showAch(); break;
    case 'showQiYun': showQiYun(); break;
    case 'buyQiYun': game.buyQiYun(id); showQiYun(); break;
    case 'zhongsheng': game.zhongsheng(); break;
    case 'showHistory': showHistory(); break;
    case 'editMotto': editMotto(); break;
    case 'doMotto': {
      var mi=document.getElementById('mottoInput');
      if(mi&&mi.value.trim()){ game.state.motto=mi.value.trim(); closeModal(); toast('宗训已立'); }
      break;
    }
    case 'showLetter': showLetter(); break;
    case 'resetGame': showConfirm('重置游戏','将清空本账号全部存档，此操作不可恢复。确定重置吗？',function(){ game.state=game.newGame(game.state.sectName,game.state.masterTitle,game.state.motto); game.state.profileId=DB.profile.id; game.saveToDB(false); toast('已重置'); render(); }); break;
    case 'logout': DB.signOut(); location.reload(); break;
    case 'resInfo': showResInfo(id); break;
    case 'musicToggle': audio.musicOn=!audio.musicOn; if(audio.musicOn&&audioBooted) audio.startBGM(); showSettings(); break;
    case 'sfxToggle': audio.sfxOn=!audio.sfxOn; showSettings(); break;
    case 'eventOpt': game.eventChoose(parseInt(el.dataset.idx,10)); break;
    case 'confirmYes': confirmYes(); break;
    case 'closeModal': audio.click(); closeModal(); break;
    /* 登录 */
    case 'loginDo': doLogin(); break;
    case 'gotoSignup': renderSignup(); break;
    case 'signupDo': doSignup(); break;
    case 'gotoLogin': renderLogin(); break;
  }
  // ============ v4.2 按钮即时反馈：点击后立即刷新数值 ============
  // 此前多数按钮只改数值不重绘，UI 要等主循环（最长 1 秒）才更新，
  // 表现为"数值延迟、按钮像失灵"。这里动作后立即渲染。
  // 聊天页打字中输入框不重建（否则输入被重置）；移动端点击按钮不夺焦，
  // 故以 activeElement 判断而非信任按钮焦点。
  if(ui.tab==='chat'){
    var _f=document.getElementById('chatInput');
    if(_f&&document.activeElement===_f){ renderTop(); renderTabs(); renderBottom(); }
    else render();
  }else{ render(); }
});
document.addEventListener('change',function(e){
  var el=e.target;
  if(el.dataset&&el.dataset.act==='musicVol') audio.musicVol=parseInt(el.value,10)/100;
  else if(el.dataset&&el.dataset.act==='sfxVol') audio.sfxVol=parseInt(el.value,10)/100;
});
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'){ var el=e.target; if(el&&el.id==='chatInput'){ var btn=document.querySelector('[data-act="sendMsg"]'); if(btn) btn.click(); } }
});

/* ---------- 登录与进入 ---------- */
function doLogin(){
  var email=document.getElementById('lgEmail').value.trim();
  var pass=document.getElementById('lgPass').value;
  if(!email||!pass){ toast('请填写邮箱与密码'); return; }
  DB.signIn(email,pass,function(ok,err){
    if(!ok){ toast(err||'登录失败'); return; }
    enterGame();
  });
}
function doSignup(){
  var email=document.getElementById('sgEmail').value.trim();
  var pass=document.getElementById('sgPass').value;
  var name=document.getElementById('sgName').value.trim();
  var title=document.getElementById('sgTitle').value.trim()||'掌门';
  if(!email||!pass||!name){ toast('请完整填写'); return; }
  if(pass.length<6){ toast('密码至少6位'); return; }
  DB.signUp(email,pass,name,title,function(ok,err){
    if(!ok){ toast(err||'注册失败'); return; }
    DB.signIn(email,pass,function(ok2,err2){
      if(!ok2){ toast(err2||'自动登录失败，请手动登录'); renderLogin(); return; }
      enterGame();
    });
  });
}
/** 登录成功进入主界面 */
function applyTheme(){
  var t='jin';
  try{ t=game&&game.state&&game.state.theme?game.state.theme:(localStorage.getItem('ytdt_theme')||'jin'); }catch(e){}
  if(document.body) document.body.className='theme-'+t;
}
/* 加载屏自动消退：无论登录与否，1.8s 后淡出，露出登录界面 */
(function(){
  function hideBoot(){
    var b=document.getElementById('bootScreen');
    if(!b||b.style.display==='none') return;
    b.style.opacity='0';
    setTimeout(function(){ b.style.display='none'; },450);
  }
  if(document.readyState==='complete'){ setTimeout(hideBoot,1800); }
  else { document.addEventListener('DOMContentLoaded',function(){ setTimeout(hideBoot,1800); }); }
  setTimeout(hideBoot,2500);  // 兜底
})();
function enterGame(){
  applyTheme();
  // 加载进度条动画（模拟接引进度）
  var boot=document.getElementById('bootScreen'),bar=document.getElementById('bootBar'),txt=document.getElementById('bootTxt');
  if(boot){
    boot.style.transition='opacity .3s'; boot.style.opacity='0'; setTimeout(function(){ boot.style.display='none'; },350);
    var p=8,steps=['正在连接仙界…','读取宗门档案…','接引弟子…','凝练灵气…','整理传书…'];
    var iv=setInterval(function(){
      p+=irand(12,26);
      if(p>=100){ clearInterval(iv); boot.style.transition='opacity .5s'; boot.style.opacity='0'; setTimeout(function(){ boot.style.display='none'; },500); }
      else { if(bar) bar.style.width=p+'%'; if(txt) txt.textContent=steps[Math.min(steps.length-1,Math.floor(p/20))]; }
    },irand(90,160));
  }
  document.getElementById('loginView').style.display='none';
  document.getElementById('app').style.display='flex';
  // 检测夫人账号
  audio.isPartner=isPartnerEmail(DB.profile.email);
  var connEl=document.getElementById('connBar');
  if(connEl) connEl.textContent='正在接引宗门数据…';
  game=new Game();
  game.loadFromDB(function(){
    // v4.3 上线行迹（对方可见）
    game.trail('online','乘云而至，踏入云顶道庭');
    // 新用户 → 播放水墨开场（可跳过）
    if(game.isNew){
      var intro=document.getElementById('introCanvas');
      intro.style.display='block';
      intro.onclick=function(){ intro.style.display='none'; if(game.isNew) showWelcome(); };
      Art.playIntro(intro,function(){ if(game.isNew) showWelcome(); });
    } else {
      // 老用户：彤华节/问候
      game.applyTonghua();
      game.checkGreeting();
      game.worldBrief();
    }
    // 双人订阅回调
    DB.onMessage=function(){
      if(ui.tab==='chat'){ renderChat(); }
      else { ui.chatUnread++; renderTabs(); }   // 未读红点
    };
    DB.onInteraction=function(it){ game.handleInteraction(it); };
    DB.onStatus=function(online){ DB.online=online; render(); };
    // 轮询对方在线状态（real 模式用 presence 简化轮询 profiles.updated_at；mock 恒在线）
    if(DB.mode==='mock'){ game.otherOnline=true; }
    else{ setInterval(function(){ DB.loadPartnerProfile(function(p){ if(p){ game.otherOnline=!!p.__online; game.otherSectLv=p.sect_level||1; game.otherSectName=p.sect_name||''; } }); },8000); }
    render();
    // 新系统初始化：天气 / 签到状态 / 晨报（每日首次登录弹一次）
    game.initLingTian();
    game.syncWeather(function(){
      game.checkinStatus(function(){
        var g=game.state,today=game.todayStr();
        var isP=isPartnerEmail(DB.profile.email);
        if(g.morningShown!==today){
          g.morningShown=today;
          setTimeout(function(){ showMorningBrief(); }, isP?800:500);
        }
        // v5.4 婉彤无操作引导（3 分钟无点击弹引导）
        if(isP) setTimeout(wanderGuide, 1200);
        render();
      });
    });
    // v5.1 修复：fCanvas 可能不存在（元素缺失时跳过粒子层，避免中断主循环初始化）
    var fc=document.getElementById('fCanvas');
    if(fc){ Art.ParticleLayer.init(fc); Art.ParticleLayer.start(); }
    // v5.3 BGM：登录旋律切换为宗门舒缓旋律
    audio.stopBgm(); audio.bgm('normal');
    // ============ v4.2 主循环修复：放置数值每秒推进 + 渲染 ============
    // 此前 tick() 从未被调用，导致在线时灵田不生长、弟子不修炼、灵石不产出，
    // 数值只有刷新页面（离线结算）才变化，表现为"数值延迟、按钮失灵"。
    if(game._loop) clearInterval(game._loop);
    game._loop=setInterval(function(){
      try{ game.tick(); }catch(err){}
      // 聊天输入框正在打字时不整页重建（否则输入被重置）
      var inp=document.getElementById('chatInput');
      var typing=inp&&document.activeElement===inp;
      // v5.5 渲染降频：每秒仅刷新顶部资源（renderTop 轻量），每 2 秒全量渲染主体；交互点击即时 render
      game._renderTick=(game._renderTick||0)+1;
      if(typing){ renderTop(); renderTabs(); }
      else if(ui.tab==='chat'){ renderTop(); renderTabs(); renderBottom(); }  // 聊天页不重拉消息（onMessage 实时更新）
      else if(game._renderTick%2===0){ render(); }
      else{ renderTop(); }
    },1000);
  });
}
/** 新手引导 */
function showWelcome(){
  showModal('<h2>欢迎来到云顶道庭·彤恩卷</h2><div class="mdesc">'+
    '此界乃'+CONFIG.DEVELOPER_NAME+'真人与'+CONFIG.PARTNER_NAME+'仙子道统之继。<br><br>'+
    '① 点击下方「收纳」招收弟子；<br>'+
    '② 「弟子」页安排修炼、炼丹、炼器；<br>'+
    '③ 修为圆满后「叩关」突破，飞升转长老；<br>'+
    '④ 「游历」彤云谷可得朱颜花，念恩峰有和合石；<br>'+
    '⑤ 「世界」页与各大宗门周旋，寻'+CONFIG.PARTNER_NAME+'结盟；<br>'+
    '⑥ 「传书」与心上人互通音讯。<br><br>'+
    '愿此宗门，如恩和之志，如婉彤之颜，万古长青。</div>'+
    '<div class="close-row"><button class="btn gold" data-act="closeModal">开始修行</button></div>');
}

/* ---------- 启动 ---------- */
var game=null;
DB.init();
// 界面水印
document.getElementById('watermark').textContent='❤️ 为恩和与婉彤而作 · 云顶道庭·彤恩卷';
// 登录页水墨背景动画
(function(){
  var lc=document.getElementById('loginCanvas');
  function loginAnim(){
    if(!lc||document.getElementById('loginView').style.display==='none') return;
    if(!lc._ctx) lc._ctx=lc.getContext('2d');
    var ctx=lc._ctx,w=lc.width=window.innerWidth,h=lc.height=window.innerHeight;
    ctx.clearRect(0,0,w,h);
    var g=ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,'#0d1512'); g.addColorStop(1,'#223028');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='rgba(30,50,42,.85)';
    ctx.beginPath(); ctx.moveTo(0,h*.7);
    for(var x=0;x<=w;x+=12) ctx.lineTo(x,h*.7-Math.sin(x*.01+Date.now()*.0001)*22);
    ctx.lineTo(w,h); ctx.lineTo(0,h); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(216,180,90,.5)';
    ctx.font='12px serif'; ctx.textAlign='center';
    ctx.fillText('上古道侣，共证仙缘',w/2,h*.38);
    Art.zhuyanFlower(ctx,w*.5,h*.52,14);
    requestAnimationFrame(loginAnim);
  }
  requestAnimationFrame(loginAnim);
})();
renderLogin();
// v5.3 BGM：登录页悠远旋律
audio.bgm('login');
// v5.2 更新检查：登录页渲染后静默拉取云端版本号，发现新版弹窗提示
setTimeout(checkUpdate, 2000);

