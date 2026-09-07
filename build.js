#!/usr/bin/env node
/**
 * Wraps deck.html in a password gate and writes index.html.
 *
 *   node build.js "your passphrase"
 *   node build.js --to "Sequoia" "pass-a" --to "a16z" "pass-b"
 *
 * The deck is encrypted with AES-256-GCM under a random content key. That key
 * is then wrapped once per recipient, under a key derived from that
 * recipient's passphrase via PBKDF2-SHA256 (310k iterations, random salt per
 * recipient). The plaintext is never in the output file — "view source" on the
 * gate yields ciphertext, so this is not a JS check that can be clicked past.
 * Lose every passphrase and the deck is unrecoverable from index.html alone;
 * lp-briefing.html is the source.
 *
 * Screen capture cannot be prevented. No browser API blocks or detects it, and
 * anything that tries — swallowing PrintScreen, blocking right-click, watching
 * for devtools — is beaten by the operating system's own capture tool, a phone
 * pointed at the monitor, or turning JavaScript off. Netflix's blackout is not
 * detection either: its frames sit in a hardware-protected video plane the
 * capture path cannot read, and EME admits media only, never DOM content.
 *
 * What the wrapping buys is the thing that does work. The gate learns *which*
 * recipient opened the deck — from the key they hold, not from anything they
 * type — and tiles that name across every slide. A leaked screenshot names its
 * source. Printing is refused outright, since that is the one quiet path a
 * browser really can close.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

/* Netlify re-encrypts from the briefing on every deploy; Vercel publishes the
   committed index.html. The two can therefore disagree, and there was no way
   to tell which deck a host was serving without knowing the passphrase. The
   gate states it on its face instead.

   A content hash rather than a git SHA. The gate is built before the commit
   that carries it, so a SHA would always name the parent and read as one
   revision stale. The digest of the briefing has no such self-reference, is the
   same on both hosts for the same deck, and can be checked from a laptop:

       shasum -a 256 lp-briefing.html | cut -c1-7                                   */
function deckDigest(src) {
  return crypto.createHash("sha256").update(src, "utf8").digest("hex").slice(0, 7);
}

const ITERATIONS = 310000;
/* The plaintext briefing. index.html is built from it and never contains it. */
const SOURCE = "lp-briefing.html";
const here = (f) => path.join(__dirname, f);

/* A bare argument is a passphrase with no recipient, which is how this was
   invoked before recipients existed and still is for a shared link. Several
   bare arguments are several unlabelled passphrases into the same deck: a
   second shared passphrase should not have to turn the watermark on, and
   under --to it would, because a label is exactly what turns it on. So an
   unlabelled recipient has to be repeatable.

   --to pairs a label with a passphrase; a label is never a substring of a
   passphrase, so there is no argument that parses two ways. The two forms
   mix — a labelled reader is marked and an unlabelled one is not, which is
   the rule stamp() already applies one recipient at a time. */
function recipients(argv) {
  const out = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--to") {
      if (!argv[i]) {
        console.error("empty passphrase — a passphrase has to be something a reader can type");
        process.exit(1);
      }
      out.push({ label: "", pass: argv[i] });
      continue;
    }
    const label = argv[i + 1], pass = argv[i + 2];
    if (!label || !pass) {
      console.error("--to needs a label and a passphrase");
      process.exit(1);
    }
    out.push({ label: label, pass: pass });
    i += 2;
  }
  return out;
}

const TO = recipients(process.argv.slice(2));
if (!TO.length) {
  console.error('usage: node build.js "<passphrase>" ["<passphrase>" ...]');
  console.error('       node build.js --to "<recipient>" "<passphrase>" [--to ...]');
  process.exit(1);
}
/* One passphrase twice makes two wraps that both open. Where the entries are
   labelled the first one would name whoever opened it — a watermark that lies
   is worse than none; where they are not, it is a wasted slot that reads as a
   second reader who does not exist. Refuse it either way. */
const seen = new Set();
for (const r of TO) {
  if (seen.has(r.pass)) {
    console.error("the same passphrase was given twice — one wrap per passphrase");
    process.exit(1);
  }
  seen.add(r.pass);
}

const deck = fs.readFileSync(here(SOURCE), "utf8");

/* The full deck lifts its two faces out of deck.html so the gate cannot drift
   from it. This briefing sets its type in Google Fonts instead: the Suisse and
   KH Interference files in the deck are trial licences whose terms prohibit
   public use, and a gate is the most public page in the set. */
const FONTS = "";

/* The deck is encrypted once, under a key nobody types. Each recipient gets
   that key wrapped under their own passphrase, so N recipients cost one copy
   of the ciphertext plus about sixty bytes each rather than N copies of a 5MB
   deck. */
const cek = crypto.randomBytes(32);
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", cek, iv);
const body = Buffer.concat([cipher.update(deck, "utf8"), cipher.final()]);
/* WebCrypto expects the GCM tag appended to the ciphertext */
const ct = Buffer.concat([iv, body, cipher.getAuthTag()]).toString("base64");

const keys = TO.map(function (r) {
  const salt = crypto.randomBytes(16);
  const kiv = crypto.randomBytes(12);
  const kek = crypto.pbkdf2Sync(r.pass, salt, ITERATIONS, 32, "sha256");
  const wc = crypto.createCipheriv("aes-256-gcm", kek, kiv);
  const wrapped = Buffer.concat([wc.update(cek), wc.final(), wc.getAuthTag()]);
  return { l: r.label, s: salt.toString("base64"), i: kiv.toString("base64"),
           w: wrapped.toString("base64") };
});

const STAMP = new Date().toISOString().slice(0, 10);
const BUILD = deckDigest(deck);
/* The ciphertext stays its own base64 string. Folding a 5MB blob into a JSON
   envelope that is itself base64ed encodes it twice and costs a third of the
   file for nothing. Only the key entries — a few dozen bytes each — take the
   second pass, which is what lets a recipient label hold any character without
   being escaped into a JavaScript string literal. */
const payload = ct;
const meta = Buffer.from(JSON.stringify({ v: 2, ks: keys, d: STAMP }),
                         "utf8").toString("base64");

const gate = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Exascale &mdash; LP Briefing</title>
<style>
  @import url("https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=Spectral:wght@500&display=swap");
  :root{
    --ground:#080B0A; --surface:#0C1110; --line:rgba(230,240,237,.09);
    --line-2:rgba(230,240,237,.045); --line-3:rgba(230,240,237,.18);
    --ink:#EAF1EE; --ink-soft:#AFBDB8; --muted:#6B7975;
    --jade:#45D3B5; --down:#E85E70;
    --mono:"IBM Plex Mono",ui-monospace,"SF Mono",Menlo,monospace;
    --kh:"Spectral",Georgia,serif;
    --sans:-apple-system,"Helvetica Neue",Arial,sans-serif;
    color-scheme:dark;
  }
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;min-height:100dvh;background:var(--ground);color:var(--ink);
    font-family:var(--sans);display:flex;align-items:center;justify-content:center;
    padding:24px;overflow:hidden}

  /* A grid that fades before it reaches an edge, so the page has a floor
     without ever drawing a line the eye can follow off the screen. */
  body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
    background:linear-gradient(var(--line-2) 1px,transparent 1px) 0 0/68px 68px,
               linear-gradient(90deg,var(--line-2) 1px,transparent 1px) 0 0/68px 68px;
    -webkit-mask-image:radial-gradient(118% 88% at 50% 46%,#000 18%,transparent 74%);
    mask-image:radial-gradient(118% 88% at 50% 46%,#000 18%,transparent 74%)}
  /* one slow jade drift, so the door is not a still image */
  body::after{content:"";position:fixed;inset:-35%;pointer-events:none;z-index:0;
    background:radial-gradient(34% 30% at 50% 50%,rgba(69,211,181,.11),transparent 68%);
    animation:drift 30s ease-in-out infinite alternate}
  @keyframes drift{from{transform:translate3d(-7%,-5%,0)}to{transform:translate3d(7%,6%,0)}}
  .accent{position:fixed;top:0;left:0;right:0;height:2px;z-index:2;
    background:linear-gradient(90deg,transparent,var(--jade),transparent);opacity:.5}

  /* The card floats over the grid, so it is glass: blurred, faintly saturated,
     lit along its top edge. */
  main{position:relative;z-index:1;width:100%;max-width:424px;
    display:flex;flex-direction:column;gap:24px;
    padding:34px 32px 30px;border-radius:18px;
    background:color-mix(in srgb,var(--surface) 52%,transparent);
    -webkit-backdrop-filter:blur(28px) saturate(175%);backdrop-filter:blur(28px) saturate(175%);
    border:1px solid rgba(230,240,237,.10);
    box-shadow:0 28px 70px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.10)}
  .mark{font-family:var(--kh);font-size:33px;line-height:1;letter-spacing:.16em;color:var(--ink)}
  .sub{font-family:var(--mono);font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;
    color:var(--muted);margin-top:13px}
  form{display:flex;flex-direction:column;gap:10px}
  label{font-family:var(--mono);font-size:10.5px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted)}
  .row{display:flex;gap:8px}
  input{flex:1;min-width:0;font-family:var(--mono);font-size:14px;letter-spacing:.08em;
    color:var(--ink);caret-color:var(--jade);
    background:rgba(230,240,237,.05);
    border:1px solid rgba(230,240,237,.11);border-radius:11px;padding:13px 14px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.07);
    transition:border-color .14s ease,box-shadow .14s ease,background .14s ease}
  input::placeholder{color:var(--muted);letter-spacing:.18em}
  input:focus{outline:none;border-color:var(--jade);background:rgba(230,240,237,.07);
    box-shadow:0 0 0 3px rgba(69,211,181,.13),inset 0 1px 0 rgba(255,255,255,.09)}
  /* iOS zooms the whole page when a focused field is under 16px, and it does
     not zoom back: tapping the passphrase box pushed OPEN and the footer off
     the right edge and left the reader there. 16px on touch devices is the fix.
     Capping maximum-scale in the viewport tag would also stop it, and would
     take pinch-zoom away from everyone to do it. */
  @media (pointer:coarse){input{font-size:16px}}
  button{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;
    color:var(--ground);background:var(--jade);border:0;border-radius:11px;padding:13px 21px;
    cursor:pointer;transition:filter .14s ease,box-shadow .14s ease;
    box-shadow:0 6px 20px rgba(69,211,181,.26),inset 0 1px 0 rgba(255,255,255,.34)}
  button:hover:not(:disabled){filter:brightness(1.08);
    box-shadow:0 8px 26px rgba(69,211,181,.36),inset 0 1px 0 rgba(255,255,255,.40)}
  button:disabled{opacity:.45;cursor:progress}
  button:focus-visible,input:focus-visible{outline:2px solid var(--jade);outline-offset:2px}
  .msg{font-family:var(--mono);font-size:11.5px;line-height:1.6;min-height:1.6em;color:var(--muted)}
  .msg.err{color:var(--down)}
  .rule{height:1px;background:var(--line)}
  /* the gate is real cryptography, and a technical reader should be able to see that */
  .meta{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:9.5px;
    letter-spacing:.13em;text-transform:uppercase;color:var(--muted)}
  .meta i{width:5px;height:5px;border-radius:50%;background:var(--jade);flex:none;
    box-shadow:0 0 0 3px rgba(69,211,181,.14)}
  .fine{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;
    color:var(--muted);line-height:1.6}

  @keyframes rise{from{opacity:0;transform:translateY(9px)}}
  .r1{animation:rise .5s .05s ease-out backwards}
  .r2{animation:rise .5s .16s ease-out backwards}
  .r3{animation:rise .5s .27s ease-out backwards}
  .r4{animation:rise .5s .38s ease-out backwards}
  @keyframes shake{15%,85%{transform:translateX(-2px)}30%,70%{transform:translateX(3px)}
    45%,60%{transform:translateX(-3px)}}
  form.bad{animation:shake .36s ease-in-out}
  @media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  @media (prefers-reduced-transparency:reduce){
    main{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--surface)}}
  @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
    main{background:var(--surface)}}
</style>
</head>
<body>
<div class="accent"></div>
<main>
  <div class="r1">
    <div class="mark">EXASCALE</div>
    <div class="sub">LP Briefing &middot; Confidential</div>
  </div>
  <div class="rule r2"></div>
  <form id="f" class="r2">
    <label for="p">Passphrase</label>
    <div class="row">
      <input id="p" type="password" autocomplete="current-password" autofocus spellcheck="false"
             placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022">
      <button id="b" type="submit">Open</button>
    </div>
    <p class="msg" id="m" role="status" aria-live="polite"></p>
  </form>
  <div class="meta r3"><i></i>AES-256-GCM &middot; PBKDF2-SHA256 &middot; ${ITERATIONS.toLocaleString("en-US")} iterations</div>
  <div class="rule r4"></div>
  <p class="fine r4">Do not forward this link. Request access from the founders.</p>
  <p class="fine r4" style="opacity:.62">Build ${STAMP} &middot; briefing ${BUILD}</p>
</main>
<script>
(function(){
  var PAYLOAD="${payload}";
  var META="${meta}";
  var ITER=${ITERATIONS};
  var f=document.getElementById('f'),p=document.getElementById('p'),
      b=document.getElementById('b'),m=document.getElementById('m');

  function bytes(b64){
    var s=atob(b64),a=new Uint8Array(s.length);
    for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);
    return a;
  }
  function say(t,err){
    m.textContent=t;m.className=err?'msg err':'msg';
    if(err){f.classList.remove('bad');void f.offsetWidth;f.classList.add('bad');}
  }

  /* Hand the decrypted deck to a fresh document. Three strategies, each
     falling through to the next when the host refuses it:

       1. Blob navigation. A real document load, so every script and <canvas>
          runs natively. A sandboxed iframe whose CSP does not list blob: as a
          navigable source refuses this — silently, so it has to be checked.
       2. <iframe srcdoc>. Also a fresh document with native scripting, but no
          navigation for a policy to refuse; it inherits the embedder's CSP.
       3. document.write(). Last resort: Safari silently drops canvas contexts
          taken this way, which is why it is not the default. */
  function show(html){
    viaBlob(html,function(){viaSrcdoc(html,function(){viaWrite(html);});});
  }

  function stamp(html,label,date){
    /* No label, no overlay. A build with one shared passphrase cannot tell its
       readers apart, and CONFIDENTIAL tiled over a deck the reader already
       knows is confidential buys nothing and costs the founders a clean screen
       to present from. Use --to to name recipients and the mark appears.

       Tiled rather than cornered on purpose: a corner mark is gone the moment
       anyone crops, and cropping is exactly what happens before a screenshot
       is pasted into a chat. A tile survives a crop of any single chart.

       0.095 alpha is not arbitrary. At 0.058 the name was invisible in a PNG
       of a dark slide, which makes the mark decorative; much above 0.1 and it
       starts competing with the deck. */
    var line=label?label+' \u00b7 CONFIDENTIAL \u00b7 '+date:'';
    var svg='<svg xmlns="http://www.w3.org/2000/svg" width="460" height="300">'+
      '<text x="14" y="168" transform="rotate(-30 230 150)" '+
      'font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="15" '+
      'letter-spacing="2.5" fill="rgba(233,241,238,0.095)">'+esc(line)+'</text></svg>';
    var css=(line?'#wmk{position:fixed;inset:0;z-index:2147483647;pointer-events:none;'+
      'background-image:url("data:image/svg+xml;utf8,'+encodeURIComponent(svg)+'");'+
      'background-repeat:repeat}':'')+
      '@media print{html{display:none!important}'+
      'body::after{content:"Printing is disabled. Ask the founders for a copy.";'+
      'display:block;font:14px monospace;padding:40px}}';

    /* Built by script rather than spliced into the markup. The deck's last
       </body> sits inside an unclosed dialog div, so an overlay inserted there
       becomes a child of a zero-size fixed ancestor and never paints — which
       is what happened on the first attempt. appendChild lands it on <body>
       whatever the markup around it looks like. The closing tag has to reach
       the browser as <\\/script> or it ends the gate's own script element
       three lines above where it is used. */
    var boot='<script>(function(){var s=document.createElement("style");s.id="wm";'+
      's.textContent='+JSON.stringify(css)+';document.head.appendChild(s);'+
      (line?'var d=document.createElement("div");d.id="wmk";'+
            'd.setAttribute("aria-hidden","true");document.body.appendChild(d);'+
            'try{document.title=document.title+" \u00b7 "+'+JSON.stringify(label)+
            '}catch(e){}':'')+
      '})();<\\/script>';
    return html+boot;
  }
  function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function viaBlob(html,next){
    var url;
    try{url=URL.createObjectURL(new Blob([html],{type:'text/html'}));}
    catch(err){next();return;}
    try{location.replace(url);}catch(err){next();return;}
    /* A navigation the host blocks throws nothing and fires no event. If this
       document is still on screen a moment later, it did not happen. */
    setTimeout(function(){if(document.getElementById('f'))next();},700);
  }

  function viaSrcdoc(html,next){
    var fr=document.createElement('iframe');
    if(typeof fr.srcdoc==='undefined'){next();return;}
    fr.setAttribute('title','Exascale LP Briefing');
    /* Deliberately in flow rather than position:fixed. A fixed element adds
       nothing to scrollHeight, and an embedder that sizes this document by
       measuring scrollHeight would collapse the frame to nothing. Its height
       is left at one viewport and the deck scrolls inside it — sizing the
       iframe to its own content instead would feed back against the deck's
       100vh slides and grow without bound. */
    fr.style.cssText='display:block;width:100%;height:100vh;border:0;'+
                     'margin:0;background:#080B0A';
    try{fr.srcdoc=html;}catch(err){next();return;}
    document.body.appendChild(fr);
    setTimeout(function(){
      var d=null;
      try{d=fr.contentDocument;}catch(err){d=null;}
      if(d&&d.body&&d.body.firstChild){
        var mn=document.querySelector('main');
        if(mn&&mn.parentNode)mn.parentNode.removeChild(mn);
        document.body.style.cssText='margin:0;padding:0;display:block;background:#080B0A';
        say('');
      }else{
        if(fr.parentNode)fr.parentNode.removeChild(fr);
        next();
      }
    },1200);
  }

  function viaWrite(html){
    try{document.open();document.write(html);document.close();}
    catch(err){
      b.disabled=false;
      say('This viewer will not open the briefing. Download the file and open it in a browser.',true);
    }
  }

  f.addEventListener('submit',function(e){
    e.preventDefault();
    var pass=p.value;
    if(!pass){say('Enter the passphrase.',true);p.focus();return;}
    /* Web Crypto only exists in a secure context (HTTPS or localhost). Over
       plain http:// to a LAN IP it is undefined, which would otherwise hang
       this handler on "Unlocking…" forever. Fail loudly instead. */
    if(!window.crypto||!window.crypto.subtle){
      say('Open this over https:// or http://localhost — a plain http:// address cannot decrypt.',true);
      return;
    }
    b.disabled=true;say('Unlocking…');

    var env=JSON.parse(new TextDecoder().decode(bytes(META))),
        enc=new TextEncoder();

    /* One passphrase opens one recipient's wrap and no other, so every entry
       has to be tried. They run together rather than in turn: each is a 310k
       PBKDF2, and walking a list of twenty in series is twenty times the wait
       for whoever happens to be last in the file. A GCM tag mismatch is the
       wrong-key signal, so a rejection here is a miss, not an error. */
    function open(k){
      return crypto.subtle.importKey('raw',enc.encode(pass),'PBKDF2',false,['deriveKey'])
        .then(function(m){
          return crypto.subtle.deriveKey(
            {name:'PBKDF2',salt:bytes(k.s),iterations:ITER,hash:'SHA-256'},
            m,{name:'AES-GCM',length:256},false,['decrypt']);
        })
        .then(function(kek){
          return crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(k.i)},kek,bytes(k.w));
        })
        .then(function(cek){ return {label:k.l,cek:cek}; });
    }

    Promise.all(env.ks.map(function(k){
      return open(k).then(function(hit){return hit;},function(){return null;});
    }))
      .then(function(all){
        var hit=null;
        for(var i=0;i<all.length;i++){ if(all[i]){hit=all[i];break;} }
        if(!hit){var e=new Error('no wrap');e.name='OperationError';throw e;}
        var raw=bytes(PAYLOAD);
        return crypto.subtle.importKey('raw',hit.cek,{name:'AES-GCM'},false,['decrypt'])
          .then(function(key){
            return crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));
          })
          .then(function(buf){ return {label:hit.label,html:new TextDecoder().decode(buf)}; });
      })
      .then(function(out){
        show(stamp(out.html,out.label,env.d));
      })
      .catch(function(err){
        b.disabled=false;
        /* An AES-GCM tag mismatch is what a wrong passphrase looks like.
           Anything else is the host getting in the way, and reporting that as
           a bad passphrase sends the reader off chasing the wrong problem. */
        if(err&&err.name==='OperationError'){
          say('That passphrase does not open this briefing.',true);
          p.value='';p.focus();
        }else{
          say('Unlock failed: '+((err&&(err.name||err.message))||'unknown error')+'.',true);
        }
      });
  });
})();
</script>
</body>
</html>
`;

fs.writeFileSync(here("index.html"), gate);
console.log("wrote index.html");
console.log("  lp-briefing.html  " + (deck.length / 1024).toFixed(0) + " KB plaintext");
console.log("  index.html         " + (gate.length / 1024).toFixed(0) + " KB, briefing encrypted");
console.log("  pbkdf2      " + ITERATIONS.toLocaleString() + " iterations, sha256");
console.log("  recipients  " + TO.map(function (r) { return r.label || "(unlabelled)"; }).join(", "));
/* Labelled and unlabelled recipients can now share a build, so say how many
   are actually marked rather than whether any are. */
const MARKED = TO.filter(function (r) { return r.label; }).length;
console.log("  watermark   " + (MARKED === 0
  ? "none — an unlabelled passphrase cannot name its reader; use --to for that"
  : MARKED === TO.length
    ? "per recipient, tiled on every slide"
    : MARKED + " of " + TO.length + " labelled — only those readers are marked"));
console.log("  printing    refused (@media print)");
console.log("  build       " + STAMP + " · briefing " + BUILD + "  (shasum -a 256 lp-briefing.html)");
