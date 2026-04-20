const FONT_FAMILIES = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
};

// Memoize by serialized settings key so the 2KB injection string isn't rebuilt each call
const _readerJSCache = new Map();
export function buildReaderJS(rs) {
  const ff = FONT_FAMILIES[rs?.fontFamily] || FONT_FAMILIES.serif;
  const fs = rs?.fontSize || 18;
  const bg = rs?.bgColor || '#1a1a1a';
  const tc = rs?.textColor || '#e0e0e0';
  const cacheKey = `${rs?.fontFamily}:${fs}:${bg}:${tc}`;
  if (_readerJSCache.has(cacheKey)) return _readerJSCache.get(cacheKey);

  const script = `(function(){
  if(window.__flipReaderActive) return;
  window.__flipReaderActive=true;
  window.__flipOrigHTML=document.documentElement.outerHTML;

  /* ---------- Simplified Readability extraction ---------- */
  function scoreNode(el){
    var s=0, tag=el.tagName;
    if(tag==='ARTICLE') s+=30;
    if(tag==='SECTION') s+=10;
    if(tag==='DIV') s+=5;
    var cls=(el.className||'')+(el.id||'');
    if(/article|post|entry|content|story|body-text|main-content/i.test(cls)) s+=25;
    if(/comment|sidebar|footer|header|nav|menu|ad|promo|related|widget|social|share|cookie|popup|modal|newsletter|breadcrumb/i.test(cls)) s-=25;
    return s;
  }
  function textLen(el){ return (el.innerText||'').length; }
  var candidates=[].slice.call(document.querySelectorAll('article, [role=main], main, .post-content, .entry-content, .article-body, .story-body, #article-body'));
  if(!candidates.length) candidates=[].slice.call(document.querySelectorAll('div, section'));
  var best=null, bestScore=-Infinity;
  candidates.forEach(function(el){
    var tl=textLen(el);
    if(tl<140) return;
    var sc=scoreNode(el)+Math.min(tl/10,200);
    var pCount=el.querySelectorAll('p').length;
    sc+=pCount*3;
    var linkDensity=0;
    var links=el.querySelectorAll('a');
    var linkText=0; links.forEach(function(a){linkText+=(a.innerText||'').length;});
    if(tl>0) linkDensity=linkText/tl;
    if(linkDensity>0.5) sc-=50;
    if(sc>bestScore){bestScore=sc;best=el;}
  });
  if(!best) best=document.body;

  /* Extract clean content */
  var clone=best.cloneNode(true);
  /* Remove unwanted elements from clone */
  var junk=clone.querySelectorAll('script,style,noscript,iframe,nav,footer,header,.ad,.ads,.advertisement,.social-share,.comments,.related-posts,.cookie-banner,.popup,.modal,.overlay,.newsletter,[role=banner],[role=navigation],[role=complementary],[role=contentinfo],.share-buttons,.breadcrumbs,aside,.sidebar');
  for(var i=0;i<junk.length;i++) junk[i].remove();

  /* Get title */
  var title=document.title;
  var h1=document.querySelector('h1');
  if(h1) title=h1.innerText||title;

  /* Get site name */
  var siteName='';
  var ogSite=document.querySelector('meta[property="og:site_name"]');
  if(ogSite) siteName=ogSite.getAttribute('content')||'';

  /* Get reading time */
  var wordCount=(clone.innerText||'').split(/\\s+/).length;
  var readMin=Math.max(1,Math.round(wordCount/230));

  /* Build clean page */
  var content=clone.innerHTML;
  document.documentElement.innerHTML='<head><meta charset="utf-8"><title>'+title.replace(/</g,'&lt;')+'</title></head><body>'+
    '<div id="flip-reader-root">'+
    '<div class="flip-reader-meta">'+
      (siteName?'<span class="flip-reader-site">'+siteName.replace(/</g,'&lt;')+'</span>':'')+
      '<span class="flip-reader-time">'+readMin+' min read · '+wordCount.toLocaleString()+' words</span>'+
    '</div>'+
    '<h1 class="flip-reader-title">'+title.replace(/</g,'&lt;')+'</h1>'+
    '<div class="flip-reader-content">'+content+'</div>'+
    '</div></body>';

  /* Apply styles */
  var s=document.createElement('style');
  s.textContent=\\\`
    *{margin:0;padding:0;box-sizing:border-box;}
    html,body{background:${bg};color:${tc};font-family:${ff};font-size:${fs}px;line-height:1.8;-webkit-font-smoothing:antialiased;}
    #flip-reader-root{max-width:680px;margin:0 auto;padding:48px 24px 80px;}
    .flip-reader-meta{display:flex;align-items:center;gap:12px;margin-bottom:16px;font-size:12px;color:rgba(255,255,255,0.3);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}
    .flip-reader-site{color:#ff7a4d;font-weight:600;}
    .flip-reader-title{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:2em;font-weight:700;color:#fff;line-height:1.25;margin-bottom:32px;}
    .flip-reader-content p{margin-bottom:1.2em;}
    .flip-reader-content img{max-width:100%;height:auto;border-radius:8px;margin:20px 0;}
    .flip-reader-content a{color:#ff7a4d;text-decoration:underline;text-underline-offset:2px;}
    .flip-reader-content h1,.flip-reader-content h2,.flip-reader-content h3,.flip-reader-content h4,.flip-reader-content h5,.flip-reader-content h6{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff;line-height:1.3;margin:1.5em 0 0.5em;}
    .flip-reader-content pre,.flip-reader-content code{background:rgba(255,255,255,0.05);color:${tc};border-radius:6px;padding:2px 6px;font-size:14px;}
    .flip-reader-content pre{padding:16px;overflow-x:auto;margin:16px 0;}
    .flip-reader-content blockquote{border-left:3px solid #ff7a4d;margin:16px 0;padding-left:20px;color:#aaa;font-style:italic;}
    .flip-reader-content table{border-collapse:collapse;width:100%;margin:16px 0;}
    .flip-reader-content th,.flip-reader-content td{border:1px solid #333;padding:8px 12px;}
    .flip-reader-content ul,.flip-reader-content ol{padding-left:24px;margin-bottom:1em;}
    .flip-reader-content li{margin-bottom:0.4em;}
    .flip-reader-content figure{margin:20px 0;}
    .flip-reader-content figcaption{font-size:13px;color:rgba(255,255,255,0.35);margin-top:8px;text-align:center;}
    ::selection{background:#ff7a4d;color:#fff;}
    ::-webkit-scrollbar{width:6px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:3px;}
  \\\`;
  document.head.appendChild(s);
})();`;

  _readerJSCache.set(cacheKey, script);
  return script;
}

// Static constant — this string never changes at runtime
const READER_EXIT_JS = `(function(){
  if(!window.__flipReaderActive||!window.__flipOrigHTML) return;
  window.__flipReaderActive=false;
  document.documentElement.innerHTML=window.__flipOrigHTML;
  /* Re-run page scripts won't work after innerHTML replace, so just reload */
  location.reload();
})();`;

export function buildReaderExitJS() { return READER_EXIT_JS; }
